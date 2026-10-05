// portfolio-proxy — Cloudflare Worker
//
// ルート一覧:
//   GET  /yahoo?url=<encoded>           Yahoo Finance プロキシ（CORS 回避）
//   GET  /finnhub?path=<path>&<params>  Finnhub プロキシ（APIキー隠蔽）
//   GET  /fmp?path=<path>&<params>      Financial Modeling Prep プロキシ（APIキー隠蔽・quality 用）
//   GET  /edgar?path=<path>             SEC EDGAR プロキシ（キー不要・UA付与・quality 照合用）
//   GET  /edinet-db?path=<path>         EDINET DB プロキシ（APIキー隠蔽・日本株 quality 用）
//   GET  /forex?from=<from>&to=<to>    為替レートプロキシ（Yahoo Finance）
//   GET  /etf/constituents?symbol=<sym> ETF 構成銘柄（look-through・KV キャッシュ）。取得アダプタ未実装のため
//                                       現状はキャッシュが無ければ 404（etf-constituents.js・#305）
//   GET  /watchlist                     ウォッチリスト取得（KV・公開）
//   PUT  /watchlist                     ウォッチリスト保存（KV・認証なし＝kv-resync の Actions が使う）
//   GET  /positions                     保有銘柄取得（KV・非公開・PIN認証必須・#714）
//   PUT  /positions                     保有銘柄保存（KV・PIN認証必須）
//   GET  /networth                      ネットワース機微データ取得（KV・非公開・PIN認証必須・#589 Phase2）
//   PUT  /networth                      ネットワース機微データ保存（KV・PIN認証必須・#589 Phase2）
//   GET  /order-sheet                   注文表を計算して返す（KV・PIN認証必須・KV に書かない・#672）
//   GET  /order-sheet/plan              注文表の設定 order:plan 取得（KV・PIN認証必須・#672）
//   PUT  /order-sheet/plan              注文表の設定 order:plan 置換（KV・PIN認証必須・rev 楽観ロック・#672）
//   POST /order-sheet/events            注文表の状態変更（KV・PIN認証必須・rev 楽観ロック・#672）
//   GET  /auth/pin-hash                 PIN 設定状態確認（ハッシュ値は返さない）
//   PUT  /auth/pin-hash                 PIN ハッシュ更新/端末復旧（KV）
//   GET  /prices/cache                  Cron キャッシュ価格取得（KV）
//   GET  /auth/challenge                パスキー認証チャレンジ生成
//   POST /auth/register                 パスキー登録
//   POST /auth/verify                   パスキー検証
//
// 無効化済み（どのメソッドでも 410 Gone・CORS 付き。古いキャッシュのアプリ向けに 404 にしない）:
//   *    /portfolio/snapshot            スナップショット保存の停止（#709）
//   *    /ai/{gemini,grok,deepseek,claude,models,context}, /notion/save
//                                       AI タブ専用ルートの停止（#714）
//   *    /ai/openai                     マネフォ画像取込の削除（#718）
//
// 環境変数（Cloudflare Secrets / vars・名前のみ）:
//   FINNHUB_API_KEY      /finnhub・Cron の価格キャッシュ
//   FMP_API_KEY          /fmp
//   EDINET_DB_API_KEY    /edinet-db
//   SEC_USER_AGENT       /edgar（未設定時は既定の UA）
//   GH_DISPATCH_TOKEN    per-daily.yml の起動（無ければ GITHUB_TOKEN）
//   GITHUB_TOKEN         同上のフォールバック
//   ALLOWED_ORIGIN       CORS の許可 Origin（vars・未設定時は https://shoulang0729.github.io）
//   （GEMINI/GROK/DEEPSEEK/ANTHROPIC/NOTION 系は #714 以降、OPENAI_API_KEY は #718 以降 Worker からは参照しない）
// Binding:
//   KV                   Cloudflare KV namespace
//   RATE_LIMITER         Workers ネイティブ ratelimit（rate-limit.md・未設定時は素通し）
//
// Cron（wrangler.toml）:
//   0 1,8,15,22 * * *  — 1日4回、全保有銘柄の価格を取得してキャッシュ
//                        ＋注文表の約定（mf の株数の増減）を order:plan に確定（変化時のみ書く・#672）
//   20 20,21 * * *     — per-daily.yml を workflow_dispatch で起動（#708）。
//                        米国東部の夏時間は 20:20 UTC、冬時間は 21:20 UTC の回だけ。他の処理はしない。
//                        トークンは GH_DISPATCH_TOKEN || GITHUB_TOKEN（ログには名前だけ）

import {
  CONSTITUENTS_KV_PREFIX,
  CONSTITUENTS_TTL,
  buildConstituentsResponse,
  fetchEtfConstituents,
} from './etf-constituents.js';
import {
  OrderEventError,
  appendLog,
  applyEvent,
  detectFills,
  isUsdSymbol,
  isValidSymbolKey,
  sanitizePlan,
  validatePlan,
} from './order-plan.js';
import { buildOrderSheet } from './order-sheet-calc.js';
import { isUsEasternDst } from './us-dst.js';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const PER_DAILY_CRON = '20 20,21 * * *';
const PER_DAILY_DISPATCH_URL =
  'https://api.github.com/repos/shoulang0729/portfolio/actions/workflows/per-daily.yml/dispatches';
const FMP_BASE = 'https://financialmodelingprep.com';

/**
 * Yahoo Finance シンボルを Finnhub シンボルに変換
 * 例: '9983.T' → 'TYO:9983' / '0700.HK' → 'HKG:0700'
 */
function _workerToFinnhubSymbol(ySymbol) {
  if (!ySymbol) return ySymbol;
  if (ySymbol.endsWith('.T')) return 'TYO:' + ySymbol.slice(0, -2);
  if (ySymbol.endsWith('.HK')) return 'HKG:' + ySymbol.slice(0, -3);
  return ySymbol;
}

