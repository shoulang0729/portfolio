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
    ySymbol:  'ACWI',
    proxyName:'iShares MSCI ACWI ETF',
  },
  {
    // ひふみマイクロスコープpro / ひふみマイクロプラスプロ / 旧シンボル名
    patterns: ['マイクロスコープ', 'マイクロプラス', 'マイクロSP'],
    symbol:   'ひふみMS',
    ySymbol:  '^GSPC',
    proxyName:'S&P 500 Index',
  },
  {
    // ひふみクロスオーバーpro
    patterns: ['クロスオーバー', 'ひふみXO'],
    symbol:   'ひふみXO',
    ySymbol:  'SPY',
    proxyName:'SPDR S&P500 ETF',
  },
  {
    // ひふみ投信は最後（"ひふみ"は他にマッチしなかったときのフォールバック）
    patterns: ['ひふみ投信', 'ひふみ'],
    symbol:   'ひふみ投信',
    ySymbol:  '2563.T',
    proxyName:'iシェアーズ・コアS&P500',
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
