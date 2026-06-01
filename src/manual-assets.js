// ══════════════════════════════════════════════════════════════
// manual-assets.js  ―  手動入力の資産（Exposure タブの look-through に含める）
//
// positions.js（証券）に乗らない資産（現金など）をここに定義する。
// Exposure タブの集計にのみ使われ、Heatmap/Historical/価格取得には影響しない。
//
// 各エントリは positions と同じ {symbol, name, value, cur} 形。
// 分解（資産クラス/通貨/国/セクター）は constituents.js の CONSTITUENTS に
// 同じ symbol で定義すること。
//
// ★ 値は手動更新。更新時は MANUAL_SOURCES の日付も合わせて直すこと。
// ══════════════════════════════════════════════════════════════

/** @type {Array<{symbol: string, name: string, value: number, cur: string}>} */
const MANUAL_ASSETS = [
  // 現金（2026/05/31 時点・手動入力）
  { symbol: '現金(円)',  name: '現金（日本円）',     value: 42000000, cur: 'JPY' },
  { symbol: '現金(USD)', name: '現金（米ドル・円換算）', value: 7800000,  cur: 'USD' },
];

/** データ引用元（Exposure タブのフッターに表示） */
const MANUAL_SOURCES = [
  '現金 = 手動入力（2026/05/31）',
  'ひふみ投信・ひふみマイクロスコープpro・ひふみクロスオーバーpro 分類 = レオス・キャピタルワークス 月次レポート（2026年4月基準）',
];

export { MANUAL_ASSETS, MANUAL_SOURCES };
