import { describe, it, expect } from 'vitest';
import { impliedGrowth, isGrowthOverheated, IMPLIED_GROWTH_OVERHEAT_PCT } from '../src/reverse-dcf.js';

describe('impliedGrowth (1段 Gordon)', () => {
  it('g = (wacc − fcfYield)/(1 + fcfYield)、%入力%出力', () => {
    // fy=4.3%, wacc=6% → (0.06−0.043)/1.043 = 0.0163 → 1.63%
    expect(impliedGrowth(4.3, 6)).toBeCloseTo(1.63, 1);
    // fy=2.6%, wacc=8% → (0.08−0.026)/1.026 = 0.0526 → 5.26%
    expect(impliedGrowth(2.6, 8)).toBeCloseTo(5.26, 1);
  });

  it('fcfYield > wacc なら織り込み成長率は負（市場が減益を織り込む）', () => {
    // 8050.T: fy=10.5%, wacc=6% → 負
    expect(impliedGrowth(10.5, 6)).toBeLessThan(0);
  });

  it('素材欠損（null/NaN/undefined）は null', () => {
    expect(impliedGrowth(null, 8)).toBeNull();
    expect(impliedGrowth(2.6, null)).toBeNull();
    expect(impliedGrowth(undefined, 8)).toBeNull();
    expect(impliedGrowth(NaN, 8)).toBeNull();
  });

  it('fcfYield=0 でも計算できる（denom=1）', () => {
    expect(impliedGrowth(0, 8)).toBeCloseTo(8, 5);
  });
});

describe('isGrowthOverheated', () => {
  it('閾値超で true、以下で false', () => {
    expect(isGrowthOverheated(IMPLIED_GROWTH_OVERHEAT_PCT + 0.5)).toBe(true);
    expect(isGrowthOverheated(IMPLIED_GROWTH_OVERHEAT_PCT)).toBe(false); // 厳密に超のみ
    expect(isGrowthOverheated(IMPLIED_GROWTH_OVERHEAT_PCT - 0.5)).toBe(false);
  });

  it('null/非数は false', () => {
    expect(isGrowthOverheated(null)).toBe(false);
    expect(isGrowthOverheated(undefined)).toBe(false);
    expect(isGrowthOverheated(NaN)).toBe(false);
  });

  it('TSLA 相当（fy=0.5,wacc=8→7.46%）は期待過多', () => {
    expect(isGrowthOverheated(impliedGrowth(0.5, 8))).toBe(true);
  });
});
