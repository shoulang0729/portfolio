// @ts-check

// ══════════════════════════════════════════════════════════════
// valuations.js  ―  PER採点（ヒストリカルPER%タイル）の単一ストア
//
// data/valuations.json（symbol→valuation）を読み、保有テーブル（Historical
// Heatmap）とウォッチリストの両方が**同じ採点**を参照する。保有∪ウォッチを
// 和集合で1回だけ採点する設計＝重複計算なし。アプリは表示するだけ（ライブ計算しない）。
//
// valuation 形: { perCurrent, bandLow, bandHigh, bandMedian?, percentile,
//                 status: 'cheap'|'fair'|'rich'|'hold', asOf, note? }
//   ※ 債券・コモディティ・赤字NM等で PER 非該当の銘柄は本ストアに含めない
//     （= getValuation が null → セルは「–」表示）。
//
// Phase 0 拡張: value/quality/momentum/verdict ブロックを追加（採点の深化）。
// ══════════════════════════════════════════════════════════════

/**
 * @typedef {{
 *   perTrail?: number|null,
 *   perFwd?: number|null,
 *   peg?: number|null,
 *   evEbitda?: number|null,
 *   fcfYield?: number|null,
 *   shareholderYield?: number|null,
 *   targetGapPct?: number|null,
 *   reverseDcfGrowth?: number|null,
 *   debtHeavy?: boolean,
 *   cyclical?: boolean
 * }} ValueBlock
 */

/**
 * @typedef {{
 *   roic?: number|null,
 *   wacc?: number|null,
 *   grossProf?: number|null,
 *   fcfConv?: number|null,
 *   fScore?: number|null,
 *   altmanZ?: number|null,
 *   intCoverage?: number|null,
 *   qScore?: number|null
 * }} QualityBlock
 */

/**
 * @typedef {{
 *   epsRev90d?: number|null,
 *   priceMom12_1?: number|null,
 *   pos52w?: number|null,
 *   rsVsSector?: number|null
 * }} MomentumBlock
 */

/**
 * @typedef {{
 *   class: 'cheap_real'|'cheap_fake'|'fair'|'rich_fake'|'rich_real'|'trap'|'na',
 *   label: string,
 *   drivers: string[]
 * }} Verdict
 */

import { escapeHTML } from './utils.js';

const VAL_URL = 'data/valuations.json';

/** @type {Record<string, any>} */
let _vals = {};
let _loaded = false;

export const VAL_STATUS = {
  cheap: { icon: '🟢', label: '割安' },
  fair: { icon: '🟡', label: '中立' },
  rich: { icon: '🔴', label: '割高' },
  hold: { icon: '⚪', label: '保留' },
};

/** data/valuations.json を読み込む（失敗時は空＝全銘柄「–」） */
export async function loadValuations() {
  try {
    const r = await fetch(`${VAL_URL}?_=${Date.now()}`);
    if (!r.ok) throw new Error(`val ${r.status}`);
    const j = await r.json();
    _vals = (j && j.valuations) || {};
    _loaded = true;
  } catch {
    _vals = {};
  }
  return _vals;
}

/**
 * 銘柄シンボル（ySymbol）の採点を返す。無ければ null。
 * @param {string|undefined|null} ySymbol
 * @returns {any|null}
 */
export function getValuation(ySymbol) {
  return ySymbol ? _vals[ySymbol] || null : null;
}

/**
 * ソート用の%タイル（無ければ null）。
 * @param {string|undefined|null} ySymbol
 * @returns {number|null}
 */
export function valuationPercentile(ySymbol) {
  const v = getValuation(ySymbol);
  return v && v.percentile != null && isFinite(v.percentile) ? v.percentile : null;
}

export function valuationsLoaded() {
  return _loaded;
}

/** @type {Record<string, string>} */
const VERDICT_LABELS = {
  cheap_real: '本物の割安',
  cheap_fake: '見せかけの割安(フェア)',
  fair: '中立',
  rich_fake: '見せかけの割高(売るな)',
  rich_real: '本物の割高',
  trap: '罠',
  na: '—',
};

