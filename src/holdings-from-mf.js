// ══════════════════════════════════════════════════════════════
// holdings-from-mf.js  ―  mf-holdings.json → positions 形変換
//
// buildPositionsFromMf(mf, fundDefs) が唯一の公開 API。
// mf-holdings の証券行をヒートマップが期待する positions 形
//   { symbol, name, cat, shares, price, avgCost, value, pnl, pnlPct,
//     dayPct, dayCh, cur, ySymbol, isProxy?, proxyName? }
// に変換して返す。
//
// 依存: funds.js (FUND_DEFS, fundProxyOf)
// ══════════════════════════════════════════════════════════════

/** cat フィルタ: タイルに出す対象のみ */
const TILE_CATS = new Set(['日本株・ETF', '米国株・ETF', '投資信託']);

/**
 * mf 表記の揺れを吸収するオーバーライド表。
 * 数値/英数字コードで `.T` が欠落している東証銘柄を補完する。
 * @type {Record<string, string>}
 */
const MF_SYMBOL_OVERRIDES = {
  '200A': '200A.T',
};

/**
 * mf シンボルを正規化する（`.T` 欠落補完 + 明示オーバーライド）。
 * @param {string|undefined} sym
 * @returns {string}
 */
function _normalizeSymbol(sym) {
  if (!sym) return sym || '';
  if (MF_SYMBOL_OVERRIDES[sym]) return MF_SYMBOL_OVERRIDES[sym];
  // 純粋な数値コード（例: 6301 のような場合）は末尾に .T を付与
  if (/^\d{4}$/.test(sym)) return `${sym}.T`;
  return sym;
}

/**
 * 銘柄名から FUND_DEFS を参照して ySymbol / proxyName を得る。
 * 一致しなければ null。
 * @param {string} name
 * @param {Array<{patterns:string[],symbol:string,ySymbol:string,proxyName:string}>} fundDefs
 * @returns {{ symbol: string, ySymbol: string, proxyName: string }|null}
 */
function _fundProxyByName(name, fundDefs) {
  if (!name) return null;
  for (const def of fundDefs) {
    if (def.patterns.some(p => name.includes(p))) {
      return { symbol: def.symbol, ySymbol: def.ySymbol, proxyName: def.proxyName };
    }
  }
  return null;
}

/**
 * mf-holdings.json の holdings 配列を positions 配列に変換する。
 *
 * 変換ルール:
 * 1. cat フィルタ（現金・預金 / 暗号資産はスキップ）
 * 2. 有効シンボルなし / price=0 / name が「合計評価額」 → スキップ
 * 3. 投資信託 → FUND_DEFS 名前一致で ySymbol / isProxy を付与
 * 4. シンボル正規化（MF_SYMBOL_OVERRIDES + .T 補完）
 * 5. shares 補完: value ÷ price（端数切り捨て）
 * 6. 同一 ySymbol をタイル統合（value/shares 合算、avgCost 加重平均）
 *    ※ネットワース集計は mf-holdings の raw 合計のまま変えない
 *
 * @param {{ holdings: Array<{cat:string,name:string,value:number,cur?:string,
 *   ySymbol?:string,avgCost?:number,price?:number}> }} mf
 * @param {Array<{patterns:string[],symbol:string,ySymbol:string,proxyName:string}>} fundDefs
 * @returns {Array<object>}
 */
function buildPositionsFromMf(mf, fundDefs) {
  if (!mf || !Array.isArray(mf.holdings)) return [];

  /** @type {Map<string, object>} ySymbol → merged position */
  const merged = new Map();

  for (const h of mf.holdings) {
    if (!TILE_CATS.has(h.cat)) continue;

    // 名前が「合計評価額」の行はスキップ（SMBC 投信合計行）
    if (!h.name || h.name === '合計評価額') continue;

    const price = Number(h.price) || 0;
    const value = Number(h.value) || 0;
    if (value <= 0) continue;

    let symbol, ySymbol, isProxy, proxyName, name;
    name = h.name;

    if (h.cat === '投資信託') {
      const proxy = _fundProxyByName(h.name, fundDefs);
      if (!proxy) continue; // 未知の投信はスキップ
      symbol = proxy.symbol;
      ySymbol = proxy.ySymbol;
      isProxy = true;
      proxyName = proxy.proxyName;
    } else {
      // 日本株・ETF / 米国株・ETF
      const rawSym = h.ySymbol || '';
      if (!rawSym) continue; // シンボル無し → スキップ
      ySymbol = _normalizeSymbol(rawSym);
      symbol = ySymbol.replace(/\.T$/, ''); // 表示用（.T 落とし）
      isProxy = false;
      proxyName = undefined;
    }

    // shares 補完（mf 証券は shares を持たない）
    const avgCost = Number(h.avgCost) || 0;
    const shares = price > 0 ? Math.round(value / price) : 0;

    // 含み損益計算
    const costBase = avgCost * shares;
    const pnl = price > 0 ? value - costBase : 0;
    const pnlPct = costBase > 0 ? (pnl / costBase) * 100 : 0;
    const cur = h.cur || (h.cat === '米国株・ETF' ? 'USD' : 'JPY');

    const existing = merged.get(ySymbol);
    if (existing) {
      // タイル統合: value / shares 合算、avgCost 加重平均
      const totalShares = (existing.shares || 0) + shares;
      const totalCost = (existing.avgCost || 0) * (existing.shares || 0) + avgCost * shares;
      existing.value += value;
      existing.shares = totalShares;
      existing.avgCost = totalShares > 0 ? Math.round((totalCost / totalShares) * 100) / 100 : existing.avgCost;
      const newCostBase = existing.avgCost * existing.shares;
      existing.pnl = existing.value - newCostBase;
      existing.pnlPct = newCostBase > 0 ? (existing.pnl / newCostBase) * 100 : 0;
    } else {
      const pos = {
        symbol,
        name,
        cat: h.cat,
        shares,
        price,
        avgCost,
        value,
        pnl,
        pnlPct,
        dayPct: null,
        dayCh: null,
        cur,
        ySymbol,
      };
      if (isProxy) {
        pos.isProxy = true;
        pos.proxyName = proxyName;
      }
      merged.set(ySymbol, pos);
    }
  }

  return [...merged.values()];
}

export { buildPositionsFromMf };
