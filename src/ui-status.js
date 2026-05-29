// @ts-check

// ══════════════════════════════════════════════════════════════
// ui-status.js  ―  UI status updates & animations
// ══════════════════════════════════════════════════════════════

/**
 * Update status indicator (dot + text) with message and color
 * @param {string} msg
 * @param {string} color - 'red' | 'yellow' | (green default)
 */
export function setStatus(msg, color) {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  dot.className = `dot${  color === 'red' ? ' red' : color === 'yellow' ? ' yellow' : ''}`;
  txt.textContent = msg;
}

/**
 * Flash heatmap cells when prices change
 * up → flash-up (brighter), down → flash-down (darker)
 * @param {Array<{pos, live}>} fetched
 */
export function flashPriceChanges(fetched) {
  const { state } = window;
  const hasPrev = Object.keys(state.prevPrices).length > 0;
  if (!hasPrev) {
    // First fetch: record prices without animation
    fetched.forEach(({ pos: p, live }) => {
      if (live?.price && p.ySymbol) state.prevPrices[p.ySymbol] = live.price;
    });
    return;
  }

  const changes = [];
  fetched.forEach(({ pos: p, live }) => {
    if (!live?.price || !p.ySymbol) return;
    const prev = state.prevPrices[p.ySymbol];
    if (prev != null && prev !== live.price) {
      changes.push({ ySymbol: p.ySymbol, direction: live.price > prev ? 'up' : 'down' });
    }
    state.prevPrices[p.ySymbol] = live.price;
  });

  if (changes.length === 0) return;

  // Apply animation class on next frame
  requestAnimationFrame(() => {
    const svg = document.getElementById('heatmap');
    if (!svg) return;
    changes.forEach(({ ySymbol, direction }) => {
      const rect = svg.querySelector(`rect[data-ysymbol="${CSS.escape(ySymbol)}"]`);
      if (!rect) return;
      const cls = direction === 'up' ? 'flash-up' : 'flash-down';
      // Remove existing classes to reset animation
      rect.classList.remove('flash-up', 'flash-down');
      void rect.getBoundingClientRect(); // reflow
      rect.classList.add(cls);
      rect.addEventListener('animationend', () => rect.classList.remove(cls), { once: true });
    });
  });
}