/**
 * バリュエーションオブジェクトから割安/割高の"正体"を判定する純粋関数。
 *
 * @param {{ percentile?: number|null, value?: ValueBlock }} v - バリュエーションオブジェクト
 * @returns {Verdict}
 */
export function computeVerdict(v) {
  const pct = v != null && v.percentile != null ? v.percentile : null;

  // null percentile → na
  if (pct == null) {
    return { class: 'na', label: VERDICT_LABELS['na'], drivers: [] };
  }

  const val = (v && v.value) || {};

  // cyclical → na (PERによる採点対象外)
  if (val.cyclical === true) {
    return { class: 'na', label: 'シクリカル(別物差し)', drivers: ['cyclical'] };
  }

  const t = val.perTrail != null ? val.perTrail : null;
  const f = val.perFwd != null ? val.perFwd : null;
  const peg = val.peg != null ? val.peg : null;
  const debtHeavy = !!val.debtHeavy;

  // direction
  const rising = t != null && f != null && f <= t * 0.9;
  const falling = t != null && f != null && f >= t * 1.05;

  // zone
  const zone = pct <= 30 ? 'cheap' : pct >= 70 ? 'rich' : 'mid';

  if (zone === 'cheap') {
    if (falling) {
      return { class: 'trap', label: VERDICT_LABELS['trap'], drivers: ['fwd≫trail', '一過性/減益'] };
    }
    if (f != null && f > 40) {
      return {
        class: 'rich_fake',
        label: VERDICT_LABELS['rich_fake'],
        drivers: ['%タイルのアヤ', '絶対値高・追わない'],
      };
    }
    if (debtHeavy) {
      return { class: 'cheap_fake', label: VERDICT_LABELS['cheap_fake'], drivers: ['負債/簿外でEV割高', 'フェア'] };
    }
    return { class: 'cheap_real', label: VERDICT_LABELS['cheap_real'], drivers: ['fwd<trail/負債軽', '本物の割安'] };
  }

  if (zone === 'rich') {
    if (falling) {
      return { class: 'trap', label: VERDICT_LABELS['trap'], drivers: ['一過性益でfake-cheap'] };
    }
    if (rising && peg != null && peg < 2) {
      return {
        class: 'rich_fake',
        label: VERDICT_LABELS['rich_fake'],
        drivers: ['利益爆発で割高は見せかけ', '売るな'],
      };
    }
    return { class: 'rich_real', label: VERDICT_LABELS['rich_real'], drivers: ['成長で正当化されない高値'] };
  }

  // mid
  return { class: 'fair', label: VERDICT_LABELS['fair'], drivers: [] };
}

/**
 * PER採点セル <td> を生成（保有テーブル・ウォッチリスト共通）。
 * @param {any|null} v valuation オブジェクト（null可）
 * @param {string} [dataCol] data-col 属性（デフォルト 'per'）
 * @returns {string}
 */
export function valuationCellHTML(v, dataCol = 'per') {
  if (!v) return `<td class="wl-per-cell wl-per-empty" data-col="${dataCol}">–</td>`;
  const s = VAL_STATUS[v.status] || VAL_STATUS.hold;
  const hasPct = v.percentile != null && isFinite(v.percentile);
  const per = v.perCurrent != null && isFinite(v.perCurrent) ? Number(v.perCurrent).toFixed(1) : '–';
  const band =
    v.bandLow != null && v.bandHigh != null
      ? `${v.bandLow}–${v.bandHigh}${v.bandMedian != null ? ` 中央${v.bandMedian}` : ''}`
      : '—';
  const pctTxt = hasPct ? `${Math.round(v.percentile)}%ile` : '—';
  const title = `PER ${per} ／ バンド ${band} ／ ${pctTxt} ／ ${v.asOf || ''}${v.note ? ` ／ ${v.note}` : ''}`;
  const tile = hasPct
    ? `${Math.round(v.percentile)}<span class="wl-per-unit">%ile</span>`
    : '<span class="wl-per-unit">—</span>';
  return `<td class="wl-per-cell" data-col="${dataCol}" title="${escapeHTML(title)}">
      <span class="wl-per-tile">${tile}</span>
      <span class="wl-per-status">${s.icon}<span class="wl-per-label">${s.label}</span></span>
    </td>`;
}
