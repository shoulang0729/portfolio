// Tests for fundamental quality pure functions in src/quality-calc.js

import { describe, it, expect } from 'vitest';
import {
  defaultWacc,
  roic,
  grossProf,
  fcfConv,
  intCoverage,
  altmanZ,
  piotroskiF,
  qScoreFrom,
  computeQuality,
} from '../src/quality-calc.js';

describe('defaultWacc', () => {
  it('returns 6 for jp, 8 otherwise', () => {
    expect(defaultWacc('jp')).toBe(6);
    expect(defaultWacc('us')).toBe(8);
    expect(defaultWacc('hk')).toBe(8);
    expect(defaultWacc(undefined)).toBe(8);
  });
});

describe('roic', () => {
  it('prefers the direct value (already in %)', () => {
    expect(roic({ roicDirect: 27.2, ebit: 1, totalDebt: 1, totalEquity: 1 })).toBe(27.2);
  });

  it('computes NOPAT / invested capital when no direct value', () => {
    // ebit=100, tax=0.25 → NOPAT=75; invested = debt 200 + equity 300 = 500 → 15%
    expect(roic({ ebit: 100, taxRate: 0.25, totalDebt: 200, totalEquity: 300 })).toBeCloseTo(15, 6);
  });

  it('falls back to longTermDebt when totalDebt missing, default tax 0.25', () => {
    // NOPAT = 200*0.75 = 150; invested = 100 + 400 = 500 → 30%
    expect(roic({ ebit: 200, longTermDebt: 100, totalEquity: 400 })).toBeCloseTo(30, 6);
  });

  it('returns null without ebit or invested capital', () => {
    expect(roic({ totalDebt: 100, totalEquity: 100 })).toBeNull();
    expect(roic({ ebit: 100 })).toBeNull();
    expect(roic(null)).toBeNull();
  });
});

describe('grossProf', () => {
  it('is grossProfit / totalAssets', () => {
    expect(grossProf({ grossProfit: 50, totalAssets: 250 })).toBeCloseTo(0.2, 6);
  });
  it('null on missing or zero assets', () => {
    expect(grossProf({ grossProfit: 50, totalAssets: 0 })).toBeNull();
    expect(grossProf({ totalAssets: 250 })).toBeNull();
  });
});

describe('fcfConv', () => {
  it('uses freeCashFlow / netIncome when present', () => {
    expect(fcfConv({ freeCashFlow: 68, netIncome: 100 })).toBeCloseTo(0.68, 6);
  });
  it('derives FCF = ocf - |capex| when freeCashFlow missing (capex sign agnostic)', () => {
    expect(fcfConv({ operatingCashFlow: 120, capex: -20, netIncome: 100 })).toBeCloseTo(1.0, 6);
    expect(fcfConv({ operatingCashFlow: 120, capex: 20, netIncome: 100 })).toBeCloseTo(1.0, 6);
  });
  it('null on missing netIncome', () => {
    expect(fcfConv({ freeCashFlow: 68 })).toBeNull();
  });
  it('null when netIncome <= 0 (ratio undefined for loss-makers)', () => {
    expect(fcfConv({ freeCashFlow: 50, netIncome: -10 })).toBeNull();
    expect(fcfConv({ freeCashFlow: 50, netIncome: 0 })).toBeNull();
  });
});

describe('intCoverage', () => {
  it('is EBIT / |interestExpense|', () => {
    expect(intCoverage({ ebit: 106, interestExpense: 10 })).toBeCloseTo(10.6, 6);
    expect(intCoverage({ ebit: 106, interestExpense: -10 })).toBeCloseTo(10.6, 6);
  });
  it('null when effectively debt-free (interest < 1) or missing', () => {
    expect(intCoverage({ ebit: 106, interestExpense: 0 })).toBeNull();
    expect(intCoverage({ ebit: 106 })).toBeNull();
    expect(intCoverage({ interestExpense: 10 })).toBeNull();
  });
});

describe('altmanZ', () => {
  it('computes the original 5-factor Z', () => {
    // X1=(300-100)/1000=0.2, X2=200/1000=0.2, X3=150/1000=0.15,
    // X4=2000/500=4, X5=900/1000=0.9
    // Z = 1.2*.2 + 1.4*.2 + 3.3*.15 + 0.6*4 + 1.0*.9 = .24+.28+.495+2.4+.9 = 4.315
    const z = altmanZ({
      totalAssets: 1000,
      currentAssets: 300,
      currentLiabilities: 100,
      retainedEarnings: 200,
      ebit: 150,
      marketCap: 2000,
      totalLiabilities: 500,
      revenue: 900,
    });
    expect(z).toBeCloseTo(4.315, 4);
  });
  it('returns null when any of the five inputs is missing', () => {
    const base = {
      totalAssets: 1000,
      currentAssets: 300,
      currentLiabilities: 100,
      retainedEarnings: 200,
      ebit: 150,
      marketCap: 2000,
      totalLiabilities: 500,
      revenue: 900,
    };
    for (const k of ['totalAssets', 'currentAssets', 'retainedEarnings', 'ebit', 'marketCap', 'revenue']) {
      const f = { ...base };
      delete f[k];
      expect(altmanZ(f)).toBeNull();
    }
  });
});

