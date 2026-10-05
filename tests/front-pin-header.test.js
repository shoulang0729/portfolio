// フロントの Worker 呼び出しに X-Pin-Hash を付けること（#714）
// すべて合成値。PIN ハッシュも架空の文字列。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// watchlist.js は読込時に document へリスナーを登録するため、最小のスタブを先に置く
vi.hoisted(() => {
  if (!globalThis.document) {
    globalThis.document = {
      addEventListener() {},
      getElementById() {
        return null;
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
    };
  }
});

import { loadPositionsFromKV } from '../src/positions-store.js';
import { saveWatchlist } from '../src/watchlist.js';
import { state } from '../src/state.js';

const PIN = 'test-pin-hash-synthetic';

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

function headerOf(init, name) {
  return new Headers(init?.headers || {}).get(name);
}

let fetchMock;

beforeEach(() => {
  localStorage.removeItem('hm-pin-hash');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.removeItem('hm-pin-hash');
});

describe('loadPositionsFromKV', () => {
  it('PIN が無ければ通信せず false（同梱データのまま）', async () => {
    expect(await loadPositionsFromKV()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('PIN があれば X-Pin-Hash を付けて取得する', async () => {
    localStorage.setItem('hm-pin-hash', PIN);
    fetchMock.mockResolvedValue(new Response(JSON.stringify([syntheticPosition()]), { status: 200 }));
    expect(await loadPositionsFromKV()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/positions$/);
    expect(headerOf(init, 'X-Pin-Hash')).toBe(PIN);
  });

  it('401 なら false', async () => {
    localStorage.setItem('hm-pin-hash', PIN);
    fetchMock.mockResolvedValue(new Response('{"error":"x"}', { status: 401 }));
    expect(await loadPositionsFromKV()).toBe(false);
  });
});

describe('ウォッチリストの KV 同期（PUT /watchlist）', () => {
  it('PIN が無くても従来どおり送る（X-Pin-Hash なし）', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    state.watchlist = [];
    saveWatchlist();
    await vi.advanceTimersByTimeAsync(1100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/watchlist$/);
    expect(init.method).toBe('PUT');
    expect(headerOf(init, 'X-Pin-Hash')).toBeNull();
  });

  it('PIN があれば X-Pin-Hash を付ける', async () => {
    vi.useFakeTimers();
    localStorage.setItem('hm-pin-hash', PIN);
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    state.watchlist = [];
    saveWatchlist();
    await vi.advanceTimersByTimeAsync(1100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(headerOf(fetchMock.mock.calls[0][1], 'X-Pin-Hash')).toBe(PIN);
  });
});
