import { WORKER_URL } from './config.js';
import { fetchWithTimeout } from './data-helpers.js';

/**
 * Worker /forex を経由して為替レートを取得する
 * @param {string} from - 通貨コード（例："USD"）
 * @param {string} to - 通貨コード（例："JPY"）
 * @returns {Promise<number|null>} レート、失敗時は null
 */
export async function fetchForexRate(from, to) {
  try {
    const res = await fetchWithTimeout(
      `${WORKER_URL}/forex?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      8000
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.rate ?? null;
  } catch (e) {
    console.warn(`[forex] 為替レート取得失敗 ${from}/${to}:`, e);
    return null;
  }
}
