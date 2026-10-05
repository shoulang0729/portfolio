// Worker の振る舞いを固定する契約テスト（段階5 PR5b・#724）
// 設計: docs/handoff/2026-10-05-refactor-before-migration.md §7.2（分割 §7.3 の前に入れる）
//
// - worker/src/index.js の default export（fetch・scheduled）だけを通して検査する。
//   内部関数は import しない（§7.3 の分割後もこのファイルを変えずに green であること）。
// - すべて合成値・架空ティッカー（AAA / BBB.T）。PIN ハッシュ・API キー・トークンも架空の文字列。実値を書かない。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import worker from '../worker/src/index.js';

const PIN = 'test-pin-hash-synthetic';
const WRONG_PIN = 'wrong-pin-hash-synthetic';
const BASE = 'https://worker.example';
const ORIGIN = 'https://shoulang0729.github.io'; // ALLOWED_ORIGIN 未設定時の既定
const BAD_ORIGIN = 'https://evil.example';
const DISPATCH_URL = 'https://api.github.com/repos/shoulang0729/portfolio/actions/workflows/per-daily.yml/dispatches';
const PRICE_CRON = '0 1,8,15,22 * * *';
const PER_DAILY_CRON = '20 20,21 * * *';

const CORS = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Pin-Hash',
  'Access-Control-Max-Age': '86400',
};

const DISABLED_PATHS = [
  '/portfolio/snapshot',
  '/ai/gemini',
  '/ai/grok',
  '/ai/deepseek',
  '/ai/claude',
  '/ai/models',
  '/ai/context',
  '/notion/save',
  '/ai/openai',
];

const RATE_LIMITED_PATHS = [
  '/yahoo',
  '/finnhub',
  '/fmp',
  '/edgar',
  '/edinet-db',
  '/etf/constituents',
  '/forex',
  '/order-sheet',
  '/order-sheet/plan',
  '/order-sheet/events',
];

const NOT_RATE_LIMITED_PATHS = [
  '/watchlist',
  '/positions',
  '/networth',
  '/prices/cache',
  '/auth/pin-hash',
  '/auth/challenge',
  '/auth/register',
  '/auth/verify',
  '/nope',
];

const ALL_PATHS = ['/', ...RATE_LIMITED_PATHS, ...NOT_RATE_LIMITED_PATHS, ...DISABLED_PATHS];

// ── 合成データ ────────────────────────────────────────

function syntheticPosition(over = {}) {
  return {
    symbol: 'AAA',
    name: 'AAA Corp',
    cat: '米国株・ETF',
    shares: 10,
    price: 100,
    avgCost: 90,
    value: 1000,
    pnl: 100,
    pnlPct: 11.1,
    cur: 'USD',
    ySymbol: 'AAA',
    ...over,
  };
}

function syntheticWatchItem() {
  return { symbol: 'AAA', name: 'AAA Corp', exchange: 'NASDAQ', type: 'stock', cur: 'USD' };
}

function syntheticPlan(over = {}) {
  return {
    schemaVersion: 1,
    rev: 3,
    updatedAt: '2026-01-01T00:00:00Z',
    funding: { sweepSymbol: 'CSH', useUsdCash: false, usdCashRows: [] },
    symbols: {
      AAA: {
        tier: 'thick',
        targetUsd: 1000,
        lot: 1,
        basePrice: 100,
        baseAt: '2026-01-01T00:00:00Z',
        baseEvent: 'manual',
        note: '',
        stages: [
          {
            id: 's1',
            side: 'buy',
            amountUsd: 500,
            dropPct: 8,
            limit: null,
            qty: null,
            state: 'working',
            placedAt: null,
            orderedQty: null,
            orderedLimit: null,
            qtyAtPlace: null,
            filledQty: 0,
            filledAt: null,
            fillSource: null,
          },
        ],
      },
    },
    ...over,
  };
}

function syntheticNetworth() {
  return { asOf: '2026-01-05', totals: { imported: 1000 }, holdings: [] };
}

// ── モック ────────────────────────────────────────────

