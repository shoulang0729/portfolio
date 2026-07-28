// @ts-check

// ══════════════════════════════════════════════════════════════
// networth.js  ―  Money Forward 実値（mf-holdings 相当）を供給する
//
// 設計（2026/06 確定・2026/07 #589 Phase2 で取得元を変更・#594 数値モデル再定義）:
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
// 数値モデル（#594 spec・2026-07-21 ユーザー確定）:
//   総資産  = mfNetWorth（MFそのまま）
//   運用資産 = (現金 − ¥20M) + 株式 + 投信 + 債券 + FX + 暗号 + 保険 + 年金
//   不動産補正 = realEstateMf − realAssetsTotal（realEstateMf 未取得時は 0）
//   純資産  = mfNetWorth − 不動産補正 − liabilitiesTotal
// ══════════════════════════════════════════════════════════════

import { WORKER_URL } from './config.js';
import { fetchWithTimeout } from './data.js';
import { _getActivePinHash } from './auth-pin.js';

const MF_URL = 'data/mf-holdings.json';
const MF_HISTORY_URL = 'data/mf-history.json';
/** 生活防衛資金（運用資産の計算で現金から控除）。2026/06 ユーザー決定 */
const EMERGENCY_FUND = 20_000_000;

/**
 * @typedef {{institution:string, name:string, tag?:string, balance:number, rate?:number, rateType?:string, asOf?:string}} MfLiability
 * @type {{asOf?:string, totals?:{imported?:number, mfNetWorth?:number, liabilitiesTotal?:number, realAssetsTotal?:number, realEstateMf?:number, netWorthComputed?:number}, holdings?:Array<{cat:string,cur?:string,value:number}>, liabilities?:MfLiability[]}|null}
 */
let _mf = null;

/** @type {{pension:number, insurance:number}|null} mf-history.json の最新行から取得した年金・保険カテゴリ値 */
let _mfHistoryPensionInsurance = null;

/**
 * ネットワースデータを読み込む。Worker `GET /networth`（KV・#589 Phase2）を
 * 優先し、失敗（未認証オリジン・ネットワーク断・空データ等）時のみ公開
 * `data/mf-holdings.json`（v4・サニタイズ済み）にフォールバックする。
 * 両方失敗した場合は null のまま（＝呼び出し側は positions フォールバック）。
 * あわせて mf-history.json の最新行から年金・保険カテゴリ値を取得する（#594）。
 */
export async function loadMfHoldings() {
  const [fromWorker] = await Promise.all([_loadFromWorker(), _loadPensionInsurance()]);
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
 * data/mf-history.json の最新行から年金・保険カテゴリ値を取得してキャッシュする（#594）。
 * 運用資産の計算（年金・保険は holdings に含まれないため history が正本）。失敗時はスキップ。
 */
async function _loadPensionInsurance() {
  try {
    const r = await fetch(`${MF_HISTORY_URL}?_=${Date.now()}`);
    if (!r.ok) return;
    const j = await r.json();
    const series = Array.isArray(j.series) ? j.series : [];
    const latest = series.length ? series[series.length - 1] : null;
    if (!latest) return;
    _mfHistoryPensionInsurance = {
      pension: Number(latest.pension) || 0,
      insurance: Number(latest.insurance) || 0,
    };
  } catch {
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
 * 数値モデル集計（#594 spec・2026-07-21 確定）。未ロードなら null。
 *
 * 返却値:
 *   netWorth          = mfNetWorth（総資産・MFそのまま）
 *   imported          = Σ(holdings)（取込済み評価額合計）
 *   cash              = 現金・預金
 *   crypto            = 暗号資産
 *   securities        = imported − cash − crypto
 *   dryPowder         = max(0, cash − EMERGENCY_FUND)
 *   cashRatio         = dryPowder ÷ operatingAssets × 100
 *   operatingAssets   = (現金 − ¥20M) + 株 + 投信 + 債券 + FX + 暗号 + 保険 + 年金（#594）
 *   realEstateMf      = MF不動産評価合計（取得できた時のみ・なければ undefined）
 *   不動産補正         = realEstateMf − realAssetsTotal（realEstateMf 未取得時は 0）
 *   pureNetWorth      = netWorth − 不動産補正 − liabilitiesTotal（#594 純資産）
 *   netWorthComputed  = pureNetWorth（後方互換のため旧名も継続）
 */
export function getMfTotals() {
  if (!_mf || !_mf.holdings) return null;
  const imported = (_mf.totals && _mf.totals.imported) || _sum(() => true);
  const netWorth = (_mf.totals && _mf.totals.mfNetWorth) || imported;
  const cash = _sum((x) => x.cat === '現金・預金');
  const crypto = _sum((x) => x.cat === '暗号資産');
  const securities = imported - cash - crypto;
  const dryPowder = Math.max(0, cash - EMERGENCY_FUND);

  const pi = _mfHistoryPensionInsurance;
  const pension = pi ? pi.pension : 0;
  const insurance = pi ? pi.insurance : 0;
  const financialInvested = _sum(
    (x) => x.cat !== '現金・預金' && x.cat !== '暗号資産' && x.cat !== 'その他'
  );
  const operatingAssets = Math.max(
    0,
    cash - EMERGENCY_FUND + financialInvested + crypto + pension + insurance
  );
  const cashRatio = imported > 0 ? (dryPowder / imported) * 100 : 0;

  const t = _mf.totals || {};
  const liabilitiesTotal = typeof t.liabilitiesTotal === 'number' ? t.liabilitiesTotal : undefined;
  const realAssetsTotal = typeof t.realAssetsTotal === 'number' ? t.realAssetsTotal : undefined;
  const realEstateMf = typeof t.realEstateMf === 'number' ? t.realEstateMf : undefined;

  let pureNetWorth;
  if (typeof liabilitiesTotal === 'number') {
    const reCorrection = typeof realEstateMf === 'number' ? realEstateMf - (realAssetsTotal || 0) : 0;
    pureNetWorth = netWorth - reCorrection - liabilitiesTotal;
  }

  return {
    netWorth,
    imported,
    cash,
    crypto,
    securities,
    dryPowder,
    cashRatio,
    operatingAssets: operatingAssets || undefined,
    pension: pension || undefined,
    insurance: insurance || undefined,
    emergencyFund: EMERGENCY_FUND,
    asOf: _mf.asOf,
    liabilitiesTotal,
    realAssetsTotal,
    realEstateMf,
    netWorthComputed: pureNetWorth,
    pureNetWorth,
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
