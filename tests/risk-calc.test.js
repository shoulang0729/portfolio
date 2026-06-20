// Tests for look-through risk aggregation in src/risk-calc.js

import { describe, it, expect, afterEach } from 'vitest';
import { computeRiskBreakdown, toSlices, getContributors, getClassificationSummary, getSourceSummary, holdingsToBreakdown, RISK_DIMENSIONS, UNKNOWN_KEY, dailyReturns, stdev, annualizedVol, maxDrawdown, pearson, covar, betaTo, worstReturn, worstWindow, alignReturnsByDate, highCorrelationPairs, computePortfolioReturns } from '../src/risk-calc.js';
import { state } from '../src/state.js';

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

  it('routes a commodity holding to the commodity sector/country bucket (GLDM gold)', () => {
    const r = computeRiskBreakdown([{ symbol: 'GLDM', value: 500, cur: 'USD' }]);
    expect(r.assetClass.cats.commodity).toBe(500);
    expect(r.sector.cats.commodity).toBe(500);
    expect(r.country.cats.commodity).toBe(500); // 国・地域でも「コモディティ」スライス
    expect(r.currency.cats.USD).toBe(500);
  });

  it('classifies manual cash entries (現金(円))', () => {
    const r = computeRiskBreakdown([{ symbol: '現金(円)', value: 1000, cur: 'JPY' }]);
    expect(r.assetClass.cats.cash).toBe(1000);
    expect(r.currency.cats.JPY).toBe(1000);
    expect(r.country.cats.japan).toBe(1000);
    expect(r.sector.cats.cash).toBe(1000);
    expect(r.sector.coverage).toBe(1);
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
    expect(r.classifiedSymbols).toEqual(['AAPL']);
    expect(r.allSymbols).toEqual(['AAPL', 'NOPE_XYZ']);
  });
});

describe('computeRiskBreakdown — liveTopHoldings override', () => {
  afterEach(() => {
    state.liveTopHoldings = {};
  });

  it('uses live sector data from liveTopHoldings when available', () => {
    // オルカン の sector を live データで上書き
    state.liveTopHoldings['オルカン'] = {
      sector: { tech: 0.30, financials: 0.20, healthcare: 0.10, industrials: 0.10,
        consumer: 0.10, comm: 0.08, staples: 0.05, energy: 0.04, materials: 0.03 },
      asOf: '2026-05-31T00:00:00.000Z',
    };

    const r = computeRiskBreakdown([{ symbol: 'オルカン', value: 10000, cur: 'JPY' }]);

    // live データの tech 比率（0.30）が反映されること
    expect(r.sector.cats.tech).toBeCloseTo(3000, 4);
    expect(r.sector.cats.financials).toBeCloseTo(2000, 4);

    // assetClass / currency / country は curated entry から従来どおり取得されること
    expect(r.assetClass.cats.equity).toBeCloseTo(10000, 4);
    expect(r.currency.cats.USD).toBeGreaterThan(0);
    expect(r.country.cats.us).toBeGreaterThan(0);
  });

  it('falls back to curated sector when liveTopHoldings is empty', () => {
    // liveTopHoldings は空（afterEach でリセット済み）
    const r = computeRiskBreakdown([{ symbol: 'オルカン', value: 10000, cur: 'JPY' }]);

    // curated の tech 比率 (0.26) が使われること
    expect(r.sector.cats.tech).toBeCloseTo(2600, 4);
  });

  it('does not affect non-allowlist symbols (AAPL sector stays in tech)', () => {
    // AAPL に live data をセットしても sector はそのまま（今回の ALLOWLIST 対象外だが
    // liveTopHoldings に入れた場合は上書きされる — 動作確認）
    state.liveTopHoldings['AAPL'] = {
      sector: { financials: 1 },
      asOf: '2026-05-31T00:00:00.000Z',
    };
    const r = computeRiskBreakdown([{ symbol: 'AAPL', value: 1000, cur: 'USD' }]);

    // liveTopHoldings に値があれば上書きされる（allowlist 制限は loadTopHoldings 側）
    expect(r.sector.cats.financials).toBeCloseTo(1000, 4);
    expect(r.sector.cats.tech).toBeUndefined();
  });

  it('liveTopHoldings reset in afterEach does not bleed between tests', () => {
    // state.liveTopHoldings は空 → curated data が使われる
    const r = computeRiskBreakdown([{ symbol: 'オルカン', value: 10000, cur: 'JPY' }]);
    expect(r.sector.cats.tech).toBeCloseTo(2600, 4);
  });
});

