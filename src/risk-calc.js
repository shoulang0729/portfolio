// @ts-check
// ══════════════════════════════════════════════════════════════
// risk-calc.js  ―  look-through リスク断面の集計ロジック（DOM 非依存）
//
// positions × constituents（curated 分解）を掛け合わせ、4軸
// （資産クラス / 通貨 / 地域・国 / セクター）ごとにカテゴリ別の
// 円換算配分額とカバレッジ率を算出する。
// ══════════════════════════════════════════════════════════════

import { positions as defaultPositions } from './positions.js';
import { CONSTITUENTS } from './constituents.js';

/** 集計対象の4軸 */
export const RISK_DIMENSIONS = ['assetClass', 'currency', 'country', 'sector'];

/** 判明分で埋まらない残差を入れるカテゴリキー */
export const UNKNOWN_KEY = '__unknown__';

/**
 * curated エントリが無い銘柄のデフォルト属性を cat / cur から推定する。
 * @param {{cat?: string, cur?: string}} p
 * @returns {Record<string, Record<string, number>>}
 */
function deriveDefault(p) {
  const cur = p.cur === 'USD' ? 'USD' : 'JPY';
  let country = null;
  if (p.cat === '日本株・ETF') country = 'japan';
  else if (p.cat === '米国株・ETF') country = 'us';
  return {
    assetClass: { equity: 1 },
    currency: { [cur]: 1 },
    country: country ? { [country]: 1 } : {},
    sector: {}, // 不明 → 残差として その他 に入る
  };
}

/**
 * @typedef {Object} DimResult
 * @property {Record<string, number>} cats  カテゴリキー → 円換算配分額
 * @property {number} total  この軸の対象評価額合計
 * @property {number} known  判明分（カテゴリ付与済み）の合計額
 * @property {number} coverage  known / total（0..1）
 */

/**
 * ポートフォリオを look-through 分解し、軸ごとのカテゴリ別配分を集計する。
 * @param {Array<{symbol?: string, value?: number, cat?: string, cur?: string}>} [posList]
 * @returns {Record<string, DimResult>}
 */
export function computeRiskBreakdown(posList = defaultPositions) {
  /** @type {Record<string, DimResult>} */
  const result = {};
  for (const dim of RISK_DIMENSIONS) {
    result[dim] = { cats: {}, total: 0, known: 0, coverage: 0 };
  }

  for (const p of posList) {
    const value = p.value || 0;
    if (value <= 0) continue;
    const entry = (p.symbol && CONSTITUENTS[p.symbol]) || deriveDefault(p);

    for (const dim of RISK_DIMENSIONS) {
      const map = entry[dim] || {};
      const bucket = result[dim];
      let known = 0;
      for (const [cat, w] of Object.entries(map)) {
        if (!w) continue;
        const v = value * w;
        bucket.cats[cat] = (bucket.cats[cat] || 0) + v;
        known += v;
      }
      // 浮動小数の桁あふれを防ぐためクランプ
      if (known > value) known = value;
      const unknown = value - known;
      if (unknown > 1e-6) {
        bucket.cats[UNKNOWN_KEY] = (bucket.cats[UNKNOWN_KEY] || 0) + unknown;
      }
      bucket.total += value;
      bucket.known += known;
    }
  }

  for (const dim of RISK_DIMENSIONS) {
    const b = result[dim];
    b.coverage = b.total > 0 ? b.known / b.total : 0;
  }
  return result;
}

/**
 * DimResult を金額降順のスライス配列に変換する（__unknown__ は常に末尾）。
 * @param {DimResult} dimResult
 * @returns {Array<{key: string, value: number, pct: number}>}
 */
export function toSlices(dimResult) {
  const total = dimResult.total || 0;
  const entries = Object.entries(dimResult.cats).map(([key, value]) => ({
    key,
    value,
    pct: total > 0 ? (value / total) * 100 : 0,
  }));
  entries.sort((a, b) => {
    if (a.key === UNKNOWN_KEY) return 1;
    if (b.key === UNKNOWN_KEY) return -1;
    return b.value - a.value;
  });
  return entries;
}
