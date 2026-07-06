// @ts-check
// ══════════════════════════════════════════════════════════════
// holdings-from-mf.js  ―  mf-holdings.json → ヒートマップ用 positions 変換（#534）
//
// Money Forward 実値（data/mf-holdings.json）の証券行を、ヒートマップ／Value／Risk が
// 期待する positions 形（symbol/name/cat/shares/price/avgCost/value/cur/ySymbol/isProxy）
// に変換する純関数。副作用・外部依存なし（FUND_DEFS は引数で受け取る）。
//
// 変換ルール（docs/handoff/2026-06-29-mf-holdings-as-holdings-source.md §3）:
//   1. 証券フィルタ: cat ∈ {日本株・ETF, 米国株・ETF, 投資信託} のみ。現金・預金／暗号資産は除外
//   2. 投信 proxy: FUND_DEFS を名前一致で当て ySymbol=proxy + isProxy:true。
//      FUND_DEFS に一致しない投信行（例: 「合計評価額」集計ゴミ行）は除外
//   3. シンボル正規化: MF_SYMBOL_OVERRIDES（200A→200A.T 等）＋ 日本株の .T 補完
//   4. SPCX: ライブ検証不可のため isProxy 扱い（MF実値固定・価格 0/「…」で固定化させない）
//   5. shares 補完: shares = round(value / price)（price > 0 のとき）
//   6. 同一シンボル統合: 表示タイルのみ value/shares 合算・avgCost は加重平均
//      （集計＝networth.js は全行算入のまま。ここでは触らない）
//
// 通貨の扱い（重要）:
//   mf-holdings の price/avgCost/value はすべて円換算済み。
//   - JPY 銘柄: price は東証の生値と一致するのでそのまま採用（ライブ更新が正しく機能する）
//   - USD 銘柄: price（円換算値）を残すと data.js のサニティチェック
//     （live USD / stored JPY < 0.1 → 異常値としてスキップ）でライブ更新が凍結するため、
//     price は 0 で初期化する（初回ライブ取得で USD 実価格が入る。data.js は price=0 を許容）。
//     avgCost は円建てのまま保持し、初期 pnl/pnlPct の算出に使う
//     （refreshPrices の USD 分岐は costJPY = value - pnl から自己完結で更新するため整合する）。
// ══════════════════════════════════════════════════════════════

/**
 * @typedef {Object} MfHolding mf-holdings.json の holdings 1行（スキーマは load-bearing・変更禁止）
 * @property {string} cat カテゴリ（日本株・ETF / 米国株・ETF / 投資信託 / 現金・預金 / 暗号資産）
 * @property {string} name 銘柄名
 * @property {number} value 評価額（円換算済み）
 * @property {string} [cur] 通貨表記（mf 上は常に JPY）
 * @property {string} [institution] 金融機関名
 * @property {string} [ySymbol] Yahoo Finance ティッカー（投信は無し）
 * @property {number} [avgCost] 平均取得単価（円換算済み）
 * @property {number} [price] 現在値（円換算済み）
 */

/**
 * @typedef {Object} FundDef funds.js の FUND_DEFS 1件
 * @property {string[]} patterns 名前部分一致パターン
 * @property {string} symbol 統一シンボル
 * @property {string} canonicalName 正規化後の表示名
 * @property {string} ySymbol Yahoo Finance proxy ティッカー
 * @property {string} proxyName proxy 銘柄の説明名
 */

/**
 * @typedef {Object} MfPosition ヒートマップが期待する position 形
 * @property {string} symbol
 * @property {string} name
 * @property {string} cat
 * @property {number} shares
 * @property {number} price
 * @property {number} avgCost
 * @property {number} value
 * @property {number} pnl
 * @property {number} pnlPct
 * @property {number|null} dayPct
 * @property {number|null} dayCh
 * @property {string} cur
 * @property {string} ySymbol
 * @property {boolean} [isProxy]
 * @property {string} [proxyName]
 */

