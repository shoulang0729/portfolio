// Tests for liquidity (exit days) pure functions in src/liquidity-calc.js

import { describe, it, expect } from 'vitest';
import { adv, exitDays, computeLiquidity, ADV_WINDOW, PARTICIPATION } from '../src/liquidity-calc.js';

/** ヘルパー: vol 配列を {date, close, vol} 系列に変換 */
function vseries(vols) {
  return vols.map((v, i) => ({ date: new Date(2026, 0, i + 1), close: 100, vol: v }));
}

describe('adv', () => {
  it('averages the most recent `window` volumes', () => {
    expect(adv(vseries([100, 200, 300]))).toBeCloseTo(200, 6);
  });

  it('uses only the last `window` entries', () => {
    // window=2 → 最後の [300, 500] の平均 = 400
    expect(adv(vseries([100, 200, 300, 500]), 2)).toBeCloseTo(400, 6);
  });

  it('ignores non-positive / missing volumes', () => {
    const series = [
      { date: new Date(2026, 0, 1), close: 100, vol: 0 },
      { date: new Date(2026, 0, 2), close: 100 }, // vol 欠落
      { date: new Date(2026, 0, 3), close: 100, vol: 400 },
    ];
    expect(adv(series)).toBeCloseTo(400, 6);
  });

  it('returns null when no usable volume', () => {
    expect(adv([])).toBeNull();
    expect(adv(vseries([0, 0]))).toBeNull();
    expect(adv([{ date: new Date(), close: 100 }])).toBeNull();
  });

  it('defaults window to ADV_WINDOW', () => {
    expect(ADV_WINDOW).toBe(20);
  });
});

describe('exitDays', () => {
  it('computes shares / (ADV * participation)', () => {
    // 10000株 ÷ (1000 * 0.2 = 200/日) = 50日
    expect(exitDays(10000, 1000, 0.2)).toBeCloseTo(50, 6);
  });

  it('uses default participation', () => {
    expect(PARTICIPATION).toBe(0.1);
    expect(exitDays(1000, 1000)).toBeCloseTo(10, 6); // 1000/(1000*0.1)=10
  });

  it('returns null on bad inputs', () => {
    expect(exitDays(0, 1000)).toBeNull();
    expect(exitDays(-5, 1000)).toBeNull();
    expect(exitDays(1000, null)).toBeNull();
    expect(exitDays(1000, 0)).toBeNull();
  });
});

describe('computeLiquidity', () => {
  it('sorts by exit days descending, nulls last', () => {
    const holdings = [
      { sym: 'LIQUID', shares: 100, series: vseries([10000, 10000]) }, // 100/(10000*0.1)=0.1日
      { sym: 'ILLIQUID', shares: 100000, series: vseries([1000, 1000]) }, // 100000/(1000*0.1)=1000日
      { sym: 'NOVOL', shares: 100, series: [{ date: new Date(), close: 50 }] }, // ADV null → days null
    ];
    const r = computeLiquidity(holdings);
    expect(r.map((x) => x.sym)).toEqual(['ILLIQUID', 'LIQUID', 'NOVOL']);
    expect(r[0].days).toBeCloseTo(1000, 4);
    expect(r[2].days).toBeNull();
  });

  it('returns [] for non-array input', () => {
    expect(computeLiquidity(null)).toEqual([]);
  });
});
