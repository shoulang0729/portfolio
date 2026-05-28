// ══════════════════════════════════════════════════════════════
// init.js  ―  アプリケーションイベントリスナー設定
//
// ウィンドウリサイズ・システムカラースキーム変化・ResizeObserver を管理
// 依存: state, heatmap.js, stock-list.js, chart.js
// ══════════════════════════════════════════════════════════════

import { state } from './state.js';
import { renderHeatmap } from './heatmap.js';
import { renderStockList, applyStockBars } from './stock-list.js';
import { loadChart } from './chart.js';
import { updateListHeight } from './render.js';

export function setupEventListeners(applyThemeFn) {
  if (typeof d3 === 'undefined') {
    document.getElementById('d3-load-error').style.display = 'flex';
    return;
  }

  let _resizeRaf = null;
  window.addEventListener('resize', () => {
    if (_resizeRaf) cancelAnimationFrame(_resizeRaf);
    _resizeRaf = requestAnimationFrame(() => {
      _resizeRaf = null;
      renderHeatmap(); renderStockList(); applyStockBars(); updateListHeight();
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
