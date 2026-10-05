import { findDrift, mergeValuations } from '../../data/scheduler/lib/kv-sync.mjs';

import { verifyPinHash } from './auth.js';
import { errRes, jsonRes } from './http.js';

// ── ウォッチリスト（KV）────────────────────────────────
// GET: 公開（銘柄のシンボル・名称のみで数量・金額を含まない）
// PUT: 現状は認証なし（kv-resync の Actions が PIN なしで使うため。扱いは別 Issue で検討・#714）
export async function handleWatchlist(request, env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);
  const key = 'watchlist';

  if (request.method === 'GET') {
    const val = await env.KV.get(key);
    return jsonRes(val ? JSON.parse(val) : [], 200, origin);
  }
  if (request.method === 'PUT') {
    let body;
    try {
      body = await request.json();
    } catch {
      return errRes('JSON 不正', 400, origin);
    }
    if (!Array.isArray(body)) return errRes('Array が必要です', 400, origin);

    for (let i = 0; i < body.length; i++) {
      const item = body[i];
      if (!item || typeof item !== 'object') return errRes(`watchlist[${i}]: object が必要です`, 400, origin);
      if (typeof item.symbol !== 'string' || !item.symbol.trim())
        return errRes(`watchlist[${i}].symbol は必須です`, 400, origin);
      if (typeof item.name !== 'string' || !item.name.trim())
        return errRes(`watchlist[${i}].name は必須です`, 400, origin);
      if (typeof item.exchange !== 'string' || !item.exchange.trim())
        return errRes(`watchlist[${i}].exchange は必須です`, 400, origin);
      if (typeof item.type !== 'string' || !item.type.trim())
        return errRes(`watchlist[${i}].type は必須です`, 400, origin);
      if (typeof item.cur !== 'string' || !item.cur.trim())
        return errRes(`watchlist[${i}].cur は必須です`, 400, origin);
    }

    await env.KV.put(key, JSON.stringify(body));
    return jsonRes({ ok: true }, 200, origin);
  }
  return errRes('GET/PUT のみ許可', 405, origin);
}

// ── ウォッチリストの同期（POST /watchlist/resync・Cron）──────────────────
// 公開リポ main の data/valuations.json を SHA 固定で取得し、KV watchlist の valuation に写す（#715 PR2）。
// 設計: docs/handoff/2026-10-05-watchlist-resync-worker.md §4。
// - 入力はリポ・ブランチ・ファイルとも固定。リクエストの本文・クエリは読まない（§4.5）。
// - 正本にある銘柄の valuation だけを丸ごと差し替える。他フィールド・並び順・正本に無い銘柄は据え置き。
// - ズレが無ければ KV に書かない（冪等）。main の URL へのフォールバックはしない。
// - 応答・ログに出すのはシンボル・件数・stage・SHA・HTTP ステータスだけ（KV の本文・正本の値・トークンは出さない）。
const RESYNC_REPO = 'shoulang0729/portfolio';
const RESYNC_SHA_URL = `https://api.github.com/repos/${RESYNC_REPO}/commits/main`;
const RESYNC_RAW_BASE = `https://raw.githubusercontent.com/${RESYNC_REPO}`;
const RESYNC_FILE = 'data/valuations.json';
const RESYNC_MAX_ATTEMPTS = 3;
const RESYNC_BACKOFF_MS = [2000, 4000];
const RESYNC_SHA_TIMEOUT_MS = 10000;
const RESYNC_RAW_TIMEOUT_MS = 15000;
const RESYNC_MAX_BYTES = 2 * 1024 * 1024;

const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch を計 3 回まで試す（429・5xx・ネットワークエラー・タイムアウトのみ再試行。間隔 2s→4s）。
 * @returns {Promise<{res: Response|null, status: number}>} 最後の応答（ネットワークエラーで終わったら res=null・status=0）
 */
async function _fetchWithRetry(url, init, timeoutMs, sleep) {
  let res = null;
  let status = 0;
  for (let attempt = 1; attempt <= RESYNC_MAX_ATTEMPTS; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    let retryable = false;
    try {
      res = await fetch(url, { ...init, signal: ac.signal });
      status = res.status;
      retryable = status === 429 || status >= 500;
    } catch {
      res = null;
      status = 0;
      retryable = true;
    } finally {
      clearTimeout(timer);
    }
    if (!retryable || attempt === RESYNC_MAX_ATTEMPTS) break;
    await sleep(RESYNC_BACKOFF_MS[attempt - 1]);
  }
  return { res, status };
}

function _resyncFail(status, stage, error, http = 0) {
  return { ok: false, status, stage, error, http };
}

/**
 * KV の watchlist 文字列を配列として読む。無い・空は []。配列でなければ null。
 * @param {string|null} raw
 * @returns {Array<any>|null}
 */
function _parseKvWatchlist(raw) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * 公開 main の valuations.json を KV watchlist の valuation に写す（ルートと Cron で共通・§4.2）。
 * @param {any} env
 * @param {{sleep?: (ms: number) => Promise<void>}} [deps] テスト用（リトライ間隔の待ち）
 * @returns {Promise<{ok: true, stage: 'noop'|'resynced', drift: number, symbols: string[], sha: string}
 *   | {ok: false, status: number, stage: string, error: string, http: number}>}
 */
