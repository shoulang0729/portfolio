// @ts-check

// ══════════════════════════════════════════════════════════════
// ui-status.js  ―  UI status updates & animations
// ══════════════════════════════════════════════════════════════

import { state } from './state.js';

/**
 * @typedef {object} Position
 * @property {string} ySymbol - Yahoo Finance symbol
 */

/**
 * @typedef {object} PriceChange
 * @property {Position} pos - Position in portfolio
 * @property {{price: number}} live - Live price data
 */

/**
 * Update status indicator (dot + text) with message and color
 * @param {string} msg - Status message to display
 * @param {'red' | 'yellow' | string} [color] - Status dot color ('red' | 'yellow' | default green)
 * @returns {void}
 */
export function setStatus(msg, color) {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  // @ts-ignore dot/txt always exist in DOM
  dot.className = `dot${  color === 'red' ? ' red' : color === 'yellow' ? ' yellow' : ''}`;
  // @ts-ignore dot/txt always exist in DOM
  txt.textContent = msg;
}

/**
 * Flash heatmap cells when prices change
 * up → flash-up (brighter), down → flash-down (darker)
 * @param {Array<PriceChange>} fetched - Array of price updates
 * @returns {void}
 */
export function flashPriceChanges(fetched) {
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

/**
 * Format relative time: "2m ago", "1h ago", etc.
 * @param {number} ts - Timestamp in milliseconds
 * @returns {string} Relative time string
 */
function formatRelativeTime(ts) {
  if (!ts) return '';
  const now = Date.now();
  const diff = Math.floor((now - ts) / 1000); // seconds
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Render provider health indicator
 * Shows status of Finnhub and Yahoo Finance providers
 * @returns {void}
 */
export function renderProviderHealth() {
  const el = document.getElementById('provider-health');
  if (!el) return;

  const { finnhub, yahoo } = state.providerHealth;
  const parts = [];

  // Finnhub status
  const fhStatus = finnhub.ok ? '✓' : `✗(${finnhub.errCount})`;
  const fhTime = finnhub.ok && finnhub.lastOk ? ` ${formatRelativeTime(finnhub.lastOk)}` : '';
  parts.push(`Finnhub ${fhStatus}${fhTime}`);

  // Yahoo status
  const yhStatus = yahoo.ok ? '✓' : `✗(${yahoo.errCount})`;
  const yhTime = yahoo.ok && yahoo.lastOk ? ` ${formatRelativeTime(yahoo.lastOk)}` : '';
  parts.push(`Yahoo ${yhStatus}${yhTime}`);

  el.textContent = parts.join(' | ');
  el.className = `provider-health ${finnhub.ok && yahoo.ok ? 'health-ok' : 'health-warn'}`;
}
