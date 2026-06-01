import { WORKER_URL } from './config.js';
import { fetchWithTimeout } from './data-helpers.js';

/**
 * Yahoo Finance シンボルを Finnhub シンボルに変換
 * 例: '9983.T' → 'TYO:9983' / 'AAPL' → 'AAPL'
 */
export function toFinnhubSymbol(ySymbol) {
  if (!ySymbol) return null;
  if (ySymbol.endsWith('.T')) return `TYO:${  ySymbol.slice(0, -2)}`;
  if (ySymbol.endsWith('.HK')) return `HKG:${  ySymbol.slice(0, -3)}`;
  return ySymbol;
}

/**
 * Finnhub Quote API でライブ価格・当日騰落率を取得（Worker経由）
 * @returns {Promise<{price: number, dayPct: number|null}|{_err: string}>}
 */
export async function fetchFinnhubQuote(fSymbol) {
  const url = `${WORKER_URL}/finnhub?path=/quote&symbol=${encodeURIComponent(fSymbol)}`;
  try {
    const res = await fetchWithTimeout(url, 7000);
    if (res.status === 429) return { _err: 'rateLimit' };
    if (res.status >= 500) return { _err: 'serverError' };
    if (!res.ok) return { _err: 'noData' };
    const d = await res.json();
    if (!d || !d.c) return { _err: 'noData' };
    return { price: d.c, dayPct: d.dp ?? null };
  } catch (e) {
    if (e?.name === 'AbortError') return { _err: 'timeout' };
    return { _err: 'networkError' };
  }
}

/**
 * Finnhub Candles API で日足履歴データを取得（Worker経由）
 * @param {string} fSymbol - Finnhub シンボル
 * @param {number} fromTs  - 開始 UNIX タイムスタンプ（秒）
 * @param {number} toTs    - 終了 UNIX タイムスタンプ（秒）
 * @returns {Promise<Array<{date, close}>|null>}
 */
export async function fetchFinnhubCandles(fSymbol, fromTs, toTs) {
  const url = `${WORKER_URL}/finnhub?path=/stock/candle&symbol=${encodeURIComponent(fSymbol)}&resolution=D&from=${fromTs}&to=${toTs}`;
  try {
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) return null;
    const d = await res.json();
    if (d?.s !== 'ok' || !d.t?.length) return null;
    return d.t.map((ts, i) => ({ date: new Date(ts * 1000), close: d.c[i] }))
              .filter(p => p.close != null && isFinite(p.close));
  } catch { return null; }
}
