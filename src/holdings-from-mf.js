// @ts-check
// ══════════════════════════════════════════════════════════════
// holdings-from-mf.js  ―  mf-holdings.json を positions 形に変換
//
// buildPositionsFromMf(mf, fundDefs) を提供。
// mf-holdings の証券行をヒートマップが期待する positions 形
//   (symbol/name/cat/shares/price/avgCost/value/pnl/pnlPct/
//    dayPct/dayCh/cur/ySymbol/isProxy/proxyName)
// に変換する。
//
// 依存: funds.js (FUND_DEFS)
// ══════════════════════════════════════════════════════════════

/** @typedef {{ patterns: string[], symbol: string, canonicalName: string, ySymbol: string, proxyName: string }} FundDef */

/**
 * mf の ySymbol 揺れを吸収するオーバーライド表。
 * キー = mf 表記のシンボル / 値 = 正規化後シンボル
 * @type {Record<string, string>}
 */
const MF_SYMBOL_OVERRIDES = {
  '200A': '200A.T',
};

/**
 * タイル表示対象のカテゴリ
 * @type {Set<string>}
 */
const ALLOWED_CATS = new Set(['米国株・ETF', '日本株・ETF', '投資信託']);

/**
 * mf の証券行 1 件を positions 形オブジェクトに変換する。
 * 投資信託で funds.js に一致しない場合は null を返す（タイル除外）。
 *
 * @param {{ institution: string, cat: string, name: string, value: number, cur: string, ySymbol?: string, avgCost?: number, price?: number }} h
 * @param {FundDef[]} fundDefs
 * @returns {object|null}
 */
function _convertHolding(h, fundDefs) {
  if (!ALLOWED_CATS.has(h.cat)) return null;

  const name = h.name || '';
  const value = Number(h.value) || 0;
  const price = Number(h.price) || 0;
  const avgCost = Number(h.avgCost) || 0;
  const cur = h.cur || 'JPY';

  if (h.cat === '投資信託') {
    // 「合計評価額」など実銘柄でない行をスキップ
    if (!name || name.includes('合計')) return null;

    const def = fundDefs.find(d => d.patterns.some(p => name.includes(p)));
    if (!def) return null;

    const fundPrice = price || 1;
    const shares = Math.round(value / fundPrice);
    const cost = avgCost || 0;
    const pnl = cost > 0 ? value - cost : 0;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

    return {
      symbol: def.symbol,
      name: def.canonicalName || name,
      cat: h.cat,
      shares,
      price: fundPrice,
      avgCost: cost,
      value,
      pnl,
      pnlPct,
      dayPct: null,
      dayCh: null,
      cur,
      ySymbol: def.ySymbol,
      isProxy: true,
      proxyName: def.proxyName,
    };
  }

  // 日本株・ETF / 米国株・ETF
  const rawSymbol = h.ySymbol || '';
  if (!rawSymbol) return null;

  // シンボル正規化
  let ySymbol = MF_SYMBOL_OVERRIDES[rawSymbol] || rawSymbol;

  // 日本株・ETF で .T が欠落しているものに補完
  if (h.cat === '日本株・ETF' && !ySymbol.endsWith('.T') && /^[0-9A-Z]+$/.test(ySymbol)) {
    ySymbol = `${ySymbol}.T`;
  }

  // 表示 symbol（Yahoo ティッカーから .T を除いた短縮形）
  const symbol = ySymbol.replace(/\.T$/, '');

  const livePrice = price || 1;
  const shares = price > 0 ? Math.round(value / price) : 0;
  const costBase = avgCost > 0 && shares > 0 ? avgCost * shares : 0;
  const pnl = costBase > 0 ? value - costBase : 0;
  const pnlPct = costBase > 0 ? (pnl / costBase) * 100 : 0;

  return {
    symbol,
    name,
    cat: h.cat,
    shares,
    price: livePrice,
    avgCost: avgCost || 0,
    value,
    pnl,
    pnlPct,
    dayPct: null,
    dayCh: null,
    cur,
    ySymbol,
  };
}

/**
 * mf-holdings.json の holdings 配列を positions 配列に変換する。
 *
 * 変換ルール:
 * 1. cat フィルタ: 現金・暗号資産はタイルに出さない
 * 2. 投資信託は FUND_DEFS で proxy を当てる（マッチしないものは除外）
 * 3. シンボル正規化: MF_SYMBOL_OVERRIDES + 日本株の .T 補完
 * 4. shares = round(value / price)
 * 5. 同一 ySymbol の行は value/shares を合算して1タイル化
 *    （ひふみ投信 2行など。集計（networth.js）は networth 側が担当）
 *
 * @param {{ holdings?: Array<object> }|null} mf - loadMfHoldings() が返す生 JSON
 * @param {FundDef[]} fundDefs - funds.js の FUND_DEFS
 * @returns {object[]} positions 配列（空の場合はフォールバック想定）
 */
export function buildPositionsFromMf(mf, fundDefs) {
  if (!mf || !Array.isArray(mf.holdings)) return [];

  /** @type {Map<string, object>} ySymbol → merged position */
  const merged = new Map();

  for (const h of mf.holdings) {
    const pos = _convertHolding(h, fundDefs);
    if (!pos) continue;

    const key = pos.ySymbol;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...pos });
    } else {
      // 同一 ySymbol を合算（表示タイル統合）
      const totalShares = (existing.shares || 0) + (pos.shares || 0);
      const totalValue = (existing.value || 0) + (pos.value || 0);
      const totalCost = (existing.avgCost || 0) * (existing.shares || 0)
                      + (pos.avgCost || 0) * (pos.shares || 0);
      const newAvgCost = totalShares > 0 ? totalCost / totalShares : existing.avgCost;
      const newPnl = totalCost > 0 ? totalValue - totalCost : 0;
      const newPnlPct = totalCost > 0 ? (newPnl / totalCost) * 100 : 0;

      existing.shares = totalShares;
      existing.value = totalValue;
      existing.avgCost = Math.round(newAvgCost * 100) / 100;
      existing.pnl = newPnl;
      existing.pnlPct = newPnlPct;
    }
  }

  return [...merged.values()];
}