describe('computeRiskBreakdown — live constituents merge priority (#207)', () => {
  afterEach(() => {
    state.liveConstituents = {};
  });

  it('prefers live holdings over curated when present (live > curated)', () => {
    // オルカン に live holdings をセット → curated を無視してこちらで集計される
    state.liveConstituents['オルカン'] = {
      asOf: '2026-06-01T00:00:00.000Z',
      source: 'ishares',
      holdings: [
        { ticker: 'AAA', weight: 0.7, currency: 'USD', country: 'us', sector: 'tech', assetClass: 'equity' },
        { ticker: 'BBB', weight: 0.3, currency: 'EUR', country: 'europe', sector: 'financials', assetClass: 'equity' },
      ],
    };
    const r = computeRiskBreakdown([{ symbol: 'オルカン', value: 10000, cur: 'JPY' }]);
    expect(r.currency.cats.USD).toBeCloseTo(7000, 4);
    expect(r.currency.cats.EUR).toBeCloseTo(3000, 4);
    expect(r.sector.cats.tech).toBeCloseTo(7000, 4);
    expect(r.country.cats.europe).toBeCloseTo(3000, 4);
  });

  it('falls back to curated when live holdings are empty/absent', () => {
    state.liveConstituents['オルカン'] = { asOf: 'x', source: 'ishares', holdings: [] };
    const r = computeRiskBreakdown([{ symbol: 'オルカン', value: 10000, cur: 'JPY' }]);
    // 空 holdings は採用されず curated の tech 比率 (0.26) が使われる
    expect(r.sector.cats.tech).toBeCloseTo(2600, 4);
  });

  it('live partial coverage produces an unknown remainder', () => {
    state.liveConstituents['AAPL'] = {
      asOf: 'x', source: 'ishares',
      holdings: [{ ticker: 'AAA', weight: 0.6, currency: 'USD', country: 'us', sector: 'tech', assetClass: 'equity' }],
    };
    const r = computeRiskBreakdown([{ symbol: 'AAPL', value: 1000, cur: 'USD' }]);
    expect(r.sector.cats.tech).toBeCloseTo(600, 4);
    expect(r.sector.cats[UNKNOWN_KEY]).toBeCloseTo(400, 4);
    expect(r.sector.coverage).toBeCloseTo(0.6, 4);
  });
});