/**
 * mf 表記の揺れ・特殊銘柄を吸収するオーバーライド表。
 * - 200A: mf は cat=米国株・ETF / ySymbol=200A だが実体は東証（日経半導体ETF）
 * - SPCX: SpaceX。SPCX ティッカーが本当に SpaceX を指すかライブ検証できていないため、
 *   isProxy 扱いで MF 実値（value/price）を固定表示し、ライブ更新は dayPct のみ受ける。
 *   価格・評価額が 0 /「…」で固定化することはない。
 */
const MF_SYMBOL_OVERRIDES = {
  '200A': { ySymbol: '200A.T', cat: '日本株・ETF', cur: 'JPY' },
  SPCX: { isProxy: true, cur: 'JPY', proxyName: 'SpaceX（SPCX ライブ価格未検証・MF実値表示）' },
};

/** タイルに出す証券カテゴリ（現金・預金／暗号資産は networth.js 側でのみ算入） */
const SECURITY_CATS = new Set(['日本株・ETF', '米国株・ETF', '投資信託']);

/** 東証コード（4桁の数字 or 数字+英字。例: 1306, 200A, 9983） */
const JP_CODE_RE = /^[0-9][0-9A-Z]{3}$/;

/**
 * 投信行に FUND_DEFS を名前一致で当てる。未知なら null。
 * @param {string} name
 * @param {FundDef[]} fundDefs
 * @returns {FundDef|null}
 */
function matchFundDef(name, fundDefs) {
  for (const def of fundDefs) {
    if (Array.isArray(def.patterns) && def.patterns.some((pat) => name.includes(pat))) return def;
  }
  return null;
}

/**
 * mf-holdings の 1 行を position 形に変換する。タイル対象外なら null。
 * @param {MfHolding} row
 * @param {FundDef[]} fundDefs
 * @returns {MfPosition|null}
 */
