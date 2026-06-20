// @ts-check

// ══════════════════════════════════════════════════════════════
// liquidity-calc.js ―― 流動性（出口日数）の純関数群（DOM 非依存・テスト可能）
//
// 履歴キャッシュの日次出来高（vol）と保有株数だけで「保有を捌くのに
// 何営業日かかるか」を概算する。価格・通貨を介さない（株数ベース）ので
// 為替の影響を受けない。
//
// 既定パラメータ（呼び出し側で上書き可・要見直し）:
//   ADV_WINDOW       = 20   直近20営業日（≒1ヶ月）平均出来高
//   PARTICIPATION    = 0.20 1日に市場の出来高の20%まで捌ける前提
//   ILLIQUID_DAYS    = 5    出口に5営業日(=1週間)超かかる保有を警告
// ══════════════════════════════════════════════════════════════

export const ADV_WINDOW = 20;
export const PARTICIPATION = 0.2;
export const ILLIQUID_DAYS = 5;

/**
 * 直近 window 営業日の平均出来高（ADV: Average Daily Volume）。
 * @param {Array<{date: Date, close: number, vol?: number}>} series  昇順系列
 * @param {number} [window]
 * @returns {number|null}  有効な出来高が無ければ null
 */
export function adv(series, window = ADV_WINDOW) {
  if (!Array.isArray(series) || series.length === 0) return null;
  const vols = series
    .map((e) => (e && typeof e.vol === 'number' ? e.vol : null))
    .filter((v) => v != null && isFinite(v) && v > 0);
  if (vols.length === 0) return null;
  const recent = vols.slice(-window);
  const sum = recent.reduce((s, v) => s + v, 0);
  return sum / recent.length;
}

/**
 * 出口日数 = 保有株数 ÷ (ADV × 参加率)。
 * @param {number} shares       保有株数
 * @param {number|null} advVal  ADV（株/日）
 * @param {number} [participation]
 * @returns {number|null}  ADV 不明・株数<=0 なら null
 */
export function exitDays(shares, advVal, participation = PARTICIPATION) {
  if (!(shares > 0)) return null;
  if (advVal == null || !(advVal > 0)) return null;
  const perDay = advVal * participation;
  if (!(perDay > 0)) return null;
  return shares / perDay;
}

/**
 * 保有リストの流動性を一括評価し、出口日数の降順（捌きにくい順）で返す。
 * @param {Array<{sym: string, shares: number, series: Array<{date: Date, close: number, vol?: number}>}>} holdings
 * @param {{ window?: number, participation?: number }} [opts]
 * @returns {Array<{sym: string, advVal: number|null, days: number|null}>}
 */
export function computeLiquidity(holdings, opts = {}) {
  const window = opts.window ?? ADV_WINDOW;
  const participation = opts.participation ?? PARTICIPATION;
  if (!Array.isArray(holdings)) return [];
  const out = holdings.map((h) => {
    const advVal = adv(h.series, window);
    const days = exitDays(h.shares, advVal, participation);
    return { sym: h.sym, advVal, days };
  });
  // days 降順（null は末尾）
  out.sort((a, b) => {
    if (a.days == null && b.days == null) return 0;
    if (a.days == null) return 1;
    if (b.days == null) return -1;
    return b.days - a.days;
  });
  return out;
}
