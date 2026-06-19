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
import { updateListHeight, updateWatchlistHeight, updateHeatmapHeight } from './render.js';
import { renderRiskCharts } from './risk-charts.js';
import { renderBriefing } from './briefing.js';
import { renderValuationTab } from './valuation-tab.js';

/**
 * Switch to a different tab and render its content
 * @param {'heatmap' | 'list' | 'watchlist' | 'risk' | 'value' | 'briefing' | 'ai'} name - Tab name
 * @returns {void}
 */
export function switchTab(name) {
  if (state.activeTab === name) return;
  state.activeTab = name;
  try {
    localStorage.setItem('hm-active-tab', name);
  } catch {}

  const panelHeatmap = document.getElementById('panel-heatmap');
  const panelList = document.getElementById('panel-list');
  const panelWatchlist = document.getElementById('panel-watchlist');
  const panelRisk = document.getElementById('panel-risk');
  const panelValue = document.getElementById('panel-value');
  const panelBriefing = document.getElementById('panel-briefing');
  const panelAi = document.getElementById('panel-ai');
  if (panelHeatmap) panelHeatmap.hidden = name !== 'heatmap';
  if (panelList) panelList.hidden = name !== 'list';
  if (panelWatchlist) panelWatchlist.hidden = name !== 'watchlist';
  if (panelRisk) panelRisk.hidden = name !== 'risk';
  if (panelValue) panelValue.hidden = name !== 'value';
  if (panelBriefing) panelBriefing.hidden = name !== 'briefing';
  if (panelAi) panelAi.hidden = name !== 'ai';

  document.querySelectorAll('.tab-btn[data-tab]').forEach((b) => {
    // @ts-ignore b is HTMLElement with data-tab attribute
    const isActive = b.dataset.tab === name;
    // @ts-ignore classList.toggle accepts boolean 2nd arg
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', String(isActive));
  });

  // sticky-top 内のタブ別サブコントロールを切替
  const slControls = document.getElementById('sl-controls');
  const wlSearch = document.getElementById('wl-search-wrap');
  if (slControls) slControls.hidden = name !== 'list';
  if (wlSearch) wlSearch.hidden = name !== 'watchlist';

  if (name === 'heatmap') {
    renderHeatmap();
    requestAnimationFrame(() => requestAnimationFrame(updateHeatmapHeight));
  }

  if (name === 'list') {
    renderStockList();
    requestAnimationFrame(() => requestAnimationFrame(updateListHeight));
  }

  if (name === 'watchlist') {
    (async () => {
      await _loadWatchlistFromWorker();
      renderWatchlist();
      updateWatchlistHeight();
      fetchWatchlistData();
    })();
  }

  if (name === 'risk') renderRiskCharts();

  if (name === 'value') renderValuationTab();

  if (name === 'briefing') renderBriefing();
}