describe('getSourceSummary — per-dim source mix + freshness (#208)', () => {
  afterEach(() => {
    state.liveConstituents = {};
    state.liveTopHoldings = {};
  });

  it('classifies curated vs estimated by value weight', () => {
    const s = getSourceSummary([
      { symbol: 'AAPL', value: 3000, cur: 'USD' },      // curated
      { symbol: 'NOPE_XYZ', value: 1000, cur: 'USD' },  // 推定（curated 無し）
    ]);
    // currency 軸: curated 3000/4000 = 0.75, estimated 0.25
    expect(s.currency.curated).toBeCloseTo(0.75, 4);
    expect(s.currency.estimated).toBeCloseTo(0.25, 4);
    expect(s.currency.live).toBe(0);
    expect(s.currency.oldestAsOf).toBeNull();
  });

  it('counts live constituents as live across all dims with asOf', () => {
    state.liveConstituents['NOPE_XYZ'] = {
      asOf: '2026-06-01T00:00:00.000Z', source: 'finnhub',
      holdings: [{ weight: 1, currency: 'USD', country: 'us', sector: 'tech', assetClass: 'equity' }],
    };
    const s = getSourceSummary([{ symbol: 'NOPE_XYZ', value: 1000, cur: 'USD' }]);
    expect(s.sector.live).toBeCloseTo(1, 4);
    expect(s.currency.live).toBeCloseTo(1, 4);
    expect(s.sector.oldestAsOf).toBe('2026-06-01T00:00:00.000Z');
  });

  it('liveTopHoldings makes only the sector axis live (other axes stay curated)', () => {
    state.liveTopHoldings['オルカン'] = { sector: { tech: 1 }, asOf: '2026-05-20T00:00:00.000Z' };
    const s = getSourceSummary([{ symbol: 'オルカン', value: 5000, cur: 'JPY' }]);
    expect(s.sector.live).toBeCloseTo(1, 4);   // sector は live
    expect(s.currency.live).toBe(0);            // 他軸は curated
    expect(s.currency.curated).toBeCloseTo(1, 4);
    expect(s.sector.oldestAsOf).toBe('2026-05-20T00:00:00.000Z');
  });

  it('tracks the oldest asOf among live contributors', () => {
    state.liveConstituents['A'] = { asOf: '2026-06-05T00:00:00.000Z', source: 'finnhub', holdings: [{ weight: 1, sector: 'tech' }] };
    state.liveConstituents['B'] = { asOf: '2026-05-01T00:00:00.000Z', source: 'finnhub', holdings: [{ weight: 1, sector: 'financials' }] };
    const s = getSourceSummary([
      { symbol: 'A', value: 1000, cur: 'USD' },
      { symbol: 'B', value: 1000, cur: 'USD' },
    ]);
    expect(s.sector.oldestAsOf).toBe('2026-05-01T00:00:00.000Z');
  });
});

describe('holdingsToBreakdown — Level 2 normalized holdings adapter (#206)', () => {
  it('folds each holding weight into its per-dim category', () => {
    const b = holdingsToBreakdown([
      { ticker: 'AAPL', weight: 0.6, currency: 'USD', country: 'us', sector: 'tech', assetClass: 'equity' },
      { ticker: '7203.T', weight: 0.4, currency: 'JPY', country: 'japan', sector: 'consumer', assetClass: 'equity' },
    ]);
    expect(b.assetClass).toEqual({ equity: 1 });
    expect(b.currency).toEqual({ USD: 0.6, JPY: 0.4 });
    expect(b.country).toEqual({ us: 0.6, japan: 0.4 });
    expect(b.sector).toEqual({ tech: 0.6, consumer: 0.4 });
  });

  it('accumulates multiple holdings that share a category', () => {
    const b = holdingsToBreakdown([
      { weight: 0.3, sector: 'tech', currency: 'USD', country: 'us', assetClass: 'equity' },
      { weight: 0.2, sector: 'tech', currency: 'USD', country: 'us', assetClass: 'equity' },
    ]);
    expect(b.sector.tech).toBeCloseTo(0.5, 6);
    expect(b.currency.USD).toBeCloseTo(0.5, 6);
  });

  it('skips missing attributes so the dim stays below full coverage', () => {
    const b = holdingsToBreakdown([
      { weight: 0.5, currency: 'USD', country: 'us', assetClass: 'equity' }, // sector 欠落
      { weight: 0.5, currency: 'USD', sector: 'tech', assetClass: 'equity' }, // country 欠落
    ]);
    // sector は 0.5 分しか付与されない（残り 0.5 は computeRiskBreakdown で unknown 残差へ）
    expect(b.sector).toEqual({ tech: 0.5 });
    expect(b.country).toEqual({ us: 0.5 });
    expect(b.currency.USD).toBeCloseTo(1, 6);
  });

  it('ignores zero / negative / non-numeric weights and non-array input', () => {
    const b = holdingsToBreakdown([
      { weight: 0, sector: 'tech' },
      { weight: -0.2, sector: 'tech' },
      { weight: 'x', sector: 'tech' },
      { sector: 'tech' },
    ]);
    expect(b.sector).toEqual({});
    // 不正入力は空の Breakdown を返す
    expect(holdingsToBreakdown(null).sector).toEqual({});
    expect(holdingsToBreakdown(undefined).currency).toEqual({});
  });

  it('output feeds computeRiskBreakdown; residual coverage becomes the unknown slice', () => {
    // coverage 0.8 の holdings（残り 0.2 は属性不明）→ value 1000 で unknown 200
    const breakdown = holdingsToBreakdown([
      { weight: 0.8, currency: 'USD', country: 'us', sector: 'tech', assetClass: 'equity' },
      { weight: 0.2, /* 全属性欠落 = 不明分 */ },
    ]);
    // computeRiskBreakdown は CONSTITUENTS を引くので、変換結果を直接 entry にできるよう
    // toSlices で整合を確認（純粋な集計プロパティの検証）
    expect(breakdown.sector.tech).toBeCloseTo(0.8, 6);
    expect(Object.values(breakdown.currency).reduce((s, v) => s + v, 0)).toBeCloseTo(0.8, 6);
  });
});

