// @ts-check

// ══════════════════════════════════════════════════════════════
// tabs.js  ―  タブ切替ロジック
//
// 依存: state, heatmap.js, stock-list.js, watchlist.js
// ══════════════════════════════════════════════════════════════

import { state } from './state.js';
import { renderHeatmap } from './heatmap.js';
import { renderHeatmapList, updateHeatControls } from './stock-list.js';
import { fetchWatchlistData, _loadWatchlistFromWorker } from './watchlist.js';
import { updateListHeight, updateHeatmapHeight } from './render.js';
import { renderRiskCharts } from './risk-charts.js';
import { renderBriefing } from './briefing.js';
import { renderValuationTab } from './valuation-tab.js';

/**
 * Switch to a different tab and render its content
 * @param {'heatmap' | 'list' | 'watchlist' | 'risk' | 'value' | 'briefing' | 'ai'} name - Tab name
 * @returns {void}
 */
export function switchTab(name) {
  // 統合（#452）: 旧 'watchlist' タブは 'list'（統合タブ）に正規化する。
  if (name === 'watchlist') name = 'list';
  if (state.activeTab === name) return;
  state.activeTab = name;
  try {
    localStorage.setItem('hm-active-tab', name);
  } catch {}

  const panelHeatmap = document.getElementById('panel-heatmap');
  const panelList = document.getElementById('panel-list');
  const panelRisk = document.getElementById('panel-risk');
  const panelValue = document.getElementById('panel-value');
  const panelBriefing = document.getElementById('panel-briefing');
  const panelAi = document.getElementById('panel-ai');
  if (panelHeatmap) panelHeatmap.hidden = name !== 'heatmap';
  if (panelList) panelList.hidden = name !== 'list';
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

  // sticky-top 内のサブコントロール（セグメントピル＋詳細トグル＋検索）を切替
  const slControls = document.getElementById('sl-controls');
  if (slControls) slControls.hidden = name !== 'list';
  updateHeatControls(); // 検索欄の表示・ピル active を現在の状態に合わせる

  if (name === 'heatmap') {
    renderHeatmap();
    requestAnimationFrame(() => requestAnimationFrame(updateHeatmapHeight));
  }

  if (name === 'list') {
    // 保有を即描画 → ウォッチを worker から読込んで再描画（二段でチラつきを抑える）。
    renderHeatmapList();
    requestAnimationFrame(() => requestAnimationFrame(updateListHeight));
    (async () => {
      await _loadWatchlistFromWorker();
      renderHeatmapList();
      updateListHeight();
      if (state.heatSeg !== 'held') fetchWatchlistData();
    })();
  }

  if (name === 'risk') renderRiskCharts();

  if (name === 'value') renderValuationTab();

  if (name === 'briefing') renderBriefing();
}
