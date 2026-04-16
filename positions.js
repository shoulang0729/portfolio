// ══════════════════════════════════════════════════════════════
// positions.js  ―  保有銘柄データ & 期間設定
//
// ★ 保有内容を更新するときはこのファイルだけ編集すれば OK
//
// positions 配列の各フィールド:
//   symbol  : 表示用ティッカー（例: "AAPL", "9983", "オルカン"）
//   name    : 銘柄名
//   cat     : カテゴリ（"日本株・ETF" | "米国株・ETF" | "投資信託"）
//   shares  : 保有数量（株・口）
//   price   : 現在値（CSVロード時点の値、ライブ更新で上書きされる）
//   avgCost : 平均取得単価
//   value   : 時価評価額（円建て）
//   pnl     : 含み損益（円建て）
//   pnlPct  : 損益率（%）
//   dayPct  : 当日騰落率（%）。null = APIから取得
//   dayCh   : 当日評価損益変化（円建て）。null = APIから取得
//   cur     : 通貨（"JPY" | "USD"）
//   ySymbol : Yahoo Finance ティッカー（チャート・価格取得に使用）
//   isProxy : true の場合、ySymbol は代替銘柄（投資信託など）
//   proxyName: 代替銘柄の説明名
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════
// POSITION DATA (from CSVs — 2026/04/17)
// ══════════════════════════════════════════════
const positions = [
  // 日本株・ETF
  { symbol:'1615', name:'NEXT FUNDS 東証銀行業ETF', cat:'日本株・ETF',
    shares:37870, price:641.9, avgCost:548.0,
    value:24308753, pnl:3555993, pnlPct:17.13,
    dayPct:null, dayCh:null, cur:'JPY', ySymbol:'1615.T' },
  { symbol:'1629', name:'NEXT FUNDS 商社・卸売ETF', cat:'日本株・ETF',
    shares:87500, price:280, avgCost:245.0,            // 2026/04 に 500:1 株式分割
    value:24500000, pnl:3062500, pnlPct:14.29,
    dayPct:null, dayCh:null, cur:'JPY', ySymbol:'1629.T' },
  { symbol:'200A', name:'NEXT FUNDS 日経半導体ETF', cat:'日本株・ETF',
    shares:7400, price:3770, avgCost:2645,
    value:27898000, pnl:8325000, pnlPct:42.53,
    dayPct:null, dayCh:null, cur:'JPY', ySymbol:'200A.T' },
  { symbol:'6301', name:'小松製作所', cat:'日本株・ETF',
    shares:300, price:6812, avgCost:3181,
    value:2043600, pnl:1089300, pnlPct:114.15,
    dayPct:null, dayCh:null, cur:'JPY', ySymbol:'6301.T' },
  { symbol:'8050', name:'セイコーグループ', cat:'日本株・ETF',
    shares:2000, price:6620, avgCost:3451,             // 2026/04 に 2:1 株式分割
    value:13240000, pnl:6338000, pnlPct:91.83,
    dayPct:null, dayCh:null, cur:'JPY', ySymbol:'8050.T' },
  { symbol:'9983', name:'ファーストリテイリング', cat:'日本株・ETF',
    shares:200, price:74840, avgCost:43966,
    value:14968000, pnl:6174800, pnlPct:70.22,
    dayPct:null, dayCh:null, cur:'JPY', ySymbol:'9983.T' },
  // 米国株・ETF
  { symbol:'AAPL', name:'アップル', cat:'米国株・ETF',
    shares:185, price:266.43, avgCost:208.43,
    value:7746614, pnl:2084689, pnlPct:36.82,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'AAPL' },
  { symbol:'AMZN', name:'アマゾン', cat:'米国株・ETF',
    shares:250, price:248.5, avgCost:224.81,
    value:9891707, pnl:1302457, pnlPct:15.16,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'AMZN' },
  { symbol:'COPX', name:'グローバルX 銅ビジネスETF', cat:'米国株・ETF',
    shares:850, price:86.08, avgCost:79.83,
    value:11577146, pnl:788096, pnlPct:7.30,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'COPX' },
  { symbol:'GDX', name:'ヴァンエック 金鉱株ETF', cat:'米国株・ETF',
    shares:1000, price:97.77, avgCost:103.22,
    value:15500456, pnl:-681544, pnlPct:-4.21,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'GDX' },
  { symbol:'GLDM', name:'SPDR ゴールド・ミニシェアーズ', cat:'米国株・ETF',
    shares:2108, price:94.91, avgCost:83.78,
    value:31742537, pnl:4144601, pnlPct:15.02,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'GLDM' },
  { symbol:'GOOGL', name:'アルファベット', cat:'米国株・ETF',
    shares:260, price:337.12, avgCost:188.94,
    value:13870665, pnl:6259165, pnlPct:82.23,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'GOOGL' },
  { symbol:'ILF', name:'iシェアーズ ラテンアメリカ40', cat:'米国株・ETF',
    shares:2740, price:37.75, avgCost:32.14,
    value:16498497, pnl:2735477, pnlPct:19.88,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'ILF' },
  { symbol:'MSFT', name:'マイクロソフト', cat:'米国株・ETF',
    shares:102, price:411.22, avgCost:430.54,
    value:6801880, pnl:75490, pnlPct:1.12,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'MSFT' },
  { symbol:'PLTR', name:'パランティア・テクノロジーズ', cat:'米国株・ETF',
    shares:378, price:142.15, avgCost:131.5,
    value:8558335, pnl:572707, pnlPct:7.17,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'PLTR' },
  { symbol:'REMX', name:'ヴァンエック レアアース・金属ETF', cat:'米国株・ETF',
    shares:590, price:97.44, avgCost:81.36,
    value:9639153, pnl:2157363, pnlPct:28.83,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'REMX' },
  { symbol:'SHLD', name:'グローバルX 防衛テックETF', cat:'米国株・ETF',
    shares:300, price:74.59, avgCost:76.77,
    value:3507222, pnl:-186378, pnlPct:-5.05,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'SHLD' },
  { symbol:'SHV', name:'iシェアーズ 米国短期国債 0-1年ETF', cat:'米国株・ETF',
    shares:741, price:110.22, avgCost:110.3,
    value:12950791, pnl:-139715, pnlPct:-1.07,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'SHV' },
  { symbol:'SLV', name:'iシェアーズ シルバー・トラスト', cat:'米国株・ETF',
    shares:840, price:71.84, avgCost:72.48,
    value:9497942, pnl:-187258, pnlPct:-1.93,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'SLV' },
  { symbol:'SMH', name:'ヴァンエック半導体ETF', cat:'米国株・ETF',
    shares:471, price:453, avgCost:333.27,
    value:33992343, pnl:9697221, pnlPct:39.91,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'SMH' },
  { symbol:'TSLA', name:'テスラ', cat:'米国株・ETF',
    shares:100, price:391.95, avgCost:299.01,
    value:6153096, pnl:1532796, pnlPct:33.18,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'TSLA' },
  { symbol:'XLE', name:'エネルギー・セレクト・セクター SPDR ETF', cat:'米国株・ETF',
    shares:730, price:55.76, avgCost:58.91,
    value:6549399, pnl:-323551, pnlPct:-4.71,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'XLE' },
  // 投資信託
  { symbol:'オルカン', name:'eMAXIS Slim 全世界株式(AC)', cat:'投資信託',
    shares:31636296, price:35376, avgCost:27917,
    value:111916560, pnl:23597513, pnlPct:26.72,
    dayPct:null, dayCh:null, cur:'JPY',
    ySymbol:'ACWI', isProxy:true, proxyName:'iShares MSCI ACWI ETF' },
  { symbol:'ひふみ', name:'ひふみ投信', cat:'投資信託',
    shares:3313972, price:97924, avgCost:63471,
    value:32452732, pnl:11418620, pnlPct:54.28,
    dayPct:null, dayCh:null, cur:'JPY',
    ySymbol:'1306.T', isProxy:true, proxyName:'TOPIX連動型ETF (1306)' },
  { symbol:'マイクロSP', name:'ひふみマイクロスコープpro', cat:'投資信託',
    shares:1592436, price:11911, avgCost:10048,
    value:1896751, pnl:296671, pnlPct:18.54,
    dayPct:null, dayCh:null, cur:'JPY',
    ySymbol:'1477.T', isProxy:true, proxyName:'iShares MSCIジャパン小型株ETF (1477)' },
  { symbol:'ひふみXO', name:'ひふみクロスオーバーpro', cat:'投資信託',
    shares:1375624, price:13030, avgCost:10178,
    value:1792438, pnl:392328, pnlPct:28.02,
    dayPct:null, dayCh:null, cur:'JPY',
    ySymbol:'2516.T', isProxy:true, proxyName:'東証グロース市場250ETF (2516)' },
  { symbol:'PIMCO-ST', name:'ピムコ ショート・ターム ストラテジー USD', cat:'投資信託',
    shares:200, price:124.58, avgCost:122.84,
    value:3945669, pnl:55169, pnlPct:1.42,
    dayPct:null, dayCh:null, cur:'USD',
    ySymbol:'SHV', isProxy:true, proxyName:'iShares Short Treasury Bond ETF' },
];

