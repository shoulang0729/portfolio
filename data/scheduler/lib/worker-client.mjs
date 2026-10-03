// @ts-check
// worker-client.mjs — Worker 中継口（portfolio-proxy）の共通クライアント（#652 §2.2）。
//
// - ベース URL は WORKER_BASE。全リクエストに Origin: https://shoulang0729.github.io を付ける。
// - タイムアウト 25 秒。429 / 5xx / ネットワークエラー（タイムアウト含む）は最大 3 回リトライ（2s→4s→8s）。
// - レート制限対象パス（/yahoo /finnhub /fmp /edgar /edinet-db）は呼び出し間隔を最低 600ms あける。
//   /watchlist などそれ以外のパスはスロットル対象外。
// - API キーは扱わない（Worker Secrets が付与する）。

export const WORKER_BASE = 'https://portfolio-proxy.shoulang.workers.dev';
export const ORIGIN = 'https://shoulang0729.github.io';

export const TIMEOUT_MS = 25_000;
export const RETRY_DELAYS_MS = [2000, 4000, 8000];
export const THROTTLE_MS = 600;
export const THROTTLED_PREFIXES = ['/yahoo', '/finnhub', '/fmp', '/edgar', '/edinet-db'];

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * レート制限対象パスか（クエリ文字列は無視）。
 * @param {string} path 例: '/yahoo?url=...'
 */
export function isThrottledPath(path) {
  const p = path.split('?')[0];
  return THROTTLED_PREFIXES.some((pre) => p === pre || p.startsWith(`${pre}/`));
}

/** リトライ対象の HTTP ステータスか（429 / 5xx）。 @param {number} status */
export function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

let lastThrottledAt = 0;

async function throttle() {
  const wait = lastThrottledAt + THROTTLE_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastThrottledAt = Date.now();
}

/**
 * Worker 中継口を呼ぶ。最終的に得た Response を返す（429/5xx でもリトライを使い切ったらその Response を返す）。
 * ネットワークエラーがリトライを使い切った場合は最後のエラーを throw する。
 * @param {string} path '/watchlist' など（先頭スラッシュ付き）
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export async function workerFetch(path, init = {}) {
  const url = `${WORKER_BASE}${path}`;
  const headers = new Headers(init.headers || {});
  headers.set('Origin', ORIGIN);
  const throttled = isThrottledPath(path);

  /** @type {unknown} */
  let lastErr = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);
    if (throttled) await throttle();
    try {
      const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (isRetryableStatus(res.status) && attempt < RETRY_DELAYS_MS.length) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// ── 中継口ヘルパー（#652 PR5・§8.1）──────────────────────────────
// いずれも workerFetch 経由（Origin・タイムアウト・リトライ・スロットル共通）。
// 非 2xx は `HTTP <status>` だけを持つ Error を throw する（公開ログに本文を出さないため本文は読まない）。

/**
 * Worker 中継口を GET して JSON を返す。
 * @param {string} path '/fmp?path=...' など（先頭スラッシュ付き）
 * @returns {Promise<any>}
 */
export async function workerJson(path) {
  const res = await workerFetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * `<route>?path=<path>&<params>` を組み立てる（値は URL エンコード）。
 * @param {string} route '/fmp' など
 * @param {string} path 上流 API のパス（例: '/stable/profile'）
 * @param {Record<string, string|number>} [params]
 */
export function relayPath(route, path, params = {}) {
  const qs = new URLSearchParams({ path });
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  return `${route}?${qs}`;
}

/**
 * FMP（/fmp）。apikey は Worker が付与する。
 * @param {string} path 例: '/stable/income-statement'
 * @param {Record<string, string|number>} [params]
 */
export const fmp = (path, params = {}) => workerJson(relayPath('/fmp', path, params));

/**
 * EDINET DB（/edinet-db）。X-API-Key は Worker が付与する。
 * @param {string} path 例: '/v1/search'
 * @param {Record<string, string|number>} [params]
 */
export const edinetDb = (path, params = {}) => workerJson(relayPath('/edinet-db', path, params));

/**
 * SEC EDGAR（/edgar）。XBRL 系パスのみ（Worker の許可パス）。
 * @param {string} path 例: '/api/xbrl/companyfacts/CIK0000320193.json'
 */
export const edgar = (path) => workerJson(relayPath('/edgar', path));

/**
 * Finnhub（/finnhub）。token は Worker が付与する。
 * @param {string} path 例: '/stock/peers'
 * @param {Record<string, string|number>} [params]
 */
export const finnhub = (path, params = {}) => workerJson(relayPath('/finnhub', path, params));

/**
 * Yahoo Finance quoteSummary を Worker /yahoo 経由で取得し、パース済み JSON を返す（#652 PR2 で追加）。
 * 原本（watchlist-per / fund-per）の curl と同じ URL を組み立てる。HTTP ステータスに関わらず本文を JSON として読む
 * （原本の `curl -s` と同じ）。JSON でなければ throw（メッセージに本文は含めない＝公開ログ対策）。
 * @param {string} sym Yahoo シンボル（例: 'AAPL' / '8001.T'）
 * @param {string} modules 例: 'summaryDetail,defaultKeyStatistics'
 * @returns {Promise<any>}
 */
export async function yahooQuoteSummary(sym, modules) {
  const y = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=${modules}`;
  const res = await workerFetch(`/yahoo?url=${encodeURIComponent(y)}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`parse(http=${res.status})`);
  }
}