// ── レート制限 ────────────────────────────────────────
// KV shard 方式（旧 #62）は 1 リクエストあたり KV 読み 5・書き 1 を消費し、
// 無料枠の書き込み上限 1,000/日が実質ボトルネックになった（2026-09-21 に
// 50% 到達アラート）。#16 対応で KV 実装を撤去し、Workers ネイティブの
// ratelimit binding（wrangler.toml の RATE_LIMITER・KV 不使用・無料）に移行。
// 判定は fetch ルーティング内で実施。経緯は worker/src/rate-limit.md を参照。

// ── CORS ──────────────────────────────────────────────
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Pin-Hash',
    'Access-Control-Max-Age': '86400',
  };
}

function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  const allowed = env.ALLOWED_ORIGIN || 'https://shoulang0729.github.io';
  if (origin === allowed) return true;
  // ローカル開発用
  if (origin.startsWith('http://localhost:')) return true;
  if (origin.startsWith('http://127.0.0.1:')) return true;
  return false;
}

// ── レスポンスヘルパー ─────────────────────────────────
function jsonRes(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function errRes(msg, status, origin) {
  return jsonRes({ error: msg }, status, origin);
}

// ── 為替レートプロキシ ────────────────────────────
async function handleForex(url, env, origin) {
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!from || !to) return errRes('from と to パラメータが必要です', 400, origin);

  const cacheKey = `forex:${from}${to}`;
  const cached = await env.KV.get(cacheKey);
  if (cached) {
    try {
      const data = JSON.parse(cached);
      return jsonRes(data, 200, origin);
    } catch {}
  }

  try {
    const symbol = `${from}${to}=X`;
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`, {
      cf: { cacheTtl: 300 },
    });
    if (!res.ok) return errRes('Yahoo Finance API エラー', 502, origin);

    const data = await res.json();
    const price = data?.chart?.result?.[0]?.regularMarketPrice;
    if (!price) return errRes('レート取得失敗', 502, origin);

    const result = { from, to, rate: price, ts: Date.now() };
    await env.KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 3600 });
    return jsonRes(result, 200, origin);
  } catch (e) {
    console.error('[forex]', e);
    return errRes('レート取得エラー', 502, origin);
  }
}

// ── Yahoo Finance crumb キャッシュ ────────────────────────────
async function getYahooCrumb(env) {
  // KV キャッシュ確認（50分以内なら再利用）
  if (env.KV) {
    try {
      const cached = await env.KV.get('yahoo:crumb', 'json');
      if (cached?.crumb && cached?.cookie && Date.now() - (cached.ts || 0) < 3000000) {
        return cached;
      }
    } catch {}
  }

  // Yahoo Finance からセッションクッキーを取得
  // 注: 旧 fc.yahoo.com は 2026 時点で HTTP 404 となり crumb 取得が壊れていた（#228）。
  //     finance.yahoo.com からセッション cookie を取得する方式に変更。
  const ua =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  // cookie 取得元の候補（順に試し、最初に取れたものを使う）
  const COOKIE_SOURCES = ['https://finance.yahoo.com/', 'https://query2.finance.yahoo.com/v1/test/getcrumb'];
  try {
    let cookie = '';
    for (const src of COOKIE_SOURCES) {
      try {
        const cookieRes = await fetch(src, {
          redirect: 'follow',
          headers: { 'User-Agent': ua, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
        });
        // 複数の Set-Cookie を全て収集（getSetCookie 優先、無ければ単一 set-cookie）
        const rawList =
          typeof cookieRes.headers.getSetCookie === 'function'
            ? cookieRes.headers.getSetCookie()
            : cookieRes.headers.get('set-cookie')
              ? [cookieRes.headers.get('set-cookie')]
              : [];
        const pairs = rawList.map((c) => c.split(';')[0].trim()).filter(Boolean);
        if (pairs.length) {
          cookie = pairs.join('; ');
          break;
        }
      } catch {
        /* 次の候補へ */
      }
    }
    if (!cookie) return null;

    // crumb を取得
    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': ua, Cookie: cookie },
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.length > 50 || crumb.startsWith('<')) return null;

    const result = { crumb, cookie, ts: Date.now() };
    if (env.KV) {
      await env.KV.put('yahoo:crumb', JSON.stringify(result), { expirationTtl: 3000 });
    }
    return result;
  } catch {
    return null;
  }
}

// ── Yahoo Finance プロキシ ────────────────────────────
async function handleYahoo(url, env, origin) {
  const target = url.searchParams.get('url');
  if (!target) return errRes('url パラメータが必要です', 400, origin);

  const decoded = decodeURIComponent(target);
  let parsed;
  try {
    parsed = new URL(decoded);
  } catch {
    return errRes('不正な URL です', 400, origin);
  }

  if (parsed.protocol !== 'https:') {
    return errRes('HTTPS のみ許可されています', 400, origin);
  }

  const allowedHosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  if (!allowedHosts.includes(parsed.hostname)) {
    return errRes('許可されていないホストです', 400, origin);
  }

  try {
    // crumb を取得（失敗しても fetch は続行）
    const crumbData = await getYahooCrumb(env);

    // crumb を URL に付与（既に crumb パラメータがない場合のみ）
    let fetchUrl = decoded;
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    };
    if (crumbData) {
      headers['Cookie'] = crumbData.cookie;
      if (!fetchUrl.includes('crumb=')) {
        fetchUrl += `${fetchUrl.includes('?') ? '&' : '?'}crumb=${encodeURIComponent(crumbData.crumb)}`;
      }
    }

    const res = await fetch(fetchUrl, { headers });
    if (!res.ok) return errRes(`Yahoo Finance エラー: ${res.status}`, res.status, origin);
    const data = await res.json();
    return jsonRes(data, 200, origin);
  } catch (e) {
    return errRes(`取得失敗: ${e.message}`, 502, origin);
  }
}

// ── Finnhub プロキシ ──────────────────────────────────
async function handleFinnhub(url, env, origin) {
  const apiKey = env.FINNHUB_API_KEY;
  if (!apiKey) return errRes('Finnhub APIキーが未設定です', 500, origin);

  const path = url.searchParams.get('path') || '/quote';
  if (!/^\/[a-z0-9/_-]+$/i.test(path)) {
    return errRes('不正な path です', 400, origin);
  }

  const params = new URLSearchParams(url.searchParams);
  params.delete('path');
  params.set('token', apiKey);

  try {
    const res = await fetch(`${FINNHUB_BASE}${path}?${params}`);
    const data = await res.json();
    return jsonRes(data, res.status, origin);
  } catch (e) {
    return errRes(`取得失敗: ${e.message}`, 502, origin);
  }
}

// ── SEC EDGAR プロキシ（quality 照合/フォールバック用・キー不要だが UA 必須） ──
// data.sec.gov は User-Agent 必須（無いと 403）。path は XBRL 系のみ許可。
async function handleEdgar(url, env, origin) {
  const path = url.searchParams.get('path') || '';
  if (!/^\/api\/xbrl\/(companyfacts|companyconcept|frames)\/[a-zA-Z0-9/._-]+$/.test(path)) {
    return errRes('不正な path です', 400, origin);
  }
  const ua = env.SEC_USER_AGENT || 'portfolio-quality contact@example.com';
  try {
    const res = await fetch(`https://data.sec.gov${path}`, {
      headers: { 'User-Agent': ua, Accept: 'application/json' },
    });
    const data = await res.json();
    return jsonRes(data, res.status, origin);
  } catch (e) {
    return errRes(`取得失敗: ${e.message}`, 502, origin);
  }
}

