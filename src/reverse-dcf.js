// @ts-check

// ══════════════════════════════════════════════════════════════
// reverse-dcf.js ―― リバースDCF（1段 Gordon）純関数（D-5 / A6）
//
// 「いまの株価＋FCF利回りに、市場が織り込んでいる長期FCF成長率」を逆算する。
// Gordon 成長モデル: P = FCF₀(1+g) / (r − g)
//   ⇒ fcfYield = FCF₀/P = (r − g)/(1 + g)
//   ⇒ g = (r − fcfYield) / (1 + fcfYield)
// r = WACC（米8% / 日6%・確定済）。入力は valuations.json の格納単位＝%。
//
// 1段Gordon は粗い近似（永久一定成長を仮定）。表示は「市場が織り込む長期FCF
// 成長率 ~X%」＋低確度の注記前提。2段DCF精緻化は次フェーズ（スコープ外）。
// ══════════════════════════════════════════════════════════════

/**
 * 「期待過多」と見なす織り込み成長率の閾値（%）。
 * 目安＝名目GDP+α。これを超える永久FCF成長は実現困難＝株価が成長を過剰に織り込む。
 * 暫定値（調整可）。Mulmo 設計で妥当域を別途確定する場合は差し替える。
 */
export const IMPLIED_GROWTH_OVERHEAT_PCT = 7;

/** 有限数値か。 */
function num(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

/**
 * 市場が織り込む長期FCF成長率（%）を 1段 Gordon で逆算する。
 * fcfYieldPct・waccPct は % で受け、結果も % で返す。素材欠損は null。
 * @param {number|null|undefined} fcfYieldPct  FCF利回り（%）
 * @param {number|null|undefined} waccPct      WACC（%）
 * @returns {number|null}  織り込み成長率（%）
 */
export function impliedGrowth(fcfYieldPct, waccPct) {
  if (!num(fcfYieldPct) || !num(waccPct)) return null;
  const fy = fcfYieldPct / 100;
  const r = waccPct / 100;
  const denom = 1 + fy;
  if (denom === 0) return null;
  return ((r - fy) / denom) * 100;
}

/**
 * 織り込み成長率が「期待過多」域か（閾値超）。
 * @param {number|null|undefined} igPct  impliedGrowth() の結果（%）
 * @returns {boolean}
 */
export function isGrowthOverheated(igPct) {
  return num(igPct) && igPct > IMPLIED_GROWTH_OVERHEAT_PCT;
}
