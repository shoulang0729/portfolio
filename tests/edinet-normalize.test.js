import { describe, it, expect } from 'vitest';
import { normalizeEdinetFinancials, resolveEdinetCode } from '../src/edinet-normalize.js';

// ── フィクスチャ ────────────────────────────────────────────────
// 実際の EDINET DB レスポンス構造を模した最小フィクスチャ

/** ジャパンエンジンコーポレーション (6016.T / JP GAAP) — FY2024+2025 */
const JAPAN_ENGINE = {
  data: [
    {
      fiscal_year: 2024,
      accounting_standard: 'JP',
      revenue: 21_000_000_000,
      gross_profit: 5_920_000_000,
      operating_income: 2_190_000_000,
      ordinary_income: 2_250_000_000,
      net_income: 2_550_000_000,
      total_assets: 25_000_000_000,
      current_assets: 15_000_000_000,
      current_liabilities: 8_000_000_000,
      total_liabilities: 11_000_000_000,
      retained_earnings: 6_000_000_000,
      shareholders_equity: 14_000_000_000,
      cf_operating: 390_000_000,
      capex: 500_000_000,
      ibd_current: null,
      ibd_noncurrent: null,
      long_term_loans: 200_000_000,
      short_term_loans: 100_000_000,
      bonds_payable: null,
      interest_expenses: 16_000_000,
      shares_issued: 15_000_000,
      income_taxes: 800_000_000,
      profit_before_tax: 2_400_000_000,
    },
    {
      fiscal_year: 2025,
      accounting_standard: 'JP',
      revenue: 28_900_000_000,
      gross_profit: 8_230_000_000,
      operating_income: 5_090_000_000,
      ordinary_income: 5_120_000_000,
      net_income: 4_330_000_000,
      total_assets: 33_000_000_000,
      current_assets: 20_000_000_000,
      current_liabilities: 9_000_000_000,
      total_liabilities: 13_000_000_000,
      retained_earnings: 10_000_000_000,
      shareholders_equity: 20_000_000_000,
      cf_operating: 6_750_000_000,
      capex: 1_200_000_000,
      ibd_current: null,
      ibd_noncurrent: null,
      long_term_loans: 150_000_000,
      short_term_loans: 50_000_000,
      bonds_payable: null,
      interest_expenses: 23_000_000,
      shares_issued: 15_000_000,
      income_taxes: 1_300_000_000,
      profit_before_tax: 5_300_000_000,
    },
  ],
};

/** コマツ (6301.T / USGAAP) — gross_profit が異常値のパターン */
const KOMATSU_USGAAP = {
  data: [
    {
      fiscal_year: 2025,
      accounting_standard: 'USGAAP',
      revenue: 38_000_000_000_000,
      gross_profit: 30_000_000_000_000, // 79% → 異常値。null に変換されるべき
      operating_income: null,            // USGAAP は null になりやすい
      ordinary_income: 300_000_000_000,  // fallback として使う
      net_income: 350_000_000_000,
      total_assets: 60_000_000_000_000,
      current_assets: 6_000_000_000_000,
      current_liabilities: 4_000_000_000_000,
      total_liabilities: 25_000_000_000_000,
      retained_earnings: 7_000_000_000_000,
      shareholders_equity: 33_000_000_000_000,
      cf_operating: 4_000_000_000_000,
      capex: 1_800_000_000_000,
      ibd_current: null,
      ibd_noncurrent: null,
      long_term_loans: 500_000_000_000,
      interest_expenses: 30_000_000_000,
      shares_issued: 930_000_000,
      income_taxes: null,
      profit_before_tax: null,
    },
  ],
};

/** ファーストリテイリング (9983.T / IFRS) — ibd フィールド付きパターン */
const FAST_RETAILING_IFRS = {
  data: [
    {
      fiscal_year: 2024,
      accounting_standard: 'IFRS',
      revenue: 32_000_000_000_000,
      gross_profit: 17_000_000_000_000,
      operating_income: 5_100_000_000_000,
      ordinary_income: 4_800_000_000_000,
      net_income: 3_800_000_000_000,
      total_assets: 36_000_000_000_000,
      current_assets: 24_000_000_000_000,
      current_liabilities: 8_000_000_000_000,
      total_liabilities: 14_000_000_000_000,
      retained_earnings: 19_000_000_000_000,
      shareholders_equity: 21_000_000_000_000,
      cf_operating: 5_500_000_000_000,
      capex: 1_600_000_000_000,
      ibd_current: 100_000_000_000,
      ibd_noncurrent: 200_000_000_000,
      interest_expenses: 120_000_000_000,
      shares_issued: 320_000_000,
      income_taxes: 1_400_000_000_000,
      profit_before_tax: 5_800_000_000_000,
    },
    {
      fiscal_year: 2025,
      accounting_standard: 'IFRS',
      revenue: 34_000_000_000_000,
      gross_profit: 18_300_000_000_000,
      operating_income: 5_640_000_000_000,
      ordinary_income: 4_200_000_000_000,
      net_income: 4_330_000_000_000,
      total_assets: 38_600_000_000_000,
      current_assets: 25_300_000_000_000,
      current_liabilities: 9_100_000_000_000,
      total_liabilities: 15_900_000_000_000,
      retained_earnings: 20_600_000_000_000,
      shareholders_equity: 22_700_000_000_000,
      cf_operating: 5_800_000_000_000,
      capex: 1_700_000_000_000,
      ibd_current: null,
      ibd_noncurrent: null,
      interest_expenses: 128_000_000_000,
      shares_issued: 320_000_000,
      income_taxes: 1_600_000_000_000,
      profit_before_tax: 6_500_000_000_000,
    },
  ],
};

