// @ts-check

// ══════════════════════════════════════════════════════════════
// edinet-normalize.js ―― EDINET DB /v1/companies/{code}/financials → 正規化 Fundamentals（純関数）
//
// EDINET DB API（edinetdb.jp）の年次財務 JSON を入力に、
// quality-calc.js が消費できる Fundamentals 型（当期＋前期）に変換する。
// ネットワークには触れない＝取得はバッチ側の責務。
//
// EDINET DB は構造化済み JSON（各行 = 1会計年度）を返すため、
// EDGAR の XBRL fact 抽出よりはるかに単純な変換で済む。
//
// ⚠ USGAAP 企業（例: コマツ）の注意点:
//   - `gross_profit` が売上の 80% 前後になる異常値が観測されている（USGAAP→JP GAAP のマッピング問題）。
//     accounting_standard === 'USGAAP' の場合は grossProfit を null として扱う。
//   - `operating_income`（営業利益）が null になりやすい。その場合 `ordinary_income`（経常利益）を
//     EBIT の代替として使用する（経常利益は営業利益＋営業外損益なので過大推計になりうる点に留意）。
// ══════════════════════════════════════════════════════════════

/**
 * EDINET DB /v1/companies/{code}/financials の 1行（1会計年度）。
 * 金額は円単位。比率は小数（EDINET DB の仕様）。
 * @typedef {{
 *   fiscal_year?: number,
 *   accounting_standard?: string,
 *   revenue?: number|null,
 *   gross_profit?: number|null,
 *   operating_income?: number|null,
 *   ordinary_income?: number|null,
 *   profit_before_tax?: number|null,
 *   net_income?: number|null,
 *   total_assets?: number|null,
 *   current_assets?: number|null,
 *   current_liabilities?: number|null,
 *   total_liabilities?: number|null,
 *   retained_earnings?: number|null,
 *   shareholders_equity?: number|null,
 *   net_assets?: number|null,
 *   cf_operating?: number|null,
 *   capex?: number|null,
 *   ibd_current?: number|null,
 *   ibd_noncurrent?: number|null,
 *   long_term_loans?: number|null,
 *   short_term_loans?: number|null,
 *   bonds_payable?: number|null,
 *   interest_expenses?: number|null,
 *   shares_issued?: number|null,
 *   income_taxes?: number|null,
 * }} EdinetFinancialRow
 */

/**
 * EDINET DB API レスポンス（/v1/companies/{code}/financials）の最上位オブジェクト。
 * @typedef {{ data: EdinetFinancialRow[], meta?: object }} EdinetFinancialsResponse
 */

/** 数値が有限か。 */
function num(x) {
  return typeof x === 'number' && Number.isFinite(x) && !Number.isNaN(x);
}

/**
 * EdinetFinancialRow を Fundamentals（quality-calc.js 入力型）に変換する。
 * @param {EdinetFinancialRow} row  1会計年度の行
 * @param {EdinetFinancialRow|null} [priorRow]  前期の行（F-Score の前年比シグナル用）
 * @param {{ market?: string, marketCap?: number|null }} [opts]
 * @returns {import('./quality-calc.js').Fundamentals}
 */
