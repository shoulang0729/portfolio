// ══════════════════════════════════════════════════════════════
// stock-list.js  ―  銘柄一覧テーブル
//
// 依存: state.js (state, SL_DETAIL_COLS), utils.js (getColor,
//        getCellTextColor, getHistoricalChangePct, fmtJPYInt, fmtPctInt,
//        fmtPrice, fmtShares, sgn), positions.js (positions, PERIOD_MAP)
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════
// STOCK LIST
// ══════════════════════════════════════════════

/** 騰落率列の定義（全期間・順序固定） */
const PERIOD_COLS = [
  { id: '1d',  label: '1d'  },
  { id: '1w',  label: '1w'  },
  { id: '1m',  label: '1m'  },
  { id: '3m',  label: '3m'  },
  { id: '6m',  label: '6m'  },
  { id: '9m',  label: '9m'  },
  { id: '1y',  label: '1y'  },
  { id: '3y',  label: '3y'  },
  { id: '5y',  label: '5y'  },
  { id: '10y', label: '10y' },
];
const PERIOD_IDS = PERIOD_COLS.map(pc => pc.id);

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
      va = slMarketLabel(a); vb = slMarketLabel(b);
    } else {
      va = a.symbol; vb = b.symbol;
    }
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    return state.listSortDir === 'desc' ? (vb > va ? 1 : -1) : (va > vb ? 1 : -1);
  });

  function th(label, col, align) {
    const active   = state.listSortCol === col;
    const sortCls  = active ? (state.listSortDir === 'desc' ? 'sort-desc' : 'sort-asc') : '';
    const alignCls = align === 'center' ? 'sl-th-center' : '';
    const cls = [sortCls, alignCls].filter(Boolean).join(' ');
    return `<th class="${cls}" data-col="${col}" onclick="slSort('${col}')">${label}</th>`;
  }

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

    const periodCells = PERIOD_COLS.map(pc => {
      const pct = getPctForPeriod(p, pc.id);
      const str = pct != null ? fmtPctInt(pct) : '-';
      if (pct == null) return `<td data-col="${pc.id}" class="sl-pct-cell">-</td>`;
      const scale = PERIOD_MAP[pc.id]?.scale ?? 25;
      const bg  = getColor(pct, 'change', scale);
      const fg  = getCellTextColor(bg);
      return `<td data-col="${pc.id}" class="sl-pct-cell" style="background:${bg};color:${fg}">${str}</td>`;
    }).join('');

    // 列順：ティッカー(+銘柄名) / 市場 / 時価評価額 / 保有数 / 取得単価 / 現在値 / 騰落率×10 / 含み損益 / 損益率
    return `<tr data-bar="${barPct.toFixed(4)}">
      <td data-col="symbol" class="sl-sym">${p.symbol}<span class="sl-inline-name">${p.name}</span></td>
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
      ${PERIOD_COLS.map(pc => th(pc.label, pc.id, 'center')).join('')}
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

// ── 時価評価額バーグラフ：ティッカー列右端〜テーブル右端を最大幅として tr に適用 ──
function applyStockBars() {
  const tbl = document.querySelector('.sl-table');
  if (!tbl) return;
  const symTh = tbl.querySelector('th[data-col="symbol"]');
  if (!symTh) return;
  const tblRect = tbl.getBoundingClientRect();
  const symRect = symTh.getBoundingClientRect();
  const startX  = symRect.right - tblRect.left;
  const totalW  = tblRect.width;
  const barMaxW = totalW - startX; // バーが使える最大幅

  const fill = 'rgba(142,142,147,0.16)';  // バー本体
  const edge = 'rgba(142,142,147,0.55)';  // 右端の縦線（バー終端を明示）
  const edgePx = 2;

  tbl.querySelectorAll('tbody tr[data-bar]').forEach(tr => {
    const frac = parseFloat(tr.dataset.bar || '0');
    if (frac <= 0 || barMaxW <= 0) { tr.style.backgroundImage = ''; return; }
    const barEndPx  = startX + barMaxW * frac;
    const edgeStart = Math.max(startX + 1, barEndPx - edgePx);
    tr.style.backgroundImage =
      `linear-gradient(to right,` +
      ` transparent ${startX}px,` +
      ` ${fill} ${startX}px,` +
      ` ${fill} ${edgeStart.toFixed(1)}px,` +
      ` ${edge} ${edgeStart.toFixed(1)}px,` +
      ` ${edge} ${barEndPx.toFixed(1)}px,` +
      ` transparent ${barEndPx.toFixed(1)}px)`;
  });
}

function slSort(col) {
  if (state.listSortCol === col) {
    state.listSortDir = state.listSortDir === 'desc' ? 'asc' : 'desc';
  } else {
    state.listSortCol = col;
    state.listSortDir = 'desc';
  }
  renderStockList();
}
