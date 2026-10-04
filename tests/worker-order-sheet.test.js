// Tests for worker/src/index.js の注文表ルート（注文表 PR3・#672）
// 設計: docs/handoff/2026-10-03-order-sheet.md §4・§5・§6.1
// すべて合成値・架空ティッカー（AAA / BBB / CSH）。PIN ハッシュも架空の文字列。実値を書かない。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import worker from '../worker/src/index.js';

const PIN = 'test-pin-hash-synthetic';
const BASE = 'https://worker.example';
const STRATEGY_URL = 'https://raw.githubusercontent.com/shoulang0729/portfolio/main/data/target-allocation.json';

function stage(over = {}) {
  return {
    id: 's1',
    side: 'buy',
    amountUsd: 30000,
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
    ...over,
  };
}

function makePlan(over = {}) {
  return {
    schemaVersion: 1,
    rev: 3,
    updatedAt: '2026-01-01T00:00:00Z',
    funding: { sweepSymbol: 'CSH', useUsdCash: false, usdCashRows: [] },
    symbols: {
      AAA: {
        tier: 'thick',
        targetUsd: 100000,
        lot: 1,
        basePrice: 400,
        baseAt: '2026-01-01T00:00:00Z',
        baseEvent: 'manual',
        note: '',
        stages: [stage({ id: 's1', dropPct: 8 }), stage({ id: 's2', dropPct: 20, amountUsd: 40000, state: 'waiting' })],
      },
    },
    ...over,
  };
}

/** 発注済み（qtyAtPlace=100・orderedQty=81）の plan */
function placedPlan() {
  const p = makePlan();
  Object.assign(p.symbols.AAA.stages[0], {
    placedAt: '2026-01-05T14:00:00Z',
    orderedQty: 81,
    orderedLimit: 368,
    qtyAtPlace: 100,
  });
  return p;
}

function makeNetworth({ asOf = '2026-01-05', aaaQty = 100 } = {}) {
  return {
    asOf,
    totals: { imported: 150_000_000 },
    holdings: [
      { cat: '米国株・ETF', ySymbol: 'AAA', name: 'AAA Corp', value: 6_000_000, qty: aaaQty, price: 60_000 },
      { cat: '米国株・ETF', ySymbol: 'CSH', name: 'Cash ETF', value: 7_500_000, qty: 1000, price: 7_500 },
      { cat: '現金・預金', name: 'Bank', value: 40_000_000 },
    ],
  };
}

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

function makeEnv(kvInit = {}, extra = {}) {
  const now = Date.now();
  return {
    KV: makeKv({
      'auth:pin-hash': PIN,
      'forex:USDJPY': { from: 'USD', to: 'JPY', rate: 150, ts: now },
      'prices:cache': { AAA: { price: 395, ts: now }, CSH: { price: 50, ts: now } },
      ...kvInit,
    }),
    ...extra,
  };
}