// ── EDINET DB プロキシ（日本株 quality 取得用） ──
// edinetdb.jp の /v1/* エンドポイントに X-API-Key を付与してプロキシする。
// path は /v1/companies/{code}/financials 等の読み取り専用エンドポイントのみ許可。
async function handleEdinetDb(url, env, origin) {
  const apiKey = env.EDINET_DB_API_KEY;
  if (!apiKey) return errRes('EDINET DB APIキーが未設定です', 500, origin);

  const path = url.searchParams.get('path') || '';
  if (!/^\/v1\/(companies|search)(\/[a-zA-Z0-9._-]+)*(\/[a-zA-Z0-9_-]+)?(\?.*)?$/.test(path)) {
    return errRes('不正な path です', 400, origin);
  }

  const params = new URLSearchParams(url.searchParams);
  params.delete('path');
  const qs = params.toString();

  try {
    const fetchUrl = `https://edinetdb.jp${path}${qs ? `?${qs}` : ''}`;
    const res = await fetch(fetchUrl, { headers: { 'X-API-Key': apiKey, Accept: 'application/json' } });
    const data = await res.json();
    return jsonRes(data, res.status, origin);
  } catch (e) {
    return errRes(`取得失敗: ${e.message}`, 502, origin);
  }
}

// ── Financial Modeling Prep プロキシ（quality ファンダ取得用） ──
// 日次/週次バッチが key-metrics / ratios / 財務3表を叩いて quality を算出する。
// path は FMP の /api/v3・/api/v4・/stable のいずれかのみ許可（apikey は Secret 付与）。
async function handleFmp(url, env, origin) {
  const apiKey = env.FMP_API_KEY;
  if (!apiKey) return errRes('FMP APIキーが未設定です', 500, origin);

  const path = url.searchParams.get('path') || '';
  if (!/^\/(api\/v[34]|stable)\/[a-zA-Z0-9/._-]+$/.test(path)) {
    return errRes('不正な path です', 400, origin);
  }

  const params = new URLSearchParams(url.searchParams);
  params.delete('path');
  params.set('apikey', apiKey);

  try {
    const res = await fetch(`${FMP_BASE}${path}?${params}`);
    const data = await res.json();
    return jsonRes(data, res.status, origin);
  } catch (e) {
    return errRes(`取得失敗: ${e.message}`, 502, origin);
  }
}

// ══════════════════════════════════════════════════════════════
// POST /portfolio/snapshot — 無効化済み（#709）
//   未使用の書き込み経路として停止。GitHub への push・KV からの組み立ては行わない。
//   どのメソッドでも 410 Gone（CORS 付き）を返す。
// ══════════════════════════════════════════════════════════════
function handlePortfolioSnapshot(origin) {
  return errRes('スナップショット保存は無効化されました', 410, origin);
}

// ══════════════════════════════════════════════════════════════
// 無効化済みルート（#714）
//   AI タブ（src/_disabled/ に退避・無効化中）専用だったルート。
//   /ai/gemini・/ai/grok・/ai/deepseek・/ai/claude・/ai/models・/ai/context・/notion/save
//   /ai/openai はマネフォ画像取込（アプリから削除）専用だったため #718 で追加。
//   どのメソッドでも 410 Gone（CORS 付き）を返す。外部 fetch・KV には触れない。
// ══════════════════════════════════════════════════════════════
const DISABLED_PATHS = new Set([
  '/ai/gemini',
  '/ai/grok',
  '/ai/deepseek',
  '/ai/claude',
  '/ai/models',
  '/ai/context',
  '/notion/save',
  '/ai/openai',
]);

function handleDisabledRoute(origin) {
  return errRes('このルートは無効化されました', 410, origin);
}

