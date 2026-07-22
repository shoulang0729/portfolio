// @ts-check

// ══════════════════════════════════════════════════════════════
// networth.js  ―  Money Forward 実値（mf-holdings 相当）を供給する
//
// 設計（2026/06 確定・2026/07 #589 Phase2 で取得元を変更・2026/07 #594 数値モデル再定義）:
//   - 値動き（Heatmap/Historical/当日色）= positions.js のライブ価格（無改修）
//   - 資産総額・現金・暗号資産 = ここ（Money Forward 実値・週次 Chrome 取込）
//   - キャッシュ比率 = 投資用キャッシュ ÷ 運用資産
//
// 取得元（#589 Phase2）: 負債/実物資産等の機微データは Worker `/networth`
// （KV・PIN認証と同方式）を優先して取得する。Worker 取得に失敗した場合
// （未認証オリジン・ネットワーク断等）は従来の公開 `data/mf-holdings.json`
// （Phase1でサニタイズ済み・liabilities 等を含まない v4 形）にフォールバック
// する。これにより未認証時は自動的に「負債非表示」degrade になる（v4 互換）。
//
// 数値モデル（#594・docs/wealth-networth-spec.md 正本・2026-07-21 確定）:
//   総資産   = mfNetWorth（MFそのまま）
//   運用資産  = 金融資産（現金+株+信用+投信+債券+FX+暗号+保険+年金）− 生活資金¥20M
//              ★除外：ポイント・その他・不動産
//   不動産補正 = realEstateMf − realAssetsTotal（realEstateMf 未取得時 = 0）
//   純資産   = mfNetWorth − 不動産補正 − liabilitiesTotal
//              ★旧 netWorthComputed（imported + realAssetsTotal − liabilitiesTotal）は廃止
// ══════════════════════════════════════════════════════════════

import { WORKER_URL } from './config.js';
import { fetchWithTimeout } from './data.js';
import { _getActivePinHash } from './auth-pin.js';

const MF_URL = 'data/mf-holdings.json';
/** 生活防衛資金（キャッシュ比率の分子・分母から除外）。2026/06 ユーザー決定 */
const EMERGENCY_FUND = 20_000_000;

/**
 * @typedef {{institution:string, name:string, tag?:string, balance:number, rate?:number, rateType?:string, asOf?:string}} MfLiability
 * @type {{asOf?:string, totals?:{imported?:number, mfNetWorth?:number, liabilitiesTotal?:number, realAssetsTotal?:number, realEstateMf?:number, netWorthComputed?:number}, holdings?:Array<{cat:string,cur?:string,value:number}>, liabilities?:MfLiability[]}|null}
 */
let _mf = null;

/**
 * ネットワースデータを読み込む。Worker `GET /networth`（KV・#589 Phase2）を
 * 優先し、失敗（未認証オリジン・ネットワーク断・空データ等）時のみ公開
 * `data/mf-holdings.json`（v4・サニタイズ済み）にフォールバックする。
 * 両方失敗した場合は null のまま（＝呼び出し側は positions フォールバック）。
 */
export async function loadMfHoldings() {
  const fromWorker = await _loadFromWorker();
  if (fromWorker) {
    _mf = fromWorker;
    return _mf;
  }
  _mf = await _loadFromPublicFile();
  return _mf;
}

/** Worker KV から取得。失敗/空データは null（呼び出し側でフォールバック判定）。
 * ★GET も PIN 認証必須（#589 AC3・curl の Origin なしバイパス対策）＝
 * 未認証（PIN ハッシュ無し）なら Worker を叩かず即フォールバック（負債非表示 degrade）。 */
async function _loadFromWorker() {
  try {
    const pinHash = _getActivePinHash();
    if (!pinHash) return null; // 未ログイン＝公開ファイル（サニタイズ済み）へ
    const r = await fetchWithTimeout(`${WORKER_URL}/networth`, 10000, { headers: { 'X-Pin-Hash': pinHash } });
    if (!r.ok) throw new Error(`networth ${r.status}`);
    const doc = await r.json();
    if (!doc || typeof doc !== 'object' || !doc.holdings) return null;
    return doc;
  } catch (e) {
    console.warn('[networth] Worker /networth 取得失敗。公開ファイルにフォールバック:', e);
    return null;
  }
}

/** 公開 data/mf-holdings.json から取得（Phase1 サニタイズ済み・v4 形）。失敗時 null。 */
async function _loadFromPublicFile() {
  try {
    const r = await fetch(`${MF_URL}?_=${Date.now()}`);
    if (!r.ok) throw new Error(`mf ${r.status}`);
    return await r.json();
  } catch {
    return null;
  }
}

/**
 * @param {(x:{cat:string,cur?:string,value:number})=>boolean} pred
 * @returns {number}
 */
