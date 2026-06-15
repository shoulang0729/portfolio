// @ts-check
// ══════════════════════════════════════════════════════════════
// render.js  ―  描画オーケストレーション
//
// renderStats / 歴史データ取得後の描画連鎖を担当
// ══════════════════════════════════════════════════════════════

import { positions } from './positions.js';
import { state } from './state.js';
import { fmtYen } from './utils.js';
import { renderHeatmap } from './heatmap.js';
import { renderStockList } from './stock-list.js';
import { renderWatchlist } from './watchlist.js';
import { fetchAllHistorical } from './data.js';
import { setStatus } from './ui-status.js';
import { getMfTotals } from './networth.js';

/**
 * Stats バー（資産総額・運用資産総額・投資用キャッシュ）の再描画。
 * 金額は1円単位（カンマ区切り）。state.statsMasked が true のときは金額を
 * マネーフォワード風のマスクバーにするが、投資用キャッシュ比率（%）は常に表示する。
 * @returns {void}
 */
export function renderStats() {
  // 資産総額・運用資産総額は Money Forward 実値（mf-holdings）。
  // 未ロード時はライブ証券合計にフォールバック。
  const mf = getMfTotals();
  const liveTotal = positions.reduce((s, p) => s + (p.value || 0), 0);

  const masked = state.statsMasked;
  /** 金額セル: マスク時も幅計算用の文字列は保持し、見た目だけバーに置換 */
  const amt = v => {
    const value = fmtYen(v);
    return masked ? `<span class="mf-mask" aria-label="金額非表示">${value}</span>` : value;
  };

  const mfTag = '<span class="stat-src">MF実値</span>';

  // マネーフォワード式カード: 運用資産総額を主役（hero）、資産総額・投資用キャッシュをサブ行に。
  // 横スクロールなし・親幅に収まる。
  let html = '';
  if (mf) {
    html += `<div class="stat-hero">
      <span class="stat-hero-label">運用資産総額${mfTag}</span>
      <span class="stat-hero-value stat-fg">${amt(mf.imported)}</span>
    </div>
    <div class="stat-subrow">
      <div class="stat-sub-item">
        <span class="stat-sub-label">資産総額</span>
        <span class="stat-sub-value stat-fg">${amt(mf.netWorth)}</span>
      </div>
      <div class="stat-sub-item">
        <span class="stat-sub-label">投資用キャッシュ</span>
        <span class="stat-sub-value stat-fg">${amt(mf.dryPowder)}<span class="stat-sub-pct">${mf.cashRatio.toFixed(1)}%</span></span>
      </div>
    </div>`;
  } else {
    // MF 未ロード時のフォールバック（ライブ証券合計のみ）
    html += `<div class="stat-hero">
      <span class="stat-hero-label">運用資産総額</span>
      <span class="stat-hero-value stat-fg">${amt(liveTotal)}</span>
    </div>`;
  }

  // ── 一旦非表示（含み損益・期間パフォーマンス列）。復活はこのブロックのコメント解除＋
  //    render.js 冒頭 import に { fmtJPYInt, fmtPctInt, sgn, calcPortfolioPeriodPct } と
  //    positions.js の PERIODS を戻す。 ──
  /*
  const totalPnl  = positions.reduce((s, p) => s + (p.pnl || 0), 0);
  const totalCost = liveTotal - totalPnl;
  const pnlPct    = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  html += `<div class="stat">
    <span class="stat-label">含み損益</span>
    <span class="stat-value ${sgn(totalPnl)}">${fmtJPYInt(totalPnl)}</span>
    <span class="stat-sub ${sgn(pnlPct)}">${fmtPctInt(pnlPct)}</span>
  </div>`;
  for (const p of PERIODS) {
    const pct = calcPortfolioPeriodPct(p.id);
    const pamt = pct !== null ? (liveTotal * pct) / 100 : null;
    const cls = pct !== null ? sgn(pct) : 'neu';
    html += `<div class="stat">
      <span class="stat-label">${p.statsLabel}</span>
      <span class="stat-value ${cls}">${pamt !== null ? fmtJPYInt(pamt) : '―'}</span>
      <span class="stat-sub ${cls}">${pct !== null ? fmtPctInt(pct) : '―'}</span>
    </div>`;
  }
  */

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
