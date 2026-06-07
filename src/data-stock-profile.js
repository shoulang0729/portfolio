// @ts-check
// ══════════════════════════════════════════════════════════════
// data-stock-profile.js  ―  Finnhub /stock/profile2 で個別株の
//   セクター（finnhubIndustry）・国を取得し state.liveConstituents に投入する。
//
// リスク断面 Phase B / B4（#203）。curated（constituents-overrides.json）に
// 載っていない個別株を自動分類し、curated 依存を削減する。
//
// 方針:
//   - curated 済みの銘柄は上書きしない（手調整の nuance を保護）
//   - proxy（投信）・現金は対象外
//   - 取得結果は single-holding（weight 1）の live constituent として投入し、
//     risk-calc の live > curated > 既定推定 マージ（#207）に乗せる
//   - 取得不可・未マップ時は何もしない → deriveDefault（cat/cur）にフォールバック
//
// 依存: data-finnhub.js (toFinnhubSymbol) / config.js / positions.js /
//       constituents.js / state.js
// ══════════════════════════════════════════════════════════════

import { WORKER_URL } from './config.js';
import { toFinnhubSymbol } from './data-finnhub.js';
import { positions } from './positions.js';
import { CONSTITUENTS } from './constituents.js';
import { state } from './state.js';

/**
 * Finnhub `finnhubIndustry` → アプリ内セクターキー マッピング。
 * Finnhub の業種文字列は表記揺れがあるため、小文字化して部分一致でも拾えるよう
 * 正規化キー（lowercase）で持つ。
 * @type {Record<string, string>}
 */
const FINNHUB_INDUSTRY_MAP = {
  'technology': 'tech',
  'software': 'tech',
  'internet': 'tech',
  'it services': 'tech',
  'semiconductors': 'semis',
  'banking': 'financials',
  'financial services': 'financials',
  'insurance': 'financials',
  'diversified financials': 'financials',
  'healthcare': 'healthcare',
  'health care': 'healthcare',
  'pharmaceuticals': 'healthcare',
  'biotechnology': 'healthcare',
  'retail': 'consumer',
  'automobiles': 'consumer',
  'auto components': 'consumer',
  'hotels restaurants & leisure': 'consumer',
  'textiles apparel & luxury goods': 'consumer',
  'consumer products': 'consumer',
  'leisure products': 'consumer',
  'food products': 'staples',
  'beverages': 'staples',
  'tobacco': 'staples',
  'household products': 'staples',
  'industrial conglomerates': 'industrials',
  'machinery': 'industrials',
  'aerospace & defense': 'industrials',
  'logistics & transportation': 'industrials',
  'electrical equipment': 'industrials',
  'building': 'industrials',
  'commercial services & supplies': 'industrials',
  'trading companies & distributors': 'industrials',
  'airlines': 'industrials',
  'energy': 'energy',
  'oil & gas': 'energy',
  'chemicals': 'materials',
  'metals & mining': 'materials',
  'basic materials': 'materials',
  'construction materials': 'materials',
  'paper & forest': 'materials',
  'media': 'comm',
  'telecommunication': 'comm',
  'communications': 'comm',
  'entertainment': 'comm',
  'utilities': 'utilities',
  'real estate': 'realestate',
};

/**
 * Finnhub profile2 `country`（ISO-2）→ アプリ内 国・地域キー マッピング。
 * @type {Record<string, string>}
 */
const FINNHUB_COUNTRY_MAP = {
  US: 'us',
  JP: 'japan',
  CN: 'china', HK: 'china',
  BR: 'latam', MX: 'latam', AR: 'latam', CL: 'latam', CO: 'latam', PE: 'latam',
  GB: 'europe', DE: 'europe', FR: 'europe', CH: 'europe', NL: 'europe',
  IT: 'europe', ES: 'europe', SE: 'europe', NO: 'europe', DK: 'europe',
  FI: 'europe', BE: 'europe', AT: 'europe', IE: 'europe', PT: 'europe',
  IN: 'em', ID: 'em', TH: 'em', TR: 'em', ZA: 'em', KR: 'em', TW: 'em',
  MY: 'em', PH: 'em', VN: 'em', PL: 'em', SA: 'em', AE: 'em',
};

/** sessionStorage キャッシュキー */
const STORAGE_KEY = 'hm-stock-profiles';