function _sum(pred) {
  if (!_mf || !_mf.holdings) return 0;
  return _mf.holdings.reduce((a, x) => a + (pred(x) ? Number(x.value) || 0 : 0), 0);
}

/**
 * 総資産・運用資産・純資産・キャッシュ比率の集計（#594 数値モデル v6）。未ロードなら null。
 *
 * 数値モデル（docs/wealth-networth-spec.md 正本・2026-07-21 確定）:
 *   総資産   = mfNetWorth（MFそのまま）
 *   運用資産  = 金融資産（現金+株+信用+投信+債券+FX+暗号+保険+年金）− 生活資金¥20M
 *              ★除外：ポイント・その他・不動産
 *   純資産   = mfNetWorth − (realEstateMf − realAssetsTotal) − liabilitiesTotal
 *              realEstateMf 未取得時は不動産補正=0（degrade・エラーにしない）
 *
 * ★運用アロケーション（Heatmap/Risk/Valuation 等）の分母は imported のまま不変（#577 §B 厳守）。
 */
export function getMfTotals() {
  if (!_mf || !_mf.holdings) return null;
  const imported = (_mf.totals && _mf.totals.imported) || _sum(() => true);
  const netWorth = (_mf.totals && _mf.totals.mfNetWorth) || imported;
  const cash = _sum((x) => x.cat === '現金・預金');
  const crypto = _sum((x) => x.cat === '暗号資産');
  const securities = imported - cash - crypto;
  const dryPowder = Math.max(0, cash - EMERGENCY_FUND);
  const cashRatio = imported > 0 ? (dryPowder / imported) * 100 : 0;

  const t = _mf.totals || {};
  const hasLiabilities = typeof t.liabilitiesTotal === 'number';
  const realEstateMf = typeof t.realEstateMf === 'number' ? t.realEstateMf : undefined;
  const realAssetsTotal = typeof t.realAssetsTotal === 'number' ? t.realAssetsTotal : undefined;

  let investableAssets;
  let netWorthComputed;
  if (hasLiabilities) {
    const realEstateMfVal = realEstateMf || 0;
    const realAssetsTotalVal = realAssetsTotal || 0;
    const realEstateCorrection = realEstateMfVal - realAssetsTotalVal;
    netWorthComputed = netWorth - realEstateCorrection - t.liabilitiesTotal;

    const financeAssets = _sum((x) => {
      const c = x.cat;
      return (
        c === '現金・預金' ||
        c === '日本株・ETF' ||
        c === '米国株・ETF' ||
        c === '株式(信用)' ||
        c === '投資信託' ||
        c === '債券' ||
        c === 'FX・商品先物' ||
        c === '暗号資産' ||
        c === '保険' ||
        c === '年金'
      );
    });
    investableAssets = Math.max(0, financeAssets - EMERGENCY_FUND);
  }

  return {
    netWorth,
    imported,
    cash,
    crypto,
    securities,
    dryPowder,
    cashRatio,
    emergencyFund: EMERGENCY_FUND,
    asOf: _mf.asOf,
    liabilitiesTotal: hasLiabilities ? t.liabilitiesTotal : undefined,
    realAssetsTotal,
    realEstateMf,
    investableAssets,
    netWorthComputed,
  };
}

/**
 * 負債リスト（v5・#577）。未取得（v4 形）なら null。
 * ★運用アロケーション（Risk Exposure 等）の分母には絶対に混ぜないこと（handoff 2026-07-19 §B）。
 * @returns {MfLiability[]|null}
 */
export function getMfLiabilities() {
  if (!_mf || !Array.isArray(_mf.liabilities) || _mf.liabilities.length === 0) return null;
  return _mf.liabilities;
}

/** Exposure look-through 用の非証券資産（現金を通貨別＋暗号資産）。未ロードなら null */
export function getMfManualAssets() {
  if (!_mf || !_mf.holdings) return null;
  const jpyCash = _sum((x) => x.cat === '現金・預金' && x.cur !== 'USD');
  const usdCash = _sum((x) => x.cat === '現金・預金' && x.cur === 'USD');
  const crypto = _sum((x) => x.cat === '暗号資産');
  const out = [];
  if (jpyCash) out.push({ symbol: '現金(円)', name: '現金（日本円）', value: jpyCash, cur: 'JPY' });
  if (usdCash) out.push({ symbol: '現金(USD)', name: '現金（米ドル・円換算）', value: usdCash, cur: 'USD' });
  if (crypto) out.push({ symbol: '暗号資産', name: '暗号資産（BTC/ETH等）', value: crypto, cur: 'JPY' });
  return out.length ? out : null;
}

/** Exposure フッターのソース行。未ロードなら null */
export function getMfSources() {
  if (!_mf) return null;
  return [`現金・暗号資産 = Money Forward 実値（${_mf.asOf || ''}・mf-holdings.json）`];
}
