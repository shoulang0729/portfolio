// Tests for worker/src/index.js の per-daily 起動 Cron（#708 PR2）
// 設計: docs/handoff/2026-10-05-per-daily-dispatch.md §4.2(d)
// トークンはすべて合成値。実値を書かない。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import worker from '../worker/src/index.js';

const CRON = '20 20,21 * * *';
const DISPATCH_URL = 'https://api.github.com/repos/shoulang0729/portfolio/actions/workflows/per-daily.yml/dispatches';
const TOKEN = 'test-token-not-real';
const TOKEN2 = 'test-dispatch-token-not-real';
const SUMMER = Date.parse('2026-10-05T20:20:00Z');

function makeKv() {
  return {
    get: vi.fn(async () => null),
    put: vi.fn(async () => {}),
  };
}

function makeEnv(over = {}) {
  return { KV: makeKv(), FINNHUB_API_KEY: 'test-finnhub-not-real', GITHUB_TOKEN: TOKEN, ...over };
}

function res(status, body) {
  return new Response(status === 204 ? null : JSON.stringify(body ?? { message: `status ${status}` }), { status });
}

let fetchMock;
let logs;

function run(env, scheduledTime = SUMMER, cron = CRON) {
  return worker.scheduled({ cron, scheduledTime }, env, { waitUntil() {} });
}

/** 再試行の待ち（2 秒・4 秒）を fake timers で進めながら実行する。 */
async function runWithTimers(env, scheduledTime = SUMMER) {
  const p = run(env, scheduledTime);
  p.catch(() => {});
  await vi.runAllTimersAsync();
  return p;
}

beforeEach(() => {
  fetchMock = vi.fn(async () => res(204));
  vi.stubGlobal('fetch', fetchMock);
  logs = [];
  for (const k of ['log', 'warn', 'error']) {
    vi.spyOn(console, k).mockImplementation((...a) => logs.push(a.map(String).join(' ')));
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('per-daily Cron: 季節の選択', () => {
  it.each([
    ['2026-10-05T20:20:00Z', true],
    ['2026-10-05T21:20:00Z', false],
    ['2026-11-02T21:20:00Z', true],
    ['2026-11-02T20:20:00Z', false],
    ['2027-03-13T21:20:00Z', true],
    ['2027-03-14T20:20:00Z', true],
  ])('%s → dispatch=%s', async (iso, dispatched) => {
    await run(makeEnv(), Date.parse(iso));
    expect(fetchMock).toHaveBeenCalledTimes(dispatched ? 1 : 0);
    if (dispatched) expect(fetchMock.mock.calls[0][0]).toBe(DISPATCH_URL);
  });
});

describe('per-daily Cron: 204 で成功', () => {
  it('URL・POST・本文・ヘッダ。KV と finnhub には触らない', async () => {
    const env = makeEnv();
    await expect(run(env)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(DISPATCH_URL);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ ref: 'main' });
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(init.headers['X-GitHub-Api-Version']).toBe('2022-11-28');
    expect(init.headers['User-Agent']).toBeTruthy();
    expect(env.KV.get).not.toHaveBeenCalled();
    expect(env.KV.put).not.toHaveBeenCalled();
  });
});

describe('per-daily Cron: トークンの選択', () => {
  it('GH_DISPATCH_TOKEN と GITHUB_TOKEN の両方 → GH_DISPATCH_TOKEN', async () => {
    await run(makeEnv({ GH_DISPATCH_TOKEN: TOKEN2 }));
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN2}`);
    expect(logs.some((l) => l.includes('token=GH_DISPATCH_TOKEN'))).toBe(true);
  });

  it('GITHUB_TOKEN だけ → GITHUB_TOKEN（ログに名前）', async () => {
    await run(makeEnv());
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(logs.some((l) => l.includes('token=GITHUB_TOKEN'))).toBe(true);
  });

  it('両方無い → fetch せず reject', async () => {
    await expect(run(makeEnv({ GITHUB_TOKEN: undefined }))).rejects.toThrow(/no token/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('per-daily Cron: 再試行', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('503 → 503 → 204 で成功（fetch 3 回）', async () => {
    fetchMock.mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(204));
    await expect(runWithTimers(makeEnv())).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('429 は再試行の対象', async () => {
    fetchMock.mockResolvedValueOnce(res(429)).mockResolvedValueOnce(res(204));
    await expect(runWithTimers(makeEnv())).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('500 × 3 で reject', async () => {
    fetchMock.mockImplementation(async () => res(500));
    await expect(runWithTimers(makeEnv())).rejects.toThrow('per-daily dispatch failed: HTTP 500');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([401, 403, 404, 422])('%s は 1 回で reject（再試行しない）', async (status) => {
    fetchMock.mockImplementation(async () => res(status, { message: 'Bad credentials' }));
    await expect(runWithTimers(makeEnv())).rejects.toThrow(`HTTP ${status}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logs.some((l) => l.includes('dispatch failed') && l.includes('token=GITHUB_TOKEN'))).toBe(true);
  });

  it('fetch の throw は再試行の対象', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network down')).mockResolvedValueOnce(res(204));
    await expect(runWithTimers(makeEnv())).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fetch の throw が 3 回続けば reject', async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError('network down');
    });
    await expect(runWithTimers(makeEnv())).rejects.toThrow('per-daily dispatch failed: HTTP 0');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('per-daily Cron: ログにトークンの値が出ない', () => {
  it('成功・失敗のどちらでも', async () => {
    await run(makeEnv({ GH_DISPATCH_TOKEN: TOKEN2 }));
    fetchMock.mockImplementation(async () => res(401, { message: 'Bad credentials' }));
    await expect(run(makeEnv())).rejects.toThrow();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.includes(TOKEN) || l.includes(TOKEN2))).toBe(false);
  });
});

describe('既存の Cron では dispatch しない', () => {
  it.each([[{ cron: '0 1,8,15,22 * * *', scheduledTime: SUMMER }], [{}]])('%j', async (event) => {
    await worker.scheduled(event, makeEnv(), { waitUntil() {} });
    expect(fetchMock.mock.calls.some(([u]) => String(u) === DISPATCH_URL)).toBe(false);
  });
});