// Phase 4b ―― クオンツ純関数テスト
// ══════════════════════════════════════════════════════════════

/** 合成価格系列ヘルパー（Date オブジェクト付き） */
function makeSeries(closes) {
  return closes.map((close, i) => ({
    date: new Date(2024, 0, i + 1), // 2024-01-01 から 1 日ずつ
    close,
  }));
}

describe('dailyReturns', () => {
  it('returns pairwise log-like simple returns for [100, 110, 99]', () => {
    const s = makeSeries([100, 110, 99]);
    const r = dailyReturns(s);
    expect(r).toHaveLength(2);
    expect(r[0].r).toBeCloseTo(0.1, 6); // 110/100 - 1
    expect(r[1].r).toBeCloseTo(-0.1, 6); // 99/110 - 1 ≈ -0.0909
  });

  it('returns [] for series with <2 elements', () => {
    expect(dailyReturns([])).toEqual([]);
    expect(dailyReturns(makeSeries([100]))).toEqual([]);
  });

  it('skips entries with non-positive close', () => {
    const s = [
      { date: new Date(2024, 0, 1), close: 100 },
      { date: new Date(2024, 0, 2), close: 0 }, // invalid
      { date: new Date(2024, 0, 3), close: 110 },
    ];
    const r = dailyReturns(s);
    // 100→0 は skip、0→110 も skip (prev.close=0 は >0 でない)
    expect(r).toHaveLength(0);
  });

  it('returns date objects on each entry', () => {
    const s = makeSeries([100, 120]);
    const r = dailyReturns(s);
    expect(r[0].date).toBeInstanceOf(Date);
  });
});

describe('stdev', () => {
  it('computes sample stdev of [2, 4, 4, 4, 5, 5, 7, 9] ≈ 2.138', () => {
    // textbook example — sample stdev = 2
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
  });

  it('returns 0 for arrays with <2 elements', () => {
    expect(stdev([])).toBe(0);
    expect(stdev([5])).toBe(0);
  });
});

describe('annualizedVol', () => {
  it('returns positive value for a non-constant return series', () => {
    const rets = dailyReturns(makeSeries([100, 110, 99, 105, 101])).map((x) => x.r);
    const vol = annualizedVol(rets);
    expect(vol).not.toBeNull();
    expect(/** @type {number} */ (vol)).toBeGreaterThan(0);
  });

  it('returns null for arrays with <2 elements', () => {
    expect(annualizedVol([])).toBeNull();
    expect(annualizedVol([0.01])).toBeNull();
  });
});

describe('maxDrawdown', () => {
  it('returns -0.5 for [100, 120, 60] (peak 120 → trough 60)', () => {
    const s = makeSeries([100, 120, 60]);
    expect(maxDrawdown(s)).toBeCloseTo(-0.5, 6);
  });

  it('returns 0 for a strictly rising series', () => {
    expect(maxDrawdown(makeSeries([100, 110, 120]))).toBe(0);
  });

  it('returns 0 for series with <2 elements', () => {
    expect(maxDrawdown([])).toBe(0);
    expect(maxDrawdown(makeSeries([100]))).toBe(0);
  });
});

