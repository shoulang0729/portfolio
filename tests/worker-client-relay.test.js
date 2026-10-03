import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  relayPath,
  workerJson,
  fmp,
  edinetDb,
  edgar,
  finnhub,
  WORKER_BASE,
  ORIGIN,
} from '../data/scheduler/lib/worker-client.mjs';

describe('relayPath', () => {
  it('path とパラメータを URL エンコードして組み立てる', () => {
    expect(relayPath('/fmp', '/stable/income-statement', { symbol: 'AAA', limit: 2 })).toBe(
      '/fmp?path=%2Fstable%2Fincome-statement&symbol=AAA&limit=2'
    );
    expect(relayPath('/edinet-db', '/v1/search', { q: '1234' })).toBe('/edinet-db?path=%2Fv1%2Fsearch&q=1234');
  });

  it('Worker 側の searchParams.get(path) で元のパスに戻る', () => {
    const u = new URL(`${WORKER_BASE}${relayPath('/edgar', '/api/xbrl/companyfacts/CIK0000000001.json')}`);
    expect(u.pathname).toBe('/edgar');
    expect(u.searchParams.get('path')).toBe('/api/xbrl/companyfacts/CIK0000000001.json');
  });
});

describe('中継口ヘルパー', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Origin を付けて GET し JSON を返す（API キーは付けない）', async () => {
    const calls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => {
        calls.push({ url, origin: init.headers.get('Origin') });
        return new Response(JSON.stringify({ ok: 1 }), { status: 200 });
      })
    );
    await expect(fmp('/stable/profile', { symbol: 'AAA' })).resolves.toEqual({ ok: 1 });
    await expect(edinetDb('/v1/companies/E00001/financials', { period: 'annual', limit: 2 })).resolves.toEqual({
      ok: 1,
    });
    await expect(edgar('/api/xbrl/companyfacts/CIK0000000001.json')).resolves.toEqual({ ok: 1 });
    await expect(finnhub('/stock/peers', { symbol: 'AAA' })).resolves.toEqual({ ok: 1 });
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual(['/fmp', '/edinet-db', '/edgar', '/finnhub']);
    expect(calls.every((c) => c.origin === ORIGIN)).toBe(true);
    expect(calls.some((c) => /apikey|token|api_key/i.test(c.url))).toBe(false);
  });

  it('非 2xx は本文を含まない HTTP <status> で throw する', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('secret-ish body', { status: 404 }))
    );
    await expect(workerJson('/fmp?path=%2Fstable%2Fprofile')).rejects.toThrow(/^HTTP 404$/);
  });
});
