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
    const entry =
      live && Array.isArray(live.holdings) && live.holdings.length
        ? holdingsToBreakdown(live.holdings)
        : (p.symbol && CONSTITUENTS[p.symbol]) || deriveDefault(p);
    const name = p.name || p.symbol || '';

    for (const dim of RISK_DIMENSIONS) {
      // sector 次元のみ: liveTopHoldings に実データがあればそちらを優先する（entry は破壊しない）
      const liveSector = dim === 'sector' && p.symbol ? state.liveTopHoldings[p.symbol]?.sector : undefined;
      const map = liveSector !== undefined ? liveSector : entry[dim] || {};
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
        (bucket.contributors[UNKNOWN_KEY] || (bucket.contributors[UNKNOWN_KEY] = [])).push({
          symbol: p.symbol || '',
          name,
          value: unknown,
        });
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
  return list.map((c) => ({ ...c, pct: sum > 0 ? (c.value / sum) * 100 : 0 })).sort((a, b) => b.value - a.value);
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
    if (p.symbol && CONSTITUENTS[p.symbol]) {
      classified++;
      classifiedSymbols.push(sym);
    } else unclassifiedSymbols.push(sym);
  }
  return { total, classified, unclassified: total - classified, allSymbols, classifiedSymbols, unclassifiedSymbols };
}

/**
 * @typedef {Object} DimSource
 * @property {number} live       value 加重の live ソース割合（0..1）
 * @property {number} curated    value 加重の curated 割合（0..1）
 * @property {number} estimated  value 加重の既定推定割合（0..1）
 * @property {string|null} oldestAsOf  live 寄与のうち最も古い asOf（ISO・無ければ null）
 */

/**
 * 軸ごとのデータソース構成（live / curated / 推定）と live の最古鮮度を value 加重で集計する（#208）。
 * computeRiskBreakdown の entry 解決と同じ優先順位をミラーする:
 *   sector: liveTopHoldings > liveConstituents > curated > 既定推定
 *   other : liveConstituents > curated > 既定推定
 * @param {Array<{symbol?: string, value?: number}>} [posList]
 * @returns {Record<string, DimSource>}
 */
export function getSourceSummary(posList = defaultPositions) {
  /** @type {Record<string, {live: number, curated: number, estimated: number, total: number, oldestAsOf: string|null}>} */
  const acc = {};
  for (const dim of RISK_DIMENSIONS) acc[dim] = { live: 0, curated: 0, estimated: 0, total: 0, oldestAsOf: null };

  for (const p of posList) {
    const value = p.value || 0;
    if (value <= 0) continue;
    const sym = p.symbol;
    const liveConst = sym ? state.liveConstituents[sym] : null;
    const hasLiveConst = !!(liveConst && Array.isArray(liveConst.holdings) && liveConst.holdings.length);
    const hasCurated = !!(sym && CONSTITUENTS[sym]);

    for (const dim of RISK_DIMENSIONS) {
      const b = acc[dim];
      b.total += value;
      // sector 軸のみ liveTopHoldings の上書きを最優先
      const topHold = dim === 'sector' && sym ? state.liveTopHoldings[sym] : null;
      if (topHold) {
        b.live += value;
        b.oldestAsOf = _olderAsOf(b.oldestAsOf, topHold.asOf);
      } else if (hasLiveConst) {
        b.live += value;
        b.oldestAsOf = _olderAsOf(b.oldestAsOf, liveConst.asOf);
      } else if (hasCurated) {
        b.curated += value;
      } else {
        b.estimated += value;
      }
    }
  }

  /** @type {Record<string, DimSource>} */
  const out = {};
  for (const dim of RISK_DIMENSIONS) {
    const b = acc[dim];
    const t = b.total || 1;
    out[dim] = { live: b.live / t, curated: b.curated / t, estimated: b.estimated / t, oldestAsOf: b.oldestAsOf };
  }
  return out;
}

