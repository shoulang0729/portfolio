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
  statsVisible: false,
  // 起動時はデフォルト非表示
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
  watchlist: JSON.parse(localStorage.getItem("hm-watchlist") || "[]"),
  watchlistPrices: {},
  // symbol → { price, dayPct }
  wlSortCol: "1d",
  // ウォッチリストのデフォルトソート列
  wlSortDir: "desc",
  prevPrices: {}
  // { ySymbol: price } 前回のライブ価格（フラッシュアニメーション用）
};

// src/auth-pin.js
var AUTH_PIN_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";
var AUTH_SESSION_KEY = "hm-auth-v1";
var AUTH_LS_HASH_KEY = "hm-pin-hash";
var AUTH_LOCKOUT_KEY = "hm-lockout";
var AUTH_PIN_LEN = 4;
var AUTH_MAX_FAIL = 5;
var AUTH_LOCK_SEC = 300;
function _getActivePinHash() {
  return localStorage.getItem(AUTH_LS_HASH_KEY) || AUTH_PIN_HASH;
}
var _auth = {
  input: "",
  fails: 0,
  lockedAt: null,
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
  return _auth.lockedAt && (Date.now() - _auth.lockedAt) / 1e3 < AUTH_LOCK_SEC;
}
function _lockRemain() {
  return Math.ceil(AUTH_LOCK_SEC - (Date.now() - _auth.lockedAt) / 1e3);
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
  if (_auth.lockedAt) {
    localStorage.setItem(AUTH_LOCKOUT_KEY, String(_auth.lockedAt));
  } else {
    localStorage.removeItem(AUTH_LOCKOUT_KEY);
  }
}
(function _loadLockout() {
  const stored = localStorage.getItem(AUTH_LOCKOUT_KEY);
  if (!stored) return;
  const ts = parseInt(stored, 10);
  if (isNaN(ts)) {
    localStorage.removeItem(AUTH_LOCKOUT_KEY);
    return;
  }
  if ((Date.now() - ts) / 1e3 < AUTH_LOCK_SEC) {
    _auth.lockedAt = ts;
  } else {
    localStorage.removeItem(AUTH_LOCKOUT_KEY);
  }
})();

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
  const exported = await crypto.subtle.exportKey("raw", _auth.encKey);
  sessionStorage.setItem(
    _AUTH_ENC_SS,
    btoa(String.fromCharCode(...new Uint8Array(exported)))
  );
}
async function _restoreEncKey() {
  const stored = sessionStorage.getItem(_AUTH_ENC_SS);
  if (!stored) return;
  const bytes = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  _auth.encKey = await crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

// src/config.js
var WORKER_URL = "https://portfolio-proxy.shoulang.workers.dev";

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
    alert("\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306F\u30D1\u30B9\u30AD\u30FC\u306B\u5BFE\u5FDC\u3057\u3066\u3044\u307E\u305B\u3093\u3002");
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: credential.id,
        publicKey: _u8ToB64url(publicKey),
        clientDataJSON: _u8ToB64url(new Uint8Array(response.clientDataJSON))
      })
    });
    if (!(await regRes.json()).ok) throw new Error("\u767B\u9332\u5931\u6557");
    alert("\u30D1\u30B9\u30AD\u30FC\u3092\u767B\u9332\u3057\u307E\u3057\u305F\u3002\u6B21\u56DE\u304B\u3089\u30D1\u30B9\u30AD\u30FC\u3067\u30ED\u30B0\u30A4\u30F3\u3067\u304D\u307E\u3059\u3002");
  } catch (e) {
    if (e.name !== "NotAllowedError") alert(`\u30D1\u30B9\u30AD\u30FC\u767B\u9332\u30A8\u30E9\u30FC: ${e.message}`);
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
      sessionStorage.setItem(_AUTH_ENC_SS, btoa(String.fromCharCode(...rawKey)));
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
function authKeyPress(n) {
  if (_isLocked()) {
    _showError(_lockRemainMessage());
    return;
  }
  if (_auth.input.length >= AUTH_PIN_LEN) return;
  _auth.input += n;
  _updateDots();
  _hideError();
  if (_auth.input.length === AUTH_PIN_LEN) _submitPin();
}
function authBackspace() {
  if (_isLocked()) return;
  if (_auth.input.length > 0) {
    _auth.input = _auth.input.slice(0, -1);
    _updateDots();
    _hideError();
  }
}
async function _submitPin() {
  _setKeypadEnabled(false);
  const hash = await _hashPin(_auth.input);
  if (hash === _getActivePinHash()) {
    _auth.fails = 0;
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
    _auth.input = "";
    _updateDots();
    _shake("shake");
    if (_auth.fails >= AUTH_MAX_FAIL) {
      _auth.lockedAt = Date.now();
      _saveLockout();
      _showError(`${AUTH_MAX_FAIL}\u56DE\u5931\u6557\u3002${_lockRemainMessage(AUTH_LOCK_SEC)}`);
      const _t = setInterval(() => {
        if (!_isLocked()) {
          clearInterval(_t);
          _auth.fails = 0;
          _auth.lockedAt = null;
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
  newPin: ""
};
var _pcStepLabel = ["", "\u73FE\u5728\u306EPIN", "\u65B0\u3057\u3044PIN\uFF084\u6841\uFF09", "\u65B0\u3057\u3044PIN\uFF08\u78BA\u8A8D\uFF09"];
var _pcStepHint = ["", "\u8A8D\u8A3C\u306E\u305F\u3081\u73FE\u5728\u306EPIN\u3092\u5165\u529B", "\u65B0\u3057\u30444\u6841\u306EPIN\u3092\u5165\u529B", "\u540C\u3058PIN\u3092\u3082\u3046\u4E00\u5EA6\u5165\u529B"];
function _pcUpdateDots() {
  document.querySelectorAll("#pc-dots .pin-dot").forEach((d, i) => d.classList.toggle("filled", i < _pc.input.length));
}
function _pcSetTitle() {
  const lbl = document.getElementById("pc-step-label");
  const hint = document.getElementById("pc-step-hint");
  const prog = document.querySelectorAll("#pc-progress .pc-prog-dot");
  if (lbl) lbl.textContent = _pcStepLabel[_pc.step];
  if (hint) hint.textContent = _pcStepHint[_pc.step];
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
function _pcSuccess() {
  const el = document.getElementById("pc-dots");
  if (el) {
    el.classList.add("success");
  }
  const lbl = document.getElementById("pc-step-label");
  const hint = document.getElementById("pc-step-hint");
  if (lbl) lbl.textContent = "\u2705 \u5909\u66F4\u5B8C\u4E86";
  if (hint) hint.textContent = "\u65B0\u3057\u3044PIN\u304C\u4FDD\u5B58\u3055\u308C\u307E\u3057\u305F";
  document.querySelectorAll("#pc-dots .pin-dot").forEach((d) => d.classList.add("filled"));
  document.querySelectorAll("#pc-overlay .pin-key").forEach((b) => {
    b.disabled = true;
  });
  setTimeout(() => closePinChange(), 1800);
}
function pcKeyPress(n) {
  if (_pc.input.length >= AUTH_PIN_LEN) return;
  _pc.input += n;
  _pcUpdateDots();
  _pcHideError();
  if (_pc.input.length === AUTH_PIN_LEN) _pcSubmit();
}
function pcBackspace() {
  if (_pc.input.length > 0) {
    _pc.input = _pc.input.slice(0, -1);
    _pcUpdateDots();
    _pcHideError();
  }
}
async function _pcSubmit() {
  document.querySelectorAll("#pc-overlay .pin-key").forEach((b) => {
    b.disabled = true;
  });
  const hash = await _hashPin(_pc.input);
  if (_pc.step === 1) {
    if (hash !== _getActivePinHash()) {
      _pc.input = "";
      _pcUpdateDots();
      _pcShake();
      _pcShowError("PIN\u304C\u9055\u3044\u307E\u3059");
      document.querySelectorAll("#pc-overlay .pin-key").forEach((b) => {
        b.disabled = false;
      });
      return;
    }
    _pc.step = 2;
    _pc.input = "";
    _pcUpdateDots();
    _pcSetTitle();
    _pcHideError();
    document.querySelectorAll("#pc-overlay .pin-key").forEach((b) => {
      b.disabled = false;
    });
  } else if (_pc.step === 2) {
    _pc.newPin = _pc.input;
    _pc.step = 3;
    _pc.input = "";
    _pcUpdateDots();
    _pcSetTitle();
    _pcHideError();
    document.querySelectorAll("#pc-overlay .pin-key").forEach((b) => {
      b.disabled = false;
    });
  } else if (_pc.step === 3) {
    if (_pc.input !== _pc.newPin) {
      _pc.input = "";
      _pcUpdateDots();
      _pcShake();
      _pcShowError("PIN\u304C\u4E00\u81F4\u3057\u307E\u305B\u3093");
      document.querySelectorAll("#pc-overlay .pin-key").forEach((b) => {
        b.disabled = false;
      });
      return;
    }
    const prevHash = _getActivePinHash();
    const newHash = await _hashPin(_pc.newPin);
    localStorage.setItem(AUTH_LS_HASH_KEY, newHash);
    fetch(`${WORKER_URL}/auth/pin-hash`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldHash: prevHash, newHash })
    }).catch(() => {
    });
    _pcSuccess();
  }
}
function openPinChange() {
  if (document.getElementById("pc-overlay")) return;
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
      </div>
      <div class="pin-error" id="pc-error"></div>

      ${_pinKeypadHTML("pcKeyPress", "pcBackspace")}
    </div>`;
  document.body.appendChild(ov);
  ov._kbHandler = (e) => {
    if (e.key >= "0" && e.key <= "9") pcKeyPress(e.key);
    else if (e.key === "Backspace") pcBackspace();
    else if (e.key === "Escape") closePinChange();
  };
  document.addEventListener("keydown", ov._kbHandler);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    ov.style.opacity = "1";
  }));
}
function closePinChange() {
  const ov = document.getElementById("pc-overlay");
  if (!ov) return;
  if (ov._kbHandler) document.removeEventListener("keydown", ov._kbHandler);
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
    if (sessionStorage.getItem(_AUTH_ENC_SS)) {
      _restoreEncKey().then(() => {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", _showChangePinButton);
        } else {
          _showChangePinButton();
        }
      });
      return;
    }
    sessionStorage.removeItem(AUTH_SESSION_KEY);
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
  return m.toFixed(1) + "\u4E07";
};
var fmtJPYFull = (v) => (v >= 0 ? "+" : "") + Math.round(v).toLocaleString() + "\u5186";
var fmtPct = (v) => v.toFixed(1) + "%";
var fmtPrice = (v, cur) => {
  if (v == null) return "\u2015";
  return cur === "USD" ? "$" + v.toFixed(2) : "\xA5" + Math.round(v).toLocaleString();
};
var sgn = (v) => v >= 0 ? "pos" : "neg";
var fmtJPYInt = (v) => {
  const m = Math.round(v / 1e4);
  const sign = m < 0 ? "-" : "";
  const abs = Math.abs(m);
  if (abs >= 1e4) {
    const s = (abs / 1e4).toFixed(2);
    return sign + (s.endsWith("0") ? (abs / 1e4).toFixed(1) : s) + "\u5104";
  }
  return sign + abs.toLocaleString() + "\u4E07";
};
var fmtPctInt = (v) => Math.round(v) + "%";
var fmtShares = (n) => {
  if (n >= 1e6) {
    const v = Math.round(n / 1e5) / 10;
    return v.toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (n >= 1e3) {
    const v = Math.round(n / 100) / 10;
    return v.toFixed(1).replace(/\.0$/, "") + "K";
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

// src/utils.js
function getHistoricalChangePct(symbol, periodId) {
  const cfg = PERIOD_MAP[periodId];
  if (!cfg) return null;
  const data = state.historicalCache[cfg.range]?.[symbol];
  if (!data || data.length < 2) return null;
  let startPoint;
  if (periodId === "1d") {
    startPoint = data[data.length - 2];
  } else {
    const targetDate = new Date(Date.now() - cfg.days * 864e5);
    startPoint = null;
    for (let i = data.length - 1; i >= 0; i--) {
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
    if (periodId === "1d" && p.dayPct !== null) {
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

// src/data.js
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
async function fetchViaProxy(url, timeoutMs = 7e3) {
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
      return raw?.contents ? JSON.parse(raw.contents) : raw;
    } catch {
    }
  }
  return null;
}
function toFinnhubSymbol(ySymbol) {
  if (!ySymbol) return null;
  if (ySymbol.endsWith(".T")) return "TYO:" + ySymbol.slice(0, -2);
  return ySymbol;
}
async function fetchFinnhubQuote(fSymbol) {
  const url = `${WORKER_URL}/finnhub?path=/quote&symbol=${encodeURIComponent(fSymbol)}`;
  try {
    const res = await fetchWithTimeout(url, 7e3);
    if (!res.ok) return null;
    const d = await res.json();
    if (!d || !d.c) return null;
    return { price: d.c, dayPct: d.dp ?? null };
  } catch {
    return null;
  }
}
var SS_CACHE_KEY = "hm-hist-cache";
var SS_CACHE_VER = "2";
function loadCacheFromSession() {
  try {
    const raw = sessionStorage.getItem(SS_CACHE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj._v !== SS_CACHE_VER) return;
    let total = 0;
    for (const range of ["1y", "5y", "10y"]) {
      if (!obj[range]) continue;
      for (const [sym, entries] of Object.entries(obj[range])) {
        state.historicalCache[range][sym] = entries.map((e) => ({
          date: new Date(e.date),
          close: e.close
        }));
        total++;
      }
    }
    if (total > 0) console.log(`[cache] sessionStorage \u304B\u3089 ${total} \u9298\u67C4\xD7\u30EC\u30F3\u30B8\u3092\u5FA9\u5143`);
  } catch (e) {
    console.warn("[cache] sessionStorage \u5FA9\u5143\u5931\u6557:", e);
    sessionStorage.removeItem(SS_CACHE_KEY);
  }
}
function saveCacheToSession() {
  try {
    const obj = { _v: SS_CACHE_VER };
    for (const range of ["1y", "5y", "10y"]) {
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
    console.warn("[cache] sessionStorage \u4FDD\u5B58\u5931\u6557\uFF08\u5BB9\u91CF\u8D85\u904E\u306E\u53EF\u80FD\u6027\uFF09:", e);
  }
}
function clearCacheSession() {
  sessionStorage.removeItem(SS_CACHE_KEY);
}
loadCacheFromSession();
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
          const costJPY = p.value != null && p.pnl != null ? p.value - p.pnl : 0;
          const ratio = oldPrice > 0 ? c.price / oldPrice : 1;
          p.value = Math.round(p.value * ratio);
          p.pnl = p.value - costJPY;
          p.pnlPct = costJPY > 0 ? p.pnl / costJPY * 100 : 0;
        }
      }
      applied++;
    }
    if (applied > 0) {
      console.log(`[prices:cache] ${applied}\u9298\u67C4\u306B Cron \u30AD\u30E3\u30C3\u30B7\u30E5\u4FA1\u683C\u3092\u9069\u7528`);
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
async function fetchSymbolHistory(symbol, range = "1y") {
  if (!state.historicalCache[range]) state.historicalCache[range] = {};
  if (state.historicalCache[range][symbol]) return;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`;
  const data = await fetchViaProxy(url);
  if (!data) return;
  const result = data?.chart?.result?.[0];
  if (!result) return;
  const timestamps = result.timestamp || [];
  const adjCloses = result.indicators?.adjclose?.[0]?.adjclose || [];
  const rawCloses = result.indicators?.quote?.[0]?.close || [];
  const closes = adjCloses.length ? adjCloses : rawCloses;
  const entries = timestamps.map((ts, i) => ({ date: new Date(ts * 1e3), close: closes[i] })).filter((p) => p.close != null && isFinite(p.close));
  state.historicalCache[range][symbol] = applySplitCorrection(entries);
  saveCacheToSession();
}
async function fetchLivePrice(symbol) {
  const fSymbol = toFinnhubSymbol(symbol);
  if (fSymbol) {
    const fh = await fetchFinnhubQuote(fSymbol);
    if (fh) return fh;
  }
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d&_=${Date.now()}`;
  const data = await fetchViaProxy(url);
  const result = data?.chart?.result?.[0];
  if (!result) return null;
  const price = result.meta?.regularMarketPrice ?? null;
  if (price == null) return null;
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
  const fetched = await batchWithRetry(
    targets,
    async (p) => ({ pos: p, live: await fetchLivePrice(p.ySymbol) }),
    {
      isFailed: (r) => !r.live,
      onProgress: (done, total) => setStatus(`\u30E9\u30A4\u30D6\u4FA1\u683C\u3092\u53D6\u5F97\u4E2D\uFF08${done}/${total}\uFF09...`, "yellow")
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
  let n = 0;
  fetched.forEach(({ pos: p, live }) => {
    if (!live) return;
    if (!p.isProxy && p.price > 0 && (live.price / p.price < 0.1 || live.price / p.price > 10)) {
      console.warn(`[refreshPrices] \u7570\u5E38\u4FA1\u683C\u30B9\u30AD\u30C3\u30D7: ${p.symbol} live=${live.price} stored=${p.price}`);
      return;
    }
    if (p.isProxy) {
      p.dayPct = live.dayPct ?? null;
      updateCache(p.ySymbol, live.price);
    } else {
      const oldPrice = p.price;
      p.price = live.price;
      if (p.cur === "JPY") {
        p.value = Math.round(live.price * p.shares);
        const costTotal = p.avgCost * p.shares;
        p.pnl = p.value - costTotal;
        p.pnlPct = costTotal > 0 ? p.pnl / costTotal * 100 : 0;
      } else {
        const costJPY = p.value != null && p.pnl != null ? p.value - p.pnl : 0;
        const ratio = oldPrice > 0 ? live.price / oldPrice : 1;
        p.value = Math.round(p.value * ratio);
        p.pnl = p.value - costJPY;
        p.pnlPct = costJPY > 0 ? p.pnl / costJPY * 100 : 0;
      }
      p.dayPct = live.dayPct;
      updateCache(p.ySymbol, live.price);
    }
    n++;
  });
  if (n > 0) {
    const now = /* @__PURE__ */ new Date();
    const ts2 = now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    const msg = `${n}\u9298\u67C4 \u6700\u7D42\u66F4\u65B0: ${ts2}`;
    state.lastUpdateText = msg;
    setStatus(msg, "green");
    document.dispatchEvent(new CustomEvent("hm:prices-updated"));
    flashPriceChanges(fetched);
  } else {
    setStatus("\u53D6\u5F97\u5931\u6557\uFF08\u5E02\u5834\u6642\u9593\u5916\u307E\u305F\u306FAPI\u30A2\u30AF\u30BB\u30B9\u5236\u9650\uFF09", "red");
  }
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
function setStatus(msg, color) {
  const dot = document.getElementById("status-dot");
  const txt = document.getElementById("status-text");
  dot.className = "dot" + (color === "red" ? " red" : color === "yellow" ? " yellow" : "");
  txt.textContent = msg;
}

// src/stock-list.js
function updateSlColStyle() {
  const el = document.getElementById("sl-col-style");
  if (!el) return;
  if (state.slDetailVisible) {
    el.textContent = "";
  } else {
    el.textContent = SL_DETAIL_COLS.map((c) => `.sl-table th[data-col="${c}"], .sl-table td[data-col="${c}"] { display: none; }`).join("\n");
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
      <td data-col="symbol" class="sl-sym">${p.symbol}<span class="sl-inline-name">${p.name}</span></td>
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
  const tbl = document.querySelector(".sl-table");
  if (!tbl) return;
  const symTh = tbl.querySelector('th[data-col="symbol"]');
  if (!symTh) return;
  const tblRect = tbl.getBoundingClientRect();
  const symRect = symTh.getBoundingClientRect();
  const startX = symRect.right - tblRect.left;
  const totalW = tblRect.width;
  const barMaxW = totalW - startX;
  const fill = "rgba(142,142,147,0.16)";
  const edge = "rgba(142,142,147,0.55)";
  const edgePx = 2;
  tbl.querySelectorAll("tbody tr[data-bar]").forEach((tr) => {
    const frac = parseFloat(tr.dataset.bar || "0");
    if (frac <= 0 || barMaxW <= 0) {
      tr.style.backgroundImage = "";
      return;
    }
    const barEndPx = startX + barMaxW * frac;
    const edgeStart = Math.max(startX + 1, barEndPx - edgePx);
    tr.style.backgroundImage = `linear-gradient(to right, transparent ${startX}px, ${fill} ${startX}px, ${fill} ${edgeStart.toFixed(1)}px, ${edge} ${edgeStart.toFixed(1)}px, ${edge} ${barEndPx.toFixed(1)}px, transparent ${barEndPx.toFixed(1)}px)`;
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
  g.append("text").attr("x", 2).attr("y", cy - 4).attr("fill", cssVar("--cost-text")).attr("font-size", 10).text("\u53D6\u5F97\u5358\u4FA1: " + (cur === "USD" ? "$" + avgCost.toFixed(2) : "\xA5" + Math.round(avgCost).toLocaleString()));
  const maLineFn = d3.line().x((d) => x(d.date)).y((d) => y(d.ma)).curve(d3.curveMonotoneX);
  maStyles.forEach((ma) => {
    if (!ma.data.length) return;
    g.append("path").datum(ma.data).attr("d", maLineFn).attr("fill", "none").attr("stroke", ma.color).attr("stroke-width", ma.width).attr("opacity", ma.opacity);
  });
  g.append("path").datum(points).attr("d", d3.line().x((d) => x(d.date)).y((d) => y(d.close)).curve(d3.curveMonotoneX)).attr("fill", "none").attr("stroke", lineColor).attr("stroke-width", 2);
  const lp = points[points.length - 1];
  g.append("circle").attr("cx", x(lp.date)).attr("cy", y(lp.close)).attr("r", 4).attr("fill", lineColor);
  const tickFmt = cur === "USD" ? (d) => "$" + (d >= 1e3 ? (d / 1e3).toFixed(1) + "k" : d.toFixed(0)) : (d) => d >= 1e5 ? "\xA5" + (d / 1e4).toFixed(0) + "\u4E07" : d >= 1e4 ? "\xA5" + (d / 1e3).toFixed(0) + "k" : "\xA5" + Math.round(d);
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
  const pf2 = (v) => cur === "USD" ? "$" + v.toFixed(2) : "\xA5" + Math.round(v).toLocaleString();
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
  const pf = (v) => cur === "USD" ? "$" + v.toFixed(2) : "\xA5" + Math.round(v).toLocaleString();
  const maLegend = maStyles.filter((ma) => ma.data.length > 0).map((ma) => {
    const last = ma.data[ma.data.length - 1].ma;
    return `<span style="display:inline-flex;align-items:center;gap:4px"><svg width="8" height="8"><circle cx="4" cy="4" r="3.5" fill="${ma.color}"/></svg><span style="color:${ma.color};font-size:11px">${ma.label}</span> <strong>${pf(last)}</strong></span>`;
  }).join("");
  document.getElementById("chart-stats").innerHTML = `
    <span>\u73FE\u5728\u5024: <strong class="neu">${pf(lastPrice)}</strong></span>
    <span>\u671F\u9593\u5909\u52D5: <strong class="${sgn(chgPct)}">${fmtPct(chgPct)}</strong></span>
    <span>\u640D\u76CA\u7387: <strong class="${sgn(pnlPct)}">${fmtPct(pnlPct)}</strong></span>
    <span>\u9AD8\u5024: <strong class="neu">${pf(d3.max(points, (d) => d.close))}</strong></span>
    <span>\u5B89\u5024: <strong class="neu">${pf(d3.min(points, (d) => d.close))}</strong></span>
    ${maLegend}
  `;
}
function openChart(pos) {
  state.currentPos = pos;
  const proxyNote = pos.isProxy ? ' <span class="modal-sym" style="color:#e3b341">\u203B ' + pos.proxyName + "</span>" : ' <span class="modal-sym">' + pos.symbol + "</span>";
  document.getElementById("modal-title").innerHTML = pos.name + proxyNote;
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
function renderHeatmap() {
  const wrap = document.getElementById("heatmap-wrap");
  const W = wrap.clientWidth;
  if (W === 0) {
    requestAnimationFrame(renderHeatmap);
    return;
  }
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
  const svg = d3.select("#heatmap").attr("width", W).attr("height", H);
  svg.selectAll("*").remove();
  const GROUP_DEFS = [
    { name: "\u7C73\u56FD\u682A\u30FBETF", cats: ["\u7C73\u56FD\u682A\u30FBETF"] },
    { name: "\u65E5\u672C\u682A\u30FBETF\u30FB\u6295\u8CC7\u4FE1\u8A17", cats: ["\u65E5\u672C\u682A\u30FBETF", "\u6295\u8CC7\u4FE1\u8A17"] }
  ];
  const groups = GROUP_DEFS.map((g) => ({
    name: g.name,
    children: positions.filter((p) => g.cats.includes(p.cat)).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).map((p) => ({ ...p, size: p.value ?? 0 }))
  })).filter((g) => g.children.length > 0);
  groups.sort(
    (a, b) => b.children.reduce((s, c) => s + (c.size ?? 0), 0) - a.children.reduce((s, c) => s + (c.size ?? 0), 0)
  );
  const hierData = { name: "root", children: groups };
  const root = d3.hierarchy(hierData).sum((d) => d.size || 0);
  d3.treemap().size([W, H]).paddingOuter(W < C.MOBILE_BREAKPOINT ? 0 : 6).paddingTop(20).paddingInner(4).tile(d3.treemapSquarify)(root);
  root.children.forEach((catNode) => {
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
    let html = `<div class="tt-hdr">${p.name} <span class="tt-sym">${p.symbol}</span></div>
        <div class="tt-row"><span class="tt-label">\u73FE\u5728\u5024</span><span class="tt-val">${fmtPrice(p.price, p.cur)}</span></div>
        <div class="tt-row"><span class="tt-label">\u5E73\u5747\u53D6\u5F97\u5358\u4FA1</span><span class="tt-val">${fmtPrice(p.avgCost, p.cur)}</span></div>
        <div class="tt-row"><span class="tt-label">\u4FDD\u6709\u6570</span><span class="tt-val">${p.shares.toLocaleString()}${p.cat === "\u6295\u8CC7\u4FE1\u8A17" ? " \u53E3" : " \u682A"}</span></div>
        <div class="tt-sep"></div>
        <div class="tt-row"><span class="tt-label">\u6642\u4FA1\u8A55\u4FA1\u984D</span><span class="tt-val">${fmtJPY(p.value)}</span></div>
        <div class="tt-row"><span class="tt-label">\u542B\u307F\u640D\u76CA\uFF08\u5186\uFF09</span><span class="tt-val ${sgn(p.pnl)}">${fmtJPYFull(p.pnl)}</span></div>
        <div class="tt-row"><span class="tt-label">\u640D\u76CA\u7387</span><span class="tt-val ${sgn(p.pnlPct)}">${fmtPct(p.pnlPct)}</span></div>`;
    if (p.dayPct !== null) html += `<div class="tt-sep"></div>
        <div class="tt-row"><span class="tt-label">\u524D\u65E5\u6BD4\uFF08\u5186\uFF09</span><span class="tt-val ${sgn(p.dayCh)}">${fmtJPYFull(p.dayCh)}</span></div>
        <div class="tt-row"><span class="tt-label">\u524D\u65E5\u6BD4\uFF08%\uFF09</span><span class="tt-val ${sgn(p.dayPct)}">${fmtPct(p.dayPct)}</span></div>`;
    if (p.isProxy) html += `<div class="tt-hint" style="color:var(--text2)">\u{1F4CA} \u9A30\u843D\u7387\u306F\u4EE3\u66FF\u30A4\u30F3\u30C7\u30C3\u30AF\u30B9\u3067\u8FD1\u4F3C<br>${p.proxyName}</div>`;
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
  el.style.left = (tx + w > window.innerWidth - 10 ? event.clientX - w - 10 : tx) + "px";
  el.style.top = (ty + h > window.innerHeight - 10 ? event.clientY - h - 10 : ty) + "px";
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
    await fetch(`${WORKER_URL}/watchlist`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.watchlist)
    });
  } catch {
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
      console.log(`[watchlist] KV is empty; seeding KV with ${state.watchlist.length} local items`);
      _syncWatchlistToWorker();
    }
  } catch {
  }
}
function addToWatchlist(item) {
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
    fetchViaProxy(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`,
      7e3
    ),
    fetchViaProxy(
      `https://query2.finance.yahoo.com/v11/finance/quoteSummary/${symbol}?modules=price`,
      6e3
    )
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
  const candidates = [
    qsPrice.longName,
    qsPrice.shortName,
    meta.longName,
    meta.shortName
  ].map((s) => (s || "").trim()).filter(Boolean);
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
  const seen = /* @__PURE__ */ new Set();
  const found = results.filter((r) => r && !seen.has(r.symbol) && seen.add(r.symbol));
  if (found.length === 0) {
    dropdown.innerHTML = `<div class="wl-search-msg">
      \u300C${input}\u300D\u306F\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F
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
  await Promise.all(symbols.map(async (sym) => {
    const live = await fetchLivePrice(sym);
    if (live) state.watchlistPrices[sym] = live;
  }));
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
    return `<tr>
      <td data-col="symbol" class="sl-sym">${item.symbol}<span class="sl-inline-name">${item.name}</span></td>
      <td class="wl-market-cell"><span class="wl-type-badge">${item.exchange}</span></td>
      <td class="wl-price-cell">${priceStr}</td>
      ${periodCells}
      <td class="wl-del-cell">
        <button class="wl-del-btn" data-action="removeFromWatchlist" data-arg="${item.symbol.replace(/"/g, "&quot;")}" title="\u30A6\u30A9\u30C3\u30C1\u30EA\u30B9\u30C8\u304B\u3089\u524A\u9664">\xD7</button>
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

// src/positions-store.js
var DEFAULT_PIN_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";
async function loadPositionsFromKV() {
  try {
    const res = await fetchWithTimeout(`${WORKER_URL}/positions`, 1e4);
    if (!res.ok) return false;
    const kvPositions = await res.json();
    if (!Array.isArray(kvPositions) || kvPositions.length === 0) return false;
    positions.splice(0, positions.length, ...kvPositions);
    console.log(`[positions-store] KV\u304B\u3089${kvPositions.length}\u9298\u67C4\u3092\u8AAD\u307F\u8FBC\u307F\u307E\u3057\u305F`);
    return true;
  } catch (e) {
    console.warn("[positions-store] KV positions \u8AAD\u8FBC\u5931\u6557:", e);
    return false;
  }
}
async function savePositionsToKV(newPositions, pinHashOverride) {
  const pinHash = pinHashOverride || localStorage.getItem("hm-pin-hash") || DEFAULT_PIN_HASH;
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
    existing.avgCost = totalShares > 0 ? totalCost / totalShares : existing.avgCost || 0;
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
    throw new Error(`AI API \u30A8\u30E9\u30FC (${res.status})${detail ? ": " + detail : ""}`);
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
    ySymbol: isFund ? proxy.ySymbol : isJP ? `${sym}.T` : sym,
    ...isFund ? { isProxy: true, proxyName: proxy.proxyName } : {}
  };
}

// src/import-ui.js
var _importState = { source: null, parsed: [], current: [], pendingPositions: [] };
function openImportModal(source) {
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
        <button class="import-file-btn" onclick="${isManex ? "document.getElementById('import-manex-input').click()" : "document.getElementById('import-mf-input').click()"}">
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
        <button class="import-file-btn" style="margin-top:12px" onclick="_renderImportStep('select')">\u3084\u308A\u76F4\u3059</button>
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
      <button class="import-cancel-btn" onclick="closeImportModal()">\u30AD\u30E3\u30F3\u30BB\u30EB</button>
      <button class="import-confirm-btn" onclick="_confirmImport()">${confirmLabel}</button>
    </div>`;
    html += `</div>`;
    body.innerHTML = html;
  }
  if (step === "pin-auth") {
    body.innerHTML = `
      <div class="import-pin-auth">
        <div class="import-pin-msg">\u{1F512} PIN\u8A8D\u8A3C\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002PIN\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002</div>
        <input type="password" id="import-pin-input" class="import-pin-input"
          inputmode="numeric" maxlength="4" placeholder="\u2022\u2022\u2022\u2022"
          onkeydown="if(event.key==='Enter')_retryWithPin()">
        <div class="import-footer">
          <button class="import-cancel-btn" onclick="closeImportModal()">\u30AD\u30E3\u30F3\u30BB\u30EB</button>
          <button class="import-confirm-btn" onclick="_retryWithPin()">\u4FDD\u5B58\u3059\u308B \u2192</button>
        </div>
      </div>`;
    requestAnimationFrame(() => document.getElementById("import-pin-input")?.focus());
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
        <button class="import-confirm-btn" onclick="closeImportModal()">\u9589\u3058\u308B</button>
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
    <span class="imp-meta">${p.shares}\u682A @${p.avgCost}</span>
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
  _importState.pendingPositions = finalPositions;
  _renderImportStep("saving");
  await _doSavePositions(finalPositions);
}
async function _doSavePositions(finalPositions, pinHashOverride) {
  try {
    await savePositionsToKV(finalPositions, pinHashOverride);
    positions.splice(0, positions.length, ...finalPositions);
    state.historicalCache = { "1y": {}, "5y": {}, "10y": {} };
    clearCacheSession();
    state.lastUpdateText = null;
    _renderImportStep("done", `${finalPositions.length}\u9298\u67C4\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F`);
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent("hm:prices-updated"));
      renderStockList();
      renderWatchlist();
      refreshPrices();
    }, 300);
  } catch (e) {
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
  const pinInput = document.getElementById("import-pin-input");
  const pin = pinInput?.value?.trim();
  if (!pin) {
    if (pinInput) pinInput.focus();
    return;
  }
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  const pinHash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  localStorage.setItem("hm-pin-hash", pinHash);
  const finalPositions = _importState.pendingPositions;
  if (!finalPositions?.length) {
    closeImportModal();
    return;
  }
  _renderImportStep("saving");
  await _doSavePositions(finalPositions, pinHash);
}
async function handleManexFileSelect(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = "";
  if (files.length === 0) return;
  _renderImportStep("loading", "CSV\u3092\u89E3\u6790\u4E2D...");
  const parsed = await parseManexFiles(files);
  if (!parsed || parsed.length === 0) {
    _renderImportStep("error", "CSV\u3092\u89E3\u6790\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u30DE\u30CD\u30C3\u30AF\u30B9\u8A3C\u5238\u306ECSV\u30D5\u30A1\u30A4\u30EB\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    return;
  }
  _importState.parsed = parsed;
  _renderImportStep("review");
}
async function handleMoneyForwardImageSelect(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  _renderImportStep("loading", "AI\u3067\u8CC7\u7523\u60C5\u5831\u3092\u8AAD\u307F\u53D6\u308A\u4E2D...");
  try {
    const parsed = await parseMoneyForwardImage(file);
    if (parsed.length === 0) {
      _renderImportStep("error", "AI\u304C\u8CC7\u7523\u60C5\u5831\u3092\u691C\u51FA\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u8CC7\u7523\u4E00\u89A7\u304C\u5199\u3063\u305F\u30B9\u30AF\u30EA\u30FC\u30F3\u30B7\u30E7\u30C3\u30C8\u3092\u304A\u8A66\u3057\u304F\u3060\u3055\u3044\u3002");
      return;
    }
    _importState.parsed = parsed;
    _renderImportStep("review");
  } catch (e) {
    console.error("[import-ui] MF image handler error:", e);
    _renderImportStep("error", e.message);
  }
}
function escapeHTML2(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
window._renderImportStep = _renderImportStep;
window._confirmImport = _confirmImport;
window._retryWithPin = _retryWithPin;
window.closeImportModal = closeImportModal;

// src/ptr.js
if ("ontouchstart" in window) {
  let getIndicator = function() {
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
    pulling = atTop();
    startY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (!pulling) return;
    const delta = e.touches[0].clientY - startY;
    if (delta <= 0) return;
    const ind = getIndicator();
    ind.style.transition = "none";
    ind.style.height = Math.min(delta * 0.55, 56) + "px";
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
document.addEventListener("hm:prices-updated", () => {
  renderStats();
  renderHeatmap();
});
window.renderHeatmap = renderHeatmap;
setPasskeySuccessCallback(_showChangePinButton);
function toggleStats() {
  state.statsVisible = !state.statsVisible;
  document.getElementById("stats").style.display = state.statsVisible ? "" : "none";
  const eye = document.getElementById("stats-eye");
  eye.classList.toggle("hidden", !state.statsVisible);
  document.getElementById("eye-slash").style.display = state.statsVisible ? "none" : "";
  requestAnimationFrame(updateListHeight);
}
function renderStats() {
  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const totalCost = totalValue - totalPnl;
  const pnlPct = totalCost > 0 ? totalPnl / totalCost * 100 : 0;
  let html = `<div class="stat">
    <span class="stat-label">\u8CC7\u7523\u7DCF\u984D</span>
    <span class="stat-value neu">${fmtJPYInt(totalValue)}</span>
  </div>`;
  html += `<div class="stat">
    <span class="stat-label">\u542B\u307F\u640D\u76CA</span>
    <span class="stat-value ${sgn(totalPnl)}">${fmtJPYInt(totalPnl)}</span>
    <span class="stat-sub ${sgn(pnlPct)}">${fmtPctInt(pnlPct)}</span>
  </div>`;
  for (const p of PERIODS) {
    const pct = calcPortfolioPeriodPct(p.id);
    const amt = pct !== null ? totalValue * pct / 100 : null;
    const cls = pct !== null ? sgn(pct) : "neu";
    html += `<div class="stat">
      <span class="stat-label">${p.statsLabel}</span>
      <span class="stat-value ${cls}">${amt !== null ? fmtJPYInt(amt) : "\u2015"}</span>
      <span class="stat-sub ${cls}">${pct !== null ? fmtPctInt(pct) : "\u2015"}</span>
    </div>`;
  }
  document.getElementById("stats").innerHTML = html;
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
  if (!confirm("\u73FE\u5728\u306E\u30DD\u30FC\u30C8\u30D5\u30A9\u30EA\u30AA\u3092 GitHub \u306B\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u4FDD\u5B58\u3057\u307E\u3059\u3002\n\uFF08data/portfolio-snapshot.json \u304C\u66F4\u65B0\u3055\u308C\u307E\u3059\uFF09")) return;
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
    alert(`\u4FDD\u5B58\u5B8C\u4E86:
https://github.com/shoulang0729/portfolio/blob/main/data/portfolio-snapshot.json

\u53CD\u6620\u307E\u3067 raw.githubusercontent.com \u5074\u3067\u6700\u59275\u5206\u306E\u30AD\u30E3\u30C3\u30B7\u30E5\u30E9\u30B0\u3042\u308A\u3002`);
  } catch (e) {
    setStatus(`\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u4FDD\u5B58\u5931\u6557: ${e.message}`, "red");
    alert(`\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8\u4FDD\u5B58\u5931\u6557:
${e.message}`);
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
    return `\u6B21\u56DE\u66F4\u65B0: ${h}\u6642\u9593${m > 0 ? m + "\u5206" : ""}\u5F8C`;
  }
  if (sec >= 60) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return `\u6B21\u56DE\u66F4\u65B0: ${m}\u5206${s > 0 ? s + "\u79D2" : ""}\u5F8C`;
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
  handleMoneyForwardImageSelect
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
  applyTheme();
  document.getElementById("btn-pnl").classList.remove("active");
  document.querySelectorAll(".period-btn[data-period]").forEach((b) => b.classList.toggle("active", b.dataset.period === "1d"));
  const panelList = document.getElementById("panel-list");
  const panelWatchlist = document.getElementById("panel-watchlist");
  const panelAi = document.getElementById("panel-ai");
  if (panelList) panelList.hidden = true;
  if (panelWatchlist) panelWatchlist.hidden = true;
  if (panelAi) panelAi.hidden = true;
  renderStats();
  document.getElementById("stats").style.display = state.statsVisible ? "" : "none";
  const _eye = document.getElementById("stats-eye");
  if (_eye) _eye.classList.toggle("hidden", !state.statsVisible);
  const _eyeSlash = document.getElementById("eye-slash");
  if (_eyeSlash) _eyeSlash.style.display = state.statsVisible ? "none" : "";
  updateSlColStyle();
  const _slEye = document.getElementById("sl-eye-btn");
  if (_slEye) _slEye.classList.toggle("hidden", !state.slDetailVisible);
  const _slSlash = document.getElementById("sl-eye-slash");
  if (_slSlash) _slSlash.style.display = state.slDetailVisible ? "none" : "";
  renderHeatmap();
  setStatus("\u8D77\u52D5\u4E2D...", "yellow");
  requestAnimationFrame(updateListHeight);
  try {
    const lastTab = localStorage.getItem("hm-active-tab");
    if (lastTab && lastTab !== "heatmap" && ["list", "watchlist"].includes(lastTab)) {
      requestAnimationFrame(() => switchTab(lastTab));
    } else if (lastTab === "ai") {
      localStorage.removeItem("hm-active-tab");
    }
  } catch {
  }
  (async () => {
    const loaded = await loadPositionsFromKV();
    if (loaded) {
      renderStats();
      renderHeatmap();
    }
    applyPricesCache();
    await refreshPrices();
    _hideHeatmapSkeleton();
    for (const range of ["1y", "5y", "10y"]) {
      await fetchAllHistorical(range);
      renderStats();
      renderStockList();
      if (state.activeTab === "watchlist") renderWatchlist();
      if (state.changePeriod && state.changePeriod !== "1d") renderHeatmap();
    }
  })();
}
function _hideHeatmapSkeleton() {
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
  const slCtrl = document.querySelector(".sl-controls");
  const stickyH = sticky ? sticky.offsetHeight : 0;
  const ctrlH = slCtrl ? slCtrl.offsetHeight : 0;
  const padBot = parseFloat(getComputedStyle(document.body).paddingBottom) || 16;
  const h = Math.max(160, window.innerHeight - stickyH - ctrlH - padBot - 4);
  wrap.style.maxHeight = h + "px";
}
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
  const panelAi = document.getElementById("panel-ai");
  if (panelHeatmap) panelHeatmap.hidden = name !== "heatmap";
  if (panelList) panelList.hidden = name !== "list";
  if (panelWatchlist) panelWatchlist.hidden = name !== "watchlist";
  if (panelAi) panelAi.hidden = name !== "ai";
  document.querySelectorAll(".tab-btn[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  if (name === "heatmap") renderHeatmap();
  if (name === "list") {
    renderStockList();
    requestAnimationFrame(() => requestAnimationFrame(updateListHeight));
  }
  if (name === "watchlist") {
    _loadWatchlistFromWorker().then(() => {
      renderWatchlist();
      fetchWatchlistData();
    });
  }
}
if (typeof d3 === "undefined") {
  document.getElementById("d3-load-error").style.display = "flex";
} else {
  let _resizeRaf = null;
  window.addEventListener("resize", () => {
    if (_resizeRaf) cancelAnimationFrame(_resizeRaf);
    _resizeRaf = requestAnimationFrame(() => {
      _resizeRaf = null;
      renderHeatmap();
      renderStockList();
      applyStockBars();
      updateListHeight();
    });
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.themeMode !== "auto") return;
    applyTheme();
    renderHeatmap();
    const overlay = document.getElementById("modal-overlay");
    if (overlay && overlay.style.display !== "none" && state.currentPos?.ySymbol) {
      loadChart(state.currentPos.ySymbol, state.currentRange);
    }
  });
  init();
  if (typeof ResizeObserver !== "undefined") {
    const _stickyEl = document.querySelector(".sticky-top");
    if (_stickyEl) {
      new ResizeObserver(() => {
        if (state.activeTab === "list") updateListHeight();
      }).observe(_stickyEl);
    }
  }
}
(function() {
  const ver = (import.meta.url.match(/[?&]v=([^&]+)/) || [, "?"])[1];
  const title = document.querySelector(".title");
  if (title) {
    const badge = document.createElement("span");
    badge.id = "debug-ver";
    badge.style.cssText = "display:block;font-size:9px;font-weight:400;color:var(--text2);opacity:0.6;margin-top:1px;line-height:1.2;";
    badge.textContent = "v." + ver;
    title.appendChild(badge);
  }
  console.log("[Heatmap] app.js:", import.meta.url);
})();
