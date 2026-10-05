// Tests for worker/src/index.js: 公開リポへの書き込み経路が無効化されていること（#709）
// すべて合成値・架空ティッカー（AAA）。PIN ハッシュも架空の文字列。実値を書かない。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import worker from '../worker/src/index.js';

const PIN = 'test-pin-hash-synthetic';
const BASE = 'https://worker.example';
const ORIGIN = 'https://shoulang0729.github.io';

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

function syntheticPosition() {
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
  };
}

function makeEnv(kvInit = {}) {
  return {
    KV: makeKv({ 'auth:pin-hash': PIN, positions: [syntheticPosition()], ...kvInit }),
    GITHUB_TOKEN: 'synthetic-token-not-real',
    FINNHUB_API_KEY: 'synthetic-key-not-real',
  };
}

function makeCtx() {
  const pending = [];
  return {
    pending,
    waitUntil: vi.fn((p) => pending.push(p)),
  };
}

let fetchMock;

function githubCalls() {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes('api.github.com'));
}

beforeEach(() => {
  fetchMock = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('finnhub.io')) {
      return new Response(JSON.stringify({ c: 100, dp: 1 }), { status: 200 });
    }
    return new Response(JSON.stringify({ sha: 'synthetic' }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /portfolio/snapshot は無効化済み（410）', () => {
  it.each([
    ['body なし', undefined],
    ['payload 付き', JSON.stringify({ positions: [], watchlist: [], asOf: '2026-01-01T00:00:00Z' })],
    ['autoBuild', JSON.stringify({ autoBuild: true })],
  ])('%s: 410・CORS 付き・GitHub API を呼ばない・KV を読まない', async (_label, body) => {
    const env = makeEnv();
    const ctx = makeCtx();
    const res = await worker.fetch(
      new Request(`${BASE}/portfolio/snapshot`, {
        method: 'POST',
        headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
        body,
      }),
      env,
      ctx
    );
    await Promise.all(ctx.pending);
    expect(res.status).toBe(410);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    const json = await res.json();
    expect(typeof json.error).toBe('string');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(env.KV.get).not.toHaveBeenCalled();
    expect(env.KV.put).not.toHaveBeenCalled();
    expect(ctx.waitUntil).not.toHaveBeenCalled();
  });

  it('Origin なし（非ブラウザ）でも 410・GitHub API を呼ばない', async () => {
    const env = makeEnv();
    const res = await worker.fetch(new Request(`${BASE}/portfolio/snapshot`, { method: 'POST' }), env, makeCtx());
    expect(res.status).toBe(410);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GET でも 410', async () => {
    const env = makeEnv();
    const res = await worker.fetch(new Request(`${BASE}/portfolio/snapshot`), env, makeCtx());
    expect(res.status).toBe(410);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('PUT /positions は KV にだけ保存する（GitHub へミラーしない）', () => {
  it('成功時: 200・KV に保存・GitHub API を呼ばない', async () => {
    const env = makeEnv({ positions: [] });
    const ctx = makeCtx();
    const body = [syntheticPosition()];
    const res = await worker.fetch(
      new Request(`${BASE}/positions`, {
        method: 'PUT',
        headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'X-Pin-Hash': PIN },
        body: JSON.stringify(body),
      }),
      env,
      ctx
    );
    await Promise.all(ctx.pending);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(env.KV.put).toHaveBeenCalledWith('positions', JSON.stringify(body));
    expect(githubCalls()).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('PIN 不一致は従来どおり 401・KV に書かない', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request(`${BASE}/positions`, {
        method: 'PUT',
        headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'X-Pin-Hash': 'wrong' },
        body: JSON.stringify([syntheticPosition()]),
      }),
      env,
      makeCtx()
    );
    expect(res.status).toBe(401);
    expect(env.KV.put).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Cron（scheduled）は GitHub に書かない', () => {
  it('価格キャッシュは更新し、GitHub API は呼ばない', async () => {
    const env = makeEnv();
    const ctx = makeCtx();
    await worker.scheduled({}, env, ctx);
    await Promise.all(ctx.pending);
    expect(env.KV.put).toHaveBeenCalledWith('prices:cache', expect.any(String), expect.any(Object));
    expect(githubCalls()).toHaveLength(0);
  });
});
