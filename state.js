// ══════════════════════════════════════════════════════════════
// state.js  ―  定数・アプリ状態
//
// 依存: なし（positions.js より先でも後でもよい）
// 読込順: positions.js → state.js → utils.js → ...
// ══════════════════════════════════════════════════════════════

// ── レイアウト・フォント定数 ──
const C = Object.freeze({
  MOBILE_BREAKPOINT:  600,
  HEATMAP_ASPECT_MOB: 0.85,
  HEATMAP_ASPECT_DSK: 0.58,
  HEATMAP_MINH_MOB:   360,
  HEATMAP_MINH_DSK:   480,
  SYM_FONT_COEFF:     0.22,
  SYM_FONT_MAX:       52,
  SYM_FONT_MIN:       9,
  PCT_FONT_RATIO:     0.52,
  PCT_FONT_MAX:       20,
  PCT_FONT_MIN:       8,
  GAP_RATIO:          0.54,
  GAP_SYM_OFFSET:     0.55,
  GAP_PCT_OFFSET:     0.95,
});

// ── チャートレンジ設定（ボタン ID → Yahoo Finance パラメータ）──
const CHART_RANGES = {
  '1d':  { yRange: '1d',  interval: '5m',  dateFmt: '%H:%M',  label: '1d'  },
  '1w':  { yRange: '5d',  interval: '1h',  dateFmt: '%m/%d',  label: '1w'  },
  '1m':  { yRange: '1mo', interval: '1d',  dateFmt: '%m/%d',  label: '1m'  },
  '3m':  { yRange: '3mo', interval: '1d',  dateFmt: '%m/%d',  label: '3m'  },
  '6m':  { yRange: '6mo', interval: '1d',  dateFmt: '%m/%d',  label: '6m'  },
  '9m':  { yRange: '9mo', interval: '1d',  dateFmt: '%m/%d',  label: '9m'  },
  '1y':  { yRange: '1y',  interval: '1d',  dateFmt: '%m/%d',  label: '1y'  },
  '3y':  { yRange: '3y',  interval: '1wk', dateFmt: '%Y/%m',  label: '3y'  },
  '5y':  { yRange: '5y',  interval: '1wk', dateFmt: '%Y/%m',  label: '5y'  },
  '10y': { yRange: '10y', interval: '1mo', dateFmt: '%Y',     label: '10y' },
};

// ── CSV インポート：投資信託名正規化マッピング ──
const FUND_SYMBOL_PATTERNS = [
  ['全世界株式',       'オルカン'],
  ['マイクロスコープ', 'マイクロSP'],
  ['クロスオーバー',   'ひふみXO'],
  ['ひふみ投信',       'ひふみ'],
];

// ── 銘柄リスト：詳細列定義 ──
const SL_DETAIL_COLS = ['value', 'shares', 'avgCost', 'pnl', 'pnlPct'];

// ── アプリ状態オブジェクト ──
const state = {
  colorMode:        'change',   // 'pnl' | 'change'
  changePeriod:     '1d',       // period id from PERIODS
  lastChangePeriod: '1d',       // remembers last change period for PnL toggle-back
  // historicalCache[range][symbol] = [{date, close}]  (range: '1y'|'5y'|'10y')
  historicalCache:  { '1y': {}, '5y': {}, '10y': {} },
  fetchingRanges:   new Set(),  // レンジ別取得中フラグ（同一レンジの重複リクエストを防ぐ）
  yahooCrumb:       null,       // Yahoo Finance crumb（認証トークン）
  yahooCrumbExpiry: 0,          // crumb の有効期限（msタイムスタンプ）
  autoInterval:     null,       // 自動更新インターバルID
  countdownTimer:   null,
  countdownVal:     0,
  autoSec:          0,
  currentPos:       null,
  currentRange:     '3m',
  statsVisible:     false,  // 起動時はデフォルト非表示
  themeMode:        localStorage.getItem('hm-theme') || 'auto',
  listSortCol:      '1d',       // 銘柄リストのデフォルトソート列
  listSortDir:      'desc',
  slDetailVisible:  false,      // 詳細列の表示状態（起動時はデフォルト非表示）
  activeTab:        'heatmap',  // 'heatmap' | 'list' | 'watchlist'
  lastUpdateText:   null,       // refreshPrices 成功時のステータス文字列（履歴取得後に復元用）
  // ウォッチリスト
  watchlist:        JSON.parse(localStorage.getItem('hm-watchlist') || '[]'),
  watchlistPrices:  {},         // symbol → { price, dayPct }
};
