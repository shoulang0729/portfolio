// Tests for SEC EDGAR companyfacts → Fundamentals normalization (src/edgar-normalize.js)

import { describe, it, expect } from 'vitest';
import { normalizeEdgarFacts } from '../src/edgar-normalize.js';
import { computeQuality } from '../src/quality-calc.js';

// 合成 companyfacts。要点を突いた最小データ:
//  - fy トラップ: 全 us-gaap 行を fy=2025/fp=FY/form=10-K にし、年度識別は end 日付で行わせる
//  - 残高(instant)は start 無し / フロー(duration)は start 有り
//  - 四半期フロー（90日）を混ぜ、通期(約365日)だけ拾うことを検証
//  - 同一期末の改訂行（filed 違い）で「新しい filed が勝つ」ことを検証
function row(end, val, { start, filed = '2025-11-01' } = {}) {
  const r = { end, val, fy: 2025, fp: 'FY', form: '10-K', filed };
  if (start) r.start = start;
  return r;
}

function fixture() {
  const usd = (rows) => ({ units: { USD: rows } });
  const usdPerShare = (rows) => ({ units: { 'USD/shares': rows } });
  const shares = (rows) => ({ units: { shares: rows } });
  return {
    facts: {
      'us-gaap': {
        // フロー（通期 + ノイズの四半期）
        NetIncomeLoss: usd([
          row('2024-12-31', 80, { start: '2024-01-01' }),
          row('2025-12-31', 100, { start: '2025-01-01' }),
          row('2025-03-31', 25, { start: '2025-01-01' }), // 四半期 → 除外
        ]),
        NetCashProvidedByUsedInOperatingActivities: usd([
          row('2024-12-31', 110, { start: '2024-01-01' }),
          row('2025-12-31', 150, { start: '2025-01-01' }),
        ]),
        RevenueFromContractWithCustomerExcludingAssessedTax: usd([
          row('2024-12-31', 700, { start: '2024-01-01' }),
          row('2025-12-31', 800, { start: '2025-01-01' }),
        ]),
        GrossProfit: usd([
          row('2024-12-31', 315, { start: '2024-01-01' }), // 45%
          row('2025-12-31', 400, { start: '2025-01-01' }), // 50% → 改善
        ]),
        OperatingIncomeLoss: usd([
          row('2024-12-31', 150, { start: '2024-01-01' }),
          row('2025-12-31', 200, { start: '2025-01-01' }),
        ]),
        InterestExpense: usd([
          row('2025-12-31', 20, { start: '2025-01-01' }),
        ]),
        PaymentsToAcquirePropertyPlantAndEquipment: usd([
          row('2025-12-31', 30, { start: '2025-01-01' }),
        ]),
        IncomeTaxExpenseBenefit: usd([row('2025-12-31', 40, { start: '2025-01-01' })]),
        IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest: usd([
          row('2025-12-31', 160, { start: '2025-01-01' }),
        ]),
        // 残高（instant）— 改訂行で latest filed が勝つことも検証
        Assets: usd([
          row('2024-12-31', 1000),
          row('2025-12-31', 999, { filed: '2025-11-01' }),
          row('2025-12-31', 1100, { filed: '2026-02-01' }), // 新しい filed → 1100 採用
        ]),
        AssetsCurrent: usd([row('2024-12-31', 300), row('2025-12-31', 400)]),
        Liabilities: usd([row('2024-12-31', 500), row('2025-12-31', 500)]),
        LiabilitiesCurrent: usd([row('2024-12-31', 200), row('2025-12-31', 200)]),
        LongTermDebtNoncurrent: usd([row('2024-12-31', 150), row('2025-12-31', 100)]), // 低下
        RetainedEarningsAccumulatedDeficit: usd([row('2024-12-31', 250), row('2025-12-31', 300)]),
        StockholdersEquity: usd([row('2024-12-31', 400), row('2025-12-31', 500)]),
        WeightedAverageNumberOfDilutedSharesOutstanding: shares([
          row('2024-12-31', 1000, { start: '2024-01-01' }),
          row('2025-12-31', 1000, { start: '2025-01-01' }), // 増資なし
        ]),
        _unusedPerShare: usdPerShare([]),
      },
    },
  };
}

describe('normalizeEdgarFacts', () => {
  it('selects values by period-end date, not by fy tag', () => {
    const fin = normalizeEdgarFacts(fixture(), { market: 'us' });
    expect(fin._fyeEnd).toBe('2025-12-31');
    expect(fin.netIncome).toBe(100); // 当期
    expect(fin.prior.netIncome).toBe(80); // 前期（end で識別）
    expect(fin.totalAssets).toBe(1100); // 改訂後（新しい filed）
    expect(fin.prior.totalAssets).toBe(1000);
  });

  it('excludes non-annual (quarterly) flow rows', () => {
    const fin = normalizeEdgarFacts(fixture(), { market: 'us' });
    // 四半期の 25 は無視され当期 netIncome は通期 100
    expect(fin.netIncome).toBe(100);
  });

  it('derives effective tax rate from tax / pretax', () => {
    const fin = normalizeEdgarFacts(fixture(), { market: 'us' });
    expect(fin.taxRate).toBeCloseTo(40 / 160, 6); // 0.25
  });

  it('falls back to revenue - costOfRevenue when GrossProfit is absent', () => {
    const fx = fixture();
    delete fx.facts['us-gaap'].GrossProfit;
    fx.facts['us-gaap'].CostOfGoodsAndServicesSold = {
      units: { USD: [row('2025-12-31', 500, { start: '2025-01-01' })] },
    };
    const fin = normalizeEdgarFacts(fx, { market: 'us' });
    expect(fin.grossProfit).toBe(300); // 800 - 500
  });

  it('feeds computeQuality to a coherent block (qScore === fScore)', () => {
    const fin = normalizeEdgarFacts(fixture(), { market: 'us', marketCap: 5000 });
    const q = computeQuality(fin);
    expect(q.qScore).toBe(q.fScore);
    expect(q.intCoverage).toBeCloseTo(10, 6); // ebit200 / interest20
    expect(q.altmanZ).not.toBeNull(); // marketCap 指定で算出可能
    expect(q.wacc).toBe(8);
    // 教科書的改善企業 → 高 F-Score
    expect(q.fScore).toBeGreaterThanOrEqual(7);
  });

  it('returns null on malformed input', () => {
    expect(normalizeEdgarFacts(null)).toBeNull();
    expect(normalizeEdgarFacts({})).toBeNull();
    expect(normalizeEdgarFacts({ facts: {} })).toBeNull();
  });
});
