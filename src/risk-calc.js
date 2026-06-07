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
import { state } from './state.js';

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
 * @typedef {Object} NormalizedHolding
 * @property {string} [ticker]
 * @property {string} [name]
 * @property {number} weight  0..1（Σ ≒ coverage）
 * @property {string} [currency]   通貨カテゴリキー（JPY / USD / ...）
 * @property {string} [country]    地域・国カテゴリキー（japan / us / ...）
 * @property {string} [sector]     セクターカテゴリキー（tech / financials / ...）
 * @property {string} [assetClass] 資産クラスカテゴリキー（equity / bond / ...）
 */

/**
 * 正規化 holdings リスト（Level 2・ライブ構成銘柄）を、curated と同じ
 * summary 形式 Breakdown（軸 → カテゴリ別ウェイトマップ）に畳み込む。
 *
 * 各 holding の weight を、その holding が持つ各軸の属性カテゴリへ加算する。
 * 属性が欠落している軸はスキップされ、その分はウェイト合計 < 1 として残り、
 * computeRiskBreakdown 側で「その他/不明」残差に回る（正直なカバレッジ表示）。
 *
 * 出力は computeRiskBreakdown の entry としてそのまま渡せる（live は holdings、
 * curated は summary、という両対応の入口になる・#206）。
 *
 * @param {Array<NormalizedHolding>} holdings
 * @returns {Record<string, Record<string, number>>}  軸 → {カテゴリ: ウェイト合計}
 */
export function holdingsToBreakdown(holdings) {
  /** @type {Record<string, Record<string, number>>} */
  const dims = {};
  for (const dim of RISK_DIMENSIONS) dims[dim] = {};
  if (!Array.isArray(holdings)) return dims;

  for (const h of holdings) {
    const w = h?.weight;
    if (!(typeof w === 'number') || !(w > 0)) continue;
    for (const dim of RISK_DIMENSIONS) {
      const cat = h[dim];
      if (cat == null || cat === '') continue; // 不明属性 → カバレッジ未満の残差に回す
      dims[dim][cat] = (dims[dim][cat] || 0) + w;
    }
  }
  return dims;
}

/**
 * @typedef {Object} DimResult
 * @property {Record<string, number>} cats  カテゴリキー → 円換算配分額
 * @property {Record<string, Array<{symbol: string, name: string, value: number}>>} contributors  カテゴリキー → 寄与銘柄リスト
 * @property {number} total  この軸の対象評価額合計
 * @property {number} known  判明分（カテゴリ付与済み）の合計額
 * @property {number} coverage  known / total（0..1）
 */

/**
 * ポートフォリオを look-through 分解し、軸ごとのカテゴリ別配分を集計する。
 * @param {Array<{symbol?: string, name?: string, value?: number, cat?: string, cur?: string}>} [posList]
 * @returns {Record<string, DimResult>}
 */
export function computeRiskBreakdown(posList = defaultPositions) {
  /** @type {Record<string, DimResult>} */
  const result = {};
  for (const dim of RISK_DIMENSIONS) {
    result[dim] = { cats: {}, contributors: {}, total: 0, known: 0, coverage: 0 };
  }

  for (const p of posList) {
    const value = p.value || 0;
    if (value <= 0) continue;
    // データソースの優先順位: live（holdings）> curated（CONSTITUENTS）> 既定推定（#207）
    const live = p.symbol ? state.liveConstituents[p.symbol] : null;
    const entry = (live && Array.isArray(live.holdings) && live.holdings.length)
      ? holdingsToBreakdown(live.holdings)
      : ((p.symbol && CONSTITUENTS[p.symbol]) || deriveDefault(p));
    const name = p.name || p.symbol || '';

    for (const dim of RISK_DIMENSIONS) {
      // sector 次元のみ: liveTopHoldings に実データがあればそちらを優先する（entry は破壊しない）
      const liveSector = (dim === 'sector' && p.symbol)
        ? state.liveTopHoldings[p.symbol]?.sector
        : undefined;
      const map = liveSector !== undefined ? liveSector : (entry[dim] || {});
      const bucket = result[dim];
      let known = 0;
      for (const [cat, w] of Object.entries(map)) {
        if (!w) continue;
        const v = value * w;
        bucket.cats[cat] = (bucket.cats[cat] || 0) + v;
        (bucket.contributors[cat] || (bucket.contributors[cat] = [])).push({ symbol: p.symbol || '', name, value: v });
        known += v;
      }
      // 浮動小数の桁あふれを防ぐためクランプ
      if (known > value) known = value;
      const unknown = value - known;
      if (unknown > 1e-6) {
        bucket.cats[UNKNOWN_KEY] = (bucket.cats[UNKNOWN_KEY] || 0) + unknown;
        (bucket.contributors[UNKNOWN_KEY] || (bucket.contributors[UNKNOWN_KEY] = [])).push({ symbol: p.symbol || '', name, value: unknown });
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

/**
 * あるカテゴリに寄与した銘柄を、カテゴリ内シェア降順で返す。
 * @param {DimResult} dimResult
 * @param {string} categoryKey
 * @returns {Array<{symbol: string, name: string, value: number, pct: number}>}
 */
export function getContributors(dimResult, categoryKey) {
  const list = (dimResult.contributors && dimResult.contributors[categoryKey]) || [];
  const sum = list.reduce((s, c) => s + c.value, 0);
  return list
    .map(c => ({ ...c, pct: sum > 0 ? (c.value / sum) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
}

/**
 * 銘柄の分類状況サマリー（#217）。CONSTITUENTS にエントリがあれば分類済み。
 * @param {Array<{symbol?: string, value?: number}>} [posList]
 * @returns {{total: number, classified: number, unclassified: number, allSymbols: string[], classifiedSymbols: string[], unclassifiedSymbols: string[]}}
 */
export function getClassificationSummary(posList = defaultPositions) {
  let total = 0;
  let classified = 0;
  const allSymbols = [];
  const classifiedSymbols = [];
  const unclassifiedSymbols = [];
  for (const p of posList) {
    if ((p.value || 0) <= 0) continue;
    total++;
    const sym = p.symbol || '';
    allSymbols.push(sym);
    if (p.symbol && CONSTITUENTS[p.symbol]) { classified++; classifiedSymbols.push(sym); }
    else unclassifiedSymbols.push(sym);
  }
  return { total, classified, unclassified: total - classified, allSymbols, classifiedSymbols, unclassifiedSymbols };
}
