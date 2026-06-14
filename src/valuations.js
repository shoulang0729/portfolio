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
// ══════════════════════════════════════════════════════════════

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