describe('pearson', () => {
  it('returns 1 for two identical arrays', () => {
    const a = [1, 2, 3, 4, 5];
    expect(pearson(a, a)).toBeCloseTo(1, 6);
  });

  it('returns -1 for perfectly opposite arrays', () => {
    const a = [1, 2, 3, 4, 5];
    const b = [5, 4, 3, 2, 1];
    expect(pearson(a, b)).toBeCloseTo(-1, 6);
  });

  it('returns null for arrays with <2 elements', () => {
    expect(pearson([], [])).toBeNull();
    expect(pearson([1], [1])).toBeNull();
  });

  it('returns null for zero-variance arrays', () => {
    expect(pearson([3, 3, 3], [1, 2, 3])).toBeNull();
  });
});

describe('betaTo', () => {
  it('returns ~2 when ri = 2 * rref', () => {
    const rref = [0.01, -0.02, 0.03, -0.01, 0.02];
    const ri = rref.map((r) => 2 * r);
    expect(betaTo(ri, rref)).toBeCloseTo(2, 4);
  });

  it('returns null if var(rref) = 0', () => {
    expect(betaTo([1, 2, 3], [0, 0, 0])).toBeNull();
  });

  it('returns null for insufficient data', () => {
    expect(betaTo([0.01], [0.01])).toBeNull();
  });
});

describe('worstReturn', () => {
  it('returns the minimum daily return', () => {
    expect(worstReturn([0.01, -0.05, 0.02, -0.03])).toBeCloseTo(-0.05, 6);
  });

  it('returns null for empty array', () => {
    expect(worstReturn([])).toBeNull();
  });
});

describe('worstWindow', () => {
  it('returns minimum 3-day compounded return for simple series', () => {
    // [0, 0, -0.5]: only window is [-0.5] prod=(1)(1)(0.5)-1=-0.5
    const rets = [0, 0, -0.5];
    expect(worstWindow(rets, 3)).toBeCloseTo(-0.5, 6);
  });

  it('returns null if length < k', () => {
    expect(worstWindow([0.01, 0.02], 3)).toBeNull();
  });

  it('returns null for k=0', () => {
    expect(worstWindow([0.01, 0.02, 0.03], 0)).toBeNull();
  });

  it('finds the correct worst window among several candidates', () => {
    // [0.1, -0.2, 0.3, -0.4]
    // window k=2: [0.1,-0.2]→(1.1)(0.8)-1=-0.12, [-0.2,0.3]→(0.8)(1.3)-1=0.04, [0.3,-0.4]→(1.3)(0.6)-1=-0.22
    const rets = [0.1, -0.2, 0.3, -0.4];
    const worst = worstWindow(rets, 2);
    expect(worst).toBeCloseTo(1.3 * 0.6 - 1, 4);
  });
});