/** 2 つの ISO 日付のうち古い方を返す（無効/欠落は無視）。 */
function _olderAsOf(a, b) {
  if (!b) return a;
  if (!a) return b;
  return Date.parse(b) < Date.parse(a) ? b : a;
}

// ══════════════════════════════════════════════════════════════
// Phase 4b ―― クオンツ・リスク純関数群（DOM 非依存・ユニットテスト可）
// ══════════════════════════════════════════════════════════════

/**
 * 日次リターン系列を計算する。
 * @param {Array<{date: Date|string, close: number}>} series  昇順 close 系列
 * @returns {Array<{date: Date|string, r: number}>}  各営業日のリターン。要素数 <2 なら []。
 */
export function dailyReturns(series) {
  if (!Array.isArray(series) || series.length < 2) return [];
  /** @type {Array<{date: Date|string, r: number}>} */
  const out = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const cur = series[i];
    if (!(prev?.close > 0) || !(cur?.close > 0)) continue;
    const r = cur.close / prev.close - 1;
    if (!Number.isFinite(r)) continue;
    out.push({ date: cur.date, r });
  }
  return out;
}

/**
 * 標本標準偏差を返す。
 * @param {number[]} arr
 * @returns {number}
 */
export function stdev(arr) {
  if (!Array.isArray(arr) || arr.length < 2) return 0;
  const n = arr.length;
  const mean = arr.reduce((s, x) => s + x, 0) / n;
  const variance = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

/**
 * 年率ボラティリティ = stdev(daily returns) × √252。
 * @param {number[]} returnsArr  日次リターン数値の配列
 * @returns {number|null}  要素数 <2 なら null
 */
export function annualizedVol(returnsArr) {
  if (!Array.isArray(returnsArr) || returnsArr.length < 2) return null;
  return stdev(returnsArr) * Math.sqrt(252);
}

/**
 * 最大ドローダウン（最大峰-谷下落率、負の分数で返す）。
 * @param {Array<{date: Date, close: number}>} series  昇順 close 系列
 * @returns {number}  0 以下の負の値（系列 <2 なら 0）
 */
export function maxDrawdown(series) {
  if (!Array.isArray(series) || series.length < 2) return 0;
  let peak = -Infinity;
  let maxDD = 0;
  for (const pt of series) {
    const v = pt?.close;
    if (!(v > 0)) continue;
    if (v > peak) peak = v;
    const dd = v / peak - 1;
    if (dd < maxDD) maxDD = dd;
  }
  return maxDD;
}

/**
 * ピアソン相関係数（等長配列）。
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number|null}  要素数 <2 または分散 0 なら null
 */
export function pearson(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length < 2) return null;
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let cov = 0,
    va = 0,
    vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  if (va === 0 || vb === 0) return null;
  return cov / Math.sqrt(va * vb);
}

/**
 * 共分散（標本）。
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number|null}  要素数 <2 なら null
 */
export function covar(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length < 2) return null;
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let c = 0;
  for (let i = 0; i < n; i++) c += (a[i] - ma) * (b[i] - mb);
  return c / (n - 1);
}

/**
 * ベータ = cov(ri, rref) / var(rref)。
 * @param {number[]} ri    銘柄リターン
 * @param {number[]} rref  参照リターン
 * @returns {number|null}  var(rref) = 0 なら null
 */
export function betaTo(ri, rref) {
  const cv = covar(ri, rref);
  if (cv === null) return null;
  const cv2 = covar(rref, rref);
  if (cv2 === null || cv2 === 0) return null;
  return cv / cv2;
}

/**
 * 最悪日次リターン（最小値）。
 * @param {number[]} returnsArr
 * @returns {number|null}  空なら null
 */
export function worstReturn(returnsArr) {
  if (!Array.isArray(returnsArr) || returnsArr.length === 0) return null;
  return Math.min(...returnsArr);
}

/**
 * 長さ k ウィンドウ上の最悪複利リターン（prod(1+r)-1 の最小値）。
 * @param {number[]} returnsArr
 * @param {number} k  ウィンドウ幅（日数）
 * @returns {number|null}  length < k なら null
 */
