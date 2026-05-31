// @ts-check
// ══════════════════════════════════════════════════════════════
// data-topholdings.js  ―  Yahoo Finance topHoldings から分散ファンドの
//                         実セクター比率を取得し state.liveTopHoldings に格納する。
//
// 依存: data-yahoo.js (fetchViaProxy) / positions.js / state.js
// ══════════════════════════════════════════════════════════════

import { fetchViaProxy } from './data-yahoo.js';
import { positions } from './positions.js';
import { state } from './state.js';

/**
 * Yahoo Finance topHoldings の sector キー → アプリ内セクターキー マッピング。
 * @type {Record<string, string>}
 */
const YAHOO_SECTOR_MAP = {
  technology:            'tech',
  financial_services:    'financials',
  healthcare:            'healthcare',
  consumer_cyclical:     'consumer',
  consumer_defensive:    'staples',
  industrials:           'industrials',
  energy:                'energy',
  basic_materials:       'materials',
  communication_services:'comm',
  utilities:             'utilities',
  realestate:            'realestate',
};

/**
 * セクター比率をライブ取得する対象シンボル（positions[].symbol）の許可リスト。
 * ここに含まれる銘柄だけ fetchTopHoldingsSector を呼ぶ。
 * @type {string[]}
 */
export const TOPHOLDINGS_ALLOWLIST = ['オルカン', '1306'];

/** sessionStorage キャッシュキー */
const STORAGE_KEY = 'hm-topholdings';

/**
 * Yahoo Finance quoteSummary topHoldings から ySymbol のセクター比率を取得する。
 * sectorWeightings を YAHOO_SECTOR_MAP で変換し `{ourKey: weight}` に正規化する。
 *
 * @param {string} ySymbol - Yahoo Finance シンボル（例: 'ACWI', '1306.T'）
 * @returns {Promise<Record<string, number>|null>} セクターマップ（失敗時 null）
 */
export async function fetchTopHoldingsSector(ySymbol) {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySymbol)}?modules=topHoldings`;
  try {
    const data = await fetchViaProxy(url);
    const weightings = data?.quoteSummary?.result?.[0]?.topHoldings?.sectorWeightings;
    if (!Array.isArray(weightings) || weightings.length === 0) return null;

    /** @type {Record<string, number>} */
    const result = {};
    for (const entry of weightings) {
      for (const [yahooKey, val] of Object.entries(entry)) {
        const ourKey = YAHOO_SECTOR_MAP[yahooKey];
        if (!ourKey) continue;
        const weight = typeof val === 'object' ? val.raw : Number(val);
        if (typeof weight === 'number' && weight > 0) {
          result[ourKey] = (result[ourKey] || 0) + weight;
        }
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch (e) {
    console.warn(`[topholdings] fetchTopHoldingsSector(${ySymbol}) failed:`, e);
    return null;
  }
}

/**
 * TOPHOLDINGS_ALLOWLIST の各シンボルについて topHoldings を取得し
 * `state.liveTopHoldings` に格納する。sessionStorage でセッション内キャッシュ。
 *
 * @returns {Promise<void>}
 */
export async function loadTopHoldings() {
  // sessionStorage 復元（起動直後の二重取得を防ぐ）
  try {
    const cached = sessionStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      Object.assign(state.liveTopHoldings, parsed);
      return;
    }
  } catch { /* sessionStorage 失敗は無視 */ }

  for (const symbol of TOPHOLDINGS_ALLOWLIST) {
    // positions から ySymbol を引く
    const pos = positions.find(p => p.symbol === symbol);
    if (!pos?.ySymbol) continue;

    const sector = await fetchTopHoldingsSector(pos.ySymbol);
    if (sector) {
      state.liveTopHoldings[symbol] = {
        sector,
        asOf: new Date().toISOString(),
      };
    }
  }

  // sessionStorage に保存（キャッシュ）
  try {
    if (Object.keys(state.liveTopHoldings).length > 0) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.liveTopHoldings));
    }
  } catch { /* quota オーバーは無視 */ }
}