export async function resyncWatchlistFromMain(env, deps = {}) {
  const sleep = deps.sleep || _sleep;
  if (!env.KV) return _resyncFail(500, 'kv', 'KV 未設定');

  // ① main の先頭コミット SHA（Cloudflare 側でキャッシュしない・トークンは読むだけ・§10 Q2）
  const token = env.GH_DISPATCH_TOKEN || env.GITHUB_TOKEN;
  /** @type {Record<string, string>} */
  const shaHeaders = {
    Accept: 'application/vnd.github.sha',
    'User-Agent': 'portfolio-proxy-worker',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) shaHeaders.Authorization = `Bearer ${token}`;
  const shaRes = await _fetchWithRetry(
    RESYNC_SHA_URL,
    { method: 'GET', headers: shaHeaders, cache: 'no-store' },
    RESYNC_SHA_TIMEOUT_MS,
    sleep
  );
  if (!shaRes.res || shaRes.status !== 200) {
    return _resyncFail(502, 'sha', 'main の SHA を取得できません', shaRes.status);
  }
  let sha = '';
  try {
    sha = (await shaRes.res.text()).trim();
  } catch {
    sha = '';
  }
  if (!/^[0-9a-f]{40}$/.test(sha)) return _resyncFail(502, 'sha', 'main の SHA が不正です', shaRes.status);

  // ② SHA 固定で正本を取得（main の URL へのフォールバックはしない）
  const rawRes = await _fetchWithRetry(
    `${RESYNC_RAW_BASE}/${sha}/${RESYNC_FILE}`,
    { method: 'GET', headers: { 'User-Agent': 'portfolio-proxy-worker' } },
    RESYNC_RAW_TIMEOUT_MS,
    sleep
  );
  if (!rawRes.res || rawRes.status !== 200) {
    return _resyncFail(502, 'fetch', 'valuations.json を取得できません', rawRes.status);
  }
  const len = Number(rawRes.res.headers.get('Content-Length'));
  if (Number.isFinite(len) && len > RESYNC_MAX_BYTES) {
    return _resyncFail(502, 'fetch', 'valuations.json が大きすぎます', rawRes.status);
  }
  let text;
  try {
    text = await rawRes.res.text();
  } catch {
    return _resyncFail(502, 'fetch', 'valuations.json を取得できません', rawRes.status);
  }
  if (new TextEncoder().encode(text).length > RESYNC_MAX_BYTES) {
    return _resyncFail(502, 'fetch', 'valuations.json が大きすぎます', rawRes.status);
  }

  // ③ 検証
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return _resyncFail(502, 'parse', 'valuations.json が JSON ではありません');
  }
  const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
  const valuations = isObj(doc) ? doc.valuations : null;
  if (!isObj(valuations) || !Object.keys(valuations).length || !Object.values(valuations).every(isObj)) {
    return _resyncFail(502, 'validate', 'valuations.json の形が不正です');
  }

  // ④〜⑥ KV の読み込み・ズレの算出・書き込み（書く直前に読み直し、変わっていれば 1 回だけやり直す）
  let raw = await env.KV.get('watchlist');
  let kv = _parseKvWatchlist(raw);
  if (!kv) return _resyncFail(500, 'kv', 'KV の watchlist が配列ではありません');
  for (let round = 0; ; round++) {
    const symbols = findDrift(kv, valuations);
    if (!symbols.length) return { ok: true, stage: 'noop', drift: 0, symbols: [], sha };
    const again = await env.KV.get('watchlist');
    if (again !== raw) {
      const next = _parseKvWatchlist(again);
      if (!next) return _resyncFail(500, 'kv', 'KV の watchlist が配列ではありません');
      raw = again;
      kv = next;
      if (round === 0) continue; // 読み直した内容で 1 回だけやり直す
      // 2 回目も変わっていた: その時点の内容でマージして書く
      const late = findDrift(kv, valuations);
      if (!late.length) return { ok: true, stage: 'noop', drift: 0, symbols: [], sha };
      await env.KV.put('watchlist', JSON.stringify(mergeValuations(kv, valuations)));
      return { ok: true, stage: 'resynced', drift: late.length, symbols: late, sha };
    }
    await env.KV.put('watchlist', JSON.stringify(mergeValuations(kv, valuations)));
    return { ok: true, stage: 'resynced', drift: symbols.length, symbols, sha };
  }
}

// POST /watchlist/resync: 認証なし（Origin ゲートのみ・§4.5）。本文・クエリは読まない。
export async function handleWatchlistResync(request, env, origin) {
  if (request.method !== 'POST') return errRes('POST のみ許可', 405, origin);
  if (!env.KV) return errRes('KV 未設定', 500, origin);
  const r = await resyncWatchlistFromMain(env);
  if (!r.ok) {
    console.warn(`[watchlist-resync] fail stage=${r.stage} http=${r.http}`);
    return jsonRes({ error: r.error, stage: r.stage }, r.status, origin);
  }
  console.log(`[watchlist-resync] ${r.stage} ${r.drift} sha=${r.sha.slice(0, 7)}`);
  return jsonRes({ ok: true, stage: r.stage, drift: r.drift, symbols: r.symbols, sha: r.sha }, 200, origin);
}