describe('piotroskiF', () => {
  // 9点満点となる教科書的な改善企業
  const strong = {
    netIncome: 100,
    operatingCashFlow: 150,
    totalAssets: 1000,
    longTermDebt: 100,
    currentAssets: 400,
    currentLiabilities: 200,
    revenue: 800,
    grossProfit: 400,
    sharesOutstanding: 1000,
    prior: {
      netIncome: 50, // ROA 5% → 当期10%（改善）
      totalAssets: 1000,
      longTermDebt: 150, // レバレッジ低下
      currentAssets: 300,
      currentLiabilities: 200, // 流動比率 1.5→2.0 改善
      revenue: 700, // 回転率 0.7→0.8 改善
      grossProfit: 315, // 粗利率 45%→50% 改善
      sharesOutstanding: 1000, // 増資なし
    },
  };

  it('awards the full 9 for a textbook improving firm', () => {
    expect(piotroskiF(strong)).toBe(9);
  });

  it('without prior, YoY signals do not score (max 4: ROA>0, CF>0, CF>NI, ...)', () => {
    const noPrior = { ...strong, prior: null };
    // 加点されるのは: ROA>0, CF>0, CF>NI の3つ（前年比5つは prior 無しで0）
    expect(piotroskiF(noPrior)).toBe(3);
  });

  it('returns null when all core current inputs are missing', () => {
    expect(piotroskiF({ revenue: 100, grossProfit: 50 })).toBeNull();
    expect(piotroskiF(null)).toBeNull();
  });

  it('penalizes new share issuance (no point for signal 7)', () => {
    const diluted = { ...strong, sharesOutstanding: 1100 };
    expect(piotroskiF(diluted)).toBe(8);
  });
});

describe('qScoreFrom', () => {
  it('equals fScore, clipped to 0..9', () => {
    expect(qScoreFrom(5)).toBe(5);
    expect(qScoreFrom(0)).toBe(0);
    expect(qScoreFrom(9)).toBe(9);
    expect(qScoreFrom(12)).toBe(9);
    expect(qScoreFrom(-3)).toBe(0);
    expect(qScoreFrom(null)).toBeNull();
  });
});

describe('computeQuality', () => {
  it('produces a full quality block and qScore === fScore', () => {
    const f = {
      market: 'us',
      roicDirect: 27.2,
      grossProfit: 310,
      totalAssets: 1000,
      freeCashFlow: 58,
      netIncome: 100,
      ebit: 200,
      interestExpense: 20,
      currentAssets: 400,
      currentLiabilities: 200,
      retainedEarnings: 300,
      marketCap: 5000,
      totalLiabilities: 500,
      revenue: 900,
      sharesOutstanding: 1000,
      prior: {
        netIncome: 80,
        totalAssets: 1000,
        currentAssets: 350,
        currentLiabilities: 200,
        revenue: 850,
        grossProfit: 280,
        longTermDebt: 200,
        sharesOutstanding: 1000,
      },
      longTermDebt: 150,
      operatingCashFlow: 120,
    };
    const q = computeQuality(f);
    expect(q.roic).toBe(27.2);
    expect(q.wacc).toBe(8); // us default
    expect(q.grossProf).toBeCloseTo(0.31, 6);
    expect(q.fcfConv).toBeCloseTo(0.58, 6);
    expect(q.intCoverage).toBeCloseTo(10, 6);
    expect(typeof q.fScore).toBe('number');
    expect(q.qScore).toBe(q.fScore); // 確定仕様: qScore == fScore
  });

  it('uses jp default wacc (6) and honors explicit wacc override', () => {
    expect(computeQuality({ market: 'jp', netIncome: 1, totalAssets: 1 }).wacc).toBe(6);
    expect(computeQuality({ market: 'jp', netIncome: 1, totalAssets: 1 }, { wacc: 7.5 }).wacc).toBe(7.5);
  });

  it('returns nulls gracefully on an empty input', () => {
    const q = computeQuality({ market: 'us' });
    expect(q.roic).toBeNull();
    expect(q.fScore).toBeNull();
    expect(q.qScore).toBeNull();
    expect(q.altmanZ).toBeNull();
    expect(q.wacc).toBe(8); // 既定値は常に出す
  });
});
