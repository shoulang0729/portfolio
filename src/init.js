// ══════════════════════════════════════════════════════════════
// init.js  ―  アプリケーションイベントリスナー設定
//
// ウィンドウリサイズ・システムカラースキーム変化・ResizeObserver を管理
// 依存: state, heatmap.js, stock-list.js, chart.js
// ══════════════════════════════════════════════════════════════

import { state } from './state.js';
import { renderHeatmap } from './heatmap.js';
import { renderHeatmapList, applyStockBars } from './stock-list.js';
import { loadValuations } from './valuations.js';
import { loadChart } from './chart.js';
import { updateListHeight } from './render.js';
import { setupSwipeNav } from './swipe.js';

export function setupEventListeners(applyThemeFn) {
  if (typeof d3 === 'undefined') {
    const d3Err = document.getElementById('d3-load-error');
    if (d3Err) d3Err.style.display = 'flex';
    else console.error('D3 未ロード（d3-load-error 要素も無し）');
    return;
  }

  setupSwipeNav();

  // PER採点ストア（data/valuations.json）を読み込み、保有テーブル/ウォッチを再描画。
  // 失敗してもセルは「–」になるだけで他機能には影響しない。
  loadValuations().then(() => {
    renderHeatmapList();
  });

  let _resizeRaf = null;
  window.addEventListener('resize', () => {
    if (_resizeRaf) cancelAnimationFrame(_resizeRaf);
    _resizeRaf = requestAnimationFrame(() => {
      _resizeRaf = null;
      renderHeatmap(); renderHeatmapList(); applyStockBars(); updateListHeight();
    });
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.themeMode !== 'auto') return;
    applyThemeFn();
    renderHeatmap();
    const overlay = document.getElementById('modal-overlay');
    if (overlay && overlay.style.display !== 'none' && state.currentPos?.ySymbol) {
      loadChart(state.currentPos.ySymbol, state.currentRange);
    }
  });

  if (typeof ResizeObserver !== 'undefined') {
    const _stickyEl = document.querySelector('.sticky-top');
    if (_stickyEl) {
      new ResizeObserver(() => {
        if (state.activeTab === 'list') updateListHeight();
      }).observe(_stickyEl);
    }
  }
}
