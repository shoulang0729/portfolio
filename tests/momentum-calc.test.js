// Tests for price momentum pure functions in src/momentum-calc.js

import { describe, it, expect } from 'vitest';
import { priceMom1Y, pos52w, computePriceMomentum, relStrength } from '../src/momentum-calc.js';

/** ヘルパー: close 配列を {date, close} 系列に変換 */
function series(closes) {
  return closes.map((c, i) => ({ date: new Date(2026, 0, i + 1), close: c }));
}

describe('priceMom1Y', () => {
  it('computes simple first→last return in percent', () => {
    expect(priceMom1Y(series([100, 110]))).toBeCloseTo(10, 6);
    expect(priceMom1Y(series([100, 50]))).toBeCloseTo(-50, 6);
    expect(priceMom1Y(series([200, 150, 240]))).toBeCloseTo(20, 6);
  });

  it('returns null for <2 valid points', () => {
    expect(priceMom1Y(series([100]))).toBeNull();
    expect(priceMom1Y([])).toBeNull();
    expect(priceMom1Y(null)).toBeNull();
    expect(priceMom1Y(undefined)).toBeNull();
  });

  it('ignores non-positive closes', () => {
    // 先頭が 0 → フィルタされ [120, 132] が残り +10%
    expect(priceMom1Y(series([0, 120, 132]))).toBeCloseTo(10, 6);
  });
});

describe('pos52w', () => {
  it('returns position within the high-low range (0=low, 100=high)', () => {
    // hi=120 lo=80 last=100 → (100-80)/(120-80)=50%
    expect(pos52w(series([80, 120, 100]))).toBeCloseTo(50, 6);
    // last at the high → 100%
    expect(pos52w(series([80, 100, 120]))).toBeCloseTo(100, 6);
    // last at the low → 0%
    expect(pos52w(series([120, 100, 80]))).toBeCloseTo(0, 6);
  });

  it('returns null when range is flat or insufficient', () => {
    expect(pos52w(series([100, 100, 100]))).toBeNull();
    expect(pos52w(series([100]))).toBeNull();
    expect(pos52w([])).toBeNull();
  });
});

describe('relStrength', () => {
  it('returns stock 1Y return minus benchmark 1Y return (%pt)', () => {
    // stock +20% (100→120), bench +5% (100→105) → +15pt
    expect(relStrength(series([100, 120]), series([100, 105]))).toBeCloseTo(15, 6);
    // underperformer: stock -10%, bench +5% → -15pt
    expect(relStrength(series([100, 90]), series([100, 105]))).toBeCloseTo(-15, 6);
  });

  it('returns null when either side is not computable', () => {
    expect(relStrength(series([100]), series([100, 105]))).toBeNull();
    expect(relStrength(series([100, 120]), series([100]))).toBeNull();
    expect(relStrength(series([100, 120]), null)).toBeNull();
  });
});

describe('computePriceMomentum', () => {
  it('returns both metrics when computable', () => {
    const r = computePriceMomentum(series([80, 120, 100]));
    expect(r).not.toBeNull();
    expect(r.priceMom1Y).toBeCloseTo(25, 6); // 80→100
    expect(r.pos52w).toBeCloseTo(50, 6);
  });

  it('returns null when nothing is computable', () => {
    expect(computePriceMomentum([])).toBeNull();
    expect(computePriceMomentum(series([100]))).toBeNull();
  });

  it('still returns object when only one metric is available', () => {
    // 2点・同値以外 → priceMom1Y は出るが pos52w は range>0 なので出る。
    // フラット2点で priceMom1Y=0、pos52w=null のケース
    const r = computePriceMomentum(series([100, 100]));
    expect(r).not.toBeNull();
    expect(r.priceMom1Y).toBeCloseTo(0, 6);
    expect(r.pos52w).toBeNull();
  });
});
