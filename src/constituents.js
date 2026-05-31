// ══════════════════════════════════════════════════════════════
// constituents.js  ―  リスク断面タブ用 look-through 分解データ（curated）
//
// 各保有銘柄を「資産クラス / 通貨 / 地域・国 / セクター」の4軸に分解した
// カテゴリ別ウェイト表。キーは positions[].symbol（一意）。
//
// 各 dim マップのウェイト合計が 1 未満の場合、残差は「その他/不明」として
// 集計される（risk-calc.js）。アクティブ投信のセクター等、判明分のみ記載し
// 残りをカバレッジ未満として正直に扱う方針（要件定義 §5 参照）。
//
// ★ 数値は概算（公開情報ベース）。Phase B で Worker /etf/constituents +
//   公式保有CSV に置換してライブ化する想定。
//
// カテゴリキー（表示ラベルは risk-charts.js の LABELS で定義）:
//   assetClass: equity | bond | commodity | reit | cash
//   currency  : JPY | USD | EUR | other
//   country   : japan | us | europe | em | latam | china | global | commodity
//   sector    : tech | semis | financials | healthcare | consumer | staples |
//               industrials | energy | materials | comm | utilities |
//               realestate | commodity | bond | cash
// ══════════════════════════════════════════════════════════════

/** @typedef {Record<string, number>} WeightMap */
/** @typedef {{ assetClass: WeightMap, currency: WeightMap, country: WeightMap, sector: WeightMap }} Breakdown */

