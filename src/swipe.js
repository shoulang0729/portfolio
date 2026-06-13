// @ts-check

// ══════════════════════════════════════════════════════════════
// swipe.js  ―  左右スワイプでタブ間を移動する
//
// タブ順は DOM の .tab-btn[data-tab] 並びから動的に取得（将来のタブ追加に追従）。
// 横スクロール可能な要素（stats バー・テーブル等）上の水平スワイプは、その要素の
// スクロールを優先し、タブ移動を発火させない（PTR の touchInScrollable と同方針）。
// 依存: tabs.js (switchTab), state.js
// ══════════════════════════════════════════════════════════════

import { switchTab } from './tabs.js';
import { state } from './state.js';

const DIST_THRESHOLD = 60;   // 横移動量の下限(px)
const RATIO          = 1.6;  // 横優位の判定（|dx| > |dy| * RATIO）
const TIME_LIMIT     = 600;  // これより遅いドラッグは無視(ms)
const EDGE_IGNORE    = 20;   // 端からの開始は無視(px・iOS 戻るジェスチャ回避)

/** 表示中タブの並びを DOM から取得 */
function tabOrder() {
  return /** @type {string[]} */ (
    [...document.querySelectorAll('.tab-btn[data-tab]')]
      .map(b => /** @type {HTMLElement} */ (b).dataset.tab)
      .filter(Boolean)
  );
}

/** モーダル/オーバーレイが開いている間はスワイプ無効 */
function overlayOpen() {
  if (document.getElementById('pin-overlay')) return true;
  for (const ov of document.querySelectorAll('.modal-overlay')) {
    if (getComputedStyle(/** @type {HTMLElement} */ (ov)).display !== 'none') return true;
  }
  return false;
}

/**
 * スワイプ方向に「まだスクロール余地がある」横スクロール祖先があれば true。
 * その場合はタブ移動ではなく要素スクロールを優先する。
 * @param {EventTarget|null} target
 * @param {number} dx  負=左スワイプ（右方向へスクロール表示）/ 正=右スワイプ
 */
function inHScrollable(target, dx) {
  let el = /** @type {HTMLElement|null} */ (target);
  while (el && el !== document.body) {
    if (el.scrollWidth > el.clientWidth + 2) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') {
        const max = el.scrollWidth - el.clientWidth;
        if (dx < 0 && el.scrollLeft < max - 1) return true; // 右側にまだ送れる
        if (dx > 0 && el.scrollLeft > 1) return true;        // 左側にまだ送れる
      }
    }
    el = el.parentElement;
  }
  return false;
}

/** 左右スワイプでのタブ移動を設定する（init から一度だけ呼ぶ） */
export function setupSwipeNav() {
  if (!('ontouchstart' in window)) return;

  let startX = 0;
  let startY = 0;
  let startT = 0;
  let startTarget = /** @type {EventTarget|null} */ (null);
  let tracking = false;

  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { tracking = false; return; }
    const t = e.touches[0];
    if (t.clientX <= EDGE_IGNORE || t.clientX >= window.innerWidth - EDGE_IGNORE) {
      tracking = false; return;
    }
    startX = t.clientX; startY = t.clientY; startT = Date.now();
    startTarget = e.target; tracking = true;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!tracking) return;
    tracking = false;
    if (overlayOpen()) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Date.now() - startT > TIME_LIMIT) return;
    if (Math.abs(dx) < DIST_THRESHOLD) return;
    if (Math.abs(dx) < Math.abs(dy) * RATIO) return;   // 縦優位 → スクロール
    if (inHScrollable(startTarget, dx)) return;         // 横スクロール優先

    const order = tabOrder();
    const cur = order.indexOf(state.activeTab);
    if (cur === -1) return;
    const next = dx < 0 ? cur + 1 : cur - 1;            // 左スワイプ=次 / 右=前
    if (next < 0 || next >= order.length) return;
    switchTab(/** @type {any} */ (order[next]));
  }, { passive: true });
}
