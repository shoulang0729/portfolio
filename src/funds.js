// ══════════════════════════════════════════════════════════════
// funds.js  ―  投資信託の正規化マッピング
//
// 「銘柄名のパターン → 統一シンボル → Yahoo Finance proxy」を1ファイルに集約。
// マネックスCSV取込・マネフォ画像取込・現在値取得の3経路から参照される。
//
// 依存: なし
// 読込順: state.js → funds.js → data.js → import.js
// ══════════════════════════════════════════════════════════════

const FUND_DEFS = [
  {
    patterns: ['全世界株式'],
    symbol:   'オルカン',
    canonicalName: 'eMAXIS Slim 全世界株式(オール・カントリー)',
    ySymbol:  'ACWI',
    proxyName:'iShares MSCI ACWI ETF',
  },
  {
    // ひふみマイクロスコープpro / ひふみマイクロプラスプロ / 旧シンボル名
    // 超小型株特化 → 東証グロース250（旧マザーズ指数）が運用実態に最も近い
    patterns: ['マイクロスコープ', 'マイクロプラス', 'マイクロSP'],
    symbol:   'ひふみMS',
    canonicalName: 'ひふみマイクロスコープpro',
    ySymbol:  '2516.T',
    proxyName:'NEXT FUNDS 東証グロース市場250指数ETF',
  },
  {
    // ひふみクロスオーバーpro
    // 上場/未上場混在のグローバル投資 → MSCI ACWI が最も近い
    patterns: ['クロスオーバー', 'ひふみXO'],
    symbol:   'ひふみXO',
    canonicalName: 'ひふみクロスオーバーpro',
    ySymbol:  'ACWI',
    proxyName:'iShares MSCI ACWI ETF',
  },
  {
    // ひふみ投信は最後（"ひふみ"は他にマッチしなかったときのフォールバック）
    // 1312.T（TOPIX Small）は Yahoo Finance が履歴データを返さないため、
    // ひふみMS と同じ 2516.T（東証グロース250）を採用（中小型成長テーマで類似）
    patterns: ['ひふみ投信', 'ひふみ'],
    symbol:   'ひふみ投信',
    canonicalName: 'ひふみ投信',
    ySymbol:  '2516.T',
    proxyName:'NEXT FUNDS 東証グロース市場250指数ETF',
  },
];

// 銘柄名（部分一致）から統一シンボルを得る。未知なら null。
function fundSymbolFromName(name) {
  if (!name) return null;
  for (const d of FUND_DEFS) {
    if (d.patterns.some(p => name.includes(p))) return d.symbol;
  }
  return null;
}

// 統一シンボルから Yahoo proxy 情報 ({ ySymbol, proxyName }) を得る。
// 未知なら null（呼び出し側で日経平均などにフォールバック）。
function fundProxyOf(symbol) {
  const d = FUND_DEFS.find(d => d.symbol === symbol);
  return d ? { ySymbol: d.ySymbol, proxyName: d.proxyName } : null;
}

// position 1件を正規化（投資信託のみ）：
// - 銘柄名に FUND_DEFS のパターンが含まれていれば canonicalName で上書き
// - symbol も対応する統一シンボルに正規化
// - ySymbol / proxyName は FUND_DEFS の値で強制上書き
//   （proxy を後から変更したい場合、既存KVの古い ySymbol を新しいものに切替えるため）
// - 投資信託以外はそのまま返す
function canonicalizeFundPosition(p) {
  if (!p || p.cat !== '投資信託') return p;
  const name = p.name || p.symbol || '';
  for (const def of FUND_DEFS) {
    if (def.patterns.some(pat => name.includes(pat) || (p.symbol || '').includes(pat))) {
      return {
        ...p,
        symbol: def.symbol,
        name:   def.canonicalName || p.name,
        ySymbol:   def.ySymbol,        // ← 強制上書き
        proxyName: def.proxyName,      // ← 強制上書き
        isProxy:   true,
      };
    }
  }
  return p;
}

export { FUND_DEFS, fundSymbolFromName, fundProxyOf, canonicalizeFundPosition };
