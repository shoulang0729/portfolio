// ══════════════════════════════════════════════════════════════
// cache.js  ―  Session storage cache for historical data
// ══════════════════════════════════════════════════════════════

import { state } from './state.js';

const SS_CACHE_KEY = 'hm-hist-cache';
const SS_CACHE_VER = '2'; // Increment on structural changes

/**
 * Restore historicalCache from sessionStorage (survives page reload within session)
 */
export function loadCacheFromSession() {
  try {
    const raw = sessionStorage.getItem(SS_CACHE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj._v !== SS_CACHE_VER) return; // Version mismatch → discard
    for (const range of ['1y', '5y', '10y']) {
      if (!obj[range]) continue;
      for (const [sym, entries] of Object.entries(obj[range])) {
        // Restore ISO string → Date
        state.historicalCache[range][sym] = entries.map(e => ({
          date:  new Date(e.date),
          close: e.close,
        }));
      }
    }
  } catch (e) {
    console.warn('[cache] sessionStorage load failed:', e);
    sessionStorage.removeItem(SS_CACHE_KEY);
  }
}

/**
 * Persist historicalCache to sessionStorage after fetch
 * Handles QuotaExceededError gracefully
 */
export function saveCacheToSession() {
  try {
    const obj = { _v: SS_CACHE_VER };
    // 5y はストレス（D-1）用の重い系列（~2MB）。sessionStorage(~5MB) quota を圧迫するため
    // 永続化は IDB のみとし、sessionStorage には載せない（#428）。
    for (const range of ['1y', '10y']) {
      obj[range] = {};
      for (const [sym, entries] of Object.entries(state.historicalCache[range] || {})) {
        // Date → ISO string (JSON serializable)
        obj[range][sym] = entries.map(e => ({
          date:  e.date instanceof Date ? e.date.toISOString() : e.date,
          close: e.close,
        }));
      }
    }
    sessionStorage.setItem(SS_CACHE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn('[cache] sessionStorage save failed (quota?):', e);
  }
}

/**
 * Clear historical cache from sessionStorage (e.g., on CSV import)
 */
export function clearCacheSession() {
  sessionStorage.removeItem(SS_CACHE_KEY);
}

// Auto-restore cache on module load (after state.js)
loadCacheFromSession();
