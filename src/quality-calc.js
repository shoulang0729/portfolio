// @ts-check

// ══════════════════════════════════════════════════════════════
// quality-calc.js ―― ファンダ品質指標の純関数群（DOM 非依存・テスト可能）
//
// FMP / SEC EDGAR / EDINET DB など取得元を問わず、**正規化済みの生財務**
// （Fundamentals 型）を入力に、valuations.json の `quality` ブロックを算出する。
// 取得（fetch）は呼び出し側（data/scheduler の日次バッチ）の責務で、本モジュールは
// 一切ネットワークに触れない＝純粋計算のみ。これにより CI で完全にテストできる。
//
// 算出する指標（QualityBlock）:
//   roic        投下資本利益率 %（直接値があれば優先、無ければ NOPAT/投下資本）
//   wacc        加重平均資本コスト %（取得不可なら市場既定値＝米株8% / 日本株6%）
//   grossProf   粗利 ÷ 総資産（Novy-Marx グロス収益性・小数）
//   fcfConv     FCF ÷ 純利益（FCF変換率・小数）
//   fScore      Piotroski F-Score 0〜9（整数・前年比に2期分を要する）
//   altmanZ     Altman Z-Score（製造業向け原式・5項目）
//   intCoverage 営業利益(EBIT) ÷ 支払利息
//   qScore      0〜9 合成。**確定仕様: qScore = fScore**（既存手動シード9銘柄と完全一致）
// ══════════════════════════════════════════════════════════════

/**
 * 1期分の正規化済み財務スナップショット。各値は欠損可（null/undefined）。
 * @typedef {{
 *   netIncome?: number|null,           // 純利益
 *   operatingCashFlow?: number|null,   // 営業キャッシュフロー
 *   freeCashFlow?: number|null,        // フリーCF（無ければ ocf - capex で代用）
 *   capex?: number|null,               // 設備投資（正負どちらの符号でも吸収）
 *   revenue?: number|null,             // 売上高
 *   grossProfit?: number|null,         // 粗利
 *   ebit?: number|null,                // 営業利益（EBIT / operatingIncome）
 *   interestExpense?: number|null,     // 支払利息
 *   totalAssets?: number|null,         // 総資産
 *   currentAssets?: number|null,       // 流動資産
 *   currentLiabilities?: number|null,  // 流動負債
 *   totalLiabilities?: number|null,    // 総負債
 *   longTermDebt?: number|null,        // 長期有利子負債
 *   totalDebt?: number|null,           // 有利子負債合計
 *   retainedEarnings?: number|null,    // 利益剰余金
 *   totalEquity?: number|null,         // 自己資本
 *   sharesOutstanding?: number|null,   // 発行済株式数
 * }} FinPeriod
 */

/**
 * 当期＋前期（YoY 用）＋市場値をまとめた正規化入力。
 * @typedef {FinPeriod & {
 *   prior?: FinPeriod|null,        // 前期（F-Score の前年比に使用）
 *   marketCap?: number|null,       // 時価総額（Altman X4 に使用）
 *   roicDirect?: number|null,      // 直接ROIC（FMP key-metrics の roic は小数なので ×100 済みの%で渡す）
 *   taxRate?: number|null,         // 実効税率（小数。NOPAT 自前計算時に使用。無ければ0.25想定）
 *   market?: 'us'|'jp'|string,     // 市場（WACC 既定値の選択に使用）
 * }} Fundamentals
 */

