// @ts-check

// ══════════════════════════════════════════════════════════════
// tabs.js  ―  タブ切替ロジック
//
// 依存: state, heatmap.js, stock-list.js, watchlist.js
// ══════════════════════════════════════════════════════════════

import { state } from './state.js';
import { renderHeatmap } from './heatmap.js';
import { renderStockList } from './stock-list.js';
import { renderWatchlist, fetchWatchlistData, _loadWatchlistFromWorker } from './watchlist.js';
import { updateListHeight } from './render.js';

export function switchTab(name) {
  // 'heatmap' | 'list' | 'watchlist' | 'ai'
  if (state.activeTab === name) return;
  state.activeTab = name;
  try { localStorage.setItem('hm-active-tab', name); } catch {}

  const panelHeatmap   = document.getElementById('panel-heatmap');
  const panelList      = document.getElementById('panel-list');
  const panelWatchlist = document.getElementById('panel-watchlist');
  const panelAi        = document.getElementById('panel-ai');
  if (panelHeatmap)   panelHeatmap.hidden   = (name !== 'heatmap');
  if (panelList)      panelList.hidden      = (name !== 'list');
  if (panelWatchlist) panelWatchlist.hidden = (name !== 'watchlist');
  if (panelAi)        panelAi.hidden        = (name !== 'ai');

  document.querySelectorAll('.tab-btn[data-tab]').forEach(b => {
    const isActive = b.dataset.tab === name;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', isActive);
  });

  if (name === 'heatmap') renderHeatmap();

  if (name === 'list') {
    renderStockList();
    requestAnimationFrame(() => requestAnimationFrame(updateListHeight));
  }

  if (name === 'watchlist') {
    _loadWatchlistFromWorker().then(() => { renderWatchlist(); fetchWatchlistData(); });
  }
}