// ── ウォッチリスト（KV）────────────────────────────────
// GET: 公開（銘柄のシンボル・名称のみで数量・金額を含まない）
// PUT: 現状は認証なし（kv-resync の Actions が PIN なしで使うため。扱いは別 Issue で検討・#714）
async function handleWatchlist(request, env, origin) {
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

// ── 保有銘柄（KV・非公開）────────────────────────────────────
// GET/PUT とも X-Pin-Hash ヘッダーによる PIN 認証が必要（GET は #714 で追加）
// X-Pin-Hash ヘッダーを KV の保存ハッシュと照合する。
// OK なら null、NG なら errRes を返す（呼び出し側でそのまま return する）。
async function verifyPinHash(request, env, origin) {
  const pinHash = request.headers.get('X-Pin-Hash');
  if (!pinHash) return errRes('認証が必要です（X-Pin-Hash）', 401, origin);
  const storedHash = await env.KV.get('auth:pin-hash');
  if (!storedHash) return errRes('PIN初期設定が必要です', 428, origin);
  if (pinHash !== storedHash) return errRes('PIN認証失敗', 401, origin);
  return null;
}

async function handlePositions(request, env, origin) {
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
async function handleNetworth(request, env, origin) {
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

// ══════════════════════════════════════════════════════════════
// 注文表（KV・非公開・PIN 必須）— docs/handoff/2026-10-03-order-sheet.md §4・§5・§6.1（#672）
//
//   GET  /order-sheet          注文表を計算して返す（KV に書かない。約定の自動検知はメモリ上で表示のみ）
//   GET  /order-sheet/plan     KV `order:plan` をそのまま返す（未投入なら null）
//   PUT  /order-sheet/plan     `order:plan` を丸ごと置換（validatePlan＋楽観ロック）
//   POST /order-sheet/events   状態の変更（applyEvent＋楽観ロック）→ 新しい注文表を返す
//
// - 全ルート GET も PIN 必須（/networth と同じ理由: Origin を付けない curl をオリジン判定で弾けない）。
// - 応答はすべて Cache-Control: no-store。GitHub へのミラーはしない。
// - console にはシンボルと type 以外（価格・株数・金額・目標額）を出さない（wrangler tail で見えるため）。
//   KV の JSON.parse 失敗のメッセージは入力の断片を含みうるので、例外は name だけ出す。
// ══════════════════════════════════════════════════════════════

const ORDER_PLAN_KEY = 'order:plan';
const ORDER_LOG_KEY = 'order:log';
const ORDER_STRATEGY_URL = 'https://raw.githubusercontent.com/shoulang0729/portfolio/main/data/target-allocation.json';
const ORDER_PRICE_MAX_AGE_MS = 7 * 60 * 60 * 1000; // prices:cache は 7h 以内のみ採用（§6.1）
const ORDER_BODY_MAX_BYTES = 256 * 1024; // PUT /order-sheet/plan・POST /order-sheet/events の body 上限（超過は 413・#686）

/** 注文表ルートの応答に Cache-Control: no-store を付ける（既存の jsonRes/errRes は変えない） */
function _noStore(res) {
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

function _osJson(data, status, origin) {
  return _noStore(jsonRes(data, status, origin));
}

function _osErr(msg, status, origin, extra) {
  return _noStore(jsonRes({ error: msg, ...(extra || {}) }, status, origin));
}

/** KV の JSON を読む（無ければ null）。壊れた JSON は例外にする（呼び出し側で 500） */
async function _kvJson(env, key) {
  const raw = await env.KV.get(key);
  return raw ? JSON.parse(raw) : null;
}

/**
 * 注文表ルートの JSON body を読む（ORDER_BODY_MAX_BYTES 超は tooLarge・#686）。
 * Content-Length が上限超なら本文を読まずに tooLarge。無い・偽りの場合も読んだ後のバイト数で判定する。
 * @returns {Promise<{ok: boolean, body: any, tooLarge?: boolean}>}
 */
async function _readJsonBody(request) {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > ORDER_BODY_MAX_BYTES) return { ok: false, body: null, tooLarge: true };
  let text;
  try {
    text = await request.text();
  } catch {
    return { ok: false, body: null };
  }
  if (new TextEncoder().encode(text).length > ORDER_BODY_MAX_BYTES) return { ok: false, body: null, tooLarge: true };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, body: null };
  }
}

/** order:plan・order:log を書く。失敗は false（呼び出し側が 500。例外の内容は console に出さない） */
async function _putOrderKv(env, entries, tag) {
  try {
    for (const [key, val] of entries) await env.KV.put(key, JSON.stringify(val));
    return true;
  } catch (e) {
    console.warn(tag, 'KV 書き込み失敗', e?.name);
    return false;
  }
}

/** 公開の戦略設定（data/target-allocation.json）。失敗時は null（計算側が既定値＋warnings） */
async function _fetchOrderStrategy() {
  try {
    const res = await fetch(ORDER_STRATEGY_URL, { cf: { cacheTtl: 300 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/**
 * USDJPY: KV `forex:USDJPY`（handleForex と同じキー）→ Yahoo（cf.cacheTtl: 300・KV に書かない）。
 * 取れなければ null（計算側が warnings を出す）。
 */
async function _resolveOrderFx(env) {
  try {
    const cached = await _kvJson(env, 'forex:USDJPY');
    if (cached && typeof cached.rate === 'number' && cached.rate > 0) {
      return { usdJpy: cached.rate, asOf: cached.ts ? new Date(cached.ts).toISOString() : null };
    }
  } catch {
    /* 次の手段へ */
  }
  try {
    const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/USDJPY%3DX', { cf: { cacheTtl: 300 } });
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? data?.chart?.result?.[0]?.regularMarketPrice;
    if (typeof rate === 'number' && rate > 0) return { usdJpy: rate, asOf: new Date().toISOString() };
  } catch {
    /* 取れなければ null */
  }
  return null;
}

/**
 * 現在値（USD）: prices:cache（7h 以内）→ Finnhub /quote（cf.cacheTtl: 300・KV に書かない）。
 * どちらも無い銘柄は入れない（計算側が mf の price÷USDJPY で概算し warnings を出す）。
 * @param {object} env
 * @param {string[]} symbols plan の USD 建てシンボル＋資金繰りの銘柄
 * @param {number} nowMs
 */
async function _resolveOrderPrices(env, symbols, nowMs) {
  /** @type {Record<string, number>} */
  const out = {};
  let cache = {};
  try {
    cache = (await _kvJson(env, 'prices:cache')) || {};
  } catch {
    cache = {};
  }
  const missing = [];
  for (const sym of symbols) {
    const c = Object.prototype.hasOwnProperty.call(cache, sym) ? cache[sym] : null;
    if (
      c &&
      typeof c.price === 'number' &&
      c.price > 0 &&
      typeof c.ts === 'number' &&
      nowMs - c.ts <= ORDER_PRICE_MAX_AGE_MS
    ) {
      out[sym] = c.price;
    } else {
      missing.push(sym);
    }
  }
  if (missing.length && env.FINNHUB_API_KEY) {
    await Promise.all(
      missing.map(async (sym) => {
        try {
          const res = await fetch(
            `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(_workerToFinnhubSymbol(sym))}&token=${env.FINNHUB_API_KEY}`,
            { cf: { cacheTtl: 300 } }
          );
          if (!res.ok) return;
          const d = await res.json();
          if (typeof d?.c === 'number' && d.c > 0) out[sym] = d.c;
        } catch {
          /* 個別エラーは無視（計算側が概算にフォールバック） */
        }
      })
    );
  }
  return out;
}

/** tier=theme の銘柄について KV `constituents:<SYM>` の上位 1 銘柄を返す（取得しに行かない・§6.9） */
async function _resolveOrderEtfTop(env, plan) {
  /** @type {Record<string, {ticker: string, weight: number}>} */
  const out = {};
  const themeSyms = Object.entries(plan.symbols || {})
    .filter(([sym, sc]) => isValidSymbolKey(sym) && sc && sc.tier === 'theme')
    .map(([sym]) => sym);
  await Promise.all(
    themeSyms.map(async (sym) => {
      try {
        const c = await env.KV.get(CONSTITUENTS_KV_PREFIX + sym, 'json');
        const list = Array.isArray(c?.holdings) ? c.holdings : [];
        let top = null;
        for (const h of list) {
          if (h && h.ticker && typeof h.weight === 'number' && (!top || h.weight > top.weight)) top = h;
        }
        if (top) out[sym] = { ticker: top.ticker, weight: top.weight };
      } catch {
        /* キャッシュが無い・壊れている場合は出さない */
      }
    })
  );
  return out;
}

/**
 * 注文表を組み立てる（GET /order-sheet と POST /order-sheet/events の応答で共用）。KV には書かない。
 * @param {object} env
 * @param {any} plan
 * @param {any} networth
 * @param {any[]|null} log
 */
async function _computeOrderSheet(env, plan, networth, log) {
  if (!plan || typeof plan !== 'object' || !plan.symbols) return null;
  const now = new Date();
  const symbols = Object.keys(plan.symbols).filter((s) => isValidSymbolKey(s) && isUsdSymbol(s));
  const sweep = plan.funding?.sweepSymbol;
  if (typeof sweep === 'string' && isValidSymbolKey(sweep) && isUsdSymbol(sweep) && !symbols.includes(sweep)) {
    symbols.push(sweep);
  }
  const [strategy, fx, prices, etfTop] = await Promise.all([
    _fetchOrderStrategy(),
    _resolveOrderFx(env),
    _resolveOrderPrices(env, symbols, now.getTime()),
    _resolveOrderEtfTop(env, plan),
  ]);
  return buildOrderSheet({
    plan,
    strategy,
    networth,
    prices,
    fx: fx || null,
    etfTop,
    now: now.toISOString(),
    log: Array.isArray(log) ? log : [],
  });
}

async function handleOrderSheet(request, env, origin) {
  if (!env.KV) return _osErr('KV 未設定', 500, origin);
  const authErr = await verifyPinHash(request, env, origin);
  if (authErr) return _noStore(authErr);
  if (request.method !== 'GET') return _osErr('GET のみ許可', 405, origin);

  let plan, networth, log;
  try {
    [plan, networth, log] = await Promise.all([
      _kvJson(env, ORDER_PLAN_KEY),
      _kvJson(env, 'networth'),
      _kvJson(env, ORDER_LOG_KEY),
    ]);
  } catch (e) {
    console.warn('[order-sheet] KV 読み取り失敗', e?.name);
    return _osErr('KV のデータを読めません', 500, origin);
  }
  try {
    const sheet = await _computeOrderSheet(env, plan, networth, log);
    return _osJson(sheet, 200, origin);
  } catch (e) {
    console.warn('[order-sheet] 計算失敗', e?.name);
    return _osErr('注文表の計算に失敗しました', 500, origin);
  }
}

async function handleOrderSheetPlan(request, env, origin) {
  if (!env.KV) return _osErr('KV 未設定', 500, origin);
  const authErr = await verifyPinHash(request, env, origin);
  if (authErr) return _noStore(authErr);

  if (request.method === 'GET') {
    try {
      return _osJson(await _kvJson(env, ORDER_PLAN_KEY), 200, origin);
    } catch (e) {
      console.warn('[order-sheet/plan] KV 読み取り失敗', e?.name);
      return _osErr('KV のデータを読めません', 500, origin);
    }
  }

  if (request.method === 'PUT') {
    const { ok, body: raw, tooLarge } = await _readJsonBody(request);
    if (tooLarge) return _osErr('body が大きすぎます', 413, origin);
    if (!ok) return _osErr('JSON 不正', 400, origin);
    const body = sanitizePlan(raw); // §3.1 に無いキーは保存しない（#686）
    const v = validatePlan(body);
    if (!v.ok) return _osErr('plan が不正です', 400, origin, { errors: v.errors });

    let current, log;
    try {
      [current, log] = await Promise.all([_kvJson(env, ORDER_PLAN_KEY), _kvJson(env, ORDER_LOG_KEY)]);
    } catch (e) {
      console.warn('[order-sheet/plan] KV 読み取り失敗', e?.name);
      return _osErr('KV のデータを読めません', 500, origin);
    }
    const curRev = current && Number.isInteger(current.rev) ? current.rev : 0;
    // KV 未投入時の初回 PUT だけ rev 不要（§5.3）
    if (current && body.rev !== curRev) return _osErr('rev 不一致（他で更新されました）', 409, origin, { rev: curRev });

    const now = new Date().toISOString();
    const next = { ...body, rev: (current ? curRev : Number.isInteger(body.rev) ? body.rev : 0) + 1, updatedAt: now };
    const written = await _putOrderKv(
      env,
      [
        [ORDER_PLAN_KEY, next],
        [ORDER_LOG_KEY, appendLog(log, [{ at: now, type: 'plan-put', rev: next.rev }])],
      ],
      '[order-sheet/plan]'
    );
    if (!written) return _osErr('KV への保存に失敗しました', 500, origin);
    console.warn('[order-sheet/plan] plan-put');
    return _osJson({ ok: true, rev: next.rev, updatedAt: now }, 200, origin);
  }

  return _osErr('GET/PUT のみ許可', 405, origin);
}

async function handleOrderSheetEvents(request, env, origin) {
  if (!env.KV) return _osErr('KV 未設定', 500, origin);
  const authErr = await verifyPinHash(request, env, origin);
  if (authErr) return _noStore(authErr);
  if (request.method !== 'POST') return _osErr('POST のみ許可', 405, origin);

  const { ok, body, tooLarge } = await _readJsonBody(request);
  if (tooLarge) return _osErr('body が大きすぎます', 413, origin);
  if (!ok) return _osErr('JSON 不正', 400, origin);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return _osErr('object が必要です', 400, origin);
  if (!Number.isInteger(body.rev)) return _osErr('rev（整数）が必要です', 400, origin);

  let plan, networth, log;
  try {
    [plan, networth, log] = await Promise.all([
      _kvJson(env, ORDER_PLAN_KEY),
      _kvJson(env, 'networth'),
      _kvJson(env, ORDER_LOG_KEY),
    ]);
  } catch (e) {
    console.warn('[order-sheet/events] KV 読み取り失敗', e?.name);
    return _osErr('KV のデータを読めません', 500, origin);
  }
  if (!plan) return _osErr('plan が未投入です', 400, origin);
  const curRev = Number.isInteger(plan.rev) ? plan.rev : 0;
  if (body.rev !== curRev) return _osErr('rev 不一致（他で更新されました）', 409, origin, { rev: curRev });

  const event = { ...body };
  delete event.rev;
  let result;
  try {
    result = applyEvent(plan, event, { now: new Date().toISOString(), networth });
  } catch (e) {
    if (e instanceof OrderEventError) return _osErr(e.message, 400, origin);
    console.warn('[order-sheet/events] 適用失敗', e?.name);
    return _osErr('イベントの適用に失敗しました', 500, origin);
  }
  const newLog = appendLog(log, [result.log]);
  const written = await _putOrderKv(
    env,
    [
      [ORDER_PLAN_KEY, result.plan],
      [ORDER_LOG_KEY, newLog],
    ],
    '[order-sheet/events]'
  );
  if (!written) return _osErr('KV への保存に失敗しました', 500, origin);
  console.warn('[order-sheet/events]', event.type, typeof event.symbol === 'string' ? event.symbol.slice(0, 12) : '');

  try {
    const sheet = await _computeOrderSheet(env, result.plan, networth, newLog);
    return _osJson(sheet, 200, origin);
  } catch (e) {
    // 書き込みは成功している。注文表の計算だけ失敗した場合は rev を返して再取得を促す
    console.warn('[order-sheet/events] 計算失敗', e?.name);
    return _osErr('保存しましたが注文表の計算に失敗しました', 500, origin, { rev: result.plan.rev });
  }
}

/**
 * Cron: mf の株数による約定を KV に確定する（§5.2）。変化があるときだけ order:plan・order:log を書く。
 * 書く直前に読み直し、rev が変わっていれば今回は書かない（次回に回す・§5.3）。
 * @returns {Promise<{written: boolean, fills: number}>}
 */
// ── per-daily.yml の workflow_dispatch（#708・docs/handoff/2026-10-05-per-daily-dispatch.md §4.2(c)） ──
const PER_DAILY_MAX_ATTEMPTS = 3;
const PER_DAILY_TIMEOUT_MS = 15000;
const PER_DAILY_BACKOFF_MS = [2000, 4000];

/**
 * per-daily.yml を workflow_dispatch で起動する。204 で成功。
 * 429・5xx・ネットワークエラー・タイムアウトは計 3 回まで試す。401/403/404/422 などは再試行しない。
 * 最終的に失敗したら throw（Cloudflare の Cron 履歴に失敗として残す）。ログにはトークンの名前だけ出す。
 */
async function _dispatchPerDaily(env) {
  const token = env.GH_DISPATCH_TOKEN || env.GITHUB_TOKEN;
  const tokenName = env.GH_DISPATCH_TOKEN ? 'GH_DISPATCH_TOKEN' : 'GITHUB_TOKEN';
  if (!token) {
    console.error('[cron per-daily] no token');
    throw new Error('per-daily dispatch: no token');
  }

  let status = 0;
  let msg = '';
  for (let attempt = 1; attempt <= PER_DAILY_MAX_ATTEMPTS; attempt++) {
    let retryable = false;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), PER_DAILY_TIMEOUT_MS);
    try {
      const res = await fetch(PER_DAILY_DISPATCH_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'portfolio-proxy-worker',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'main' }),
        signal: ac.signal,
      });
      status = res.status;
      if (status === 204) {
        console.log(`[cron per-daily] dispatched 204 token=${tokenName}`);
        return;
      }
      msg = '';
      try {
        const j = await res.json();
        if (j && typeof j.message === 'string') msg = j.message.slice(0, 200);
      } catch {
        /* 本文が JSON でなければ message なし */
      }
      retryable = status === 429 || status >= 500;
    } catch (e) {
      status = 0;
      msg = e?.name === 'AbortError' ? 'timeout' : String(e?.name || 'network error').slice(0, 200);
      retryable = true;
    } finally {
      clearTimeout(timer);
    }
    if (!retryable || attempt === PER_DAILY_MAX_ATTEMPTS) break;
    console.warn('[cron per-daily] retry', attempt, status);
    await new Promise((r) => setTimeout(r, PER_DAILY_BACKOFF_MS[attempt - 1]));
  }

  console.error('[cron per-daily] dispatch failed', status, `token=${tokenName}`, msg);
  throw new Error(`per-daily dispatch failed: HTTP ${status}`);
}

async function _cronConfirmOrderFills(env) {
  if (!env.KV) return { written: false, fills: 0 };
  const [plan, networth] = await Promise.all([_kvJson(env, ORDER_PLAN_KEY), _kvJson(env, 'networth')]);
  if (!plan || !networth) return { written: false, fills: 0 };
  const now = new Date().toISOString();
  const { plan: detected, logs } = detectFills(plan, networth, now);
  if (!logs.length) return { written: false, fills: 0 };

  const latest = await _kvJson(env, ORDER_PLAN_KEY);
  const baseRev = Number.isInteger(plan.rev) ? plan.rev : 0;
  if (!latest || (Number.isInteger(latest.rev) ? latest.rev : 0) !== baseRev) {
    console.warn('[cron order-fills] rev が変わったため次回に回す');
    return { written: false, fills: 0 };
  }
  const next = { ...detected, rev: baseRev + 1, updatedAt: now };
  const v = validatePlan(next);
  if (!v.ok) {
    console.warn('[cron order-fills] 適用後の plan が不正のため書かない');
    return { written: false, fills: 0 };
  }
  const log = await _kvJson(env, ORDER_LOG_KEY);
  await env.KV.put(ORDER_PLAN_KEY, JSON.stringify(next));
  await env.KV.put(ORDER_LOG_KEY, JSON.stringify(appendLog(log, logs)));
  for (const l of logs) console.warn('[cron order-fills]', l.partial ? 'partial' : 'filled', l.symbol);
  return { written: true, fills: logs.length };
}

// ── PIN ハッシュ更新 ──────────────────────────────────────────
async function handleAuthPinHash(request, env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);

  if (request.method === 'GET') {
    const storedHash = await env.KV.get('auth:pin-hash');
    return jsonRes({ ok: true, configured: !!storedHash }, 200, origin);
  }

  if (request.method !== 'PUT') return errRes('GET/PUT のみ許可', 405, origin);

  let body;
  try {
    body = await request.json();
  } catch {
    return errRes('JSON 不正', 400, origin);
  }
  const { oldHash, newHash } = body;
  if (!newHash) return errRes('newHash が必要です', 400, origin);

  const storedHash = await env.KV.get('auth:pin-hash');
  if (storedHash && !oldHash) {
    if (newHash === storedHash) return jsonRes({ ok: true, mode: 'verified' }, 200, origin);
    return errRes('既存のPINと一致しません', 401, origin);
  }
  if (storedHash && oldHash !== storedHash) return errRes('現在のPIN認証失敗', 401, origin);
  if (!storedHash && oldHash) return errRes('初回PIN設定では oldHash は不要です', 400, origin);

  await env.KV.put('auth:pin-hash', newHash);
  return jsonRes({ ok: true, mode: storedHash ? 'updated' : 'created' }, 200, origin);
}

