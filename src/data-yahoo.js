import { state } from './state.js';
import { WORKER_URL } from './config.js';
import { fetchWithTimeout } from './data-helpers.js';

/**
 * Yahoo Finance API を CORS プロキシ経由で取得する（4段フォールバック）
 * query1 直接 → query2 直接 → corsproxy.io → allorigins の順に試行
 * @param {string} url - Yahoo Finance API URL（query1.finance.yahoo.com）
 * @param {number} [timeoutMs=7000] 1試行あたりのタイムアウトミリ秒
 * @returns {Promise<Object|null>} パースされた JSON、失敗時は null
 */
export async function fetchViaProxy(url, timeoutMs = 7000) {
  const q2url = url.replace('query1.finance.yahoo.com', 'query2.finance.yahoo.com');
  const attempts = [
    // Worker 経由（最優先：CORS 確実・APIキー不要）
    { url: `${WORKER_URL}/yahoo?url=${encodeURIComponent(url)}`,               opts: {} },
    // 以下は Worker が落ちているときのフォールバック
    { url,                                                                      opts: { credentials: 'include' } },
    { url: q2url,                                                               opts: { credentials: 'include' } },
    { url: `https://corsproxy.io/?${encodeURIComponent(url)}`,                 opts: {} },
    { url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,    opts: {} },
  ];
  for (const { url: u, opts } of attempts) {
    try {
      const res = await fetchWithTimeout(u, timeoutMs, opts);
      if (!res.ok) continue;
      const raw = await res.json();
      // allorigins wraps content in { contents: "..." }
      return raw?.contents ? JSON.parse(raw.contents) : raw;
    } catch { /* try next */ }
  }
  return null;
}

/**
 * Yahoo Finance crumb を取得・キャッシュする（有効期限 55 分）
 * crumb は Yahoo Finance v7 API の認証に必要なトークン
 * @returns {Promise<string|null>}
 */
export async function ensureYahooCrumb() {
  const now = Date.now();
  if (state.yahooCrumb && now < state.yahooCrumbExpiry) return state.yahooCrumb;
  try {
    const res = await fetchWithTimeout(
      'https://query1.finance.yahoo.com/v1/test/getcrumb', 5000,
      { credentials: 'include' }
    );
    if (res.ok) {
      const text = await res.text();
      // crumb は短い文字列（HTMLでない）
      if (text && text.length < 50 && !text.startsWith('<')) {
        state.yahooCrumb = text.trim();
        state.yahooCrumbExpiry = now + 55 * 60 * 1000; // 55分
        return state.yahooCrumb;
      }
    }
  } catch { /* crumb なしで継続 */ }
  state.yahooCrumb = null;
  return null;
}

/**
 * Correct stock split / merger detected in historical data
 * Yahoo adjclose doesn't always reflect the most recent splits,
 * so we auto-adjust based on detecting ±50% daily moves.
 * @param {Array<{date: Date, close: number}>} entries
 * @returns {Array<{date: Date, close: number}>}
 */
export function applySplitCorrection(entries) {
  if (entries.length < 2) return entries;
  // Walk backwards from latest, correcting ancient prices by ratio
  for (let i = entries.length - 1; i >= 1; i--) {
    const a = entries[i].close;
    const b = entries[i - 1].close;
    if (!a || !b || a <= 0 || b <= 0) continue;
    const r = b / a;
    // 1.5x or 0.67x move in 1 day → split/merger
    if (r >= 1.5 || r <= 1 / 1.5) {
      for (let j = 0; j < i; j++) {
        if (entries[j].close > 0) entries[j].close /= r;
      }
    }
  }
  return entries;
}
