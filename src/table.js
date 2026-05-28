// ══════════════════════════════════════════════════════════════
// table.js  ―  テーブルヘルパー関数群
// stock-list / watchlist 共用
// 依存: state.js, positions.js, fmt.js, color.js
// ══════════════════════════════════════════════════════════════

import { state } from './state.js';
import { PERIOD_COLS, PERIOD_MAP } from './positions.js';
import { fmtPctInt } from './fmt.js';
import { getColor, getCellTextColor } from './color.js';

function makeTh(label, col, align, activeSortCol, sortDir, sortFnName) {
  const active = col && activeSortCol === col;
  const sortCls = active ? (sortDir === 'desc' ? 'sort-desc' : 'sort-asc') : '';
  const alignCls = align === 'center' ? 'sl-th-center' : '';
  const cls = [sortCls, alignCls].filter(Boolean).join(' ');
  const dataCol = col ? `data-col="${col}"` : '';
  const click = (col && sortFnName) ? `data-action="${sortFnName}" data-arg="${col}"` : '';
  return `<th class="${cls}" ${dataCol} ${click}>${label}</th>`;
}

function makePctCell(pct, scale, dataCol = '') {
  const dataAttr = dataCol ? `data-col="${dataCol}" ` : '';
  if (pct == null) {
    const period = PERIOD_MAP[dataCol];
    const range = period?.range;
    const fetching = !!(range && state.fetchingRanges?.has?.(range));
    const attempted = !!(range && state.historicalAttempted?.[range] === true);
    const loading = fetching || (range && !attempted);
    const placeholder = loading
      ? '<span class="sl-pct-loading">\u2026</span>'
      : '\u2013';
    return `<td ${dataAttr}class="sl-pct-cell">${placeholder}</td>`;
  }
  const bg = getColor(pct, 'change', scale);
  const fg = getCellTextColor(bg);
  return `<td ${dataAttr}class="sl-pct-cell" style="background:${bg};color:${fg}">${fmtPctInt(pct)}</td>`;
}

function _tableSort(colKey, dirKey, col, defaultAscCols = []) {
  if (state[colKey] === col) {
    state[dirKey] = state[dirKey] === 'desc' ? 'asc' : 'desc';
  } else {
    state[colKey] = col;
    state[dirKey] = defaultAscCols.includes(col) ? 'asc' : 'desc';
  }
}

function makePeriodCells(getPct) {
  return PERIOD_COLS
    .map(pc => {
      const pct = getPct(pc.id);
      const scale = PERIOD_MAP[pc.id]?.scale ?? 25;
      return makePctCell(pct, scale, pc.id);
    })
    .join('');
}

function makePeriodHeaderCells(activeSortCol, sortDir, sortFnName) {
  return PERIOD_COLS
    .map(pc => makeTh(pc.label, pc.id, 'center', activeSortCol, sortDir, sortFnName))
    .join('');
}

export { makeTh, makePctCell, _tableSort, makePeriodCells, makePeriodHeaderCells };