// ── ETF 構成銘柄（look-through・KV キャッシュ）─────────────────
// GET /etf/constituents?symbol=<sym>
// 1. KV `constituents:<symbol>` を返す / 2. 無ければアダプタ取得 → 正規化 → KV 保存
async function handleEtfConstituents(url, env, origin, ctx) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);
  const symbol = (url.searchParams.get('symbol') || '').trim();
  if (!symbol) return errRes('symbol が必要です', 400, origin);

  // 1. KV キャッシュ
  const cached = await env.KV.get(CONSTITUENTS_KV_PREFIX + symbol, 'json');
  if (cached) return jsonRes(cached, 200, origin);

  // 2. 取得アダプタ（B2 公式CSV / B3 Yahoo）— 失敗は 404 として扱う
  let raw = null;
  try {
    raw = await fetchEtfConstituents(symbol, env);
  } catch (e) {
    console.warn('[etf/constituents]', symbol, e);
  }
  if (!raw || !Array.isArray(raw.holdings) || raw.holdings.length === 0) {
    return errRes('構成銘柄が見つかりません', 404, origin);
  }

  // 3. 正規化して KV に保存（書き込みはレスポンスをブロックしない）
  const normalized = buildConstituentsResponse(raw);
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(
      env.KV.put(CONSTITUENTS_KV_PREFIX + symbol, JSON.stringify(normalized), { expirationTtl: CONSTITUENTS_TTL })
    );
  }
  return jsonRes(normalized, 200, origin);
}

