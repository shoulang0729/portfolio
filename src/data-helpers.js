// ──────────────────────────────────────────────
// SHARED HELPERS
// ──────────────────────────────────────────────

/**
 * タイムアウト付き fetch ラッパー
 * @param {string} url
 * @param {number} [ms=7000] タイムアウトミリ秒
 */
export function fetchWithTimeout(url, ms = 7000, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const { signal: existingSignal, ...restOpts } = opts;
  const signal = existingSignal
    ? (typeof AbortSignal.any === 'function'
      ? AbortSignal.any([ctrl.signal, existingSignal])
      : ctrl.signal)
    : ctrl.signal;
  return fetch(url, { signal, ...restOpts }).finally(() => clearTimeout(timer));
}

/** 指定ミリ秒待機する */
export const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * バッチ処理 + 自動リトライの共通ヘルパー
 * @param {Array} items - 処理対象の配列
 * @param {Function} fn - 各アイテムを処理する非同期関数
 * @param {Object} [opts] - オプション
 * @param {number} [opts.batchSize=5] - バッチサイズ
 * @param {number} [opts.batchDelay=300] - バッチ間の待機ms
 * @param {number} [opts.retryDelay=2000] - リトライ前の待機ms
 * @param {Function} [opts.isFailed] - 失敗判定関数（default: r => !r）
 * @param {Function} [opts.onProgress] - 進捗コールバック (done, total) => void
 * @returns {Promise<Array>} 全結果
 */
export async function batchWithRetry(items, fn, opts = {}) {
  const {
    batchSize = 5,
    batchDelay = 300,
    retryDelay = 2000,
    isFailed = r => !r,
    onProgress = null,
  } = opts;

  const results = [];
  let done = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(async item => {
      const result = await fn(item);
      done++;
      if (onProgress) onProgress(done, items.length);
      return result;
    }));
    results.push(...batchResults);
    if (i + batchSize < items.length) await sleep(batchDelay);
  }

  // 失敗したアイテムをリトライ
  const failedIndices = results.map((r, idx) => isFailed(r, idx) ? idx : -1).filter(idx => idx >= 0);
  if (failedIndices.length > 0) {
    await sleep(retryDelay);
    await Promise.all(failedIndices.map(async idx => {
      results[idx] = await fn(items[idx]);
    }));
  }

  return results;
}
