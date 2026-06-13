// ══════════════════════════════════════════════════════════════
// manual-assets.js  ―  非証券資産の【フォールバック】定義
//
// ★2026/06〜: 現金・暗号資産の正は Money Forward 実値（networth.js / mf-holdings.json）。
//   Exposure の look-through は getMfManualAssets() を優先し、mf-holdings 未ロード時のみ
//   この MANUAL_ASSETS を使う（＝二重計上しない）。通常運用ではこの値は使われない。
//
// 各エントリは positions と同じ {symbol, name, value, cur} 形。
// 分解（資産クラス/通貨/国/セクター）は constituents.js の CONSTITUENTS に同じ symbol で定義。
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
