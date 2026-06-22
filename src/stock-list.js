// ══════════════════════════════════════════════════════════════
// stock-list.js  ―  銘柄一覧テーブル
//
// 依存: state.js (state, SL_DETAIL_COLS), utils.js (makeTh, makePctCell,
//        getColor, getCellTextColor, getHistoricalChangePct,
//        fmtJPYInt, fmtPctInt, fmtPrice, fmtShares, sgn),
//       positions.js (positions, PERIOD_COLS, PERIOD_IDS, PERIOD_MAP)
// ══════════════════════════════════════════════════════════════

import { state, SL_DETAIL_COLS } from './state.js';
import { positions, PERIOD_IDS } from './positions.js';
import {
  escapeHTML,
  makeTh,
  getColor,
  getCellTextColor,
  getHistoricalChangePct,
  fmtJPYInt,
  fmtPctInt,
  fmtPrice,
  fmtShares,
  _tableSort,
  makePeriodCells,
  makePeriodHeaderCells,
} from './utils.js';

// ══════════════════════════════════════════════
// STOCK LIST
// ══════════════════════════════════════════════

function updateSlColStyle() {
  const el = document.getElementById('sl-col-style');
  if (!el) return;
  if (state.slDetailVisible) {
    el.textContent = '';
  } else {
    el.textContent = SL_DETAIL_COLS.map(
      (c) => `.sl-table th[data-col="${c}"], .sl-table td[data-col="${c}"] { display: none; }`
    ).join('\n');
  }
}

function slToggleDetail() {
  state.slDetailVisible = !state.slDetailVisible;
  updateSlColStyle();
  const btn = document.getElementById('sl-eye-btn');
  if (btn) {
    btn.classList.toggle('hidden', !state.slDetailVisible);
    const slash = document.getElementById('sl-eye-slash');
    if (slash) slash.style.display = state.slDetailVisible ? 'none' : '';
  }
  // バーを再適用（列幅が変わるため）
  requestAnimationFrame(applyStockBars);
}

// 市場ラベルを cat から取得（保有）
function slMarketLabel(p) {
  if (p.cat === '日本株・ETF') return '東証';
  if (p.cat === '投資信託') return '投信';
  return 'US';
}

// ── 統合タブ（Historical ＋ Watchlist・#452）─────────────────────────────────
// セグメント all/held/watch を 1 テーブルに統合。保有行（kind:'held'）とウォッチ行
// （kind:'watch'）を共通形に正規化し、同じ期間ヒートマップ/ソートで描画する。

/** 保有銘柄 → 共通行 */
function heldRow(p) {
  return {
    kind: 'held',
    symbol: p.symbol,
    histKey: p.ySymbol, // 履歴キャッシュのキー
    name: p.name,
    market: slMarketLabel(p),
    cur: p.cur,
    price: p.price,
    value: p.value,
    shares: p.shares,
    avgCost: p.avgCost,
    pnl: p.pnl,
    pnlPct: p.pnlPct,
    dayPct: p.dayPct,
    cat: p.cat,
  };
}

/** ウォッチ銘柄 → 共通行（保有専用列は null） */
function watchRow(item) {
  const live = state.watchlistPrices[item.symbol];
  return {
    kind: 'watch',
    symbol: item.symbol,
    histKey: item.symbol, // ウォッチは symbol が履歴キー
    name: item.name || '',
    market: item.exchange || '',
    cur: item.cur,
    price: live?.price ?? null,
    value: null,
    shares: null,
    avgCost: null,
    pnl: null,
    pnlPct: null,
    dayPct: live?.dayPct ?? null,
    cat: null,
  };
}

/** 共通行の期間騰落率（1d はライブ、他は履歴キャッシュ） */
function heatGetPct(row, periodId) {
  if (periodId === '1d') return row.dayPct ?? null;
  return row.histKey ? getHistoricalChangePct(row.histKey, periodId) : null;
}

/** セグメントに応じて行集合を構築。`all` は 保有 ∪ (ウォッチ − 保有) で重複は保有優先で1行。 */
function buildHeatItems() {
  const seg = state.heatSeg;
  if (seg === 'held') return positions.map(heldRow);
  if (seg === 'watch') return state.watchlist.map(watchRow);
  // all: 保有を全件、ウォッチは保有に無い symbol/ySymbol のみ（重複は保有優先で除外）
  const heldKeys = new Set();
  for (const p of positions) {
    if (p.symbol) heldKeys.add(p.symbol);
    if (p.ySymbol) heldKeys.add(p.ySymbol);
  }
  const watchRows = state.watchlist.filter((w) => !heldKeys.has(w.symbol)).map(watchRow);
  return [...positions.map(heldRow), ...watchRows];
}