/** @type {Record<string, Breakdown>} */
const CONSTITUENTS = {
  // ── 日本株・ETF ──
  '1306': { // NEXT FUNDS TOPIX連動型（日本株式の幅広い分散）
    assetClass: { equity: 1 }, currency: { JPY: 1 }, country: { japan: 1 },
    sector: { tech: 0.14, financials: 0.12, industrials: 0.12, consumer: 0.10,
      comm: 0.08, staples: 0.07, materials: 0.07, healthcare: 0.06,
      utilities: 0.04, realestate: 0.03, energy: 0.01 },
  },
  '1615': { // 東証銀行業ETF
    assetClass: { equity: 1 }, currency: { JPY: 1 }, country: { japan: 1 },
    sector: { financials: 1 },
  },
  '1629': { // 商社・卸売ETF
    assetClass: { equity: 1 }, currency: { JPY: 1 }, country: { japan: 1 },
    sector: { industrials: 1 },
  },
  '200A': { // 日経半導体ETF
    assetClass: { equity: 1 }, currency: { JPY: 1 }, country: { japan: 1 },
    sector: { semis: 1 },
  },
  '6301': { // 小松製作所
    assetClass: { equity: 1 }, currency: { JPY: 1 }, country: { japan: 1 },
    sector: { industrials: 1 },
  },
  '8050': { // セイコーグループ
    assetClass: { equity: 1 }, currency: { JPY: 1 }, country: { japan: 1 },
    sector: { consumer: 1 },
  },
  '9983': { // ファーストリテイリング
    assetClass: { equity: 1 }, currency: { JPY: 1 }, country: { japan: 1 },
    sector: { consumer: 1 },
  },

  // ── 米国株・ETF ──
  'AAPL': {
    assetClass: { equity: 1 }, currency: { USD: 1 }, country: { us: 1 },
    sector: { tech: 1 },
  },
  'AMZN': {
    assetClass: { equity: 1 }, currency: { USD: 1 }, country: { us: 1 },
    sector: { consumer: 1 },
  },
  'COPX': { // 銅鉱山株ETF（グローバル鉱山企業）
    assetClass: { equity: 1 }, currency: { USD: 0.55, other: 0.45 },
    country: { global: 0.5, em: 0.3, us: 0.2 }, sector: { materials: 1 },
  },
  'GLDM': { // 現物ゴールド
    assetClass: { commodity: 1 }, currency: { USD: 1 }, country: { commodity: 1 },
    sector: { commodity: 1 },
  },
  'GOOGL': {
    assetClass: { equity: 1 }, currency: { USD: 1 }, country: { us: 1 },
    sector: { tech: 1 },
  },
  'ILF': { // iシェアーズ ラテンアメリカ40
    assetClass: { equity: 1 }, currency: { other: 1 }, country: { latam: 1 },
    sector: { financials: 0.30, materials: 0.25, energy: 0.15, staples: 0.15,
      utilities: 0.07, comm: 0.05 },
  },
  'JPST': { // 超短期インカム（債券）
    assetClass: { bond: 1 }, currency: { USD: 1 }, country: { us: 1 },
    sector: { bond: 1 },
  },
  'MSFT': {
    assetClass: { equity: 1 }, currency: { USD: 1 }, country: { us: 1 },
    sector: { tech: 1 },
  },
  'PLTR': {
    assetClass: { equity: 1 }, currency: { USD: 1 }, country: { us: 1 },
    sector: { tech: 1 },
  },
  'REMX': { // レアアース・金属鉱山株ETF（中国比率高）
    assetClass: { equity: 1 }, currency: { USD: 0.5, other: 0.5 },
    country: { china: 0.4, global: 0.4, us: 0.2 }, sector: { materials: 1 },
  },
  'SHLD': { // 防衛テックETF（米欧）
    assetClass: { equity: 1 }, currency: { USD: 0.7, EUR: 0.3 },
    country: { us: 0.6, europe: 0.4 }, sector: { industrials: 1 },
  },
  'SLV': { // 現物シルバー
    assetClass: { commodity: 1 }, currency: { USD: 1 }, country: { commodity: 1 },
    sector: { commodity: 1 },
  },
  'SMH': { // 半導体ETF（米中心・台韓含む）
    assetClass: { equity: 1 }, currency: { USD: 0.8, other: 0.2 },
    country: { us: 0.7, em: 0.2, europe: 0.1 }, sector: { semis: 1 },
  },
  'TSLA': {
    assetClass: { equity: 1 }, currency: { USD: 1 }, country: { us: 1 },
    sector: { consumer: 1 },
  },
  'XLE': { // エネルギー・セレクト・セクターSPDR
    assetClass: { equity: 1 }, currency: { USD: 1 }, country: { us: 1 },
    sector: { energy: 1 },
  },

  // ── 投資信託 ──
  'オルカン': { // eMAXIS Slim 全世界株式（MSCI ACWI 連動・概算）
    assetClass: { equity: 1 },
    currency: { USD: 0.62, EUR: 0.10, JPY: 0.05, other: 0.23 },
    country: { us: 0.62, japan: 0.05, europe: 0.13, em: 0.12, global: 0.08 },
    sector: { tech: 0.26, financials: 0.16, consumer: 0.11, healthcare: 0.10,
      industrials: 0.10, comm: 0.075, staples: 0.06, energy: 0.04,
      materials: 0.04, utilities: 0.025, realestate: 0.02 },
  },
  'ひふみ': { // ひふみ投信（アクティブ・日本中心）— セクターは判明分のみ
    assetClass: { equity: 0.95, cash: 0.05 },
    currency: { JPY: 0.95, USD: 0.05 },
    country: { japan: 0.90, us: 0.10 },
    // アクティブ運用のため全構成は非公開。上位の業種傾向のみ記載（残りは その他）
    sector: { tech: 0.12, industrials: 0.12, consumer: 0.10, financials: 0.08,
      comm: 0.06 },
  },
  'マイクロSP': { // ひふみマイクロスコープpro（日本小型株・アクティブ）
    assetClass: { equity: 0.95, cash: 0.05 },
    currency: { JPY: 1 }, country: { japan: 1 },
    sector: { industrials: 0.16, tech: 0.14, consumer: 0.10, materials: 0.08,
      healthcare: 0.06 },
  },
  'ひふみXO': { // ひふみクロスオーバーpro（国内外グロース・アクティブ）
    assetClass: { equity: 0.95, cash: 0.05 },
    currency: { JPY: 0.92, USD: 0.08 },
    country: { japan: 0.88, us: 0.12 },
    sector: { tech: 0.16, industrials: 0.12, healthcare: 0.10, consumer: 0.08,
      comm: 0.06 },
  },
  'PIMCO-ST': { // ピムコ ショート・ターム（短期債券）
    assetClass: { bond: 1 }, currency: { USD: 1 },
    country: { us: 0.6, global: 0.4 }, sector: { bond: 1 },
  },

  // ── 現金（手動入力・manual-assets.js で Exposure に投入）──
  '現金(円)': {
    assetClass: { cash: 1 }, currency: { JPY: 1 }, country: { japan: 1 }, sector: { cash: 1 },
  },
  '現金(USD)': {
    assetClass: { cash: 1 }, currency: { USD: 1 }, country: { us: 1 }, sector: { cash: 1 },
  },
};

export { CONSTITUENTS };