function rowToFundamentals(row, priorRow, opts = {}) {
  const isUsgaap = row.accounting_standard === 'USGAAP';

  // EBIT: operating_income（営業利益）優先。USGAAP では null になりやすいため ordinary_income で代替。
  const ebit = num(row.operating_income)
    ? row.operating_income
    : num(row.ordinary_income)
      ? row.ordinary_income
      : null;

  // gross_profit: USGAAP 企業では EDINET DB のマッピングが不正確（異常に高い値）→ null。
  const grossProfit = isUsgaap ? null : (num(row.gross_profit) ? row.gross_profit : null);

  // 自己資本: shareholders_equity 優先、なければ net_assets（純資産≒自己資本 for 単体）。
  const totalEquity = num(row.shareholders_equity)
    ? row.shareholders_equity
    : num(row.net_assets)
      ? row.net_assets
      : null;

  // 有利子負債合計: ibd_current + ibd_noncurrent が最も正確。
  // 無ければ long_term_loans + short_term_loans + bonds_payable で代替。
  let totalDebt = null;
  if (num(row.ibd_current) || num(row.ibd_noncurrent)) {
    totalDebt = (num(row.ibd_current) ? row.ibd_current : 0) +
                (num(row.ibd_noncurrent) ? row.ibd_noncurrent : 0);
  } else if (num(row.long_term_loans) || num(row.short_term_loans) || num(row.bonds_payable)) {
    totalDebt = (num(row.long_term_loans) ? row.long_term_loans : 0) +
                (num(row.short_term_loans) ? row.short_term_loans : 0) +
                (num(row.bonds_payable) ? row.bonds_payable : 0);
  }

  // 実効税率（NOPAT 経由の ROIC 計算用）
  const taxRate = (() => {
    const tax = num(row.income_taxes) ? row.income_taxes : null;
    const pre = num(row.profit_before_tax) ? row.profit_before_tax
      : num(row.ordinary_income) ? row.ordinary_income : null;
    if (tax != null && pre != null && pre !== 0) return tax / pre;
    return null;
  })();

  /** @type {import('./quality-calc.js').Fundamentals} */
  const result = {
    netIncome: num(row.net_income) ? row.net_income : null,
    operatingCashFlow: num(row.cf_operating) ? row.cf_operating : null,
    capex: num(row.capex) ? row.capex : null, // 正値（支出額）。quality-calc が Math.abs で吸収。
    revenue: num(row.revenue) ? row.revenue : null,
    grossProfit,
    ebit,
    interestExpense: num(row.interest_expenses) ? row.interest_expenses : null,
    totalAssets: num(row.total_assets) ? row.total_assets : null,
    currentAssets: num(row.current_assets) ? row.current_assets : null,
    currentLiabilities: num(row.current_liabilities) ? row.current_liabilities : null,
    totalLiabilities: num(row.total_liabilities) ? row.total_liabilities : null,
    longTermDebt: num(row.long_term_loans) ? row.long_term_loans : null,
    totalDebt,
    retainedEarnings: num(row.retained_earnings) ? row.retained_earnings : null,
    totalEquity,
    sharesOutstanding: num(row.shares_issued) ? row.shares_issued : null,
    market: opts.market ?? 'jp',
    marketCap: opts.marketCap ?? null,
    roicDirect: null, // EDINET DB には直接 ROIC 値がない → quality-calc が NOPAT/投下資本で計算
    taxRate,
    prior: priorRow ? rowToFundamentals(priorRow, null, { market: opts.market }) : null,
  };

  return result;
}

/**
 * EDINET DB /v1/companies/{code}/financials レスポンスを Fundamentals に正規化する。
 *
 * `data` 配列の最後の要素を当期、その1つ前を前期として使用する。
 * 前期データが無い場合（上場直後等）は prior=null。
 *
 * @param {EdinetFinancialsResponse} response  EDINET DB financials API レスポンス
 * @param {{ market?: string, marketCap?: number|null }} [opts]
 * @returns {import('./quality-calc.js').Fundamentals | null}
 */
export function normalizeEdinetFinancials(response, opts = {}) {
  if (!response || !Array.isArray(response.data) || response.data.length === 0) return null;

  const rows = response.data;
  const cur = rows[rows.length - 1];
  const prior = rows.length >= 2 ? rows[rows.length - 2] : null;

  if (!cur) return null;

  return rowToFundamentals(cur, prior, opts);
}

/**
 * EDINET DB /v1/search?q={ticker} レスポンスから EDINETコードを解決する。
 *
 * @param {object} searchResponse  /v1/search レスポンス
 * @param {string} ticker4  4桁証券コード（例: "6301"）
 * @returns {string|null}  edinet_code（例: "E01532"）
 */
export function resolveEdinetCode(searchResponse, ticker4) {
  if (!searchResponse || !Array.isArray(searchResponse.data)) return null;
  const sec5 = `${ticker4}0`; // 5桁 sec_code 変換
  // sec_code が完全一致する最初の企業を返す
  const match = searchResponse.data.find(
    (c) => c.sec_code === sec5 && c.listing_status === 'listed',
  );
  return match ? match.edinet_code : null;
}
