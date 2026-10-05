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

// setStatus は DOM を触るのでスタブにする（文言の確認に使う）
vi.mock('../src/ui-status.js', async (importOriginal) => ({
  ...(await importOriginal()),
  setStatus: vi.fn(),
}));

import { loadPositionsFromKV } from '../src/positions-store.js';
import { saveWatchlist, _loadWatchlistFromWorker } from '../src/watchlist.js';
import { setStatus } from '../src/ui-status.js';
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

const PENDING = 'hm-watchlist-pending';

beforeEach(() => {
  localStorage.removeItem('hm-pin-hash');
  localStorage.removeItem(PENDING);
  localStorage.removeItem('hm-watchlist');
  vi.mocked(setStatus).mockClear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.removeItem('hm-pin-hash');
  localStorage.removeItem(PENDING);
  localStorage.removeItem('hm-watchlist');
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

function wlItem(symbol, valuation) {
  const item = { symbol, name: `${symbol} Inc`, exchange: '米国', type: '株', cur: 'USD' };
  if (valuation) item.valuation = valuation;
  return item;
}

describe('ウォッチリストの KV 同期（PUT /watchlist・#715 PR4）', () => {
  it('未ログインなら PUT を送らず、保留フラグを立てて黄色のステータスを出す', async () => {
    vi.useFakeTimers();
    state.watchlist = [wlItem('AAA')];
    saveWatchlist();
    await vi.advanceTimersByTimeAsync(1100);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING)).toBe('1');
    expect(JSON.parse(localStorage.getItem('hm-watchlist'))[0].symbol).toBe('AAA');
    expect(setStatus).toHaveBeenCalledTimes(1);
    expect(vi.mocked(setStatus).mock.calls[0][0]).toContain('この端末にだけ保存しました');
    expect(vi.mocked(setStatus).mock.calls[0][1]).toBe('yellow');
  });

  it('連続編集でもステータスは debounce 1 回につき 1 回', async () => {
    vi.useFakeTimers();
    state.watchlist = [wlItem('AAA')];
    saveWatchlist();
    saveWatchlist();
    saveWatchlist();
    await vi.advanceTimersByTimeAsync(1100);
    expect(setStatus).toHaveBeenCalledTimes(1);
  });

  it('ログイン済みなら X-Pin-Hash 付きで PUT し、200 で保留を消す', async () => {
    vi.useFakeTimers();
    localStorage.setItem('hm-pin-hash', PIN);
    localStorage.setItem(PENDING, '1');
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    state.watchlist = [wlItem('AAA')];
    saveWatchlist();
    await vi.advanceTimersByTimeAsync(1100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/watchlist$/);
    expect(init.method).toBe('PUT');
    expect(headerOf(init, 'X-Pin-Hash')).toBe(PIN);
    expect(localStorage.getItem(PENDING)).toBeNull();
  });

  it.each([401, 428])('%i なら保留を残し、PIN 確認の文言を出す', async (status) => {
    vi.useFakeTimers();
    localStorage.setItem('hm-pin-hash', PIN);
    fetchMock.mockResolvedValue(new Response('{"error":"x"}', { status }));
    state.watchlist = [wlItem('AAA')];
    saveWatchlist();
    await vi.advanceTimersByTimeAsync(1100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING)).toBe('1');
    expect(vi.mocked(setStatus).mock.calls.at(-1)[0]).toContain('PIN を確認してください');
  });

  it('5xx・ネットワークエラーでも保留を残す（文言は従来どおり）', async () => {
    vi.useFakeTimers();
    localStorage.setItem('hm-pin-hash', PIN);
    fetchMock.mockResolvedValueOnce(new Response('x', { status: 503 }));
    state.watchlist = [wlItem('AAA')];
    saveWatchlist();
    await vi.advanceTimersByTimeAsync(1100);
    expect(localStorage.getItem(PENDING)).toBe('1');
    expect(vi.mocked(setStatus).mock.calls.at(-1)[0]).toBe('ウォッチリストの保存に失敗しました（ローカルには保存済み）');

    fetchMock.mockRejectedValueOnce(new TypeError('network'));
    localStorage.removeItem(PENDING);
    saveWatchlist();
    await vi.advanceTimersByTimeAsync(1100);
    expect(localStorage.getItem(PENDING)).toBe('1');
  });
});

describe('ウォッチリストの読み込み（_loadWatchlistFromWorker・#715 PR4）', () => {
  const remote = [wlItem('AAA', { perCurrent: 12.3, status: 'cheap' }), wlItem('BBB', { perCurrent: 20 })];

  it('保留なしなら KV の配列でローカルを置き換える（従来どおり・PUT しない）', async () => {
    localStorage.setItem('hm-pin-hash', PIN);
    fetchMock.mockResolvedValue(new Response(JSON.stringify(remote), { status: 200 }));
    state.watchlist = [wlItem('CCC')];
    await _loadWatchlistFromWorker();
    expect(state.watchlist.map((w) => w.symbol)).toEqual(['AAA', 'BBB']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('保留あり・未ログイン: 銘柄構成はローカル、valuation は KV の値。PUT しない', async () => {
    localStorage.setItem(PENDING, '1');
    fetchMock.mockResolvedValue(new Response(JSON.stringify(remote), { status: 200 }));
    state.watchlist = [wlItem('BBB', { perCurrent: 1 }), wlItem('CCC'), wlItem('AAA')];
    await _loadWatchlistFromWorker();
    expect(state.watchlist.map((w) => w.symbol)).toEqual(['BBB', 'CCC', 'AAA']);
    expect(state.watchlist[0].valuation).toEqual({ perCurrent: 20 });
    expect(state.watchlist[1].valuation).toBeUndefined();
    expect(state.watchlist[2].valuation).toEqual({ perCurrent: 12.3, status: 'cheap' });
    expect(JSON.parse(localStorage.getItem('hm-watchlist')).map((w) => w.symbol)).toEqual(['BBB', 'CCC', 'AAA']);
    expect(fetchMock).toHaveBeenCalledTimes(1); // GET のみ
    expect(localStorage.getItem(PENDING)).toBe('1');
  });

  it('保留あり・ログイン済み: マージ結果を 1 回 PUT し、成功で保留を消す', async () => {
    localStorage.setItem('hm-pin-hash', PIN);
    localStorage.setItem(PENDING, '1');
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(remote), { status: 200 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    state.watchlist = [wlItem('CCC'), wlItem('AAA')];
    await _loadWatchlistFromWorker();
    await vi.waitFor(() => expect(localStorage.getItem(PENDING)).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, init] = fetchMock.mock.calls[1];
    expect(init.method).toBe('PUT');
    expect(headerOf(init, 'X-Pin-Hash')).toBe(PIN);
    const sent = JSON.parse(init.body);
    expect(sent.map((w) => w.symbol)).toEqual(['CCC', 'AAA']);
    expect(sent[1].valuation).toEqual({ perCurrent: 12.3, status: 'cheap' });
  });

  it('取得失敗ならローカルをそのまま使う', async () => {
    localStorage.setItem(PENDING, '1');
    fetchMock.mockRejectedValue(new TypeError('network'));
    state.watchlist = [wlItem('CCC')];
    await _loadWatchlistFromWorker();
    expect(state.watchlist.map((w) => w.symbol)).toEqual(['CCC']);
    expect(localStorage.getItem(PENDING)).toBe('1');
  });
});
