import { verifyPinHash } from './auth.js';
import { CONSTITUENTS_KV_PREFIX } from './etf-constituents.js';
import { jsonRes } from './http.js';
import {
  OrderEventError,
  appendLog,
  applyEvent,
  isUsdSymbol,
  isValidSymbolKey,
  sanitizePlan,
  validatePlan,
} from './order-plan.js';
import { buildOrderSheet } from './order-sheet-calc.js';
import { FINNHUB_BASE, _workerToFinnhubSymbol } from './routes-market.js';

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

export const ORDER_PLAN_KEY = 'order:plan';
export const ORDER_LOG_KEY = 'order:log';
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
export async function _kvJson(env, key) {
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

export async function handleOrderSheet(request, env, origin) {
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

export async function handleOrderSheetPlan(request, env, origin) {
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

export async function handleOrderSheetEvents(request, env, origin) {
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
