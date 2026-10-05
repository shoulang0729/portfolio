// @ts-check
// kv-sync.mjs — KV ウォッチリストと正本 valuations.json の比較・マージ（純関数）。
// 原本 docs/handoff/assets/2026-10-03-phase15/kv-resync.mjs の挙動をそのまま関数化したもの。
// 比較キーは #647・Toshio 承認（2026-10-05）で全項目比較に変更（旧: perCurrent / status / asOf の 3 項目・#652 §11）。
//   valuation オブジェクト全体を、キー順に依存せず比較する（配列の順序は意味を持つので並べ替えない）。
// Worker（worker/src/routes-kv.js）からも import するため、Node 専用の import（fs・path 等）を入れない。

/**
 * オブジェクトのキーを再帰的に昇順へ並べた値を返す（配列の順序はそのまま）。
 * @param {any} v
 * @returns {any}
 */
function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    /** @type {Record<string, any>} */
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k]);
    return out;
  }
  return v;
}

/**
 * valuation の比較キー。null/undefined は 'null'、それ以外はキーを再帰的に昇順に並べた JSON 文字列。
 * @param {any} v
 * @returns {string}
 */
export const normValuation = (v) => (v == null ? 'null' : JSON.stringify(sortKeysDeep(v)));

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