// ── テスト ────────────────────────────────────────────────────

describe('normalizeEdinetFinancials', () => {
  it('JP GAAP 企業: 基本フィールドが正しくマッピングされる', () => {
    const f = normalizeEdinetFinancials(JAPAN_ENGINE, { market: 'jp' });
    expect(f).not.toBeNull();
    expect(f.revenue).toBe(28_900_000_000);
    expect(f.grossProfit).toBe(8_230_000_000);
    expect(f.ebit).toBe(5_090_000_000); // operating_income が優先
    expect(f.netIncome).toBe(4_330_000_000);
    expect(f.totalAssets).toBe(33_000_000_000);
    expect(f.operatingCashFlow).toBe(6_750_000_000);
    expect(f.capex).toBe(1_200_000_000);
    expect(f.market).toBe('jp');
  });

  it('JP GAAP 企業: ibd がない場合 long_term_loans + short_term_loans で totalDebt を算出', () => {
    const f = normalizeEdinetFinancials(JAPAN_ENGINE, { market: 'jp' });
    // FY2025: long_term_loans=150M + short_term_loans=50M
    expect(f.totalDebt).toBe(200_000_000);
  });

  it('JP GAAP 企業: 前期データが prior に入る', () => {
    const f = normalizeEdinetFinancials(JAPAN_ENGINE, { market: 'jp' });
    expect(f.prior).not.toBeNull();
    expect(f.prior.netIncome).toBe(2_550_000_000);
    expect(f.prior.totalAssets).toBe(25_000_000_000);
    expect(f.prior.prior).toBeNull(); // 前期の前期は null
  });

  it('USGAAP 企業: gross_profit を null に変換する（異常値対応）', () => {
    const f = normalizeEdinetFinancials(KOMATSU_USGAAP, { market: 'jp' });
    expect(f).not.toBeNull();
    expect(f.grossProfit).toBeNull(); // USGAAP は信頼できないため null
  });

  it('USGAAP 企業: operating_income が null の場合 ordinary_income を EBIT として使う', () => {
    const f = normalizeEdinetFinancials(KOMATSU_USGAAP, { market: 'jp' });
    expect(f.ebit).toBe(300_000_000_000); // ordinary_income フォールバック
  });

  it('IFRS 企業: ibd_current + ibd_noncurrent で totalDebt を算出（FY2024 行）', () => {
    // FY2024 が current の場合（data が 1行だけ）
    const single = { data: [FAST_RETAILING_IFRS.data[0]] };
    const f = normalizeEdinetFinancials(single, { market: 'jp' });
    expect(f.totalDebt).toBe(100_000_000_000 + 200_000_000_000);
  });

  it('IFRS 企業: ibd が両方 null の場合 totalDebt は null', () => {
    const f = normalizeEdinetFinancials(FAST_RETAILING_IFRS, { market: 'jp' });
    // FY2025: ibd_current=null, ibd_noncurrent=null, long_term_loans=undefined
    expect(f.totalDebt).toBeNull();
  });

  it('marketCap オプションが Fundamentals に渡る', () => {
    const f = normalizeEdinetFinancials(JAPAN_ENGINE, { market: 'jp', marketCap: 50_000_000_000 });
    expect(f.marketCap).toBe(50_000_000_000);
  });

  it('data が空配列の場合 null を返す', () => {
    expect(normalizeEdinetFinancials({ data: [] })).toBeNull();
    expect(normalizeEdinetFinancials(null)).toBeNull();
    expect(normalizeEdinetFinancials({ data: null })).toBeNull();
  });

  it('data が 1行（前期なし）の場合 prior=null', () => {
    const f = normalizeEdinetFinancials({ data: [JAPAN_ENGINE.data[1]] }, { market: 'jp' });
    expect(f.prior).toBeNull();
  });

  it('interest_expenses（複数形）が interestExpense に正しくマッピングされる', () => {
    const f = normalizeEdinetFinancials(JAPAN_ENGINE, { market: 'jp' });
    expect(f.interestExpense).toBe(23_000_000);
  });
});

describe('resolveEdinetCode', () => {
  const searchFixture = {
    data: [
      { edinet_code: 'E26301', sec_code: '36600', listing_status: 'listed', name_ja: 'アイスタイル' },
      { edinet_code: 'E01532', sec_code: '63010', listing_status: 'listed', name_ja: '小松製作所' },
      { edinet_code: 'E03217', sec_code: '99830', listing_status: 'listed', name_ja: 'ファーストリテイリング' },
    ],
  };

  it('4桁証券コードから EDINETコードを解決する', () => {
    expect(resolveEdinetCode(searchFixture, '6301')).toBe('E01532');
    expect(resolveEdinetCode(searchFixture, '9983')).toBe('E03217');
  });

  it('存在しない証券コードは null', () => {
    expect(resolveEdinetCode(searchFixture, '9999')).toBeNull();
  });

  it('空レスポンスは null', () => {
    expect(resolveEdinetCode(null, '6301')).toBeNull();
    expect(resolveEdinetCode({ data: [] }, '6301')).toBeNull();
  });
});
