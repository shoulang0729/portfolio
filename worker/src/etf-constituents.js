// ══════════════════════════════════════════════════════════════
// etf-constituents.js  ―  ETF 構成銘柄（look-through）取得 + 正規化（Worker 側）
//
// リスク断面 Phase B / B1（#200）。
// `GET /etf/constituents?symbol=<sym>` の中核ロジック:
//   1. KV `constituents:<symbol>` を引く
//   2. 無ければ取得アダプタ（B2 公式CSV / B3 Yahoo）を dispatch
//   3. 正規化形式に整え KV へ書き戻す
//
// 正規化形式:
//   { asOf, source, coverage, holdings:[{ticker,name,weight,currency,country,sector,assetClass}] }
//
// 取得アダプタ本体（プロバイダ別 CSV パース）は B2（#201）でこのモジュールに
// 追加する。B1 時点では fetchEtfConstituents は未実装ソースに対し null を返す。
// ══════════════════════════════════════════════════════════════

export const CONSTITUENTS_KV_PREFIX = 'constituents:';
// 構成銘柄は値動きより低頻度（週次更新）。KV TTL は保険として長めに 30 日。
export const CONSTITUENTS_TTL = 60 * 60 * 24 * 30;

/** @param {number} x */
function clamp01(x) {
  if (!(x > 0)) return 0;
  return x > 1 ? 1 : x;
}

/**
 * 取得アダプタの生データを正規化レスポンスに整える。
 * weight 合計を coverage として算出（0..1 にクランプ）。
 * @param {{holdings?: Array<object>, source?: string, asOf?: string}} raw
 */
export function buildConstituentsResponse(raw) {
  const list = Array.isArray(raw?.holdings) ? raw.holdings : [];
  const holdings = list
    .map(h => ({
      ticker: h.ticker || '',
      name: h.name || '',
      weight: Number(h.weight) || 0,
      currency: h.currency || '',
      country: h.country || '',
      sector: h.sector || '',
      assetClass: h.assetClass || '',
    }))
    .filter(h => h.weight > 0);
  const coverage = clamp01(holdings.reduce((s, h) => s + h.weight, 0));
  return {
    asOf: raw?.asOf || new Date().toISOString(),
    source: raw?.source || 'unknown',
    coverage,
    holdings,
  };
}

/**
 * 構成銘柄取得アダプタ dispatch。
 * 優先: B2 公式 CSV（iShares/Vanguard/SPDR 等）→ B3 Yahoo topHoldings。
 * 取得不可なら null を返す（呼び出し側で 404）。
 *
 * B1 時点ではアダプタ未実装のため常に null。B2（#201）で実装を追加する。
 * @param {string} symbol  ySymbol（例: 'ACWI', 'XLE'）
 * @param {object} env     Worker 環境（KV / fetch）
 * @returns {Promise<{holdings: Array<object>, source: string, asOf?: string}|null>}
 */
// eslint-disable-next-line no-unused-vars
export async function fetchEtfConstituents(symbol, env) {
  // TODO(B2 #201): プロバイダ別公式 CSV アダプタを実装し、ここで dispatch する。
  // TODO(B3 #202): Yahoo topHoldings フォールバック。
  return null;
}