function toPosition(row, fundDefs) {
  if (!row || typeof row !== 'object') return null;
  const cat = row.cat;
  if (!SECURITY_CATS.has(cat)) return null; // 現金・預金／暗号資産はタイルに出さない

  const name = String(row.name || '');
  const value = Number(row.value) || 0;
  if (value <= 0) return null; // 評価額なしはタイル化できない

  const mfPrice = Number(row.price) || 0;
  const avgCost = Number(row.avgCost) || 0;

  let ySymbol = row.ySymbol ? String(row.ySymbol) : '';
  let outCat = cat;
  let outName = name;
  let isProxy = false;
  /** @type {string|undefined} */
  let proxyName;
  let symbol = '';

  if (cat === '投資信託') {
    // 投信は mf に ySymbol が無い → FUND_DEFS を名前一致で当てて proxy 化。
    // 一致しない行（「合計評価額」等の集計ゴミ行）はタイルから除外する。
    const def = matchFundDef(name, fundDefs);
    if (!def) return null;
    symbol = def.symbol;
    outName = def.canonicalName || name;
    ySymbol = def.ySymbol;
    proxyName = def.proxyName;
    isProxy = true;
  } else {
    if (!ySymbol) return null; // 証券行は ySymbol 必須（mf 証券行は完備）
    // オーバーライド表（表記揺れ・特殊銘柄の吸収）
    const ov = MF_SYMBOL_OVERRIDES[ySymbol.replace(/\.T$/, '')];
    if (ov) {
      if (ov.ySymbol) ySymbol = ov.ySymbol;
      if (ov.cat) outCat = ov.cat;
      if (ov.isProxy) isProxy = true;
      if (ov.proxyName) proxyName = ov.proxyName;
    }
    // 日本株で .T 欠落の東証コードは .T を補完
    if (outCat === '日本株・ETF' && !ySymbol.includes('.') && JP_CODE_RE.test(ySymbol)) {
      ySymbol = `${ySymbol}.T`;
    }
    symbol = ySymbol.replace(/\.T$/, '');
  }

  // 通貨: 円建て価格を持つもの（東証・投信）は JPY、米国株・ETF は USD。
  // オーバーライドで明示された場合はそれを優先（例: SPCX は MF円建て実値を固定表示）。
  const ovCur = MF_SYMBOL_OVERRIDES[symbol] && MF_SYMBOL_OVERRIDES[symbol].cur;
  const cur = ovCur || (outCat === '米国株・ETF' && !ySymbol.endsWith('.T') ? 'USD' : 'JPY');

  // shares 補完: mf 証券行は shares を持たない → value / price（両方円建て）で近似
  const shares = mfPrice > 0 ? Math.round(value / mfPrice) : 0;
  if (shares <= 0) {
    // shares が導出できない行はライブ再計算で value が壊れないよう isProxy（value 固定）にする
    isProxy = true;
  }

  // 初期 pnl/pnlPct（すべて円建てで整合。取得原価が無い行は 0）
  const cost = avgCost > 0 && shares > 0 ? avgCost * shares : 0;
  const pnl = cost > 0 ? value - cost : 0;
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

  // USD 銘柄の price は円換算値のままだとライブ更新のサニティチェックで凍結するため 0 で初期化
  // （冒頭コメント「通貨の扱い」参照）。isProxy 行はライブで price を上書きされないので mf 値を保持。
  const price = cur === 'USD' && !isProxy ? 0 : mfPrice;

  /** @type {MfPosition} */
  const pos = {
    symbol,
    name: outName,
    cat: outCat,
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
  if (isProxy) pos.isProxy = true;
  if (proxyName) pos.proxyName = proxyName;
  return pos;
}

/**
 * 同一シンボルの position を 1 タイルに統合する（表示のみの統合。集計は networth.js が全行算入）。
 * value / shares / 取得原価を合算し、avgCost は shares 加重平均。
 * @param {Map<string, MfPosition & {_cost:number}>} map
 * @param {MfPosition} p
 * @returns {void}
 */
function mergeInto(map, p) {
  const cost = p.avgCost > 0 && p.shares > 0 ? p.avgCost * p.shares : 0;
  const existing = map.get(p.symbol);
  if (!existing) {
    map.set(p.symbol, { ...p, _cost: cost });
    return;
  }
  existing.value += p.value;
  existing.shares += p.shares;
  existing._cost += cost;
  if (!existing.price && p.price) existing.price = p.price;
  if (p.isProxy) existing.isProxy = true;
}

/**
 * mf-holdings.json の生 JSON からヒートマップ用 positions 配列を組み立てる。
 * mf が null / 不正形状なら空配列を返す（呼び出し側で KV フォールバック）。
 * @param {{holdings?: MfHolding[]}|null|undefined} mf mf-holdings.json の生 JSON
 * @param {FundDef[]} fundDefs funds.js の FUND_DEFS
 * @returns {MfPosition[]}
 */
function buildPositionsFromMf(mf, fundDefs) {
  if (!mf || !Array.isArray(mf.holdings)) return [];
  const defs = Array.isArray(fundDefs) ? fundDefs : [];
  /** @type {Map<string, MfPosition & {_cost:number}>} */
  const map = new Map();
  for (const row of mf.holdings) {
    const p = toPosition(row, defs);
    if (p) mergeInto(map, p);
  }
  return [...map.values()].map(({ _cost, ...p }) => {
    // 統合後に avgCost / pnl / pnlPct を確定（加重平均・円建て整合）
    if (_cost > 0 && p.shares > 0) {
      p.avgCost = Math.round((_cost / p.shares) * 100) / 100;
      p.pnl = p.value - _cost;
      p.pnlPct = (p.pnl / _cost) * 100;
    }
    return p;
  });
}

export { buildPositionsFromMf, MF_SYMBOL_OVERRIDES };
