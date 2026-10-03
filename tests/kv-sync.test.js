import { describe, it, expect } from 'vitest';

import { normValuation, findDrift, mergeValuations } from '../data/scheduler/lib/kv-sync.mjs';
import { isThrottledPath, isRetryableStatus } from '../data/scheduler/lib/worker-client.mjs';

// すべて合成値（実在の評価・保有とは無関係）
const VALS = {
  AAA: { perCurrent: 12.3, status: 'cheap', asOf: '2026-01-02', percentile: 20, bandLow: 10, bandHigh: 20 },
  BBB: { perCurrent: 30.1, status: 'rich', asOf: '2026-01-02', percentile: 90, bandLow: 15, bandHigh: 25 },
};

const kvSynced = () => [
  { key: 'k1', symbol: 'AAA', name: 'Alpha', exchange: 'X', cur: 'USD', type: 'stock', valuation: { ...VALS.AAA } },
  { key: 'k2', symbol: 'BBB', name: 'Beta', exchange: 'X', cur: 'JPY', type: 'etf', valuation: { ...VALS.BBB } },
  { key: 'k3', symbol: 'ZZZ', name: 'Bond', exchange: 'Y', cur: 'USD', type: 'bond', valuation: { perCurrent: 1 } },
];

describe('normValuation', () => {
  it('perCurrent/status/asOf を連結し、null は "null"', () => {
    expect(normValuation(VALS.AAA)).toBe('12.3/cheap/2026-01-02');
    expect(normValuation(null)).toBe('null');
    expect(normValuation(undefined)).toBe('null');
  });
});

describe('findDrift', () => {
  it('① 正本と同じなら drift 0', () => {
    expect(findDrift(kvSynced(), VALS)).toEqual([]);
  });

  it.each([
    ['perCurrent', 12.4],
    ['status', 'fair'],
    ['asOf', '2026-01-03'],
  ])('② %s が違えば drift', (field, value) => {
    const kv = kvSynced();
    kv[0].valuation = { ...kv[0].valuation, [field]: value };
    expect(findDrift(kv, VALS)).toEqual(['AAA']);
  });

  it('② KV に valuation が無い銘柄（正本にはある）は drift', () => {
    const kv = kvSynced();
    delete kv[1].valuation;
    expect(findDrift(kv, VALS)).toEqual(['BBB']);
  });

  it('③ 正本に無い銘柄は drift に入らない', () => {
    const kv = kvSynced();
    kv[2].valuation = { perCurrent: 999, status: 'rich', asOf: '1999-01-01' };
    expect(findDrift(kv, VALS)).toEqual([]);
  });

  it('⑤ valuation 以外のフィールドや比較キー以外の valuation 項目の違いは drift にしない', () => {
    const kv = kvSynced();
    kv[0].name = 'Renamed';
    kv[0].cur = 'JPY';
    kv[1].valuation = { ...kv[1].valuation, percentile: 1, bandLow: 0, note: 'x' };
    expect(findDrift(kv, VALS)).toEqual([]);
  });

  it('drift は KV の並び順で返す', () => {
    const kv = kvSynced();
    kv[0].valuation = null;
    kv[1].valuation = null;
    expect(findDrift(kv, VALS)).toEqual(['AAA', 'BBB']);
  });
});

describe('mergeValuations', () => {
  it('③ 正本に無い銘柄の要素は完全に元のまま（同一参照）', () => {
    const kv = kvSynced();
    const original = structuredClone(kv[2]);
    const merged = mergeValuations(kv, VALS);
    expect(merged[2]).toBe(kv[2]);
    expect(merged[2]).toEqual(original);
  });

  it('④ 配列・要素順・name など他フィールドを保持し valuation だけ差し替える', () => {
    const kv = kvSynced();
    kv[0].valuation = { perCurrent: 1, status: 'fair', asOf: '2025-12-31' };
    kv[1].valuation = undefined;
    const merged = mergeValuations(kv, VALS);
    expect(Array.isArray(merged)).toBe(true);
    expect(merged.map((e) => e.symbol)).toEqual(['AAA', 'BBB', 'ZZZ']);
    for (let i = 0; i < 2; i++) {
      const { valuation: _v, ...rest } = merged[i];
      const { valuation: _o, ...origRest } = kv[i];
      expect(rest).toEqual(origRest);
    }
    expect(merged[0].valuation).toEqual(VALS.AAA);
    expect(merged[1].valuation).toEqual(VALS.BBB);
    expect(findDrift(merged, VALS)).toEqual([]);
  });

  it('入力配列を変更しない', () => {
    const kv = kvSynced();
    kv[0].valuation = null;
    const snapshot = structuredClone(kv);
    mergeValuations(kv, VALS);
    expect(kv).toEqual(snapshot);
  });
});

describe('worker-client helpers', () => {
  it('レート制限対象パスだけスロットルする（/watchlist は対象外）', () => {
    expect(isThrottledPath('/yahoo?url=x')).toBe(true);
    expect(isThrottledPath('/finnhub?path=/quote')).toBe(true);
    expect(isThrottledPath('/fmp/ratios')).toBe(true);
    expect(isThrottledPath('/edgar')).toBe(true);
    expect(isThrottledPath('/edinet-db?x=1')).toBe(true);
    expect(isThrottledPath('/watchlist')).toBe(false);
    expect(isThrottledPath('/yahoox')).toBe(false);
  });

  it('429 と 5xx だけリトライ対象', () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(200)).toBe(false);
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });
});