/** 有限数値か */
function num(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

/** a/b を安全に割る（b が 0 / 非数なら null） */
function safeDiv(a, b) {
  if (!num(a) || !num(b) || b === 0) return null;
  return a / b;
}

/** 市場別の WACC 既定値（%）。米株8% / 日本株6%（既存シード踏襲）。 */
export function defaultWacc(market) {
  if (market === 'jp') return 6;
  return 8; // us / その他
}

/**
 * ROIC（%）。直接値（roicDirect, 既に%）があれば優先。
 * 無ければ NOPAT / 投下資本 = EBIT×(1−税率) / (有利子負債 + 自己資本) × 100。
 * @param {Fundamentals} f
 * @returns {number|null}
 */
export function roic(f) {
  if (!f) return null;
  if (num(f.roicDirect)) return f.roicDirect;
  const debt = num(f.totalDebt) ? f.totalDebt : f.longTermDebt;
  const invested = (num(debt) ? debt : 0) + (num(f.totalEquity) ? f.totalEquity : 0);
  const tax = num(f.taxRate) ? Math.min(Math.max(f.taxRate, 0), 0.6) : 0.25;
  if (!num(f.ebit) || !(invested > 0)) return null;
  const nopat = f.ebit * (1 - tax);
  return (nopat / invested) * 100;
}

/**
 * 粗利 ÷ 総資産（Novy-Marx グロス収益性・小数）。
 * @param {Fundamentals|FinPeriod} f
 * @returns {number|null}
 */
export function grossProf(f) {
  return safeDiv(f && f.grossProfit, f && f.totalAssets);
}

/**
 * FCF変換率 = FCF ÷ 純利益（小数）。FCF は freeCashFlow 優先、無ければ ocf − |capex|。
 * @param {Fundamentals|FinPeriod} f
 * @returns {number|null}
 */
export function fcfConv(f) {
  if (!f) return null;
  let fcf = num(f.freeCashFlow) ? f.freeCashFlow : null;
  if (fcf === null && num(f.operatingCashFlow)) {
    // capex は FMP では負、EDGAR では正で来うる → 絶対値で投資控除に統一
    const capex = num(f.capex) ? Math.abs(f.capex) : 0;
    fcf = f.operatingCashFlow - capex;
  }
  return safeDiv(fcf, f.netIncome);
}

/**
 * インタレストカバレッジ = EBIT ÷ 支払利息。利息が極小/欠損なら null。
 * @param {Fundamentals|FinPeriod} f
 * @returns {number|null}
 */
export function intCoverage(f) {
  if (!f || !num(f.ebit)) return null;
  const ie = num(f.interestExpense) ? Math.abs(f.interestExpense) : null;
  if (ie === null || ie < 1) return null; // 実質無借金 → 比率は意味を成さない
  return f.ebit / ie;
}

/**
 * Altman Z-Score（製造業向け原式・5項目すべて必要）。
 * Z = 1.2·X1 + 1.4·X2 + 3.3·X3 + 0.6·X4 + 1.0·X5
 *   X1 = 運転資本/総資産, X2 = 利益剰余金/総資産, X3 = EBIT/総資産,
 *   X4 = 時価総額/総負債, X5 = 売上/総資産
 * いずれかの素材が欠ける場合は null（部分計算は誤解を招くため返さない）。
 * @param {Fundamentals} f
 * @returns {number|null}
 */
export function altmanZ(f) {
  if (!f || !num(f.totalAssets) || f.totalAssets <= 0) return null;
  const ta = f.totalAssets;
  if (!num(f.currentAssets) || !num(f.currentLiabilities)) return null;
  if (!num(f.retainedEarnings)) return null;
  if (!num(f.ebit)) return null;
  if (!num(f.marketCap) || !num(f.totalLiabilities) || f.totalLiabilities <= 0) return null;
  if (!num(f.revenue)) return null;
  const x1 = (f.currentAssets - f.currentLiabilities) / ta;
  const x2 = f.retainedEarnings / ta;
  const x3 = f.ebit / ta;
  const x4 = f.marketCap / f.totalLiabilities;
  const x5 = f.revenue / ta;
  return 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5;
}

/**
 * Piotroski F-Score（0〜9）。前年比シグナルは prior が無いと加点されない。
 * 各シグナルは素材が揃ったもののみ評価（欠損は0点扱い＝標準慣行）。
 * 当期の中核（netIncome・totalAssets・operatingCashFlow）が全欠損なら null。
 * @param {Fundamentals} f
 * @returns {number|null}
 */
export function piotroskiF(f) {
  if (!f) return null;
  const p = f.prior || null;
  const hasCore = num(f.netIncome) || num(f.operatingCashFlow) || num(f.totalAssets);
  if (!hasCore) return null;

  let score = 0;
  // ── 収益性（4）──
  const roa = safeDiv(f.netIncome, f.totalAssets);
  if (roa !== null && roa > 0) score += 1; // 1. ROA>0
  if (num(f.operatingCashFlow) && f.operatingCashFlow > 0) score += 1; // 2. 営業CF>0
  const roaPrior = p ? safeDiv(p.netIncome, p.totalAssets) : null;
  if (roa !== null && roaPrior !== null && roa > roaPrior) score += 1; // 3. ROA改善
  if (num(f.operatingCashFlow) && num(f.netIncome) && f.operatingCashFlow > f.netIncome) score += 1; // 4. CF>純利益（質）

  // ── 財務健全性（3）──
  const lev = safeDiv(num(f.longTermDebt) ? f.longTermDebt : f.totalDebt, f.totalAssets);
  const levPrior = p ? safeDiv(num(p.longTermDebt) ? p.longTermDebt : p.totalDebt, p.totalAssets) : null;
  if (lev !== null && levPrior !== null && lev < levPrior) score += 1; // 5. レバレッジ低下
  const cr = safeDiv(f.currentAssets, f.currentLiabilities);
  const crPrior = p ? safeDiv(p.currentAssets, p.currentLiabilities) : null;
  if (cr !== null && crPrior !== null && cr > crPrior) score += 1; // 6. 流動比率改善
  if (p && num(f.sharesOutstanding) && num(p.sharesOutstanding) && f.sharesOutstanding <= p.sharesOutstanding * 1.001)
    score += 1; // 7. 新株発行なし（0.1%の許容）

  // ── 効率性（2）──
  const gm = safeDiv(f.grossProfit, f.revenue);
  const gmPrior = p ? safeDiv(p.grossProfit, p.revenue) : null;
  if (gm !== null && gmPrior !== null && gm > gmPrior) score += 1; // 8. 粗利率改善
  const at = safeDiv(f.revenue, f.totalAssets);
  const atPrior = p ? safeDiv(p.revenue, p.totalAssets) : null;
  if (at !== null && atPrior !== null && at > atPrior) score += 1; // 9. 総資産回転率改善

  return score;
}

/** 0〜9 に丸めてクリップ（整数）。 */
function clip09(x) {
  if (!num(x)) return null;
  return Math.max(0, Math.min(9, Math.round(x)));
}

/**
 * 合成 qScore（0〜9）。**確定仕様: qScore = fScore**。
 * 既存の手動シード9銘柄（AAPL/MSFT/6301.T 等）の qScore は全て fScore と一致するため、
 * §5 のペナルティ案ではなく単純一致を採用（2026-06-20 ユーザー確定）。
 * @param {number|null} fScore
 * @returns {number|null}
 */
export function qScoreFrom(fScore) {
  return clip09(fScore);
}

/**
 * 正規化済み財務から quality ブロックを算出する。各値は欠損時 null。
 * @param {Fundamentals} f
 * @param {{ wacc?: number|null }} [opts]  wacc を明示指定（無ければ market から既定値）
 * @returns {{ roic: number|null, wacc: number|null, grossProf: number|null,
 *             fcfConv: number|null, fScore: number|null, altmanZ: number|null,
 *             intCoverage: number|null, qScore: number|null }}
 */
export function computeQuality(f, opts = {}) {
  const fScore = piotroskiF(f);
  const r = roic(f);
  const wacc = num(opts.wacc) ? opts.wacc : defaultWacc(f && f.market);
  const round = (x, d) => (num(x) ? +x.toFixed(d) : null);
  return {
    roic: round(r, 1),
    wacc: num(wacc) ? +(+wacc).toFixed(1) : null,
    grossProf: round(grossProf(f), 2),
    fcfConv: round(fcfConv(f), 2),
    fScore: fScore,
    altmanZ: round(altmanZ(f), 2),
    intCoverage: round(intCoverage(f), 1),
    qScore: qScoreFrom(fScore),
  };
}
