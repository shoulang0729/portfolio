import { vi, describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

vi.mock('../src/state.js', () => ({
  state: { historicalCache: { '1y': {}, '5y': {}, '10y': {} } },
}));
vi.mock('../src/cache.js', () => ({
  saveCacheToSession: vi.fn(),
  loadCacheFromSession: vi.fn(),
  clearCacheSession: vi.fn(),
}));

import { state } from '../src/state.js';
import {
  getHistoricalEntry,
  setHistoricalEntry,
  getAllHistorical,
  migrateFromSessionStorage,
  clearHistoricalIDB,
} from '../src/historical-cache.js';

/** テスト用エントリ生成 */
function makeEntries(n = 3) {
  return Array.from({ length: n }, (_, i) => ({
    date:  new Date(2025, 0, i + 1),
    close: 100 + i,
  }));
}

beforeEach(async () => {
  // メモリキャッシュをリセット
  state.historicalCache = { '1y': {}, '5y': {}, '10y': {} };
  // IDB・メモリをクリア
  await clearHistoricalIDB();
  // saveCacheToSession の呼び出し履歴をリセット
  const { saveCacheToSession } = await import('../src/cache.js');
  saveCacheToSession.mockClear();
});

describe('setHistoricalEntry → getHistoricalEntry', () => {
  it('書き込んだエントリを IDB から読み返せる', async () => {
    const entries = makeEntries(3);
    await setHistoricalEntry('1y', 'AAPL', entries);

    const result = await getHistoricalEntry('1y', 'AAPL');
    expect(result).toHaveLength(3);
    expect(result[0].close).toBe(100);
    expect(result[2].close).toBe(102);
  });

  it('存在しないエントリは null を返す', async () => {
    const result = await getHistoricalEntry('1y', 'NONEXIST');
    expect(result).toBeNull();
  });

  it('setHistoricalEntry は state.historicalCache も更新する（並行書き込み）', async () => {
    const entries = makeEntries(2);
    await setHistoricalEntry('5y', 'TSLA', entries);

    expect(state.historicalCache['5y']['TSLA']).toHaveLength(2);
    expect(state.historicalCache['5y']['TSLA'][1].close).toBe(101);
  });
});

describe('getAllHistorical', () => {
  it('指定レンジの全エントリを取得する', async () => {
    await setHistoricalEntry('1y', 'AAPL', makeEntries(2));
    await setHistoricalEntry('1y', 'TSLA', makeEntries(3));
    await setHistoricalEntry('5y', 'AAPL', makeEntries(1)); // 別レンジはスキップ

    const result = await getAllHistorical('1y');
    expect(Object.keys(result)).toHaveLength(2);
    expect(result['AAPL']).toHaveLength(2);
    expect(result['TSLA']).toHaveLength(3);
    expect(result['AAPL'][0].date).toBeInstanceOf(Date);
  });
});

describe('migrateFromSessionStorage', () => {
  it('sessionStorage のデータを IDB へコピーする', async () => {
    // sessionStorage モックにデータをセット
    const ssData = {
      _v: '2',
      '1y': {
        'GOOG': [
          { date: '2025-01-01T00:00:00.000Z', close: 200 },
          { date: '2025-02-01T00:00:00.000Z', close: 210 },
        ],
      },
    };
    globalThis.sessionStorage.setItem('hm-hist-cache', JSON.stringify(ssData));

    await migrateFromSessionStorage();

    const result = await getHistoricalEntry('1y', 'GOOG');
    expect(result).toHaveLength(2);
    expect(result[0].close).toBe(200);
    expect(result[0].date).toBeInstanceOf(Date);
  });

  it('IDB に既存エントリがある場合は上書きしない', async () => {
    const original = makeEntries(2); // close: 100, 101
    await setHistoricalEntry('1y', 'AAPL', original);

    // sessionStorage に異なるデータをセット
    const ssData = {
      _v: '2',
      '1y': { 'AAPL': [{ date: '2025-01-01T00:00:00.000Z', close: 999 }] },
    };
    globalThis.sessionStorage.setItem('hm-hist-cache', JSON.stringify(ssData));

    await migrateFromSessionStorage();

    // IDB のデータ（close: 100, 101）が保持されていること
    const result = await getHistoricalEntry('1y', 'AAPL');
    expect(result[0].close).toBe(100);
  });
});