// ── 保有銘柄（KV・非公開）────────────────────────────────────
// GET/PUT とも X-Pin-Hash ヘッダーによる PIN 認証が必要（GET は #714 で追加）
export async function handlePositions(request, env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);

  if (request.method === 'GET') {
    const authErr = await verifyPinHash(request, env, origin);
    if (authErr) return authErr;
    const val = await env.KV.get('positions');
    return jsonRes(val ? JSON.parse(val) : [], 200, origin);
  }

  if (request.method === 'PUT') {
    const authErr = await verifyPinHash(request, env, origin);
    if (authErr) return authErr;

    let body;
    try {
      body = await request.json();
    } catch {
      return errRes('JSON 不正', 400, origin);
    }
    if (!Array.isArray(body)) return errRes('Array が必要です', 400, origin);

    for (let i = 0; i < body.length; i++) {
      const pos = body[i];
      if (!pos || typeof pos !== 'object') return errRes(`positions[${i}]: object が必要です`, 400, origin);
      if (typeof pos.symbol !== 'string' || !pos.symbol.trim())
        return errRes(`positions[${i}].symbol は必須です`, 400, origin);
      if (typeof pos.name !== 'string' || !pos.name.trim())
        return errRes(`positions[${i}].name は必須です`, 400, origin);
      if (typeof pos.cat !== 'string' || !pos.cat.trim()) return errRes(`positions[${i}].cat は必須です`, 400, origin);
      if (typeof pos.shares !== 'number' || !isFinite(pos.shares))
        return errRes(`positions[${i}].shares は有限数値が必要です`, 400, origin);
      if (typeof pos.price !== 'number' || !isFinite(pos.price))
        return errRes(`positions[${i}].price は有限数値が必要です`, 400, origin);
      if (typeof pos.avgCost !== 'number' || !isFinite(pos.avgCost))
        return errRes(`positions[${i}].avgCost は有限数値が必要です`, 400, origin);
      if (typeof pos.value !== 'number' || !isFinite(pos.value))
        return errRes(`positions[${i}].value は有限数値が必要です`, 400, origin);
      if (typeof pos.pnl !== 'number' || !isFinite(pos.pnl))
        return errRes(`positions[${i}].pnl は有限数値が必要です`, 400, origin);
      if (typeof pos.pnlPct !== 'number' || !isFinite(pos.pnlPct))
        return errRes(`positions[${i}].pnlPct は有限数値が必要です`, 400, origin);
      if (typeof pos.cur !== 'string' || !pos.cur.trim()) return errRes(`positions[${i}].cur は必須です`, 400, origin);
      if (typeof pos.ySymbol !== 'string' || !pos.ySymbol.trim())
        return errRes(`positions[${i}].ySymbol は必須です`, 400, origin);
    }

    await env.KV.put('positions', JSON.stringify(body));

    return jsonRes({ ok: true }, 200, origin);
  }

  return errRes('GET/PUT のみ許可', 405, origin);
}

// ── ネットワース機微データ（KV・非公開・#589 Phase2）────────────────────
// ★GET/PUT とも X-Pin-Hash による PIN 認証必須（handoff AC3「機微データは認証後のみ」）。
//   /positions と異なり GET も PIN 必須にする: オリジンゲートは Origin ヘッダを
//   送らない非ブラウザクライアント（curl 等）を弾けないため、Origin 判定だけでは
//   負債・純資産が公開読み出し可能になってしまう（2026-07-21 実測で確認・#589）。
//   ※/positions の GET も #714 で PIN 必須にした。
// mf-holdings 完全版（liabilities/realAssetsTotal/netWorthComputed 等の機微
// フィールドを含みうる）をそのまま JSON で保存・配信する。公開リポには一切
// 書かない（GitHub ミラーは行わない）。
// スキーマ検証は最小限（object であること）。実体の型は消費側
// （src/networth.js）が吸収する。
export async function handleNetworth(request, env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);

  if (request.method === 'GET') {
    const authErr = await verifyPinHash(request, env, origin);
    if (authErr) return authErr;
    const val = await env.KV.get('networth');
    return jsonRes(val ? JSON.parse(val) : null, 200, origin);
  }

  if (request.method === 'PUT') {
    const authErr = await verifyPinHash(request, env, origin);
    if (authErr) return authErr;

    let body;
    try {
      body = await request.json();
    } catch {
      return errRes('JSON 不正', 400, origin);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return errRes('object が必要です', 400, origin);
    }

    await env.KV.put('networth', JSON.stringify(body));
    return jsonRes({ ok: true }, 200, origin);
  }

  return errRes('GET/PUT のみ許可', 405, origin);
}
