// Tests for look-through risk aggregation in src/risk-calc.js

import { describe, it, expect } from 'vitest';
import { computeRiskBreakdown, toSlices, getContributors, getClassificationSummary, RISK_DIMENSIONS, UNKNOWN_KEY } from '../src/risk-calc.js';

describe('computeRiskBreakdown — synthetic positions', () => {
  it('maps a curated US stock fully (AAPL)', () => {
    const r = computeRiskBreakdown([{ symbol: 'AAPL', value: 1000, cat: '米国株・ETF', cur: 'USD' }]);
    expect(r.currency.cats.USD).toBe(1000);
    expect(r.country.cats.us).toBe(1000);
    expect(r.assetClass.cats.equity).toBe(1000);
    expect(r.sector.cats.tech).toBe(1000);
    // 完全分解なので unknown は出ない
    expect(r.sector.cats[UNKNOWN_KEY]).toBeUndefined();
    expect(r.currency.coverage).toBe(1);
  });

  it('routes a commodity holding to the commodity sector bucket (GLDM gold)', () => {
    const r = computeRiskBreakdown([{ symbol: 'GLDM', value: 500, cur: 'USD' }]);
    expect(r.assetClass.cats.commodity).toBe(500);
    expect(r.sector.cats.commodity).toBe(500);
    expect(r.currency.cats.USD).toBe(500);
  });

  it('accumulates the unknown remainder for partially-known funds (ひふみ sector)', () => {
    const r = computeRiskBreakdown([{ symbol: 'ひふみ', value: 1000, cur: 'JPY' }]);
    // sector は判明分のみ（合計 < 1）→ 残差が __unknown__ に入る
    expect(r.sector.cats[UNKNOWN_KEY]).toBeGreaterThan(0);
    expect(r.sector.coverage).toBeLessThan(1);
    // assetClass は equity 0.95 + cash 0.05 = 完全
    expect(r.assetClass.coverage).toBeCloseTo(1, 6);
  });

  it('derives defaults from cat/cur when no curated entry exists', () => {
    const r = computeRiskBreakdown([{ symbol: 'UNKNOWN_XYZ', value: 800, cat: '日本株・ETF', cur: 'JPY' }]);
    expect(r.currency.cats.JPY).toBe(800);
    expect(r.country.cats.japan).toBe(800);
    expect(r.assetClass.cats.equity).toBe(800);
    // セクター不明 → 全額 unknown
    expect(r.sector.cats[UNKNOWN_KEY]).toBe(800);
    expect(r.sector.coverage).toBe(0);
  });

  it('skips zero/negative value positions', () => {
    const r = computeRiskBreakdown([{ symbol: 'AAPL', value: 0, cur: 'USD' }]);
    expect(r.currency.total).toBe(0);
  });

  it('per-dimension total always equals the sum of position values', () => {
    const posList = [
      { symbol: 'AAPL', value: 1000, cur: 'USD' },
      { symbol: 'オルカン', value: 2000, cur: 'JPY' },
      { symbol: 'ひふみ', value: 3000, cur: 'JPY' },
    ];
    const r = computeRiskBreakdown(posList);
    for (const dim of RISK_DIMENSIONS) {
      const catSum = Object.values(r[dim].cats).reduce((s, v) => s + v, 0);
      expect(r[dim].total).toBeCloseTo(6000, 6);
      // cats（unknown 含む）の合計 = total（取りこぼしなし）
      expect(catSum).toBeCloseTo(6000, 6);
    }
  });
});

describe('toSlices', () => {
  it('sorts by value desc and keeps __unknown__ last', () => {
    const dim = { cats: { a: 100, [UNKNOWN_KEY]: 300, b: 200 }, total: 600, known: 300, coverage: 0.5 };
    const slices = toSlices(dim);
    expect(slices.map(s => s.key)).toEqual(['b', 'a', UNKNOWN_KEY]);
    expect(slices[0].pct).toBeCloseTo(200 / 600 * 100, 6);
  });
});

describe('getContributors', () => {
  it('returns per-category contributors sorted by value desc with in-category pct', () => {
    const posList = [
      { symbol: 'AAPL', name: 'アップル', value: 3000, cur: 'USD' },
      { symbol: 'MSFT', name: 'マイクロソフト', value: 1000, cur: 'USD' },
    ];
    const r = computeRiskBreakdown(posList);
    const techContrib = getContributors(r.sector, 'tech');
    expect(techContrib.map(c => c.symbol)).toEqual(['AAPL', 'MSFT']);
    expect(techContrib[0].pct).toBeCloseTo(75, 6);
    expect(techContrib[1].pct).toBeCloseTo(25, 6);
    expect(techContrib[0].name).toBe('アップル');
  });

  it('returns empty array for unknown category', () => {
    const r = computeRiskBreakdown([{ symbol: 'AAPL', value: 100, cur: 'USD' }]);
    expect(getContributors(r.sector, 'nonexistent')).toEqual([]);
  });

  it('tracks fund contributions into the unknown bucket', () => {
    const r = computeRiskBreakdown([{ symbol: 'ひふみ', name: 'ひふみ投信', value: 1000, cur: 'JPY' }]);
    const unknownContrib = getContributors(r.sector, UNKNOWN_KEY);
    expect(unknownContrib.length).toBe(1);
    expect(unknownContrib[0].symbol).toBe('ひふみ');
  });
});

describe('computeRiskBreakdown — real portfolio', () => {
  it('produces commodity exposure and both JPY/USD currency exposure', () => {
    const r = computeRiskBreakdown(); // 実 positions
    expect(r.assetClass.cats.commodity).toBeGreaterThan(0);
    expect(r.currency.cats.JPY).toBeGreaterThan(0);
    expect(r.currency.cats.USD).toBeGreaterThan(0);
    // 円建て投信を透過するので、USD エクスポージャーは USD 建て保有額より大きいはず
    expect(r.currency.coverage).toBeGreaterThan(0.9);
  });
});

describe('getClassificationSummary', () => {
  it('counts classified vs unclassified by CONSTITUENTS membership', () => {
    const r = getClassificationSummary([
      { symbol: 'AAPL', value: 1000 },     // CONSTITUENTS にある
      { symbol: 'NOPE_XYZ', value: 500 },  // 無い
      { symbol: 'SKIP', value: 0 },        // value<=0 はスキップ
    ]);
    expect(r.total).toBe(2);
    expect(r.classified).toBe(1);
    expect(r.unclassified).toBe(1);
    expect(r.unclassifiedSymbols).toEqual(['NOPE_XYZ']);
  });
});
