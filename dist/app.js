// src/positions.js
var positions = [
  // 日本株・ETF
  {
    symbol: "1306",
    name: "NEXT FUNDS TOPIX\u9023\u52D5\u578B\u4E0A\u5834\u6295\u4FE1",
    cat: "\u65E5\u672C\u682A\u30FBETF",
    shares: 60300,
    price: 414.9,
    avgCost: 415.5,
    value: 25018470,
    pnl: -36180,
    pnlPct: -0.14,
    dayPct: null,
    dayCh: null,
    cur: "JPY",
    ySymbol: "1306.T"
  },
  {
    symbol: "1615",
    name: "NEXT FUNDS \u6771\u8A3C\u9280\u884C\u696DETF",
    cat: "\u65E5\u672C\u682A\u30FBETF",
    shares: 37870,
    price: 642.5,
    avgCost: 548,
    value: 24331475,
    pnl: 3578715,
    pnlPct: 17.25,
    dayPct: null,
    dayCh: null,
    cur: "JPY",
    ySymbol: "1615.T"
  },
  {
    symbol: "1629",
    name: "NEXT FUNDS \u5546\u793E\u30FB\u5378\u58F2ETF",
    cat: "\u65E5\u672C\u682A\u30FBETF",
    shares: 87500,
    price: 296.9,
    avgCost: 245,
    value: 25978750,
    pnl: 4541250,
    pnlPct: 21.18,
    dayPct: null,
    dayCh: null,
    cur: "JPY",
    ySymbol: "1629.T"
  },
  {
    symbol: "200A",
    name: "NEXT FUNDS \u65E5\u7D4C\u534A\u5C0E\u4F53ETF",
    cat: "\u65E5\u672C\u682A\u30FBETF",
    shares: 7400,
    price: 4407,
    avgCost: 2645,
    value: 32611800,
    pnl: 13038800,
    pnlPct: 66.61,
    dayPct: null,
    dayCh: null,
    cur: "JPY",
    ySymbol: "200A.T"
  },
  {
    symbol: "6301",
    name: "\u5C0F\u677E\u88FD\u4F5C\u6240",
    cat: "\u65E5\u672C\u682A\u30FBETF",
    shares: 300,
    price: 6767,
    avgCost: 3181,
    value: 2030100,
    pnl: 1075800,
    pnlPct: 112.74,
    dayPct: null,
    dayCh: null,
    cur: "JPY",
    ySymbol: "6301.T"
  },
  {
    symbol: "8050",
    name: "\u30BB\u30A4\u30B3\u30FC\u30B0\u30EB\u30FC\u30D7",
    cat: "\u65E5\u672C\u682A\u30FBETF",
    shares: 2e3,
    price: 6350,
    avgCost: 3451,
    value: 127e5,
    pnl: 5798e3,
    pnlPct: 84,
    dayPct: null,
    dayCh: null,
    cur: "JPY",
    ySymbol: "8050.T"
  },
  {
    symbol: "9983",
    name: "\u30D5\u30A1\u30FC\u30B9\u30C8\u30EA\u30C6\u30A4\u30EA\u30F3\u30B0",
    cat: "\u65E5\u672C\u682A\u30FBETF",
    shares: 200,
    price: 72310,
    avgCost: 43966,
    value: 14462e3,
    pnl: 5668800,
    pnlPct: 64.47,
    dayPct: null,
    dayCh: null,
    cur: "JPY",
    ySymbol: "9983.T"
  },
  // 米国株・ETF
  {
    symbol: "AAPL",
    name: "\u30A2\u30C3\u30D7\u30EB",
    cat: "\u7C73\u56FD\u682A\u30FBETF",
    shares: 185,
    price: 294.8,
    avgCost: 208.43,
    value: 8690214,
    pnl: 3028289,
    pnlPct: 53.49,
    dayPct: null,
    dayCh: null,
    cur: "USD",
    ySymbol: "AAPL"
  },
  {
    symbol: "AMZN",
    name: "\u30A2\u30DE\u30BE\u30F3",
    cat: "\u7C73\u56FD\u682A\u30FBETF",
    shares: 250,
    price: 265.82,
    avgCost: 224.81,
    value: 10641986,
    pnl: 2052736,
    pnlPct: 23.9,
    dayPct: null,
    dayCh: null,
    cur: "USD",
    ySymbol: "AMZN"
  },
  {
    symbol: "COPX",
    name: "\u30B0\u30ED\u30FC\u30D0\u30EBX \u9285\u30D3\u30B8\u30CD\u30B9ETF",
    cat: "\u7C73\u56FD\u682A\u30FBETF",
    shares: 650,
    price: 90.77,
    avgCost: 79.83,
    value: 9404507,
    pnl: 1154057,
    pnlPct: 13.99,
    dayPct: null,
    dayCh: null,
    cur: "USD",
    ySymbol: "COPX"
  },
  {
    symbol: "GLDM",
    name: "SPDR \u30B4\u30FC\u30EB\u30C9\u30FB\u30DF\u30CB\u30B7\u30A7\u30A2\u30FC\u30BA",
    cat: "\u7C73\u56FD\u682A\u30FBETF",
    shares: 3257,
    price: 93.32,
    avgCost: 86.99,
    value: 47569878,
    pnl: 2349690,
    pnlPct: 5.2,
    dayPct: null,
    dayCh: null,
    cur: "USD",
    ySymbol: "GLDM"
  },
  {
    symbol: "GOOGL",
    name: "\u30A2\u30EB\u30D5\u30A1\u30D9\u30C3\u30C8",
    cat: "\u7C73\u56FD\u682A\u30FBETF",
    shares: 260,
    price: 387.35,
    avgCost: 188.94,
    value: 16523119,
    pnl: 8911619,
    pnlPct: 117.08,
    dayPct: null,
    dayCh: null,
    cur: "USD",
    ySymbol: "GOOGL"
  },
  {
    symbol: "ILF",
    name: "i\u30B7\u30A7\u30A2\u30FC\u30BA \u30E9\u30C6\u30F3\u30A2\u30E1\u30EA\u30AB40",
    cat: "\u7C73\u56FD\u682A\u30FBETF",
    shares: 1400,
    price: 35.98,
    avgCost: 32.14,
    value: 7777493,
    pnl: 745293,
    pnlPct: 10.6,
    dayPct: null,
    dayCh: null,
    cur: "USD",
    ySymbol: "ILF"
  },
  {
    symbol: "JPST",
    name: "JP\u30E2\u30EB\u30AC\u30F3 \u30A6\u30EB\u30C8\u30E9\u30B7\u30E7\u30FC\u30C8\u30FB\u30A4\u30F3\u30AB\u30E0ETF",
    cat: "\u7C73\u56FD\u682A\u30FBETF",
    shares: 1942,
    price: 50.5,
    avgCost: 50.52,
    value: 15444452,
    pnl: -95432,
    pnlPct: -0.61,
    dayPct: null,
    dayCh: null,
    cur: "USD",
    ySymbol: "JPST"
  },
  {
    symbol: "MSFT",
    name: "\u30DE\u30A4\u30AF\u30ED\u30BD\u30D5\u30C8",
    cat: "\u7C73\u56FD\u682A\u30FBETF",
    shares: 122,
    price: 407.77,
    avgCost: 427.52,
    value: 7762759,
    pnl: -260815,
    pnlPct: -3.25,
    dayPct: null,
    dayCh: null,
    cur: "USD",
    ySymbol: "MSFT"
  },
  {
    symbol: "PLTR",
    name: "\u30D1\u30E9\u30F3\u30C6\u30A3\u30A2\u30FB\u30C6\u30AF\u30CE\u30ED\u30B8\u30FC\u30BA",
    cat: "\u7C73\u56FD\u682A\u30FBETF",
    shares: 378,
    price: 136,
    avgCost: 131.5,
    value: 7747520,
    pnl: -238108,
    pnlPct: -2.98,
    dayPct: null,
    dayCh: null,
    cur: "USD",
    ySymbol: "PLTR"
  },
  {
    symbol: "REMX",
    name: "\u30F4\u30A1\u30F3\u30A8\u30C3\u30AF \u30EC\u30A2\u30A2\u30FC\u30B9\u30FB\u91D1\u5C5EETF",
    cat: "\u7C73\u56FD\u682A\u30FBETF",
    shares: 500,
    price: 108.03,
    avgCost: 81.36,
    value: 8363725,
    pnl: 2023225,
    pnlPct: 31.91,
    dayPct: null,
    dayCh: null,
    cur: "USD",
    ySymbol: "REMX"
  },
  {
    symbol: "SHLD",
    name: "\u30B0\u30ED\u30FC\u30D0\u30EBX \u9632\u885B\u30C6\u30C3\u30AFETF",
    cat: "\u7C73\u56FD\u682A\u30FBETF",
    shares: 750,
    price: 64.64,
    avgCost: 71.4,
    value: 7531367,
    pnl: -965383,
    pnlPct: -11.36,
    dayPct: null,
    dayCh: null,
    cur: "USD",
    ySymbol: "SHLD"
  },
  {
    symbol: "SLV",
    name: "i\u30B7\u30A7\u30A2\u30FC\u30BA \u30B7\u30EB\u30D0\u30FC\u30FB\u30C8\u30E9\u30B9\u30C8",
    cat: "\u7C73\u56FD\u682A\u30FBETF",
    shares: 700,
    price: 78.55,
    avgCost: 72.48,
    value: 8743894,
    pnl: 672894,
    pnlPct: 8.34,
    dayPct: null,
    dayCh: null,
    cur: "USD",
    ySymbol: "SLV"
  },
  {
    symbol: "SMH",
    name: "\u30F4\u30A1\u30F3\u30A8\u30C3\u30AF\u534A\u5C0E\u4F53ETF",
    cat: "\u7C73\u56FD\u682A\u30FBETF",
    shares: 471,
    price: 561.25,
    avgCost: 333.27,
    value: 42652550,
    pnl: 18357428,
    pnlPct: 75.56,
    dayPct: null,
    dayCh: null,
    cur: "USD",
    ySymbol: "SMH"
  },
  {
    symbol: "TSLA",
    name: "\u30C6\u30B9\u30E9",
    cat: "\u7C73\u56FD\u682A\u30FBETF",
    shares: 125,
    price: 433.45,
    avgCost: 317.81,
    value: 8819456,
    pnl: 2652956,
    pnlPct: 43.02,
    dayPct: null,
    dayCh: null,
    cur: "USD",
    ySymbol: "TSLA"
  },
  {
    symbol: "XLE",
    name: "\u30A8\u30CD\u30EB\u30AE\u30FC\u30FB\u30BB\u30EC\u30AF\u30C8\u30FB\u30BB\u30AF\u30BF\u30FC SPDR ETF",
    cat: "\u7C73\u56FD\u682A\u30FBETF",
    shares: 850,
    price: 57.57,
    avgCost: 58.97,
    value: 7688551,
    pnl: -304849,
    pnlPct: -3.81,
    dayPct: null,
    dayCh: null,
    cur: "USD",
    ySymbol: "XLE"
  },
  // 投資信託
  {
    symbol: "\u30AA\u30EB\u30AB\u30F3",
    name: "eMAXIS Slim \u5168\u4E16\u754C\u682A\u5F0F(AC)",
    cat: "\u6295\u8CC7\u4FE1\u8A17",
    shares: 16590415,
    price: 36592,
    avgCost: 27917,
    value: 60707646,
    pnl: 14392185,
    pnlPct: 31.07,
    dayPct: null,
    dayCh: null,
    cur: "JPY",
    ySymbol: "ACWI",
    isProxy: true,
    proxyName: "iShares MSCI ACWI ETF"
  },
  {
    symbol: "\u3072\u3075\u307F",
    name: "\u3072\u3075\u307F\u6295\u4FE1",
    cat: "\u6295\u8CC7\u4FE1\u8A17",
    shares: 3313972,
    price: 97924,
    avgCost: 63471,
    value: 32452732,
    pnl: 11418620,
    pnlPct: 54.28,
    dayPct: null,
    dayCh: null,
    cur: "JPY",
    ySymbol: "1306.T",
    isProxy: true,
    proxyName: "TOPIX\u9023\u52D5\u578BETF (1306)"
  },
  {
    symbol: "\u30DE\u30A4\u30AF\u30EDSP",
    name: "\u3072\u3075\u307F\u30DE\u30A4\u30AF\u30ED\u30B9\u30B3\u30FC\u30D7pro",
    cat: "\u6295\u8CC7\u4FE1\u8A17",
    shares: 1592436,
    price: 11911,
    avgCost: 10048,
    value: 1896751,
    pnl: 296671,
    pnlPct: 18.54,
    dayPct: null,
    dayCh: null,
    cur: "JPY",
    ySymbol: "1477.T",
    isProxy: true,
    proxyName: "iShares MSCI\u30B8\u30E3\u30D1\u30F3\u5C0F\u578B\u682AETF (1477)"
  },
  {
    symbol: "\u3072\u3075\u307FXO",
    name: "\u3072\u3075\u307F\u30AF\u30ED\u30B9\u30AA\u30FC\u30D0\u30FCpro",
    cat: "\u6295\u8CC7\u4FE1\u8A17",
    shares: 1375624,
    price: 13030,
    avgCost: 10178,
    value: 1792438,
    pnl: 392328,
    pnlPct: 28.02,
    dayPct: null,
    dayCh: null,
    cur: "JPY",
    ySymbol: "2516.T",
    isProxy: true,
    proxyName: "\u6771\u8A3C\u30B0\u30ED\u30FC\u30B9\u5E02\u5834250ETF (2516)"
  },
  {
    symbol: "PIMCO-ST",
    name: "\u30D4\u30E0\u30B3 \u30B7\u30E7\u30FC\u30C8\u30FB\u30BF\u30FC\u30E0 \u30B9\u30C8\u30E9\u30C6\u30B8\u30FC USD",
    cat: "\u6295\u8CC7\u4FE1\u8A17",
    shares: 200,
    price: 124.58,
    avgCost: 122.84,
    value: 3945669,
    pnl: 55169,
    pnlPct: 1.42,
    dayPct: null,
    dayCh: null,
    cur: "USD",
    ySymbol: "SHV",
    isProxy: true,
    proxyName: "iShares Short Treasury Bond ETF"
  }
];
var PERIODS = [
  { id: "1d", label: "1d", statsLabel: "1d", days: 1, range: "1y", scale: 4 },
  { id: "1w", label: "1w", statsLabel: "1w", days: 7, range: "1y", scale: 8 },
  { id: "1m", label: "1m", statsLabel: "1m", days: 30, range: "1y", scale: 15 },
  { id: "3m", label: "3m", statsLabel: "3m", days: 91, range: "1y", scale: 25 },
  { id: "6m", label: "6m", statsLabel: "6m", days: 182, range: "5y", scale: 40 },
  { id: "9m", label: "9m", statsLabel: "9m", days: 273, range: "5y", scale: 55 },
  { id: "1y", label: "1y", statsLabel: "1y", days: 365, range: "5y", scale: 65 },
  { id: "3y", label: "3y", statsLabel: "3y", days: 1095, range: "5y", scale: 90 },
  { id: "5y", label: "5y", statsLabel: "5y", days: 1825, range: "5y", scale: 130 },
  { id: "10y", label: "10y", statsLabel: "10y", days: 3650, range: "10y", scale: 200 }
];
var PERIOD_MAP = Object.fromEntries(PERIODS.map((p) => [p.id, p]));
var PERIOD_COLS = PERIODS.map((p) => ({ id: p.id, label: p.label }));
var PERIOD_IDS = PERIOD_COLS.map((pc) => pc.id);

// src/state.js
var C = Object.freeze({
  MOBILE_BREAKPOINT: 600,
  HEATMAP_ASPECT_MOB: 0.85,
  HEATMAP_ASPECT_DSK: 0.58,
  HEATMAP_MINH_MOB: 360,
  HEATMAP_MINH_DSK: 480,
  SYM_FONT_COEFF: 0.22,
  SYM_FONT_MAX: 52,
  SYM_FONT_MIN: 9,
  PCT_FONT_RATIO: 0.52,
  PCT_FONT_MAX: 20,
  PCT_FONT_MIN: 8,
  GAP_RATIO: 0.54,
  GAP_SYM_OFFSET: 0.55,
  GAP_PCT_OFFSET: 0.95
});
var CHART_RANGES = {
  "1d": { yRange: "1d", interval: "5m", dateFmt: "%H:%M", label: "1d" },
  "1w": { yRange: "5d", interval: "1h", dateFmt: "%m/%d", label: "1w" },
  "1m": { yRange: "1mo", interval: "1d", dateFmt: "%m/%d", label: "1m" },
  "3m": { yRange: "3mo", interval: "1d", dateFmt: "%m/%d", label: "3m" },
  "6m": { yRange: "6mo", interval: "1d", dateFmt: "%m/%d", label: "6m" },
  "9m": { yRange: "9mo", interval: "1d", dateFmt: "%m/%d", label: "9m" },
  "1y": { yRange: "1y", interval: "1d", dateFmt: "%m/%d", label: "1y" },
  "3y": { yRange: "3y", interval: "1wk", dateFmt: "%Y/%m", label: "3y" },
  "5y": { yRange: "5y", interval: "1wk", dateFmt: "%Y/%m", label: "5y" },
  "10y": { yRange: "10y", interval: "1mo", dateFmt: "%Y", label: "10y" }
};
var SL_DETAIL_COLS = ["value", "shares", "avgCost", "pnl", "pnlPct"];
var state = {
  colorMode: "change",
  // 'pnl' | 'change'
  changePeriod: "1d",
  // period id from PERIODS
  lastChangePeriod: "1d",
  // remembers last change period for PnL toggle-back
  // historicalCache[range][symbol] = [{date, close}]  (range: '1y'|'5y'|'10y')
  historicalCache: { "1y": {}, "5y": {}, "10y": {} },
  fetchingRanges: /* @__PURE__ */ new Set(),
  // レンジ別取得中フラグ（同一レンジの重複リクエストを防ぐ）
  historicalAttempted: {},
  // { range: true } fetchAllHistorical を試行済みのレンジフラグ
  yahooCrumb: null,
  // Yahoo Finance crumb（認証トークン）
  yahooCrumbExpiry: 0,
  // crumb の有効期限（msタイムスタンプ）
  autoInterval: null,
  // 自動更新インターバルID
  countdownTimer: null,
  countdownVal: 0,
  autoSec: 0,
  currentPos: null,
  currentRange: "3m",
  statsMasked: localStorage.getItem("hm-stats-masked") !== "0",
  // 金額マスク状態（既定=マスク・目アイコンで解除）。'0'=解除を永続化
  themeMode: localStorage.getItem("hm-theme") || "auto",
  listSortCol: "1d",
  // 銘柄リストのデフォルトソート列
  listSortDir: "desc",
  slDetailVisible: false,
  // 詳細列の表示状態（起動時はデフォルト非表示）
  activeTab: "heatmap",
  // 'heatmap' | 'list' | 'watchlist'
  lastUpdateText: null,
  // refreshPrices 成功時のステータス文字列（履歴取得後に復元用）
  // ウォッチリスト
  watchlist: (() => {
    try {
      return JSON.parse(localStorage.getItem("hm-watchlist") || "[]");
    } catch {
      localStorage.removeItem("hm-watchlist");
      return [];
    }
  })(),
  watchlistPrices: {},
  // symbol → { price, dayPct }
  wlSortCol: "1d",
  // ウォッチリストのデフォルトソート列
  wlSortDir: "desc",
  prevPrices: {},
  // { ySymbol: price } 前回のライブ価格（フラッシュアニメーション用）
  forexRate: { USDJPY: null, ts: 0 },
  // { USDJPY: rate, ts: timestamp }
  liveTopHoldings: {},
  // symbol → { sector: {ourKey: weight}, asOf: ISO string }
  liveConstituents: {},
  // symbol → { holdings: [{ticker,name,weight,currency,country,sector,assetClass}], asOf, source }（#207 live look-through）
  providerHealth: {
    finnhub: { ok: true, lastOk: null, errCount: 0, lastErr: null },
    yahoo: { ok: true, lastOk: null, errCount: 0, lastErr: null }
  }
};

// src/auth-pin.js
var _AUTH_PIN_HASH_4DIG = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";
var AUTH_SESSION_KEY = "hm-auth-v1";
var AUTH_LS_HASH_KEY = "hm-pin-hash";
var AUTH_LOCKOUT_KEY = "hm-lockout";
var AUTH_FAILS_KEY = "hm-pin-fails";
var AUTH_PIN_LEN = 6;
var AUTH_MAX_FAIL = 5;
var AUTH_LOCK_SEC = 300;
(function _migratePinLen() {
  try {
    const stored = localStorage.getItem(AUTH_LS_HASH_KEY);
    if (stored === _AUTH_PIN_HASH_4DIG) localStorage.removeItem(AUTH_LS_HASH_KEY);
  } catch {
  }
})();
function _getActivePinHash() {
  return localStorage.getItem(AUTH_LS_HASH_KEY);
}
var _auth = {
  input: "",
  fails: 0,
  lockedUntil: null,
  // ロックアウト解除時刻 ms（旧 lockedAt から変更）
  encKey: null
  // AES-GCM key（auth-crypto.js が _deriveEncKey でセット）
};
function isAuthenticated() {
  return sessionStorage.getItem(AUTH_SESSION_KEY) === "1";
}
async function _hashPin(pin) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function _isLocked() {
  return _auth.lockedUntil != null && Date.now() < _auth.lockedUntil;
}
function _lockRemain() {
  return Math.ceil((_auth.lockedUntil - Date.now()) / 1e3);
}
function _formatLockRemain(seconds) {
  const remain = Math.max(0, Math.ceil(seconds));
  if (remain >= 60) {
    const minutes = Math.floor(remain / 60);
    const secs = remain % 60;
    return secs > 0 ? `${minutes}\u5206${secs}\u79D2` : `${minutes}\u5206`;
  }
  return `${remain}\u79D2`;
}
function _saveLockout() {
  if (_auth.lockedUntil != null) {
    localStorage.setItem(AUTH_LOCKOUT_KEY, String(_auth.lockedUntil));
    localStorage.setItem(AUTH_FAILS_KEY, String(_auth.fails));
  } else {
    localStorage.removeItem(AUTH_LOCKOUT_KEY);
    localStorage.removeItem(AUTH_FAILS_KEY);
  }
}
(function _loadLockout() {
  const stored = localStorage.getItem(AUTH_LOCKOUT_KEY);
  const storedFails = localStorage.getItem(AUTH_FAILS_KEY);
  if (storedFails) {
    const fails = parseInt(storedFails, 10);
    if (!isNaN(fails)) _auth.fails = fails;
  }
  if (!stored) return;
  const until = parseInt(stored, 10);
  if (isNaN(until)) {
    localStorage.removeItem(AUTH_LOCKOUT_KEY);
    return;
  }
  if (Date.now() < until) {
    _auth.lockedUntil = until;
  } else {
    localStorage.removeItem(AUTH_LOCKOUT_KEY);
    localStorage.removeItem(AUTH_FAILS_KEY);
    _auth.fails = 0;
  }
})();

// src/config.js
var WORKER_URL = "https://portfolio-proxy.shoulang.workers.dev";

// src/modal.js
async function showConfirm({ title, message, okLabel = "OK", cancelLabel = "\u30AD\u30E3\u30F3\u30BB\u30EB" }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.display = "flex";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    const modal = document.createElement("div");
    modal.className = "modal";
    const header = document.createElement("div");
    header.className = "modal-header";
    const titleEl = document.createElement("div");
    titleEl.className = "modal-title";
    titleEl.textContent = title || "\u78BA\u8A8D";
    header.appendChild(titleEl);
    modal.appendChild(header);
    const body = document.createElement("div");
    body.style.padding = "16px";
    body.style.color = "var(--text)";
    const msg = document.createElement("p");
    msg.textContent = message || "";
    msg.style.margin = "0 0 16px 0";
    msg.style.lineHeight = "1.5";
    body.appendChild(msg);
    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.gap = "8px";
    footer.style.justifyContent = "flex-end";
    footer.style.paddingTop = "8px";
    footer.style.borderTop = "1px solid var(--border)";
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = cancelLabel;
    cancelBtn.style.cssText = "padding: 8px 12px; border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;";
    cancelBtn.onclick = () => {
      cleanup();
      resolve(false);
    };
    const okBtn = document.createElement("button");
    okBtn.textContent = okLabel;
    okBtn.style.cssText = "padding: 8px 12px; border: none; background: var(--accent); color: white; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;";
    okBtn.onclick = () => {
      cleanup();
      resolve(true);
    };
    footer.appendChild(cancelBtn);
    footer.appendChild(okBtn);
    body.appendChild(footer);
    modal.appendChild(body);
    overlay.appendChild(modal);
    const cleanup = () => {
      overlay.classList.remove("open");
      document.removeEventListener("keydown", handleEsc);
      overlay.removeEventListener("click", handleOverlay);
      let removed = false;
      const doRemove = () => {
        if (!removed) {
          removed = true;
          overlay.remove();
        }
      };
      overlay.addEventListener("transitionend", doRemove, { once: true });
      setTimeout(doRemove, 300);
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        cleanup();
        resolve(false);
      }
    };
    const handleOverlay = (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(false);
      }
    };
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("open"));
    document.addEventListener("keydown", handleEsc);
    overlay.addEventListener("click", handleOverlay);
    okBtn.focus();
  });
}
async function showAlert({ title, message, okLabel = "OK" }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.display = "flex";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    const modal = document.createElement("div");
    modal.className = "modal";
    const header = document.createElement("div");
    header.className = "modal-header";
    const titleEl = document.createElement("div");
    titleEl.className = "modal-title";
    titleEl.textContent = title || "\u30A2\u30E9\u30FC\u30C8";
    header.appendChild(titleEl);
    modal.appendChild(header);
    const body = document.createElement("div");
    body.style.padding = "16px";
    body.style.color = "var(--text)";
    const msg = document.createElement("p");
    msg.textContent = message || "";
    msg.style.margin = "0 0 16px 0";
    msg.style.lineHeight = "1.5";
    body.appendChild(msg);
    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.gap = "8px";
    footer.style.justifyContent = "flex-end";
    footer.style.paddingTop = "8px";
    footer.style.borderTop = "1px solid var(--border)";
    const okBtn = document.createElement("button");
    okBtn.textContent = okLabel;
    okBtn.style.cssText = "padding: 8px 12px; border: none; background: var(--accent); color: white; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;";
    okBtn.onclick = () => {
      cleanup();
      resolve();
    };
    footer.appendChild(okBtn);
    body.appendChild(footer);
    modal.appendChild(body);
    overlay.appendChild(modal);
    const cleanup = () => {
      overlay.classList.remove("open");
      document.removeEventListener("keydown", handleEsc);
      overlay.removeEventListener("click", handleOverlay);
      let removed = false;
      const doRemove = () => {
        if (!removed) {
          removed = true;
          overlay.remove();
        }
      };
      overlay.addEventListener("transitionend", doRemove, { once: true });
      setTimeout(doRemove, 300);
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        cleanup();
        resolve();
      }
    };
    const handleOverlay = (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve();
      }
    };
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("open"));
    document.addEventListener("keydown", handleEsc);
    overlay.addEventListener("click", handleOverlay);
    okBtn.focus();
  });
}

// src/auth-passkey.js
var _onPasskeySuccess = null;
function setPasskeySuccessCallback(fn) {
  _onPasskeySuccess = fn;
}
var _PASSKEY_RP_ID = location.hostname;
var _PASSKEY_RP_NAME = "Portfolio Heatmap";
var _PASSKEY_USER_ID = new TextEncoder().encode("portfolio-owner");
function _b64ToU8(b64) {
  return Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
}
function _u8ToB64url(u8) {
  return btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
async function registerPasskey() {
  if (!navigator.credentials || !window.PublicKeyCredential) {
    await showAlert({ title: "\u30D6\u30E9\u30A6\u30B6\u5BFE\u5FDC", message: "\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306F\u30D1\u30B9\u30AD\u30FC\u306B\u5BFE\u5FDC\u3057\u3066\u3044\u307E\u305B\u3093\u3002" });
    return;
  }
  try {
    const challengeRes = await fetch(`${WORKER_URL}/auth/challenge`);
    const { challenge } = await challengeRes.json();
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: _b64ToU8(challenge),
        rp: { id: _PASSKEY_RP_ID, name: _PASSKEY_RP_NAME },
        user: { id: _PASSKEY_USER_ID, name: "Portfolio Manager", displayName: "Portfolio Manager" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 }
        ],
        authenticatorSelection: { userVerification: "preferred", residentKey: "preferred" },
        timeout: 6e4
      }
    });
    const response = credential.response;
    const publicKey = response.getPublicKey ? new Uint8Array(response.getPublicKey()) : new Uint8Array(0);
    const regRes = await fetch(`${WORKER_URL}/auth/register`, {
      method: "POST",
      // PIN 認証ヘッダーを付与（Worker 側で検証。未認証者の登録を防ぐ #239）
      headers: { "Content-Type": "application/json", "X-Pin-Hash": _getActivePinHash() },
      body: JSON.stringify({
        id: credential.id,
        publicKey: _u8ToB64url(publicKey),
        clientDataJSON: _u8ToB64url(new Uint8Array(response.clientDataJSON))
      })
    });
    if (!(await regRes.json()).ok) throw new Error("\u767B\u9332\u5931\u6557");
    await showAlert({ title: "\u30D1\u30B9\u30AD\u30FC\u767B\u9332", message: "\u30D1\u30B9\u30AD\u30FC\u3092\u767B\u9332\u3057\u307E\u3057\u305F\u3002\u6B21\u56DE\u304B\u3089\u30D1\u30B9\u30AD\u30FC\u3067\u30ED\u30B0\u30A4\u30F3\u3067\u304D\u307E\u3059\u3002" });
  } catch (e) {
    if (e.name !== "NotAllowedError") await showAlert({ title: "\u30A8\u30E9\u30FC", message: `\u30D1\u30B9\u30AD\u30FC\u767B\u9332\u30A8\u30E9\u30FC: ${e.message}` });
  }
}
async function authenticatePasskey() {
  if (!navigator.credentials || !window.PublicKeyCredential) return;
  try {
    const challengeRes = await fetch(`${WORKER_URL}/auth/challenge`);
    if (!challengeRes.ok) return;
    const { challenge } = await challengeRes.json();
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: _b64ToU8(challenge),
        rpId: _PASSKEY_RP_ID,
        allowCredentials: [],
        userVerification: "preferred",
        timeout: 6e4
      }
    });
    const response = assertion.response;
    const verifyRes = await fetch(`${WORKER_URL}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: assertion.id,
        clientDataJSON: _u8ToB64url(new Uint8Array(response.clientDataJSON)),
        authenticatorData: _u8ToB64url(new Uint8Array(response.authenticatorData)),
        signature: _u8ToB64url(new Uint8Array(response.signature))
      })
    });
    if ((await verifyRes.json()).ok) {
      sessionStorage.setItem(AUTH_SESSION_KEY, "1");
      try {
        localStorage.setItem("hm-passkey-seen", "1");
      } catch {
      }
      const rawKey = crypto.getRandomValues(new Uint8Array(32));
      _auth.encKey = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
      _auth.fails = 0;
      const ov = document.getElementById("pin-overlay");
      if (ov) {
        ov.style.opacity = "0";
        setTimeout(() => {
          ov.remove();
          document.body.style.overflow = "";
        }, 380);
      }
      if (_onPasskeySuccess) _onPasskeySuccess();
    } else {
      const errEl = document.getElementById("pin-error");
      if (errEl) {
        errEl.textContent = "\u30D1\u30B9\u30AD\u30FC\u8A8D\u8A3C\u5931\u6557";
        errEl.classList.add("visible");
      }
    }
  } catch (e) {
    if (e.name !== "NotAllowedError") {
      const errEl = document.getElementById("pin-error");
      if (errEl) {
        errEl.textContent = `\u30D1\u30B9\u30AD\u30FC\u30A8\u30E9\u30FC: ${e.message}`;
        errEl.classList.add("visible");
      }
    }
  }
}

// src/auth-crypto.js
var _AUTH_ENC_SALT = "hm-ai-keys-v1";
var _AUTH_ENC_SS = "hm-enc-key-v1";
async function _deriveEncKey(pin) {
  const keyMat = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  _auth.encKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(_AUTH_ENC_SALT),
      iterations: 1e5,
      hash: "SHA-256"
    },
    keyMat,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}
async function _restoreEncKey() {
  try {
    sessionStorage.removeItem(_AUTH_ENC_SS);
  } catch {
  }
  return false;
}

// src/auth-ui.js
function _trapFocus(container) {
  const focusable = container.querySelectorAll("button:not([disabled])");
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  container.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  });
  first.focus();
}
function _setKeypadEnabled(on) {
  document.querySelectorAll("#pin-overlay .pin-key").forEach((b) => {
    b.disabled = !on;
  });
}
function _updateDots() {
  document.querySelectorAll("#pin-overlay .pin-dot").forEach((d, i) => d.classList.toggle("filled", i < _auth.input.length));
}
function _showError(msg) {
  const el = document.getElementById("pin-error");
  if (el) {
    el.textContent = msg;
    el.classList.add("visible");
  }
}
function _hideError() {
  const el = document.getElementById("pin-error");
  if (el) {
    el.textContent = "";
    el.classList.remove("visible");
  }
}
function _lockRemainMessage(seconds = _lockRemain()) {
  return `${_formatLockRemain(seconds)}\u5F8C\u306B\u518D\u8A66\u884C\u3067\u304D\u307E\u3059`;
}
function _shake(type) {
  const el = document.getElementById("pin-dots");
  if (!el) return;
  el.classList.remove("shake", "success");
  void el.offsetWidth;
  el.classList.add(type);
  if (type === "shake") setTimeout(() => el.classList.remove("shake"), 500);
}
var _authSubmitTimer = null;
function _queueAuthSubmit() {
  if (_authSubmitTimer) return;
  _setKeypadEnabled(false);
  _authSubmitTimer = setTimeout(() => {
    _authSubmitTimer = null;
    _submitPin();
  }, 180);
}
function authKeyPress(n) {
  if (_authSubmitTimer) return;
  if (_isLocked()) {
    _showError(_lockRemainMessage());
    return;
  }
  if (_auth.input.length >= AUTH_PIN_LEN) return;
  _auth.input += n;
  _updateDots();
  _hideError();
  if (_auth.input.length === AUTH_PIN_LEN) _queueAuthSubmit();
}
function authBackspace() {
  if (_authSubmitTimer) return;
  if (_isLocked()) return;
  if (_auth.input.length > 0) {
    _auth.input = _auth.input.slice(0, -1);
    _updateDots();
    _hideError();
  }
}
async function _submitPin() {
  _setKeypadEnabled(false);
  const activeHash = _getActivePinHash();
  if (!activeHash) {
    _auth.input = "";
    _updateDots();
    _showError("\u521D\u56DEPIN\u8A2D\u5B9A\u3092\u5B8C\u4E86\u3057\u3066\u304F\u3060\u3055\u3044");
    _setKeypadEnabled(true);
    return;
  }
  const hash = await _hashPin(_auth.input);
  if (hash === activeHash) {
    _auth.fails = 0;
    localStorage.removeItem(AUTH_FAILS_KEY);
    sessionStorage.setItem(AUTH_SESSION_KEY, "1");
    await _deriveEncKey(_auth.input);
    _shake("success");
    document.querySelectorAll("#pin-overlay .pin-dot").forEach((d) => d.classList.add("filled"));
    setTimeout(() => {
      _showChangePinButton();
      const ov = document.getElementById("pin-overlay");
      if (ov) {
        ov.style.opacity = "0";
        setTimeout(() => {
          ov.remove();
          document.body.style.overflow = "";
        }, 380);
      }
    }, 350);
  } else {
    _auth.fails++;
    localStorage.setItem(AUTH_FAILS_KEY, String(_auth.fails));
    _auth.input = "";
    _updateDots();
    _shake("shake");
    if (_auth.fails >= AUTH_MAX_FAIL) {
      _auth.lockedUntil = Date.now() + AUTH_LOCK_SEC * 1e3;
      _saveLockout();
      _showError(`${AUTH_MAX_FAIL}\u56DE\u5931\u6557\u3002${_lockRemainMessage(AUTH_LOCK_SEC)}`);
      const _t = setInterval(() => {
        if (!_isLocked()) {
          clearInterval(_t);
          _auth.fails = 0;
          _auth.lockedUntil = null;
          _saveLockout();
          _setKeypadEnabled(true);
          _hideError();
        } else {
          _showError(_lockRemainMessage());
        }
      }, 1e3);
    } else {
      _showError(`PIN\u304C\u9055\u3044\u307E\u3059\uFF08\u6B8B\u308A${AUTH_MAX_FAIL - _auth.fails}\u56DE\uFF09`);
      _setKeypadEnabled(true);
    }
  }
}
document.addEventListener("keydown", (e) => {
  if (document.getElementById("pin-overlay")) {
    if (e.key >= "0" && e.key <= "9") authKeyPress(e.key);
    else if (e.key === "Backspace") authBackspace();
    e.stopPropagation();
  }
});
function _buildPinScreen() {
  const ov = document.createElement("div");
  ov.id = "pin-overlay";
  ov.innerHTML = `
    <div class="pin-card">
      <svg class="pin-lock-icon" width="36" height="42" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="19" width="32" height="23" rx="7" stroke="currentColor" stroke-width="2.4" fill="none"/>
        <path d="M9 19V12.5C9 8.36 13.03 5 18 5s9 3.36 9 7.5V19" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/>
        <circle cx="18" cy="30.5" r="3.5" fill="currentColor"/>
        <line x1="18" y1="30.5" x2="18" y2="35" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
      </svg>
      <div class="pin-title">Portfolio Manager</div>
      <button class="pin-passkey-btn" data-action="authenticatePasskey" title="\u30D1\u30B9\u30AD\u30FC\uFF08\u6307\u7D0B/\u9854\u8A8D\u8A3C\uFF09\u3067\u30ED\u30B0\u30A4\u30F3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px">
          <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/>
          <path d="M14 13.12c0 2.38 0 6.38-1 8.88"/>
          <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/>
          <path d="M2 12a10 10 0 0 1 18-6"/>
          <path d="M2 16h.01"/>
          <path d="M21.8 16c.2-2 .131-5.354 0-6"/>
          <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/>
          <path d="M8.65 22c.21-.66.45-1.32.57-2"/>
          <path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>
        </svg>\u30D1\u30B9\u30AD\u30FC\u3067\u30ED\u30B0\u30A4\u30F3
      </button>
      <div class="pin-subtitle">PIN\u3067\u30ED\u30B0\u30A4\u30F3</div>
      <div class="pin-dots" id="pin-dots">
        <span class="pin-dot"></span><span class="pin-dot"></span>
        <span class="pin-dot"></span><span class="pin-dot"></span>
        <span class="pin-dot"></span><span class="pin-dot"></span>
      </div>
      <div class="pin-error" id="pin-error"></div>
      ${_pinKeypadHTML("authKeyPress", "authBackspace")}
    </div>`;
  return ov;
}
function _pinKeypadHTML(pressAction, backAction) {
  return `<div class="pin-keypad">
    ${"123456789".split("").map(
    (n) => `<button class="pin-key" data-action="${pressAction}" data-arg="${n}">${n}</button>`
  ).join("")}
    <span class="pin-key-empty"></span>
    <button class="pin-key" data-action="${pressAction}" data-arg="0">0</button>
    <button class="pin-key pin-key-back" data-action="${backAction}" aria-label="\u524A\u9664">
      <svg width="22" height="16" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 1H20a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-7-7 7-7z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/>
        <line x1="12" y1="6" x2="17" y2="11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        <line x1="17" y1="6" x2="12" y2="11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      </svg>
    </button>
  </div>`;
}
var _pc = {
  step: 0,
  // 1=現在PIN確認 2=新PIN入力 3=新PIN確認
  input: "",
  newPin: "",
  submitTimer: null,
  mode: "change"
  // change | setup | recover
};
var _pcStepLabel = ["", "\u73FE\u5728\u306EPIN", "\u65B0\u3057\u3044PIN\uFF086\u6841\uFF09", "\u65B0\u3057\u3044PIN\uFF08\u78BA\u8A8D\uFF09"];
var _pcStepHint = ["", "\u8A8D\u8A3C\u306E\u305F\u3081\u73FE\u5728\u306EPIN\u3092\u5165\u529B", "\u65B0\u3057\u30446\u6841\u306EPIN\u3092\u5165\u529B", "\u540C\u3058PIN\u3092\u3082\u3046\u4E00\u5EA6\u5165\u529B"];
var _pcRecoverStepLabel = ["", "\u73FE\u5728\u306EPIN", "\u65E2\u5B58PIN\uFF086\u6841\uFF09", "\u65E2\u5B58PIN\uFF08\u78BA\u8A8D\uFF09"];
var _pcRecoverStepHint = ["", "\u8A8D\u8A3C\u306E\u305F\u3081\u73FE\u5728\u306EPIN\u3092\u5165\u529B", "\u30B5\u30FC\u30D0\u30FC\u306B\u4FDD\u5B58\u6E08\u307F\u306EPIN\u3092\u5165\u529B", "\u540C\u3058PIN\u3092\u3082\u3046\u4E00\u5EA6\u5165\u529B"];
function _pcLabelForStep(step) {
  return (_pc.mode === "recover" ? _pcRecoverStepLabel : _pcStepLabel)[step];
}
function _pcHintForStep(step) {
  return (_pc.mode === "recover" ? _pcRecoverStepHint : _pcStepHint)[step];
}
function _pcUpdateDots() {
  document.querySelectorAll("#pc-dots .pin-dot").forEach((d, i) => d.classList.toggle("filled", i < _pc.input.length));
}
function _pcSetTitle() {
  const lbl = document.getElementById("pc-step-label");
  const hint = document.getElementById("pc-step-hint");
  const prog = document.querySelectorAll("#pc-progress .pc-prog-dot");
  if (lbl) lbl.textContent = _pcLabelForStep(_pc.step);
  if (hint) hint.textContent = _pcHintForStep(_pc.step);
  prog.forEach((d, i) => d.classList.toggle("active", i < _pc.step));
}
function _pcShowError(msg) {
  const el = document.getElementById("pc-error");
  if (el) {
    el.textContent = msg;
    el.classList.add("visible");
  }
}
function _pcHideError() {
  const el = document.getElementById("pc-error");
  if (el) {
    el.textContent = "";
    el.classList.remove("visible");
  }
}
function _pcShake() {
  const el = document.getElementById("pc-dots");
  if (!el) return;
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
  setTimeout(() => el.classList.remove("shake"), 500);
}
function _pcSetKeypadEnabled(on) {
  document.querySelectorAll("#pc-overlay .pin-key").forEach((b) => {
    b.disabled = !on;
  });
}
function _pcQueueSubmit() {
  if (_pc.submitTimer) return;
  _pcSetKeypadEnabled(false);
  _pc.submitTimer = setTimeout(() => {
    _pc.submitTimer = null;
    _pcSubmit();
  }, 180);
}
function _pcSuccess() {
  const el = document.getElementById("pc-dots");
  if (el) {
    el.classList.add("success");
  }
  const lbl = document.getElementById("pc-step-label");
  const hint = document.getElementById("pc-step-hint");
  if (lbl) lbl.textContent = "\u2705 \u5909\u66F4\u5B8C\u4E86";
  if (hint) hint.textContent = _pc.mode === "recover" ? "\u65E2\u5B58PIN\u3067\u30ED\u30B0\u30A4\u30F3\u3057\u307E\u3057\u305F" : "\u65B0\u3057\u3044PIN\u304C\u4FDD\u5B58\u3055\u308C\u307E\u3057\u305F";
  document.querySelectorAll("#pc-dots .pin-dot").forEach((d) => d.classList.add("filled"));
  _pcSetKeypadEnabled(false);
  setTimeout(() => closePinChange(), 1800);
}
async function _pinHashSyncErrorMessage(res) {
  let detail = "";
  try {
    const body = await res.clone().json();
    detail = body?.error || body?.message || "";
  } catch {
    detail = await res.text().catch(() => "");
  }
  if (detail) return detail;
  if (res.status === 401) return "\u65E2\u5B58\u306EPIN\u3068\u4E00\u81F4\u3057\u307E\u305B\u3093";
  return `\u30B5\u30FC\u30D0\u30FC\u540C\u671F\u306B\u5931\u6557\u3057\u307E\u3057\u305F\uFF08${res.status}\uFF09`;
}
async function _loadServerPinConfigured() {
  const res = await fetch(`${WORKER_URL}/auth/pin-hash`, { method: "GET", cache: "no-store" });
  if (!res.ok) throw new Error(`server ${res.status}`);
  const body = await res.json();
  return !!body.configured;
}
async function _initInitialPinMode() {
  const title = document.getElementById("pc-title");
  const hint = document.getElementById("pc-step-hint");
  _pcSetKeypadEnabled(false);
  if (hint) hint.textContent = "PIN\u72B6\u614B\u3092\u78BA\u8A8D\u4E2D...";
  try {
    const configured = await _loadServerPinConfigured();
    _pc.mode = configured ? "recover" : "setup";
    if (title) title.textContent = configured ? "PIN\u5FA9\u65E7" : "\u521D\u56DEPIN\u8A2D\u5B9A";
    _pcSetTitle();
    _pcHideError();
    _pcSetKeypadEnabled(true);
  } catch (e) {
    console.warn("[auth] PIN status check failed:", e);
    _pcShowError("PIN\u72B6\u614B\u306E\u78BA\u8A8D\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u518D\u8AAD\u307F\u8FBC\u307F\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  }
}
function pcKeyPress(n) {
  if (_pc.submitTimer) return;
  if (_pc.input.length >= AUTH_PIN_LEN) return;
  _pc.input += n;
  _pcUpdateDots();
  _pcHideError();
  if (_pc.input.length === AUTH_PIN_LEN) _pcQueueSubmit();
}
function pcBackspace() {
  if (_pc.submitTimer) return;
  if (_pc.input.length > 0) {
    _pc.input = _pc.input.slice(0, -1);
    _pcUpdateDots();
    _pcHideError();
  }
}
async function _pcSubmit() {
  _pcSetKeypadEnabled(false);
  const hash = await _hashPin(_pc.input);
  if (_pc.step === 1) {
    if (hash !== _getActivePinHash()) {
      _pc.input = "";
      _pcUpdateDots();
      _pcShake();
      _pcShowError("PIN\u304C\u9055\u3044\u307E\u3059");
      _pcSetKeypadEnabled(true);
      return;
    }
    _pc.step = 2;
    _pc.input = "";
    _pcUpdateDots();
    _pcSetTitle();
    _pcHideError();
    _pcSetKeypadEnabled(true);
  } else if (_pc.step === 2) {
    _pc.newPin = _pc.input;
    _pc.step = 3;
    _pc.input = "";
    _pcUpdateDots();
    _pcSetTitle();
    _pcHideError();
    _pcSetKeypadEnabled(true);
  } else if (_pc.step === 3) {
    if (_pc.input !== _pc.newPin) {
      _pc.input = "";
      _pcUpdateDots();
      _pcShake();
      _pcShowError("PIN\u304C\u4E00\u81F4\u3057\u307E\u305B\u3093");
      _pcSetKeypadEnabled(true);
      return;
    }
    const prevHash = _getActivePinHash();
    const newHash = await _hashPin(_pc.newPin);
    try {
      const res = await fetch(`${WORKER_URL}/auth/pin-hash`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prevHash ? { oldHash: prevHash, newHash } : { newHash })
      });
      if (!res.ok) throw new Error(await _pinHashSyncErrorMessage(res));
    } catch (e) {
      console.warn("[auth] PIN hash sync to Worker failed:", e);
      _pcShowError(e?.message || "\u30B5\u30FC\u30D0\u30FC\u540C\u671F\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u518D\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002");
      _pcSetKeypadEnabled(true);
      return;
    }
    localStorage.setItem(AUTH_LS_HASH_KEY, newHash);
    sessionStorage.setItem(AUTH_SESSION_KEY, "1");
    await _deriveEncKey(_pc.newPin);
    _showChangePinButton();
    _pcSuccess();
  }
}
function openInitialPinSetup() {
  if (document.getElementById("pc-overlay")) return;
  if (_pc.submitTimer) {
    clearTimeout(_pc.submitTimer);
    _pc.submitTimer = null;
  }
  _pc.mode = "setup";
  _pc.step = 2;
  _pc.input = "";
  _pc.newPin = "";
  const ov = document.createElement("div");
  ov.id = "pc-overlay";
  ov.innerHTML = `
    <div class="pin-card pc-card">
      <div class="pc-header">
        <span class="pc-title" id="pc-title">PIN\u78BA\u8A8D\u4E2D</span>
      </div>

      <div class="pc-progress" id="pc-progress">
        <span class="pc-prog-dot active"></span>
        <span class="pc-prog-line"></span>
        <span class="pc-prog-dot active"></span>
      </div>

      <div class="pin-subtitle" id="pc-step-label">${_pcLabelForStep(2)}</div>
      <div class="pc-hint" id="pc-step-hint">PIN\u72B6\u614B\u3092\u78BA\u8A8D\u4E2D...</div>

      <div class="pin-dots" id="pc-dots">
        <span class="pin-dot"></span><span class="pin-dot"></span>
        <span class="pin-dot"></span><span class="pin-dot"></span>
        <span class="pin-dot"></span><span class="pin-dot"></span>
      </div>
      <div class="pin-error" id="pc-error"></div>

      ${_pinKeypadHTML("pcKeyPress", "pcBackspace")}
    </div>`;
  document.body.appendChild(ov);
  const ac = new AbortController();
  ov._kbAbort = ac;
  document.addEventListener("keydown", (e) => {
    if (e.key >= "0" && e.key <= "9") pcKeyPress(e.key);
    else if (e.key === "Backspace") pcBackspace();
  }, { signal: ac.signal });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    ov.style.opacity = "1";
    _trapFocus(ov);
  }));
  _initInitialPinMode();
}
function openPinChange() {
  if (document.getElementById("pc-overlay")) return;
  if (_pc.submitTimer) {
    clearTimeout(_pc.submitTimer);
    _pc.submitTimer = null;
  }
  _pc.mode = "change";
  _pc.step = 1;
  _pc.input = "";
  _pc.newPin = "";
  const ov = document.createElement("div");
  ov.id = "pc-overlay";
  ov.innerHTML = `
    <div class="pin-card pc-card">
      <div class="pc-header">
        <span class="pc-title">PIN\u3092\u5909\u66F4</span>
        <button class="pc-close" data-action="closePinChange" aria-label="\u9589\u3058\u308B">\u2715</button>
      </div>

      <div class="pc-progress" id="pc-progress">
        <span class="pc-prog-dot active"></span>
        <span class="pc-prog-line"></span>
        <span class="pc-prog-dot"></span>
        <span class="pc-prog-line"></span>
        <span class="pc-prog-dot"></span>
      </div>

      <div class="pin-subtitle" id="pc-step-label">${_pcStepLabel[1]}</div>
      <div class="pc-hint" id="pc-step-hint">${_pcStepHint[1]}</div>

      <div class="pin-dots" id="pc-dots">
        <span class="pin-dot"></span><span class="pin-dot"></span>
        <span class="pin-dot"></span><span class="pin-dot"></span>
        <span class="pin-dot"></span><span class="pin-dot"></span>
      </div>
      <div class="pin-error" id="pc-error"></div>

      ${_pinKeypadHTML("pcKeyPress", "pcBackspace")}
    </div>`;
  document.body.appendChild(ov);
  const ac = new AbortController();
  ov._kbAbort = ac;
  document.addEventListener("keydown", (e) => {
    if (e.key >= "0" && e.key <= "9") pcKeyPress(e.key);
    else if (e.key === "Backspace") pcBackspace();
    else if (e.key === "Escape") closePinChange();
  }, { signal: ac.signal });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    ov.style.opacity = "1";
  }));
}
function closePinChange() {
  const ov = document.getElementById("pc-overlay");
  if (!ov) return;
  if (_pc.submitTimer) {
    clearTimeout(_pc.submitTimer);
    _pc.submitTimer = null;
  }
  if (ov._kbAbort) ov._kbAbort.abort();
  ov.style.opacity = "0";
  setTimeout(() => ov.remove(), 350);
}
function _showChangePinButton() {
  for (const id of [
    "pin-change-btn",
    "passkey-register-btn",
    "import-manex-btn",
    "import-mf-btn",
    "manage-positions-btn",
    "snapshot-btn"
  ]) {
    const btn = document.getElementById(id);
    if (btn) btn.style.display = "";
  }
}
(function initAuth() {
  if (isAuthenticated()) {
    _restoreEncKey();
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    return;
  }
  if (!_getActivePinHash()) {
    document.body.style.overflow = "hidden";
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", openInitialPinSetup);
    } else {
      openInitialPinSetup();
    }
    return;
  }
  document.body.style.overflow = "hidden";
  const ov = _buildPinScreen();
  document.body.appendChild(ov);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    ov.style.opacity = "1";
    _trapFocus(ov);
  }));
  if (window.PublicKeyCredential && localStorage.getItem("hm-passkey-seen") === "1") {
    setTimeout(() => {
      if (typeof window.authenticatePasskey === "function") window.authenticatePasskey();
    }, 250);
  }
})();

// src/fmt.js
var _ESC = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};
var escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => _ESC[c]);
var fmtJPY = (v) => {
  const m = v / 1e4;
  return `${m.toFixed(1)}\u4E07`;
};
var fmtJPYFull = (v) => `${(v >= 0 ? "+" : "") + Math.round(v).toLocaleString()}\u5186`;
var fmtYen = (v) => `\xA5${Math.round(v || 0).toLocaleString()}`;
var maskAmount = (s) => String(s).replace(/[0-9]/g, "*");
var fmtPct = (v) => `${v.toFixed(1)}%`;
var fmtPrice = (v, cur) => {
  if (v == null) return "\u2015";
  return cur === "USD" ? `$${v.toFixed(2)}` : `\xA5${Math.round(v).toLocaleString()}`;
};
var sgn = (v) => v >= 0 ? "pos" : "neg";
var fmtJPYInt = (v) => {
  const m = Math.round(v / 1e4);
  const sign = m < 0 ? "-" : "";
  const abs = Math.abs(m);
  if (abs >= 1e4) {
    const s = (abs / 1e4).toFixed(2);
    return `${sign + (s.endsWith("0") ? (abs / 1e4).toFixed(1) : s)}\u5104`;
  }
  return `${sign + abs.toLocaleString()}\u4E07`;
};
var fmtPctInt = (v) => `${Math.round(v)}%`;
var fmtShares = (n) => {
  if (n >= 1e6) {
    const v = Math.round(n / 1e5) / 10;
    return `${v.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1e3) {
    const v = Math.round(n / 100) / 10;
    return `${v.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return n.toLocaleString();
};
function getColor(pct, mode, scaleOverride) {
  if (pct == null) return "var(--null-cell)";
  const scale = scaleOverride != null ? scaleOverride : mode === "pnl" ? 50 : 5;
  const t = Math.max(-1, Math.min(1, pct / scale));
  if (t >= 0) {
    const r = Math.round(232 + t * (198 - 232));
    const g = Math.round(232 + t * (40 - 232));
    const b = Math.round(237 + t * (40 - 237));
    return `rgb(${r},${g},${b})`;
  } else {
    const r = Math.round(232 - -t * (232 - 27));
    const g = Math.round(232 - -t * (232 - 94));
    const b = Math.round(237 - -t * (237 - 32));
    return `rgb(${r},${g},${b})`;
  }
}

// src/color.js
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function _lum(c) {
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}
function getCellTextColor(hexColor) {
  const c = d3.color(hexColor);
  if (!c) return cssVar("--text");
  return _lum(c) > 0.35 ? "#1C1C1E" : "#FFFFFF";
}
function getCellTextColorSub(hexColor) {
  const c = d3.color(hexColor);
  if (!c) return cssVar("--text3");
  return _lum(c) > 0.35 ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.82)";
}

// src/table.js
function makeTh(label, col, align, activeSortCol, sortDir, sortFnName) {
  const active = col && activeSortCol === col;
  const sortCls = active ? sortDir === "desc" ? "sort-desc" : "sort-asc" : "";
  const alignCls = align === "center" ? "sl-th-center" : "";
  const cls = [sortCls, alignCls].filter(Boolean).join(" ");
  const dataCol = col ? `data-col="${col}"` : "";
  const click = col && sortFnName ? `data-action="${sortFnName}" data-arg="${col}"` : "";
  return `<th class="${cls}" ${dataCol} ${click}>${label}</th>`;
}
function makePctCell(pct, scale, dataCol = "") {
  const dataAttr = dataCol ? `data-col="${dataCol}" ` : "";
  if (pct == null) {
    const period = PERIOD_MAP[dataCol];
    const range = period?.range;
    const fetching = !!(range && state.fetchingRanges?.has?.(range));
    const attempted = !!(range && state.historicalAttempted?.[range] === true);
    const loading = fetching || range && !attempted;
    const placeholder = loading ? '<span class="sl-pct-loading">\u2026</span>' : "\u2013";
    return `<td ${dataAttr}class="sl-pct-cell">${placeholder}</td>`;
  }
  const bg = getColor(pct, "change", scale);
  const fg = getCellTextColor(bg);
  return `<td ${dataAttr}class="sl-pct-cell" style="background:${bg};color:${fg}">${fmtPctInt(pct)}</td>`;
}
function _tableSort(colKey, dirKey, col, defaultAscCols = []) {
  if (state[colKey] === col) {
    state[dirKey] = state[dirKey] === "desc" ? "asc" : "desc";
  } else {
    state[colKey] = col;
    state[dirKey] = defaultAscCols.includes(col) ? "asc" : "desc";
  }
}
function makePeriodCells(getPct) {
  return PERIOD_COLS.map((pc) => {
    const pct = getPct(pc.id);
    const scale = PERIOD_MAP[pc.id]?.scale ?? 25;
    return makePctCell(pct, scale, pc.id);
  }).join("");
}
function makePeriodHeaderCells(activeSortCol, sortDir, sortFnName) {
  return PERIOD_COLS.map((pc) => makeTh(pc.label, pc.id, "center", activeSortCol, sortDir, sortFnName)).join("");
}

// src/portfolio-calc.js
function getHistoricalChangePct(symbol, periodId) {
  const cfg = PERIOD_MAP[periodId];
  if (!cfg) return null;
  const data = state.historicalCache[cfg.range]?.[symbol];
  if (!data || data.length < 2) return null;
  let startPoint;
  if (periodId === "1d") {
    startPoint = data[data.length - 2];
  } else {
    const lastPt = data[data.length - 1];
    const lastMs = lastPt.date instanceof Date ? lastPt.date.getTime() : new Date(lastPt.date).getTime();
    const targetDate = new Date(lastMs - cfg.days * 864e5);
    startPoint = null;
    for (let i = data.length - 2; i >= 0; i--) {
      if (data[i].date <= targetDate) {
        startPoint = data[i];
        break;
      }
    }
    if (!startPoint) startPoint = data[0];
  }
  const currentPrice = data[data.length - 1].close;
  return (currentPrice - startPoint.close) / startPoint.close * 100;
}
function getDisplayPct(p) {
  if (state.colorMode === "pnl") return p.pnlPct;
  if (!p.ySymbol) return null;
  if (state.changePeriod === "1d" && p.dayPct != null) return p.dayPct;
  return getHistoricalChangePct(p.ySymbol, state.changePeriod);
}
function calcPortfolioPeriodPct(periodId) {
  let weightedSum = 0, totalWeight = 0;
  positions.forEach((p) => {
    let pct = null;
    if (periodId === "1d" && p.dayPct != null) {
      pct = p.dayPct;
    } else if (p.ySymbol) {
      pct = getHistoricalChangePct(p.ySymbol, periodId);
    }
    if (pct === null) return;
    weightedSum += p.value * pct;
    totalWeight += p.value;
  });
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}
function trackedSymbolCount(positionsList, watchlist) {
  const norm = (s) => String(s || "").trim().toUpperCase();
  const set = /* @__PURE__ */ new Set();
  (positionsList || []).forEach((p) => {
    const key = norm(p.ySymbol || p.symbol);
    if (key) set.add(key);
  });
  (watchlist || []).forEach((w) => {
    const key = norm(w.symbol);
    if (key) set.add(key);
  });
  return set.size;
}

// src/data-helpers.js
function fetchWithTimeout(url, ms = 7e3, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal, ...opts }).finally(() => clearTimeout(timer));
}
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function batchWithRetry(items, fn, opts = {}) {
  const {
    batchSize = 5,
    batchDelay = 300,
    retryDelay = 2e3,
    isFailed = (r) => !r,
    onProgress = null
  } = opts;
  const results = [];
  let done = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(async (item) => {
      const result = await fn(item);
      done++;
      if (onProgress) onProgress(done, items.length);
      return result;
    }));
    results.push(...batchResults);
    if (i + batchSize < items.length) await sleep(batchDelay);
  }
  const failedIndices = results.map((r, idx) => isFailed(r, idx) ? idx : -1).filter((idx) => idx >= 0);
  if (failedIndices.length > 0) {
    await sleep(retryDelay);
    await Promise.all(failedIndices.map(async (idx) => {
      results[idx] = await fn(items[idx]);
    }));
  }
  return results;
}

// src/forex.js
async function fetchForexRate(from, to) {
  try {
    const res = await fetchWithTimeout(
      `${WORKER_URL}/forex?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      8e3
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.rate ?? null;
  } catch (e) {
    console.warn(`[forex] \u70BA\u66FF\u30EC\u30FC\u30C8\u53D6\u5F97\u5931\u6557 ${from}/${to}:`, e);
    return null;
  }
}

// src/ui-status.js
function setStatus(msg, color) {
  const dot = document.getElementById("status-dot");
  const txt = document.getElementById("status-text");
  dot.className = `dot${color === "red" ? " red" : color === "yellow" ? " yellow" : ""}`;
  txt.textContent = msg;
}
function flashPriceChanges(fetched) {
  const hasPrev = Object.keys(state.prevPrices).length > 0;
  if (!hasPrev) {
    fetched.forEach(({ pos: p, live }) => {
      if (live?.price && p.ySymbol) state.prevPrices[p.ySymbol] = live.price;
    });
    return;
  }
  const changes = [];
  fetched.forEach(({ pos: p, live }) => {
    if (!live?.price || !p.ySymbol) return;
    const prev = state.prevPrices[p.ySymbol];
    if (prev != null && prev !== live.price) {
      changes.push({ ySymbol: p.ySymbol, direction: live.price > prev ? "up" : "down" });
    }
    state.prevPrices[p.ySymbol] = live.price;
  });
  if (changes.length === 0) return;
  requestAnimationFrame(() => {
    const svg = document.getElementById("heatmap");
    if (!svg) return;
    changes.forEach(({ ySymbol, direction }) => {
      const rect = svg.querySelector(`rect[data-ysymbol="${CSS.escape(ySymbol)}"]`);
      if (!rect) return;
      const cls = direction === "up" ? "flash-up" : "flash-down";
      rect.classList.remove("flash-up", "flash-down");
      void rect.getBoundingClientRect();
      rect.classList.add(cls);
      rect.addEventListener("animationend", () => rect.classList.remove(cls), { once: true });
    });
  });
}
function formatRelativeTime(ts) {
  if (!ts) return "";
  const now = Date.now();
  const diff = Math.floor((now - ts) / 1e3);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
function renderProviderHealth() {
  const el = document.getElementById("provider-health");
  if (!el) return;
  const { finnhub, yahoo } = state.providerHealth;
  const parts = [];
  const fhStatus = finnhub.ok ? "\u2713" : `\u2717(${finnhub.errCount})`;
  const fhTime = finnhub.ok && finnhub.lastOk ? ` ${formatRelativeTime(finnhub.lastOk)}` : "";
  parts.push(`Finnhub ${fhStatus}${fhTime}`);
  const yhStatus = yahoo.ok ? "\u2713" : `\u2717(${yahoo.errCount})`;
  const yhTime = yahoo.ok && yahoo.lastOk ? ` ${formatRelativeTime(yahoo.lastOk)}` : "";
  parts.push(`Yahoo ${yhStatus}${yhTime}`);
  el.textContent = parts.join(" | ");
  el.className = `provider-health ${finnhub.ok && yahoo.ok ? "health-ok" : "health-warn"}`;
}

// src/idb.js
function openDb(dbName, version, upgradeCb) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, version);
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`IndexedDB open timeout: ${dbName}`));
    }, 3e3);
    const finish = (cb) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cb();
    };
    req.onerror = () => finish(() => reject(req.error || new Error(`IndexedDB open failed: ${dbName}`)));
    req.onblocked = () => finish(() => reject(new Error(`IndexedDB open blocked: ${dbName}`)));
    req.onsuccess = () => finish(() => resolve(req.result));
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (upgradeCb) upgradeCb(db, e.oldVersion, e.newVersion);
    };
  });
}
function idbPut(db, storeName, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.put(value, key);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
  });
}
function idbClear(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
  });
}
function idbGetAllEntries(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.openCursor();
    const entries = [];
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        entries.push({ key: cursor.key, value: cursor.value });
        cursor.continue();
      } else {
        resolve(entries);
      }
    };
  });
}

// src/cache.js
var SS_CACHE_KEY = "hm-hist-cache";
var SS_CACHE_VER = "2";
function loadCacheFromSession() {
  try {
    const raw = sessionStorage.getItem(SS_CACHE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj._v !== SS_CACHE_VER) return;
    for (const range of ["1y", "5y", "10y"]) {
      if (!obj[range]) continue;
      for (const [sym, entries] of Object.entries(obj[range])) {
        state.historicalCache[range][sym] = entries.map((e) => ({
          date: new Date(e.date),
          close: e.close
        }));
      }
    }
  } catch (e) {
    console.warn("[cache] sessionStorage load failed:", e);
    sessionStorage.removeItem(SS_CACHE_KEY);
  }
}
function saveCacheToSession() {
  try {
    const obj = { _v: SS_CACHE_VER };
    for (const range of ["1y", "10y"]) {
      obj[range] = {};
      for (const [sym, entries] of Object.entries(state.historicalCache[range] || {})) {
        obj[range][sym] = entries.map((e) => ({
          date: e.date instanceof Date ? e.date.toISOString() : e.date,
          close: e.close
        }));
      }
    }
    sessionStorage.setItem(SS_CACHE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn("[cache] sessionStorage save failed (quota?):", e);
  }
}
function clearCacheSession() {
  sessionStorage.removeItem(SS_CACHE_KEY);
}
loadCacheFromSession();

// src/historical-cache.js
var DB_NAME = "hm-historical";
var DB_VERSION = 1;
var STORE_NAME = "historical";
var _dbPromise = null;
function getDb() {
  if (!_dbPromise) {
    _dbPromise = openDb(DB_NAME, DB_VERSION, (db) => {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    }).catch((e) => {
      _dbPromise = null;
      throw e;
    });
  }
  return _dbPromise;
}
async function setHistoricalEntry(range, symbol, entries) {
  if (!state.historicalCache[range]) state.historicalCache[range] = {};
  state.historicalCache[range][symbol] = entries;
  try {
    const db = await getDb();
    const serialised = entries.map((e) => {
      const s = {
        date: e.date instanceof Date ? e.date.toISOString() : e.date,
        close: e.close
      };
      if (typeof e.vol === "number" && isFinite(e.vol)) s.vol = e.vol;
      return s;
    });
    await idbPut(db, STORE_NAME, `${range}:${symbol}`, { entries: serialised, ts: Date.now() });
  } catch (e) {
    console.warn("[historical-cache] IDB write failed:", e);
  }
  saveCacheToSession();
}
async function getAllHistorical(range) {
  try {
    const db = await getDb();
    const all = await idbGetAllEntries(db, STORE_NAME);
    const prefix = `${range}:`;
    const result = {};
    for (const { key, value } of all) {
      if (typeof key !== "string" || !key.startsWith(prefix)) continue;
      const symbol = key.slice(prefix.length);
      result[symbol] = (value.entries || []).map((e) => {
        const o = {
          date: e.date instanceof Date ? e.date : new Date(e.date),
          close: e.close
        };
        if (typeof e.vol === "number" && isFinite(e.vol)) o.vol = e.vol;
        return o;
      });
    }
    return result;
  } catch (e) {
    console.warn("[historical-cache] getAllHistorical failed:", e);
    return {};
  }
}
async function restoreFromIDB() {
  try {
    const db = await Promise.race([
      getDb(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("restoreFromIDB timeout")), 5e3))
    ]);
    const all = await idbGetAllEntries(db, STORE_NAME);
    for (const { key, value } of all) {
      const colonIdx = key.indexOf(":");
      if (colonIdx === -1) continue;
      const range = key.slice(0, colonIdx);
      const symbol = key.slice(colonIdx + 1);
      if (!state.historicalCache[range]) state.historicalCache[range] = {};
      state.historicalCache[range][symbol] = (value.entries || []).map((e) => {
        const o = {
          date: e.date instanceof Date ? e.date : new Date(e.date),
          close: e.close
        };
        if (typeof e.vol === "number" && isFinite(e.vol)) o.vol = e.vol;
        return o;
      });
    }
  } catch (e) {
    console.warn("[historical-cache] restoreFromIDB failed:", e);
  }
}
async function migrateFromSessionStorage() {
  try {
    const raw = sessionStorage.getItem("hm-hist-cache");
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (!obj) return;
    const db = await Promise.race([
      getDb(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("migrateFromSessionStorage timeout")), 5e3))
    ]);
    const existing = await idbGetAllEntries(db, STORE_NAME);
    const existingKeys = new Set(existing.map((e) => e.key));
    for (const range of ["1y", "5y", "10y"]) {
      if (!obj[range]) continue;
      for (const [sym, entries] of Object.entries(obj[range])) {
        const key = `${range}:${sym}`;
        if (existingKeys.has(key)) continue;
        const serialised = entries.map((e) => ({
          date: typeof e.date === "string" ? e.date : new Date(e.date).toISOString(),
          close: e.close
        }));
        await idbPut(db, STORE_NAME, key, { entries: serialised, ts: Date.now() });
      }
    }
  } catch (e) {
    console.warn("[historical-cache] migrateFromSessionStorage failed:", e);
  }
}
async function clearHistoricalIDB() {
  try {
    const db = await getDb();
    await idbClear(db, STORE_NAME);
  } catch (e) {
    console.warn("[historical-cache] clearHistoricalIDB failed:", e);
  }
  state.historicalCache = { "1y": {}, "5y": {}, "10y": {} };
}

// src/data-finnhub.js
function toFinnhubSymbol(ySymbol) {
  if (!ySymbol) return null;
  if (ySymbol.endsWith(".T")) return `TYO:${ySymbol.slice(0, -2)}`;
  if (ySymbol.endsWith(".HK")) return `HKG:${ySymbol.slice(0, -3)}`;
  return ySymbol;
}
async function fetchFinnhubQuote(fSymbol) {
  const url = `${WORKER_URL}/finnhub?path=/quote&symbol=${encodeURIComponent(fSymbol)}`;
  try {
    const res = await fetchWithTimeout(url, 7e3);
    if (res.status === 429) {
      state.providerHealth.finnhub.ok = false;
      state.providerHealth.finnhub.errCount++;
      state.providerHealth.finnhub.lastErr = Date.now();
      return { _err: "rateLimit" };
    }
    if (res.status >= 500) {
      state.providerHealth.finnhub.ok = false;
      state.providerHealth.finnhub.errCount++;
      state.providerHealth.finnhub.lastErr = Date.now();
      return { _err: "serverError" };
    }
    if (!res.ok) {
      state.providerHealth.finnhub.ok = false;
      state.providerHealth.finnhub.errCount++;
      state.providerHealth.finnhub.lastErr = Date.now();
      return { _err: "noData" };
    }
    const d = await res.json();
    if (!d || !d.c) {
      state.providerHealth.finnhub.ok = false;
      state.providerHealth.finnhub.errCount++;
      state.providerHealth.finnhub.lastErr = Date.now();
      return { _err: "noData" };
    }
    state.providerHealth.finnhub.ok = true;
    state.providerHealth.finnhub.lastOk = Date.now();
    state.providerHealth.finnhub.errCount = 0;
    return { price: d.c, dayPct: d.dp ?? null };
  } catch (e) {
    if (e?.name === "AbortError") {
      state.providerHealth.finnhub.ok = false;
      state.providerHealth.finnhub.errCount++;
      state.providerHealth.finnhub.lastErr = Date.now();
      return { _err: "timeout" };
    }
    state.providerHealth.finnhub.ok = false;
    state.providerHealth.finnhub.errCount++;
    state.providerHealth.finnhub.lastErr = Date.now();
    return { _err: "networkError" };
  }
}

// src/data-yahoo.js
async function fetchViaProxy(url, timeoutMs = 7e3, trackHealth = false) {
  const q2url = url.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com");
  const attempts = [
    // Worker 経由（最優先：CORS 確実・APIキー不要）
    { url: `${WORKER_URL}/yahoo?url=${encodeURIComponent(url)}`, opts: {} },
    // 以下は Worker が落ちているときのフォールバック
    { url, opts: { credentials: "include" } },
    { url: q2url, opts: { credentials: "include" } },
    { url: `https://corsproxy.io/?${encodeURIComponent(url)}`, opts: {} },
    { url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, opts: {} }
  ];
  for (const { url: u, opts } of attempts) {
    try {
      const res = await fetchWithTimeout(u, timeoutMs, opts);
      if (!res.ok) continue;
      const raw = await res.json();
      const result = raw?.contents ? JSON.parse(raw.contents) : raw;
      if (trackHealth) {
        state.providerHealth.yahoo.ok = true;
        state.providerHealth.yahoo.lastOk = Date.now();
        state.providerHealth.yahoo.errCount = 0;
      }
      return result;
    } catch {
    }
  }
  if (trackHealth) {
    state.providerHealth.yahoo.ok = false;
    state.providerHealth.yahoo.errCount++;
    state.providerHealth.yahoo.lastErr = Date.now();
  }
  return null;
}
function applySplitCorrection(entries) {
  if (entries.length < 2) return entries;
  for (let i = entries.length - 1; i >= 1; i--) {
    const a = entries[i].close;
    const b = entries[i - 1].close;
    if (!a || !b || a <= 0 || b <= 0) continue;
    const r = b / a;
    if (r >= 1.5 || r <= 1 / 1.5) {
      for (let j = 0; j < i; j++) {
        if (entries[j].close > 0) entries[j].close /= r;
      }
    }
  }
  return entries;
}

// src/data.js
async function applyPricesCache() {
  try {
    const res = await fetchWithTimeout(`${WORKER_URL}/prices/cache`, 8e3);
    if (!res.ok) return;
    const cache = await res.json();
    if (!cache || typeof cache !== "object") return;
    const now = Date.now();
    let applied = 0;
    for (const p of positions) {
      const c = cache[p.ySymbol];
      if (!c || !c.price) continue;
      if (c.ts && now - c.ts > 8 * 3600 * 1e3) continue;
      if (!p.isProxy && p.price > 0 && (c.price / p.price < 0.1 || c.price / p.price > 10)) continue;
      if (p.isProxy) {
        p.dayPct = c.dayPct ?? null;
      } else {
        const oldPrice = p.price;
        p.price = c.price;
        p.dayPct = c.dayPct ?? null;
        if (p.cur === "JPY") {
          p.value = Math.round(c.price * p.shares);
          const cost = p.avgCost * p.shares;
          p.pnl = p.value - cost;
          p.pnlPct = cost > 0 ? p.pnl / cost * 100 : 0;
        } else {
          if (p.value > 0) {
            const costJPY = p.value != null && p.pnl != null ? p.value - p.pnl : 0;
            const ratio = oldPrice > 0 ? c.price / oldPrice : 1;
            p.value = Math.round(p.value * ratio);
            p.pnl = p.value - costJPY;
            p.pnlPct = costJPY > 0 ? p.pnl / costJPY * 100 : 0;
          }
        }
      }
      applied++;
    }
    if (applied > 0) {
      document.dispatchEvent(new CustomEvent("hm:prices-updated"));
    }
  } catch (e) {
    console.warn("[prices:cache] \u8AAD\u8FBC\u5931\u6557:", e);
  }
}
async function fetchAllHistorical(neededRange = "1y") {
  if (state.fetchingRanges.has(neededRange)) return;
  state.fetchingRanges.add(neededRange);
  try {
    if (!state.historicalCache[neededRange]) state.historicalCache[neededRange] = {};
    const posSymbols = positions.filter((p) => p.ySymbol).map((p) => p.ySymbol);
    const wlSymbols = (state.watchlist || []).map((w) => w.symbol).filter(Boolean);
    const symbols = [.../* @__PURE__ */ new Set([...posSymbols, ...wlSymbols])];
    const toFetch = symbols.filter((s) => !state.historicalCache[neededRange][s]);
    if (toFetch.length === 0) return;
    setStatus(`\u5C65\u6B74\u30C7\u30FC\u30BF\u53D6\u5F97\u4E2D\uFF08${toFetch.length}\u9298\u67C4 / ${neededRange}\uFF09...`, "yellow");
    await batchWithRetry(toFetch, (s) => fetchSymbolHistory(s, neededRange), {
      isFailed: (_result, idx) => !state.historicalCache[neededRange][toFetch[idx]]
    });
    if (state.lastUpdateText) {
      setStatus(state.lastUpdateText, "green");
    } else {
      setStatus("\u672A\u66F4\u65B0", "yellow");
    }
  } finally {
    state.fetchingRanges.delete(neededRange);
    state.historicalAttempted[neededRange] = true;
  }
}
async function fetchSymbolHistory(symbol, range = "1y") {
  if (!state.historicalCache[range]) state.historicalCache[range] = {};
  if (state.historicalCache[range][symbol]) return;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`;
  const data = await fetchViaProxy(url, 7e3, false);
  if (!data) return;
  const result = data?.chart?.result?.[0];
  if (!result) return;
  const timestamps = result.timestamp || [];
  const adjCloses = result.indicators?.adjclose?.[0]?.adjclose || [];
  const rawCloses = result.indicators?.quote?.[0]?.close || [];
  const closes = adjCloses.length ? adjCloses : rawCloses;
  const volumes = result.indicators?.quote?.[0]?.volume || [];
  const entries = timestamps.map((ts, i) => {
    const v = volumes[i];
    const e = { date: new Date(ts * 1e3), close: closes[i] };
    if (v != null && isFinite(v)) e.vol = v;
    return e;
  }).filter((p) => p.close != null && isFinite(p.close));
  await setHistoricalEntry(range, symbol, applySplitCorrection(entries));
}
function isMarketHours() {
  const now = /* @__PURE__ */ new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  const utcMin = h * 60 + m;
  const tse = utcMin >= 0 && utcMin < 390;
  const nyse = utcMin >= 870 && utcMin < 1260;
  return tse || nyse;
}
var ERR_LABELS = {
  rateLimit: "\u30EC\u30FC\u30C8\u5236\u9650429",
  serverError: "\u30B5\u30FC\u30D0\u30FC\u30A8\u30E9\u30FC",
  timeout: "\u30BF\u30A4\u30E0\u30A2\u30A6\u30C8",
  networkError: "\u901A\u4FE1\u30A8\u30E9\u30FC",
  noData: "\u30C7\u30FC\u30BF\u306A\u3057"
};
async function fetchLivePrice(symbol) {
  let finnhubErr = null;
  const fSymbol = toFinnhubSymbol(symbol);
  if (fSymbol) {
    const fh = await fetchFinnhubQuote(fSymbol);
    if (fh && !fh._err) return fh;
    finnhubErr = fh?._err || "networkError";
  }
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d&_=${Date.now()}`;
  const data = await fetchViaProxy(url, 7e3, true);
  const result = data?.chart?.result?.[0];
  if (!result) {
    if (!finnhubErr) {
      state.providerHealth.yahoo.ok = false;
      state.providerHealth.yahoo.errCount++;
      state.providerHealth.yahoo.lastErr = Date.now();
    }
    return { _err: finnhubErr || "noData" };
  }
  const price = result.meta?.regularMarketPrice ?? null;
  if (price == null) return { _err: finnhubErr || "noData" };
  const preCalcPct = result.meta?.regularMarketChangePercent ?? null;
  const prevClose = result.meta?.regularMarketPreviousClose ?? result.meta?.chartPreviousClose ?? result.meta?.previousClose ?? null;
  const dayPct = preCalcPct !== null ? preCalcPct : prevClose ? (price - prevClose) / prevClose * 100 : null;
  return { price, dayPct };
}
async function refreshPrices() {
  const targets = positions.filter((p) => p.ySymbol);
  if (targets.length === 0) {
    setStatus("\u53D6\u5F97\u5BFE\u8C61\u9298\u67C4\u306A\u3057", "yellow");
    return;
  }
  setStatus(`\u30E9\u30A4\u30D6\u4FA1\u683C\u3092\u53D6\u5F97\u4E2D\uFF080/${targets.length}\uFF09...`, "yellow");
  const hasUSD = targets.some((p) => p.cur === "USD");
  if (hasUSD) {
    const now = Date.now();
    if (!state.forexRate.USDJPY || now - state.forexRate.ts > 36e5) {
      const rate = await fetchForexRate("USD", "JPY");
      if (rate) {
        state.forexRate.USDJPY = rate;
        state.forexRate.ts = now;
      }
    }
  }
  const fetched = await batchWithRetry(
    targets,
    async (p) => ({ pos: p, live: await fetchLivePrice(p.ySymbol) }),
    {
      isFailed: (r) => !r.live || r.live._err === "timeout" || r.live._err === "serverError",
      onProgress: (done, total2) => setStatus(`\u30E9\u30A4\u30D6\u4FA1\u683C\u3092\u53D6\u5F97\u4E2D\uFF08${done}/${total2}\uFF09...`, "yellow")
    }
  );
  const updateCache = (sym, price) => {
    if (!price || !isFinite(price) || price <= 0) return;
    for (const r of ["1y", "5y", "10y"]) {
      const arr = state.historicalCache[r]?.[sym];
      if (!arr?.length) continue;
      const last = arr[arr.length - 1].close;
      if (last > 0 && (price / last < 0.3 || price / last > 3)) {
        console.warn(`[updateCache] \u7570\u5E38\u4FA1\u683C\u30B9\u30AD\u30C3\u30D7: ${sym} live=${price} hist=${last}`);
        continue;
      }
      arr[arr.length - 1].close = price;
    }
  };
  const errCounts = {};
  fetched.forEach(({ live }) => {
    if (!live || live._err) {
      const key = live?._err || "networkError";
      errCounts[key] = (errCounts[key] || 0) + 1;
    }
  });
  let n = 0;
  fetched.forEach(({ pos: p, live }) => {
    if (!live || live._err) return;
    if (!p.isProxy && p.price > 0 && (live.price / p.price < 0.1 || live.price / p.price > 10)) {
      console.warn(`[refreshPrices] \u7570\u5E38\u4FA1\u683C\u30B9\u30AD\u30C3\u30D7: ${p.symbol} live=${live.price} stored=${p.price}`);
      return;
    }
    if (p.isProxy) {
      p.dayPct = live.dayPct ?? null;
      updateCache(p.ySymbol, live.price);
    } else {
      p.price = live.price;
      if (p.cur === "JPY") {
        p.value = Math.round(live.price * p.shares);
        const costTotal = p.avgCost * p.shares;
        p.pnl = p.value - costTotal;
        p.pnlPct = costTotal > 0 ? p.pnl / costTotal * 100 : 0;
      } else {
        const storedFxRate = state.forexRate.USDJPY;
        const estimatedFxRate = !storedFxRate && p.value > 0 && p.price > 0 && p.shares > 0 ? p.value / (p.price * p.shares) : 0;
        const fxRate = storedFxRate || estimatedFxRate;
        const costJPY = p.value != null && p.pnl != null ? p.value - p.pnl : 0;
        if (fxRate > 0) {
          p.value = Math.round(live.price * p.shares * fxRate);
          p.pnl = p.value - costJPY;
          p.pnlPct = costJPY > 0 ? p.pnl / costJPY * 100 : 0;
        }
      }
      p.dayPct = live.dayPct ?? null;
      updateCache(p.ySymbol, live.price);
    }
    n++;
  });
  const total = targets.length;
  const failedCount = total - n;
  const fmtErrDetail = () => Object.entries(errCounts).map(([k, c]) => `${ERR_LABELS[k] || k}\xD7${c}`).join("\u30FB");
  if (n > 0) {
    const now = /* @__PURE__ */ new Date();
    const ts2 = now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    const trackedCount = trackedSymbolCount(positions, state.watchlist);
    const msg = failedCount > 0 ? `\u30E9\u30A4\u30D6\u4FA1\u683C: ${n}/${total}\u9298\u67C4 \u66F4\u65B0\uFF08${fmtErrDetail()}\uFF09 ${ts2}` : `${trackedCount}\u9298\u67C4 \u6700\u7D42\u66F4\u65B0: ${ts2}`;
    state.lastUpdateText = msg;
    setStatus(msg, failedCount > 0 ? "yellow" : "green");
    document.dispatchEvent(new CustomEvent("hm:prices-updated"));
    flashPriceChanges(fetched);
    renderProviderHealth();
  } else if (!isMarketHours()) {
    setStatus("\u5E02\u5834\u6642\u9593\u5916\uFF08\u524D\u56DE\u30C7\u30FC\u30BF\u3067\u8868\u793A\u4E2D\uFF09", "yellow");
    renderProviderHealth();
  } else {
    setStatus(`\u30E9\u30A4\u30D6\u4FA1\u683C\u53D6\u5F97\u5931\u6557: 0/${total}\u9298\u67C4\uFF08${fmtErrDetail()}\uFF09`, "red");
    renderProviderHealth();
  }
}

// src/stock-list.js
function updateSlColStyle() {
  const el = document.getElementById("sl-col-style");
  if (!el) return;
  if (state.slDetailVisible) {
    el.textContent = "";
  } else {
    el.textContent = SL_DETAIL_COLS.map(
      (c) => `.sl-table th[data-col="${c}"], .sl-table td[data-col="${c}"] { display: none; }`
    ).join("\n");
  }
}
function slToggleDetail() {
  state.slDetailVisible = !state.slDetailVisible;
  updateSlColStyle();
  const btn = document.getElementById("sl-eye-btn");
  if (btn) {
    btn.classList.toggle("hidden", !state.slDetailVisible);
    const slash = document.getElementById("sl-eye-slash");
    if (slash) slash.style.display = state.slDetailVisible ? "none" : "";
  }
  requestAnimationFrame(applyStockBars);
}
function getPctForPeriod(p, periodId) {
  if (!p.ySymbol) return null;
  if (periodId === "1d") return p.dayPct;
  return getHistoricalChangePct(p.ySymbol, periodId);
}
function slMarketLabel(p) {
  if (p.cat === "\u65E5\u672C\u682A\u30FBETF") return "\u6771\u8A3C";
  if (p.cat === "\u6295\u8CC7\u4FE1\u8A17") return "\u6295\u4FE1";
  return "US";
}
function renderStockList() {
  const panel = document.getElementById("panel-list");
  if (panel?.hidden) return;
  const wrap = document.getElementById("stock-list-wrap");
  if (!wrap) return;
  const maxValue = Math.max(1, ...positions.map((p) => p.value || 0));
  const items = [...positions].sort((a, b) => {
    let va, vb;
    if (PERIOD_IDS.includes(state.listSortCol)) {
      va = getPctForPeriod(a, state.listSortCol);
      vb = getPctForPeriod(b, state.listSortCol);
    } else if (state.listSortCol === "pnlPct") {
      va = a.pnlPct;
      vb = b.pnlPct;
    } else if (state.listSortCol === "pnl") {
      va = a.pnl;
      vb = b.pnl;
    } else if (state.listSortCol === "value") {
      va = a.value;
      vb = b.value;
    } else if (state.listSortCol === "price") {
      va = a.price;
      vb = b.price;
    } else if (state.listSortCol === "shares") {
      va = a.shares;
      vb = b.shares;
    } else if (state.listSortCol === "avgCost") {
      va = a.avgCost;
      vb = b.avgCost;
    } else if (state.listSortCol === "market") {
      const cmp = slMarketLabel(a).localeCompare(slMarketLabel(b), "ja");
      return state.listSortDir === "desc" ? -cmp : cmp;
    } else {
      va = a.symbol;
      vb = b.symbol;
    }
    if (va === null || va === void 0) return 1;
    if (vb === null || vb === void 0) return -1;
    return state.listSortDir === "desc" ? vb > va ? 1 : -1 : va > vb ? 1 : -1;
  });
  const th = (label, col, align) => makeTh(label, col, align, state.listSortCol, state.listSortDir, "slSort");
  const slSgn = (v) => v != null && v < 0 ? "neg" : "";
  const rows = items.map((p) => {
    const pnlAmtCls = slSgn(p.pnl);
    const pnlStr = p.pnl != null ? fmtJPYInt(p.pnl) : "-";
    const pnlPctStr = p.pnlPct != null ? fmtPctInt(p.pnlPct) : "-";
    const pnlPctBg = p.pnlPct != null ? getColor(p.pnlPct, "pnl") : null;
    const pnlPctFg = pnlPctBg ? getCellTextColor(pnlPctBg) : null;
    const valStr = p.value != null ? fmtJPYInt(p.value) : "-";
    const priceStr = fmtPrice(p.price, p.cur);
    const costStr = fmtPrice(p.avgCost, p.cur);
    const sharesStr = fmtShares(p.shares) + (p.cat === "\u6295\u8CC7\u4FE1\u8A17" ? "\u53E3" : "\u682A");
    const barPct = p.value && maxValue > 0 ? p.value / maxValue : 0;
    const periodCells = makePeriodCells((periodId) => getPctForPeriod(p, periodId));
    return `<tr data-bar="${barPct.toFixed(4)}">
      <td data-col="symbol" class="sl-sym">${escapeHTML(p.symbol)}<span class="sl-inline-name">${escapeHTML(p.name)}</span></td>
      <td data-col="market"><span class="wl-type-badge">${slMarketLabel(p)}</span></td>
      <td data-col="value">${valStr}</td>
      <td data-col="shares">${sharesStr}</td>
      <td data-col="avgCost">${costStr}</td>
      <td data-col="price">${priceStr}</td>
      ${periodCells}
      <td data-col="pnl" class="${pnlAmtCls}">${pnlStr}</td>
      <td data-col="pnlPct" class="sl-pct-cell" ${pnlPctBg ? `style="background:${pnlPctBg};color:${pnlPctFg}"` : ""}>${pnlPctStr}</td>
    </tr>`;
  }).join("");
  wrap.innerHTML = `<table class="sl-table">
    <thead><tr>
      ${th('\u30C6\u30A3\u30C3\u30AB\u30FC<br><span class="sl-th-sub">\u9298\u67C4\u540D</span>', "symbol")}
      ${th("\u5E02\u5834", "market", "center")}
      ${th("\u6642\u4FA1\u8A55\u4FA1\u984D", "value")}
      ${th("\u4FDD\u6709\u6570", "shares")}
      ${th("\u53D6\u5F97\u5358\u4FA1", "avgCost")}
      ${th("\u73FE\u5728\u5024", "price")}
      ${makePeriodHeaderCells(state.listSortCol, state.listSortDir, "slSort")}
      ${th("\u542B\u307F\u640D\u76CA", "pnl")}
      ${th("\u640D\u76CA\u7387", "pnlPct", "center")}
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
  updateSlColStyle();
  requestAnimationFrame(applyStockBars);
}
function applyStockBars() {
  if (state.activeTab !== "list") return;
  const tbl = document.querySelector(".sl-table");
  if (!tbl) return;
  const symTh = tbl.querySelector('th[data-col="symbol"]');
  if (!symTh) return;
  const tblRect = tbl.getBoundingClientRect();
  const symRect = symTh.getBoundingClientRect();
  const rows = tbl.querySelectorAll("tbody tr[data-bar]");
  const fracs = Array.from(rows).map((tr) => parseFloat(tr.dataset.bar || "0"));
  const startX = symRect.right - tblRect.left;
  const totalW = tblRect.width;
  const barMaxW = totalW - startX;
  const edgePx = 2;
  rows.forEach((tr, i) => {
    const frac = fracs[i];
    if (frac <= 0 || barMaxW <= 0) {
      tr.style.removeProperty("--bar-start");
      tr.style.removeProperty("--bar-edge-start");
      tr.style.removeProperty("--bar-end");
      return;
    }
    const barEnd = startX + barMaxW * frac;
    const edgeStart = Math.max(startX + 1, barEnd - edgePx);
    tr.style.setProperty("--bar-start", `${startX}px`);
    tr.style.setProperty("--bar-edge-start", `${edgeStart.toFixed(1)}px`);
    tr.style.setProperty("--bar-end", `${barEnd.toFixed(1)}px`);
  });
}
function slSort(col) {
  _tableSort("listSortCol", "listSortDir", col);
  renderStockList();
}

// src/chart.js
function _calcMA(points, n) {
  return points.map((p, i) => {
    const slice = points.slice(Math.max(0, i - n + 1), i + 1);
    return { date: p.date, ma: slice.reduce((a, b) => a + b.close, 0) / slice.length };
  });
}
function _buildMAStyles(points) {
  const enough = points.length >= 2;
  return [
    { data: enough ? _calcMA(points, 5) : [], color: "#5ac8fa", width: 1, opacity: 0.85, label: "5\u65E5MA" },
    { data: enough ? _calcMA(points, 200) : [], color: "#2e90d8", width: 1.4, opacity: 0.9, label: "200\u65E5MA" },
    { data: enough ? _calcMA(points, 50) : [], color: "#1a5fa0", width: 1.8, opacity: 0.9, label: "50\u9031MA" }
  ];
}
function _drawChartContent(g, x, y, iW, iH, points, avgCost, cur, lineColor, defs, dateFmt, maStyles) {
  g.append("g").call(d3.axisLeft(y).ticks(5).tickSize(-iW).tickFormat("")).call((g2) => g2.select(".domain").remove()).call((g2) => g2.selectAll(".tick line").attr("stroke", cssVar("--chart-grid")));
  g.append("g").attr("transform", `translate(0,${iH})`).call(d3.axisBottom(x).ticks(5).tickSize(-iH).tickFormat("")).call((g2) => g2.select(".domain").remove()).call((g2) => g2.selectAll(".tick line").attr("stroke", cssVar("--chart-grid")));
  const areaGrad = defs.append("linearGradient").attr("id", "area-grad").attr("x1", "0").attr("y1", "0").attr("x2", "0").attr("y2", "1");
  areaGrad.append("stop").attr("offset", "0%").attr("stop-color", lineColor).attr("stop-opacity", 0.28);
  areaGrad.append("stop").attr("offset", "100%").attr("stop-color", lineColor).attr("stop-opacity", 0.02);
  g.append("path").datum(points).attr("d", d3.area().x((d) => x(d.date)).y0(iH).y1((d) => y(d.close)).curve(d3.curveMonotoneX)).attr("fill", "url(#area-grad)");
  const cy = y(avgCost);
  g.append("line").attr("x1", 0).attr("x2", iW).attr("y1", cy).attr("y2", cy).attr("stroke", cssVar("--cost-line")).attr("stroke-width", 0.7).attr("stroke-dasharray", "4,3");
  g.append("text").attr("x", 2).attr("y", cy - 4).attr("fill", cssVar("--cost-text")).attr("font-size", 10).text(`\u53D6\u5F97\u5358\u4FA1: ${cur === "USD" ? `$${avgCost.toFixed(2)}` : `\xA5${Math.round(avgCost).toLocaleString()}`}`);
  const maLineFn = d3.line().x((d) => x(d.date)).y((d) => y(d.ma)).curve(d3.curveMonotoneX);
  maStyles.forEach((ma) => {
    if (!ma.data.length) return;
    g.append("path").datum(ma.data).attr("d", maLineFn).attr("fill", "none").attr("stroke", ma.color).attr("stroke-width", ma.width).attr("opacity", ma.opacity);
  });
  g.append("path").datum(points).attr("d", d3.line().x((d) => x(d.date)).y((d) => y(d.close)).curve(d3.curveMonotoneX)).attr("fill", "none").attr("stroke", lineColor).attr("stroke-width", 2);
  const lp = points[points.length - 1];
  g.append("circle").attr("cx", x(lp.date)).attr("cy", y(lp.close)).attr("r", 4).attr("fill", lineColor);
  const tickFmt = cur === "USD" ? (d) => `$${d >= 1e3 ? `${(d / 1e3).toFixed(1)}k` : d.toFixed(0)}` : (d) => d >= 1e5 ? `\xA5${(d / 1e4).toFixed(0)}\u4E07` : d >= 1e4 ? `\xA5${(d / 1e3).toFixed(0)}k` : `\xA5${Math.round(d)}`;
  g.append("g").attr("transform", `translate(0,${iH})`).call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat(dateFmt))).call((g2) => {
    g2.select(".domain").attr("stroke", cssVar("--border"));
    g2.selectAll(".tick text").attr("fill", cssVar("--text2")).attr("font-size", 11);
    g2.selectAll(".tick line").attr("stroke", cssVar("--border"));
  });
  g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(tickFmt)).call((g2) => {
    g2.select(".domain").attr("stroke", cssVar("--border"));
    g2.selectAll(".tick text").attr("fill", cssVar("--text2")).attr("font-size", 11);
    g2.selectAll(".tick line").attr("stroke", cssVar("--border"));
  });
}
function _initChartCrosshair(g, x, y, points, m, iW, iH, interval, cur, lineColor, maStyles) {
  const bisect = d3.bisector((d) => d.date).left;
  const pf2 = (v) => cur === "USD" ? `$${v.toFixed(2)}` : `\xA5${Math.round(v).toLocaleString()}`;
  const crosshair = g.append("g").style("display", "none");
  const chLineV = crosshair.append("line").attr("stroke", cssVar("--text2")).attr("stroke-dasharray", "3,3").attr("stroke-width", 1);
  const chLineH = crosshair.append("line").attr("stroke", cssVar("--text2")).attr("stroke-dasharray", "3,3").attr("stroke-width", 1);
  const chDot = crosshair.append("circle").attr("r", 4.5).attr("fill", lineColor).attr("stroke", cssVar("--surface")).attr("stroke-width", 2);
  const chBg = crosshair.append("rect").attr("rx", 4).attr("fill", cssVar("--surface")).attr("stroke", cssVar("--border")).attr("stroke-width", 1);
  const chLabel = crosshair.append("text").attr("fill", cssVar("--text")).attr("font-size", 12).attr("font-weight", 600);
  const chMABox = crosshair.append("g");
  function updateCrosshair(clientX) {
    const svgEl = document.getElementById("chart-svg");
    const rect = svgEl.getBoundingClientRect();
    const mx = clientX - rect.left - m.left;
    if (mx < 0 || mx > iW) return;
    const date = x.invert(mx);
    const idx = Math.min(bisect(points, date), points.length - 1);
    const p = points[idx];
    const px = x(p.date), py = y(p.close);
    const isRight = px > iW * 0.65;
    const labelX = isRight ? px - 10 : px + 10;
    crosshair.style("display", null);
    chLineV.attr("x1", px).attr("x2", px).attr("y1", 0).attr("y2", iH);
    chLineH.attr("x1", 0).attr("x2", iW).attr("y1", py).attr("y2", py);
    chDot.attr("cx", px).attr("cy", py);
    const dateStr = interval === "5m" || interval === "1h" ? p.date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : p.date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
    chLabel.attr("x", labelX).attr("y", Math.max(14, py - 14)).attr("text-anchor", isRight ? "end" : "start").text(`${dateStr}  ${pf2(p.close)}`);
    const bb = chLabel.node().getBBox();
    chBg.attr("x", bb.x - 4).attr("y", bb.y - 4).attr("width", bb.width + 8).attr("height", bb.height + 8);
    chMABox.selectAll("*").remove();
    const bxX = isRight ? 6 : iW - 110;
    const getMAAt = (maData) => {
      const mi = bisect(maData, date, 0, maData.length);
      return maData[Math.min(mi, maData.length - 1)]?.ma ?? null;
    };
    maStyles.filter((ma) => ma.data.length > 0).forEach((ma, i) => {
      const val = getMAAt(ma.data);
      if (val === null) return;
      chMABox.append("circle").attr("cx", bxX + 5).attr("cy", 8 + i * 16).attr("r", 3).attr("fill", ma.color);
      chMABox.append("text").attr("x", bxX + 12).attr("y", 12 + i * 16).attr("fill", ma.color).attr("font-size", 11).text(`${ma.label} ${pf2(val)}`);
    });
  }
  const interactRect = g.append("rect").attr("width", iW).attr("height", iH).attr("fill", "transparent").style("touch-action", "none");
  interactRect.on("mousemove", (e) => updateCrosshair(e.clientX)).on("mouseleave", () => crosshair.style("display", "none")).on("touchstart", (e) => {
    e.preventDefault();
    updateCrosshair(e.touches[0].clientX);
  }).on("touchmove", (e) => {
    e.preventDefault();
    updateCrosshair(e.touches[0].clientX);
  }).on("touchend", () => crosshair.style("display", "none"));
}
function _renderChartStats(points, avgCost, cur, maStyles) {
  const fp = points[0].close;
  const lastPrice = points[points.length - 1].close;
  const chgPct = (lastPrice - fp) / fp * 100;
  const pnlPct = (lastPrice - avgCost) / avgCost * 100;
  const pf = (v) => cur === "USD" ? `$${v.toFixed(2)}` : `\xA5${Math.round(v).toLocaleString()}`;
  const maLegend = maStyles.filter((ma) => ma.data.length > 0).map((ma) => {
    const last = ma.data[ma.data.length - 1].ma;
    return `<span style="display:inline-flex;align-items:center;gap:4px"><svg width="8" height="8"><circle cx="4" cy="4" r="3.5" fill="${ma.color}"/></svg><span style="color:${ma.color};font-size:11px">${ma.label}</span> <strong>${pf(last)}</strong></span>`;
  }).join("");
  const chartStatsEl = document.getElementById("chart-stats");
  if (chartStatsEl) {
    chartStatsEl.innerHTML = `
      <span>\u73FE\u5728\u5024: <strong class="neu">${pf(lastPrice)}</strong></span>
      <span>\u671F\u9593\u5909\u52D5: <strong class="${sgn(chgPct)}">${fmtPct(chgPct)}</strong></span>
      <span>\u640D\u76CA\u7387: <strong class="${sgn(pnlPct)}">${fmtPct(pnlPct)}</strong></span>
      <span>\u9AD8\u5024: <strong class="neu">${pf(d3.max(points, (d) => d.close))}</strong></span>
      <span>\u5B89\u5024: <strong class="neu">${pf(d3.min(points, (d) => d.close))}</strong></span>
      ${maLegend}
    `;
  }
}
function openChart(pos) {
  state.currentPos = pos;
  const proxyNote = pos.isProxy ? ` <span class="modal-sym" style="color:#e3b341">\u203B ${pos.proxyName}</span>` : ` <span class="modal-sym">${escapeHTML(pos.symbol)}</span>`;
  document.getElementById("modal-title").innerHTML = escapeHTML(pos.name) + proxyNote;
  updateRangeBtns();
  document.getElementById("modal-overlay").style.display = "flex";
  document.body.style.overflow = "hidden";
  if (pos.ySymbol) {
    loadChart(pos.ySymbol, state.currentRange);
  } else {
    document.getElementById("chart-message").className = "chart-error";
    document.getElementById("chart-message").textContent = "\u3053\u306E\u9298\u67C4\u306E\u30C1\u30E3\u30FC\u30C8\u30C7\u30FC\u30BF\u306FYahoo Finance\u306B\u672A\u5BFE\u5FDC\u3067\u3059";
    document.getElementById("chart-message").style.display = "block";
    document.getElementById("chart-svg").style.display = "none";
    document.getElementById("chart-stats").innerHTML = "";
  }
}
function closeModal() {
  document.getElementById("modal-overlay").style.display = "none";
  document.body.style.overflow = "";
}
function handleOverlayClick(event) {
  if (event.target === document.getElementById("modal-overlay")) closeModal();
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});
function setRange(range) {
  state.currentRange = range;
  updateRangeBtns();
  if (state.currentPos && state.currentPos.ySymbol) loadChart(state.currentPos.ySymbol, range);
}
function updateRangeBtns() {
  document.querySelectorAll(".range-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.range === state.currentRange);
  });
}
async function loadChart(symbol, rangeId) {
  const cfg = CHART_RANGES[rangeId] || CHART_RANGES["3mo"];
  const msg = document.getElementById("chart-message");
  const chartSvg = document.getElementById("chart-svg");
  const hasChart = chartSvg.childElementCount > 0;
  if (hasChart) {
    msg.style.display = "none";
  } else {
    msg.className = "chart-loading";
    msg.textContent = "\u8AAD\u307F\u8FBC\u307F\u4E2D...";
    msg.style.display = "block";
    chartSvg.style.display = "none";
  }
  document.getElementById("chart-stats").innerHTML = "";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${cfg.interval}&range=${cfg.yRange}`;
  const chartData = await fetchViaProxy(url);
  const chartResult = chartData?.chart?.result?.[0] ?? null;
  if (!chartResult) {
    msg.className = "chart-error";
    msg.textContent = "\u30C1\u30E3\u30FC\u30C8\u30C7\u30FC\u30BF\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\n\uFF08\u63A5\u7D9A\u78BA\u8A8D\u30FB\u5730\u57DF\u306B\u3088\u308BAPI\u30A2\u30AF\u30BB\u30B9\u5236\u9650\u306E\u53EF\u80FD\u6027\uFF09";
    msg.style.display = "block";
    chartSvg.style.display = "none";
    return;
  }
  const timestamps = chartResult.timestamp || [];
  const closes = chartResult.indicators?.quote?.[0]?.close || [];
  const points = timestamps.map((ts, i) => ({
    date: new Date(ts * 1e3),
    close: closes[i]
  })).filter((p) => p.close != null && isFinite(p.close));
  if (points.length < 2) {
    msg.className = "chart-error";
    msg.textContent = "\u8868\u793A\u3067\u304D\u308B\u30C7\u30FC\u30BF\u304C\u4E0D\u8DB3\u3057\u3066\u3044\u307E\u3059";
    msg.style.display = "block";
    chartSvg.style.display = "none";
    return;
  }
  msg.style.display = "none";
  chartSvg.style.display = "block";
  renderChart(points, cfg.interval, cfg.dateFmt);
}
function renderChart(points, interval = "1d", dateFmt = "%m/%d") {
  const container = document.getElementById("modal");
  const W = container.clientWidth - 40;
  const H = Math.max(260, Math.min(360, Math.round(W * 0.5)));
  const m = { top: 18, right: 18, bottom: 32, left: 68 };
  const iW = W - m.left - m.right;
  const iH = H - m.top - m.bottom;
  const { avgCost, cur } = state.currentPos;
  const fp = points[0].close;
  const lastPrice = points[points.length - 1].close;
  const lineColor = lastPrice >= fp ? "#30D158" : "#FF453A";
  const maStyles = _buildMAStyles(points);
  const svg = d3.select("#chart-svg").attr("width", W).attr("height", H);
  svg.selectAll("*").remove();
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
  const defs = svg.append("defs");
  const x = d3.scaleTime().domain(d3.extent(points, (d) => d.date)).range([0, iW]);
  const maVals = maStyles.flatMap((ma) => ma.data.map((d) => d.ma));
  const allVals = points.map((d) => d.close).concat([avgCost]).concat(maVals).filter((v) => v != null);
  const y = d3.scaleLinear().domain([d3.min(allVals) * 0.97, d3.max(allVals) * 1.02]).range([iH, 0]);
  _drawChartContent(g, x, y, iW, iH, points, avgCost, cur, lineColor, defs, dateFmt, maStyles);
  _initChartCrosshair(g, x, y, points, m, iW, iH, interval, cur, lineColor, maStyles);
  _renderChartStats(points, avgCost, cur, maStyles);
}

// src/heatmap.js
var _heatmapRetryCount = 0;
var HEATMAP_MAX_RETRY = 30;
function renderHeatmap() {
  if (typeof d3 === "undefined") {
    console.warn("[heatmap] D3 not loaded");
    return;
  }
  const panel = document.getElementById("panel-heatmap");
  if (panel?.hidden) return;
  const wrap = document.getElementById("heatmap-wrap");
  if (!wrap) return;
  const W = wrap.clientWidth;
  if (W === 0) {
    if (_heatmapRetryCount++ < HEATMAP_MAX_RETRY) {
      requestAnimationFrame(renderHeatmap);
    } else {
      console.warn("[heatmap] clientWidth=0 \u304C\u7D99\u7D9A \u2192 \u63CF\u753B\u4E2D\u6B62");
      _heatmapRetryCount = 0;
      if (wrap && typeof IntersectionObserver !== "undefined") {
        const obs = new IntersectionObserver((entries) => {
          if (entries[0]?.isIntersecting) {
            obs.disconnect();
            renderHeatmap();
          }
        });
        obs.observe(wrap);
      }
      if (!document.getElementById("heatmap-retry-msg")) {
        const el = document.createElement("p");
        el.id = "heatmap-retry-msg";
        el.style.cssText = "text-align:center;padding:16px;color:var(--text2);font-size:13px;";
        el.textContent = "\u30D2\u30FC\u30C8\u30DE\u30C3\u30D7\u3092\u8868\u793A\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u518D\u8AAD\u307F\u8FBC\u307F\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
        wrap.appendChild(el);
      }
    }
    return;
  }
  _heatmapRetryCount = 0;
  const retryMsg = document.getElementById("heatmap-retry-msg");
  if (retryMsg) retryMsg.remove();
  const aspectRatio = W < C.MOBILE_BREAKPOINT ? C.HEATMAP_ASPECT_MOB : C.HEATMAP_ASPECT_DSK;
  const minH = W < C.MOBILE_BREAKPOINT ? C.HEATMAP_MINH_MOB : C.HEATMAP_MINH_DSK;
  const stickyEl = document.querySelector(".sticky-top");
  const simBarEl = document.querySelector(".sim-bar");
  const footerEl = wrap.closest("#panel-heatmap")?.querySelector(".footer");
  const stickyH = stickyEl ? stickyEl.offsetHeight : 0;
  const simBarH = simBarEl ? simBarEl.offsetHeight : 0;
  const footerH = footerEl ? footerEl.offsetHeight : 0;
  const padBot = parseFloat(getComputedStyle(document.body).paddingBottom) || 16;
  const viewH = window.innerHeight - stickyH - simBarH - footerH - padBot - 4;
  const H = Math.max(minH, viewH > 100 ? viewH : Math.round(W * aspectRatio));
  const svg = d3.select("#heatmap").style("display", "block").attr("width", W).attr("height", H);
  svg.selectAll("*").remove();
  const GROUP_DEFS = [
    { key: "us", name: "\u7C73\u56FD\u682A\u30FBETF" },
    { key: "jp", name: "\u65E5\u672C\u682A\u30FBETF\u30FB\u6295\u8CC7\u4FE1\u8A17" }
  ];
  const groupKeyOf = (p) => {
    if (p.cat === "\u7C73\u56FD\u682A\u30FBETF") return "us";
    if (p.cat === "\u65E5\u672C\u682A\u30FBETF" || p.cat === "\u6295\u8CC7\u4FE1\u8A17") return "jp";
    if (p.cur === "USD" && !String(p.ySymbol || "").endsWith(".T")) return "us";
    return "jp";
  };
  const groups = GROUP_DEFS.map((g) => ({
    name: g.name,
    children: positions.filter((p) => groupKeyOf(p) === g.key).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).map((p) => ({ ...p, size: p.value ?? 0 }))
  })).filter((g) => g.children.length > 0);
  if (groups.length === 0) {
    svg.append("text").attr("x", W / 2).attr("y", 32).attr("fill", cssVar("--text2")).attr("text-anchor", "middle").attr("font-size", 13).text("\u8868\u793A\u3067\u304D\u308B\u4FDD\u6709\u9298\u67C4\u304C\u3042\u308A\u307E\u305B\u3093");
    renderStockList();
    return;
  }
  groups.sort(
    (a, b) => b.children.reduce((s, c) => s + (c.size ?? 0), 0) - a.children.reduce((s, c) => s + (c.size ?? 0), 0)
  );
  const hierData = { name: "root", children: groups };
  const root = d3.hierarchy(hierData).sum((d) => d.size || 0);
  d3.treemap().size([W, H]).paddingOuter(W < C.MOBILE_BREAKPOINT ? 0 : 6).paddingTop(20).paddingInner(4).tile(d3.treemapSquarify)(root);
  (root.children || []).forEach((catNode) => {
    svg.append("rect").attr("x", catNode.x0).attr("y", catNode.y0).attr("width", catNode.x1 - catNode.x0).attr("height", catNode.y1 - catNode.y0).attr("fill", cssVar("--cat-bg")).attr("rx", 8);
    svg.append("text").attr("class", "cat-label").attr("x", catNode.x0 + 6).attr("y", catNode.y0 + 5).text(catNode.data.name);
  });
  const cells = svg.selectAll(".cell-g").data(root.leaves()).enter().append("g").attr("class", "cell-g").attr("role", "img").attr("aria-label", (d) => {
    const pct = getDisplayPct(d.data);
    return `${d.data.name} ${pct !== null ? fmtPctInt(pct) : "\u30C7\u30FC\u30BF\u306A\u3057"}`;
  });
  cells.append("rect").attr("x", (d) => d.x0).attr("y", (d) => d.y0).attr("width", (d) => Math.max(0, d.x1 - d.x0)).attr("height", (d) => Math.max(0, d.y1 - d.y0)).attr("rx", 7).attr("data-ysymbol", (d) => d.data.ySymbol || "").attr("fill", (d) => getColor(
    getDisplayPct(d.data),
    state.colorMode === "change" ? "change" : "pnl",
    state.colorMode === "change" ? PERIOD_MAP[state.changePeriod]?.scale ?? 25 : null
  ));
  cells.each(function(d) {
    const g = d3.select(this);
    const w = d.x1 - d.x0, h = d.y1 - d.y0;
    const cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2;
    const pct = getDisplayPct(d.data);
    const pctStr = pct !== null ? fmtPct(pct) : "\u2015";
    if (w < 24 || h < 14) return;
    const cellBg = getColor(
      pct,
      state.colorMode === "change" ? "change" : "pnl",
      state.colorMode === "change" ? PERIOD_MAP[state.changePeriod]?.scale ?? 25 : null
    );
    const symFill = getCellTextColor(cellBg);
    const pctFill = getCellTextColorSub(cellBg);
    const sqr = Math.sqrt(w * h);
    const idealSym = Math.min(C.SYM_FONT_MAX, Math.max(C.SYM_FONT_MIN, sqr * C.SYM_FONT_COEFF));
    const idealPct = Math.min(C.PCT_FONT_MAX, Math.max(C.PCT_FONT_MIN, idealSym * C.PCT_FONT_RATIO));
    const gap = idealSym * C.GAP_RATIO;
    const innerW = Math.max(w - 8, 12);
    const fitText = (textEl, idealSize) => {
      const node = textEl.node();
      if (!node) return;
      let measured = 0;
      try {
        measured = node.getComputedTextLength();
      } catch {
        return;
      }
      if (measured <= innerW || measured === 0) return;
      const shrunk = Math.max(C.SYM_FONT_MIN, Math.floor(idealSize * innerW / measured));
      textEl.attr("font-size", shrunk);
    };
    if (h >= 55 && w >= 44 || h >= 30 && w >= 32) {
      const symEl = g.append("text").attr("class", "lbl-sym").attr("fill", symFill).attr("x", cx).attr("y", cy - gap * C.GAP_SYM_OFFSET).attr("font-size", idealSym).text(d.data.symbol);
      fitText(symEl, idealSym);
      const pctEl = g.append("text").attr("class", "lbl-pct").attr("fill", pctFill).attr("x", cx).attr("y", cy + gap * C.GAP_PCT_OFFSET).attr("font-size", idealPct).text(pctStr);
      fitText(pctEl, idealPct);
    } else if (w >= 26 && h >= 16) {
      const symEl = g.append("text").attr("class", "lbl-sym").attr("fill", symFill).attr("x", cx).attr("y", cy).attr("font-size", idealSym).text(d.data.symbol);
      fitText(symEl, idealSym);
    }
  });
  renderStockList();
  const tt = document.getElementById("tooltip");
  cells.on("mousemove", function(event, d) {
    const p = d.data;
    let html = `<div class="tt-hdr">${escapeHTML(p.name)} <span class="tt-sym">${escapeHTML(p.symbol)}</span></div>

        <div class="tt-row"><span class="tt-label">\u73FE\u5728\u5024</span><span class="tt-val">${fmtPrice(p.price, p.cur)}</span></div>
        <div class="tt-row"><span class="tt-label">\u5E73\u5747\u53D6\u5F97\u5358\u4FA1</span><span class="tt-val">${fmtPrice(p.avgCost, p.cur)}</span></div>
        <div class="tt-row"><span class="tt-label">\u4FDD\u6709\u6570</span><span class="tt-val">${p.shares.toLocaleString()}${p.cat === "\u6295\u8CC7\u4FE1\u8A17" ? " \u53E3" : " \u682A"}</span></div>
        <div class="tt-sep"></div>
        <div class="tt-row"><span class="tt-label">\u6642\u4FA1\u8A55\u4FA1\u984D</span><span class="tt-val">${fmtJPY(p.value)}</span></div>
        <div class="tt-row"><span class="tt-label">\u542B\u307F\u640D\u76CA\uFF08\u5186\uFF09</span><span class="tt-val ${sgn(p.pnl)}">${fmtJPYFull(p.pnl)}</span></div>
        <div class="tt-row"><span class="tt-label">\u640D\u76CA\u7387</span><span class="tt-val ${sgn(p.pnlPct)}">${fmtPct(p.pnlPct)}</span></div>`;
    if (p.dayPct !== null && p.dayCh != null) html += `<div class="tt-sep"></div>
        <div class="tt-row"><span class="tt-label">\u524D\u65E5\u6BD4\uFF08\u5186\uFF09</span><span class="tt-val ${sgn(p.dayCh)}">${fmtJPYFull(p.dayCh)}</span></div>
        <div class="tt-row"><span class="tt-label">\u524D\u65E5\u6BD4\uFF08%\uFF09</span><span class="tt-val ${sgn(p.dayPct)}">${fmtPct(p.dayPct)}</span></div>`;
    if (p.isProxy) html += `<div class="tt-hint" style="color:var(--text2)">\u{1F4CA} \u9A30\u843D\u7387\u306F\u4EE3\u66FF\u30A4\u30F3\u30C7\u30C3\u30AF\u30B9\u3067\u8FD1\u4F3C<br>${escapeHTML(p.proxyName)}</div>`;
    html += `<div class="tt-hint">\u30AF\u30EA\u30C3\u30AF\u3067\u30C1\u30E3\u30FC\u30C8\u3092\u8868\u793A</div>`;
    tt.innerHTML = html;
    tt.style.display = "block";
    positionTooltip(event, tt);
  }).on("mouseleave", () => {
    tt.style.display = "none";
  }).on("click", (event, d) => {
    event.stopPropagation();
    tt.style.display = "none";
    openChart(d.data);
  });
}
function positionTooltip(event, el) {
  const tx = event.clientX + 16, ty = event.clientY - 10;
  const w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = `${tx + w > window.innerWidth - 10 ? event.clientX - w - 10 : tx}px`;
  el.style.top = `${ty + h > window.innerHeight - 10 ? event.clientY - h - 10 : ty}px`;
}

// src/schema.js
function validatePosition(obj) {
  if (!obj || typeof obj !== "object") {
    throw new Error("Position must be an object");
  }
  if (typeof obj.symbol !== "string" || !obj.symbol.trim()) {
    throw new Error("Position.symbol is required (non-empty string)");
  }
  if (typeof obj.name !== "string" || !obj.name.trim()) {
    throw new Error("Position.name is required (non-empty string)");
  }
  if (typeof obj.cat !== "string" || !obj.cat.trim()) {
    throw new Error("Position.cat is required (non-empty string)");
  }
  if (typeof obj.shares !== "number" || !isFinite(obj.shares)) {
    throw new Error("Position.shares must be a finite number");
  }
  if (typeof obj.price !== "number" || !isFinite(obj.price)) {
    throw new Error("Position.price must be a finite number");
  }
  if (typeof obj.avgCost !== "number" || !isFinite(obj.avgCost)) {
    throw new Error("Position.avgCost must be a finite number");
  }
  if (typeof obj.value !== "number" || !isFinite(obj.value)) {
    throw new Error("Position.value must be a finite number");
  }
  if (typeof obj.pnl !== "number" || !isFinite(obj.pnl)) {
    throw new Error("Position.pnl must be a finite number");
  }
  if (typeof obj.pnlPct !== "number" || !isFinite(obj.pnlPct)) {
    throw new Error("Position.pnlPct must be a finite number");
  }
  if (typeof obj.cur !== "string" || !obj.cur.trim()) {
    throw new Error("Position.cur is required (non-empty string)");
  }
  if (typeof obj.ySymbol !== "string" || !obj.ySymbol.trim()) {
    throw new Error("Position.ySymbol is required (non-empty string)");
  }
  if (obj.dayPct !== null && obj.dayPct !== void 0) {
    if (typeof obj.dayPct !== "number" || !isFinite(obj.dayPct)) {
      throw new Error("Position.dayPct must be null or a finite number");
    }
  }
  if (obj.dayCh !== null && obj.dayCh !== void 0) {
    if (typeof obj.dayCh !== "number" || !isFinite(obj.dayCh)) {
      throw new Error("Position.dayCh must be null or a finite number");
    }
  }
  if (obj.isProxy !== void 0 && typeof obj.isProxy !== "boolean") {
    throw new Error("Position.isProxy must be a boolean or undefined");
  }
  if (obj.proxyName !== void 0 && (typeof obj.proxyName !== "string" && obj.proxyName !== null)) {
    throw new Error("Position.proxyName must be a string, null, or undefined");
  }
  return obj;
}
function validateWatchlistItem(obj) {
  if (!obj || typeof obj !== "object") {
    throw new Error("Watchlist item must be an object");
  }
  if (typeof obj.symbol !== "string" || !obj.symbol.trim()) {
    throw new Error("Watchlist item.symbol is required (non-empty string)");
  }
  if (typeof obj.name !== "string" || !obj.name.trim()) {
    throw new Error("Watchlist item.name is required (non-empty string)");
  }
  if (typeof obj.exchange !== "string" || !obj.exchange.trim()) {
    throw new Error("Watchlist item.exchange is required (non-empty string)");
  }
  if (typeof obj.type !== "string" || !obj.type.trim()) {
    throw new Error("Watchlist item.type is required (non-empty string)");
  }
  if (typeof obj.cur !== "string" || !obj.cur.trim()) {
    throw new Error("Watchlist item.cur is required (non-empty string)");
  }
  if (obj.valuation !== void 0 && obj.valuation !== null) {
    validateWatchlistValuation(obj.valuation);
  }
  return obj;
}
var WATCHLIST_VALUATION_STATUSES = ["cheap", "fair", "rich", "hold"];
function validateWatchlistValuation(v) {
  if (!v || typeof v !== "object") {
    throw new Error("Watchlist valuation must be an object");
  }
  for (const f of ["perCurrent", "bandLow", "bandHigh", "percentile"]) {
    if (typeof v[f] !== "number" || !isFinite(v[f])) {
      throw new Error(`Watchlist valuation.${f} must be a finite number`);
    }
  }
  if (v.percentile < 0 || v.percentile > 100) {
    throw new Error("Watchlist valuation.percentile must be between 0 and 100");
  }
  if (v.bandMedian !== void 0 && v.bandMedian !== null) {
    if (typeof v.bandMedian !== "number" || !isFinite(v.bandMedian)) {
      throw new Error("Watchlist valuation.bandMedian must be null or a finite number");
    }
  }
  if (typeof v.status !== "string" || !WATCHLIST_VALUATION_STATUSES.includes(v.status)) {
    throw new Error(`Watchlist valuation.status must be one of: ${WATCHLIST_VALUATION_STATUSES.join(", ")}`);
  }
  if (typeof v.asOf !== "string" || !v.asOf.trim()) {
    throw new Error("Watchlist valuation.asOf is required (ISO date string)");
  }
  if (v.note !== void 0 && v.note !== null && typeof v.note !== "string") {
    throw new Error("Watchlist valuation.note must be a string, null, or undefined");
  }
  return v;
}

// src/watchlist.js
function saveWatchlist() {
  try {
    localStorage.setItem("hm-watchlist", JSON.stringify(state.watchlist));
  } catch (e) {
    console.warn("[watchlist] localStorage \u4FDD\u5B58\u5931\u6557\uFF08\u5BB9\u91CF\u8D85\u904E\u306E\u53EF\u80FD\u6027\uFF09:", e);
  }
  clearTimeout(_wlKvSyncTimer);
  _wlKvSyncTimer = setTimeout(_syncWatchlistToWorker, 1e3);
}
var _wlKvSyncTimer = null;
async function _syncWatchlistToWorker() {
  try {
    const res = await fetch(`${WORKER_URL}/watchlist`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.watchlist)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch {
    setStatus("\u30A6\u30A9\u30C3\u30C1\u30EA\u30B9\u30C8\u306E\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F\uFF08\u30ED\u30FC\u30AB\u30EB\u306B\u306F\u4FDD\u5B58\u6E08\u307F\uFF09", "yellow");
  }
}
async function _loadWatchlistFromWorker() {
  try {
    const res = await fetch(`${WORKER_URL}/watchlist`);
    if (!res.ok) return;
    const remote = await res.json();
    if (Array.isArray(remote) && remote.length > 0) {
      state.watchlist = remote;
      try {
        localStorage.setItem("hm-watchlist", JSON.stringify(remote));
      } catch (e) {
        console.warn("[watchlist] localStorage \u4FDD\u5B58\u5931\u6557\uFF08\u5BB9\u91CF\u8D85\u904E\u306E\u53EF\u80FD\u6027\uFF09:", e);
      }
    } else if (state.watchlist.length > 0) {
      _syncWatchlistToWorker();
    } else {
      await _restoreWatchlistFromSnapshot();
    }
  } catch {
  }
}
async function _restoreWatchlistFromSnapshot() {
  try {
    const res = await fetch("data/portfolio-snapshot.json", { cache: "no-store" });
    if (!res.ok) return false;
    const snapshot = await res.json();
    if (!Array.isArray(snapshot.watchlist) || snapshot.watchlist.length === 0) return false;
    const restored = [];
    const seen = /* @__PURE__ */ new Set();
    for (const item of snapshot.watchlist) {
      const symbol = String(item?.symbol || "").trim();
      if (!symbol || seen.has(symbol)) continue;
      const exchange = wlDetectMarket(symbol, "");
      const normalized = {
        symbol,
        name: String(item?.name || symbol),
        exchange,
        type: _snapshotWatchlistType(symbol, item?.name),
        cur: item?.cur || (exchange === "\u6771\u8A3C" ? "JPY" : exchange === "\u9999\u6E2F" ? "HKD" : "USD")
      };
      try {
        restored.push(validateWatchlistItem(normalized));
        seen.add(symbol);
      } catch (e) {
        console.warn("[watchlist] snapshot restore skipped:", symbol, e.message);
      }
    }
    if (restored.length === 0) return false;
    state.watchlist = restored;
    localStorage.setItem("hm-watchlist", JSON.stringify(restored));
    _syncWatchlistToWorker();
    setStatus(`\u30A6\u30A9\u30C3\u30C1\u30EA\u30B9\u30C8\u3092\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u304B\u3089\u5FA9\u5143\u3057\u307E\u3057\u305F\uFF08${restored.length}\u4EF6\uFF09`, "green");
    return true;
  } catch (e) {
    console.warn("[watchlist] snapshot restore failed:", e);
    return false;
  }
}
function _snapshotWatchlistType(symbol, name) {
  const text = `${symbol} ${name || ""}`.toUpperCase();
  if (text.includes("ETF") || text.includes("\u4E0A\u5834\u6295\u4FE1") || text.includes("\u4E0A\u5834\u6295\u8CC7\u4FE1\u8A17")) return "ETF";
  if (text.endsWith("=X")) return "CURRENCY";
  return "\u682A";
}
function addToWatchlist(item) {
  try {
    validateWatchlistItem(item);
  } catch (e) {
    console.warn("[watchlist] validation failed for item:", item?.symbol, e.message);
    return;
  }
  if (state.watchlist.some((w) => w.symbol === item.symbol)) return;
  state.watchlist.push(item);
  saveWatchlist();
  renderWatchlist();
  fetchWatchlistData();
}
function removeFromWatchlist(symbol) {
  state.watchlist = state.watchlist.filter((w) => w.symbol !== symbol);
  saveWatchlist();
  renderWatchlist();
}
async function fetchTickerInfo(symbol) {
  const [chartData, qsData] = await Promise.all([
    fetchViaProxy(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`, 7e3),
    fetchViaProxy(`https://query2.finance.yahoo.com/v11/finance/quoteSummary/${symbol}?modules=price`, 6e3)
  ]);
  const result = chartData?.chart?.result?.[0];
  if (!result) return null;
  const meta = result.meta || {};
  const price = meta.regularMarketPrice ?? null;
  if (price == null) return null;
  const preCalcPct = meta.regularMarketChangePercent ?? null;
  const prevClose = meta.regularMarketPreviousClose ?? meta.chartPreviousClose ?? null;
  const dayPct = preCalcPct !== null ? preCalcPct : prevClose ? (price - prevClose) / prevClose * 100 : null;
  const qsPrice = qsData?.quoteSummary?.result?.[0]?.price || {};
  const candidates = [qsPrice.longName, qsPrice.shortName, meta.longName, meta.shortName].map((s) => (s || "").trim()).filter(Boolean);
  const name = candidates.length ? candidates.reduce((a, b) => b.length > a.length ? b : a) : symbol;
  const rawType = (meta.quoteType || qsPrice.quoteType || "").toUpperCase();
  const instrType = (meta.instrumentType || "").toUpperCase();
  const isEtfByName = name.includes("ETF") || name.includes("\u4E0A\u5834\u6295\u4FE1") || name.includes("\u4E0A\u5834\u6295\u8CC7\u4FE1\u8A17");
  const type = instrType === "ETF" || rawType === "ETF" || isEtfByName ? "ETF" : rawType === "MUTUALFUND" ? "MUTUALFUND" : rawType === "CURRENCY" ? "CURRENCY" : rawType || "EQUITY";
  return { price, dayPct, name, type, exchange: meta.exchangeName || "" };
}
function wlDetectMarket(symbol, exchangeName) {
  if (symbol.endsWith(".T")) return "\u6771\u8A3C";
  if (symbol.endsWith(".HK")) return "\u9999\u6E2F";
  if (symbol.endsWith("=X")) return "\u901A\u8CA8";
  if (exchangeName) {
    if (/tokyo|tse/i.test(exchangeName)) return "\u6771\u8A3C";
    if (/hong kong|hkex/i.test(exchangeName)) return "\u9999\u6E2F";
  }
  return "US";
}
function wlTypeBadge(quoteType) {
  const t = (quoteType || "").toUpperCase();
  if (t === "ETF") return "ETF";
  if (t === "MUTUALFUND") return "\u6295\u4FE1";
  if (t === "CURRENCY") return "\u901A\u8CA8";
  return "\u682A";
}
var _wlSearchTimer = null;
var _wlSearchSeq = 0;
function onWatchlistSearch(eventOrQuery) {
  const q = typeof eventOrQuery === "string" ? eventOrQuery : eventOrQuery?.target?.value ?? "";
  clearTimeout(_wlSearchTimer);
  const dropdown = document.getElementById("wl-search-dropdown");
  if (!q.trim()) {
    dropdown.hidden = true;
    return;
  }
  dropdown.innerHTML = '<div class="wl-search-msg">\u78BA\u8A8D\u4E2D\u2026</div>';
  dropdown.hidden = false;
  _wlSearchTimer = setTimeout(() => searchTicker(q), 500);
}
async function searchTicker(q) {
  const dropdown = document.getElementById("wl-search-dropdown");
  const input = q.trim().toUpperCase();
  const seq = ++_wlSearchSeq;
  const candidates = /* @__PURE__ */ new Set([input]);
  if (/^\d{4,5}$/.test(input)) {
    candidates.add(`${input}.T`);
    candidates.add(`${input}.HK`);
    candidates.add(`${parseInt(input, 10)}.HK`);
  }
  if (input.endsWith(".HK")) {
    const base = input.slice(0, -3);
    const noZero = String(parseInt(base, 10));
    const withZero = noZero.padStart(4, "0");
    candidates.add(`${noZero}.HK`);
    candidates.add(`${withZero}.HK`);
  }
  const results = await Promise.all(
    [...candidates].map(async (sym) => {
      const info = await fetchTickerInfo(sym);
      return info ? { symbol: sym, ...info } : null;
    })
  );
  if (seq !== _wlSearchSeq) return;
  const seen = /* @__PURE__ */ new Set();
  const found = results.filter((r) => r && !seen.has(r.symbol) && seen.add(r.symbol));
  if (found.length === 0) {
    dropdown.innerHTML = `<div class="wl-search-msg">
      \u300C${escapeHTML(input)}\u300D\u306F\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F
      <br><small style="opacity:0.65;font-size:11px">\u7C73\u56FD: VWO / AAPL &nbsp;|&nbsp; \u65E5\u672C: 7203.T &nbsp;|&nbsp; \u9999\u6E2F: 0700.HK</small>
    </div>`;
    return;
  }
  dropdown.innerHTML = found.map((item) => {
    const market = wlDetectMarket(item.symbol, item.exchange);
    const badge = wlTypeBadge(item.type);
    const already = state.watchlist.some((w) => w.symbol === item.symbol);
    const cur = market === "\u6771\u8A3C" ? "JPY" : market === "\u9999\u6E2F" ? "HKD" : "USD";
    const priceStr = fmtPrice(item.price, cur);
    const pctStr = item.dayPct != null ? `${item.dayPct >= 0 ? "+" : ""}${item.dayPct.toFixed(2)}%` : "";
    const sym = escapeHTML(item.symbol);
    const name = escapeHTML(item.name || item.symbol);
    const mkt = escapeHTML(market);
    const bdg = escapeHTML(badge);
    return `<div class="wl-search-item${already ? " wl-already" : ""}"
         data-symbol="${sym}"
         data-name="${name}"
         data-market="${mkt}"
         data-badge="${bdg}"
         data-action="wlSelectItem">
      <span class="wl-sym">${sym}</span>
      <span class="wl-type-badge">${bdg}</span>
      <span class="wl-market-label">${mkt}</span>
      <span class="wl-item-name">${name}</span>
      <span class="wl-item-price">${priceStr}${pctStr ? ` <span class="wl-item-pct ${item.dayPct >= 0 ? "pos" : "neg"}">${pctStr}</span>` : ""}</span>
      ${already ? '<span class="wl-status-tag wl-registered">\u767B\u9332\u6E08</span>' : '<span class="wl-status-tag wl-add-tag">\uFF0B \u8FFD\u52A0</span>'}
    </div>`;
  }).join("");
}
function wlSelectItem(arg, event) {
  const el = event instanceof Event ? event.target.closest(".wl-search-item") : arg;
  if (!el || el.classList.contains("wl-already")) return;
  const symbol = el.dataset.symbol;
  const name = el.dataset.name;
  const exchange = el.dataset.market;
  const type = el.dataset.badge;
  let cur = "USD";
  if (exchange === "\u6771\u8A3C") cur = "JPY";
  else if (exchange === "\u9999\u6E2F") cur = "HKD";
  addToWatchlist({ symbol, name, exchange, type, cur });
  el.classList.add("wl-already");
  const tag = el.querySelector(".wl-status-tag");
  if (tag) {
    tag.className = "wl-status-tag wl-registered";
    tag.textContent = "\u767B\u9332\u6E08";
  }
  const input = document.getElementById("wl-search-input");
  if (input) input.value = "";
  const dropdown = document.getElementById("wl-search-dropdown");
  if (dropdown) dropdown.hidden = true;
}
document.addEventListener("click", (e) => {
  if (!e.target.closest("#wl-search-wrap")) {
    const dd = document.getElementById("wl-search-dropdown");
    if (dd) dd.hidden = true;
  }
});
async function fetchWatchlistData() {
  const symbols = state.watchlist.map((w) => w.symbol);
  if (symbols.length === 0) return;
  await Promise.all(
    symbols.map(async (sym) => {
      const live = await fetchLivePrice(sym);
      if (live) state.watchlistPrices[sym] = live;
    })
  );
  for (const range of ["1y", "5y", "10y"]) {
    await fetchAllHistorical(range);
    renderWatchlist();
  }
}
function wlSort(col) {
  _tableSort("wlSortCol", "wlSortDir", col, ["symbol"]);
  renderWatchlist();
}
function wlGetPct(item, periodId) {
  if (periodId === "1d") return state.watchlistPrices[item.symbol]?.dayPct ?? null;
  return getHistoricalChangePct(item.symbol, periodId);
}
function renderWatchlist() {
  const panel = document.getElementById("panel-watchlist");
  if (panel?.hidden) return;
  const wrap = document.getElementById("watchlist-table-wrap");
  if (!wrap) return;
  if (state.watchlist.length === 0) {
    wrap.innerHTML = '<div class="wl-empty-msg">\u4E0A\u306E\u691C\u7D22\u6B04\u304B\u3089\u9298\u67C4\u3092\u8FFD\u52A0\u3057\u3066\u304F\u3060\u3055\u3044</div>';
    return;
  }
  const sorted = [...state.watchlist].sort((a, b) => {
    const col = state.wlSortCol;
    const dir = state.wlSortDir === "desc" ? -1 : 1;
    let va, vb;
    if (col === "symbol") {
      va = a.symbol;
      vb = b.symbol;
      return dir * va.localeCompare(vb);
    }
    if (col === "market") {
      va = a.exchange ?? "";
      vb = b.exchange ?? "";
      return dir * va.localeCompare(vb);
    }
    if (col === "price") {
      va = state.watchlistPrices[a.symbol]?.price ?? -Infinity;
      vb = state.watchlistPrices[b.symbol]?.price ?? -Infinity;
    } else {
      va = wlGetPct(a, col) ?? -Infinity;
      vb = wlGetPct(b, col) ?? -Infinity;
    }
    return dir * (va > vb ? 1 : va < vb ? -1 : 0);
  });
  const th = (label, col, align) => makeTh(label, col, align, state.wlSortCol, state.wlSortDir, "wlSort");
  const rows = sorted.map((item) => {
    const live = state.watchlistPrices[item.symbol];
    const price = live?.price;
    const priceStr = price != null ? fmtPrice(price, item.cur) : "\u2013";
    const periodCells = makePeriodCells((periodId) => wlGetPct(item, periodId));
    const symEsc = escapeHTML(item.symbol);
    const nameEsc = escapeHTML(item.name || "");
    const exEsc = escapeHTML(item.exchange || "");
    return `<tr>
      <td data-col="symbol" class="sl-sym">${symEsc}<span class="sl-inline-name">${nameEsc}</span></td>
      <td class="wl-market-cell"><span class="wl-type-badge">${exEsc}</span></td>
      <td class="wl-price-cell">${priceStr}</td>
      ${periodCells}
      <td class="wl-del-cell">
        <button class="wl-del-btn" data-action="removeFromWatchlist" data-arg="${escapeHTML(item.symbol)}" title="\u30A6\u30A9\u30C3\u30C1\u30EA\u30B9\u30C8\u304B\u3089\u524A\u9664">\xD7</button>
      </td>
    </tr>`;
  }).join("");
  wrap.innerHTML = `<table class="sl-table wl-table">
    <thead><tr>
      ${th('\u30C6\u30A3\u30C3\u30AB\u30FC<br><span class="sl-th-sub">\u9298\u67C4\u540D</span>', "symbol")}
      ${th("\u5E02\u5834", "market", "center")}
      ${th("\u73FE\u5728\u5024", "price")}
      ${makePeriodHeaderCells(state.wlSortCol, state.wlSortDir, "wlSort")}
      <th></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// src/networth.js
var MF_URL = "data/mf-holdings.json";
var EMERGENCY_FUND = 2e7;
var _mf = null;
async function loadMfHoldings() {
  try {
    const r = await fetch(`${MF_URL}?_=${Date.now()}`);
    if (!r.ok) throw new Error(`mf ${r.status}`);
    _mf = await r.json();
  } catch {
    _mf = null;
  }
  return _mf;
}
function _sum(pred) {
  if (!_mf || !_mf.holdings) return 0;
  return _mf.holdings.reduce((a, x) => a + (pred(x) ? Number(x.value) || 0 : 0), 0);
}
function getMfTotals() {
  if (!_mf || !_mf.holdings) return null;
  const imported = _mf.totals && _mf.totals.imported || _sum(() => true);
  const netWorth = _mf.totals && _mf.totals.mfNetWorth || imported;
  const cash = _sum((x) => x.cat === "\u73FE\u91D1\u30FB\u9810\u91D1");
  const crypto2 = _sum((x) => x.cat === "\u6697\u53F7\u8CC7\u7523");
  const securities = imported - cash - crypto2;
  const dryPowder = Math.max(0, cash - EMERGENCY_FUND);
  const cashRatio = imported > 0 ? dryPowder / imported * 100 : 0;
  return { netWorth, imported, cash, crypto: crypto2, securities, dryPowder, cashRatio, emergencyFund: EMERGENCY_FUND, asOf: _mf.asOf };
}
function getMfManualAssets() {
  if (!_mf || !_mf.holdings) return null;
  const jpyCash = _sum((x) => x.cat === "\u73FE\u91D1\u30FB\u9810\u91D1" && x.cur !== "USD");
  const usdCash = _sum((x) => x.cat === "\u73FE\u91D1\u30FB\u9810\u91D1" && x.cur === "USD");
  const crypto2 = _sum((x) => x.cat === "\u6697\u53F7\u8CC7\u7523");
  const out = [];
  if (jpyCash) out.push({ symbol: "\u73FE\u91D1(\u5186)", name: "\u73FE\u91D1\uFF08\u65E5\u672C\u5186\uFF09", value: jpyCash, cur: "JPY" });
  if (usdCash) out.push({ symbol: "\u73FE\u91D1(USD)", name: "\u73FE\u91D1\uFF08\u7C73\u30C9\u30EB\u30FB\u5186\u63DB\u7B97\uFF09", value: usdCash, cur: "USD" });
  if (crypto2) out.push({ symbol: "\u6697\u53F7\u8CC7\u7523", name: "\u6697\u53F7\u8CC7\u7523\uFF08BTC/ETH\u7B49\uFF09", value: crypto2, cur: "JPY" });
  return out.length ? out : null;
}
function getMfSources() {
  if (!_mf) return null;
  return [`\u73FE\u91D1\u30FB\u6697\u53F7\u8CC7\u7523 = Money Forward \u5B9F\u5024\uFF08${_mf.asOf || ""}\u30FBmf-holdings.json\uFF09`];
}

// src/render.js
function renderStats() {
  const mf = getMfTotals();
  const liveTotal = positions.reduce((s, p) => s + (p.value || 0), 0);
  const masked = state.statsMasked;
  const amt = (v) => masked ? maskAmount(fmtYen(v)) : fmtYen(v);
  const mfTag = '<span class="stat-src">MF\u5B9F\u5024</span>';
  let html = "";
  if (mf) {
    html += `<div class="stat-hero">
      <span class="stat-hero-label">\u904B\u7528\u8CC7\u7523\u7DCF\u984D${mfTag}</span>
      <span class="stat-hero-value stat-fg">${amt(mf.imported)}</span>
    </div>
    <div class="stat-subrow">
      <div class="stat-sub-item">
        <span class="stat-sub-label">\u8CC7\u7523\u7DCF\u984D</span>
        <span class="stat-sub-value stat-fg">${amt(mf.netWorth)}</span>
      </div>
      <div class="stat-sub-item">
        <span class="stat-sub-label">\u6295\u8CC7\u7528\u30AD\u30E3\u30C3\u30B7\u30E5</span>
        <span class="stat-sub-value stat-fg">${amt(mf.dryPowder)}<span class="stat-sub-pct">${mf.cashRatio.toFixed(1)}%</span></span>
      </div>
    </div>`;
  } else {
    html += `<div class="stat-hero">
      <span class="stat-hero-label">\u904B\u7528\u8CC7\u7523\u7DCF\u984D</span>
      <span class="stat-hero-value stat-fg">${amt(liveTotal)}</span>
    </div>`;
  }
  document.getElementById("stats").innerHTML = html;
}
async function refreshHistoricalAndRender() {
  const results = await Promise.allSettled(["5y", "10y"].map(async (range) => {
    await fetchAllHistorical(range);
    renderStats();
    renderStockList();
    if (state.activeTab === "watchlist") {
      renderWatchlist();
      updateWatchlistHeight();
    }
    if (state.changePeriod && state.changePeriod !== "1d") renderHeatmap();
    return range;
  }));
  const failed = results.filter((r) => r.status === "rejected");
  failed.forEach((r) => console.warn("[historical] fetch failed:", r.reason));
  if (failed.length > 0) {
    setStatus(`\u5C65\u6B74\u30C7\u30FC\u30BF\u53D6\u5F97\u5931\u6557\uFF08${failed.length}/${results.length}\uFF09`, "red");
  }
}
function hideHeatmapSkeleton() {
  const sk = document.getElementById("heatmap-skeleton");
  const sv = document.getElementById("heatmap");
  if (sk) {
    sk.style.transition = "opacity 0.3s ease";
    sk.style.opacity = "0";
    setTimeout(() => sk.remove(), 320);
  }
  if (sv) sv.style.display = "";
}
function updateListHeight() {
  const wrap = document.getElementById("stock-list-wrap");
  if (!wrap) return;
  const sticky = document.querySelector(".sticky-top");
  const stickyH = sticky instanceof HTMLElement ? sticky.offsetHeight : 0;
  const padBot = parseFloat(getComputedStyle(document.body).paddingBottom) || 16;
  const h = Math.max(160, window.innerHeight - stickyH - padBot - 4);
  wrap.style.maxHeight = `${h}px`;
}
function updateWatchlistHeight() {
  const wrap = document.getElementById("watchlist-table-wrap");
  if (!wrap) return;
  const sticky = document.querySelector(".sticky-top");
  const stickyH = sticky instanceof HTMLElement ? sticky.offsetHeight : 0;
  const padBot = parseFloat(getComputedStyle(document.body).paddingBottom) || 16;
  const h = Math.max(160, window.innerHeight - stickyH - padBot - 4);
  wrap.style.maxHeight = `${h}px`;
}
function updateHeatmapHeight() {
  const panel = document.getElementById("panel-heatmap");
  if (!panel || panel.hidden) return;
  const sticky = document.querySelector(".sticky-top");
  const stickyH = sticky instanceof HTMLElement ? sticky.offsetHeight : 0;
  const padBot = parseFloat(getComputedStyle(document.body).paddingBottom) || 16;
  const h = Math.max(200, window.innerHeight - stickyH - padBot - 4);
  panel.style.maxHeight = `${h}px`;
}
function updateActiveTableHeight() {
  if (state.activeTab === "watchlist") {
    updateWatchlistHeight();
    return;
  }
  if (state.activeTab === "heatmap") {
    updateHeatmapHeight();
    return;
  }
  updateListHeight();
}
function setupPriceUpdateListener() {
  document.addEventListener("hm:prices-updated", () => {
    renderStats();
    renderHeatmap();
  });
}

// data/constituents-overrides.json
var constituents_overrides_default = {
  "1306": {
    assetClass: {
      equity: 1
    },
    currency: {
      JPY: 1
    },
    country: {
      japan: 1
    },
    sector: {
      tech: 0.14,
      financials: 0.12,
      industrials: 0.12,
      consumer: 0.1,
      comm: 0.08,
      staples: 0.07,
      materials: 0.07,
      healthcare: 0.06,
      utilities: 0.04,
      realestate: 0.03,
      energy: 0.01
    }
  },
  "1615": {
    assetClass: {
      equity: 1
    },
    currency: {
      JPY: 1
    },
    country: {
      japan: 1
    },
    sector: {
      financials: 1
    }
  },
  "1629": {
    assetClass: {
      equity: 1
    },
    currency: {
      JPY: 1
    },
    country: {
      japan: 1
    },
    sector: {
      industrials: 1
    }
  },
  "6301": {
    assetClass: {
      equity: 1
    },
    currency: {
      JPY: 1
    },
    country: {
      japan: 1
    },
    sector: {
      industrials: 1
    }
  },
  "8050": {
    assetClass: {
      equity: 1
    },
    currency: {
      JPY: 1
    },
    country: {
      japan: 1
    },
    sector: {
      consumer: 1
    }
  },
  "9983": {
    assetClass: {
      equity: 1
    },
    currency: {
      JPY: 1
    },
    country: {
      japan: 1
    },
    sector: {
      consumer: 1
    }
  },
  "200A": {
    assetClass: {
      equity: 1
    },
    currency: {
      JPY: 1
    },
    country: {
      japan: 1
    },
    sector: {
      semis: 1
    }
  },
  AAPL: {
    assetClass: {
      equity: 1
    },
    currency: {
      USD: 1
    },
    country: {
      us: 1
    },
    sector: {
      tech: 1
    }
  },
  AMZN: {
    assetClass: {
      equity: 1
    },
    currency: {
      USD: 1
    },
    country: {
      us: 1
    },
    sector: {
      tech: 0.3,
      consumer: 0.7
    }
  },
  COPX: {
    assetClass: {
      equity: 1
    },
    currency: {
      USD: 0.55,
      other: 0.45
    },
    country: {
      us: 0.25,
      em: 0.35,
      europe: 0.2,
      china: 0.2
    },
    sector: {
      materials: 1
    }
  },
  GLDM: {
    assetClass: {
      commodity: 1
    },
    currency: {
      USD: 1
    },
    country: {
      commodity: 1
    },
    sector: {
      commodity: 1
    }
  },
  GOOGL: {
    assetClass: {
      equity: 1
    },
    currency: {
      USD: 1
    },
    country: {
      us: 1
    },
    sector: {
      comm: 0.8,
      tech: 0.2
    }
  },
  ILF: {
    assetClass: {
      equity: 1
    },
    currency: {
      other: 1
    },
    country: {
      latam: 1
    },
    sector: {
      financials: 0.33,
      materials: 0.25,
      energy: 0.15,
      staples: 0.15,
      utilities: 0.07,
      comm: 0.05
    }
  },
  JPST: {
    assetClass: {
      bond: 1
    },
    currency: {
      USD: 1
    },
    country: {
      us: 1
    },
    sector: {
      bond: 1
    }
  },
  MSFT: {
    assetClass: {
      equity: 1
    },
    currency: {
      USD: 1
    },
    country: {
      us: 1
    },
    sector: {
      tech: 1
    }
  },
  PLTR: {
    assetClass: {
      equity: 1
    },
    currency: {
      USD: 1
    },
    country: {
      us: 1
    },
    sector: {
      tech: 1
    }
  },
  REMX: {
    assetClass: {
      equity: 1
    },
    currency: {
      USD: 0.5,
      other: 0.5
    },
    country: {
      china: 0.45,
      em: 0.3,
      us: 0.15,
      europe: 0.1
    },
    sector: {
      materials: 1
    }
  },
  SHLD: {
    assetClass: {
      equity: 1
    },
    currency: {
      USD: 0.7,
      EUR: 0.3
    },
    country: {
      us: 0.6,
      europe: 0.4
    },
    sector: {
      industrials: 1
    }
  },
  SLV: {
    assetClass: {
      commodity: 1
    },
    currency: {
      USD: 1
    },
    country: {
      commodity: 1
    },
    sector: {
      commodity: 1
    }
  },
  SMH: {
    assetClass: {
      equity: 1
    },
    currency: {
      USD: 0.8,
      other: 0.2
    },
    country: {
      us: 0.7,
      em: 0.2,
      europe: 0.1
    },
    sector: {
      semis: 1
    }
  },
  TSLA: {
    assetClass: {
      equity: 1
    },
    currency: {
      USD: 1
    },
    country: {
      us: 1
    },
    sector: {
      consumer: 1
    }
  },
  XLE: {
    assetClass: {
      equity: 1
    },
    currency: {
      USD: 1
    },
    country: {
      us: 1
    },
    sector: {
      energy: 1
    }
  },
  URA: {
    assetClass: {
      equity: 0.92,
      commodity: 0.08
    },
    currency: {
      USD: 0.5,
      other: 0.5
    },
    country: {
      us: 0.3,
      em: 0.1,
      global: 0.52,
      commodity: 0.08
    },
    sector: {
      energy: 0.8,
      industrials: 0.07,
      materials: 0.05,
      commodity: 0.08
    }
  },
  \u30AA\u30EB\u30AB\u30F3: {
    assetClass: {
      equity: 1
    },
    currency: {
      USD: 0.62,
      EUR: 0.1,
      JPY: 0.05,
      other: 0.23
    },
    country: {
      us: 0.63,
      europe: 0.16,
      em: 0.13,
      japan: 0.055,
      china: 0.025
    },
    sector: {
      tech: 0.26,
      financials: 0.16,
      consumer: 0.11,
      healthcare: 0.1,
      industrials: 0.1,
      comm: 0.075,
      staples: 0.06,
      energy: 0.04,
      materials: 0.04,
      utilities: 0.025,
      realestate: 0.02
    }
  },
  \u3072\u3075\u307F: {
    assetClass: {
      equity: 0.987,
      cash: 0.013
    },
    currency: {
      JPY: 1
    },
    country: {
      japan: 1
    },
    sector: {
      industrials: 0.345,
      tech: 0.186,
      financials: 0.155,
      consumer: 0.092,
      comm: 0.076,
      materials: 0.057,
      realestate: 0.039,
      healthcare: 0.015,
      staples: 0.012,
      utilities: 8e-3,
      cash: 0.013
    }
  },
  \u30DE\u30A4\u30AF\u30EDSP: {
    assetClass: {
      equity: 0.846,
      cash: 0.154
    },
    currency: {
      JPY: 1
    },
    country: {
      japan: 1
    },
    sector: {
      industrials: 0.212,
      tech: 0.192,
      comm: 0.081,
      consumer: 0.071,
      realestate: 0.064,
      financials: 0.062,
      materials: 0.037,
      cash: 0.154
    }
  },
  \u3072\u3075\u307FXO: {
    assetClass: {
      equity: 0.974,
      cash: 0.026
    },
    currency: {
      JPY: 1
    },
    country: {
      japan: 1
    },
    sector: {
      industrials: 0.244,
      tech: 0.186,
      consumer: 0.135,
      comm: 0.1,
      financials: 0.089,
      cash: 0.026
    }
  },
  "PIMCO-ST": {
    assetClass: {
      bond: 1
    },
    currency: {
      USD: 1
    },
    country: {
      us: 0.7,
      europe: 0.2,
      em: 0.1
    },
    sector: {
      bond: 1
    }
  },
  "\u73FE\u91D1(\u5186)": {
    assetClass: {
      cash: 1
    },
    currency: {
      JPY: 1
    },
    country: {
      japan: 1
    },
    sector: {
      cash: 1
    }
  },
  "\u73FE\u91D1(USD)": {
    assetClass: {
      cash: 1
    },
    currency: {
      USD: 1
    },
    country: {
      us: 1
    },
    sector: {
      cash: 1
    }
  },
  \u6697\u53F7\u8CC7\u7523: {
    assetClass: {
      crypto: 1
    },
    currency: {
      other: 1
    },
    country: {
      global: 1
    },
    sector: {
      crypto: 1
    }
  }
};

// src/constituents.js
var CONSTITUENTS = { ...constituents_overrides_default };
CONSTITUENTS["\u3072\u3075\u307F\u6295\u4FE1"] = CONSTITUENTS["\u3072\u3075\u307F"];
CONSTITUENTS["\u3072\u3075\u307FMS"] = CONSTITUENTS["\u30DE\u30A4\u30AF\u30EDSP"];

// src/risk-calc.js
var RISK_DIMENSIONS = ["assetClass", "currency", "country", "sector"];
var UNKNOWN_KEY = "__unknown__";
function deriveDefault(p) {
  const cur = p.cur === "USD" ? "USD" : "JPY";
  let country = null;
  if (p.cat === "\u65E5\u672C\u682A\u30FBETF") country = "japan";
  else if (p.cat === "\u7C73\u56FD\u682A\u30FBETF") country = "us";
  return {
    assetClass: { equity: 1 },
    currency: { [cur]: 1 },
    country: country ? { [country]: 1 } : {},
    sector: {}
    // 不明 → 残差として その他 に入る
  };
}
function holdingsToBreakdown(holdings) {
  const dims = {};
  for (const dim of RISK_DIMENSIONS) dims[dim] = {};
  if (!Array.isArray(holdings)) return dims;
  for (const h of holdings) {
    const w = h?.weight;
    if (!(typeof w === "number") || !(w > 0)) continue;
    for (const dim of RISK_DIMENSIONS) {
      const cat = h[dim];
      if (cat == null || cat === "") continue;
      dims[dim][cat] = (dims[dim][cat] || 0) + w;
    }
  }
  return dims;
}
function computeRiskBreakdown(posList = positions) {
  const result = {};
  for (const dim of RISK_DIMENSIONS) {
    result[dim] = { cats: {}, contributors: {}, total: 0, known: 0, coverage: 0 };
  }
  for (const p of posList) {
    const value = p.value || 0;
    if (value <= 0) continue;
    const live = p.symbol ? state.liveConstituents[p.symbol] : null;
    const entry = live && Array.isArray(live.holdings) && live.holdings.length ? holdingsToBreakdown(live.holdings) : p.symbol && CONSTITUENTS[p.symbol] || deriveDefault(p);
    const name = p.name || p.symbol || "";
    for (const dim of RISK_DIMENSIONS) {
      const liveSector = dim === "sector" && p.symbol ? state.liveTopHoldings[p.symbol]?.sector : void 0;
      const map = liveSector !== void 0 ? liveSector : entry[dim] || {};
      const bucket = result[dim];
      let known = 0;
      for (const [cat, w] of Object.entries(map)) {
        if (!w) continue;
        const v = value * w;
        bucket.cats[cat] = (bucket.cats[cat] || 0) + v;
        (bucket.contributors[cat] || (bucket.contributors[cat] = [])).push({ symbol: p.symbol || "", name, value: v });
        known += v;
      }
      if (known > value) known = value;
      const unknown = value - known;
      if (unknown > 1e-6) {
        bucket.cats[UNKNOWN_KEY] = (bucket.cats[UNKNOWN_KEY] || 0) + unknown;
        (bucket.contributors[UNKNOWN_KEY] || (bucket.contributors[UNKNOWN_KEY] = [])).push({
          symbol: p.symbol || "",
          name,
          value: unknown
        });
      }
      bucket.total += value;
      bucket.known += known;
    }
  }
  for (const dim of RISK_DIMENSIONS) {
    const b = result[dim];
    b.coverage = b.total > 0 ? b.known / b.total : 0;
  }
  return result;
}
function toSlices(dimResult) {
  const total = dimResult.total || 0;
  const entries = Object.entries(dimResult.cats).map(([key, value]) => ({
    key,
    value,
    pct: total > 0 ? value / total * 100 : 0
  }));
  entries.sort((a, b) => {
    if (a.key === UNKNOWN_KEY) return 1;
    if (b.key === UNKNOWN_KEY) return -1;
    return b.value - a.value;
  });
  return entries;
}
function getContributors(dimResult, categoryKey) {
  const list = dimResult.contributors && dimResult.contributors[categoryKey] || [];
  const sum = list.reduce((s, c) => s + c.value, 0);
  return list.map((c) => ({ ...c, pct: sum > 0 ? c.value / sum * 100 : 0 })).sort((a, b) => b.value - a.value);
}
function getClassificationSummary(posList = positions) {
  let total = 0;
  let classified = 0;
  const allSymbols = [];
  const classifiedSymbols = [];
  const unclassifiedSymbols = [];
  for (const p of posList) {
    if ((p.value || 0) <= 0) continue;
    total++;
    const sym = p.symbol || "";
    allSymbols.push(sym);
    if (p.symbol && CONSTITUENTS[p.symbol]) {
      classified++;
      classifiedSymbols.push(sym);
    } else unclassifiedSymbols.push(sym);
  }
  return { total, classified, unclassified: total - classified, allSymbols, classifiedSymbols, unclassifiedSymbols };
}
function getSourceSummary(posList = positions) {
  const acc = {};
  for (const dim of RISK_DIMENSIONS) acc[dim] = { live: 0, curated: 0, estimated: 0, total: 0, oldestAsOf: null };
  for (const p of posList) {
    const value = p.value || 0;
    if (value <= 0) continue;
    const sym = p.symbol;
    const liveConst = sym ? state.liveConstituents[sym] : null;
    const hasLiveConst = !!(liveConst && Array.isArray(liveConst.holdings) && liveConst.holdings.length);
    const hasCurated = !!(sym && CONSTITUENTS[sym]);
    for (const dim of RISK_DIMENSIONS) {
      const b = acc[dim];
      b.total += value;
      const topHold = dim === "sector" && sym ? state.liveTopHoldings[sym] : null;
      if (topHold) {
        b.live += value;
        b.oldestAsOf = _olderAsOf(b.oldestAsOf, topHold.asOf);
      } else if (hasLiveConst) {
        b.live += value;
        b.oldestAsOf = _olderAsOf(b.oldestAsOf, liveConst.asOf);
      } else if (hasCurated) {
        b.curated += value;
      } else {
        b.estimated += value;
      }
    }
  }
  const out = {};
  for (const dim of RISK_DIMENSIONS) {
    const b = acc[dim];
    const t = b.total || 1;
    out[dim] = { live: b.live / t, curated: b.curated / t, estimated: b.estimated / t, oldestAsOf: b.oldestAsOf };
  }
  return out;
}
function _olderAsOf(a, b) {
  if (!b) return a;
  if (!a) return b;
  return Date.parse(b) < Date.parse(a) ? b : a;
}
function dailyReturns(series) {
  if (!Array.isArray(series) || series.length < 2) return [];
  const out = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const cur = series[i];
    if (!(prev?.close > 0) || !(cur?.close > 0)) continue;
    const r = cur.close / prev.close - 1;
    if (!Number.isFinite(r)) continue;
    out.push({ date: cur.date, r });
  }
  return out;
}
function stdev(arr) {
  if (!Array.isArray(arr) || arr.length < 2) return 0;
  const n = arr.length;
  const mean = arr.reduce((s, x) => s + x, 0) / n;
  const variance = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}
function annualizedVol(returnsArr) {
  if (!Array.isArray(returnsArr) || returnsArr.length < 2) return null;
  return stdev(returnsArr) * Math.sqrt(252);
}
function maxDrawdown(series) {
  if (!Array.isArray(series) || series.length < 2) return 0;
  let peak = -Infinity;
  let maxDD = 0;
  for (const pt of series) {
    const v = pt?.close;
    if (!(v > 0)) continue;
    if (v > peak) peak = v;
    const dd = v / peak - 1;
    if (dd < maxDD) maxDD = dd;
  }
  return maxDD;
}
function pearson(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length < 2) return null;
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  if (va === 0 || vb === 0) return null;
  return cov / Math.sqrt(va * vb);
}
function covar(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length < 2) return null;
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let c = 0;
  for (let i = 0; i < n; i++) c += (a[i] - ma) * (b[i] - mb);
  return c / (n - 1);
}
function betaTo(ri, rref) {
  const cv = covar(ri, rref);
  if (cv === null) return null;
  const cv2 = covar(rref, rref);
  if (cv2 === null || cv2 === 0) return null;
  return cv / cv2;
}
function worstReturn(returnsArr) {
  if (!Array.isArray(returnsArr) || returnsArr.length === 0) return null;
  return Math.min(...returnsArr);
}
function worstWindow(returnsArr, k) {
  if (!Array.isArray(returnsArr) || returnsArr.length < k || k <= 0) return null;
  let worst = Infinity;
  for (let i = 0; i <= returnsArr.length - k; i++) {
    let compound = 1;
    for (let j = i; j < i + k; j++) compound *= 1 + returnsArr[j];
    const ret = compound - 1;
    if (ret < worst) worst = ret;
  }
  return worst === Infinity ? null : worst;
}
function alignReturnsByDate(seriesMap) {
  const empty = { dates: [], bySym: {} };
  if (!seriesMap || typeof seriesMap !== "object") return empty;
  const syms = Object.keys(seriesMap);
  if (syms.length === 0) return empty;
  const bySymDate = {};
  for (const sym of syms) {
    const rets = dailyReturns(seriesMap[sym]);
    bySymDate[sym] = {};
    for (const { date, r } of rets) {
      const ds = date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10);
      bySymDate[sym][ds] = r;
    }
  }
  const allSets = syms.map((s) => new Set(Object.keys(bySymDate[s])));
  const commonDates = [...allSets[0]].filter((d) => allSets.every((set) => set.has(d)));
  commonDates.sort();
  if (commonDates.length < 2) return empty;
  const bySym = {};
  for (const sym of syms) {
    bySym[sym] = commonDates.map((d) => bySymDate[sym][d]);
  }
  return { dates: commonDates, bySym };
}
function highCorrelationPairs(alignedBySym, threshold = 0.85) {
  if (!alignedBySym || typeof alignedBySym !== "object") return [];
  const syms = Object.keys(alignedBySym);
  const pairs = [];
  for (let i = 0; i < syms.length; i++) {
    for (let j = i + 1; j < syms.length; j++) {
      const corr = pearson(alignedBySym[syms[i]], alignedBySym[syms[j]]);
      if (corr !== null && corr >= threshold) {
        pairs.push({ a: syms[i], b: syms[j], corr });
      }
    }
  }
  pairs.sort((x, y) => y.corr - x.corr);
  return pairs;
}
function computePortfolioReturns(alignedBySym, weights) {
  if (!alignedBySym || !weights) return [];
  const syms = Object.keys(alignedBySym).filter((s) => (weights[s] ?? 0) > 0);
  if (syms.length === 0) return [];
  const totalW = syms.reduce((s, sym) => s + weights[sym], 0);
  if (!(totalW > 0)) return [];
  const len = alignedBySym[syms[0]].length;
  if (len === 0) return [];
  const port = new Array(len).fill(0);
  for (const sym of syms) {
    const w = weights[sym] / totalW;
    const arr = alignedBySym[sym];
    for (let t = 0; t < len; t++) port[t] += w * arr[t];
  }
  return port;
}
function _dateStr(d) {
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}
function eventStress(seriesMap, weights, fromDate, toDate) {
  const from = Date.parse(fromDate);
  const to = Date.parse(toDate);
  const empty = { ret: null, coveragePct: 0, missing: [], usableFrom: null, usableTo: null };
  if (!weights || Number.isNaN(from) || Number.isNaN(to) || from > to) return empty;
  const windowed = {};
  let totalW = 0;
  let coveredW = 0;
  const missing = [];
  for (const [sym, w] of Object.entries(weights)) {
    if (!(w > 0)) continue;
    totalW += w;
    const series = seriesMap && seriesMap[sym];
    const inWin = Array.isArray(series) ? series.filter((p) => {
      const t = p.date instanceof Date ? p.date.getTime() : Date.parse(p.date);
      return !Number.isNaN(t) && t >= from && t <= to;
    }) : [];
    if (inWin.length >= 2) {
      windowed[sym] = inWin;
      coveredW += w;
    } else {
      missing.push(sym);
    }
  }
  const coveragePct = totalW > 0 ? coveredW / totalW * 100 : 0;
  const syms = Object.keys(windowed);
  if (syms.length === 0) return { ...empty, coveragePct, missing };
  const bySymDate = {};
  for (const sym of syms) {
    bySymDate[sym] = {};
    for (const { date, r } of dailyReturns(windowed[sym])) bySymDate[sym][_dateStr(date)] = r;
  }
  const sets = syms.map((s) => new Set(Object.keys(bySymDate[s])));
  const commonDates = [...sets[0]].filter((d) => sets.every((set) => set.has(d))).sort();
  if (commonDates.length < 1) return { ...empty, coveragePct, missing };
  const alignedBySym = {};
  for (const sym of syms) alignedBySym[sym] = commonDates.map((d) => bySymDate[sym][d]);
  const port = computePortfolioReturns(alignedBySym, weights);
  if (port.length === 0) return { ...empty, coveragePct, missing };
  let compound = 1;
  for (const r of port) compound *= 1 + r;
  return {
    ret: compound - 1,
    coveragePct,
    missing,
    usableFrom: commonDates[0],
    usableTo: commonDates[commonDates.length - 1]
  };
}

// src/liquidity-calc.js
var ADV_WINDOW = 20;
var PARTICIPATION = 0.1;
var ILLIQUID_DAYS = 5;
function adv(series, window2 = ADV_WINDOW) {
  if (!Array.isArray(series) || series.length === 0) return null;
  const vols = series.map((e) => e && typeof e.vol === "number" ? e.vol : null).filter((v) => v != null && isFinite(v) && v > 0);
  if (vols.length === 0) return null;
  const recent = vols.slice(-window2);
  const sum = recent.reduce((s, v) => s + v, 0);
  return sum / recent.length;
}
function exitDays(shares, advVal, participation = PARTICIPATION) {
  if (!(shares > 0)) return null;
  if (advVal == null || !(advVal > 0)) return null;
  const perDay = advVal * participation;
  if (!(perDay > 0)) return null;
  return shares / perDay;
}
function computeLiquidity(holdings, opts = {}) {
  const window2 = opts.window ?? ADV_WINDOW;
  const participation = opts.participation ?? PARTICIPATION;
  if (!Array.isArray(holdings)) return [];
  const out = holdings.map((h) => {
    const advVal = adv(h.series, window2);
    const days = exitDays(h.shares, advVal, participation);
    return { sym: h.sym, advVal, days };
  });
  out.sort((a, b) => {
    if (a.days == null && b.days == null) return 0;
    if (a.days == null) return 1;
    if (b.days == null) return -1;
    return b.days - a.days;
  });
  return out;
}

// src/manual-assets.js
var MANUAL_ASSETS = [
  // 現金（2026/05/31 時点・手動入力）
  { symbol: "\u73FE\u91D1(\u5186)", name: "\u73FE\u91D1\uFF08\u65E5\u672C\u5186\uFF09", value: 42e6, cur: "JPY" },
  { symbol: "\u73FE\u91D1(USD)", name: "\u73FE\u91D1\uFF08\u7C73\u30C9\u30EB\u30FB\u5186\u63DB\u7B97\uFF09", value: 78e5, cur: "USD" }
];
var MANUAL_SOURCES = [
  "\u73FE\u91D1 = \u624B\u52D5\u5165\u529B\uFF082026/05/31\uFF09",
  "\u3072\u3075\u307F\u6295\u4FE1\u30FB\u3072\u3075\u307F\u30DE\u30A4\u30AF\u30ED\u30B9\u30B3\u30FC\u30D7pro\u30FB\u3072\u3075\u307F\u30AF\u30ED\u30B9\u30AA\u30FC\u30D0\u30FCpro \u5206\u985E = \u30EC\u30AA\u30B9\u30FB\u30AD\u30E3\u30D4\u30BF\u30EB\u30EF\u30FC\u30AF\u30B9 \u6708\u6B21\u30EC\u30DD\u30FC\u30C8\uFF082026\u5E744\u6708\u57FA\u6E96\uFF09"
];

// src/target-allocation.js
var TARGET_ALLOC_URL = "data/target-allocation.json";
var _cfg = null;
async function loadTargetAllocation() {
  try {
    const r = await fetch(`${TARGET_ALLOC_URL}?_=${Date.now()}`);
    if (!r.ok) throw new Error(`target-allocation ${r.status}`);
    _cfg = await r.json();
  } catch {
    _cfg = null;
  }
  return _cfg;
}
function getThemeOf(symbol) {
  if (!_cfg || !_cfg.themeCaps) return null;
  for (const [theme, def] of Object.entries(_cfg.themeCaps)) {
    if (Array.isArray(def.members) && def.members.includes(symbol)) return theme;
  }
  return null;
}
function getTargetPct(symbol) {
  if (!_cfg) return null;
  if (_cfg.override && _cfg.override[symbol] != null) {
    const ov = _cfg.override[symbol];
    if (ov.targetPct != null) return ov.targetPct;
  }
  const tiers = _cfg.tiers || {};
  for (const tier of Object.values(tiers)) {
    if (tier.targets && tier.targets[symbol] != null) return tier.targets[symbol];
  }
  if (_cfg.themeEtfs && _cfg.themeEtfs.includes(symbol)) {
    const etfTheme = getThemeOf(symbol);
    if (etfTheme !== null) {
      const cap = getThemeCap(etfTheme);
      const n = _cfg.themeEtfs.filter((s) => getThemeOf(s) === etfTheme).length || 1;
      return cap != null ? Math.round(cap / n * 100) / 100 : null;
    }
  }
  const theme = getThemeOf(symbol);
  if (theme !== null) {
    const conviction = _cfg.conviction && _cfg.conviction[symbol] || "standard";
    const pct = _cfg.convictionPct && _cfg.convictionPct[conviction];
    return pct != null ? pct : null;
  }
  return null;
}
function getConviction(symbol) {
  if (!_cfg) return null;
  if (_cfg.override && _cfg.override[symbol] && _cfg.override[symbol].targetPct != null) return null;
  const tiers = _cfg.tiers || {};
  for (const tier of Object.values(tiers)) {
    if (tier.targets && tier.targets[symbol] != null) return null;
  }
  if (_cfg.themeEtfs && _cfg.themeEtfs.includes(symbol)) return null;
  if (getThemeOf(symbol) === null) return null;
  const conv = _cfg.conviction && _cfg.conviction[symbol] || "standard";
  return conv === "probe" || conv === "standard" || conv === "high" ? conv : "standard";
}
function getThemeCap(theme) {
  if (!_cfg || !_cfg.themeCaps || !_cfg.themeCaps[theme]) return null;
  const cap = _cfg.themeCaps[theme].cap;
  return cap != null ? cap : null;
}
function computeThemeUsage(theme, currentPctBySymbol) {
  const cap = getThemeCap(theme);
  let members = (
    /** @type {string[]} */
    []
  );
  if (_cfg && _cfg.themeCaps && _cfg.themeCaps[theme]) {
    members = _cfg.themeCaps[theme].members || [];
  }
  const used = members.reduce((sum, sym) => sum + (currentPctBySymbol[sym] || 0), 0);
  const headroom = cap != null ? cap - used : null;
  return { theme, cap, used, headroom };
}
function computeGap(symbol, currentPct) {
  const targetPct = getTargetPct(symbol);
  const gapPct = targetPct != null ? currentPct - targetPct : null;
  return { symbol, currentPct, targetPct, gapPct };
}

// src/region-calc.js
var REGION_LABELS = {
  japan: "\u65E5\u672C",
  north_america: "\u5317\u7C73",
  europe: "\u6B27\u5DDE",
  em_latam: "\u4E2D\u5357\u7C73",
  em_asia: "\u30A2\u30B8\u30A2\u65B0\u8208",
  china_hk: "\u4E2D\u56FD\u30FB\u9999\u6E2F",
  global: "\u30B0\u30ED\u30FC\u30D0\u30EB/\u305D\u306E\u4ED6",
  commodity_cash: "\u30B3\u30E2\u30C7\u30A3\u30C6\u30A3/\u73FE\u91D1",
  unknown: "\u672A\u5206\u985E"
};
var ACWI_JAPAN_PCT = 5;
function num(x) {
  return typeof x === "number" && Number.isFinite(x);
}
function computeTrueRegionExposure(holdings, regionMap, regionWeights) {
  const regions = {};
  const lookThrough = regionWeights && regionWeights.lookThrough || {};
  const weights = regionWeights && regionWeights.weights || {};
  const map = regionMap || {};
  const add = (region, amt) => {
    if (!num(amt) || amt === 0) return;
    regions[region] = (regions[region] || 0) + amt;
  };
  for (const h of holdings || []) {
    const amt = num(h && h.value) ? h.value : 0;
    if (amt === 0) continue;
    const sym = h.symbol;
    const ysym = h.ySymbol;
    const profileId = sym != null && lookThrough[sym] || ysym != null && lookThrough[ysym] || null;
    if (profileId && weights[profileId]) {
      const profile = weights[profileId];
      const sum = Object.values(profile).reduce((s, w) => s + (num(w) ? w : 0), 0);
      if (sum > 0) {
        for (const [region, w] of Object.entries(profile)) {
          if (num(w) && w > 0) add(region, amt * w / sum);
        }
        continue;
      }
    }
    const tag = sym != null && map[sym] || ysym != null && map[ysym] || "unknown";
    add(tag, amt);
  }
  const total = Object.values(regions).reduce((s, v) => s + v, 0);
  const pct = {};
  if (total > 0) {
    for (const [region, amt] of Object.entries(regions)) {
      pct[region] = amt / total * 100;
    }
  }
  return { regions, total, pct };
}
function japanHomeBias(pct) {
  const japanPct = num(pct && pct.japan) ? pct.japan : 0;
  return { japanPct, benchPct: ACWI_JAPAN_PCT, biasPt: japanPct - ACWI_JAPAN_PCT };
}

// src/risk-charts.js
var _regionData = null;
async function loadRegionData() {
  if (_regionData) return _regionData;
  try {
    const [mapRes, wRes] = await Promise.all([
      fetch(`data/region-map.json?_=${Date.now()}`),
      fetch(`data/region-weights.json?_=${Date.now()}`)
    ]);
    const mapJson = mapRes.ok ? await mapRes.json() : null;
    const wJson = wRes.ok ? await wRes.json() : null;
    _regionData = {
      regionMap: mapJson && mapJson.regions || {},
      regionWeights: wJson || { lookThrough: {}, weights: {} },
      asOf: wJson && wJson.asOf || null
    };
  } catch {
    _regionData = { regionMap: {}, regionWeights: { lookThrough: {}, weights: {} }, asOf: null };
  }
  return _regionData;
}
async function buildRegionCard(holdings) {
  const { regionMap, regionWeights, asOf } = await loadRegionData();
  const { pct } = computeTrueRegionExposure(holdings, regionMap, regionWeights);
  const bias = japanHomeBias(pct);
  const card = document.createElement("div");
  card.className = "risk-card region-card";
  const title = document.createElement("div");
  title.className = "risk-card-title";
  title.textContent = "\u5730\u57DF\u30A8\u30AF\u30B9\u30DD\u30FC\u30B8\u30E3\uFF08\u30EB\u30C3\u30AF\u30B9\u30EB\u30FC\uFF09";
  card.appendChild(title);
  const hero = document.createElement("div");
  hero.className = "region-hero";
  const biasSign = bias.biasPt >= 0 ? "+" : "";
  const biasCls = bias.biasPt >= 0 ? "region-bias-over" : "region-bias-under";
  hero.innerHTML = `
    <div class="region-hero-main"><span class="region-hero-k">\u65E5\u672C \u771F%</span><span class="region-hero-v">${bias.japanPct.toFixed(1)}%</span></div>
    <div class="region-hero-sub">ACWI\u30D9\u30F3\u30C1 ${bias.benchPct}% \uFF5C \u30DB\u30FC\u30E0\u30D0\u30A4\u30A2\u30B9 <span class="${biasCls}">${biasSign}${bias.biasPt.toFixed(1)}pt</span></div>`;
  card.appendChild(hero);
  const list = document.createElement("ul");
  list.className = "region-list";
  const rows = Object.entries(pct).sort((a, b) => b[1] - a[1]);
  for (const [region, p] of rows) {
    const li = document.createElement("li");
    li.className = "region-list-item";
    const name = document.createElement("span");
    name.className = "region-name";
    name.textContent = REGION_LABELS[region] || region;
    const val = document.createElement("span");
    val.className = "region-pct";
    val.textContent = `${p.toFixed(1)}%`;
    li.appendChild(name);
    li.appendChild(val);
    list.appendChild(li);
  }
  card.appendChild(list);
  const note = document.createElement("div");
  note.className = "risk-coverage-note";
  note.textContent = `\u76F4\u63A5\u30BF\u30B0\uFF0B\u30EB\u30C3\u30AF\u30B9\u30EB\u30FC\u6309\u5206\uFF08\u30AA\u30EB\u30AB\u30F3/\u3072\u3075\u307F/\u3072\u3075\u307FXO\uFF09\u3002\u5730\u57DF\u69CB\u6210\u6BD4\u306F\u9759\u7684\uFF08\u9BAE\u5EA6 ${asOf || "\u2014"}\u30FB\u56DB\u534A\u671F\u66F4\u65B0\uFF09\u3002VGK/2800.HK \u306F\u672A\u4FDD\u6709\uFF1D0%\u3002`;
  card.appendChild(note);
  return card;
}
var _stressEvents = null;
async function loadStressEvents() {
  if (_stressEvents) return _stressEvents;
  try {
    const r = await fetch(`data/stress-events.json?_=${Date.now()}`);
    const j = r.ok ? await r.json() : null;
    _stressEvents = j && Array.isArray(j.events) ? j.events : [];
  } catch {
    _stressEvents = [];
  }
  return _stressEvents;
}
async function ensureStressHistory(symbols) {
  let cached = {};
  try {
    cached = await getAllHistorical("5y");
  } catch {
    cached = {};
  }
  if (!state.historicalCache["5y"]) state.historicalCache["5y"] = {};
  for (const [sym, entries] of Object.entries(cached)) state.historicalCache["5y"][sym] = entries;
  const missing = symbols.filter((s) => !Array.isArray(state.historicalCache["5y"][s]) || state.historicalCache["5y"][s].length < 2);
  if (missing.length) {
    await batchWithRetry(missing, (s) => fetchSymbolHistory(s, "5y"), { batchSize: 6, delayMs: 1100 });
  }
  return state.historicalCache["5y"] || {};
}
async function buildStressCard(holdings) {
  const card = document.createElement("div");
  card.className = "risk-card stress-card";
  const title = document.createElement("div");
  title.className = "risk-card-title";
  title.textContent = "\u30B9\u30C8\u30EC\u30B9\u30B7\u30CA\u30EA\u30AA\uFF08\u73FEPF\u304C\u5F53\u6642\u3092\u518D\u4F53\u9A13\u3057\u305F\u3089\uFF09";
  card.appendChild(title);
  const events = await loadStressEvents();
  if (events.length === 0) {
    const p = document.createElement("p");
    p.className = "risk-coverage-note";
    p.textContent = "\u30A4\u30D9\u30F3\u30C8\u30AB\u30BF\u30ED\u30B0\u672A\u53D6\u5F97\u3002";
    card.appendChild(p);
    return card;
  }
  const weights = {};
  for (const p of holdings) {
    if (p.ySymbol) weights[p.ySymbol] = (weights[p.ySymbol] || 0) + (p.value || 0);
  }
  const symbols = Object.keys(weights);
  let seriesMap;
  try {
    seriesMap = await ensureStressHistory(symbols);
  } catch {
    const p = document.createElement("p");
    p.className = "risk-coverage-note";
    p.textContent = "5y\u5C65\u6B74\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F\uFF08\u6642\u9593\u3092\u304A\u3044\u3066\u518D\u8868\u793A\u3057\u3066\u304F\u3060\u3055\u3044\uFF09\u3002";
    card.appendChild(p);
    return card;
  }
  const rows = events.map((ev) => ({ ev, res: eventStress(seriesMap, weights, ev.from, ev.to) })).sort((a, b) => {
    const ra = a.res.ret == null ? Infinity : a.res.ret;
    const rb = b.res.ret == null ? Infinity : b.res.ret;
    return ra - rb;
  });
  const table = document.createElement("div");
  table.className = "stress-table";
  for (const { ev, res } of rows) {
    const row = document.createElement("div");
    row.className = "stress-row";
    const lowCov = res.coveragePct < 90;
    const retTxt = res.ret == null ? "\u2014" : `${(res.ret * 100).toFixed(1)}%`;
    const retCls = res.ret != null && res.ret < 0 ? "stress-neg" : "";
    const covCls = lowCov ? "stress-cov-low" : "";
    row.innerHTML = `
      <span class="stress-name" title="${escapeHTML(`${ev.from}\u301C${ev.to}${ev.note ? ` / ${ev.note}` : ""}`)}">${escapeHTML(ev.label)}</span>
      <span class="stress-ret ${retCls}">${escapeHTML(retTxt)}</span>
      <span class="stress-cov ${covCls}">cov ${Math.round(res.coveragePct)}%${lowCov ? " \u26A0" : ""}</span>`;
    table.appendChild(row);
  }
  card.appendChild(table);
  const note = document.createElement("div");
  note.className = "risk-coverage-note";
  note.textContent = "\u5B9F\u5C65\u6B74 replay \xD7 \u73FE\u30A6\u30A7\u30A4\u30C8\u306E what-if\uFF08\u5B9F\u640D\u76CA\u3067\u306F\u306A\u3044\uFF09\u3002\u7A93\u5185\u306B\u4FA1\u683C\u304C\u7121\u3044\u4FDD\u6709\u306F\u9664\u5916\u30FB\u518D\u6B63\u898F\u5316\u3057 coverage% \u306B\u53CD\u6620\uFF08<90% \u306F\u6CE8\u610F\uFF09\u3002\u5C65\u6B74\u306F\u4FDD\u6709\u9650\u5B9A 5y\uFF08IDB\uFF09\u3002";
  card.appendChild(note);
  return card;
}
var TITLES = {
  assetClass: "\u30A2\u30BB\u30C3\u30C8\u30AF\u30E9\u30B9",
  currency: "\u901A\u8CA8",
  country: "\u56FD\u30FB\u5730\u57DF",
  sector: "\u30BB\u30AF\u30BF\u30FC"
};
var LABELS = {
  assetClass: {
    equity: "\u682A\u5F0F",
    bond: "\u50B5\u5238",
    commodity: "\u30B3\u30E2\u30C7\u30A3\u30C6\u30A3",
    reit: "REIT",
    cash: "\u73FE\u91D1",
    crypto: "\u6697\u53F7\u8CC7\u7523"
  },
  currency: { JPY: "\u5186 JPY", USD: "\u30C9\u30EB USD", EUR: "\u30E6\u30FC\u30ED EUR", other: "\u305D\u306E\u4ED6\u901A\u8CA8" },
  country: {
    japan: "\u65E5\u672C",
    us: "\u7C73\u56FD",
    europe: "\u6B27\u5DDE",
    em: "\u65B0\u8208\u56FD",
    latam: "\u4E2D\u5357\u7C73",
    china: "\u4E2D\u56FD",
    global: "\u5206\u6563",
    commodity: "\u30B3\u30E2\u30C7\u30A3\u30C6\u30A3"
  },
  sector: {
    tech: "\u30BD\u30D5\u30C8\u30A6\u30A7\u30A2/IT",
    semis: "\u534A\u5C0E\u4F53",
    financials: "\u91D1\u878D",
    healthcare: "\u30D8\u30EB\u30B9\u30B1\u30A2",
    consumer: "\u4E00\u822C\u6D88\u8CBB\u8CA1",
    staples: "\u751F\u6D3B\u5FC5\u9700\u54C1",
    industrials: "\u8CC7\u672C\u8CA1",
    energy: "\u30A8\u30CD\u30EB\u30AE\u30FC",
    materials: "\u7D20\u6750",
    comm: "\u901A\u4FE1",
    utilities: "\u516C\u76CA",
    realestate: "\u4E0D\u52D5\u7523",
    commodity: "\u30B3\u30E2\u30C7\u30A3\u30C6\u30A3",
    bond: "\u50B5\u5238",
    cash: "\u73FE\u91D1",
    crypto: "\u6697\u53F7\u8CC7\u7523"
  }
};
var PALETTE = [
  "#cc785c",
  "#6a8caf",
  "#c2a36b",
  "#7fa885",
  "#a878a8",
  "#d09a4e",
  "#5f9ea0",
  "#bd6b6b",
  "#8a9a5b",
  "#9d8df1",
  "#d4a0b8",
  "#7ba6c9"
];
var UNKNOWN_COLOR = "#9ca3af";
function labelOf(dim, key) {
  if (key === UNKNOWN_KEY) return "\u4E0D\u660E";
  return LABELS[dim]?.[key] || key;
}
function nameOfSymbol(sym) {
  const p = positions.find((x) => x.symbol === sym);
  return p?.name || sym;
}
var STALE_WARN_DAYS = 14;
function fmtAsOf(asOf) {
  if (!asOf) return "";
  const t = Date.parse(asOf);
  if (Number.isNaN(t)) return "";
  return new Date(t).toISOString().slice(0, 10);
}
function buildSourceBadge(dimSource) {
  const badge = document.createElement("div");
  badge.className = "risk-source-badge";
  const pct = (x) => Math.round(x * 100);
  const parts = [
    ["live", "\u30E9\u30A4\u30D6", dimSource.live],
    ["curated", "\u767B\u9332", dimSource.curated],
    ["est", "\u63A8\u5B9A", dimSource.estimated]
  ];
  for (const [cls, label, frac] of parts) {
    if (frac < 5e-3) continue;
    const pill = document.createElement("span");
    pill.className = `risk-src-pill risk-src-${cls}`;
    pill.textContent = `${label} ${pct(frac)}%`;
    badge.appendChild(pill);
  }
  const asOfStr = fmtAsOf(dimSource.oldestAsOf);
  if (asOfStr) {
    const stale = Date.now() - Date.parse(dimSource.oldestAsOf) > STALE_WARN_DAYS * 864e5;
    const meta = document.createElement("span");
    meta.className = `risk-src-asof${stale ? " risk-src-stale" : ""}`;
    meta.textContent = stale ? `\u26A0 ${asOfStr} \u66F4\u65B0\uFF08\u53E4\u3044\uFF09` : `${asOfStr} \u66F4\u65B0`;
    if (stale) meta.title = `\u30E9\u30A4\u30D6\u30C7\u30FC\u30BF\u304C ${STALE_WARN_DAYS} \u65E5\u4EE5\u4E0A\u66F4\u65B0\u3055\u308C\u3066\u3044\u307E\u305B\u3093`;
    badge.appendChild(meta);
  }
  return badge;
}
function buildChartCard(dim, dimResult, dimSource) {
  const slices = toSlices(dimResult);
  const card = document.createElement("div");
  card.className = "risk-card";
  const title = document.createElement("div");
  title.className = "risk-card-title";
  title.textContent = TITLES[dim];
  card.appendChild(title);
  if (dimSource) card.appendChild(buildSourceBadge(dimSource));
  const body = document.createElement("div");
  body.className = "risk-card-body";
  card.appendChild(body);
  const size = 168;
  const radius = size / 2;
  const svg = d3.select(body).append("svg").attr("class", "risk-donut").attr("width", size).attr("height", size).attr("viewBox", `0 0 ${size} ${size}`).attr("role", "img").attr("aria-label", `${TITLES[dim]}\u306E\u69CB\u6210\u5186\u30B0\u30E9\u30D5`);
  const g = svg.append("g").attr("transform", `translate(${radius},${radius})`);
  const pie = d3.pie().value((d) => d.value).sort(null);
  const arc = d3.arc().innerRadius(radius * 0.58).outerRadius(radius - 2);
  const colorOf = (key, i) => key === UNKNOWN_KEY ? UNKNOWN_COLOR : PALETTE[i % PALETTE.length];
  g.selectAll("path").data(pie(slices)).join("path").attr("d", arc).attr("fill", (d, i) => colorOf(d.data.key, i)).append("title").text((d) => `${labelOf(dim, d.data.key)}: ${fmtJPYInt(d.data.value)}\uFF08${fmtPctInt(d.data.pct)}\uFF09`);
  const coverage = dimResult.coverage;
  const center = g.append("text").attr("class", "risk-donut-center");
  center.append("tspan").attr("x", 0).attr("dy", "-0.1em").attr("font-size", "13px").attr("font-weight", "700").attr("text-anchor", "middle").text(`${Math.round(coverage * 100)}%`);
  center.append("tspan").attr("class", "risk-donut-center-sub").attr("x", 0).attr("dy", "1.3em").attr("font-size", "9px").attr("text-anchor", "middle").text("\u5224\u660E");
  const legend = document.createElement("ul");
  legend.className = "risk-legend";
  slices.forEach((s, i) => {
    const li = document.createElement("li");
    li.className = "risk-legend-item";
    const sw = document.createElement("span");
    sw.className = "risk-legend-swatch";
    sw.style.background = colorOf(s.key, i);
    const name = document.createElement("span");
    name.className = "risk-legend-name";
    name.textContent = labelOf(dim, s.key);
    const pct = document.createElement("span");
    pct.className = "risk-legend-pct";
    pct.textContent = fmtPctInt(s.pct);
    li.append(sw, name, pct);
    li.addEventListener("mouseenter", (ev) => showLegendTip(ev, dim, s.key, dimResult));
    li.addEventListener("mousemove", moveLegendTip);
    li.addEventListener("mouseleave", hideLegendTip);
    legend.appendChild(li);
  });
  body.appendChild(legend);
  if (coverage < 0.99) {
    const note = document.createElement("div");
    note.className = "risk-coverage-note";
    note.textContent = `\u5224\u660E\u7387 ${Math.round(coverage * 100)}%\uFF08\u6B8B\u308A\u306F\u300C\u4E0D\u660E\u300D\uFF09`;
    card.appendChild(note);
  }
  return card;
}
function _resolvePositionTkeys(denom) {
  return positions.map((p) => {
    const currentPct = (p.value || 0) / denom * 100;
    let tkey = null;
    for (const candidate of [p.ySymbol, p.symbol, p.name]) {
      if (!candidate) continue;
      if (getTargetPct(candidate) != null || getThemeOf(candidate) != null) {
        tkey = candidate;
        break;
      }
    }
    return { p, tkey, currentPct };
  });
}
function buildRiskOverviewCard() {
  const card = document.createElement("div");
  card.className = "risk-overview";
  const h4 = document.createElement("h4");
  h4.textContent = "\u30EA\u30B9\u30AF\u8981\u7D04\uFF08\u81F4\u547D\u50B7\u56DE\u907F\uFF09";
  card.appendChild(h4);
  const roRow = document.createElement("div");
  roRow.className = "ro-row";
  card.appendChild(roRow);
  const totals = getMfTotals();
  const denom = totals && totals.imported || positions.reduce((s, p) => s + (p.value || 0), 0);
  const cashRatioStat = document.createElement("div");
  cashRatioStat.className = "ro-stat";
  const cashLabel = document.createElement("div");
  cashLabel.className = "ro-stat-label";
  cashLabel.textContent = "\u6295\u8CC7\u7528\u30AD\u30E3\u30C3\u30B7\u30E5\u6BD4\u7387";
  cashRatioStat.appendChild(cashLabel);
  const cashVal = document.createElement("div");
  cashVal.className = "ro-stat-value";
  if (totals) {
    const cr = totals.cashRatio;
    const outOfRange = cr < 5 || cr > 20;
    cashVal.textContent = `${cr.toFixed(1)}%`;
    cashVal.style.color = outOfRange ? "var(--up)" : "var(--text)";
    if (outOfRange) cashVal.title = cr < 5 ? "\u30AD\u30E3\u30C3\u30B7\u30E5\u4E0D\u8DB3\uFF08<5%\uFF09" : "\u30AD\u30E3\u30C3\u30B7\u30E5\u904E\u591A\uFF08>20%\uFF09";
  } else {
    cashVal.textContent = "\u2014";
  }
  cashRatioStat.appendChild(cashVal);
  roRow.appendChild(cashRatioStat);
  const taAvailable = (
    /** @type {boolean} */
    denom > 0
  );
  const oversizeStat = document.createElement("div");
  oversizeStat.className = "ro-stat";
  const oversizeLabel = document.createElement("div");
  oversizeLabel.className = "ro-stat-label";
  oversizeLabel.textContent = "\u904E\u5927\u30DD\u30B8";
  oversizeStat.appendChild(oversizeLabel);
  const oversizeVal = document.createElement("div");
  oversizeVal.className = "ro-stat-value";
  if (taAvailable) {
    const resolved = _resolvePositionTkeys(denom);
    let oversizeCount = 0;
    for (const { tkey, currentPct } of resolved) {
      if (!tkey) continue;
      const gap = computeGap(tkey, currentPct);
      if (gap.gapPct != null && gap.gapPct > 0.5) oversizeCount++;
    }
    oversizeVal.textContent = `${oversizeCount} \u4EF6`;
    if (oversizeCount > 0) oversizeVal.style.color = "var(--up)";
  } else {
    oversizeVal.textContent = "\u2014";
  }
  oversizeStat.appendChild(oversizeVal);
  roRow.appendChild(oversizeStat);
  const maxConStat = document.createElement("div");
  maxConStat.className = "ro-stat";
  const maxConLabel = document.createElement("div");
  maxConLabel.className = "ro-stat-label";
  maxConLabel.textContent = "\u6700\u5927\u96C6\u4E2D";
  maxConStat.appendChild(maxConLabel);
  const maxConVal = document.createElement("div");
  maxConVal.className = "ro-stat-value";
  if (taAvailable && denom > 0) {
    const currentPctBySymbol = {};
    for (const p of positions) {
      const pct = (p.value || 0) / denom * 100;
      if (p.ySymbol) currentPctBySymbol[p.ySymbol] = (currentPctBySymbol[p.ySymbol] || 0) + pct;
      if (p.symbol && p.symbol !== p.ySymbol) currentPctBySymbol[p.symbol] = (currentPctBySymbol[p.symbol] || 0) + pct;
    }
    let maxLabel = null;
    let maxPct = 0;
    const themeUsedPct = {};
    const resolved2 = _resolvePositionTkeys(denom);
    for (const { tkey, currentPct } of resolved2) {
      if (!tkey) continue;
      const theme = getThemeOf(tkey);
      if (theme) {
        themeUsedPct[theme] = (themeUsedPct[theme] || 0) + currentPct;
      }
    }
    for (const [theme, used] of Object.entries(themeUsedPct)) {
      if (used > maxPct) {
        maxPct = used;
        maxLabel = escapeHTML(theme);
      }
    }
    for (const p of positions) {
      const pct = (p.value || 0) / denom * 100;
      if (pct > maxPct) {
        maxPct = pct;
        maxLabel = escapeHTML(p.name || p.symbol || "");
      }
    }
    if (maxLabel) {
      maxConVal.textContent = `${maxLabel} ${maxPct.toFixed(1)}%`;
      if (maxPct > 20) maxConVal.style.color = "var(--up)";
    } else {
      maxConVal.textContent = "\u2014";
    }
  } else {
    maxConVal.textContent = "\u2014";
  }
  maxConStat.appendChild(maxConVal);
  roRow.appendChild(maxConStat);
  const chipsStat = document.createElement("div");
  chipsStat.className = "ro-stat ro-stat-chips";
  const chipsLabel = document.createElement("div");
  chipsLabel.className = "ro-stat-label";
  chipsLabel.textContent = "\u30C6\u30FC\u30DE\u4E0A\u9650\u8D85\u904E";
  chipsStat.appendChild(chipsLabel);
  if (taAvailable && denom > 0) {
    const currentPctBySymbol2 = {};
    for (const p of positions) {
      const pct = (p.value || 0) / denom * 100;
      if (p.ySymbol) currentPctBySymbol2[p.ySymbol] = (currentPctBySymbol2[p.ySymbol] || 0) + pct;
      if (p.symbol && p.symbol !== p.ySymbol)
        currentPctBySymbol2[p.symbol] = (currentPctBySymbol2[p.symbol] || 0) + pct;
    }
    const resolvedForTheme = _resolvePositionTkeys(denom);
    const themes = /* @__PURE__ */ new Set();
    for (const { tkey } of resolvedForTheme) {
      if (!tkey) continue;
      const th = getThemeOf(tkey);
      if (th) themes.add(th);
    }
    const overThemes = [];
    for (const theme of themes) {
      const cap = getThemeCap(theme);
      if (cap == null) continue;
      const usage = computeThemeUsage(theme, currentPctBySymbol2);
      if (usage.used > cap) overThemes.push({ theme, used: usage.used, cap });
    }
    if (overThemes.length === 0) {
      const ok = document.createElement("span");
      ok.className = "ro-ok";
      ok.textContent = "\u306A\u3057";
      chipsStat.appendChild(ok);
    } else {
      const chipsWrap = document.createElement("div");
      chipsWrap.className = "ro-chips-wrap";
      for (const { theme, used, cap } of overThemes) {
        const chip = document.createElement("span");
        chip.className = "ro-chip";
        chip.textContent = `${escapeHTML(theme)} ${used.toFixed(1)}%>${cap}%`;
        chipsWrap.appendChild(chip);
      }
      chipsStat.appendChild(chipsWrap);
    }
  } else {
    const dash = document.createElement("span");
    dash.textContent = "\u2014";
    chipsStat.appendChild(dash);
  }
  card.appendChild(chipsStat);
  const note = document.createElement("div");
  note.className = "ro-note";
  note.textContent = "\u203B \u30D9\u30FC\u30BF\u30FB\u76F8\u95A2\u306F\u4E0B\u6BB5\u30AF\u30AA\u30F3\u30C4\u30AB\u30FC\u30C9\uFF084b\uFF09\u3092\u53C2\u7167\u3002\u30B9\u30C8\u30EC\u30B9\u30FB\u6D41\u52D5\u6027\u306F 4b+ \u4E88\u5B9A";
  card.appendChild(note);
  return card;
}
function _pct1(v, forcePlus = false) {
  if (v === null || !Number.isFinite(v)) return "\u2014";
  const s = `${(v * 100).toFixed(1)}%`;
  return forcePlus && v > 0 ? `+${s}` : s;
}
async function buildQuantCard(posList) {
  const card = document.createElement("div");
  card.className = "risk-quant";
  const title = document.createElement("h4");
  title.textContent = "\u30AF\u30AA\u30F3\u30C4\u30FB\u30EA\u30B9\u30AF\uFF08\u904E\u53BB1\u5E74\u30FB\u5C65\u6B74\u30D9\u30FC\u30B9\uFF09";
  card.appendChild(title);
  function _fallback(msg) {
    const p = document.createElement("p");
    p.className = "rq-note";
    p.style.color = "var(--text2)";
    p.textContent = msg;
    card.appendChild(p);
    return card;
  }
  let hist;
  try {
    hist = await getAllHistorical("1y");
  } catch {
    return _fallback("\u5C65\u6B74\u672A\u53D6\u5F97\uFF08Historical/Watch \u30BF\u30D6\u3092\u958B\u304F\u3068\u65E5\u6B21\u7CFB\u5217\u304C\u84C4\u7A4D\u3055\u308C\u7B97\u51FA\u3055\u308C\u307E\u3059\uFF09");
  }
  if (!hist || Object.keys(hist).length === 0) {
    return _fallback("\u5C65\u6B74\u672A\u53D6\u5F97\uFF08Historical/Watch \u30BF\u30D6\u3092\u958B\u304F\u3068\u65E5\u6B21\u7CFB\u5217\u304C\u84C4\u7A4D\u3055\u308C\u7B97\u51FA\u3055\u308C\u307E\u3059\uFF09");
  }
  const covered = posList.filter((p) => p.ySymbol && Array.isArray(hist[p.ySymbol]) && hist[p.ySymbol].length >= 2);
  if (covered.length < 2) {
    return _fallback("\u5C65\u6B74\u672A\u53D6\u5F97\uFF08Historical/Watch \u30BF\u30D6\u3092\u958B\u304F\u3068\u65E5\u6B21\u7CFB\u5217\u304C\u84C4\u7A4D\u3055\u308C\u7B97\u51FA\u3055\u308C\u307E\u3059\uFF09");
  }
  const rawWeights = {};
  for (const p of covered) {
    rawWeights[
      /** @type {string} */
      p.ySymbol
    ] = (rawWeights[p.ySymbol] || 0) + (p.value || 0);
  }
  const wTotal = Object.values(rawWeights).reduce((s, w) => s + w, 0);
  const normWeights = {};
  for (const [sym, w] of Object.entries(rawWeights)) {
    normWeights[sym] = wTotal > 0 ? w / wTotal : 0;
  }
  const seriesMap = {};
  for (const p of covered) {
    if (p.ySymbol && !seriesMap[p.ySymbol]) seriesMap[p.ySymbol] = hist[p.ySymbol];
  }
  const aligned = alignReturnsByDate(seriesMap);
  const portReturns = computePortfolioReturns(aligned.bySym, normWeights);
  const pfVol = annualizedVol(portReturns);
  const pfWorstD = worstReturn(portReturns);
  const pfWorstW = worstWindow(portReturns, 5);
  const pfWorstM = worstWindow(portReturns, 21);
  const pfWorstQ = worstWindow(portReturns, 63);
  let _cum = 100;
  const pfSeriesLinear = portReturns.map((r, i) => {
    _cum *= 1 + r;
    return { date: new Date(aligned.dates[i] || "2000-01-01"), close: _cum };
  });
  const pfMaxDD = maxDrawdown(pfSeriesLinear);
  const corrPairs = highCorrelationPairs(aligned.bySym, 0.85);
  const perHolding = [];
  for (const sym of Object.keys(aligned.bySym)) {
    const rets = aligned.bySym[sym];
    const vol = annualizedVol(rets) ?? 0;
    const beta = betaTo(rets, portReturns);
    const dd = maxDrawdown(seriesMap[sym]);
    perHolding.push({ sym, vol, beta, dd });
  }
  perHolding.sort((a, b) => {
    const ra = a.vol * Math.abs(a.beta ?? 1);
    const rb = b.vol * Math.abs(b.beta ?? 1);
    return rb - ra;
  });
  const top3 = perHolding.slice(0, 3);
  const excluded = posList.length - covered.length;
  const pfRow = document.createElement("div");
  pfRow.className = "rq-row";
  function _stat(label, valText, isSev = false) {
    const el = document.createElement("div");
    el.className = "rq-stat";
    const lb = document.createElement("span");
    lb.className = "rq-stat-label";
    lb.textContent = label;
    const vl = document.createElement("span");
    vl.className = `rq-stat-value${isSev ? " rq-sev" : ""}`;
    vl.textContent = valText;
    el.appendChild(lb);
    el.appendChild(vl);
    return el;
  }
  pfRow.appendChild(_stat("\u5E74\u7387\u30DC\u30E9", _pct1(pfVol), (pfVol ?? 0) > 0.2));
  pfRow.appendChild(_stat("\u6700\u5927DD", _pct1(pfMaxDD), true));
  card.appendChild(pfRow);
  const stressTitle = document.createElement("div");
  stressTitle.className = "rq-stat-label";
  stressTitle.style.marginTop = "8px";
  stressTitle.textContent = "\u30B9\u30C8\u30EC\u30B9\uFF08\u904E\u53BB1\u5E74\u306E\u6700\u60AA\u5C40\u9762\u30FBPF\uFF09";
  card.appendChild(stressTitle);
  const stressRow = document.createElement("div");
  stressRow.className = "rq-row";
  stressRow.appendChild(_stat("\u6700\u60AA1\u65E5", _pct1(pfWorstD), true));
  stressRow.appendChild(_stat("\u6700\u60AA1\u9031", _pct1(pfWorstW), true));
  stressRow.appendChild(_stat("\u6700\u60AA1\u30F6\u6708", _pct1(pfWorstM), true));
  stressRow.appendChild(_stat("\u6700\u60AA3\u30F6\u6708", _pct1(pfWorstQ), true));
  card.appendChild(stressRow);
  const covNote = document.createElement("p");
  covNote.className = "rq-note";
  covNote.textContent = `${covered.length}\u9298\u67C4\u3067\u7B97\u51FA\uFF08\u5C65\u6B74\u672A\u53D6\u5F97${excluded}\u9664\u5916\uFF09`;
  card.appendChild(covNote);
  const corrTitle = document.createElement("div");
  corrTitle.className = "rq-stat-label";
  corrTitle.textContent = "\u9AD8\u76F8\u95A2\u30DA\u30A2\uFF08\u22650.85\uFF09";
  card.appendChild(corrTitle);
  const corrRow = document.createElement("div");
  corrRow.className = "rq-row";
  const top5Pairs = corrPairs.slice(0, 5);
  if (top5Pairs.length === 0) {
    const okChip = document.createElement("span");
    okChip.className = "rq-chip rq-ok";
    okChip.textContent = "\u306A\u3057";
    corrRow.appendChild(okChip);
  } else {
    for (const { a, b, corr } of top5Pairs) {
      const chip = document.createElement("span");
      chip.className = "rq-chip";
      const escA = escapeHTML(a);
      const escB = escapeHTML(b);
      chip.textContent = `${escA}\u2013${escB} ${corr.toFixed(2)}`;
      corrRow.appendChild(chip);
    }
  }
  card.appendChild(corrRow);
  if (top3.length > 0) {
    const contribTitle = document.createElement("div");
    contribTitle.className = "rq-stat-label";
    contribTitle.style.marginTop = "8px";
    contribTitle.textContent = "\u30EA\u30B9\u30AF\u5BC4\u4E0E Top3\uFF08vol\xD7|\u03B2|\u964D\u9806\uFF09";
    card.appendChild(contribTitle);
    const contribRow = document.createElement("div");
    contribRow.className = "rq-row";
    for (const { sym, vol, beta } of top3) {
      const el = document.createElement("div");
      el.className = "rq-stat";
      const lb = document.createElement("span");
      lb.className = "rq-stat-label";
      lb.textContent = escapeHTML(sym);
      const vl = document.createElement("span");
      vl.className = "rq-stat-value";
      const betaStr = beta !== null ? ` \u03B2${beta.toFixed(1)}` : "";
      vl.textContent = `vol ${_pct1(vol)}${betaStr}`;
      el.appendChild(lb);
      el.appendChild(vl);
      contribRow.appendChild(el);
    }
    card.appendChild(contribRow);
  }
  const liqHoldings = covered.filter((p) => typeof p.shares === "number" && p.shares > 0 && Array.isArray(hist[p.ySymbol])).map((p) => ({
    sym: (
      /** @type {string} */
      p.ySymbol
    ),
    shares: (
      /** @type {number} */
      p.shares
    ),
    series: hist[
      /** @type {string} */
      p.ySymbol
    ]
  }));
  const liq = computeLiquidity(liqHoldings).filter((x) => x.days != null);
  const liqTitle = document.createElement("div");
  liqTitle.className = "rq-stat-label";
  liqTitle.style.marginTop = "8px";
  liqTitle.textContent = `\u6D41\u52D5\u6027 \u51FA\u53E3\u65E5\u6570\uFF08ADV${ADV_WINDOW}\xD7${Math.round(PARTICIPATION * 100)}%/\u65E5\uFF09`;
  card.appendChild(liqTitle);
  if (liq.length === 0) {
    const liqNote = document.createElement("p");
    liqNote.className = "rq-note";
    liqNote.textContent = "\u51FA\u6765\u9AD8\u30C7\u30FC\u30BF\u672A\u53D6\u5F97\uFF08\u4FA1\u683C\u66F4\u65B0\u5F8C\u306B\u84C4\u7A4D\u3055\u308C\u7B97\u51FA\u3055\u308C\u307E\u3059\uFF09";
    card.appendChild(liqNote);
  } else {
    const liqRow = document.createElement("div");
    liqRow.className = "rq-row";
    for (const { sym, days } of liq.slice(0, 5)) {
      const el = document.createElement("div");
      el.className = "rq-stat";
      const lb = document.createElement("span");
      lb.className = "rq-stat-label";
      lb.textContent = escapeHTML(sym);
      const vl = document.createElement("span");
      const sev = days != null && days > ILLIQUID_DAYS;
      vl.className = `rq-stat-value${sev ? " rq-sev" : ""}`;
      vl.textContent = days != null ? `${days < 1 ? days.toFixed(1) : Math.round(days)}\u65E5` : "\u2014";
      el.appendChild(lb);
      el.appendChild(vl);
      liqRow.appendChild(el);
    }
    card.appendChild(liqRow);
    const illiquidCount = liq.filter((x) => x.days != null && x.days > ILLIQUID_DAYS).length;
    if (illiquidCount > 0) {
      const liqWarn = document.createElement("p");
      liqWarn.className = "rq-note";
      liqWarn.textContent = `\u51FA\u53E3\u306B${ILLIQUID_DAYS}\u55B6\u696D\u65E5\u8D85\u304B\u304B\u308B\u4FDD\u6709 ${illiquidCount}\u4EF6`;
      card.appendChild(liqWarn);
    }
  }
  const foot = document.createElement("p");
  foot.className = "rq-note";
  foot.textContent = "\u203B\u30D9\u30FC\u30BF\u306F\u30DD\u30FC\u30C8\u30D5\u30A9\u30EA\u30AA\u81EA\u8EAB\u3078\u306E\u611F\u5FDC\u5EA6\uFF08\u5E02\u5834\u30D9\u30F3\u30C1\u30DE\u30FC\u30AF\u4E0D\u8981\u306E\u5C65\u6B74\u7B97\u51FA\uFF09\u3002\u30B9\u30C8\u30EC\u30B9\u306F\u904E\u53BB1\u5E74\u306E\u6700\u60AA\u5C40\u9762\uFF08\u30A4\u30D9\u30F3\u30C8\u540D\u4ED8\u304D\u30B7\u30CA\u30EA\u30AA\u306F\u5C06\u6765\u62E1\u5F35\uFF09\u3002\u51FA\u53E3\u65E5\u6570\u306F\u682A\u6570\xF7(\u5E73\u5747\u51FA\u6765\u9AD8\xD7\u53C2\u52A0\u7387)\u306E\u6982\u7B97\u3002";
  card.appendChild(foot);
  return card;
}
function buildRiskGlossary() {
  const d = document.createElement("details");
  d.className = "val-gloss";
  d.innerHTML = `<summary>\u7528\u8A9E\u89E3\u8AAC</summary>
    <div class="val-gloss-body">
      <p><b>\u96C6\u4E2D\u5EA6</b>\uFF1A1\u9298\u67C4\u30FB1\u30C6\u30FC\u30DE\u30FB1\u901A\u8CA8\u3078\u306E\u504F\u308A\u3002\u81F4\u547D\u50B7\u3092\u907F\u3051\u308B\u305F\u3081\u4E0A\u9650\u30D0\u30F3\u30C9\u3067\u7BA1\u7406\u3002</p>
      <p><b>\u5E74\u7387\u30DC\u30E9</b>\uFF1A\u65E5\u6B21\u30EA\u30BF\u30FC\u30F3\u306E\u3070\u3089\u3064\u304D\uFF08\u6A19\u6E96\u504F\u5DEE\uFF09\u3092\u5E74\u7387\u63DB\u7B97\u3002\u5927\u304D\u3044\u307B\u3069\u5024\u52D5\u304D\u304C\u8352\u3044\u3002</p>
      <p><b>\u76F8\u95A2\uFF08\u22650.85\uFF09</b>\uFF1A2\u9298\u67C4\u304C\u4E00\u7DD2\u306B\u52D5\u304F\u5EA6\u5408\u3044\uFF08-1\u301C+1\uFF09\u3002\u9AD8\u76F8\u95A2\u30DA\u30A2\u3070\u304B\u308A\u3060\u3068\u5206\u6563\u304C\u52B9\u304B\u305A\u4E00\u7DD2\u306B\u4E0B\u3052\u308B\u3002</p>
      <p><b>\u6700\u5927DD\uFF08\u30C9\u30ED\u30FC\u30C0\u30A6\u30F3\uFF09</b>\uFF1A\u9AD8\u5024\u304B\u3089\u8C37\u307E\u3067\u306E\u6700\u5927\u4E0B\u843D\u7387\u3002\u6700\u3082\u82E6\u3057\u3044\u5C40\u9762\u306E\u6C88\u307F\u8FBC\u307F\u3002</p>
      <p><b>\u30B9\u30C8\u30EC\u30B9\uFF08\u6700\u60AA1\u65E5/1\u9031/1\u30F6\u6708/3\u30F6\u6708\uFF09</b>\uFF1A\u904E\u53BB1\u5E74\u3067\u305D\u306E\u671F\u9593\u306B\u88AB\u3063\u305F\u6700\u60AA\u306E\u4E0B\u843D\u7387\u3002\u300C\u6700\u60AA\u3069\u308C\u3060\u3051\u98DF\u3089\u3046\u304B\u300D\u306E\u4F53\u611F\u3002</p>
      <p><b>PF\u03B2\uFF08\u30DD\u30FC\u30C8\u30D5\u30A9\u30EA\u30AA\u30FB\u30D9\u30FC\u30BF\uFF09</b>\uFF1A\u5404\u9298\u67C4\u304CPF\u5168\u4F53\u306B\u5BFE\u3057\u3069\u308C\u3060\u3051\u654F\u611F\u306B\u52D5\u304F\u304B\u3002\u5E02\u5834\u30D9\u30F3\u30C1\u30DE\u30FC\u30AF\u4E0D\u8981\u306E\u5C65\u6B74\u7B97\u51FA\u3002</p>
      <p><b>\u30EA\u30B9\u30AF\u5BC4\u4E0E\uFF08vol\xD7|\u03B2|\uFF09</b>\uFF1A\u30DC\u30E9\xD7\u30D9\u30FC\u30BF\u7D76\u5BFE\u5024\u3002PF\u30EA\u30B9\u30AF\u3078\u306E\u5BC4\u4E0E\u304C\u5927\u304D\u3044\u9298\u67C4\u307B\u3069\u4E0A\u4F4D\u3002</p>
      <p><b>\u51FA\u53E3\u65E5\u6570</b>\uFF1A\u4FDD\u6709\u3092\u634C\u304F\u306E\u306B\u304B\u304B\u308B\u55B6\u696D\u65E5\u6570\uFF1D\u682A\u6570\xF7(\u5E73\u5747\u51FA\u6765\u9AD8ADV\xD7\u53C2\u52A0\u7387)\u30025\u55B6\u696D\u65E5\u8D85\u306F\u6D41\u52D5\u6027\u30EA\u30B9\u30AF\u3068\u3057\u3066\u8B66\u544A\u3002</p>
      <p><b>\u30B9\u30C8\u30EC\u30B9\u30B7\u30CA\u30EA\u30AA</b>\uFF1A\u540D\u524D\u4ED8\u304D\u306E\u904E\u53BB\u66B4\u843D\uFF08\u5186\u30AD\u30E3\u30EA\u30FC\u5DFB\u304D\u623B\u3057/DeepSeek/\u95A2\u7A0E\u7B49\uFF09\u3092\u3001\u73FE\u5728\u306EPF\u30A6\u30A7\u30A4\u30C8\xD7\u5B9F\u5C65\u6B74\u3067\u5F53\u6642\u306E\u30EC\u30F3\u30B8\u3092\u518D\u751F\u3057\u305F\u300C\u73FEPF\u304C\u5F53\u6642\u3092\u518D\u4F53\u9A13\u3057\u305F\u3089\u300D\u306E\u4E0B\u843D\u7387\u3002\u5B9F\u640D\u76CA\u3067\u306F\u306A\u3044 what-if\u3002\u7A93\u5185\u306B\u4FA1\u683C\u304C\u7121\u3044\u5F8C\u767AIPO\u7B49\u306F\u9664\u5916\u30FB\u518D\u6B63\u898F\u5316\u3057 coverage%\uFF08<90%\u306F\u6CE8\u610F\uFF09\u3067\u660E\u793A\u3002</p>
    </div>`;
  return d;
}
var _taLoaded = false;
async function renderRiskCharts() {
  const panel = document.getElementById("panel-risk");
  if (!panel || panel.hidden) return;
  const wrap = document.getElementById("risk-charts-wrap");
  if (!wrap) return;
  if (typeof d3 === "undefined") return;
  if (!_taLoaded) {
    await loadTargetAllocation();
    _taLoaded = true;
  }
  const manualAssets = getMfManualAssets() || MANUAL_ASSETS;
  const assets = [...positions, ...manualAssets];
  const breakdown = computeRiskBreakdown(assets);
  const sourceSummary = getSourceSummary(assets);
  wrap.textContent = "";
  wrap.appendChild(buildRiskOverviewCard());
  wrap.appendChild(await buildQuantCard(positions));
  wrap.appendChild(await buildStressCard(positions));
  const sumInfo = getClassificationSummary(assets);
  const summary = document.createElement("div");
  summary.className = "risk-summary";
  const warn = sumInfo.unclassified > 0 ? " \u26A0" : "";
  const segs = [
    { label: `\u5BFE\u8C61 ${sumInfo.total} \u9298\u67C4`, syms: sumInfo.allSymbols },
    { label: `\u5206\u985E\u6E08\u307F ${sumInfo.classified}`, syms: sumInfo.classifiedSymbols },
    { label: `\u5206\u985E\u4E0D\u660E ${sumInfo.unclassified}${warn}`, syms: sumInfo.unclassifiedSymbols }
  ];
  segs.forEach((seg, i) => {
    if (i) summary.appendChild(document.createTextNode("\u3000\u2503\u3000"));
    const span = document.createElement("span");
    span.className = "risk-summary-seg";
    span.textContent = seg.label;
    span.addEventListener("mouseenter", (ev) => showSymbolTip(ev, seg.label, seg.syms));
    span.addEventListener("mousemove", moveLegendTip);
    span.addEventListener("mouseleave", hideLegendTip);
    summary.appendChild(span);
  });
  wrap.appendChild(summary);
  const grid = document.createElement("div");
  grid.className = "risk-grid";
  for (const dim of RISK_DIMENSIONS) {
    grid.appendChild(buildChartCard(dim, breakdown[dim], sourceSummary[dim]));
  }
  wrap.appendChild(grid);
  wrap.appendChild(await buildRegionCard(positions));
  const src = document.createElement("div");
  src.className = "risk-source";
  const baseSrc = "\u30C7\u30FC\u30BF\u30BD\u30FC\u30B9: \u4FA1\u683C = Finnhub / Yahoo Finance \u30FB \u30A2\u30BB\u30C3\u30C8\u30AF\u30E9\u30B9/\u901A\u8CA8/\u56FD/\u30BB\u30AF\u30BF\u30FC\u5206\u985E = \u9298\u67C4\u30DE\u30B9\u30BF\uFF08positions.js\u30FBconstituents.js\uFF09";
  const mfSrc = getMfSources();
  const srcLines = mfSrc ? [baseSrc, ...mfSrc, MANUAL_SOURCES[1]] : [baseSrc, ...MANUAL_SOURCES];
  src.textContent = srcLines.filter(Boolean).join(" \uFF0F ");
  wrap.appendChild(src);
  wrap.appendChild(buildRiskGlossary());
}
function showLegendTip(ev, dim, key, dimResult) {
  const tip = document.getElementById("tooltip");
  if (!tip) return;
  const items = getContributors(dimResult, key).slice(0, 12);
  const maxPct = items.length ? Math.max(...items.map((c) => c.pct)) : 1;
  const rows = items.map((c) => {
    const barW = maxPct > 0 ? (c.pct / maxPct * 100).toFixed(1) : 0;
    return `<div class="tt-risk-row"><span class="tt-risk-ticker">${escapeHTML(c.symbol || "\u2014")}</span><span class="tt-risk-name">${escapeHTML(c.name)}</span><div class="tt-risk-bar-wrap"><div class="tt-risk-bar" style="width:${barW}%"></div></div><span class="tt-risk-pct">${fmtPctInt(c.pct)}</span></div>`;
  }).join("");
  tip.innerHTML = `<div class="tt-hdr">${escapeHTML(labelOf(dim, key))}</div>${rows || "\u2015"}`;
  tip.style.display = "block";
  moveLegendTip(ev);
}
function moveLegendTip(ev) {
  const tip = document.getElementById("tooltip");
  if (!tip || tip.style.display !== "block") return;
  const pad = 14;
  const w = tip.offsetWidth || 240;
  let left = ev.clientX + pad;
  if (left + w > window.innerWidth - 8) left = ev.clientX - w - pad;
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${Math.min(ev.clientY + pad, window.innerHeight - tip.offsetHeight - 8)}px`;
}
function hideLegendTip() {
  const tip = document.getElementById("tooltip");
  if (tip) tip.style.display = "none";
}
function showSymbolTip(ev, title, symbols) {
  const tip = document.getElementById("tooltip");
  if (!tip) return;
  const rows = symbols && symbols.length ? symbols.map((s) => escapeHTML(nameOfSymbol(s))).join("<br>") : "\uFF08\u306A\u3057\uFF09";
  tip.innerHTML = `<div class="tt-hdr">${escapeHTML(title)}</div>${rows}`;
  tip.style.display = "block";
  moveLegendTip(ev);
}

// src/briefing.js
var _loaded = false;
var _frame = null;
var _themeObserver = null;
var _resizeFit = false;
function _syncFrameTheme() {
  if (!_frame) return;
  try {
    const t = document.documentElement.getAttribute("data-theme");
    const idoc = _frame.contentDocument?.documentElement;
    if (!idoc) return;
    if (t === "light" || t === "dark") idoc.setAttribute("data-theme", t);
    else idoc.removeAttribute("data-theme");
  } catch {
  }
}
function _ensureThemeObserver() {
  if (_themeObserver) return;
  _themeObserver = new MutationObserver(_syncFrameTheme);
  _themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}
function _fitFrame() {
  if (!_frame) return;
  const top = _frame.getBoundingClientRect().top;
  const bar = _frame.parentElement?.querySelector(".bf-pastbar");
  const barH = bar instanceof HTMLElement ? bar.offsetHeight : 0;
  const h = Math.max(360, Math.round(window.innerHeight - top - barH));
  _frame.style.height = `${h}px`;
}
function _ensureResizeFit() {
  if (_resizeFit) return;
  _resizeFit = true;
  window.addEventListener("resize", _fitFrame);
}
function renderBriefing(force = false) {
  const panel = document.getElementById("panel-briefing");
  if (!panel) return;
  if (_loaded && !force) return;
  panel.innerHTML = '<div class="bf-msg">\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026</div>';
  fetch(`data/briefings/index.json?_=${Date.now()}`).then((r) => {
    if (!r.ok) throw new Error(`index ${r.status}`);
    return r.json();
  }).then((idx) => {
    const issues = (idx.issues || []).slice().sort((a, b) => a.date < b.date ? 1 : -1);
    if (!issues.length) {
      panel.innerHTML = '<div class="bf-msg">\u307E\u3060 Briefing \u304C\u3042\u308A\u307E\u305B\u3093\u3002</div>';
      return;
    }
    const latest = issues[0];
    const latestUrl = _briefingUrl(latest.path);
    if (!latestUrl) throw new Error("invalid briefing path");
    panel.textContent = "";
    const wrap = document.createElement("div");
    wrap.className = "bf-wrap";
    const frame = document.createElement("iframe");
    frame.className = "bf-frame";
    frame.src = _withCacheBust(latestUrl);
    frame.title = String(latest.title || "Briefing");
    frame.loading = "lazy";
    frame.sandbox = "allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox";
    wrap.appendChild(frame);
    const pastbar = document.createElement("div");
    pastbar.className = "bf-pastbar";
    const label = document.createElement("label");
    label.className = "bf-past-label";
    label.htmlFor = "bf-past-sel";
    label.textContent = "\u904E\u53BB\u53F7";
    const select = document.createElement("select");
    select.id = "bf-past-sel";
    select.className = "bf-past-select";
    select.setAttribute("aria-label", "\u904E\u53BB\u306E Briefing \u3092\u9078\u629E");
    for (const [i, issue] of issues.entries()) {
      const url = _briefingUrl(issue.path);
      if (!url) continue;
      const opt = document.createElement("option");
      opt.value = url.pathname.replace(/^\//, "");
      opt.textContent = String(issue.title || issue.date || opt.value);
      opt.selected = i === 0;
      select.appendChild(opt);
    }
    pastbar.append(label, select);
    wrap.appendChild(pastbar);
    panel.appendChild(wrap);
    _frame = frame;
    if (_frame) {
      _frame.addEventListener("load", () => {
        _syncFrameTheme();
        _fitFrame();
      });
      _ensureThemeObserver();
      _ensureResizeFit();
      _fitFrame();
    }
    if (select instanceof HTMLSelectElement) {
      select.addEventListener("change", () => {
        const url = _briefingUrl(select.value);
        if (_frame && url) _frame.src = _withCacheBust(url);
      });
    }
    _loaded = true;
  }).catch(() => {
    panel.innerHTML = '<div class="bf-msg bf-err">Briefing \u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002</div>';
  });
}
function reloadBriefing() {
  renderBriefing(true);
}
function _briefingUrl(path) {
  try {
    const url = new URL(String(path || ""), location.origin);
    if (url.origin !== location.origin) return null;
    if (!url.pathname.startsWith("/data/briefings/")) return null;
    if (!url.pathname.endsWith(".html")) return null;
    return url;
  } catch {
    return null;
  }
}
function _withCacheBust(url) {
  const next = new URL(url.href);
  next.searchParams.set("_", String(Date.now()));
  return next.pathname.replace(/^\//, "") + next.search;
}

// src/reverse-dcf.js
var IMPLIED_GROWTH_OVERHEAT_PCT = 7;
function num2(x) {
  return typeof x === "number" && Number.isFinite(x);
}
function impliedGrowth(fcfYieldPct, waccPct) {
  if (!num2(fcfYieldPct) || !num2(waccPct)) return null;
  const fy = fcfYieldPct / 100;
  const r = waccPct / 100;
  const denom = 1 + fy;
  if (denom === 0) return null;
  return (r - fy) / denom * 100;
}
function isGrowthOverheated(igPct) {
  return num2(igPct) && igPct > IMPLIED_GROWTH_OVERHEAT_PCT;
}

// src/valuations.js
var VAL_URL = "data/valuations.json";
var _vals = {};
var _loaded2 = false;
async function loadValuations() {
  try {
    const r = await fetch(`${VAL_URL}?_=${Date.now()}`);
    if (!r.ok) throw new Error(`val ${r.status}`);
    const j = await r.json();
    _vals = j && j.valuations || {};
    _loaded2 = true;
  } catch {
    _vals = {};
  }
  return _vals;
}
function getValuation(ySymbol) {
  return ySymbol ? _vals[ySymbol] || null : null;
}
function valuationsLoaded() {
  return _loaded2;
}
var VERDICT_LABELS = {
  cheap_real: "\u672C\u7269\u306E\u5272\u5B89",
  cheap_fake: "\u898B\u305B\u304B\u3051\u306E\u5272\u5B89(\u30D5\u30A7\u30A2)",
  fair: "\u4E2D\u7ACB",
  rich_fake: "\u898B\u305B\u304B\u3051\u306E\u5272\u9AD8(\u30D5\u30A7\u30A2)",
  rich_real: "\u672C\u7269\u306E\u5272\u9AD8",
  trap: "\u7F60",
  na: "-"
};
function computeConfidence(pct, v) {
  const val = v && v.value || {};
  const q = v && v.quality || {};
  const hasPer = val.perTrail != null && isFinite(val.perTrail) && val.perFwd != null && isFinite(val.perFwd);
  const hasPeg = val.peg != null && isFinite(val.peg);
  const hasF = q.fScore != null && isFinite(q.fScore);
  let score = (hasPer ? 0.5 : 0) + (hasPeg ? 0.5 : 0) + (hasF ? 1 : 0);
  const edge = Math.min(Math.abs(pct - 30), Math.abs(pct - 70));
  if (pct <= 12 || pct >= 88) score += 1;
  else if (edge >= 15) score += 0.75;
  else if (edge >= 8) score += 0.4;
  else score += 0.1;
  if (hasPer) score += 0.5;
  if (score >= 2.8) return "\u9AD8";
  if (score >= 1.5) return "\u4E2D";
  return "\u4F4E";
}
function computeVerdict(v) {
  const base = classifyVerdict(v);
  const pct = v != null && v.percentile != null ? v.percentile : null;
  base.confidence = base.class === "na" || pct == null ? null : computeConfidence(pct, v);
  if (base.class !== "na") {
    const fy = v && v.value ? v.value.fcfYield : null;
    const wacc = v && v.quality ? v.quality.wacc : null;
    if (isGrowthOverheated(impliedGrowth(fy, wacc))) {
      base.drivers = [...base.drivers, "\u671F\u5F85\u904E\u591A"];
    }
  }
  return base;
}
function classifyVerdict(v) {
  const pct = v != null && v.percentile != null ? v.percentile : null;
  if (pct == null) {
    return { class: "na", label: VERDICT_LABELS["na"], drivers: [], sub: null };
  }
  const val = v && v.value || {};
  if (val.cyclical === true) {
    return { class: "na", label: "\u30B7\u30AF\u30EA\u30AB\u30EB(\u5225\u7269\u5DEE\u3057)", drivers: ["cyclical"], sub: null };
  }
  const t = val.perTrail != null ? val.perTrail : null;
  const f = val.perFwd != null ? val.perFwd : null;
  const peg = val.peg != null ? val.peg : null;
  const debtHeavy = !!val.debtHeavy;
  const rising = t != null && f != null && f <= t * 0.9;
  const falling = t != null && f != null && f >= t * 1.05;
  const zone = pct <= 30 ? "cheap" : pct >= 70 ? "rich" : "mid";
  if (zone === "cheap") {
    if (falling) {
      return { class: "trap", label: "\u7F60\u30FB\u5272\u5B89\u306E\u7F60", drivers: ["fwd\u226Btrail", "\u4E00\u904E\u6027/\u6E1B\u76CA"], sub: "trap_cheap" };
    }
    if (f != null && f > 40) {
      return {
        class: "rich_fake",
        label: VERDICT_LABELS["rich_fake"],
        drivers: ["%\u30BF\u30A4\u30EB\u306E\u30A2\u30E4", "\u7D76\u5BFE\u5024\u9AD8\u30FB\u8FFD\u308F\u306A\u3044"],
        sub: null
      };
    }
    if (debtHeavy) {
      return {
        class: "cheap_fake",
        label: VERDICT_LABELS["cheap_fake"],
        drivers: ["\u8CA0\u50B5/\u7C3F\u5916\u3067EV\u5272\u9AD8", "\u30D5\u30A7\u30A2"],
        sub: null
      };
    }
    return {
      class: "cheap_real",
      label: VERDICT_LABELS["cheap_real"],
      drivers: ["fwd<trail/\u8CA0\u50B5\u8EFD", "\u672C\u7269\u306E\u5272\u5B89"],
      sub: null
    };
  }
  if (zone === "rich") {
    if (falling) {
      return { class: "trap", label: "\u7F60\u30FB\u4E00\u904E\u6027\u76CA", drivers: ["\u4E00\u904E\u6027\u76CA\u3067fake-cheap"], sub: "trap_once" };
    }
    if (rising && peg != null && peg < 2) {
      return {
        class: "rich_fake",
        label: VERDICT_LABELS["rich_fake"],
        drivers: ["\u5229\u76CA\u7206\u767A\u3067\u5272\u9AD8\u306F\u898B\u305B\u304B\u3051", "\u58F2\u308B\u306A"],
        sub: null
      };
    }
    return { class: "rich_real", label: VERDICT_LABELS["rich_real"], drivers: ["\u6210\u9577\u3067\u6B63\u5F53\u5316\u3055\u308C\u306A\u3044\u9AD8\u5024"], sub: null };
  }
  return { class: "fair", label: VERDICT_LABELS["fair"], drivers: [], sub: null };
}

// src/triggers.js
var TRIGGERS_URL = "data/triggers.json";
var _trig = {};
var _loaded3 = false;
async function loadTriggers() {
  try {
    const r = await fetch(`${TRIGGERS_URL}?_=${Date.now()}`);
    if (!r.ok) throw new Error(`triggers ${r.status}`);
    const j = await r.json();
    _trig = j && j.triggers || {};
    _loaded3 = true;
  } catch {
    _trig = {};
  }
  return _trig;
}
function triggersLoaded() {
  return _loaded3;
}
function getTriggers(symbol) {
  if (!symbol) return null;
  return _trig[symbol] || null;
}
function evaluateTriggers(symbol, ctx) {
  const entry = getTriggers(symbol);
  const active = [];
  const watching = [];
  if (!entry) return { active, watching };
  function evalList(list, side) {
    for (const t of list) {
      const type = t.type;
      const action = t.action || "";
      if (type === "thesis" || type === "conditional") {
        watching.push({ side, type, action, note: t.note || "" });
        continue;
      }
      if (type === "concentration") {
        const capPct = t.capPct;
        const themeUsagePct = ctx.themeUsagePct;
        if (themeUsagePct != null && themeUsagePct > capPct) {
          const reason = t.theme === "semiconductor" ? `\u534A\u5C0E\u4F53\u96C6\u4E2D ${themeUsagePct.toFixed(1)}%>${capPct}%` : `\u96C6\u4E2D\u5EA6 ${themeUsagePct.toFixed(1)}%>${capPct}%`;
          active.push({ side, type, action, reason });
        }
        continue;
      }
      if (type === "valuation") {
        if (side === "sell") {
          let reason = null;
          if (t.pctGte != null && ctx.percentile != null && ctx.percentile >= t.pctGte) {
            reason = `%\u30BF\u30A4\u30EB${Math.round(ctx.percentile)}\u2265${t.pctGte}`;
          } else if (t.pegGte != null && ctx.peg != null && ctx.peg >= t.pegGte) {
            reason = `PEG${ctx.peg.toFixed(1)}\u2265${t.pegGte}`;
          }
          if (reason != null) {
            if (ctx.isEtf) {
              watching.push({ side, type, action, note: `ETF proxy\uFF08\u53C2\u8003\uFF09: ${reason}` });
            } else {
              active.push({ side, type, action, reason });
            }
            continue;
          }
        } else {
          if (t.pctLte != null && ctx.percentile != null && ctx.percentile <= t.pctLte) {
            active.push({ side, type, action, reason: `%\u30BF\u30A4\u30EB${Math.round(ctx.percentile)}\u2264${t.pctLte}` });
            continue;
          }
        }
        continue;
      }
      if (type === "limit") {
        const trigPrice = t.price;
        const curPrice = ctx.price;
        if (curPrice != null && trigPrice != null) {
          if (t.dir === "below" && curPrice <= trigPrice) {
            active.push({ side, type, action, reason: `\u4FA1\u683C ${curPrice}\u2264${trigPrice}` });
            continue;
          }
          if (t.dir === "above" && curPrice >= trigPrice) {
            active.push({ side, type, action, reason: `\u4FA1\u683C ${curPrice}\u2265${trigPrice}` });
            continue;
          }
        }
        continue;
      }
    }
  }
  if (Array.isArray(entry.sell)) evalList(entry.sell, "sell");
  if (Array.isArray(entry.buy)) evalList(entry.buy, "buy");
  return { active, watching };
}

// src/verdict-outcomes.js
var OUTCOMES_URL = "data/verdict-outcomes.json";
var _outcomes = [];
var _loaded4 = false;
async function loadVerdictOutcomes() {
  try {
    const r = await fetch(`${OUTCOMES_URL}?_=${Date.now()}`);
    if (!r.ok) throw new Error(`verdict-outcomes ${r.status}`);
    const j = await r.json();
    _outcomes = Array.isArray(j && j.outcomes) ? j.outcomes : [];
    _loaded4 = true;
  } catch {
    _outcomes = [];
  }
  return _outcomes;
}
function outcomesLoaded() {
  return _loaded4;
}
function effectiveOutcome(o) {
  if (o.outcome === "hit" || o.outcome === "miss") return o.outcome;
  if (o.proposedOutcome === "hit" || o.proposedOutcome === "miss") return o.proposedOutcome;
  return "pending";
}
function computeHitRate(kind) {
  let hits = 0;
  let misses = 0;
  let pending = 0;
  for (const o of _outcomes) {
    if (kind && (o.kind || "action") !== kind) continue;
    const eff = effectiveOutcome(o);
    if (eff === "hit") hits++;
    else if (eff === "miss") misses++;
    else pending++;
  }
  const resolved = hits + misses;
  const ratePct = resolved > 0 ? Math.round(hits / resolved * 100) : null;
  return { hits, misses, pending, resolved, ratePct };
}

// src/momentum-calc.js
function _closes(series) {
  if (!Array.isArray(series)) return [];
  return series.map((e) => e && e.close).filter((c) => typeof c === "number" && c > 0);
}
function priceMom1Y(series) {
  const c = _closes(series);
  if (c.length < 2) return null;
  const first = c[0];
  const last = c[c.length - 1];
  if (!(first > 0)) return null;
  return (last / first - 1) * 100;
}
function pos52w(series) {
  const c = _closes(series);
  if (c.length < 2) return null;
  const last = c[c.length - 1];
  let hi = -Infinity;
  let lo = Infinity;
  for (const v of c) {
    if (v > hi) hi = v;
    if (v < lo) lo = v;
  }
  if (!(hi > lo)) return null;
  return (last - lo) / (hi - lo) * 100;
}
function relStrength(series, benchSeries) {
  const a = priceMom1Y(series);
  const b = priceMom1Y(benchSeries);
  if (a === null || b === null) return null;
  return a - b;
}
function computePriceMomentum(series) {
  const m1y = priceMom1Y(series);
  const p52 = pos52w(series);
  if (m1y === null && p52 === null) return null;
  return { priceMom1Y: m1y, pos52w: p52 };
}

// src/valuation-tab.js
var _taLoaded2 = false;
var _mfLoaded = false;
var _lens = "total";
async function _ensureData() {
  const loads = [];
  if (!_taLoaded2) {
    loads.push(
      loadTargetAllocation().then(() => {
        _taLoaded2 = true;
      })
    );
  }
  if (!_mfLoaded) {
    loads.push(
      loadMfHoldings().then(() => {
        _mfLoaded = true;
      })
    );
  }
  if (!valuationsLoaded()) {
    loads.push(loadValuations());
  }
  if (!triggersLoaded()) {
    loads.push(loadTriggers());
  }
  if (!outcomesLoaded()) {
    loads.push(loadVerdictOutcomes());
  }
  await Promise.all(loads);
}
function fmt1(n) {
  return n != null && isFinite(n) ? n.toFixed(1) : "\u2014";
}
function fmtRaw(n) {
  return n != null && isFinite(n) ? n.toFixed(1) : "\u2014";
}
function chipClass(verdict) {
  if (verdict.class === "trap") {
    return verdict.sub === "trap_once" ? "val-chip vc-trap-once" : "val-chip vc-trap-cheap";
  }
  return `val-chip vc-${escapeHTML(verdict.class)}`;
}
function convictionLabel(conviction) {
  if (conviction === "probe") return "\u6253\u8A3A";
  if (conviction === "standard") return "\u6A19\u6E96";
  if (conviction === "high") return "\u9AD8\u78BA\u4FE1";
  return "";
}
function sizeBarHTML(currentPct, targetPct, conviction) {
  if (targetPct == null || !isFinite(targetPct) || targetPct <= 0) {
    return `<div class="val-sb val-sb--na">
      <div class="val-sb-top"></div>
      <div class="val-sb-bar"></div>
      <div class="val-sb-scale"><span class="end"></span><span class="mid"><span class="lab">\u9069\u6B63\u2014</span></span><span class="end"></span></div>
    </div>`;
  }
  const scaleMax = targetPct * 2;
  const ratio = currentPct / scaleMax;
  const fillW = Math.min(100, Math.max(0, ratio * 100));
  const diff = currentPct - targetPct;
  const fillCls = diff > 0.5 ? "over" : diff < -0.5 ? "under" : "fit";
  const curLeft = Math.min(94, Math.max(6, fillW));
  const overflow = currentPct > scaleMax;
  const mult = overflow ? currentPct / targetPct : null;
  const xnum = overflow && mult != null ? `<span class="val-sb-x">\xD7 ${mult.toFixed(1)}</span>` : "";
  const convTxt = convictionLabel(conviction);
  const convHTML = convTxt ? `<span class="cv">\uFF08${escapeHTML(convTxt)}\uFF09</span>` : "";
  return `<div class="val-sb">
    <div class="val-sb-top"><span class="val-sb-cur ${fillCls}" style="left:${curLeft.toFixed(0)}%">${fmt1(currentPct)}%</span></div>
    <div class="val-sb-bar"><span class="val-sb-fill ${fillCls}" style="width:${fillW.toFixed(1)}%"></span>${xnum}</div>
    <div class="val-sb-scale">
      <span class="end">\u6301\u305F\u306A\u3059\u304E</span>
      <span class="mid"><span class="tri" aria-hidden="true"></span><span class="lab">${fmt1(targetPct)}%${convHTML}</span></span>
      <span class="end">\u6301\u3061\u3059\u304E</span>
    </div>
  </div>`;
}
function line3HTML(val) {
  if (_lens === "total") {
    if (!val) return "";
    const v = val.value || {};
    const pctTxt = val.percentile != null && isFinite(val.percentile) ? `${Math.round(val.percentile)}%ile` : "\u2014";
    return `<div class="val-met">
      <span><b>PER</b> ${escapeHTML(fmtRaw(v.perTrail))}\u2192${escapeHTML(fmtRaw(v.perFwd))}</span>
      <span><b>PEG</b> ${escapeHTML(fmtRaw(v.peg))}</span>
      <span><b>%\u30BF\u30A4\u30EB</b> ${escapeHTML(pctTxt)}</span>
    </div>`;
  }
  if (_lens === "value") {
    if (!val) return "";
    const v = val.value || {};
    const pctTxt = val.percentile != null && isFinite(val.percentile) ? `${Math.round(val.percentile)}%ile` : "\u2014";
    const ig = v.cyclical === true ? null : impliedGrowth(v.fcfYield, val.quality && val.quality.wacc != null ? val.quality.wacc : null);
    const igTxt = ig != null && isFinite(ig) ? `${fmt1(ig)}%` : "\u2014";
    const tg = v.targetGapPct != null && isFinite(v.targetGapPct) ? v.targetGapPct : null;
    const tgTxt = tg != null ? `${tg >= 0 ? "+" : ""}${fmt1(tg)}%` : "\u2014";
    const tgCls = tg == null ? "" : tg >= 0 ? ' class="val-mom-up"' : ' class="val-mom-dn"';
    return `<div class="val-met">
      <span><b>PER</b> ${escapeHTML(fmtRaw(v.perTrail))}\u2192${escapeHTML(fmtRaw(v.perFwd))}</span>
      <span><b>PEG</b> ${escapeHTML(fmtRaw(v.peg))}</span>
      <span><b>EV/EBITDA</b> ${escapeHTML(fmtRaw(v.evEbitda))}</span>
      <span><b>FCF\u5229\u56DE\u308A</b> ${escapeHTML(fmtRaw(v.fcfYield))}%</span>
      <span><b>\u9084\u5143</b> ${escapeHTML(fmtRaw(v.shareholderYield))}%</span>
      <span><b>\u7E54\u8FBC\u6210\u9577</b> ${escapeHTML(igTxt)}</span>
      <span><b>\u76EE\u6A19\u4E56\u96E2</b> <span${tgCls}>${escapeHTML(tgTxt)}</span></span>
      <span><b>%\u30BF\u30A4\u30EB</b> ${escapeHTML(pctTxt)}</span>
    </div>`;
  }
  if (_lens === "quality") {
    if (!val) return "";
    const q = val.quality || {};
    const roicNum = q.roic != null && isFinite(q.roic) ? q.roic : null;
    const waccNum = q.wacc != null && isFinite(q.wacc) ? q.wacc : null;
    const roicBad = roicNum != null && waccNum != null && roicNum < waccNum;
    const roicStr = `${escapeHTML(fmtRaw(roicNum))}%`;
    const waccStr = `${escapeHTML(fmtRaw(waccNum))}%`;
    const roicMetric = roicBad ? `<span class="val-bad">${roicStr} vs WACC ${waccStr}</span>` : `${roicStr} vs WACC ${waccStr}`;
    const zNum = q.altmanZ != null && isFinite(q.altmanZ) ? q.altmanZ : null;
    const zStr = escapeHTML(fmtRaw(zNum));
    const zMetric = zNum != null && zNum < 3 ? `<span class="val-warn">${zStr}</span>` : zStr;
    return `<div class="val-met">
      <span><b>ROIC</b> ${roicMetric}</span>
      <span><b>\u7C97\u5229/\u8CC7\u7523</b> ${escapeHTML(fmtRaw(q.grossProf))}</span>
      <span><b>FCF\u5909\u63DB</b> ${escapeHTML(fmtRaw(q.fcfConv))}</span>
      <span><b>F</b> ${escapeHTML(fmtRaw(q.fScore))}</span>
      <span><b>Z</b> ${zMetric}</span>
      <span><b>Q</b> ${escapeHTML(fmtRaw(q.qScore))}</span>
    </div>`;
  }
  if (_lens === "momentum") {
    if (!val) return "";
    const m = val.momentum || {};
    const mom1y = m.priceMom1Y != null && isFinite(m.priceMom1Y) ? m.priceMom1Y : null;
    const mom1yStr = mom1y != null ? mom1y >= 0 ? `+${fmt1(mom1y)}` : fmt1(mom1y) : "\u2014";
    const mom1yCls = mom1y == null ? "" : mom1y >= 0 ? ' class="val-mom-up"' : ' class="val-mom-dn"';
    return `<div class="val-met">
      <span><b>\u6539\u5B9A90d</b> ${escapeHTML(fmtRaw(m.epsRev90d))}%</span>
      <span><b>1Y</b> <span${mom1yCls}>${escapeHTML(mom1yStr)}%</span></span>
      <span><b>52\u9031\u4F4D\u7F6E</b> ${escapeHTML(fmtRaw(m.pos52w))}%</span>
      <span><b>\u5BFE\u5E02\u5834</b> ${escapeHTML(fmtRaw(m.rsVsSector))}%</span>
    </div>`;
  }
  return "";
}
function bannerHTML(trig) {
  let kind = "hold";
  let glyph = "\u25AA";
  let action = "\u7DAD\u6301";
  let reason = "";
  if (trig && trig.active.length > 0) {
    const t = trig.active[0];
    if (t.side === "sell") {
      kind = "sell";
      glyph = "\u25BC";
      action = "\u30C8\u30EA\u30E0";
    } else {
      kind = "buy";
      glyph = "\u25B2";
      action = "\u7A4D\u5897";
    }
    reason = t.reason || t.action || "";
  } else if (trig && trig.watching.length > 0) {
    const w = trig.watching[0];
    kind = "watch";
    glyph = "\u25E6";
    action = "\u76E3\u8996";
    reason = w.note || w.action || "";
  }
  const reasonHTML = reason ? `<span class="vb">${escapeHTML(reason)}</span>` : "";
  return `<div class="val-banner val-banner--${kind}"><span class="va"><span class="gl" aria-hidden="true">${glyph}</span>${action}</span>${reasonHTML}</div>`;
}
function confidenceHTML(verdict) {
  if (!verdict || verdict.confidence == null) return "";
  const lv = verdict.confidence;
  const dots = lv === "\u9AD8" ? 3 : lv === "\u4E2D" ? 2 : 1;
  let dotsHTML = "";
  for (let i = 0; i < 3; i++) dotsHTML += `<i class="d${i < dots ? " on" : ""}"></i>`;
  const drv = verdict.drivers && verdict.drivers.length ? `<span class="drv">\u6839\u62E0: ${escapeHTML(verdict.drivers.join("\u30FB"))}</span>` : "";
  return `<div class="val-jc"><span class="jc-nm">\u5224\u5B9A\u78BA\u5EA6</span><span class="jc-dots" aria-label="\u5224\u5B9A\u78BA\u5EA6 ${escapeHTML(lv)}">${dotsHTML}<span class="lv">${escapeHTML(lv)}</span></span>${drv}</div>`;
}
function totalChipsHTML(val) {
  const v = val && val.value || {};
  const q = val && val.quality || {};
  const per = `${fmtRaw(v.perTrail)}\u2192${fmtRaw(v.perFwd)}`;
  return `<div class="val-chips">
    <span class="val-c"><span class="k">PER</span><b>${escapeHTML(per)}</b></span>
    <span class="val-c"><span class="k">PEG</span><b>${escapeHTML(fmtRaw(v.peg))}</b></span>
    <span class="val-c"><span class="k">F\u30B9\u30B3\u30A2</span><b>${escapeHTML(fmtRaw(q.fScore))}</b></span>
  </div>`;
}
function rowHTML(p, currentPct, targetPct, verdict, val, trig, conviction) {
  const banner = bannerHTML(trig);
  const chipHTML = verdict && verdict.label && verdict.label !== "-" ? `<span class="${chipClass(verdict)}" title="${escapeHTML(verdict.drivers.join("\u30FB"))}">${escapeHTML(verdict.label)}</span>` : "";
  const isProxy = !!(val && val.value && val.value.perSource === "fund-trailing");
  const proxyHTML = isProxy ? `<span class="val-proxy" title="ETF\u306E\u30D5\u30A1\u30F3\u30C9\u5B9F\u7E3EPER\u3002\u4E88\u60F3PER\u4E0D\u5728\u306E\u305F\u3081%\u30BF\u30A4\u30EB\u57FA\u6E96\u306E\u7C97\u3044\u5224\u5B9A">proxy</span>` : "";
  const head = `<div class="val-head">
    <b class="val-tk">${escapeHTML(p.symbol)}</b>
    <span class="val-nm">${escapeHTML(p.name)}</span>
    ${chipHTML}${proxyHTML}
  </div>`;
  const size = `<div class="val-size-wrap">${sizeBarHTML(currentPct, targetPct, conviction)}</div>`;
  const metrics = _lens === "total" ? totalChipsHTML(val) : line3HTML(val);
  const confLine = confidenceHTML(verdict);
  return `<div class="val-row">${banner}<div class="val-body">${head}${size}${metrics}${confLine}</div></div>`;
}
function sortedRows(rows) {
  const copy = rows.slice();
  if (_lens === "total") {
    copy.sort((a, b) => {
      if (a.gap == null && b.gap == null) return 0;
      if (a.gap == null) return 1;
      if (b.gap == null) return -1;
      return b.gap - a.gap;
    });
  } else if (_lens === "value") {
    copy.sort((a, b) => {
      const pa = a.val && a.val.percentile != null && isFinite(a.val.percentile) ? a.val.percentile : null;
      const pb = b.val && b.val.percentile != null && isFinite(b.val.percentile) ? b.val.percentile : null;
      if (pa == null && pb == null) return 0;
      if (pa == null) return 1;
      if (pb == null) return -1;
      return pa - pb;
    });
  } else if (_lens === "quality") {
    copy.sort((a, b) => {
      const qa = a.val && a.val.quality && a.val.quality.qScore != null && isFinite(a.val.quality.qScore) ? a.val.quality.qScore : null;
      const qb = b.val && b.val.quality && b.val.quality.qScore != null && isFinite(b.val.quality.qScore) ? b.val.quality.qScore : null;
      if (qa == null && qb == null) return 0;
      if (qa == null) return 1;
      if (qb == null) return -1;
      return qb - qa;
    });
  } else if (_lens === "momentum") {
    copy.sort((a, b) => {
      const ma = a.val && a.val.momentum && a.val.momentum.priceMom1Y != null && isFinite(a.val.momentum.priceMom1Y) ? a.val.momentum.priceMom1Y : null;
      const mb = b.val && b.val.momentum && b.val.momentum.priceMom1Y != null && isFinite(b.val.momentum.priceMom1Y) ? b.val.momentum.priceMom1Y : null;
      if (ma == null && mb == null) return 0;
      if (ma == null) return 1;
      if (mb == null) return -1;
      return mb - ma;
    });
  }
  return copy;
}
function lensCap(lens) {
  if (lens === "total") return "\u4E56\u96E2\u9806\uFF5C\u30B5\u30A4\u30BA\u904E\u5927\u304C\u4E0A";
  if (lens === "value") return "%\u30BF\u30A4\u30EB\u6607\u9806\uFF5C\u5272\u5B89\u304C\u4E0A";
  if (lens === "quality") return "qScore\u9806\uFF5CROIC<WACC\u306F\u8D64\u30FBAltman Z<3\u306F\u6CE8\u610F\u8272";
  if (lens === "momentum") return "1Y\u9A30\u843D\u9806";
  return "";
}
function glossaryHTML() {
  return `<details class="val-gloss">
    <summary>\u7528\u8A9E\u89E3\u8AAC</summary>
    <div class="val-gloss-body">
      <p><b>Verdict\uFF08\u6B63\u4F53\uFF09</b>\uFF1APER\u306E\u5272\u5B89/\u5272\u9AD8\u306E\u300C\u4F4D\u7F6E\u300D\u3068\u5229\u76CA\u306E\u300C\u5411\u304D\u300D\u3092\u5408\u6210\u3057\u305F\u7D50\u8AD6\u3002\u672C\u7269\u306E\u5272\u5B89/\u5272\u9AD8\uFF08\u884C\u52D5\u3067\u304D\u308B\uFF09\u3001\u898B\u305B\u304B\u3051(\u30D5\u30A7\u30A2)\uFF1D\u5272\u5B89/\u5272\u9AD8\u306B\u898B\u3048\u3066\u5B9F\u614B\u30D5\u30A7\u30A2\u3001\u7F60\uFF1D\u5272\u5B89\u306E\u7F60/\u4E00\u904E\u6027\u76CA\u3001\u4E2D\u7ACB\u3001-\uFF08\u30B7\u30AF\u30EA\u30AB\u30EB\uFF1DPER\u63A1\u70B9\u5916\uFF09\u306E7\u7A2E\u3002</p>
      <p><b>PER \u4F8B: 52\u219238\uFF08\u5B9F\u7E3E\u2192\u4E88\u60F3\uFF09</b>\uFF1A\u5DE6\uFF1D\u5B9F\u7E3EPER\uFF08\u904E\u53BB12\u30AB\u6708\uFF09\u3001\u53F3\uFF1D\u4E88\u60F3PER\uFF08\u6765\u671F\u4E88\u60F3\uFF09\u3002\u53F3\u304C\u5C0F\u3055\u3044\uFF1D\u6765\u671F\u5229\u76CA\u304C\u5897\u3048\u308B\u898B\u8FBC\u307F\u3002\u5411\u304D\u304C\u6700\u91CD\u8981\u30B7\u30B0\u30CA\u30EB\u3002</p>
      <p><b>PEG</b>\uFF1APER \xF7 \u5229\u76CA\u6210\u9577\u7387\u30021\u672A\u6E80\uFF1D\u5272\u5B89\u5BC4\u308A\u30013\u8D85\uFF1D\u5272\u9AD8\u3002\u6210\u9577\u3092\u52A0\u5473\u3057\u305F\u5272\u9AD8\u5EA6\u3002</p>
      <p><b>F\u30B9\u30B3\u30A2\uFF080\u301C9\u70B9\u30FBPiotroski\uFF09</b>\uFF1A\u53CE\u76CA\u6027\u30FB\u8CA1\u52D9\u30FB\u52B9\u7387\u306E9\u9805\u76EE\u3092\u54041\u70B9\u3067\u63A1\u70B9\u30027\u301C9\uFF1D\u5065\u5168\u30010\u301C2\uFF1D\u5371\u967A\uFF08\u7F60\u6FC3\u539A\uFF09\u3002\u5272\u5B89\u304C\u300C\u672C\u7269\u304B\u7F60\u304B\u300D\u306E\u54C1\u8CEA\u70B9\u3002</p>
      <p><b>\u5224\u5B9A\u78BA\u5EA6</b>\uFF1A\u30A8\u30F3\u30B8\u30F3\u306EVerdict\u5224\u5B9A\u304C\u3069\u308C\u3060\u3051\u4FE1\u983C\u3067\u304D\u308B\u304B\uFF08\u30C7\u30FC\u30BF\u5145\u8DB3\uFF0B\u30B7\u30B0\u30CA\u30EB\u4E00\u81F4\uFF0B\u5883\u754C\u4F59\u88D5\uFF09\u3002\u78BA\u4FE1\u5EA6\uFF08\u81EA\u5206\u306E\u81EA\u4FE1\uFF1D\u30B5\u30A4\u30BA\u5165\u529B\uFF09\u3068\u306F\u5225\u7269\u3002</p>
      <p><b>\u78BA\u4FE1\u5EA6</b>\uFF1A\u81EA\u5206\u306E\u4E3B\u89B3\u7684\u306A\u81EA\u4FE1\u3002\u6253\u8A3A/\u6A19\u6E96/\u9AD8\u78BA\u4FE1\u3067\u9069\u6B63\u30B5\u30A4\u30BA\uFF08%\uFF09\u3092\u6C7A\u3081\u308B\u5165\u529B\u3002\u30B5\u30A4\u30BA\u30D0\u30FC\u306E\u9069\u6B63\u30DE\u30FC\u30AB\u30FC\u8107\u306B\u8868\u793A\u3002</p>
    </div>
  </details>`;
}
async function renderValuationTab() {
  const wrap = document.getElementById("value-wrap");
  if (!wrap) return;
  await _ensureData();
  const totals = getMfTotals();
  const denom = totals && totals.imported || positions.reduce((s, p) => s + (p.value || 0), 0);
  if (denom <= 0 || positions.length === 0) {
    wrap.innerHTML = '<div class="val-soon">\u30C7\u30FC\u30BF\u6E96\u5099\u4E2D\u3002\u30DE\u30CD\u30D5\u30A9\u53D6\u8FBC\u307E\u305F\u306FCSV\u53D6\u8FBC\u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002</div>';
    return;
  }
  const _hist = (
    /** @type {Record<string, Array<{date: Date, close: number}>>} */
    await getAllHistorical("1y")
  );
  const _benchSeries = _hist["ACWI"] || null;
  const currentPctBySymbol = {};
  for (const p of positions) {
    const pct = (p.value || 0) / denom * 100;
    if (p.ySymbol) currentPctBySymbol[p.ySymbol] = pct;
    if (p.symbol && p.symbol !== p.ySymbol) currentPctBySymbol[p.symbol] = pct;
  }
  const rows = positions.map((p) => {
    const currentPct = (p.value || 0) / denom * 100;
    let tkey = null;
    for (const candidate of [p.ySymbol, p.symbol, p.name]) {
      if (!candidate) continue;
      if (getTargetPct(candidate) != null || getThemeOf(candidate) != null) {
        tkey = candidate;
        break;
      }
    }
    const targetPct = tkey != null ? getTargetPct(tkey) : null;
    const gap = targetPct != null ? currentPct - targetPct : null;
    const conviction = tkey != null ? getConviction(tkey) : null;
    let val = getValuation(p.ySymbol);
    const liveMom = p.ySymbol ? computePriceMomentum(_hist[p.ySymbol]) : null;
    const liveRs = p.ySymbol && _benchSeries ? relStrength(_hist[p.ySymbol], _benchSeries) : null;
    if (liveMom || liveRs != null) {
      const m = val && val.momentum || {};
      val = {
        ...val || {},
        momentum: {
          ...m,
          priceMom1Y: m.priceMom1Y != null ? m.priceMom1Y : liveMom ? liveMom.priceMom1Y : null,
          pos52w: m.pos52w != null ? m.pos52w : liveMom ? liveMom.pos52w : null,
          rsVsSector: m.rsVsSector != null ? m.rsVsSector : liveRs
        }
      };
    }
    const verdict = val ? computeVerdict(val) : null;
    const trigTheme = tkey && getThemeOf(tkey) || p.ySymbol && getThemeOf(p.ySymbol) || null;
    const themeUsagePct = trigTheme ? computeThemeUsage(trigTheme, currentPctBySymbol).used : null;
    const isEtf = !!(val && val.value && val.value.perSource === "fund-trailing");
    const trigSymbol = getTriggers(p.ySymbol) ? p.ySymbol : getTriggers(p.symbol) ? p.symbol : null;
    const trig = trigSymbol ? evaluateTriggers(trigSymbol, {
      percentile: val && val.percentile != null ? val.percentile : null,
      peg: val && val.value && val.value.peg != null ? val.value.peg : null,
      themeUsagePct,
      price: p.price != null ? p.price : null,
      isEtf
    }) : null;
    return { p, currentPct, targetPct, gap, verdict, val, tkey, trig, conviction };
  });
  const overCount = rows.filter((r) => r.gap != null && r.gap > 0.5).length;
  const cheapCount = rows.filter((r) => r.verdict && r.verdict.class === "cheap_real").length;
  const triggerCount = rows.filter((r) => r.trig && r.trig.active.length > 0).length;
  const hrA = computeHitRate("action");
  const hrV = computeHitRate("verdict");
  const hrPart = (label, hr) => hr.resolved > 0 ? `<span title="${label} ${hr.ratePct}%" aria-label="${label}\u7684\u4E2D\u7387${hr.ratePct}%">${label}${hr.hits}-${hr.misses}</span>` : `<span>${label}\u2014</span>`;
  const hitRateVal = `${hrPart("\u767A\u8B70", hrA)}<span class="hr-sep"> / </span>${hrPart("\u5224\u5B9A", hrV)}`;
  const statsHTML = `<div class="val-stats">
    <div class="val-stat"><span class="k">\u904E\u5927\u30DD\u30B8</span><span class="v">${overCount}</span></div>
    <div class="val-stat"><span class="k">\u5272\u5B89\u5019\u88DC</span><span class="v">${cheapCount}</span></div>
    <div class="val-stat"><span class="k">\u7684\u4E2D\u7387</span><span class="v">${hitRateVal}</span></div>
    <div class="val-stat"><span class="k">\u30C8\u30EA\u30AC\u30FC</span><span class="v">${triggerCount}</span></div>
  </div>`;
  const lenses = [
    { key: "total", label: "\u7DCF\u5408" },
    { key: "value", label: "\u30D0\u30EA\u30E5" },
    { key: "quality", label: "\u54C1\u8CEA" },
    { key: "momentum", label: "\u30E2\u30E1\u30F3\u30BF\u30E0" }
  ];
  const pillsHTML = lenses.map(
    (l) => `<button class="val-seg${_lens === l.key ? " on" : ""}" role="tab" aria-selected="${_lens === l.key}" data-lens="${escapeHTML(l.key)}">${escapeHTML(l.label)}</button>`
  ).join("");
  const lensHTML = `<div class="val-lens" role="tablist" aria-label="\u30EC\u30F3\u30BA\u9078\u629E">${pillsHTML}</div>
  <div class="val-lens-cap">${escapeHTML(lensCap(_lens))}</div>`;
  const sorted = sortedRows(rows);
  const rowsHTML = sorted.map((r) => rowHTML(r.p, r.currentPct, r.targetPct, r.verdict, r.val, r.trig, r.conviction)).join("");
  wrap.innerHTML = `${statsHTML}${lensHTML}<div class="val-list">${rowsHTML}</div>${glossaryHTML()}`;
  wrap.querySelectorAll(".val-seg[data-lens]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextLens = (
        /** @type {HTMLElement} */
        btn.dataset.lens
      );
      if (!nextLens || nextLens === _lens) return;
      _lens = nextLens;
      renderValuationTab();
    });
  });
}

// src/tabs.js
function switchTab(name) {
  if (state.activeTab === name) return;
  state.activeTab = name;
  try {
    localStorage.setItem("hm-active-tab", name);
  } catch {
  }
  const panelHeatmap = document.getElementById("panel-heatmap");
  const panelList = document.getElementById("panel-list");
  const panelWatchlist = document.getElementById("panel-watchlist");
  const panelRisk = document.getElementById("panel-risk");
  const panelValue = document.getElementById("panel-value");
  const panelBriefing = document.getElementById("panel-briefing");
  const panelAi = document.getElementById("panel-ai");
  if (panelHeatmap) panelHeatmap.hidden = name !== "heatmap";
  if (panelList) panelList.hidden = name !== "list";
  if (panelWatchlist) panelWatchlist.hidden = name !== "watchlist";
  if (panelRisk) panelRisk.hidden = name !== "risk";
  if (panelValue) panelValue.hidden = name !== "value";
  if (panelBriefing) panelBriefing.hidden = name !== "briefing";
  if (panelAi) panelAi.hidden = name !== "ai";
  document.querySelectorAll(".tab-btn[data-tab]").forEach((b) => {
    const isActive = b.dataset.tab === name;
    b.classList.toggle("active", isActive);
    b.setAttribute("aria-selected", String(isActive));
  });
  const slControls = document.getElementById("sl-controls");
  const wlSearch = document.getElementById("wl-search-wrap");
  if (slControls) slControls.hidden = name !== "list";
  if (wlSearch) wlSearch.hidden = name !== "watchlist";
  if (name === "heatmap") {
    renderHeatmap();
    requestAnimationFrame(() => requestAnimationFrame(updateHeatmapHeight));
  }
  if (name === "list") {
    renderStockList();
    requestAnimationFrame(() => requestAnimationFrame(updateListHeight));
  }
  if (name === "watchlist") {
    (async () => {
      await _loadWatchlistFromWorker();
      renderWatchlist();
      updateWatchlistHeight();
      fetchWatchlistData();
    })();
  }
  if (name === "risk") renderRiskCharts();
  if (name === "value") renderValuationTab();
  if (name === "briefing") renderBriefing();
}

// src/swipe.js
var DIST_THRESHOLD = 60;
var RATIO = 1.6;
var TIME_LIMIT = 600;
var EDGE_IGNORE = 20;
function tabOrder() {
  return (
    /** @type {string[]} */
    [...document.querySelectorAll(".tab-btn[data-tab]")].map((b) => (
      /** @type {HTMLElement} */
      b.dataset.tab
    )).filter(Boolean)
  );
}
function overlayOpen() {
  if (document.getElementById("pin-overlay")) return true;
  for (const ov of document.querySelectorAll(".modal-overlay")) {
    if (getComputedStyle(
      /** @type {HTMLElement} */
      ov
    ).display !== "none") return true;
  }
  return false;
}
function inHScrollable(target, dx) {
  let el = (
    /** @type {HTMLElement|null} */
    target
  );
  while (el && el !== document.body) {
    if (el.scrollWidth > el.clientWidth + 2) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === "auto" || ox === "scroll") {
        const max = el.scrollWidth - el.clientWidth;
        if (dx < 0 && el.scrollLeft < max - 1) return true;
        if (dx > 0 && el.scrollLeft > 1) return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}
function setupSwipeNav() {
  if (!("ontouchstart" in window)) return;
  let startX = 0;
  let startY = 0;
  let startT = 0;
  let startTarget = (
    /** @type {EventTarget|null} */
    null
  );
  let tracking = false;
  document.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) {
      tracking = false;
      return;
    }
    const t = e.touches[0];
    if (t.clientX <= EDGE_IGNORE || t.clientX >= window.innerWidth - EDGE_IGNORE) {
      tracking = false;
      return;
    }
    startX = t.clientX;
    startY = t.clientY;
    startT = Date.now();
    startTarget = e.target;
    tracking = true;
  }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (!tracking) return;
    tracking = false;
    if (overlayOpen()) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Date.now() - startT > TIME_LIMIT) return;
    if (Math.abs(dx) < DIST_THRESHOLD) return;
    if (Math.abs(dx) < Math.abs(dy) * RATIO) return;
    if (inHScrollable(startTarget, dx)) return;
    const order = tabOrder();
    const cur = order.indexOf(state.activeTab);
    if (cur === -1) return;
    const next = dx < 0 ? cur + 1 : cur - 1;
    if (next < 0 || next >= order.length) return;
    switchTab(
      /** @type {any} */
      order[next]
    );
  }, { passive: true });
}

// src/init.js
function setupEventListeners(applyThemeFn) {
  if (typeof d3 === "undefined") {
    document.getElementById("d3-load-error").style.display = "flex";
    return;
  }
  setupSwipeNav();
  loadValuations().then(() => {
    renderStockList();
    renderWatchlist();
  });
  let _resizeRaf = null;
  window.addEventListener("resize", () => {
    if (_resizeRaf) cancelAnimationFrame(_resizeRaf);
    _resizeRaf = requestAnimationFrame(() => {
      _resizeRaf = null;
      renderHeatmap();
      renderStockList();
      applyStockBars();
      updateListHeight();
      updateWatchlistHeight();
    });
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.themeMode !== "auto") return;
    applyThemeFn();
    renderHeatmap();
    const overlay = document.getElementById("modal-overlay");
    if (overlay && overlay.style.display !== "none" && state.currentPos?.ySymbol) {
      loadChart(state.currentPos.ySymbol, state.currentRange);
    }
  });
  if (typeof ResizeObserver !== "undefined") {
    const _stickyEl = document.querySelector(".sticky-top");
    if (_stickyEl) {
      new ResizeObserver(() => {
        if (state.activeTab === "list") updateListHeight();
        if (state.activeTab === "watchlist") updateWatchlistHeight();
      }).observe(_stickyEl);
    }
  }
}

// src/positions-store.js
async function loadPositionsFromKV() {
  try {
    const res = await fetchWithTimeout(`${WORKER_URL}/positions`, 1e4);
    if (!res.ok) return false;
    const kvPositions = await res.json();
    if (!Array.isArray(kvPositions) || kvPositions.length === 0) return false;
    const validated = [];
    for (const pos of kvPositions) {
      try {
        validated.push(validatePosition(pos));
      } catch (e) {
        console.warn("[positions-store] validation failed for position:", pos?.symbol, e.message);
      }
    }
    positions.splice(0, positions.length, ...validated);
    return true;
  } catch (e) {
    console.warn("[positions-store] KV positions \u8AAD\u8FBC\u5931\u6557:", e);
    return false;
  }
}
async function savePositionsToKV(newPositions, pinHashOverride) {
  const pinHash = pinHashOverride || localStorage.getItem("hm-pin-hash");
  if (!pinHash) throw new Error("PIN\u304C\u672A\u8A2D\u5B9A\u3067\u3059\u3002\u521D\u56DEPIN\u8A2D\u5B9A\u3092\u5B8C\u4E86\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
  const res = await fetchWithTimeout(`${WORKER_URL}/positions`, 3e4, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Pin-Hash": pinHash },
    body: JSON.stringify(newPositions)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `\u4FDD\u5B58\u5931\u6557 (HTTP ${res.status})`);
  }
  return (await res.json()).ok === true;
}
function mergeDuplicatePositions(positions2) {
  if (!Array.isArray(positions2)) return positions2;
  const map = /* @__PURE__ */ new Map();
  for (const p of positions2) {
    if (!p || !p.symbol) continue;
    const existing = map.get(p.symbol);
    if (!existing) {
      map.set(p.symbol, { ...p });
      continue;
    }
    const sharesA = existing.shares || 0;
    const sharesB = p.shares || 0;
    const totalShares = sharesA + sharesB;
    const totalCost = (existing.avgCost || 0) * sharesA + (p.avgCost || 0) * sharesB;
    existing.shares = totalShares;
    existing.avgCost = totalShares > 0 ? Math.round(totalCost / totalShares * 100) / 100 : existing.avgCost || 0;
    existing.value = (existing.value || 0) + (p.value || 0);
    existing.pnl = (existing.pnl || 0) + (p.pnl || 0);
    if (!existing.price && p.price) existing.price = p.price;
    const costBase = (existing.avgCost || 0) * (existing.shares || 0);
    existing.pnlPct = costBase > 0 ? existing.pnl / costBase * 100 : 0;
  }
  return [...map.values()];
}
function computeImportDiff(current, incoming) {
  const keyOf = (p) => p.symbol;
  const curMap = new Map(current.map((p) => [keyOf(p), p]));
  const newMap = new Map(incoming.map((p) => [keyOf(p), p]));
  const added = incoming.filter((p) => !curMap.has(keyOf(p)));
  const removed = current.filter((p) => !newMap.has(keyOf(p)));
  const changed = incoming.filter((p) => {
    const c = curMap.get(keyOf(p));
    return c && (c.shares !== p.shares || c.avgCost !== p.avgCost);
  });
  const unchanged = incoming.filter((p) => {
    const c = curMap.get(keyOf(p));
    return c && c.shares === p.shares && c.avgCost === p.avgCost;
  });
  return { added, removed, changed, unchanged };
}

// src/funds.js
var FUND_DEFS = [
  {
    patterns: ["\u5168\u4E16\u754C\u682A\u5F0F"],
    symbol: "\u30AA\u30EB\u30AB\u30F3",
    canonicalName: "eMAXIS Slim \u5168\u4E16\u754C\u682A\u5F0F(\u30AA\u30FC\u30EB\u30FB\u30AB\u30F3\u30C8\u30EA\u30FC)",
    ySymbol: "ACWI",
    proxyName: "iShares MSCI ACWI ETF"
  },
  {
    // ひふみマイクロスコープpro / ひふみマイクロプラスプロ / 旧シンボル名
    // 超小型株特化 → 東証グロース250（旧マザーズ指数）が運用実態に最も近い
    patterns: ["\u30DE\u30A4\u30AF\u30ED\u30B9\u30B3\u30FC\u30D7", "\u30DE\u30A4\u30AF\u30ED\u30D7\u30E9\u30B9", "\u30DE\u30A4\u30AF\u30EDSP"],
    symbol: "\u3072\u3075\u307FMS",
    canonicalName: "\u3072\u3075\u307F\u30DE\u30A4\u30AF\u30ED\u30B9\u30B3\u30FC\u30D7pro",
    ySymbol: "2516.T",
    proxyName: "NEXT FUNDS \u6771\u8A3C\u30B0\u30ED\u30FC\u30B9\u5E02\u5834250\u6307\u6570ETF"
  },
  {
    // ひふみクロスオーバーpro
    // 上場/未上場混在のグローバル投資 → MSCI ACWI が最も近い
    patterns: ["\u30AF\u30ED\u30B9\u30AA\u30FC\u30D0\u30FC", "\u3072\u3075\u307FXO"],
    symbol: "\u3072\u3075\u307FXO",
    canonicalName: "\u3072\u3075\u307F\u30AF\u30ED\u30B9\u30AA\u30FC\u30D0\u30FCpro",
    ySymbol: "ACWI",
    proxyName: "iShares MSCI ACWI ETF"
  },
  {
    // ひふみ投信は最後（"ひふみ"は他にマッチしなかったときのフォールバック）
    // 1312.T（TOPIX Small）は Yahoo Finance が履歴データを返さないため、
    // ひふみMS と同じ 2516.T（東証グロース250）を採用（中小型成長テーマで類似）
    patterns: ["\u3072\u3075\u307F\u6295\u4FE1", "\u3072\u3075\u307F"],
    symbol: "\u3072\u3075\u307F\u6295\u4FE1",
    canonicalName: "\u3072\u3075\u307F\u6295\u4FE1",
    ySymbol: "2516.T",
    proxyName: "NEXT FUNDS \u6771\u8A3C\u30B0\u30ED\u30FC\u30B9\u5E02\u5834250\u6307\u6570ETF"
  }
];
function fundSymbolFromName(name) {
  if (!name) return null;
  for (const d of FUND_DEFS) {
    if (d.patterns.some((p) => name.includes(p))) return d.symbol;
  }
  return null;
}
function fundProxyOf(symbol) {
  const d = FUND_DEFS.find((d2) => d2.symbol === symbol);
  return d ? { ySymbol: d.ySymbol, proxyName: d.proxyName } : null;
}
function canonicalizeFundPosition(p) {
  if (!p || p.cat !== "\u6295\u8CC7\u4FE1\u8A17") return p;
  const name = p.name || p.symbol || "";
  for (const def of FUND_DEFS) {
    if (def.patterns.some((pat) => name.includes(pat) || (p.symbol || "").includes(pat))) {
      return {
        ...p,
        symbol: def.symbol,
        name: def.canonicalName || p.name,
        ySymbol: def.ySymbol,
        // ← 強制上書き
        proxyName: def.proxyName,
        // ← 強制上書き
        isProxy: true
      };
    }
  }
  return p;
}

// src/csv.js
function normalizeStr(s) {
  return s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 65248)).replace(/　/g, " ").trim();
}
function parseCsvText(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') inQ = false;
        else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ",") {
          row.push(cur);
          cur = "";
        } else cur += c;
      }
    }
    row.push(cur);
    rows.push(row);
  }
  return rows;
}
function parseNum(s) {
  if (s == null || s === "") return null;
  const n = parseFloat(String(s).replace(/[,\s%]/g, ""));
  return isFinite(n) ? n : null;
}
function detectCsvType(headerRow) {
  const h = headerRow.map((c) => c.trim());
  if (h.includes("\u9298\u67C4\u30B3\u30FC\u30C9")) return "jp";
  if (h.some((c) => c.includes("\u4FDD\u6709\u6570[\u682A]"))) return "us";
  if (h.includes("\u57FA\u6E96\u4FA1\u984D")) return "fund";
  return null;
}

// src/import-parse.js
var FUND_FALLBACK_PROXY = { ySymbol: "^N225", proxyName: "\u65E5\u7D4C\u5E73\u5747" };
function buildJpPosition(row) {
  const symbol = row[3]?.trim();
  const name = normalizeStr(row[2]?.trim() || "");
  if (!symbol || !name) return null;
  const avgCost = parseNum(row[8]);
  const shares = parseNum(row[9]);
  const price = parseNum(row[7]);
  const value = parseNum(row[12]);
  const pnl = parseNum(row[13]);
  const pnlPct = avgCost && shares && avgCost > 0 ? (pnl ?? 0) / (avgCost * shares) * 100 : null;
  return {
    symbol,
    name,
    cat: "\u65E5\u672C\u682A\u30FBETF",
    shares: shares ?? 0,
    price: price ?? 0,
    avgCost: avgCost ?? 0,
    value: value ?? 0,
    pnl: pnl ?? 0,
    pnlPct: pnlPct ?? 0,
    dayPct: null,
    dayCh: null,
    cur: "JPY",
    ySymbol: `${symbol}.T`
  };
}
function buildUsPosition(row) {
  const name = normalizeStr(row[0]?.trim() || "");
  const ticker = row[1]?.trim();
  if (!ticker || !name) return null;
  const shares = parseNum(row[4]);
  const avgCost = parseNum(row[7]);
  const price = parseNum(row[10]);
  const value = parseNum(row[16]);
  const pnl = parseNum(row[18]);
  const pnlPct = value != null && pnl != null && value - pnl !== 0 ? pnl / (value - pnl) * 100 : null;
  return {
    symbol: ticker,
    name,
    cat: "\u7C73\u56FD\u682A\u30FBETF",
    shares: shares ?? 0,
    price: price ?? 0,
    avgCost: avgCost ?? 0,
    value: value ?? 0,
    pnl: pnl ?? 0,
    pnlPct: pnlPct ?? 0,
    dayPct: null,
    dayCh: null,
    cur: "USD",
    ySymbol: ticker
  };
}
function buildFundPosition(row) {
  const rawName = row[2]?.trim();
  if (!rawName) return null;
  const name = normalizeStr(rawName);
  const symbol = fundSymbolFromName(name);
  if (!symbol) return null;
  const sharesRaw = parseNum(row[7]);
  const shares = sharesRaw != null ? Math.round(sharesRaw / 1e4 * 1e4) / 1e4 : null;
  const avgCost = parseNum(row[11]);
  const price = parseNum(row[5]);
  const value = parseNum(row[12]);
  const pnl = parseNum(row[13]);
  const cost = value != null && pnl != null ? value - pnl : null;
  const pnlPct = cost != null && cost !== 0 ? pnl / cost * 100 : null;
  const proxy = fundProxyOf(symbol) ?? FUND_FALLBACK_PROXY;
  return {
    symbol,
    name,
    cat: "\u6295\u8CC7\u4FE1\u8A17",
    shares: shares ?? 0,
    price: price ?? 0,
    avgCost: avgCost ?? 0,
    value: value ?? 0,
    pnl: pnl ?? 0,
    pnlPct: pnlPct ?? 0,
    dayPct: null,
    dayCh: null,
    cur: "JPY",
    ySymbol: proxy.ySymbol,
    isProxy: true,
    proxyName: proxy.proxyName
  };
}
async function parseManexFiles(files) {
  const results = [];
  for (const file of files) {
    try {
      const buf = await file.arrayBuffer();
      const text = new TextDecoder("shift-jis").decode(buf);
      const rows = parseCsvText(text);
      if (rows.length < 2) continue;
      const type = detectCsvType(rows[0]);
      if (!type) continue;
      for (let i = 1; i < rows.length; i++) {
        const pos = type === "jp" ? buildJpPosition(rows[i]) : type === "us" ? buildUsPosition(rows[i]) : buildFundPosition(rows[i]);
        if (pos) results.push(pos);
      }
    } catch (e) {
      console.error("[import] CSV parse error:", file.name, e);
    }
  }
  return results;
}
var SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
var MAX_IMAGE_BYTES = 16e6;
async function parseMoneyForwardImage(file) {
  const mime = file.type || "image/png";
  if (!SUPPORTED_IMAGE_TYPES.includes(mime.toLowerCase())) {
    throw new Error(`\u975E\u5BFE\u5FDC\u306E\u753B\u50CF\u5F62\u5F0F\u3067\u3059\uFF08${mime}\uFF09\u3002JPEG \u307E\u305F\u306F PNG \u5F62\u5F0F\u306E\u30B9\u30AF\u30EA\u30FC\u30F3\u30B7\u30E7\u30C3\u30C8\u3092\u4F7F\u7528\u3057\u3066\u304F\u3060\u3055\u3044\u3002`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`\u753B\u50CF\u30B5\u30A4\u30BA\u304C\u5927\u304D\u3059\u304E\u307E\u3059\uFF08${(file.size / 1024 / 1024).toFixed(1)} MB\uFF09\u300216 MB \u4EE5\u4E0B\u306E\u753B\u50CF\u3092\u4F7F\u7528\u3057\u3066\u304F\u3060\u3055\u3044\u3002`);
  }
  const buf = await file.arrayBuffer();
  const uint8 = new Uint8Array(buf);
  let binaryStr = "";
  for (let i = 0; i < uint8.length; i += 8192) {
    binaryStr += String.fromCharCode(...uint8.subarray(i, i + 8192));
  }
  const b64 = btoa(binaryStr);
  const prompt = `\u3053\u306E\u30B9\u30AF\u30EA\u30FC\u30F3\u30B7\u30E7\u30C3\u30C8\u306F\u8CC7\u7523\u7BA1\u7406\u30A2\u30D7\u30EA\u306E\u4FDD\u6709\u8CC7\u7523\u4E00\u89A7\u3067\u3059\u3002
\u753B\u50CF\u304B\u3089\u4FDD\u6709\u8CC7\u7523\u3092\u62BD\u51FA\u3057\u3001\u5FC5\u305A\u4EE5\u4E0B\u306EJSON\u5F62\u5F0F\u306E\u307F\u3067\u56DE\u7B54\u3057\u3066\u304F\u3060\u3055\u3044\uFF08\u8AAC\u660E\u6587\u4E0D\u8981\uFF09:
{"assets":[{"symbol":"\u30B3\u30FC\u30C9or\u30C6\u30A3\u30C3\u30AB\u30FC","name":"\u9298\u67C4\u540D","shares":\u4FDD\u6709\u6570,"avgCost":\u5E73\u5747\u53D6\u5F97\u5358\u4FA1,"price":\u73FE\u5728\u5024or\u57FA\u6E96\u4FA1\u984D,"value":\u6642\u4FA1\u8A55\u4FA1\u984D,"category":"\u65E5\u672C\u682A|\u7C73\u56FD\u682A|\u6295\u8CC7\u4FE1\u8A17|\u305D\u306E\u4ED6"}]}

\u6CE8\u610F:
- \u6570\u5024\u306F\u30AB\u30F3\u30DE\u3084\u901A\u8CA8\u8A18\u53F7\u3092\u9664\u3044\u305F\u6570\u5024\u306E\u307F\uFF08\u4F8B: 1,234,567 \u2192 1234567\uFF09
- \u4E0D\u660E\u306A\u9805\u76EE\u306F 0 \u306B\u3059\u308B
- \u6295\u8CC7\u4FE1\u8A17\u306F\u300C\u4FDD\u6709\u53E3\u6570\u300D\u3092 shares\u3001\u300C\u57FA\u6E96\u4FA1\u984D\u300D\u3092 price\u3001\u300C\u5E73\u5747\u53D6\u5F97\u5358\u4FA1\u300D\u3092 avgCost\u3001\u300C\u6642\u4FA1\u8A55\u4FA1\u984D\u300D\u3092 value \u306B
- \u540C\u3058\u9298\u67C4\u304C\u8907\u6570\u884C\u3042\u308B\u5834\u5408\u306F\u305D\u308C\u305E\u308C\u5225\u30EC\u30B3\u30FC\u30C9\u3068\u3057\u3066\u62BD\u51FA\uFF08\u5408\u7B97\u306F\u5F8C\u6BB5\u3067\u3084\u308B\uFF09`;
  const body = {
    model: "gpt-4o",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
        { type: "text", text: prompt }
      ]
    }]
  };
  const res = await fetchWithTimeout(`${WORKER_URL}/ai/openai`, 3e4, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    let detail = "";
    try {
      const e = await res.json();
      detail = e?.error?.message || JSON.stringify(e);
    } catch {
    }
    throw new Error(`AI API \u30A8\u30E9\u30FC (${res.status})${detail ? `: ${detail}` : ""}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI\u306E\u30EC\u30B9\u30DD\u30F3\u30B9\u304B\u3089JSON\u3092\u62BD\u51FA\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u5225\u306E\u30B9\u30AF\u30EA\u30FC\u30F3\u30B7\u30E7\u30C3\u30C8\u3092\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002");
  const parsed = JSON.parse(m[0]);
  return (parsed.assets || []).map((a) => _mfAssetToPosition(a)).filter(Boolean);
}
function _mfAssetToPosition(a) {
  if (!a.name) return null;
  const name = String(a.name).trim();
  const cat = a.category === "\u7C73\u56FD\u682A" ? "\u7C73\u56FD\u682A\u30FBETF" : a.category === "\u6295\u8CC7\u4FE1\u8A17" ? "\u6295\u8CC7\u4FE1\u8A17" : "\u65E5\u672C\u682A\u30FBETF";
  const isJP = cat === "\u65E5\u672C\u682A\u30FBETF";
  const isFund = cat === "\u6295\u8CC7\u4FE1\u8A17";
  let sym = String(a.symbol || "").trim();
  if (!sym && isFund) {
    sym = fundSymbolFromName(name) || "";
  }
  if (!sym) sym = name;
  const proxy = isFund ? fundProxyOf(sym) ?? FUND_FALLBACK_PROXY : null;
  let shares = Number(a.shares) || 0;
  const avgCost = Number(a.avgCost) || 0;
  let price = Number(a.price) || 0;
  let value = Number(a.value) || 0;
  if (isFund && shares > 0) {
    if (value > 0 && avgCost > 0) {
      if (shares * avgCost > value * 1e3) shares = shares / 1e4;
    } else if (shares >= 1e4) {
      shares = shares / 1e4;
    }
  }
  if (value === 0 && shares > 0 && avgCost > 0) value = shares * avgCost;
  if (price === 0 && avgCost > 0) price = avgCost;
  const pnl = price > 0 && avgCost > 0 && shares > 0 ? (price - avgCost) * shares : 0;
  const pnlPct = avgCost > 0 && shares > 0 ? pnl / (avgCost * shares) * 100 : 0;
  return {
    symbol: sym,
    name,
    cat,
    shares,
    price,
    avgCost,
    value,
    pnl,
    pnlPct,
    dayPct: null,
    dayCh: null,
    cur: cat === "\u7C73\u56FD\u682A\u30FBETF" ? "USD" : "JPY",
    ySymbol: isFund ? proxy.ySymbol : isJP ? `${sym.replace(/\.T$/i, "")}.T` : sym,
    ...isFund ? { isProxy: true, proxyName: proxy.proxyName } : {}
  };
}

// src/import-ui.js
var _importState = { source: null, parsed: [], current: [], pendingPositions: [] };
var _importGen = 0;
function openImportModal(source) {
  _importGen++;
  _importState = { source, parsed: [], current: [...positions] };
  const overlay = document.getElementById("import-modal-overlay");
  const title = document.getElementById("import-modal-title");
  if (!overlay) return;
  title.textContent = source === "manex" ? "\u30DE\u30CD\u30C3\u30AF\u30B9\u8A3C\u5238 \u53D6\u8FBC" : "\u30DE\u30CD\u30FC\u30D5\u30A9\u30EF\u30FC\u30C9 \u53D6\u8FBC";
  _renderImportStep("select");
  overlay.style.display = "flex";
  requestAnimationFrame(() => overlay.classList.add("open"));
}
function openManagePositionsModal() {
  _importGen++;
  const normalized = positions.map(canonicalizeFundPosition);
  _importState = { source: "manage", parsed: normalized, current: [...positions] };
  const overlay = document.getElementById("import-modal-overlay");
  const title = document.getElementById("import-modal-title");
  if (!overlay) return;
  title.textContent = "\u4FDD\u6709\u9298\u67C4\u3092\u6574\u7406";
  _renderImportStep("review");
  overlay.style.display = "flex";
  requestAnimationFrame(() => overlay.classList.add("open"));
}
function closeImportModal() {
  _importGen++;
  const overlay = document.getElementById("import-modal-overlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  setTimeout(() => {
    overlay.style.display = "none";
  }, 220);
  _importState = { source: null, parsed: [], current: [] };
}
function handleImportOverlayClick(e) {
  if (e.target === document.getElementById("import-modal-overlay")) closeImportModal();
}
function focusImportFileInput() {
  const isManex = _importState.source === "manex";
  const inputId = isManex ? "import-manex-input" : "import-mf-input";
  document.getElementById(inputId)?.click();
}
function _renderImportStep(step, payload) {
  const body = document.getElementById("import-modal-body");
  if (!body) return;
  if (step === "select") {
    const isManex = _importState.source === "manex";
    body.innerHTML = `
      <div class="import-select-area" id="import-drop-zone">
        <div class="import-icon">${isManex ? "\u{1F4C4}" : "\u{1F4F7}"}</div>
        <div class="import-select-title">${isManex ? "CSV\u30D5\u30A1\u30A4\u30EB\u3092\u9078\u629E" : "\u30B9\u30AF\u30EA\u30FC\u30F3\u30B7\u30E7\u30C3\u30C8\u3092\u9078\u629E"}</div>
        <div class="import-select-hint">${isManex ? "\u56FD\u5185\u682A\u30FB\u7C73\u56FD\u682A\u30FB\u6295\u8CC7\u4FE1\u8A17\u306E3\u30D5\u30A1\u30A4\u30EB\u307E\u3068\u3081\u3066\u9078\u629E\u3067\u304D\u307E\u3059" : "\u30DE\u30CD\u30FC\u30D5\u30A9\u30EF\u30FC\u30C9\u306E\u8CC7\u7523\u4E00\u89A7\u753B\u9762\u306E\u30B9\u30AF\u30B7\u30E7"}</div>
        <button class="import-file-btn" data-action="focusImportFileInput">
          \u30D5\u30A1\u30A4\u30EB\u3092\u9078\u629E
        </button>
      </div>`;
  }
  if (step === "loading") {
    body.innerHTML = `
      <div class="import-loading">
        <div class="import-spinner"></div>
        <div class="import-loading-text">${payload || "\u89E3\u6790\u4E2D..."}</div>
      </div>`;
  }
  if (step === "error") {
    body.innerHTML = `
      <div class="import-error-msg">
        <div>\u26A0\uFE0F ${escapeHTML2(payload || "\u89E3\u6790\u306B\u5931\u6557\u3057\u307E\u3057\u305F")}</div>
        <button class="import-file-btn" style="margin-top:12px" data-action="_renderImportStep" data-arg="select">\u3084\u308A\u76F4\u3059</button>
      </div>`;
  }
  if (step === "review") {
    let html = `<div class="import-review">`;
    if (_importState.source === "manage") {
      html += `<div class="import-review-summary">\u4FDD\u6709\u9298\u67C4 ${_importState.parsed.length}\u4EF6 \xB7 <span style="color:var(--text2);font-weight:400">\u30C1\u30A7\u30C3\u30AF\u3092\u5916\u3059\u3068\u524A\u9664\u3055\u308C\u307E\u3059</span></div>`;
      html += `<div class="import-list">`;
      _importState.parsed.forEach((p, i) => {
        html += _importRow(p, "same", true, null, i);
      });
      html += `</div>`;
    } else {
      const { added, removed, changed } = computeImportDiff(
        _importState.current,
        _importState.parsed
      );
      const symCount = {};
      _importState.parsed.forEach((p) => {
        symCount[p.symbol] = (symCount[p.symbol] || 0) + 1;
      });
      const dupSymCount = Object.values(symCount).filter((n) => n > 1).length;
      html += `<div class="import-review-summary">${_importState.parsed.length}\u9298\u67C4\u3092\u691C\u51FA`;
      if (added.length) html += ` \xB7 <span class="imp-badge new">${added.length}\u4EF6\u65B0\u898F</span>`;
      if (changed.length) html += ` \xB7 <span class="imp-badge chg">${changed.length}\u4EF6\u5909\u66F4</span>`;
      if (dupSymCount) html += ` \xB7 <span class="imp-badge chg">${dupSymCount}\u9298\u67C4\u306B\u91CD\u8907\u884C\u3042\u308A\uFF08\u4FDD\u5B58\u6642\u306B\u5408\u7B97\uFF09</span>`;
      html += `</div>`;
      const addedSyms = new Set(added.map((p) => p.symbol));
      const changedKeys = new Set(changed.map((p) => p.symbol));
      html += `<div class="import-list">`;
      _importState.parsed.forEach((p, idx) => {
        let type = "same";
        let hint = "";
        if (addedSyms.has(p.symbol)) {
          type = "new";
        } else if (changedKeys.has(p.symbol)) {
          type = "chg";
          const cur = _importState.current.find((c) => c.symbol === p.symbol);
          if (cur) hint = `${cur.shares}\u2192${p.shares}\u682A / @${cur.avgCost}\u2192@${p.avgCost}`;
        }
        html += _importRow(p, type, true, hint, idx);
      });
      html += `</div>`;
      if (removed.length > 0) {
        html += `<details class="import-kept-section">
          <summary class="import-kept-title">\u4ECA\u56DE\u306E\u30D5\u30A1\u30A4\u30EB\u306B\u306A\u3044\u65E2\u5B58\u9298\u67C4 (${removed.length}\u4EF6) \u2014 \u30C7\u30D5\u30A9\u30EB\u30C8\u3067\u4FDD\u6301</summary>
          <div class="import-kept-note">\u30C1\u30A7\u30C3\u30AF\u3059\u308B\u3068\u524A\u9664\u3055\u308C\u307E\u3059\u3002\u30C1\u30A7\u30C3\u30AF\u306A\u3057 = \u305D\u306E\u307E\u307E\u6B8B\u3059</div>
          <div class="import-list">`;
        for (const p of removed) html += _importRow(p, "del", false);
        html += `</div></details>`;
      }
    }
    const confirmLabel = _importState.source === "manage" ? "\u4FDD\u5B58 \u2192" : "\u53D6\u8FBC\u78BA\u5B9A \u2192";
    html += `<div class="import-footer">
      <button class="import-cancel-btn" data-action="closeImportModal">\u30AD\u30E3\u30F3\u30BB\u30EB</button>
      <button class="import-confirm-btn" data-action="_confirmImport">${confirmLabel}</button>
    </div>`;
    html += `</div>`;
    body.innerHTML = html;
  }
  if (step === "pin-auth") {
    body.innerHTML = `
      <div class="import-pin-auth">
        <div class="import-pin-msg">\u{1F512} PIN\u8A8D\u8A3C\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002PIN\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002</div>
        <input type="password" id="import-pin-input" class="import-pin-input"
          inputmode="numeric" maxlength="6" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022">
        <div class="import-footer">
          <button class="import-cancel-btn" data-action="closeImportModal">\u30AD\u30E3\u30F3\u30BB\u30EB</button>
          <button class="import-confirm-btn" data-action="_retryWithPin">\u4FDD\u5B58\u3059\u308B \u2192</button>
        </div>
      </div>`;
    requestAnimationFrame(() => {
      const pinInput = document.getElementById("import-pin-input");
      if (pinInput) {
        pinInput.focus();
        pinInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") _retryWithPin();
        });
      }
    });
  }
  if (step === "saving") {
    body.innerHTML = `
      <div class="import-loading">
        <div class="import-spinner"></div>
        <div class="import-loading-text">\u4FDD\u5B58\u4E2D...</div>
      </div>`;
  }
  if (step === "done") {
    body.innerHTML = `
      <div class="import-done">
        <div class="import-done-icon">\u2713</div>
        <div class="import-done-text">${escapeHTML2(payload || "\u53D6\u8FBC\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F")}</div>
        <button class="import-confirm-btn" data-action="closeImportModal">\u9589\u3058\u308B</button>
      </div>`;
  }
}
function _importRow(p, type, checked, hint, idx) {
  const label = { new: "\u65B0\u898F", chg: "\u5909\u66F4", same: "", del: "\u524A\u9664\u4E88\u5B9A" }[type];
  const badgeHtml = label ? `<span class="imp-badge ${type}">${label}</span>` : "";
  const hintHtml = hint ? `<span class="imp-row-hint">${escapeHTML2(hint)}</span>` : "";
  const idxAttr = idx != null ? ` data-idx="${idx}"` : "";
  return `<label class="import-row">
    <input type="checkbox" class="import-cb" data-symbol="${escapeHTML2(p.symbol)}"
      data-type="${type}"${idxAttr} ${checked ? "checked" : ""}>
    <span class="imp-sym">${escapeHTML2(p.symbol)}</span>
    <span class="imp-name">${escapeHTML2(p.name)}</span>
    ${hintHtml}
    ${badgeHtml}
    <span class="imp-meta">${escapeHTML2(p.shares)}\u682A @${escapeHTML2(p.avgCost)}</span>

  </label>`;
}
async function _confirmImport() {
  const body = document.getElementById("import-modal-body");
  const cbs = body?.querySelectorAll(".import-cb");
  if (!cbs) return;
  let finalPositions;
  if (_importState.source === "manage") {
    const keepIdx = new Set(
      [...cbs].filter((cb) => cb.checked && cb.dataset.idx != null).map((cb) => Number(cb.dataset.idx))
    );
    finalPositions = _importState.parsed.filter((_, i) => keepIdx.has(i));
  } else {
    const parsedKeepIdx = new Set(
      [...cbs].filter((cb) => cb.checked && cb.dataset.type !== "del" && cb.dataset.idx != null).map((cb) => Number(cb.dataset.idx))
    );
    const delSymbols = new Set(
      [...cbs].filter((cb) => cb.checked && cb.dataset.type === "del").map((cb) => cb.dataset.symbol)
    );
    const newPositions = _importState.parsed.filter((_, i) => parsedKeepIdx.has(i));
    const incomingSymbols = new Set(newPositions.map((p) => p.symbol));
    const oldKept = _importState.current.filter(
      (p) => !incomingSymbols.has(p.symbol) && !delSymbols.has(p.symbol)
    );
    finalPositions = [...newPositions, ...oldKept];
  }
  finalPositions = finalPositions.map(canonicalizeFundPosition);
  finalPositions = mergeDuplicatePositions(finalPositions);
  const gen = _importGen;
  _importState.pendingPositions = finalPositions;
  _renderImportStep("saving");
  await _doSavePositions(finalPositions, void 0, gen);
}
async function _doSavePositions(finalPositions, pinHashOverride, gen) {
  const stale = () => gen !== void 0 && gen !== _importGen;
  try {
    await savePositionsToKV(finalPositions, pinHashOverride);
    positions.splice(0, positions.length, ...finalPositions);
    await clearHistoricalIDB();
    clearCacheSession();
    state.lastUpdateText = null;
    if (!stale()) _renderImportStep("done", `${finalPositions.length}\u9298\u67C4\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F`);
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent("hm:prices-updated"));
      renderStockList();
      renderWatchlist();
      refreshPrices();
    }, 300);
  } catch (e) {
    if (stale()) return;
    if (e.message.includes("PIN\u8A8D\u8A3C\u5931\u6557")) {
      _renderImportStep("pin-auth");
    } else if (e.name === "AbortError" || e.message.includes("aborted")) {
      _renderImportStep("error", "\u4FDD\u5B58\u304C\u30BF\u30A4\u30E0\u30A2\u30A6\u30C8\u3057\u307E\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002");
    } else {
      _renderImportStep("error", `\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ${e.message}`);
    }
  }
}
async function _retryWithPin() {
  const gen = _importGen;
  const pinInput = document.getElementById("import-pin-input");
  const pin = pinInput?.value?.trim();
  if (!pin) {
    if (pinInput) pinInput.focus();
    return;
  }
  const pinHash = await _hashPin(pin);
  if (gen !== _importGen) return;
  const finalPositions = _importState.pendingPositions;
  if (!finalPositions?.length) {
    closeImportModal();
    return;
  }
  _renderImportStep("saving");
  await _doSavePositions(finalPositions, pinHash, gen);
  if (gen === _importGen) localStorage.setItem("hm-pin-hash", pinHash);
}
async function handleManexFileSelect(event) {
  const gen = _importGen;
  const files = Array.from(event.target.files || []);
  event.target.value = "";
  if (files.length === 0) return;
  _renderImportStep("loading", "CSV\u3092\u89E3\u6790\u4E2D...");
  const parsed = await parseManexFiles(files);
  if (gen !== _importGen) return;
  if (!parsed || parsed.length === 0) {
    _renderImportStep("error", "CSV\u3092\u89E3\u6790\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u30DE\u30CD\u30C3\u30AF\u30B9\u8A3C\u5238\u306ECSV\u30D5\u30A1\u30A4\u30EB\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    return;
  }
  _importState.parsed = parsed;
  _renderImportStep("review");
}
async function handleMoneyForwardImageSelect(event) {
  const gen = _importGen;
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  _renderImportStep("loading", "AI\u3067\u8CC7\u7523\u60C5\u5831\u3092\u8AAD\u307F\u53D6\u308A\u4E2D...");
  try {
    const parsed = await parseMoneyForwardImage(file);
    if (gen !== _importGen) return;
    if (parsed.length === 0) {
      _renderImportStep("error", "AI\u304C\u8CC7\u7523\u60C5\u5831\u3092\u691C\u51FA\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u8CC7\u7523\u4E00\u89A7\u304C\u5199\u3063\u305F\u30B9\u30AF\u30EA\u30FC\u30F3\u30B7\u30E7\u30C3\u30C8\u3092\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002");
      return;
    }
    _importState.parsed = parsed;
    _renderImportStep("review");
  } catch (e) {
    if (gen !== _importGen) return;
    console.error("[import-ui] MF image handler error:", e);
    _renderImportStep("error", e.message);
  }
}
function escapeHTML2(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// src/menu.js
function toggleHmMenu() {
  const dropdown = document.getElementById("hm-menu-dropdown");
  const btn = document.getElementById("hm-menu-btn");
  if (!dropdown) return;
  const isOpen = dropdown.classList.toggle("open");
  if (btn) {
    btn.classList.toggle("open", isOpen);
    btn.setAttribute("aria-expanded", String(isOpen));
  }
}
function closeHmMenu() {
  const dropdown = document.getElementById("hm-menu-dropdown");
  const btn = document.getElementById("hm-menu-btn");
  if (!dropdown) return;
  dropdown.classList.remove("open");
  if (btn) {
    btn.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
  }
}

// src/data-topholdings.js
var YAHOO_SECTOR_MAP = {
  technology: "tech",
  financial_services: "financials",
  healthcare: "healthcare",
  consumer_cyclical: "consumer",
  consumer_defensive: "staples",
  industrials: "industrials",
  energy: "energy",
  basic_materials: "materials",
  communication_services: "comm",
  utilities: "utilities",
  realestate: "realestate"
};
var TOPHOLDINGS_ALLOWLIST = ["\u30AA\u30EB\u30AB\u30F3", "1306"];
var STORAGE_KEY = "hm-topholdings";
async function fetchTopHoldingsSector(ySymbol) {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySymbol)}?modules=topHoldings`;
  try {
    const data = await fetchViaProxy(url);
    const weightings = data?.quoteSummary?.result?.[0]?.topHoldings?.sectorWeightings;
    if (!Array.isArray(weightings) || weightings.length === 0) return null;
    const result = {};
    for (const entry of weightings) {
      for (const [yahooKey, val] of Object.entries(entry)) {
        const ourKey = YAHOO_SECTOR_MAP[yahooKey];
        if (!ourKey) continue;
        const weight = typeof val === "object" ? val.raw : Number(val);
        if (typeof weight === "number" && weight > 0) {
          result[ourKey] = (result[ourKey] || 0) + weight;
        }
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch (e) {
    console.warn(`[topholdings] fetchTopHoldingsSector(${ySymbol}) failed:`, e);
    return null;
  }
}
async function loadTopHoldings() {
  try {
    const cached = sessionStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      Object.assign(state.liveTopHoldings, parsed);
      return;
    }
  } catch {
  }
  for (const symbol of TOPHOLDINGS_ALLOWLIST) {
    const pos = positions.find((p) => p.symbol === symbol);
    if (!pos?.ySymbol) continue;
    const sector = await fetchTopHoldingsSector(pos.ySymbol);
    if (sector) {
      state.liveTopHoldings[symbol] = {
        sector,
        asOf: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  }
  try {
    if (Object.keys(state.liveTopHoldings).length > 0) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.liveTopHoldings));
    }
  } catch {
  }
}

// src/constituents-cache.js
var DB_NAME2 = "hm-constituents";
var DB_VERSION2 = 1;
var STORE_NAME2 = "constituents";
var STALE_DAYS = 7;
var _dbPromise2 = null;
function getDb2() {
  if (!_dbPromise2) {
    _dbPromise2 = openDb(DB_NAME2, DB_VERSION2, (db) => {
      if (!db.objectStoreNames.contains(STORE_NAME2)) {
        db.createObjectStore(STORE_NAME2);
      }
    }).catch((e) => {
      _dbPromise2 = null;
      throw e;
    });
  }
  return _dbPromise2;
}
function isStale(asOf, days = STALE_DAYS) {
  if (!asOf) return true;
  const t = Date.parse(asOf);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > days * 24 * 60 * 60 * 1e3;
}
async function restoreConstituentsFromIDB() {
  try {
    const db = await getDb2();
    const all = await idbGetAllEntries(db, STORE_NAME2);
    let n = 0;
    for (const { key, value } of all) {
      if (!value || !Array.isArray(value.holdings)) continue;
      const symbol = String(key);
      if (state.liveConstituents[symbol]) continue;
      state.liveConstituents[symbol] = value;
      n++;
    }
    return n;
  } catch (e) {
    console.warn("[constituents-cache] restore failed:", e);
    return 0;
  }
}
async function setConstituentEntry(symbol, entry) {
  try {
    const db = await getDb2();
    await idbPut(db, STORE_NAME2, symbol, entry);
  } catch (e) {
    console.warn(`[constituents-cache] set(${symbol}) failed:`, e);
  }
}

// src/data-stock-profile.js
var FINNHUB_INDUSTRY_MAP = {
  "technology": "tech",
  "software": "tech",
  "internet": "tech",
  "it services": "tech",
  "semiconductors": "semis",
  "banking": "financials",
  "financial services": "financials",
  "insurance": "financials",
  "diversified financials": "financials",
  "healthcare": "healthcare",
  "health care": "healthcare",
  "pharmaceuticals": "healthcare",
  "biotechnology": "healthcare",
  "retail": "consumer",
  "automobiles": "consumer",
  "auto components": "consumer",
  "hotels restaurants & leisure": "consumer",
  "textiles apparel & luxury goods": "consumer",
  "consumer products": "consumer",
  "leisure products": "consumer",
  "food products": "staples",
  "beverages": "staples",
  "tobacco": "staples",
  "household products": "staples",
  "industrial conglomerates": "industrials",
  "machinery": "industrials",
  "aerospace & defense": "industrials",
  "logistics & transportation": "industrials",
  "electrical equipment": "industrials",
  "building": "industrials",
  "commercial services & supplies": "industrials",
  "trading companies & distributors": "industrials",
  "airlines": "industrials",
  "energy": "energy",
  "oil & gas": "energy",
  "chemicals": "materials",
  "metals & mining": "materials",
  "basic materials": "materials",
  "construction materials": "materials",
  "paper & forest": "materials",
  "media": "comm",
  "telecommunication": "comm",
  "communications": "comm",
  "entertainment": "comm",
  "utilities": "utilities",
  "real estate": "realestate"
};
var FINNHUB_COUNTRY_MAP = {
  US: "us",
  JP: "japan",
  CN: "china",
  HK: "china",
  BR: "latam",
  MX: "latam",
  AR: "latam",
  CL: "latam",
  CO: "latam",
  PE: "latam",
  GB: "europe",
  DE: "europe",
  FR: "europe",
  CH: "europe",
  NL: "europe",
  IT: "europe",
  ES: "europe",
  SE: "europe",
  NO: "europe",
  DK: "europe",
  FI: "europe",
  BE: "europe",
  AT: "europe",
  IE: "europe",
  PT: "europe",
  IN: "em",
  ID: "em",
  TH: "em",
  TR: "em",
  ZA: "em",
  KR: "em",
  TW: "em",
  MY: "em",
  PH: "em",
  VN: "em",
  PL: "em",
  SA: "em",
  AE: "em"
};
function mapFinnhubIndustry(industry) {
  if (!industry) return null;
  const key = industry.trim().toLowerCase();
  if (FINNHUB_INDUSTRY_MAP[key]) return FINNHUB_INDUSTRY_MAP[key];
  for (const [k, v] of Object.entries(FINNHUB_INDUSTRY_MAP)) {
    if (key.includes(k)) return v;
  }
  return null;
}
function mapFinnhubCountry(country) {
  if (!country) return null;
  return FINNHUB_COUNTRY_MAP[country.trim().toUpperCase()] || null;
}
function buildStockConstituent(profile, symbol, cur) {
  const sector = mapFinnhubIndustry(profile?.finnhubIndustry);
  const country = mapFinnhubCountry(profile?.country);
  if (!sector && !country) return null;
  const holding = {
    ticker: symbol,
    name: symbol,
    weight: 1,
    currency: cur === "USD" ? "USD" : cur === "JPY" ? "JPY" : cur || "",
    assetClass: "equity"
  };
  if (sector) holding.sector = sector;
  if (country) holding.country = country;
  return { holdings: [holding], asOf: (/* @__PURE__ */ new Date()).toISOString(), source: "finnhub" };
}
async function fetchStockProfile(ySymbol) {
  const fSym = toFinnhubSymbol(ySymbol);
  const url = `${WORKER_URL}/finnhub?path=/stock/profile2&symbol=${encodeURIComponent(fSym)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.finnhubIndustry && !data.country) return null;
    return data;
  } catch (e) {
    console.warn(`[stock-profile] fetchStockProfile(${ySymbol}) failed:`, e);
    return null;
  }
}
async function loadStockProfiles(posList = positions) {
  for (const p of posList) {
    const symbol = p.symbol;
    if (!symbol || !p.ySymbol) continue;
    if (p.isProxy) continue;
    if (symbol.includes("\u73FE\u91D1")) continue;
    if (CONSTITUENTS[symbol]) continue;
    const existing = state.liveConstituents[symbol];
    if (existing && !isStale(existing.asOf)) continue;
    const profile = await fetchStockProfile(p.ySymbol);
    if (!profile) continue;
    const entry = buildStockConstituent(profile, symbol, p.cur);
    if (entry) {
      state.liveConstituents[symbol] = entry;
      setConstituentEntry(symbol, entry);
    }
  }
}

// src/ptr.js
if ("ontouchstart" in window) {
  let touchInScrollable = function(el) {
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight + 2) {
        const oy = window.getComputedStyle(el).overflowY;
        if (oy === "auto" || oy === "scroll") return true;
      }
      el = el.parentElement;
    }
    return false;
  }, getIndicator = function() {
    if (indicator) return indicator;
    indicator = document.createElement("div");
    indicator.id = "ptr-indicator";
    indicator.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "z-index:99999",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "height:0",
      "overflow:hidden",
      "transition:none",
      "background:var(--surface)",
      "pointer-events:none"
    ].join(";");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "24");
    svg.setAttribute("height", "24");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.style.cssText = "transition:transform 0.05s linear;color:var(--text2);will-change:transform;";
    svg.innerHTML = `
      <path d="M12 4V1L8 5l4 4V6a6 6 0 1 1-5.66 7.99L4.68 13A8 8 0 1 0 12 4z"
            fill="currentColor"/>`;
    arrow = svg;
    indicator.appendChild(svg);
    if (!document.getElementById("ptr-style")) {
      const st = document.createElement("style");
      st.id = "ptr-style";
      st.textContent = "@keyframes ptr-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}";
      document.head.appendChild(st);
    }
    document.body.prepend(indicator);
    return indicator;
  }, collapseIndicator = function() {
    if (!indicator) return;
    indicator.style.transition = "height 0.2s ease";
    indicator.style.height = "0";
    if (arrow) {
      arrow.style.transition = "none";
      arrow.style.animation = "none";
      arrow.style.transform = "rotate(0deg)";
    }
  };
  const THRESHOLD = 72;
  let startY = 0;
  let pulling = false;
  let indicator = null;
  let arrow = null;
  const atTop = () => (window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0) <= 0;
  document.addEventListener("touchstart", (e) => {
    pulling = atTop() && !touchInScrollable(e.target);
    startY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (!pulling) return;
    const delta = e.touches[0].clientY - startY;
    if (delta <= 0) return;
    const ind = getIndicator();
    ind.style.transition = "none";
    ind.style.height = `${Math.min(delta * 0.55, 56)}px`;
    const progress = Math.min(delta / THRESHOLD, 1);
    if (arrow) {
      arrow.style.transition = "none";
      arrow.style.animation = "none";
      arrow.style.transform = `rotate(${Math.round(progress * 360)}deg)`;
      arrow.style.opacity = 0.4 + progress * 0.6;
      arrow.style.color = progress >= 1 ? "var(--accent)" : "var(--text2)";
    }
  }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (!pulling) return;
    const delta = e.changedTouches[0].clientY - startY;
    pulling = false;
    if (delta >= THRESHOLD) {
      if (arrow) {
        arrow.style.transition = "none";
        arrow.style.animation = "ptr-spin 0.5s linear infinite";
        arrow.style.opacity = "1";
        arrow.style.color = "var(--accent)";
      }
      setTimeout(() => location.reload(), 650);
    } else {
      collapseIndicator();
    }
  }, { passive: true });
  document.addEventListener("touchcancel", () => {
    pulling = false;
    collapseIndicator();
  }, { passive: true });
}

// src/app.js
window.renderHeatmap = renderHeatmap;
async function refreshNow() {
  try {
    await refreshPrices();
  } catch (e) {
    console.warn("[refreshNow]", e);
    setStatus("\u30E9\u30A4\u30D6\u4FA1\u683C\u53D6\u5F97\u30A8\u30E9\u30FC\uFF08\u524D\u56DE\u30C7\u30FC\u30BF\u3067\u8868\u793A\u4E2D\uFF09", "yellow");
  }
}
window.refreshNow = refreshNow;
setPasskeySuccessCallback(_showChangePinButton);
function toggleStats() {
  state.statsMasked = !state.statsMasked;
  try {
    localStorage.setItem("hm-stats-masked", state.statsMasked ? "1" : "0");
  } catch {
  }
  renderStats();
  const eye = document.getElementById("stats-eye");
  if (eye) eye.classList.toggle("hidden", state.statsMasked);
  const eyeSlash = document.getElementById("eye-slash");
  if (eyeSlash) eyeSlash.style.display = state.statsMasked ? "" : "none";
  requestAnimationFrame(updateActiveTableHeight);
}
function applyTheme() {
  let resolved = state.themeMode;
  if (resolved === "auto") {
    resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.dataset.theme = resolved;
  const icons = { light: "\u263C", dark: "\u263E", auto: "A" };
  const iconEl = document.getElementById("theme-icon");
  if (iconEl) iconEl.textContent = icons[state.themeMode] ?? "A";
  const el = document.getElementById("theme-btn");
  el && (el.title = { light: "\u30E9\u30A4\u30C8\u30E2\u30FC\u30C9", dark: "\u30C0\u30FC\u30AF\u30E2\u30FC\u30C9", auto: "\u30B7\u30B9\u30C6\u30E0\u306B\u5408\u308F\u305B\u308B" }[state.themeMode]);
}
function cycleTheme() {
  const order = ["auto", "light", "dark"];
  state.themeMode = order[(order.indexOf(state.themeMode) + 1) % order.length];
  localStorage.setItem("hm-theme", state.themeMode);
  applyTheme();
  renderHeatmap();
  const overlay = document.getElementById("modal-overlay");
  if (overlay && overlay.style.display !== "none" && state.currentPos?.ySymbol) {
    loadChart(state.currentPos.ySymbol, state.currentRange);
  }
}
async function triggerPortfolioSnapshot() {
  const confirmed = await showConfirm({
    title: "\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u4FDD\u5B58",
    message: "\u73FE\u5728\u306E\u30DD\u30FC\u30C8\u30D5\u30A9\u30EA\u30AA\u3092 GitHub \u306B\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u4FDD\u5B58\u3057\u307E\u3059\u3002\n\uFF08data/portfolio-snapshot.json \u304C\u66F4\u65B0\u3055\u308C\u307E\u3059\uFF09",
    okLabel: "\u4FDD\u5B58",
    cancelLabel: "\u30AD\u30E3\u30F3\u30BB\u30EB"
  });
  if (!confirmed) return;
  try {
    setStatus("\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u4F5C\u6210\u4E2D...", "yellow");
    const payload = _buildPortfolioSnapshotPayload();
    const res = await fetch(`${WORKER_URL}/portfolio/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    setStatus(`\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u4FDD\u5B58\u5B8C\u4E86\uFF08${data.positions} \u9298\u67C4\uFF09`, "green");
    await showAlert({
      title: "\u4FDD\u5B58\u5B8C\u4E86",
      message: `https://github.com/shoulang0729/portfolio/blob/main/data/portfolio-snapshot.json

\u53CD\u6620\u307E\u3067 raw.githubusercontent.com \u5074\u3067\u6700\u59275\u5206\u306E\u30AD\u30E3\u30C3\u30B7\u30E5\u30E9\u30B0\u3042\u308A\u3002`,
      okLabel: "OK"
    });
  } catch (e) {
    setStatus(`\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u4FDD\u5B58\u5931\u6557: ${e.message}`, "red");
    await showAlert({
      title: "\u30A8\u30E9\u30FC",
      message: `\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u4FDD\u5B58\u5931\u6557:
${e.message}`,
      okLabel: "OK"
    });
  }
}
function _buildPortfolioSnapshotPayload() {
  const perfOf = (ySymbol) => {
    const perf = {};
    for (const period of PERIODS) {
      if (period.id === "1d") {
        const pos = positions.find((p) => p.ySymbol === ySymbol);
        perf["1d"] = pos?.dayPct ?? null;
      } else {
        perf[period.id] = getHistoricalChangePct(ySymbol, period.id);
      }
    }
    return perf;
  };
  const positionsWithPerf = positions.map((p) => ({
    ...p,
    performance: perfOf(p.ySymbol)
  }));
  const totalValue = positions.reduce((s, p) => s + (p.value || 0), 0);
  const totalPnl = positions.reduce((s, p) => s + (p.pnl || 0), 0);
  const portPerf = {};
  for (const period of PERIODS) {
    portPerf[period.id] = calcPortfolioPeriodPct(period.id);
  }
  const watchlistWithPerf = (state.watchlist || []).map((item) => {
    const ySymbol = item.ySymbol || item.symbol;
    const perf = {};
    for (const period of PERIODS) {
      if (period.id === "1d") {
        perf["1d"] = state.watchlistPrices?.[item.symbol]?.dayPct ?? null;
      } else {
        perf[period.id] = getHistoricalChangePct(ySymbol, period.id);
      }
    }
    return {
      symbol: item.symbol,
      name: item.name || item.symbol,
      ySymbol,
      cat: item.cat || null,
      cur: item.cur || null,
      performance: perf
    };
  });
  return {
    asOf: (/* @__PURE__ */ new Date()).toISOString(),
    source: "frontend-manual",
    summary: {
      totalValue,
      totalPnl,
      totalPnlPct: totalValue > totalPnl ? totalPnl / (totalValue - totalPnl) * 100 : null,
      positionCount: positions.length,
      watchlistCount: watchlistWithPerf.length,
      currencyBase: "JPY",
      performance: portPerf
    },
    positions: positionsWithPerf,
    watchlist: watchlistWithPerf
  };
}
function setColorModePnl() {
  if (state.colorMode === "pnl") {
    setChangePeriod(state.lastChangePeriod || "1d");
    return;
  }
  state.colorMode = "pnl";
  state.changePeriod = "";
  document.querySelectorAll(".period-btn[data-period]").forEach((b) => b.classList.remove("active"));
  document.getElementById("btn-pnl").classList.add("active");
  renderHeatmap();
}
async function setChangePeriod(periodId) {
  if (!periodId) return;
  state.lastChangePeriod = periodId;
  state.changePeriod = periodId;
  state.colorMode = "change";
  document.getElementById("btn-pnl").classList.remove("active");
  document.querySelectorAll(".period-btn[data-period]").forEach((b) => b.classList.toggle("active", b.dataset.period === periodId));
  renderHeatmap();
  const cfg = PERIOD_MAP[periodId];
  if (cfg && periodId !== "1d") {
    await fetchAllHistorical(cfg.range);
    renderHeatmap();
    renderStats();
  }
}
function fmtCountdown(sec) {
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
    return `\u6B21\u56DE\u66F4\u65B0: ${h}\u6642\u9593${m > 0 ? `${m}\u5206` : ""}\u5F8C`;
  }
  if (sec >= 60) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return `\u6B21\u56DE\u66F4\u65B0: ${m}\u5206${s > 0 ? `${s}\u79D2` : ""}\u5F8C`;
  }
  return `\u6B21\u56DE\u66F4\u65B0: ${sec}\u79D2`;
}
async function handleRefreshSelect(val) {
  clearInterval(state.autoInterval);
  clearInterval(state.countdownTimer);
  state.autoInterval = null;
  state.autoSec = 0;
  const cd = document.getElementById("countdown");
  cd.textContent = "";
  document.querySelectorAll(".hm-refresh-btn").forEach((b) => b.classList.toggle("active", b.dataset.val === val));
  if (val === "0") return;
  state.autoSec = parseInt(val);
  state.countdownVal = state.autoSec;
  cd.textContent = fmtCountdown(state.countdownVal);
  state.countdownTimer = setInterval(() => {
    if (document.visibilityState === "hidden") return;
    state.countdownVal--;
    cd.textContent = fmtCountdown(state.countdownVal);
    if (state.countdownVal <= 0) {
      state.countdownVal = state.autoSec;
      refreshPrices();
    }
  }, 1e3);
}
document.addEventListener("click", (e) => {
  const wrap = document.getElementById("hm-menu-wrap");
  if (wrap && !wrap.contains(e.target)) closeHmMenu();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.autoSec > 0) state.countdownVal = state.autoSec;
});
window.addEventListener("scroll", () => {
  const st = document.querySelector(".sticky-top");
  if (st) st.classList.toggle("stuck", window.scrollY > 2);
}, { passive: true });
function _setupMobileLayout() {
  const stickyTop = document.querySelector(".sticky-top");
  if (!stickyTop) return;
  const header = stickyTop.querySelector(".header");
  const refreshCtrlGroup = document.getElementById("refresh-switch") ? document.getElementById("refresh-switch").closest(".ctrl-group") : null;
  const refreshSwitch = document.getElementById("refresh-switch");
  const countdown = document.getElementById("countdown");
  const hmMenuWrap = document.getElementById("hm-menu-wrap");
  const statusLine = document.getElementById("status-line");
  const mobileRefresh = document.createElement("div");
  mobileRefresh.className = "mobile-refresh";
  const refreshTop = document.createElement("div");
  refreshTop.className = "mobile-refresh-top";
  if (refreshSwitch) refreshTop.appendChild(refreshSwitch);
  if (hmMenuWrap) refreshTop.appendChild(hmMenuWrap);
  const csvInput = document.getElementById("csv-import-input");
  const csvBtn = document.querySelector(".csv-btn");
  if (csvInput) refreshTop.appendChild(csvInput);
  if (csvBtn) refreshTop.appendChild(csvBtn);
  mobileRefresh.appendChild(refreshTop);
  const statusRow = document.createElement("div");
  statusRow.className = "mobile-status-row";
  if (countdown) statusRow.appendChild(countdown);
  if (statusLine) statusRow.appendChild(statusLine);
  mobileRefresh.appendChild(statusRow);
  if (header) header.appendChild(mobileRefresh);
  if (refreshCtrlGroup) refreshCtrlGroup.style.display = "none";
  stickyTop.querySelectorAll(".controls .divider").forEach((d) => d.style.display = "none");
}
var ACTION_MAP = {
  // app.js
  toggleStats,
  cycleTheme,
  toggleHmMenu,
  closeHmMenu,
  setChangePeriod,
  setColorModePnl,
  handleRefreshSelect,
  switchTab,
  triggerPortfolioSnapshot,
  // briefing.js
  reloadBriefing,
  // auth-ui.js
  authKeyPress,
  authBackspace,
  pcKeyPress,
  pcBackspace,
  openPinChange,
  closePinChange,
  // auth-passkey.js
  registerPasskey,
  authenticatePasskey,
  // chart.js
  setRange,
  closeModal,
  handleOverlayClick,
  // stock-list.js
  slSort,
  slToggleDetail,
  // watchlist.js
  wlSort,
  onWatchlistSearch,
  removeFromWatchlist,
  wlSelectItem,
  // import-ui.js
  openImportModal,
  closeImportModal,
  openManagePositionsModal,
  handleImportOverlayClick,
  handleManexFileSelect,
  handleMoneyForwardImageSelect,
  focusImportFileInput,
  _renderImportStep,
  _confirmImport,
  _retryWithPin
};
function _dispatchAction(el, event) {
  const actions = (el.dataset.action || "").split("|").filter(Boolean);
  const arg = el.dataset.arg !== void 0 ? el.dataset.arg : event;
  for (const name of actions) {
    const fn = ACTION_MAP[name];
    if (typeof fn !== "function") {
      console.warn(`[dispatch] unknown action: ${name}`);
      continue;
    }
    try {
      fn(arg, event);
    } catch (e) {
      console.error(`[dispatch] ${name} threw:`, e);
    }
  }
}
function _bindActionDispatcher() {
  const findAndDispatch = (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const wantType = el.dataset.event || "click";
    if (wantType !== e.type) return;
    _dispatchAction(el, e);
  };
  ["click", "input", "change"].forEach((t) => document.addEventListener(t, findAndDispatch));
}
function init() {
  _bindActionDispatcher();
  _setupMobileLayout();
  setupPriceUpdateListener();
  applyTheme();
  document.getElementById("btn-pnl").classList.remove("active");
  document.querySelectorAll(".period-btn[data-period]").forEach((b) => b.classList.toggle("active", b.dataset.period === "1d"));
  const panelList = document.getElementById("panel-list");
  const panelWatchlist = document.getElementById("panel-watchlist");
  const panelRisk = document.getElementById("panel-risk");
  const panelBriefing = document.getElementById("panel-briefing");
  const panelAi = document.getElementById("panel-ai");
  if (panelList) panelList.hidden = true;
  if (panelWatchlist) panelWatchlist.hidden = true;
  if (panelRisk) panelRisk.hidden = true;
  if (panelBriefing) panelBriefing.hidden = true;
  if (panelAi) panelAi.hidden = true;
  renderStats();
  loadMfHoldings().then(() => renderStats()).catch(() => {
  });
  const _eye = document.getElementById("stats-eye");
  if (_eye) _eye.classList.toggle("hidden", state.statsMasked);
  const _eyeSlash = document.getElementById("eye-slash");
  if (_eyeSlash) _eyeSlash.style.display = state.statsMasked ? "" : "none";
  updateSlColStyle();
  const _slEye = document.getElementById("sl-eye-btn");
  if (_slEye) _slEye.classList.toggle("hidden", !state.slDetailVisible);
  const _slSlash = document.getElementById("sl-eye-slash");
  if (_slSlash) _slSlash.style.display = state.slDetailVisible ? "none" : "";
  renderHeatmap();
  setStatus("\u8D77\u52D5\u4E2D...", "yellow");
  requestAnimationFrame(updateActiveTableHeight);
  try {
    const lastTab = localStorage.getItem("hm-active-tab");
    if (lastTab && lastTab !== "heatmap" && ["list", "watchlist", "risk", "briefing"].includes(lastTab)) {
      requestAnimationFrame(() => switchTab(lastTab));
    } else if (lastTab === "ai") {
      localStorage.removeItem("hm-active-tab");
    }
  } catch {
  }
  (async () => {
    try {
      await migrateFromSessionStorage();
      await restoreFromIDB();
      const loaded = await loadPositionsFromKV();
      if (loaded) {
        renderStats();
        renderHeatmap();
      }
      loadTopHoldings().then(() => {
        if (state.activeTab === "risk") renderRiskCharts();
      }).catch((e) => console.warn("[topholdings] loadTopHoldings failed:", e));
      restoreConstituentsFromIDB().then(() => {
        if (state.activeTab === "risk") renderRiskCharts();
      }).then(() => loadStockProfiles()).then(() => {
        if (state.activeTab === "risk") renderRiskCharts();
      }).catch((e) => console.warn("[stock-profile] loadStockProfiles failed:", e));
      applyPricesCache();
      try {
        await refreshPrices();
      } catch (e) {
        console.warn("[init] refreshPrices failed:", e);
        setStatus("\u30E9\u30A4\u30D6\u4FA1\u683C\u53D6\u5F97\u30A8\u30E9\u30FC\uFF08\u524D\u56DE\u30C7\u30FC\u30BF\u3067\u8868\u793A\u4E2D\uFF09", "yellow");
      } finally {
        hideHeatmapSkeleton();
        renderHeatmap();
      }
      await fetchAllHistorical("1y");
      renderStats();
      renderStockList();
      if (state.activeTab === "watchlist") {
        renderWatchlist();
        updateWatchlistHeight();
      }
      if (state.changePeriod && state.changePeriod !== "1d") renderHeatmap();
      await refreshHistoricalAndRender();
    } catch (e) {
      console.error("[init] startup data flow failed:", e);
      setStatus("\u521D\u671F\u5316\u306B\u5931\u6557\u3057\u307E\u3057\u305F\uFF08\u4FDD\u5B58\u6E08\u307F\u30C7\u30FC\u30BF\u3067\u8868\u793A\u4E2D\uFF09", "yellow");
      hideHeatmapSkeleton();
      renderHeatmap();
    }
  })();
}
setupEventListeners(applyTheme);
if (typeof window.d3 !== "undefined") {
  init();
}
(function() {
  const ver = (import.meta.url.match(/[?&]v=([^&]+)/) || [, "?"])[1];
  const title = document.querySelector(".title");
  if (title) {
    const badge = document.createElement("span");
    badge.id = "debug-ver";
    badge.style.cssText = "display:inline;font-size:9px;font-weight:400;color:var(--text2);opacity:0.6;margin-left:6px;vertical-align:bottom;";
    badge.textContent = `v.${ver}`;
    title.appendChild(badge);
  }
})();