describe('alignReturnsByDate', () => {
  it('returns the intersection of dates when two syms have overlapping but non-identical date sets', () => {
    // symA: 2024-01-01..03 (returns on 02, 03)
    // symB: 2024-01-02..04 (returns on 03, 04)
    // intersection of return dates: only 2024-01-03
    // But we need >=2 common dates → expect empty
    const symA = makeSeries([100, 110, 120]); // dates: jan 1,2,3; returns dates: jan 2,3
    const symB = [
      { date: new Date(2024, 0, 2), close: 200 },
      { date: new Date(2024, 0, 3), close: 210 },
      { date: new Date(2024, 0, 4), close: 220 },
    ]; // returns dates: jan 3,4
    const result = alignReturnsByDate({ A: symA, B: symB });
    // only jan 3 is common → <2 → empty
    expect(result.dates).toHaveLength(0);
    expect(result.bySym).toEqual({});
  });

  it('returns aligned returns for two syms with >=2 common return dates', () => {
    // symA: jan1..5 → return dates jan2,3,4,5
    const symA = makeSeries([100, 110, 121, 133.1, 146.41]);
    // symB: jan1..5 same dates → return dates jan2,3,4,5
    const symB = makeSeries([200, 220, 242, 266.2, 292.82]);
    const result = alignReturnsByDate({ A: symA, B: symB });
    expect(result.dates).toHaveLength(4);
    expect(result.bySym.A).toHaveLength(4);
    expect(result.bySym.B).toHaveLength(4);
    // Each return in A should be 10/100 = 0.1
    for (const r of result.bySym.A) expect(r).toBeCloseTo(0.1, 6);
    // Each return in B should be 20/200 = 0.1
    for (const r of result.bySym.B) expect(r).toBeCloseTo(0.1, 6);
  });

  it('returns empty for non-overlapping date sets', () => {
    const symA = makeSeries([100, 110]); // returns on jan 2
    const symB = [
      { date: new Date(2024, 1, 1), close: 200 },
      { date: new Date(2024, 1, 2), close: 210 },
    ]; // returns on feb 2
    const result = alignReturnsByDate({ A: symA, B: symB });
    expect(result.dates).toHaveLength(0);
  });

  it('handles empty seriesMap gracefully', () => {
    expect(alignReturnsByDate({}).dates).toHaveLength(0);
    // @ts-ignore
    expect(alignReturnsByDate(null).dates).toHaveLength(0);
  });
});

describe('highCorrelationPairs', () => {
  it('returns a perfectly correlated pair (identical series) above threshold 0.85', () => {
    // Two identical return series → corr = 1.0
    const series = makeSeries([100, 110, 105, 120, 115]);
    const aligned = alignReturnsByDate({ X: series, Y: series });
    const pairs = highCorrelationPairs(aligned.bySym, 0.85);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].corr).toBeCloseTo(1, 4);
    // symbols order: one of {a:'X',b:'Y'} or {a:'Y',b:'X'}
    expect(new Set([pairs[0].a, pairs[0].b])).toEqual(new Set(['X', 'Y']));
  });

  it('returns empty array when no pair exceeds threshold', () => {
    // Opposite series → corr = -1 → below 0.85
    const A = makeSeries([100, 110, 105, 120, 115]);
    const B = makeSeries([100, 90, 95, 80, 85]);
    const aligned = alignReturnsByDate({ A, B });
    const pairs = highCorrelationPairs(aligned.bySym, 0.85);
    // Corr is negative or low → none should pass
    for (const p of pairs) expect(p.corr).toBeGreaterThanOrEqual(0.85);
  });

  it('handles empty or null bySym gracefully', () => {
    expect(highCorrelationPairs({}, 0.85)).toEqual([]);
    // @ts-ignore
    expect(highCorrelationPairs(null, 0.85)).toEqual([]);
  });
});

describe('computePortfolioReturns', () => {
  it('returns equal-weighted average of returns for two syms with equal weights', () => {
    const series1 = makeSeries([100, 110, 121]);
    const series2 = makeSeries([100, 90, 99]);
    const aligned = alignReturnsByDate({ A: series1, B: series2 });
    const port = computePortfolioReturns(aligned.bySym, { A: 1, B: 1 });
    expect(port).toHaveLength(2);
    // day1: 0.5 * 0.1 + 0.5 * (-0.1) = 0
    expect(port[0]).toBeCloseTo(0, 6);
    // day2: 0.5 * 0.1 + 0.5 * 0.1 = 0.1
    expect(port[1]).toBeCloseTo(0.1, 6);
  });

  it('normalizes weights so they sum to 1', () => {
    const series = makeSeries([100, 110, 121]);
    const aligned = alignReturnsByDate({ A: series, B: series });
    // weights 3:1 → same as 0.75:0.25 — but both identical so result = series return
    const port = computePortfolioReturns(aligned.bySym, { A: 3, B: 1 });
    expect(port[0]).toBeCloseTo(0.1, 6);
  });

  it('returns [] for empty or missing bySym', () => {
    expect(computePortfolioReturns({}, { A: 1 })).toEqual([]);
    // @ts-ignore
    expect(computePortfolioReturns(null, {})).toEqual([]);
  });
});