export function worstWindow(returnsArr, k) {
  if (!Array.isArray(returnsArr) || returnsArr.length < k || k <= 0) return null;
  let worst = Infinity;
  for (let i = 0; i <= returnsArr.length - k; i++) {
    let compound = 1;
    for (let j = i; j < i + k; j++) compound *= 1 + returnsArr[j];
    const ret = compound - 1;
    if (ret < worst) worst = ret;
  }
  return worst === Infinity ? null : worst;
}

/**
 * 複数銘柄のリターン系列を日付の積集合でアライメントする。
 * @param {Record<string, Array<{date: Date, close: number}>>} seriesMap  sym → close 系列
 * @returns {{ dates: string[], bySym: Record<string, number[]> }}
 *   dates: 共通日付文字列（YYYY-MM-DD, 昇順）
 *   bySym: sym → 各日付のリターン配列（dates と 1:1 対応）
 */
export function alignReturnsByDate(seriesMap) {
  const empty = { dates: [], bySym: {} };
  if (!seriesMap || typeof seriesMap !== 'object') return empty;
  const syms = Object.keys(seriesMap);
  if (syms.length === 0) return empty;

  /** @type {Record<string, Record<string, number>>} sym → { dateStr: r } */
  const bySymDate = {};
  for (const sym of syms) {
    const rets = dailyReturns(seriesMap[sym]);
    bySymDate[sym] = {};
    for (const { date, r } of rets) {
      const ds = date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10);
      bySymDate[sym][ds] = r;
    }
  }

  // 積集合（全シンボルで共通の日付のみ）
  const allSets = syms.map((s) => new Set(Object.keys(bySymDate[s])));
  const commonDates = [...allSets[0]].filter((d) => allSets.every((set) => set.has(d)));
  commonDates.sort();

  if (commonDates.length < 2) return empty;

  /** @type {Record<string, number[]>} */
  const bySym = {};
  for (const sym of syms) {
    bySym[sym] = commonDates.map((d) => bySymDate[sym][d]);
  }
  return { dates: commonDates, bySym };
}

/**
 * 閾値以上の相関を持つすべての非順序ペアを相関降順で返す。
 * @param {Record<string, number[]>} alignedBySym  alignReturnsByDate の bySym
 * @param {number} [threshold=0.85]
 * @returns {Array<{a: string, b: string, corr: number}>}
 */
export function highCorrelationPairs(alignedBySym, threshold = 0.85) {
  if (!alignedBySym || typeof alignedBySym !== 'object') return [];
  const syms = Object.keys(alignedBySym);
  /** @type {Array<{a: string, b: string, corr: number}>} */
  const pairs = [];
  for (let i = 0; i < syms.length; i++) {
    for (let j = i + 1; j < syms.length; j++) {
      const corr = pearson(alignedBySym[syms[i]], alignedBySym[syms[j]]);
      if (corr !== null && corr >= threshold) {
        pairs.push({ a: syms[i], b: syms[j], corr });
      }
    }
  }
  pairs.sort((x, y) => y.corr - x.corr);
  return pairs;
}

/**
 * ポートフォリオ日次リターン系列を加重合計で生成する。
 * weights は自動正規化される（アライメント済みシンボルの分のみ）。
 * @param {Record<string, number[]>} alignedBySym
 * @param {Record<string, number>} weights  sym → ウェイト（正規化前）
 * @returns {number[]}
 */
export function computePortfolioReturns(alignedBySym, weights) {
  if (!alignedBySym || !weights) return [];
  const syms = Object.keys(alignedBySym).filter((s) => (weights[s] ?? 0) > 0);
  if (syms.length === 0) return [];
  const totalW = syms.reduce((s, sym) => s + weights[sym], 0);
  if (!(totalW > 0)) return [];
  const len = alignedBySym[syms[0]].length;
  if (len === 0) return [];
  const port = new Array(len).fill(0);
  for (const sym of syms) {
    const w = weights[sym] / totalW;
    const arr = alignedBySym[sym];
    for (let t = 0; t < len; t++) port[t] += w * arr[t];
  }
  return port;
}

