// ══════════════════════════════════════════════════════════════
// holdings-from-mf.js  ―  mf-holdings.json → positions 形式変換
//
// buildPositionsFromMf(mf, fundDefs) で mf-holdings の証券行を
// ヒートマップが期待する positions 形（symbol/name/cat/shares/price/avgCost/value/cur/ySymbol/isProxy）に変換する。
//
// 変換ルール（handoff doc: docs/handoff/2026-06-29-mf-holdings-as-holdings-source.md）:
//   1. cat フィルタ: 米国株・ETF / 日本株・ETF / 投資信託 のみ採用
//   2. 投信は FUND_DEFS で proxy 化
//   3. シンボル正規化（200A → 200A.T 等）
//   4. SPCX: ライブ不可の場合は mf.price を手動フォールバック
//   5. shares 補完: value / price で近似
//   6. 同一表示シンボルを1タイルに統合（value/shares 合算）
//
// 依存: funds.js (FUND_DEFS, canonicalizeFundPosition)
// 読込順: funds.js → holdings-from-mf.js
// ══════════════════════════════════════════════════════════════

const ALLOWED_CATS = new Set(['米国株・ETF', '日本株・ETF', '投資信託']);

const MF_SYMBOL_OVERRIDES = {
  '200A': '200A.T',
};

/**
 * mf-holdings の1行を positions 形式に変換する（内部ヘルパー）。
 * 変換不能な行（フィルタ対象外・価格0の投信ダミー行）は null を返す。
 * @param {{ cat:string, name:string, value:number, cur:string, ySymbol?:string, avgCost?:number, price?:number }} item
 * @param {Array<{patterns:string[],symbol:string,ySymbol:string,proxyName:string}>} fundDefs
 * @returns {object|null}
 */
function _convertItem(item, fundDefs) {
  if (!ALLOWED_CATS.has(item.cat)) return null;

  const value = Number(item.value) || 0;
  const price = Number(item.price) || 0;
  const avgCost = Number(item.avgCost) || 0;

  if (item.cat === '投資信託') {
    if (price === 0 && avgCost === 0) return null;
    const def = fundDefs.find(d => d.patterns.some(p => item.name.includes(p)));
    if (!def) return null;
    const shares = price > 0 ? Math.round(value / price) : 0;
    return {
      symbol:    def.symbol,
      name:      item.name,
      cat:       item.cat,
      shares,
      price,
      avgCost,
      value,
      pnl:       avgCost > 0 && shares > 0 ? value - avgCost * shares : 0,
      pnlPct:    avgCost > 0 && shares > 0 ? ((price - avgCost) / avgCost) * 100 : 0,
      dayPct:    null,
      dayCh:     null,
      cur:       item.cur || 'JPY',
      ySymbol:   def.ySymbol,
      isProxy:   true,
      proxyName: def.proxyName,
    };
  }

  if (!item.ySymbol) return null;

  let ySymbol = item.ySymbol;
  if (MF_SYMBOL_OVERRIDES[ySymbol]) {
    ySymbol = MF_SYMBOL_OVERRIDES[ySymbol];
  } else if (
    item.cat === '日本株・ETF' &&
    !ySymbol.endsWith('.T') &&
    /^[0-9A-Za-z]{4,}$/.test(ySymbol)
  ) {
    ySymbol = `${ySymbol}.T`;
  }

  const symbol = ySymbol.replace(/\.T$/, '');

  const shares = price > 0 ? Math.round(value / price) : 0;
  const pnl = avgCost > 0 && shares > 0 ? (price - avgCost) * shares : 0;
  const pnlPct = avgCost > 0 ? ((price - avgCost) / avgCost) * 100 : 0;

  return {
    symbol,
    name:    item.name,
    cat:     item.cat,
    shares,
    price,
    avgCost,
    value,
    pnl,
    pnlPct,
    dayPct:  null,
    dayCh:   null,
    cur:     ySymbol.endsWith('.T') ? 'JPY' : (item.cat === '米国株・ETF' ? 'USD' : 'JPY'),
    ySymbol,
  };
}

/**
 * mf-holdings.json の holdings 配列を positions 形式の配列に変換する。
 * - 現金・暗号資産は除外
 * - 同一 symbol を統合（value/shares 合算）
 * - 投信は FUND_DEFS の proxy で価格化
 * @param {{ holdings: Array<{cat:string, name:string, value:number, cur:string, ySymbol?:string, avgCost?:number, price?:number}> }|null} mf
 * @param {Array<{patterns:string[],symbol:string,ySymbol:string,proxyName:string}>} fundDefs
 * @returns {Array<object>}
 */
function buildPositionsFromMf(mf, fundDefs) {
  if (!mf || !Array.isArray(mf.holdings)) return [];

  const raw = mf.holdings
    .map(item => _convertItem(item, fundDefs))
    .filter(Boolean);

  const merged = new Map();
  for (const pos of raw) {
    const key = pos.symbol;
    if (!merged.has(key)) {
      merged.set(key, { ...pos });
      continue;
    }
    const existing = merged.get(key);
    existing.shares += pos.shares;
    existing.value  += pos.value;
    existing.pnl    += pos.pnl;
    if (existing.shares > 0) {
      existing.pnlPct = (existing.pnl / (existing.avgCost * existing.shares)) * 100;
    }
  }

  return [...merged.values()];
}

export { buildPositionsFromMf };
