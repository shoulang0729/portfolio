// @ts-check
// kv-sync.mjs — KV ウォッチリストと正本 valuations.json の比較・マージ（純関数）。
// 原本 docs/handoff/assets/2026-10-03-phase15/kv-resync.mjs の挙動をそのまま関数化したもの。
// 比較キー（perCurrent / status / asOf）は投資判断の正本に関わるため変更しない（#652 §11）。

/**
 * valuation の比較キー（原本の norm）。
 * @param {any} v
 * @returns {string}
 */
export const normValuation = (v) => (v ? `${v.perCurrent}/${v.status}/${v.asOf}` : 'null');

/**
 * KV 要素のうち、正本に存在し valuation が正本と違う銘柄のシンボル一覧（KV の並び順）。
 * 正本に無い銘柄は対象外（据え置き）。
 * @param {Array<any>} kvArray
 * @param {Record<string, any>} valuations
 * @returns {string[]}
 */
export function findDrift(kvArray, valuations) {
  const drift = [];
  for (const el of kvArray) {
    const s = el.symbol;
    const want = valuations[s];
    if (!want) continue; // 正本に無い銘柄は据え置き対象
    if (normValuation(el.valuation) !== normValuation(want)) drift.push(s);
  }
  return drift;
}

/**
 * 配列形状を保持し、正本にある銘柄だけ valuation を正本で差し替える。
 * 他フィールド（name 等）と正本に無い銘柄の要素はそのまま。
 * @param {Array<any>} kvArray
 * @param {Record<string, any>} valuations
 * @returns {Array<any>}
 */
export function mergeValuations(kvArray, valuations) {
  return kvArray.map((el) => {
    const want = valuations[el.symbol];
    return want ? { ...el, valuation: want } : el;
  });
}