function req(path, { method = 'GET', pin = PIN, body } = {}) {
  const headers = { 'CF-Connecting-IP': '203.0.113.1' };
  if (pin) headers['X-Pin-Hash'] = pin;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

let fetchMock;
let strategyOk;

beforeEach(() => {
  strategyOk = true;
  fetchMock = vi.fn(async (url) => {
    const u = String(url);
    if (u === STRATEGY_URL) {
      if (!strategyOk) return new Response('nope', { status: 500 });
      return new Response(JSON.stringify({ themeCaps: {}, convictionPct: { high: 5 } }), { status: 200 });
    }
    return new Response('unexpected', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ROUTES = [
  ['/order-sheet', 'GET'],
  ['/order-sheet/plan', 'GET'],
  ['/order-sheet/plan', 'PUT'],
  ['/order-sheet/events', 'POST'],
];

describe('注文表ルート: PIN 必須・Cache-Control', () => {
  it.each(ROUTES)('%s %s: X-Pin-Hash なしは 401・KV に書かない', async (path, method) => {
    const env = makeEnv({ 'order:plan': makePlan() });
    const res = await worker.fetch(req(path, { method, pin: null, body: method === 'GET' ? undefined : {} }), env);
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it.each(ROUTES)('%s %s: PIN 不一致は 401', async (path, method) => {
    const env = makeEnv({ 'order:plan': makePlan() });
    const res = await worker.fetch(req(path, { method, pin: 'wrong', body: method === 'GET' ? undefined : {} }), env);
    expect(res.status).toBe(401);
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it.each(ROUTES)('%s %s: 401 のとき認証前に auth:pin-hash 以外の KV.get をしない', async (path, method) => {
    for (const pin of [null, 'wrong']) {
      const env = makeEnv({ 'order:plan': makePlan(), networth: makeNetworth(), 'order:log': [] });
      const res = await worker.fetch(req(path, { method, pin, body: method === 'GET' ? undefined : {} }), env);
      expect(res.status).toBe(401);
      const keys = env.KV.get.mock.calls.map((c) => c[0]);
      expect(keys.every((k) => k === 'auth:pin-hash')).toBe(true);
      expect(keys.length).toBeLessThanOrEqual(1);
    }
  });

  it('PIN 未設定サーバーでは 428（verifyPinHash の既存挙動）', async () => {
    const env = makeEnv();
    env.KV.store.delete('auth:pin-hash');
    const res = await worker.fetch(req('/order-sheet'), env);
    expect(res.status).toBe(428);
  });

  it('許可外メソッドは 405（PIN 付き）', async () => {
    const env = makeEnv({ 'order:plan': makePlan() });
    expect((await worker.fetch(req('/order-sheet', { method: 'PUT', body: {} }), env)).status).toBe(405);
    expect((await worker.fetch(req('/order-sheet/plan', { method: 'POST', body: {} }), env)).status).toBe(405);
    expect((await worker.fetch(req('/order-sheet/events'), env)).status).toBe(405);
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it('未知の /order-sheet/* は 404', async () => {
    const res = await worker.fetch(req('/order-sheet/unknown'), makeEnv());
    expect(res.status).toBe(404);
  });
});

describe('レート制限', () => {
  it('/order-sheet と /order-sheet/* は RATE_LIMITER の対象（超過で 429）', async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const env = makeEnv({}, { RATE_LIMITER: { limit } });
    expect((await worker.fetch(req('/order-sheet'), env)).status).toBe(429);
    expect((await worker.fetch(req('/order-sheet/plan'), env)).status).toBe(429);
    expect((await worker.fetch(req('/order-sheet/events', { method: 'POST', body: {} }), env)).status).toBe(429);
    expect(limit).toHaveBeenCalledWith({ key: '203.0.113.1' });
  });

  it('既存の /networth は対象外のまま', async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const env = makeEnv({}, { RATE_LIMITER: { limit } });
    const res = await worker.fetch(req('/networth'), env);
    expect(res.status).toBe(200);
    expect(limit).not.toHaveBeenCalled();
  });
});

describe('GET /order-sheet/plan', () => {
  it('未投入なら null', async () => {
    const res = await worker.fetch(req('/order-sheet/plan'), makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('投入済みならそのまま返す', async () => {
    const plan = makePlan();
    const res = await worker.fetch(req('/order-sheet/plan'), makeEnv({ 'order:plan': plan }));
    expect(await res.json()).toEqual(plan);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('GET /order-sheet', () => {
  it('plan 未投入なら null', async () => {
    const env = makeEnv({ networth: makeNetworth() });
    const res = await worker.fetch(req('/order-sheet'), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('注文表（指値×株数）を返し、KV に書かない', async () => {
    const env = makeEnv({ 'order:plan': makePlan(), networth: makeNetworth() });
    const res = await worker.fetch(req('/order-sheet'), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const sheet = await res.json();
    expect(sheet.meta.planRev).toBe(3);
    expect(sheet.meta.fxUsdJpy).toBe(150);
    const aaa = sheet.orders.find((o) => o.symbol === 'AAA');
    // 基準 $400 × (1 − 8%) = $368 → floor(30000 / 368) = 81 株（§6.2 の合成例）
    expect(aaa).toMatchObject({ side: 'buy', stageId: 's1', status: 'toPlace', limit: 368, qty: 81 });
    expect(aaa.currentPrice).toBe(395);
    expect(env.KV.put).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(STRATEGY_URL, expect.objectContaining({ cf: { cacheTtl: 300 } }));
  });

  it('戦略設定の取得に失敗したら既定値で計算し warnings に出す', async () => {
    strategyOk = false;
    const env = makeEnv({ 'order:plan': makePlan(), networth: makeNetworth() });
    const sheet = await (await worker.fetch(req('/order-sheet'), env)).json();
    expect(sheet.meta.warnings).toContain('戦略設定を取得できず既定値で計算');
    expect(sheet.aiTech.capPct).toBe(29);
  });

  it('prices:cache が 7h より古い銘柄は採用せず mf の価格で概算する（Finnhub キー無し）', async () => {
    const old = Date.now() - 8 * 60 * 60 * 1000;
    const env = makeEnv({
      'order:plan': makePlan(),
      networth: makeNetworth(),
      'prices:cache': { AAA: { price: 395, ts: old }, CSH: { price: 50, ts: old } },
    });
    const sheet = await (await worker.fetch(req('/order-sheet'), env)).json();
    expect(sheet.meta.warnings.some((w) => w.startsWith('AAA: 現在値が取れず'))).toBe(true);
    // mf の price 60,000 円 ÷ 150 = $400
    expect(sheet.orders.find((o) => o.symbol === 'AAA').currentPrice).toBe(400);
  });

  it('Finnhub キーがあれば古いキャッシュの銘柄だけ /quote で取得する（KV に書かない）', async () => {
    const now = Date.now();
    fetchMock.mockImplementation(async (url) => {
      const u = String(url);
      if (u === STRATEGY_URL) return new Response('{}', { status: 200 });
      if (u.startsWith('https://finnhub.io/api/v1/quote?symbol=AAA')) {
        return new Response(JSON.stringify({ c: 390 }), { status: 200 });
      }
      return new Response('unexpected', { status: 404 });
    });
    const env = makeEnv(
      {
        'order:plan': makePlan(),
        networth: makeNetworth(),
        'prices:cache': { AAA: { price: 395, ts: now - 8 * 3600_000 }, CSH: { price: 50, ts: now } },
      },
      { FINNHUB_API_KEY: 'synthetic-key' }
    );
    const sheet = await (await worker.fetch(req('/order-sheet'), env)).json();
    expect(sheet.orders.find((o) => o.symbol === 'AAA').currentPrice).toBe(390);
    const quoteCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes('/quote'));
    expect(quoteCalls).toHaveLength(1);
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it('mf の株数で約定を検知しても表示だけ（KV の plan は書き換えない）', async () => {
    const plan = placedPlan();
    const env = makeEnv({ 'order:plan': plan, networth: makeNetworth({ asOf: '2026-01-06', aaaQty: 181 }) });
    const sheet = await (await worker.fetch(req('/order-sheet'), env)).json();
    expect(sheet.meta.autoDetected).toEqual([{ symbol: 'AAA', stageId: 's1', partial: false }]);
    const aaa = sheet.orders.find((o) => o.symbol === 'AAA');
    expect(aaa.stageId).toBe('s2');
    expect(env.KV.put).not.toHaveBeenCalled();
    expect(JSON.parse(env.KV.store.get('order:plan'))).toEqual(plan);
  });

  it('tier=theme の銘柄は KV の構成銘柄キャッシュから上位 1 銘柄を添える（取得しに行かない）', async () => {
    const plan = makePlan();
    plan.symbols.BBB = {
      tier: 'theme',
      targetUsd: null,
      lot: 1,
      basePrice: 100,
      baseAt: '2026-01-01T00:00:00Z',
      baseEvent: 'manual',
      note: '',
      stages: [stage({ id: 's1', amountUsd: 5000, dropPct: 10 })],
    };
    const env = makeEnv({
      'order:plan': plan,
      networth: makeNetworth(),
      'prices:cache': { AAA: { price: 395, ts: Date.now() }, BBB: { price: 100, ts: Date.now() } },
      'constituents:BBB': {
        holdings: [
          { ticker: 'XXX', weight: 0.12 },
          { ticker: 'YYY', weight: 0.2 },
        ],
      },
    });
    const sheet = await (await worker.fetch(req('/order-sheet'), env)).json();
    const bbb = sheet.ladders.find((l) => l.symbol === 'BBB');
    expect(JSON.stringify(bbb)).toContain('上位: YYY 20%');
    expect(fetchMock.mock.calls.every(([u]) => String(u) === STRATEGY_URL)).toBe(true);
  });

  it('KV の JSON が壊れていたら 500（内容を console に出さない）', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const env = makeEnv({ 'order:plan': '{"secret":12345' });
    const res = await worker.fetch(req('/order-sheet'), env);
    expect(res.status).toBe(500);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('12345');
  });
});

describe('PUT /order-sheet/plan', () => {
  it('JSON 不正は 400', async () => {
    const env = makeEnv();
    const res = await worker.fetch(req('/order-sheet/plan', { method: 'PUT', body: '{bad' }), env);
    expect(res.status).toBe(400);
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it('検証エラーは 400 で errors を返す', async () => {
    const env = makeEnv();
    const bad = makePlan();
    bad.symbols.AAA.stages[1].state = 'working'; // working が 2 つ
    const res = await worker.fetch(req('/order-sheet/plan', { method: 'PUT', body: bad }), env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors.length).toBeGreaterThan(0);
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it('USD 建て以外（.T）は 400', async () => {
    const bad = makePlan();
    bad.symbols['1234.T'] = bad.symbols.AAA;
    const res = await worker.fetch(req('/order-sheet/plan', { method: 'PUT', body: bad }), makeEnv());
    expect(res.status).toBe(400);
  });

  it('KV 未投入時の初回 PUT は rev 不要・rev=1 で保存しログに積む', async () => {
    const env = makeEnv();
    const plan = makePlan();
    delete plan.rev;
    const res = await worker.fetch(req('/order-sheet/plan', { method: 'PUT', body: plan }), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, rev: 1 });
    expect(JSON.parse(env.KV.store.get('order:plan')).rev).toBe(1);
    const log = JSON.parse(env.KV.store.get('order:log'));
    expect(log[0]).toMatchObject({ type: 'plan-put', rev: 1 });
  });

  it('rev 不一致は 409 で現在の rev を返す（KV に書かない）', async () => {
    const env = makeEnv({ 'order:plan': makePlan({ rev: 7 }) });
    const res = await worker.fetch(req('/order-sheet/plan', { method: 'PUT', body: makePlan({ rev: 6 }) }), env);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ rev: 7 });
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it('投入済みで rev 省略も 409', async () => {
    const env = makeEnv({ 'order:plan': makePlan({ rev: 7 }) });
    const plan = makePlan();
    delete plan.rev;
    const res = await worker.fetch(req('/order-sheet/plan', { method: 'PUT', body: plan }), env);
    expect(res.status).toBe(409);
  });

  it('rev 一致なら rev+1 で置き換える', async () => {
    const env = makeEnv({ 'order:plan': makePlan({ rev: 7 }) });
    const next = makePlan({ rev: 7 });
    next.symbols.AAA.note = 'changed';
    const res = await worker.fetch(req('/order-sheet/plan', { method: 'PUT', body: next }), env);
    expect(res.status).toBe(200);
    const saved = JSON.parse(env.KV.store.get('order:plan'));
    expect(saved.rev).toBe(8);
    expect(saved.symbols.AAA.note).toBe('changed');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('POST /order-sheet/events', () => {
  it('rev が無ければ 400', async () => {
    const env = makeEnv({ 'order:plan': makePlan(), networth: makeNetworth() });
    const res = await worker.fetch(
      req('/order-sheet/events', { method: 'POST', body: { type: 'placed', symbol: 'AAA', stageId: 's1' } }),
      env
    );
    expect(res.status).toBe(400);
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it('plan 未投入は 400', async () => {
    const res = await worker.fetch(
      req('/order-sheet/events', { method: 'POST', body: { rev: 0, type: 'review', event: 'CPI' } }),
      makeEnv()
    );
    expect(res.status).toBe(400);
  });

  it('rev 不一致は 409（KV に書かない）', async () => {
    const env = makeEnv({ 'order:plan': makePlan({ rev: 3 }), networth: makeNetworth() });
    const res = await worker.fetch(
      req('/order-sheet/events', { method: 'POST', body: { rev: 2, type: 'placed', symbol: 'AAA', stageId: 's1' } }),
      env
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ rev: 3 });
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it('不正なイベント（working でない段）は 400', async () => {
    const env = makeEnv({ 'order:plan': makePlan(), networth: makeNetworth() });
    const res = await worker.fetch(
      req('/order-sheet/events', { method: 'POST', body: { rev: 3, type: 'placed', symbol: 'AAA', stageId: 's2' } }),
      env
    );
    expect(res.status).toBe(400);
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it('placed: rev+1 で保存し、ログに積み、新しい注文表を返す', async () => {
    const env = makeEnv({ 'order:plan': makePlan(), networth: makeNetworth() });
    const res = await worker.fetch(
      req('/order-sheet/events', { method: 'POST', body: { rev: 3, type: 'placed', symbol: 'AAA', stageId: 's1' } }),
      env
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const sheet = await res.json();
    expect(sheet.meta.planRev).toBe(4);
    expect(sheet.orders.find((o) => o.symbol === 'AAA')).toMatchObject({ status: 'placed', limit: 368, qty: 81 });
    const saved = JSON.parse(env.KV.store.get('order:plan'));
    expect(saved.rev).toBe(4);
    expect(saved.symbols.AAA.stages[0]).toMatchObject({ orderedQty: 81, orderedLimit: 368, qtyAtPlace: 100 });
    expect(saved.symbols.AAA.stages[0]).not.toHaveProperty('rev');
    const log = JSON.parse(env.KV.store.get('order:log'));
    expect(log[0]).toMatchObject({ type: 'placed', symbol: 'AAA', stageId: 's1', rev: 4 });
  });

  it('filled: 次の段が working（要発注）になる', async () => {
    const env = makeEnv({ 'order:plan': placedPlan(), networth: makeNetworth() });
    const res = await worker.fetch(
      req('/order-sheet/events', { method: 'POST', body: { rev: 3, type: 'filled', symbol: 'AAA', stageId: 's1' } }),
      env
    );
    const sheet = await res.json();
    expect(sheet.orders.find((o) => o.symbol === 'AAA')).toMatchObject({ stageId: 's2', status: 'toPlace' });
    const saved = JSON.parse(env.KV.store.get('order:plan'));
    expect(saved.symbols.AAA.stages.map((s) => s.state)).toEqual(['filled', 'working']);
    expect(saved.symbols.AAA.stages[0].fillSource).toBe('self');
  });
});

describe('Cron: 約定の自動確定', () => {
  it('mf の株数で約定したら order:plan（rev+1）と order:log を書く', async () => {
    const env = makeEnv({ 'order:plan': placedPlan(), networth: makeNetworth({ asOf: '2026-01-06', aaaQty: 181 }) });
    await worker.scheduled({}, env, { waitUntil() {} });
    const saved = JSON.parse(env.KV.store.get('order:plan'));
    expect(saved.rev).toBe(4);
    expect(saved.symbols.AAA.stages.map((s) => s.state)).toEqual(['filled', 'working']);
    expect(saved.symbols.AAA.stages[0].fillSource).toBe('mf-qty');
    const log = JSON.parse(env.KV.store.get('order:log'));
    expect(log[0]).toMatchObject({ type: 'filled', symbol: 'AAA', source: 'mf-qty', rev: 4 });
    const writtenKeys = env.KV.put.mock.calls.map(([k]) => k);
    expect(writtenKeys.sort()).toEqual(['order:log', 'order:plan']);
  });

  it('変化が無ければ書かない（同日の同期は約定を含まない）', async () => {
    const env = makeEnv({ 'order:plan': placedPlan(), networth: makeNetworth({ asOf: '2026-01-05', aaaQty: 181 }) });
    await worker.scheduled({}, env, { waitUntil() {} });
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it('plan 未投入・networth 無しなら何もしない', async () => {
    const env = makeEnv();
    await worker.scheduled({}, env, { waitUntil() {} });
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it('書く直前に読み直して rev が変わっていたら今回は書かない', async () => {
    const env = makeEnv({ 'order:plan': placedPlan(), networth: makeNetworth({ asOf: '2026-01-06', aaaQty: 181 }) });
    const origGet = env.KV.get.getMockImplementation();
    let planReads = 0;
    env.KV.get.mockImplementation(async (key, type) => {
      if (key === 'order:plan') {
        planReads++;
        if (planReads >= 2) return JSON.stringify({ ...placedPlan(), rev: 4 });
      }
      return origGet(key, type);
    });
    await worker.scheduled({}, env, { waitUntil() {} });
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it('KV が壊れていても既存の Cron 処理を止めない（例外を投げない）', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const env = makeEnv({ 'order:plan': '{"broken":98765' });
    await expect(worker.scheduled({}, env, { waitUntil() {} })).resolves.toBeUndefined();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('98765');
  });
});

describe('console に値を出さない', () => {
  it('events・Cron の console 出力にシンボルと type 以外の数値（価格・株数・金額）が無い', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const env1 = makeEnv({ 'order:plan': makePlan(), networth: makeNetworth() });
    await worker.fetch(
      req('/order-sheet/events', { method: 'POST', body: { rev: 3, type: 'placed', symbol: 'AAA', stageId: 's1' } }),
      env1
    );
    await worker.fetch(req('/order-sheet'), env1);
    const plan = makePlan({ rev: 4 });
    await worker.fetch(req('/order-sheet/plan', { method: 'PUT', body: plan }), env1);

    const env2 = makeEnv({ 'order:plan': placedPlan(), networth: makeNetworth({ asOf: '2026-01-06', aaaQty: 181 }) });
    await worker.scheduled({}, env2, { waitUntil() {} });

    const out = JSON.stringify([...log.mock.calls, ...warn.mock.calls, ...error.mock.calls]);
    for (const v of ['368', '81', '30000', '100000', '395', '181', '150000000']) {
      expect(out).not.toContain(v);
    }
    expect(out).toContain('AAA'); // シンボルと type は出してよい
  });
});

describe('入力サイズの上限・未知キーの除去（#686）', () => {
  const big = () => JSON.stringify({ ...makePlan({ rev: 3 }), pad: 'x'.repeat(256 * 1024) });

  it('PUT /order-sheet/plan: body が 256KB 超は 413（KV に書かない・no-store）', async () => {
    const env = makeEnv({ 'order:plan': makePlan() });
    const res = await worker.fetch(req('/order-sheet/plan', { method: 'PUT', body: big() }), env);
    expect(res.status).toBe(413);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it('POST /order-sheet/events: body が 256KB 超は 413（KV に書かない）', async () => {
    const env = makeEnv({ 'order:plan': makePlan(), networth: makeNetworth() });
    const body = JSON.stringify({ rev: 3, type: 'review', event: 'x'.repeat(256 * 1024) });
    const res = await worker.fetch(req('/order-sheet/events', { method: 'POST', body }), env);
    expect(res.status).toBe(413);
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it('マルチバイト文字はバイト数で数える（文字数は上限未満でも 413）', async () => {
    const env = makeEnv();
    const body = JSON.stringify({ ...makePlan(), pad: 'あ'.repeat(100 * 1024) }); // 約 300KB
    const res = await worker.fetch(req('/order-sheet/plan', { method: 'PUT', body }), env);
    expect(res.status).toBe(413);
  });

  it('401 は 413 より先（認証前に本文を評価しない）', async () => {
    const env = makeEnv();
    const res = await worker.fetch(req('/order-sheet/plan', { method: 'PUT', pin: null, body: big() }), env);
    expect(res.status).toBe(401);
  });

  it('PUT: §3.1 に無いキーは保存しない', async () => {
    const env = makeEnv({ 'order:plan': makePlan({ rev: 7 }) });
    const next = makePlan({ rev: 7, extra: 'drop-me' });
    next.funding.extra = 1;
    next.funding.usdCashRows = [{ institution: 'Bank X', name: 'USD', extra: 2 }];
    next.symbols.AAA.extra = 3;
    next.symbols.AAA.stages[0].extra = 4;
    const res = await worker.fetch(req('/order-sheet/plan', { method: 'PUT', body: next }), env);
    expect(res.status).toBe(200);
    const saved = JSON.parse(env.KV.store.get('order:plan'));
    expect(saved).not.toHaveProperty('extra');
    expect(saved.funding).not.toHaveProperty('extra');
    expect(saved.funding.usdCashRows[0]).toEqual({ institution: 'Bank X', name: 'USD' });
    expect(saved.symbols.AAA).not.toHaveProperty('extra');
    expect(saved.symbols.AAA.stages[0]).not.toHaveProperty('extra');
    expect(saved.symbols.AAA.stages[0]).toMatchObject({ id: 's1', side: 'buy', amountUsd: 30000 });
  });

  it('PUT: note が長すぎると 400（KV に書かない）', async () => {
    const env = makeEnv({ 'order:plan': makePlan({ rev: 7 }) });
    const next = makePlan({ rev: 7 });
    next.symbols.AAA.note = 'n'.repeat(501);
    const res = await worker.fetch(req('/order-sheet/plan', { method: 'PUT', body: next }), env);
    expect(res.status).toBe(400);
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it('events: review の event が長すぎると 400（KV に書かない）', async () => {
    const env = makeEnv({ 'order:plan': makePlan(), networth: makeNetworth() });
    const res = await worker.fetch(
      req('/order-sheet/events', { method: 'POST', body: { rev: 3, type: 'review', event: 'e'.repeat(65) } }),
      env
    );
    expect(res.status).toBe(400);
    expect(env.KV.put).not.toHaveBeenCalled();
  });
});

describe('KV.put の失敗（#686）', () => {
  it('PUT /order-sheet/plan: KV.put が投げたら 500（CORS・no-store 付き・値を console に出さない）', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const env = makeEnv({ 'order:plan': makePlan({ rev: 7 }) });
    env.KV.put.mockRejectedValue(new Error('kv down 98765'));
    const next = makePlan({ rev: 7 });
    const res = await worker.fetch(req('/order-sheet/plan', { method: 'PUT', body: next }), env);
    expect(res.status).toBe(500);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect((await res.json()).error).toBeTruthy();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('98765');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('100000');
  });

  it('POST /order-sheet/events: KV.put が投げたら 500（CORS・no-store 付き）', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const env = makeEnv({ 'order:plan': makePlan(), networth: makeNetworth() });
    env.KV.put.mockRejectedValue(new Error('kv down'));
    const res = await worker.fetch(
      req('/order-sheet/events', { method: 'POST', body: { rev: 3, type: 'placed', symbol: 'AAA', stageId: 's1' } }),
      env
    );
    expect(res.status).toBe(500);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
