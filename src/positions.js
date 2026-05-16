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
// POSITION DATA (from CSVs — 2026/05/14)
// ══════════════════════════════════════════════
const positions = [
  // 日本株・ETF
  { symbol:'1306', name:'NEXT FUNDS TOPIX連動型上場投信', cat:'日本株・ETF',
    shares:60300, price:414.9, avgCost:415.50,
    value:25018470, pnl:-36180, pnlPct:-0.14,
    dayPct:null, dayCh:null, cur:'JPY', ySymbol:'1306.T' },
  { symbol:'1615', name:'NEXT FUNDS 東証銀行業ETF', cat:'日本株・ETF',
    shares:37870, price:642.5, avgCost:548.0,
    value:24331475, pnl:3578715, pnlPct:17.25,
    dayPct:null, dayCh:null, cur:'JPY', ySymbol:'1615.T' },
  { symbol:'1629', name:'NEXT FUNDS 商社・卸売ETF', cat:'日本株・ETF',
    shares:87500, price:296.9, avgCost:245.0,
    value:25978750, pnl:4541250, pnlPct:21.18,
    dayPct:null, dayCh:null, cur:'JPY', ySymbol:'1629.T' },
  { symbol:'200A', name:'NEXT FUNDS 日経半導体ETF', cat:'日本株・ETF',
    shares:7400, price:4407, avgCost:2645,
    value:32611800, pnl:13038800, pnlPct:66.61,
    dayPct:null, dayCh:null, cur:'JPY', ySymbol:'200A.T' },
  { symbol:'6301', name:'小松製作所', cat:'日本株・ETF',
    shares:300, price:6767, avgCost:3181,
    value:2030100, pnl:1075800, pnlPct:112.74,
    dayPct:null, dayCh:null, cur:'JPY', ySymbol:'6301.T' },
  { symbol:'8050', name:'セイコーグループ', cat:'日本株・ETF',
    shares:2000, price:6350, avgCost:3451,
    value:12700000, pnl:5798000, pnlPct:84.00,
    dayPct:null, dayCh:null, cur:'JPY', ySymbol:'8050.T' },
  { symbol:'9983', name:'ファーストリテイリング', cat:'日本株・ETF',
    shares:200, price:72310, avgCost:43966,
    value:14462000, pnl:5668800, pnlPct:64.47,
    dayPct:null, dayCh:null, cur:'JPY', ySymbol:'9983.T' },
  // 米国株・ETF
  { symbol:'AAPL', name:'アップル', cat:'米国株・ETF',
    shares:185, price:294.8, avgCost:208.43,
    value:8690214, pnl:3028289, pnlPct:53.49,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'AAPL' },
  { symbol:'AMZN', name:'アマゾン', cat:'米国株・ETF',
    shares:250, price:265.82, avgCost:224.81,
    value:10641986, pnl:2052736, pnlPct:23.9,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'AMZN' },
  { symbol:'COPX', name:'グローバルX 銅ビジネスETF', cat:'米国株・ETF',
    shares:650, price:90.77, avgCost:79.83,
    value:9404507, pnl:1154057, pnlPct:13.99,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'COPX' },
  { symbol:'GLDM', name:'SPDR ゴールド・ミニシェアーズ', cat:'米国株・ETF',
    shares:3257, price:93.32, avgCost:86.99,
    value:47569878, pnl:2349690, pnlPct:5.2,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'GLDM' },
  { symbol:'GOOGL', name:'アルファベット', cat:'米国株・ETF',
    shares:260, price:387.35, avgCost:188.94,
    value:16523119, pnl:8911619, pnlPct:117.08,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'GOOGL' },
  { symbol:'ILF', name:'iシェアーズ ラテンアメリカ40', cat:'米国株・ETF',
    shares:1400, price:35.98, avgCost:32.14,
    value:7777493, pnl:745293, pnlPct:10.6,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'ILF' },
  { symbol:'JPST', name:'JPモルガン ウルトラショート・インカムETF', cat:'米国株・ETF',
    shares:1942, price:50.5, avgCost:50.52,
    value:15444452, pnl:-95432, pnlPct:-0.61,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'JPST' },
  { symbol:'MSFT', name:'マイクロソフト', cat:'米国株・ETF',
    shares:122, price:407.77, avgCost:427.52,
    value:7762759, pnl:-260815, pnlPct:-3.25,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'MSFT' },
  { symbol:'PLTR', name:'パランティア・テクノロジーズ', cat:'米国株・ETF',
    shares:378, price:136, avgCost:131.5,
    value:7747520, pnl:-238108, pnlPct:-2.98,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'PLTR' },
  { symbol:'REMX', name:'ヴァンエック レアアース・金属ETF', cat:'米国株・ETF',
    shares:500, price:108.03, avgCost:81.36,
    value:8363725, pnl:2023225, pnlPct:31.91,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'REMX' },
  { symbol:'SHLD', name:'グローバルX 防衛テックETF', cat:'米国株・ETF',
    shares:750, price:64.64, avgCost:71.4,
    value:7531367, pnl:-965383, pnlPct:-11.36,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'SHLD' },
  { symbol:'SLV', name:'iシェアーズ シルバー・トラスト', cat:'米国株・ETF',
    shares:700, price:78.55, avgCost:72.48,
    value:8743894, pnl:672894, pnlPct:8.34,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'SLV' },
  { symbol:'SMH', name:'ヴァンエック半導体ETF', cat:'米国株・ETF',
    shares:471, price:561.25, avgCost:333.27,
    value:42652550, pnl:18357428, pnlPct:75.56,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'SMH' },
  { symbol:'TSLA', name:'テスラ', cat:'米国株・ETF',
    shares:125, price:433.45, avgCost:317.81,
    value:8819456, pnl:2652956, pnlPct:43.02,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'TSLA' },
  { symbol:'XLE', name:'エネルギー・セレクト・セクター SPDR ETF', cat:'米国株・ETF',
    shares:850, price:57.57, avgCost:58.97,
    value:7688551, pnl:-304849, pnlPct:-3.81,
    dayPct:null, dayCh:null, cur:'USD', ySymbol:'XLE' },
  // 投資信託
  { symbol:'オルカン', name:'eMAXIS Slim 全世界株式(AC)', cat:'投資信託',
    shares:16590415, price:36592, avgCost:27917,
    value:60707646, pnl:14392185, pnlPct:31.07,
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