// ══════════════════════════════════════════════
// PERIODS CONFIG
// ══════════════════════════════════════════════
const PERIODS = [
  { id: '1d',  label: '1d',  statsLabel: '1d',  days: 1,    range: '1y',  scale: 4   },
  { id: '1w',  label: '1w',  statsLabel: '1w',  days: 7,    range: '1y',  scale: 8   },
  { id: '1m',  label: '1m',  statsLabel: '1m',  days: 30,   range: '1y',  scale: 15  },
  { id: '3m',  label: '3m',  statsLabel: '3m',  days: 91,   range: '1y',  scale: 25  },
  { id: '6m',  label: '6m',  statsLabel: '6m',  days: 182,  range: '5y',  scale: 40  },
  { id: '9m',  label: '9m',  statsLabel: '9m',  days: 273,  range: '5y',  scale: 55  },
  { id: '1y',  label: '1y',  statsLabel: '1y',  days: 365,  range: '5y',  scale: 65  },
  { id: '3y',  label: '3y',  statsLabel: '3y',  days: 1095, range: '5y',  scale: 90  },
  { id: '5y',  label: '5y',  statsLabel: '5y',  days: 1825, range: '5y',  scale: 130 },
  { id: '10y', label: '10y', statsLabel: '10y', days: 3650, range: '10y', scale: 200 },
];
const PERIOD_MAP  = Object.fromEntries(PERIODS.map(p => [p.id, p]));
// テーブルヘッダー・セル描画用（PERIODS から自動生成）
const PERIOD_COLS = PERIODS.map(p => ({ id: p.id, label: p.label }));
const PERIOD_IDS  = PERIOD_COLS.map(pc => pc.id);
