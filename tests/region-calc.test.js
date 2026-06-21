import { describe, it, expect } from 'vitest';
import { computeTrueRegionExposure, japanHomeBias, ACWI_JAPAN_PCT } from '../src/region-calc.js';

const REGION_MAP = {
  '6301': 'japan',
  AAPL: 'north_america',
  ILF: 'em_latam',
  GLDM: 'commodity_cash',
};

const REGION_WEIGHTS = {
  lookThrough: { オルカン: 'ACWI', ひふみ: 'ひふみ投信' },
  weights: {
    ACWI: { north_america: 63, japan: 5, europe: 15, em_asia: 12, global: 5 },
    ひふみ投信: { japan: 95, north_america: 5 },
  },
};

describe('computeTrueRegionExposure', () => {
  it('直接タグは全額その地域に配賦', () => {
    const r = computeTrueRegionExposure(
      [
        { symbol: '6301', value: 100 },
        { symbol: 'AAPL', value: 300 },
      ],
      REGION_MAP,
      REGION_WEIGHTS
    );
    expect(r.regions.japan).toBe(100);
    expect(r.regions.north_america).toBe(300);
    expect(r.total).toBe(400);
    expect(r.pct.japan).toBeCloseTo(25, 5);
  });

  it('ルックスルー対象は構成比で按分', () => {
    const r = computeTrueRegionExposure([{ symbol: 'オルカン', value: 1000 }], REGION_MAP, REGION_WEIGHTS);
    // ACWI: NA63/JP5/EU15/EM12/global5（合計100）
    expect(r.regions.north_america).toBeCloseTo(630, 5);
    expect(r.regions.japan).toBeCloseTo(50, 5);
    expect(r.regions.europe).toBeCloseTo(150, 5);
  });

  it('構成比合計が100でなくても比率で按分する', () => {
    const rw = { lookThrough: { F: 'P' }, weights: { P: { japan: 80, north_america: 40 } } }; // 合計120
    const r = computeTrueRegionExposure([{ symbol: 'F', value: 120 }], {}, rw);
    expect(r.regions.japan).toBeCloseTo(80, 5); // 120 * 80/120
    expect(r.regions.north_america).toBeCloseTo(40, 5);
  });

  it('symbol が無ければ ySymbol でキー解決', () => {
    const r = computeTrueRegionExposure([{ ySymbol: 'AAPL', value: 50 }], REGION_MAP, REGION_WEIGHTS);
    expect(r.regions.north_america).toBe(50);
  });

  it('未マップは unknown に集約', () => {
    const r = computeTrueRegionExposure([{ symbol: 'XYZ', value: 70 }], REGION_MAP, REGION_WEIGHTS);
    expect(r.regions.unknown).toBe(70);
  });

  it('value 欠損/0 はスキップ', () => {
    const r = computeTrueRegionExposure(
      [
        { symbol: 'AAPL', value: null },
        { symbol: '6301', value: 0 },
        { symbol: 'AAPL', value: 100 },
      ],
      REGION_MAP,
      REGION_WEIGHTS
    );
    expect(r.total).toBe(100);
  });

  it('日本のホームバイアス = 真% − ACWI 5%', () => {
    // 日本100 / 北米100 → 日本50% → bias = 50 − 5 = 45pt
    const r = computeTrueRegionExposure(
      [
        { symbol: '6301', value: 100 },
        { symbol: 'AAPL', value: 100 },
      ],
      REGION_MAP,
      REGION_WEIGHTS
    );
    const b = japanHomeBias(r.pct);
    expect(b.japanPct).toBeCloseTo(50, 5);
    expect(b.benchPct).toBe(ACWI_JAPAN_PCT);
    expect(b.biasPt).toBeCloseTo(45, 5);
  });

  it('空保有は total=0・pct 空', () => {
    const r = computeTrueRegionExposure([], REGION_MAP, REGION_WEIGHTS);
    expect(r.total).toBe(0);
    expect(Object.keys(r.pct)).toHaveLength(0);
    expect(japanHomeBias(r.pct).biasPt).toBe(-ACWI_JAPAN_PCT); // 0 − 5
  });
});
