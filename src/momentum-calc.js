// @ts-check

// ══════════════════════════════════════════════════════════════
// momentum-calc.js ―― 価格モメンタムの純関数群（DOM 非依存・テスト可能）
//
// 履歴キャッシュ（getAllHistorical('1y') の {date, close} 系列）だけで
// 算出できる価格ベースの指標を提供する。追加フェッチ・外部データ不要。
// epsRev90d（業績改定）・rsVsSector（対セクター相対強さ）は外部データを
// 要するため対象外。
// ══════════════════════════════════════════════════════════════

/**
 * 昇順 close 配列を抽出する（close>0 のみ）。
 * @param {Array<{date: Date, close: number}>} series
 * @returns {number[]}
 */
function _closes(series) {
  if (!Array.isArray(series)) return [];
  return series.map((e) => e && e.close).filter((c) => typeof c === 'number' && c > 0);
}

/**
 * 1年騰落率（%）。系列の先頭→末尾の単純リターン。
 * @param {Array<{date: Date, close: number}>} series  昇順 close 系列（1y 想定）
 * @returns {number|null}  有効点 <2 なら null
 */
export function priceMom1Y(series) {
  const c = _closes(series);
  if (c.length < 2) return null;
  const first = c[0];
  const last = c[c.length - 1];
  if (!(first > 0)) return null;
  return (last / first - 1) * 100;
}

/**
 * 52週レンジ内の現在位置（%）。0%=年初来安値・100%=年初来高値。
 * @param {Array<{date: Date, close: number}>} series  昇順 close 系列（1y 想定）
 * @returns {number|null}  有効点 <2 または高安が同値なら null
 */
export function pos52w(series) {
  const c = _closes(series);
  if (c.length < 2) return null;
  const last = c[c.length - 1];
  let hi = -Infinity;
  let lo = Infinity;
  for (const v of c) {
    if (v > hi) hi = v;
    if (v < lo) lo = v;
  }
  if (!(hi > lo)) return null;
  return ((last - lo) / (hi - lo)) * 100;
}

/**
 * 相対強さ（Relative Strength）= 銘柄の1Y騰落率 − ベンチマークの1Y騰落率（%pt）。
 * ベンチに広域指数(ACWI等)を使えば「対市場」、セクターETFなら「対セクター」。
 * @param {Array<{date: Date, close: number}>} series       銘柄の昇順 close 系列
 * @param {Array<{date: Date, close: number}>} benchSeries  ベンチマークの昇順 close 系列
 * @returns {number|null}  どちらかが算出不能なら null
 */
export function relStrength(series, benchSeries) {
  const a = priceMom1Y(series);
  const b = priceMom1Y(benchSeries);
  if (a === null || b === null) return null;
  return a - b;
}

/**
 * 履歴系列から価格モメンタムをまとめて算出する。
 * @param {Array<{date: Date, close: number}>} series
 * @returns {{ priceMom1Y: number|null, pos52w: number|null }|null}  算出不能なら null
 */
export function computePriceMomentum(series) {
  const m1y = priceMom1Y(series);
  const p52 = pos52w(series);
  if (m1y === null && p52 === null) return null;
  return { priceMom1Y: m1y, pos52w: p52 };
}
