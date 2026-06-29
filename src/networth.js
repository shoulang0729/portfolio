// @ts-check

// ══════════════════════════════════════════════════════════════
// networth.js  ―  Money Forward 実値（data/mf-holdings.json）を供給する
//
// 設計（2026/06 確定）:
//   - 値動き（Heatmap/Historical/当日色）= positions.js のライブ価格（無改修）
//   - 資産総額・現金・暗号資産 = ここ（Money Forward 実値・週次 Chrome 取込）
//   - キャッシュ比率 = 投資用キャッシュ ÷ 運用資産
// ══════════════════════════════════════════════════════════════

const MF_URL = 'data/mf-holdings.json';
/** 生活防衛資金（キャッシュ比率の分子・分母から除外）。2026/06 ユーザー決定 */
const EMERGENCY_FUND = 20_000_000;

/** @type {{asOf?:string, totals?:{imported?:number, mfNetWorth?:number}, holdings?:Array<{cat:string,cur?:string,value:number}>}|null} */
let _mf = null;
/** @type {Promise<typeof _mf>|null} */
let _mfPromise = null;

/** mf-holdings.json を読み込む（失敗時は null のまま＝positions フォールバック）。並列呼出し時はリクエストを共有。 */
export function loadMfHoldings() {
  if (_mfPromise) return _mfPromise;
  _mfPromise = (async () => {
    try {
      const r = await fetch(`${MF_URL}?_=${Date.now()}`);
      if (!r.ok) throw new Error(`mf ${r.status}`);
      _mf = await r.json();
    } catch {
      _mf = null;
    }
    return _mf;
  })();
  return _mfPromise;
}

/**
 * @param {(x:{cat:string,cur?:string,value:number})=>boolean} pred
 * @returns {number}
 */
function _sum(pred) {
  if (!_mf || !_mf.holdings) return 0;
  return _mf.holdings.reduce((a, x) => a + (pred(x) ? (Number(x.value) || 0) : 0), 0);
}

/** 総資産・現金・暗号資産・キャッシュ比率の集計。未ロードなら null */
export function getMfTotals() {
  if (!_mf || !_mf.holdings) return null;
  const imported = (_mf.totals && _mf.totals.imported) || _sum(() => true);
  // 資産総額（純資産全体）＝ Money Forward の総資産。取込対象外口座も含むため imported ≥ ではなく ≤。
  // 未設定なら imported にフォールバック。
  const netWorth = (_mf.totals && _mf.totals.mfNetWorth) || imported;
  const cash = _sum(x => x.cat === '現金・預金');
  const crypto = _sum(x => x.cat === '暗号資産');
  const securities = imported - cash - crypto;
  const dryPowder = Math.max(0, cash - EMERGENCY_FUND);
  const cashRatio = imported > 0 ? (dryPowder / imported) * 100 : 0;
  return { netWorth, imported, cash, crypto, securities, dryPowder, cashRatio, emergencyFund: EMERGENCY_FUND, asOf: _mf.asOf };
}

/** Exposure look-through 用の非証券資産（現金を通貨別＋暗号資産）。未ロードなら null */
export function getMfManualAssets() {
  if (!_mf || !_mf.holdings) return null;
  const jpyCash = _sum(x => x.cat === '現金・預金' && x.cur !== 'USD');
  const usdCash = _sum(x => x.cat === '現金・預金' && x.cur === 'USD');
  const crypto = _sum(x => x.cat === '暗号資産');
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

/** ロード済みの生 mf-holdings データを返す（buildPositionsFromMf 用）。未ロードなら null */
export function getMfRawData() {
  return _mf;
}