// ── 価格キャッシュ（Cron が書き込み、フロントが読む）──────────
async function handlePricesCache(env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);
  const val = await env.KV.get('prices:cache');
  return jsonRes(val ? JSON.parse(val) : {}, 200, origin);
}

// ── パスキー認証 ──────────────────────────────────────

// チャレンジ生成（60秒TTL）
async function handleAuthChallenge(env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);
  const challenge = crypto.getRandomValues(new Uint8Array(16));
  const b64 = btoa(String.fromCharCode(...challenge));
  await env.KV.put('auth:challenge', b64, { expirationTtl: 60 });
  return jsonRes({ challenge: b64 }, 200, origin);
}

// 登録（公開鍵を KV に保存）
// セキュリティ: 未認証者がパスキーを登録できないよう PIN 認証を必須にする（#239）
async function handleAuthRegister(request, env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);
  const authErr = await verifyPinHash(request, env, origin);
  if (authErr) return authErr;
  let body;
  try {
    body = await request.json();
  } catch {
    return errRes('JSON 不正', 400, origin);
  }
  const { id, publicKey, clientDataJSON } = body;
  if (!id || !publicKey) return errRes('id / publicKey が必要です', 400, origin);

  await env.KV.put('auth:credential', JSON.stringify({ id, publicKey, clientDataJSON }));
  return jsonRes({ ok: true }, 200, origin);
}