/** 保有のみで値を持つ列（ウォッチ行は null → ソート末尾固定） */
const HEAT_HELD_ONLY = ['value', 'shares', 'avgCost', 'pnl', 'pnlPct'];

/** 単一ソート（antisymmetric・null と保有なし行は dir 非依存で末尾） */
function sortHeatItems(items) {
  const col = state.heatSortCol;
  const dir = state.heatSortDir === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    if (col === 'symbol') return dir * String(a.symbol).localeCompare(String(b.symbol), 'ja');
    if (col === 'market') return dir * String(a.market).localeCompare(String(b.market), 'ja');
    let va, vb;
    if (PERIOD_IDS.includes(col)) {
      va = heatGetPct(a, col);
      vb = heatGetPct(b, col);
    } else if (col === 'price') {
      va = a.price;
      vb = b.price;
    } else if (HEAT_HELD_ONLY.includes(col)) {
      va = a[col];
      vb = b[col];
    } else {
      va = a.symbol;
      vb = b.symbol;
    }
    const an = va == null;
    const bn = vb == null;
    if (an && bn) return 0;
    if (an) return 1; // null は常に末尾
    if (bn) return -1;
    if (va === vb) return 0;
    return dir * (va > vb ? 1 : -1);
  });
}

/** 統合タブ（Historical ＋ Watchlist）を描画する。 */
function renderHeatmapList() {
  const panel = document.getElementById('panel-list');
  if (panel?.hidden) return;
  const wrap = document.getElementById('stock-list-wrap');
  if (!wrap) return;

  const seg = state.heatSeg;
  const items = sortHeatItems(buildHeatItems());

  if (items.length === 0) {
    const msg =
      seg === 'watch'
        ? '上の検索欄から銘柄を追加してください'
        : seg === 'held'
          ? '保有銘柄がありません'
          : '銘柄がありません';
    wrap.innerHTML = `<div class="wl-empty-msg">${msg}</div>`;
    return;
  }

  // バーグラフ用の最大評価額（保有行のみ）
  const maxValue = Math.max(1, ...items.filter((r) => r.kind === 'held').map((r) => r.value || 0));

  const th = (label, col, align) => makeTh(label, col, align, state.heatSortCol, state.heatSortDir, 'heatSort');
  const slSgn = (v) => (v != null && v < 0 ? 'neg' : '');
  const showBadge = seg === 'all';

  const rows = items
    .map((r) => {
      const isHeld = r.kind === 'held';
      const pnlAmtCls = slSgn(r.pnl);
      const pnlStr = r.pnl != null ? fmtJPYInt(r.pnl) : '–';
      const pnlPctStr = r.pnlPct != null ? fmtPctInt(r.pnlPct) : '–';
      const pnlPctBg = r.pnlPct != null ? getColor(r.pnlPct, 'pnl') : null;
      const pnlPctFg = pnlPctBg ? getCellTextColor(pnlPctBg) : null;
      const valStr = r.value != null ? fmtJPYInt(r.value) : '–';
      const priceStr = r.price != null ? fmtPrice(r.price, r.cur) : '–';
      const costStr = r.avgCost != null ? fmtPrice(r.avgCost, r.cur) : '–';
      const sharesStr = r.shares != null ? fmtShares(r.shares) + (r.cat === '投資信託' ? '口' : '株') : '–';
      const barPct = isHeld && r.value && maxValue > 0 ? r.value / maxValue : 0;
      const periodCells = makePeriodCells((periodId) => heatGetPct(r, periodId));
      // 区分バッジ（`全部`時のみ・保有=primary / ウォッチ=muted）
      const badge = showBadge
        ? `<span class="heat-kind heat-kind-${isHeld ? 'held' : 'watch'}">${isHeld ? '保有' : 'W'}</span>`
        : '';
      // 削除×はウォッチ行のみ（保有は削除不可）
      const delCell = isHeld
        ? ''
        : `<button class="wl-del-btn" data-action="removeFromWatchlist" data-arg="${escapeHTML(r.symbol)}" title="ウォッチリストから削除">×</button>`;

      return `<tr data-bar="${barPct.toFixed(4)}" data-kind="${r.kind}">
      <td data-col="symbol" class="sl-sym">${badge}${escapeHTML(r.symbol)}<span class="sl-inline-name">${escapeHTML(r.name)}</span></td>
      <td data-col="market"><span class="wl-type-badge">${escapeHTML(r.market)}</span></td>
      <td data-col="value">${valStr}</td>
      <td data-col="shares">${sharesStr}</td>
      <td data-col="avgCost">${costStr}</td>
      <td data-col="price">${priceStr}</td>
      ${periodCells}
      <td data-col="pnl" class="${pnlAmtCls}">${pnlStr}</td>
      <td data-col="pnlPct" class="sl-pct-cell" ${pnlPctBg ? `style="background:${pnlPctBg};color:${pnlPctFg}"` : ''}>${pnlPctStr}</td>
      <td data-col="del" class="wl-del-cell">${delCell}</td>
    </tr>`;
    })
    .join('');

  wrap.innerHTML = `<table class="sl-table seg-${seg}">
    <thead><tr>
      ${th('ティッカー<br><span class="sl-th-sub">銘柄名</span>', 'symbol')}
      ${th('市場', 'market', 'center')}
      ${th('時価評価額', 'value')}
      ${th('保有数', 'shares')}
      ${th('取得単価', 'avgCost')}
      ${th('現在値', 'price')}
      ${makePeriodHeaderCells(state.heatSortCol, state.heatSortDir, 'heatSort')}
      ${th('含み損益', 'pnl')}
      ${th('損益率', 'pnlPct', 'center')}
      <th data-col="del"></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  updateSlColStyle();
  requestAnimationFrame(applyStockBars);
}

/**
 * 統合タブのコントロール（セグメントピル active / 検索欄表示）を現在の状態に合わせる。
 * 検索欄は `保有` では非表示（保有は追加不可）。
 */
function updateHeatControls() {
  const onList = state.activeTab === 'list';
  document.querySelectorAll('.heat-seg-pill[data-arg]').forEach((b) => {
    // @ts-ignore HTMLElement
    const on = b.dataset.arg === state.heatSeg;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  const wlSearch = document.getElementById('wl-search-wrap');
  if (wlSearch) wlSearch.hidden = !onList || state.heatSeg === 'held';
}

// ── 時価評価額バーグラフ：CSS 変数で reflow 削減 ──
function applyStockBars() {
  // 銘柄リストタブ非表示なら何もしない
  if (state.activeTab !== 'list') return;

  // ── READ phase: DOM 計測を全て先に ──
  const tbl = document.querySelector('.sl-table');
  if (!tbl) return;
  const symTh = tbl.querySelector('th[data-col="symbol"]');
  if (!symTh) return;
  const tblRect = tbl.getBoundingClientRect();
  const symRect = symTh.getBoundingClientRect();
  const rows = tbl.querySelectorAll('tbody tr[data-bar]');
  const fracs = Array.from(rows).map((tr) => parseFloat(tr.dataset.bar || '0'));

  // ── WRITE phase: CSS 変数で一括設定 ──
  const startX = symRect.right - tblRect.left;
  const totalW = tblRect.width;
  const barMaxW = totalW - startX;
  const edgePx = 2;

  rows.forEach((tr, i) => {
    const frac = fracs[i];
    if (frac <= 0 || barMaxW <= 0) {
      tr.style.removeProperty('--bar-start');
      tr.style.removeProperty('--bar-edge-start');
      tr.style.removeProperty('--bar-end');
      return;
    }
    const barEnd = startX + barMaxW * frac;
    const edgeStart = Math.max(startX + 1, barEnd - edgePx);
    tr.style.setProperty('--bar-start', `${startX}px`);
    tr.style.setProperty('--bar-edge-start', `${edgeStart.toFixed(1)}px`);
    tr.style.setProperty('--bar-end', `${barEnd.toFixed(1)}px`);
  });
}

/** 統合タブのソート切替（単一状態・symbol のみ asc 既定）。 */
function heatSort(col) {
  _tableSort('heatSortCol', 'heatSortDir', col, ['symbol']);
  renderHeatmapList();
}

export {
  renderHeatmapList,
  heatSort,
  updateHeatControls,
  slToggleDetail,
  applyStockBars,
  updateSlColStyle,
};