/** Date|string → 'YYYY-MM-DD'。 */
function _dateStr(d) {
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}

/**
 * 名前付きイベント窓での現PFストレス（履歴 replay・what-if）。
 * 現ウェイト × 実履歴を [fromDate, toDate] で切って期間累積リターンを返す（D-1）。
 * 窓内に価格がある銘柄のみで採点し、ウェイトベースのカバレッジ%を併せて返す。
 *
 * 注: 既存 alignReturnsByDate は共通日付 >=2 を要求し短窓（DeepSeek 等の2営業日）で
 * 空になるため、本関数は窓内 >=1 リターン日で動く独自アライメント（積集合）を用いる。
 *
 * @param {Record<string, Array<{date: Date|string, close: number}>>} seriesMap  sym → 価格系列（保有限定・5y）
 * @param {Record<string, number>} weights  sym → ウェイト（正規化前・値ベース）。全保有を渡す（カバレッジ分母）。
 * @param {string} fromDate  窓の開始日（peak）
 * @param {string} toDate    窓の終了日（trough）
 * @returns {{ ret: number|null, coveragePct: number, missing: string[], usableFrom: string|null, usableTo: string|null }}
 */
export function eventStress(seriesMap, weights, fromDate, toDate) {
  const from = Date.parse(fromDate);
  const to = Date.parse(toDate);
  const empty = { ret: null, coveragePct: 0, missing: [], usableFrom: null, usableTo: null };
  if (!weights || Number.isNaN(from) || Number.isNaN(to) || from > to) return empty;

  /** @type {Record<string, Array<{date: Date|string, close: number}>>} 窓内系列 */
  const windowed = {};
  let totalW = 0;
  let coveredW = 0;
  /** @type {string[]} */
  const missing = [];

  for (const [sym, w] of Object.entries(weights)) {
    if (!(w > 0)) continue;
    totalW += w;
    const series = seriesMap && seriesMap[sym];
    const inWin = Array.isArray(series)
      ? series.filter((p) => {
          const t = p.date instanceof Date ? p.date.getTime() : Date.parse(p.date);
          return !Number.isNaN(t) && t >= from && t <= to;
        })
      : [];
    if (inWin.length >= 2) {
      windowed[sym] = inWin;
      coveredW += w;
    } else {
      missing.push(sym);
    }
  }

  const coveragePct = totalW > 0 ? (coveredW / totalW) * 100 : 0;
  const syms = Object.keys(windowed);
  if (syms.length === 0) return { ...empty, coveragePct, missing };

  // 窓内日次リターンを sym→{dateStr: r} に。共通日付（積集合）でアライン（>=1 日で可）。
  /** @type {Record<string, Record<string, number>>} */
  const bySymDate = {};
  for (const sym of syms) {
    bySymDate[sym] = {};
    for (const { date, r } of dailyReturns(windowed[sym])) bySymDate[sym][_dateStr(date)] = r;
  }
  const sets = syms.map((s) => new Set(Object.keys(bySymDate[s])));
  const commonDates = [...sets[0]].filter((d) => sets.every((set) => set.has(d))).sort();
  if (commonDates.length < 1) return { ...empty, coveragePct, missing };

  /** @type {Record<string, number[]>} */
  const alignedBySym = {};
  for (const sym of syms) alignedBySym[sym] = commonDates.map((d) => bySymDate[sym][d]);

  const port = computePortfolioReturns(alignedBySym, weights);
  if (port.length === 0) return { ...empty, coveragePct, missing };

  let compound = 1;
  for (const r of port) compound *= 1 + r;

  return {
    ret: compound - 1,
    coveragePct,
    missing,
    usableFrom: commonDates[0],
    usableTo: commonDates[commonDates.length - 1],
  };
}