// 検証（challenge の一致確認）
async function handleAuthVerify(request, env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);
  let body;
  try {
    body = await request.json();
  } catch {
    return errRes('JSON 不正', 400, origin);
  }

  const stored = await env.KV.get('auth:credential', 'json');
  if (!stored) return errRes('パスキー未登録', 401, origin);

  const challenge = await env.KV.get('auth:challenge');
  if (!challenge) return errRes('チャレンジが期限切れです', 401, origin);

  // clientDataJSON 内の challenge と保存済みチャレンジを照合
  try {
    const clientData = JSON.parse(atob(body.clientDataJSON));
    // base64url → base64 変換して比較
    const expectedB64url = challenge.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    if (clientData.challenge !== expectedB64url) {
      return errRes('チャレンジが一致しません', 401, origin);
    }
  } catch {
    return errRes('clientDataJSON の解析失敗', 400, origin);
  }

  // チャレンジを消費（リプレイ攻撃防止）
  await env.KV.delete('auth:challenge');
  return jsonRes({ ok: true }, 200, origin);
}

// ── メインハンドラー ──────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowed = isAllowedOrigin(origin, env);

    // CORS プリフライト
    if (request.method === 'OPTIONS') {
      if (!allowed) return new Response('Forbidden', { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Origin チェック（ブラウザからのリクエストのみ）
    if (origin && !allowed) return new Response('Forbidden', { status: 403 });
    const org = allowed ? origin : '*';

    const path = url.pathname;
    if (path === '/') return new Response('portfolio-proxy OK', { status: 200 });
    // 無効化済みルート（#714）: レート制限・外部 fetch・KV より前に 410 を返す
    if (DISABLED_PATHS.has(path)) return handleDisabledRoute(org);
    // レート制限: Workers ネイティブ ratelimit binding（#16・KV 不使用・rate-limit.md 参照）。
    // binding 未設定環境（テスト等）では素通し。判定失敗時も fail-open。
    if (
      path === '/yahoo' ||
      path === '/finnhub' ||
      path === '/fmp' ||
      path === '/edgar' ||
      path === '/edinet-db' ||
      path === '/etf/constituents' ||
      path === '/forex' ||
      path === '/order-sheet' ||
      path.startsWith('/order-sheet/')
    ) {
      if (env.RATE_LIMITER) {
        try {
          const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
          const { success } = await env.RATE_LIMITER.limit({ key: ip });
          if (!success) return errRes('Too Many Requests', 429, org);
        } catch {
          /* fail-open */
        }
      }
    }
    if (path === '/yahoo') return handleYahoo(url, env, org);
    if (path === '/finnhub') return handleFinnhub(url, env, org);
    if (path === '/fmp') return handleFmp(url, env, org);
    if (path === '/edgar') return handleEdgar(url, env, org);
    if (path === '/edinet-db') return handleEdinetDb(url, env, org);
    if (path === '/forex') return handleForex(url, env, org);
    if (path === '/etf/constituents') return handleEtfConstituents(url, env, org, ctx);
    if (path === '/watchlist') return handleWatchlist(request, env, org);
    if (path === '/positions') return handlePositions(request, env, org);
    if (path === '/networth') return handleNetworth(request, env, org);
    if (path === '/order-sheet') return handleOrderSheet(request, env, org);
    if (path === '/order-sheet/plan') return handleOrderSheetPlan(request, env, org);
    if (path === '/order-sheet/events') return handleOrderSheetEvents(request, env, org);
    if (path === '/portfolio/snapshot') return handlePortfolioSnapshot(org);
    if (path === '/prices/cache') return handlePricesCache(env, org);
    if (path === '/auth/pin-hash') return handleAuthPinHash(request, env, org);
    if (path === '/auth/challenge') return handleAuthChallenge(env, org);
    if (path === '/auth/register') return handleAuthRegister(request, env, org);
    if (path === '/auth/verify') return handleAuthVerify(request, env, org);

    return errRes('Not Found', 404, org);
  },

  // ── Cron: 1日4回（0 1,8,15,22 * * *）全保有銘柄の価格をキャッシュ ───────────
  async scheduled(event, env, _ctx) {
    // per-daily.yml の起動（#708）。この Cron では価格キャッシュ・注文表の約定を動かさない
    if (event?.cron === PER_DAILY_CRON) {
      const t = new Date(event.scheduledTime ?? Date.now());
      const want = isUsEasternDst(t) ? 20 : 21;
      if (t.getUTCHours() !== want) {
        console.log('[cron per-daily] skip (season)', t.getUTCHours());
        return;
      }
      await _dispatchPerDaily(env);
      return;
    }

    // 注文表の約定確定（#672）。価格キャッシュの有無と独立に先に実行し、失敗しても既存処理は続ける
    try {
      await _cronConfirmOrderFills(env);
    } catch (e) {
      console.warn('[cron order-fills]', e?.name);
    }

    if (!env.KV || !env.FINNHUB_API_KEY) return;

    const posVal = await env.KV.get('positions');
    if (!posVal) return;
    const positions = JSON.parse(posVal);
    if (!positions.length) return;

    const cache = {};
    const BATCH = 5;

    for (let i = 0; i < positions.length; i += BATCH) {
      const batch = positions.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (p) => {
          if (!p.ySymbol) return;
          try {
            const fSym = _workerToFinnhubSymbol(p.ySymbol);
            const res = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(fSym)}&token=${env.FINNHUB_API_KEY}`,
              { cf: { cacheTtl: 300 } }
            );
            if (!res.ok) return;
            const d = await res.json();
            if (d?.c && d.c > 0) {
              cache[p.ySymbol] = { price: d.c, dayPct: d.dp ?? null, ts: Date.now() };
            }
          } catch {
            /* 個別エラーは無視して継続 */
          }
        })
      );
      // バッチ間の待機（Finnhub 60リクエスト/分制限）
      if (i + BATCH < positions.length) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    if (Object.keys(cache).length > 0) {
      await env.KV.put('prices:cache', JSON.stringify(cache), { expirationTtl: 25200 }); // 7h TTL
    }
  },
};