/**
 * Finnhub の業種文字列をアプリ内セクターキーに変換する。
 * 完全一致 → 部分一致（含む）の順で解決。未知なら null。
 * @param {string} [industry]
 * @returns {string|null}
 */
export function mapFinnhubIndustry(industry) {
  if (!industry) return null;
  const key = industry.trim().toLowerCase();
  if (FINNHUB_INDUSTRY_MAP[key]) return FINNHUB_INDUSTRY_MAP[key];
  for (const [k, v] of Object.entries(FINNHUB_INDUSTRY_MAP)) {
    if (key.includes(k)) return v;
  }
  return null;
}

/**
 * Finnhub の国コードをアプリ内 国・地域キーに変換する。未知なら null。
 * @param {string} [country]
 * @returns {string|null}
 */
export function mapFinnhubCountry(country) {
  if (!country) return null;
  return FINNHUB_COUNTRY_MAP[country.trim().toUpperCase()] || null;
}

/**
 * profile2 のレスポンスと通貨から single-holding の live constituent を組み立てる。
 * セクター・国のどちらも未マップなら、curated/既定推定に委ねるため null を返す。
 * @param {{finnhubIndustry?: string, country?: string}} profile
 * @param {string} symbol
 * @param {string} [cur] 通貨（positions[].cur）
 * @returns {{holdings: Array<object>, asOf: string, source: string}|null}
 */
export function buildStockConstituent(profile, symbol, cur) {
  const sector = mapFinnhubIndustry(profile?.finnhubIndustry);
  const country = mapFinnhubCountry(profile?.country);
  if (!sector && !country) return null; // 付与できる属性が無ければ投入しない
  /** @type {Record<string, any>} */
  const holding = {
    ticker: symbol,
    name: symbol,
    weight: 1,
    currency: cur === 'USD' ? 'USD' : cur === 'JPY' ? 'JPY' : (cur || ''),
    assetClass: 'equity',
  };
  if (sector) holding.sector = sector;
  if (country) holding.country = country;
  return { holdings: [holding], asOf: new Date().toISOString(), source: 'finnhub' };
}

/**
 * 個別株の profile2 を Worker /finnhub プロキシ経由で取得する。
 * @param {string} ySymbol
 * @returns {Promise<{finnhubIndustry?: string, country?: string}|null>}
 */
export async function fetchStockProfile(ySymbol) {
  const fSym = toFinnhubSymbol(ySymbol);
  const url = `${WORKER_URL}/finnhub?path=/stock/profile2&symbol=${encodeURIComponent(fSym)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || (!data.finnhubIndustry && !data.country)) return null;
    return data;
  } catch (e) {
    console.warn(`[stock-profile] fetchStockProfile(${ySymbol}) failed:`, e);
    return null;
  }
}

/**
 * 対象個別株（proxy/現金/ curated 済みを除く）について profile2 を取得し、
 * state.liveConstituents に投入する。sessionStorage でセッション内キャッシュ。
 * @param {Array<{symbol?: string, ySymbol?: string, cur?: string, isProxy?: boolean}>} [posList]
 * @returns {Promise<void>}
 */
export async function loadStockProfiles(posList = positions) {
  // sessionStorage 復元（起動直後の二重取得を防ぐ）
  try {
    const cached = sessionStorage.getItem(STORAGE_KEY);
    if (cached) {
      Object.assign(state.liveConstituents, JSON.parse(cached));
      return;
    }
  } catch { /* sessionStorage 失敗は無視 */ }

  /** @type {Record<string, object>} */
  const fetched = {};
  for (const p of posList) {
    const symbol = p.symbol;
    if (!symbol || !p.ySymbol) continue;
    if (p.isProxy) continue;                       // 投信 proxy は対象外
    if (symbol.includes('現金')) continue;          // 現金は対象外
    if (CONSTITUENTS[symbol]) continue;            // curated 済みは上書きしない

    const profile = await fetchStockProfile(p.ySymbol);
    if (!profile) continue;
    const entry = buildStockConstituent(profile, symbol, p.cur);
    if (entry) {
      state.liveConstituents[symbol] = entry;
      fetched[symbol] = entry;
    }
  }

  try {
    if (Object.keys(fetched).length > 0) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.liveConstituents));
    }
  } catch { /* quota オーバーは無視 */ }
}
