// @ts-check
// ══════════════════════════════════════════════════════════════
// render.js  ―  描画オーケストレーション
//
// renderStats / 歴史データ取得後の描画連鎖を担当
// ══════════════════════════════════════════════════════════════

import { positions, PERIODS } from './positions.js';
import { state } from './state.js';
import { fmtJPYInt, fmtPctInt, sgn, calcPortfolioPeriodPct } from './utils.js';
import { renderHeatmap } from './heatmap.js';
import { renderStockList } from './stock-list.js';
import { renderWatchlist } from './watchlist.js';
import { fetchAllHistorical } from './data.js';
import { setStatus } from './ui-status.js';
import { getMfTotals } from './networth.js';

/**
 * Stats バー（資産総額・含み損益・期間パフォーマンス）の再描画
 * @returns {void}
 */
export function renderStats() {
  const totalValue = positions.reduce((s, p) => s + (p.value || 0), 0); // ライブ証券（期間PFの基準）
  const totalPnl   = positions.reduce((s, p) => s + (p.pnl   || 0), 0);

  const totalCost  = totalValue - totalPnl;
  const pnlPct     = totalCost > 0 ? totalPnl / totalCost * 100 : 0;

  // 資産総額は Money Forward 実値（mf-holdings）。未ロードならライブ証券合計にフォールバック
  const mf = getMfTotals();
  const grandTotal = mf ? mf.imported : totalValue;

  const mfTag = mf ? '<span style="display:block;font-size:9px;font-weight:400;color:var(--text2);opacity:0.6;text-transform:none;letter-spacing:0;">MF実値</span>' : '';
  let html = `<div class="stat">
    <span class="stat-label">運用資産総額${mfTag}</span>
    <span class="stat-value stat-fg">${fmtJPYInt(grandTotal)}</span>
  </div>`;

  if (mf) {
    // 投資用キャッシュ: 金額（万単位）→ 改行 → 比率（%）。文字は白（#309）
    const dryMan = `¥${Math.round(mf.dryPowder / 1e4).toLocaleString()}万`;
    html += `<div class="stat">
      <span class="stat-label">投資用キャッシュ</span>
      <span class="stat-value stat-fg">${dryMan}</span>
      <span class="stat-sub stat-fg">${mf.cashRatio.toFixed(1)}%</span>
    </div>`;
  }

  html += `<div class="stat">
    <span class="stat-label">含み損益</span>
    <span class="stat-value ${sgn(totalPnl)}">${fmtJPYInt(totalPnl)}</span>
    <span class="stat-sub ${sgn(pnlPct)}">${fmtPctInt(pnlPct)}</span>
  </div>`;

  for (const p of PERIODS) {
    const pct = calcPortfolioPeriodPct(p.id);
    const amt = pct !== null ? totalValue * pct / 100 : null;
    const cls = pct !== null ? sgn(pct) : 'neu';
    html += `<div class="stat">
      <span class="stat-label">${p.statsLabel}</span>
      <span class="stat-value ${cls}">${amt !== null ? fmtJPYInt(amt) : '―'}</span>
      <span class="stat-sub ${cls}">${pct !== null ? fmtPctInt(pct) : '―'}</span>
    </div>`;
  }

  document.getElementById('stats').innerHTML = html;
}

/**
 * 5y / 10y 履歴データ取得後の描画オーケストレーション
 * 各 range で fetchAllHistorical → renderStats/renderStockList/renderWatchlist/renderHeatmap を実行
 * @returns {Promise<void>}
 */
export async function refreshHistoricalAndRender() {
  const results = await Promise.allSettled(['5y', '10y'].map(async range => {
    await fetchAllHistorical(range);
    renderStats();
    renderStockList();
    if (state.activeTab === 'watchlist') {
      renderWatchlist();
      updateWatchlistHeight();
    }
    if (state.changePeriod && state.changePeriod !== '1d') renderHeatmap();
    return range;
  }));
  const failed = results.filter(r => r.status === 'rejected');
  failed.forEach(r => console.warn('[historical] fetch failed:', r.reason));
  if (failed.length > 0) {
    setStatus(`履歴データ取得失敗（${failed.length}/${results.length}）`, 'red');
  }
}

/**
 * 初回データ取得完了後にスケルトンを非表示にし SVG を表示する
 * @returns {void}
 */
export function hideHeatmapSkeleton() {
  const sk = document.getElementById('heatmap-skeleton');
  const sv = document.getElementById('heatmap');
  if (sk) { sk.style.transition = 'opacity 0.3s ease'; sk.style.opacity = '0'; setTimeout(() => sk.remove(), 320); }
  if (sv) sv.style.display = '';
}

/**
 * 銘柄リストの高さをビューポートに合わせて動的設定
 * @returns {void}
 */
export function updateListHeight() {
  const wrap    = document.getElementById('stock-list-wrap');
  if (!wrap) return;
  const sticky  = document.querySelector('.sticky-top');
  const stickyH = sticky instanceof HTMLElement ? sticky.offsetHeight : 0;
  const padBot = parseFloat(getComputedStyle(document.body).paddingBottom) || 16;
  const h = Math.max(160, window.innerHeight - stickyH - padBot - 4);
  wrap.style.maxHeight = `${h  }px`;
}

/**
 * ウォッチリストの高さをビューポートに合わせて動的設定
 * @returns {void}
 */
export function updateWatchlistHeight() {
  const wrap = document.getElementById('watchlist-table-wrap');
  if (!wrap) return;
  const sticky = document.querySelector('.sticky-top');
  const stickyH = sticky instanceof HTMLElement ? sticky.offsetHeight : 0;
  const padBot = parseFloat(getComputedStyle(document.body).paddingBottom) || 16;
  const h = Math.max(160, window.innerHeight - stickyH - padBot - 4);
  wrap.style.maxHeight = `${h  }px`;
}

/**
 * Heatmap パネルの高さをビューポートに合わせて内部スクロール化する。
 * list/watchlist と同じく内部スクロールにすることで、body 自体がスクロール
 * せず .sticky-top（ヘッダー＋タブバー）が常に固定される（#215）。
 * @returns {void}
 */
export function updateHeatmapHeight() {
  const panel = document.getElementById('panel-heatmap');
  if (!panel || panel.hidden) return;
  const sticky = document.querySelector('.sticky-top');
  const stickyH = sticky instanceof HTMLElement ? sticky.offsetHeight : 0;
  const padBot = parseFloat(getComputedStyle(document.body).paddingBottom) || 16;
  const h = Math.max(200, window.innerHeight - stickyH - padBot - 4);
  panel.style.maxHeight = `${h}px`;
}

/**
 * 現在表示中のテーブル高さを再計算
 * @returns {void}
 */
export function updateActiveTableHeight() {
  if (state.activeTab === 'watchlist') {
    updateWatchlistHeight();
    return;
  }
  if (state.activeTab === 'heatmap') {
    updateHeatmapHeight();
    return;
  }
  updateListHeight();
}

/**
 * 価格更新イベントのリスナー設定（循環依存回避）
 * data.js が 'hm:prices-updated' を発火したときに renderStats / renderHeatmap を実行
 * @returns {void}
 */
export function setupPriceUpdateListener() {
  document.addEventListener('hm:prices-updated', () => {
    renderStats();
    renderHeatmap();
  });
}
