// Tests for worker/src/index.js: 未使用ルートの無効化と認証の追加（#714）
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

function syntheticWatchItem() {
  return { symbol: 'AAA', name: 'AAA Corp', exchange: 'NASDAQ', type: 'stock', cur: 'USD' };
}

function makeEnv(extra = {}) {
  return {
    KV: makeKv({ 'auth:pin-hash': PIN, positions: [syntheticPosition()], watchlist: [syntheticWatchItem()] }),
    FINNHUB_API_KEY: 'synthetic-key-not-real',
    GEMINI_API_KEY: 'synthetic-key-not-real',
    GROK_API_KEY: 'synthetic-key-not-real',
    DEEPSEEK_API_KEY: 'synthetic-key-not-real',
    ANTHROPIC_API_KEY: 'synthetic-key-not-real',
    NOTION_API_KEY: 'synthetic-key-not-real',
    NOTION_DB_ID: 'synthetic-db',
    ...extra,
  };
}

function req(path, { method = 'GET', pin, body } = {}) {
  const headers = { Origin: ORIGIN };
  if (pin) headers['X-Pin-Hash'] = pin;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('無効化したルート（410・外部 fetch と KV に触れない）', () => {
  const disabled = [
    '/ai/gemini',
    '/ai/grok',
    '/ai/deepseek',
    '/ai/claude',
    '/ai/models',
    '/ai/context',
    '/notion/save',
    '/ai/openai', // マネフォ画像取込の削除（#718）
  ];

  for (const path of disabled) {
    for (const method of ['GET', 'POST']) {
      it(`${method} ${path} → 410（CORS 付き）`, async () => {
        const env = makeEnv();
        const limit = vi.fn(async () => ({ success: true }));
        env.RATE_LIMITER = { limit };
        const res = await worker.fetch(
          req(path, { method, pin: PIN, body: method === 'POST' ? { model: 'x', messages: [] } : undefined }),
          env
        );
        expect(res.status).toBe(410);
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(env.KV.get).not.toHaveBeenCalled();
        expect(env.KV.put).not.toHaveBeenCalled();
        expect(limit).not.toHaveBeenCalled();
      });
    }
  }
});

describe('POST /ai/openai（#718 で無効化）', () => {
  it('OpenAI キーが設定されていても PIN 無しで 410・fetch しない', async () => {
    const env = makeEnv({ OPENAI_API_KEY: 'synthetic-key-not-real' });
    const res = await worker.fetch(
      req('/ai/openai', { method: 'POST', body: { model: 'x', messages: [] } }),
      env
    );
    expect(res.status).toBe(410);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('GET /positions（PIN 必須）', () => {
  it('PIN 無し → 401', async () => {
    const res = await worker.fetch(req('/positions'), makeEnv());
    expect(res.status).toBe(401);
  });

  it('PIN 不一致 → 401', async () => {
    const res = await worker.fetch(req('/positions', { pin: 'wrong-synthetic' }), makeEnv());
    expect(res.status).toBe(401);
  });

  it('PIN 一致 → 従来どおり保有を返す', async () => {
    const res = await worker.fetch(req('/positions', { pin: PIN }), makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([syntheticPosition()]);
  });

  it('PUT は従来どおり PIN 必須（無しで 401・一致で 200）', async () => {
    const env = makeEnv();
    const ng = await worker.fetch(req('/positions', { method: 'PUT', body: [syntheticPosition()] }), env);
    expect(ng.status).toBe(401);
    const ok = await worker.fetch(req('/positions', { method: 'PUT', pin: PIN, body: [syntheticPosition()] }), env);
    expect(ok.status).toBe(200);
  });
});

describe('/watchlist（GET は公開・PUT は PIN 必須・#715 PR5）', () => {
  it('GET は PIN 無しで取得できる（公開）', async () => {
    const res = await worker.fetch(req('/watchlist'), makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([syntheticWatchItem()]);
  });

  it('PUT は PIN 無し・不一致で 401・KV に書かない', async () => {
    const env = makeEnv();
    const none = await worker.fetch(req('/watchlist', { method: 'PUT', body: [syntheticWatchItem()] }), env);
    expect(none.status).toBe(401);
    const bad = await worker.fetch(
      req('/watchlist', { method: 'PUT', pin: 'wrong-synthetic', body: [syntheticWatchItem()] }),
      env,
    );
    expect(bad.status).toBe(401);
    expect(env.KV.put).not.toHaveBeenCalled();
  });

  it('PUT は PIN 一致で保存できる', async () => {
    const env = makeEnv();
    const res = await worker.fetch(req('/watchlist', { method: 'PUT', pin: PIN, body: [syntheticWatchItem()] }), env);
    expect(res.status).toBe(200);
    expect(env.KV.put).toHaveBeenCalledWith('watchlist', JSON.stringify([syntheticWatchItem()]));
  });
});

describe('/forex はレート制限の対象', () => {
  it('超過で 429・fetch しない', async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const res = await worker.fetch(req('/forex?from=USD&to=JPY'), makeEnv({ RATE_LIMITER: { limit } }));
    expect(res.status).toBe(429);
    expect(limit).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
