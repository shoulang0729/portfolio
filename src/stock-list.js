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
import { escapeHTML, makeTh, getColor, getCellTextColor, getHistoricalChangePct, fmtJPYInt, fmtPctInt, fmtPrice, fmtShares, _tableSort, makePeriodCells, makePeriodHeaderCells } from './utils.js';

// ══════════════════════════════════════════════
// STOCK LIST
// ══════════════════════════════════════════════

function updateSlColStyle() {
  const el = document.getElementById('sl-col-style');
  if (!el) return;
  if (state.slDetailVisible) {
    el.textContent = '';
  } else {
    el.textContent = SL_DETAIL_COLS
      .map(c => `.sl-table th[data-col="${c}"], .sl-table td[data-col="${c}"] { display: none; }`)
      .join('\n');
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

// 各期間の騰落率を取得
function getPctForPeriod(p, periodId) {
  if (!p.ySymbol) return null;
  if (periodId === '1d') return p.dayPct;
  return getHistoricalChangePct(p.ySymbol, periodId);
}

// 市場ラベルを cat から取得
function slMarketLabel(p) {
  if (p.cat === '日本株・ETF') return '東証';
  if (p.cat === '投資信託')    return '投信';
  return 'US';
}

function renderStockList() {
  const panel = document.getElementById('panel-list');
  if (panel?.hidden) return;
  const wrap = document.getElementById('stock-list-wrap');
  if (!wrap) return;
  // 時価評価額の最大値（バーグラフ用）
  const maxValue = Math.max(1, ...positions.map(p => p.value || 0));

  // ソート
  const items = [...positions].sort((a, b) => {
    let va, vb;
    if (PERIOD_IDS.includes(state.listSortCol)) {
      va = getPctForPeriod(a, state.listSortCol);
      vb = getPctForPeriod(b, state.listSortCol);
    } else if (state.listSortCol === 'pnlPct') {
      va = a.pnlPct; vb = b.pnlPct;
    } else if (state.listSortCol === 'pnl') {
      va = a.pnl; vb = b.pnl;
    } else if (state.listSortCol === 'value') {
      va = a.value; vb = b.value;
    } else if (state.listSortCol === 'price') {
      va = a.price; vb = b.price;
    } else if (state.listSortCol === 'shares') {
      va = a.shares; vb = b.shares;
    } else if (state.listSortCol === 'avgCost') {
      va = a.avgCost; vb = b.avgCost;
    } else if (state.listSortCol === 'market') {
      // localeCompare で正しく 0 を返す（同一市場内での矛盾比較を防ぐ）
      const cmp = slMarketLabel(a).localeCompare(slMarketLabel(b), 'ja');
      return state.listSortDir === 'desc' ? -cmp : cmp;
    } else {
      va = a.symbol; vb = b.symbol;
    }
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    return state.listSortDir === 'desc' ? (vb > va ? 1 : -1) : (va > vb ? 1 : -1);
  });

  // makeTh のカリー版（sortFn・ソート状態をクロージャでキャプチャ）
  const th = (label, col, align) =>
    makeTh(label, col, align, state.listSortCol, state.listSortDir, 'slSort');

  // 表内のみ：マイナスだけ赤、プラスは無色
  const slSgn = v => (v != null && v < 0) ? 'neg' : '';

  const rows = items.map(p => {
    const pnlAmtCls = slSgn(p.pnl);
    const pnlStr    = p.pnl    != null ? fmtJPYInt(p.pnl)    : '-';
    const pnlPctStr = p.pnlPct != null ? fmtPctInt(p.pnlPct) : '-';
    const pnlPctBg  = p.pnlPct != null ? getColor(p.pnlPct, 'pnl') : null;
    const pnlPctFg  = pnlPctBg  ? getCellTextColor(pnlPctBg) : null;
    const valStr    = p.value  != null ? fmtJPYInt(p.value)   : '-';
    const priceStr  = fmtPrice(p.price, p.cur);
    const costStr   = fmtPrice(p.avgCost, p.cur);
    const sharesStr = fmtShares(p.shares) + (p.cat === '投資信託' ? '口' : '株');
    // バーグラフ幅（tr に data-bar-pct で保持、applyStockBars で適用）
    const barPct = p.value && maxValue > 0 ? (p.value / maxValue) : 0;

    // 期間セル群（utils.js の共通ヘルパー。Watchlist と完全同一仕様）
    const periodCells = makePeriodCells(periodId => getPctForPeriod(p, periodId));

    // 列順：ティッカー(+銘柄名) / 市場 / 時価評価額 / 保有数 / 取得単価 / 現在値 / 騰落率×10 / 含み損益 / 損益率
    return `<tr data-bar="${barPct.toFixed(4)}">
      <td data-col="symbol" class="sl-sym">${escapeHTML(p.symbol)}<span class="sl-inline-name">${escapeHTML(p.name)}</span></td>
      <td data-col="market"><span class="wl-type-badge">${slMarketLabel(p)}</span></td>
      <td data-col="value">${valStr}</td>
      <td data-col="shares">${sharesStr}</td>
      <td data-col="avgCost">${costStr}</td>
      <td data-col="price">${priceStr}</td>
      ${periodCells}
      <td data-col="pnl" class="${pnlAmtCls}">${pnlStr}</td>
      <td data-col="pnlPct" class="sl-pct-cell" ${pnlPctBg ? `style="background:${pnlPctBg};color:${pnlPctFg}"` : ''}>${pnlPctStr}</td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `<table class="sl-table">
    <thead><tr>
      ${th('ティッカー<br><span class="sl-th-sub">銘柄名</span>','symbol')}
      ${th('市場','market','center')}
      ${th('時価評価額','value')}
      ${th('保有数','shares')}
      ${th('取得単価','avgCost')}
      ${th('現在値','price')}
      ${makePeriodHeaderCells(state.listSortCol, state.listSortDir, 'slSort')}
      ${th('含み損益','pnl')}
      ${th('損益率','pnlPct','center')}
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  // 列表示状態を適用
  updateSlColStyle();
  // バーグラフを非同期で適用（DOM確定後）
  requestAnimationFrame(applyStockBars);
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
  const fracs = Array.from(rows).map(tr => parseFloat(tr.dataset.bar || '0'));

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

function slSort(col) {
  _tableSort('listSortCol', 'listSortDir', col);
  renderStockList();
}

export { renderStockList, slSort, slToggleDetail, applyStockBars, updateSlColStyle };