function makeKv(init = {}) {
  const store = new Map(Object.entries(init).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  return {
    store,
    get: vi.fn(async (key, type) => {
      const v = store.has(key) ? store.get(key) : null;
      if (v == null) return null;
      return type === 'json' ? JSON.parse(v) : v;
    }),
    put: vi.fn(async (key, val) => {
      store.set(key, val);
    }),
    delete: vi.fn(async (key) => {
      store.delete(key);
    }),
  };
}

const DEFAULT_KV = () => ({
  'auth:pin-hash': PIN,
  watchlist: [syntheticWatchItem()],
  positions: [syntheticPosition()],
  networth: syntheticNetworth(),
});

/**
 * @param {{kv?: object|null, kvExtra?: object, env?: object}} [opts]
 *   kv: KV の初期値を丸ごと置き換える（null なら KV binding 無し）。kvExtra: 既定の KV に足す。
 */
function makeEnv({ kv, kvExtra = {}, env = {} } = {}) {
  const base = {
    FINNHUB_API_KEY: 'synthetic-finnhub-key',
    FMP_API_KEY: 'synthetic-fmp-key',
    EDINET_DB_API_KEY: 'synthetic-edinet-key',
    RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
  };
  if (kv !== null) base.KV = makeKv(kv === undefined ? { ...DEFAULT_KV(), ...kvExtra } : kv);
  return { ...base, ...env };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** 外部 API の代役。URL で応答を分ける（Set-Cookie は返さない＝Yahoo の crumb は取れない扱い）。 */
function fakeUpstream(url) {
  const u = String(url);
  if (u.includes('/v8/finance/chart/')) return json({ chart: { result: [{ regularMarketPrice: 150 }] } });
  if (u.startsWith('https://finnhub.io/api/v1/quote')) return json({ c: 123.4, dp: 1.5 });
  if (u === DISPATCH_URL) return new Response(null, { status: 204 });
  return json({ ok: true });
}

/**
 * @param {string} path
 * @param {{method?: string, origin?: string|null, pin?: 'ok'|'bad'|null, body?: any}} [opts]
 */
function req(path, { method = 'GET', origin = ORIGIN, pin = null, body } = {}) {
  const headers = { 'CF-Connecting-IP': '203.0.113.1' };
  if (origin) headers.Origin = origin;
  if (pin === 'ok') headers['X-Pin-Hash'] = PIN;
  if (pin === 'bad') headers['X-Pin-Hash'] = WRONG_PIN;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function call(request, env) {
  return worker.fetch(request, env, { waitUntil() {} });
}

function expectCors(res, origin = ORIGIN) {
  for (const [k, v] of Object.entries({ ...CORS, 'Access-Control-Allow-Origin': origin })) {
    expect(res.headers.get(k), k).toBe(v);
  }
}

function expectNoCors(res) {
  expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
}

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn(async (url) => fakeUpstream(url));
  vi.stubGlobal('fetch', fetchMock);
  for (const k of ['log', 'warn', 'error']) vi.spyOn(console, k).mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ══════════════════════════════════════════════════════════════
// fetch: ルート × メソッドの表（許可 Origin）
//   [method, path, opts, status]
//   opts: pin（'ok'|'bad'|null）・body・kv・kvExtra・env・cors（false なら CORS ヘッダ無し）
// ══════════════════════════════════════════════════════════════

const VALID_YAHOO = '/yahoo?url=' + encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/AAA');
const B64_CHALLENGE = 'AAAAAAAAAAAAAAAAAAAAAA==';
const B64URL_CHALLENGE = 'AAAAAAAAAAAAAAAAAAAAAA';
const PASSKEY_KV = { 'auth:credential': { id: 'cred-synthetic', publicKey: 'pk-synthetic' } };

const ROUTE_CASES = [
  // ルート
  ['GET', '/', { cors: false }, 200],
  ['PUT', '/', { cors: false }, 200],
  ['POST', '/', { cors: false }, 200],
  ['DELETE', '/', { cors: false }, 200],

  // 市場データ中継（メソッドを見ない）
  ['GET', VALID_YAHOO, {}, 200],
  ['POST', VALID_YAHOO, {}, 200],
  ['GET', '/yahoo', {}, 400],
  ['GET', '/yahoo?url=' + encodeURIComponent('https://evil.example/x'), {}, 400],
  ['GET', '/yahoo?url=' + encodeURIComponent('http://query1.finance.yahoo.com/x'), {}, 400],
  ['GET', '/finnhub?path=/quote&symbol=AAA', {}, 200],
  ['PUT', '/finnhub?path=/quote&symbol=AAA', {}, 200],
  ['GET', '/finnhub?path=/../x', {}, 400],
  ['GET', '/finnhub?path=/quote', { env: { FINNHUB_API_KEY: undefined } }, 500],
  ['GET', '/fmp?path=/api/v3/profile/AAA', {}, 200],
  ['POST', '/fmp?path=/stable/ratios', {}, 200],
  ['GET', '/fmp?path=/api/v2/quote', {}, 400],
  ['GET', '/fmp?path=/api/v3/profile/AAA', { env: { FMP_API_KEY: undefined } }, 500],
  ['GET', '/edgar?path=/api/xbrl/companyfacts/CIK0000000001.json', {}, 200],
  ['DELETE', '/edgar?path=/api/xbrl/companyfacts/CIK0000000001.json', {}, 200],
  ['GET', '/edgar?path=/files/company_tickers.json', {}, 400],
  ['GET', '/edinet-db?path=/v1/companies/E00001', {}, 200],
  ['GET', '/edinet-db?path=/v2/companies', {}, 400],
  ['GET', '/edinet-db?path=/v1/companies/E00001', { env: { EDINET_DB_API_KEY: undefined } }, 500],
  ['GET', '/forex?from=USD&to=JPY', {}, 200],
  ['POST', '/forex?from=USD&to=JPY', {}, 200],
  ['GET', '/forex?from=USD', {}, 400],
  ['GET', '/etf/constituents?symbol=AAA', {}, 404],
  ['GET', '/etf/constituents?symbol=AAA', { kvExtra: { 'constituents:AAA': { holdings: [] } } }, 200],
  ['GET', '/etf/constituents', {}, 400],
  ['GET', '/etf/constituents?symbol=AAA', { kv: null }, 500],
  ['GET', '/prices/cache', {}, 200],
  ['POST', '/prices/cache', {}, 200],
  ['GET', '/prices/cache', { kv: null }, 500],

  // /watchlist（GET 公開・PUT 認証なし）
  ['GET', '/watchlist', {}, 200],
  ['PUT', '/watchlist', { body: [syntheticWatchItem()] }, 200],
  ['PUT', '/watchlist', { body: { not: 'array' } }, 400],
  ['PUT', '/watchlist', { body: [{ symbol: 'AAA' }] }, 400],
  ['PUT', '/watchlist', { body: 'not json' }, 400],
  ['POST', '/watchlist', { body: [] }, 405],
  ['DELETE', '/watchlist', {}, 405],
  ['GET', '/watchlist', { kv: null }, 500],

  // /positions（GET/PUT とも PIN 必須）
  ['GET', '/positions', { pin: null }, 401],
  ['GET', '/positions', { pin: 'bad' }, 401],
  ['GET', '/positions', { pin: 'ok' }, 200],
  ['GET', '/positions', { pin: 'ok', kv: {} }, 428],
  ['PUT', '/positions', { pin: null, body: [syntheticPosition()] }, 401],
  ['PUT', '/positions', { pin: 'bad', body: [syntheticPosition()] }, 401],
  ['PUT', '/positions', { pin: 'ok', body: [syntheticPosition()] }, 200],
  ['PUT', '/positions', { pin: 'ok', body: [syntheticPosition({ shares: 'x' })] }, 400],
  ['POST', '/positions', { pin: null }, 405],
  ['DELETE', '/positions', { pin: 'ok' }, 405],
  ['GET', '/positions', { pin: 'ok', kv: null }, 500],

  // /networth（GET/PUT とも PIN 必須）
  ['GET', '/networth', { pin: null }, 401],
  ['GET', '/networth', { pin: 'bad' }, 401],
  ['GET', '/networth', { pin: 'ok' }, 200],
  ['PUT', '/networth', { pin: null, body: syntheticNetworth() }, 401],
  ['PUT', '/networth', { pin: 'bad', body: syntheticNetworth() }, 401],
  ['PUT', '/networth', { pin: 'ok', body: syntheticNetworth() }, 200],
  ['PUT', '/networth', { pin: 'ok', body: [] }, 400],
  ['POST', '/networth', { pin: 'ok' }, 405],

  // 注文表（全メソッド PIN が先・Cache-Control: no-store）
  ['GET', '/order-sheet', { pin: null }, 401],
  ['GET', '/order-sheet', { pin: 'bad' }, 401],
  ['GET', '/order-sheet', { pin: 'ok' }, 200],
  ['POST', '/order-sheet', { pin: null }, 401],
  ['POST', '/order-sheet', { pin: 'ok' }, 405],
  ['PUT', '/order-sheet', { pin: 'ok' }, 405],
  ['GET', '/order-sheet/plan', { pin: null }, 401],
  ['GET', '/order-sheet/plan', { pin: 'bad' }, 401],
  ['GET', '/order-sheet/plan', { pin: 'ok' }, 200],
  ['PUT', '/order-sheet/plan', { pin: null, body: syntheticPlan() }, 401],
  ['PUT', '/order-sheet/plan', { pin: 'bad', body: syntheticPlan() }, 401],
  ['PUT', '/order-sheet/plan', { pin: 'ok', body: syntheticPlan() }, 200],
  [
    'PUT',
    '/order-sheet/plan',
    { pin: 'ok', body: syntheticPlan({ rev: 1 }), kvExtra: { 'order:plan': syntheticPlan() } },
    409,
  ],
  ['PUT', '/order-sheet/plan', { pin: 'ok', body: 'not json' }, 400],
  ['POST', '/order-sheet/plan', { pin: 'ok' }, 405],
  ['POST', '/order-sheet/events', { pin: null, body: { rev: 3 } }, 401],
  ['POST', '/order-sheet/events', { pin: 'bad', body: { rev: 3 } }, 401],
  ['POST', '/order-sheet/events', { pin: 'ok', body: { rev: 3 } }, 400],
  ['POST', '/order-sheet/events', { pin: 'ok', body: { rev: 1 }, kvExtra: { 'order:plan': syntheticPlan() } }, 409],
  ['POST', '/order-sheet/events', { pin: 'ok', body: {} }, 400],
  ['GET', '/order-sheet/events', { pin: 'ok' }, 405],
  ['PUT', '/order-sheet/events', { pin: 'ok' }, 405],
  ['GET', '/order-sheet', { pin: 'ok', kv: null }, 500],

  // 認証
  ['GET', '/auth/pin-hash', {}, 200],
  ['GET', '/auth/pin-hash', { kv: {} }, 200],
  ['PUT', '/auth/pin-hash', { body: { newHash: PIN } }, 200],
  ['PUT', '/auth/pin-hash', { body: { newHash: WRONG_PIN } }, 401],
  ['PUT', '/auth/pin-hash', { body: { oldHash: WRONG_PIN, newHash: 'next-synthetic' } }, 401],
  ['PUT', '/auth/pin-hash', { body: { oldHash: PIN, newHash: 'next-synthetic' } }, 200],
  ['PUT', '/auth/pin-hash', { kv: {}, body: { newHash: 'first-synthetic' } }, 200],
  ['PUT', '/auth/pin-hash', { kv: {}, body: { oldHash: 'x', newHash: 'first-synthetic' } }, 400],
  ['PUT', '/auth/pin-hash', { body: {} }, 400],
  ['POST', '/auth/pin-hash', { body: { newHash: PIN } }, 405],
  ['GET', '/auth/challenge', {}, 200],
  ['POST', '/auth/challenge', {}, 200],
  ['POST', '/auth/register', { pin: null, body: { id: 'cred-synthetic', publicKey: 'pk-synthetic' } }, 401],
  ['POST', '/auth/register', { pin: 'bad', body: { id: 'cred-synthetic', publicKey: 'pk-synthetic' } }, 401],
  ['POST', '/auth/register', { pin: 'ok', body: { id: 'cred-synthetic', publicKey: 'pk-synthetic' } }, 200],
  ['POST', '/auth/register', { pin: 'ok', body: { id: 'cred-synthetic' } }, 400],
  ['POST', '/auth/register', { pin: 'ok', kv: {}, body: { id: 'cred-synthetic', publicKey: 'pk-synthetic' } }, 428],
  ['POST', '/auth/verify', { body: { clientDataJSON: btoa('{}') } }, 401],
  [
    'POST',
    '/auth/verify',
    {
      kvExtra: { ...PASSKEY_KV, 'auth:challenge': B64_CHALLENGE },
      body: { clientDataJSON: btoa(JSON.stringify({ challenge: B64URL_CHALLENGE })) },
    },
    200,
  ],
  [
    'POST',
    '/auth/verify',
    {
      kvExtra: { ...PASSKEY_KV, 'auth:challenge': B64_CHALLENGE },
      body: { clientDataJSON: btoa(JSON.stringify({ challenge: 'other' })) },
    },
    401,
  ],
  ['POST', '/auth/verify', { kvExtra: PASSKEY_KV, body: { clientDataJSON: btoa('{}') } }, 401],
  ['GET', '/auth/verify', {}, 400],

  // 404
  ['GET', '/nope', {}, 404],
  ['POST', '/nope', {}, 404],
  ['PUT', '/order-sheet/unknown', { pin: 'ok' }, 404],
  ['DELETE', '/positions/x', {}, 404],

  // 410（どのメソッドでも）
  ...DISABLED_PATHS.flatMap((p) => ['GET', 'PUT', 'POST', 'DELETE'].map((m) => [m, p, {}, 410])),
];

describe('fetch: ルート × メソッド（許可 Origin）', () => {
  it.each(ROUTE_CASES)('%s %s %j → %i', async (method, path, opts, status) => {
    const env = makeEnv(opts);
    const res = await call(req(path, { method, pin: opts.pin ?? null, body: opts.body }), env);
    expect(res.status).toBe(status);
    if (opts.cors === false) expectNoCors(res);
    else expectCors(res);
    if (path.startsWith('/order-sheet') && status !== 404) {
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    }
    // PIN なし・誤りで弾かれた場合は KV に書かない
    if (status === 401 && env.KV) expect(env.KV.put).not.toHaveBeenCalled();
    // 410 は外部 fetch・KV・レート制限に触れない
    if (status === 410) {
      expect(fetchMock).not.toHaveBeenCalled();
      expect(env.KV.get).not.toHaveBeenCalled();
      expect(env.KV.put).not.toHaveBeenCalled();
      expect(env.RATE_LIMITER.limit).not.toHaveBeenCalled();
    }
  });
});

describe('fetch: 応答の中身（主要ルート）', () => {
  it('GET / は本文 portfolio-proxy OK', async () => {
    const res = await call(req('/'), makeEnv());
    expect(await res.text()).toBe('portfolio-proxy OK');
  });

  it('GET /watchlist は KV の配列・KV が空なら []', async () => {
    expect(await (await call(req('/watchlist'), makeEnv())).json()).toEqual([syntheticWatchItem()]);
    expect(await (await call(req('/watchlist'), makeEnv({ kv: {} }))).json()).toEqual([]);
  });

  it('PUT /watchlist は KV watchlist に保存し {ok:true}', async () => {
    const env = makeEnv();
    const res = await call(req('/watchlist', { method: 'PUT', body: [syntheticWatchItem()] }), env);
    expect(await res.json()).toEqual({ ok: true });
    expect(env.KV.put).toHaveBeenCalledWith('watchlist', JSON.stringify([syntheticWatchItem()]));
  });

  it('GET /positions（PIN 一致）は KV の配列', async () => {
    const res = await call(req('/positions', { pin: 'ok' }), makeEnv());
    expect(await res.json()).toEqual([syntheticPosition()]);
  });

  it('GET /networth（PIN 一致）は KV の object・空なら null', async () => {
    expect(await (await call(req('/networth', { pin: 'ok' }), makeEnv())).json()).toEqual(syntheticNetworth());
    const empty = makeEnv({ kv: { 'auth:pin-hash': PIN } });
    expect(await (await call(req('/networth', { pin: 'ok' }), empty)).json()).toBeNull();
  });

  it('GET /order-sheet/plan（PIN 一致・未投入）は null', async () => {
    expect(await (await call(req('/order-sheet/plan', { pin: 'ok' }), makeEnv())).json()).toBeNull();
  });

  it('PUT /order-sheet/plan（初回）は rev を進めて order:plan と order:log を書く', async () => {
    const env = makeEnv();
    const res = await call(req('/order-sheet/plan', { method: 'PUT', pin: 'ok', body: syntheticPlan() }), env);
    const out = await res.json();
    expect(out.ok).toBe(true);
    expect(out.rev).toBe(4);
    expect(env.KV.put.mock.calls.map(([k]) => k).sort()).toEqual(['order:log', 'order:plan']);
  });

  it('GET /auth/pin-hash はハッシュ値を返さない（configured のみ）', async () => {
    const res = await call(req('/auth/pin-hash'), makeEnv());
    const body = await res.json();
    expect(body).toEqual({ ok: true, configured: true });
    expect(JSON.stringify(body)).not.toContain(PIN);
    const none = await call(req('/auth/pin-hash'), makeEnv({ kv: {} }));
    expect(await none.json()).toEqual({ ok: true, configured: false });
  });

  it('GET /auth/challenge は KV auth:challenge に TTL 60 で保存', async () => {
    const env = makeEnv();
    const res = await call(req('/auth/challenge'), env);
    const { challenge } = await res.json();
    expect(typeof challenge).toBe('string');
    expect(env.KV.put).toHaveBeenCalledWith('auth:challenge', challenge, { expirationTtl: 60 });
  });

  it('POST /auth/verify の成功で challenge を消す', async () => {
    const env = makeEnv({ kvExtra: { ...PASSKEY_KV, 'auth:challenge': B64_CHALLENGE } });
    const body = { clientDataJSON: btoa(JSON.stringify({ challenge: B64URL_CHALLENGE })) };
    await call(req('/auth/verify', { method: 'POST', body }), env);
    expect(env.KV.delete).toHaveBeenCalledWith('auth:challenge');
  });

  it('GET /forex は KV キャッシュがあれば外部 fetch しない', async () => {
    const cached = { from: 'USD', to: 'JPY', rate: 150, ts: 1 };
    const res = await call(req('/forex?from=USD&to=JPY'), makeEnv({ kvExtra: { 'forex:USDJPY': cached } }));
    expect(await res.json()).toEqual(cached);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GET /finnhub は API キーを token に付けて中継する（応答にキーを含めない）', async () => {
    const res = await call(req('/finnhub?path=/quote&symbol=AAA'), makeEnv());
    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.startsWith('https://finnhub.io/api/v1/quote?') && u.includes('token='))).toBe(true);
    expect(await res.text()).not.toContain('synthetic-finnhub-key');
  });
});

// ══════════════════════════════════════════════════════════════
// fetch: CORS（許可・不許可・Origin なし・OPTIONS）
// ══════════════════════════════════════════════════════════════

describe('fetch: OPTIONS（プリフライト）', () => {
  it.each(ALL_PATHS)('許可 Origin: OPTIONS %s → 204・CORS', async (path) => {
    const env = makeEnv();
    const res = await call(req(path, { method: 'OPTIONS' }), env);
    expect(res.status).toBe(204);
    expectCors(res);
    expect(env.RATE_LIMITER.limit).not.toHaveBeenCalled();
    expect(env.KV.get).not.toHaveBeenCalled();
  });

  it.each(ALL_PATHS)('不許可 Origin: OPTIONS %s → 403・CORS なし', async (path) => {
    const res = await call(req(path, { method: 'OPTIONS', origin: BAD_ORIGIN }), makeEnv());
    expect(res.status).toBe(403);
    expectNoCors(res);
  });

  it('Origin なし: OPTIONS → 403', async () => {
    const res = await call(req('/watchlist', { method: 'OPTIONS', origin: null }), makeEnv());
    expect(res.status).toBe(403);
  });
});

describe('fetch: 不許可 Origin は全ルート・全メソッドで 403（何もしない）', () => {
  const cases = ALL_PATHS.flatMap((p) => ['GET', 'PUT', 'POST', 'DELETE'].map((m) => [m, p]));
  it.each(cases)('%s %s → 403', async (method, path) => {
    const env = makeEnv();
    const res = await call(req(path, { method, origin: BAD_ORIGIN, pin: 'ok' }), env);
    expect(res.status).toBe(403);
    expectNoCors(res);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(env.KV.get).not.toHaveBeenCalled();
    expect(env.KV.put).not.toHaveBeenCalled();
    expect(env.RATE_LIMITER.limit).not.toHaveBeenCalled();
  });
});

describe('fetch: Origin なし（curl・Actions）は ACAO: *', () => {
  it.each([
    ['GET', '/watchlist', null, 200],
    ['GET', '/positions', null, 401],
    ['GET', '/positions', 'ok', 200],
    ['GET', '/order-sheet/plan', 'ok', 200],
    ['GET', '/portfolio/snapshot', null, 410],
    ['GET', '/nope', null, 404],
  ])('%s %s pin=%s → %i', async (method, path, pin, status) => {
    const res = await call(req(path, { method, origin: null, pin }), makeEnv());
    expect(res.status).toBe(status);
    expectCors(res, '*');
  });
});

describe('fetch: 許可 Origin の判定', () => {
  it.each(['http://localhost:8080', 'http://127.0.0.1:5500'])('ローカル開発 %s は許可', async (origin) => {
    const res = await call(req('/watchlist', { origin }), makeEnv());
    expect(res.status).toBe(200);
    expectCors(res, origin);
  });

  it('ALLOWED_ORIGIN を設定するとその Origin だけ許可（既定の Origin は 403）', async () => {
    const env = makeEnv({ env: { ALLOWED_ORIGIN: 'https://app.example' } });
    const ok = await call(req('/watchlist', { origin: 'https://app.example' }), env);
    expect(ok.status).toBe(200);
    expectCors(ok, 'https://app.example');
    const ng = await call(req('/watchlist'), env);
    expect(ng.status).toBe(403);
  });

  it.each(['https://localhost:8080', 'http://localhost.evil.example', 'null'])('%s は不許可', async (origin) => {
    const res = await call(req('/watchlist', { origin }), makeEnv());
    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════
// fetch: レート制限
// ══════════════════════════════════════════════════════════════

describe('fetch: レート制限の対象', () => {
  it.each(RATE_LIMITED_PATHS)('%s: 超過で 429・CORS 付き・外部 fetch しない', async (path) => {
    const limit = vi.fn(async () => ({ success: false }));
    const env = makeEnv({ env: { RATE_LIMITER: { limit } } });
    const res = await call(req(path, { pin: 'ok' }), env);
    expect(res.status).toBe(429);
    expectCors(res);
    expect(limit).toHaveBeenCalledWith({ key: '203.0.113.1' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(NOT_RATE_LIMITED_PATHS)('%s: レート制限を呼ばない', async (path) => {
    const limit = vi.fn(async () => ({ success: false }));
    const env = makeEnv({ env: { RATE_LIMITER: { limit } } });
    const res = await call(req(path, { pin: 'ok' }), env);
    expect(res.status).not.toBe(429);
    expect(limit).not.toHaveBeenCalled();
  });

  it('RATE_LIMITER が例外を投げても素通し（fail-open）', async () => {
    const limit = vi.fn(async () => {
      throw new Error('limiter down');
    });
    const res = await call(req('/finnhub?path=/quote&symbol=AAA'), makeEnv({ env: { RATE_LIMITER: { limit } } }));
    expect(res.status).toBe(200);
  });

  it('RATE_LIMITER 未設定なら素通し', async () => {
    const res = await call(req('/finnhub?path=/quote&symbol=AAA'), makeEnv({ env: { RATE_LIMITER: undefined } }));
    expect(res.status).toBe(200);
  });

  it('CF-Connecting-IP が無ければ key は unknown', async () => {
    const limit = vi.fn(async () => ({ success: true }));
    const request = new Request(BASE + '/forex?from=USD&to=JPY', { headers: { Origin: ORIGIN } });
    await call(request, makeEnv({ env: { RATE_LIMITER: { limit } } }));
    expect(limit).toHaveBeenCalledWith({ key: 'unknown' });
  });
});

// ══════════════════════════════════════════════════════════════
// scheduled: 3 つの Cron
// ══════════════════════════════════════════════════════════════

function cronEnv(over = {}) {
  return makeEnv({
    kv: {
      positions: [
        syntheticPosition({ ySymbol: 'AAA' }),
        syntheticPosition({ symbol: 'BBB', ySymbol: 'BBB.T', cur: 'JPY' }),
      ],
    },
    env: { GITHUB_TOKEN: 'test-token-not-real', ...over },
  });
}

function runCron(event, env) {
  return worker.scheduled(event, env, { waitUntil() {} });
}

function fetchedUrls() {
  return fetchMock.mock.calls.map(([u]) => String(u));
}

/** 価格キャッシュの Cron の処理が走ったこと（Finnhub の quote・prices:cache の保存・注文表の読み取り） */
async function expectPriceCacheRun(env) {
  const urls = fetchedUrls();
  expect(urls.filter((u) => u.startsWith('https://finnhub.io/api/v1/quote?'))).toHaveLength(2);
  expect(urls.some((u) => u.includes('symbol=AAA&'))).toBe(true);
  expect(urls.some((u) => u.includes(`symbol=${encodeURIComponent('TYO:BBB')}&`))).toBe(true);
  expect(urls).not.toContain(DISPATCH_URL);
  expect(env.KV.get).toHaveBeenCalledWith('order:plan');
  const put = env.KV.put.mock.calls.find(([k]) => k === 'prices:cache');
  expect(put).toBeTruthy();
  expect(put[2]).toEqual({ expirationTtl: 25200 });
  const cache = JSON.parse(put[1]);
  expect(Object.keys(cache).sort()).toEqual(['AAA', 'BBB.T']);
  expect(cache.AAA).toMatchObject({ price: 123.4, dayPct: 1.5 });
}

describe(`scheduled: ${PRICE_CRON}（価格キャッシュ＋注文表の約定）`, () => {
  it('保有の価格を Finnhub から取って prices:cache に保存・dispatch しない', async () => {
    const env = cronEnv();
    await runCron({ cron: PRICE_CRON, scheduledTime: Date.parse('2026-07-15T01:00:00Z') }, env);
    await expectPriceCacheRun(env);
  });

  it('FINNHUB_API_KEY が無ければ価格は取らない（注文表の約定は確認する）', async () => {
    const env = cronEnv({ FINNHUB_API_KEY: undefined });
    await runCron({ cron: PRICE_CRON, scheduledTime: Date.parse('2026-07-15T01:00:00Z') }, env);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(env.KV.get).toHaveBeenCalledWith('order:plan');
    expect(env.KV.put).not.toHaveBeenCalled();
  });
});

describe('scheduled: event.cron なし（既定＝価格キャッシュの処理）', () => {
  it('価格キャッシュと同じ処理・dispatch しない', async () => {
    const env = cronEnv();
    await runCron({}, env);
    await expectPriceCacheRun(env);
  });
});

describe(`scheduled: ${PER_DAILY_CRON}（per-daily の workflow_dispatch）`, () => {
  it.each([
    ['夏時間 20:20 UTC', '2026-07-15T20:20:00Z', true],
    ['夏時間 21:20 UTC', '2026-07-15T21:20:00Z', false],
    ['冬時間 21:20 UTC', '2026-12-15T21:20:00Z', true],
    ['冬時間 20:20 UTC', '2026-12-15T20:20:00Z', false],
  ])('%s（scheduledTime）→ dispatch=%s・価格キャッシュと KV に触れない', async (_label, iso, dispatched) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z')); // scheduledTime が優先されること
    const env = cronEnv();
    await runCron({ cron: PER_DAILY_CRON, scheduledTime: Date.parse(iso) }, env);
    expect(fetchedUrls()).toEqual(dispatched ? [DISPATCH_URL] : []);
    if (dispatched) {
      const init = fetchMock.mock.calls[0][1];
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({ ref: 'main' });
      expect(init.headers.Authorization).toBe('Bearer test-token-not-real');
    }
    expect(env.KV.get).not.toHaveBeenCalled();
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it.each([
    ['夏時間', '2026-07-15T20:20:00Z', true],
    ['冬時間', '2026-12-15T20:20:00Z', false],
  ])('scheduledTime なしは現在時刻で判定（%s）', async (_label, iso, dispatched) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
    const env = cronEnv();
    await runCron({ cron: PER_DAILY_CRON }, env);
    expect(fetchedUrls()).toEqual(dispatched ? [DISPATCH_URL] : []);
  });
});
