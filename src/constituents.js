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
  'AMZN': { // AWS(クラウド)が利益の6割: tech/consumer 混在
    assetClass: { equity: 1 }, currency: { USD: 1 }, country: { us: 1 },
    sector: { tech: 0.3, consumer: 0.7 },
  },
  'COPX': { // 銅鉱山株ETF（グローバル鉱山企業）
    assetClass: { equity: 1 }, currency: { USD: 0.55, other: 0.45 },
    country: { us: 0.25, em: 0.35, europe: 0.2, china: 0.2 }, sector: { materials: 1 }, // 銅鉱山:グローバル分散を近似配分
  },
  'GLDM': { // 現物ゴールド
    assetClass: { commodity: 1 }, currency: { USD: 1 }, country: { commodity: 1 },
    sector: { commodity: 1 },
  },
  'GOOGL': { // GICS: 通信サービス。検索・広告=comm、Google Cloud=tech
    assetClass: { equity: 1 }, currency: { USD: 1 }, country: { us: 1 },
    sector: { comm: 0.8, tech: 0.2 },
  },
  'ILF': { // iシェアーズ ラテンアメリカ40
    assetClass: { equity: 1 }, currency: { other: 1 }, country: { latam: 1 },
    sector: { financials: 0.33, materials: 0.25, energy: 0.15, staples: 0.15,
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
    country: { china: 0.45, em: 0.3, us: 0.15, europe: 0.1 }, sector: { materials: 1 }, // レアアース:中国偏重で近似配分
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
  'URA': { // グローバルX ウラニウムETF: ウラン採掘株中心＋現物ウラン(Sprott)・原子力関連
    assetClass: { equity: 0.92, commodity: 0.08 },
    currency: { USD: 0.50, other: 0.50 },
    country: { us: 0.30, em: 0.10, global: 0.52, commodity: 0.08 },
    sector: { energy: 0.80, industrials: 0.07, materials: 0.05, commodity: 0.08 },
  },

  // ── 投資信託 ──
  'オルカン': { // eMAXIS Slim 全世界株式（MSCI ACWI 連動・概算）
    assetClass: { equity: 1 },
    currency: { USD: 0.62, EUR: 0.10, JPY: 0.05, other: 0.23 },
    country: { us: 0.63, europe: 0.16, em: 0.13, japan: 0.055, china: 0.025 },
    sector: { tech: 0.26, financials: 0.16, consumer: 0.11, healthcare: 0.10,
      industrials: 0.10, comm: 0.075, staples: 0.06, energy: 0.04,
      materials: 0.04, utilities: 0.025, realestate: 0.02 },
  },
  'ひふみ': { // ひふみ投信（レオス月次レポート 2026年4月基準・実数）
    // 資産配分: 国内株式 98.69% / 現金等 1.31%、市場別はほぼ全て国内（プライム97.85%等）
    assetClass: { equity: 0.987, cash: 0.013 },
    currency: { JPY: 1 },
    country: { japan: 1 },
    // 東証33業種を当アプリのセクターへ集約（業種別比率より）。合計≈0.998
    sector: {
      industrials: 0.345, // 卸売14.59+機械11.69+建設4.92+その他製品2.13+陸運1.16
      tech: 0.186,        // 電気機器16.36+サービス1.58+精密0.61
      financials: 0.155,  // 銀行9.02+保険4.65+その他金融1.79
      consumer: 0.092,    // 輸送用機器6.48+小売2.71
      comm: 0.076,        // 情報・通信7.56
      materials: 0.057,   // 非鉄金属4.34+化学0.72+ガラス土石0.63
      realestate: 0.039,  // 不動産3.87
      healthcare: 0.015,  // 医薬品1.48
      staples: 0.012,     // 食料品1.15
      utilities: 0.008,   // 電気・ガス0.77
      cash: 0.013,        // 現金等
    },
  },
  'マイクロSP': { // ひふみマイクロスコープpro（レオス月次レポート 2026年4月基準・実数）
    // 資産配分: 国内株式 84.64% / 現金等 15.36%、日本小型株
    assetClass: { equity: 0.846, cash: 0.154 },
    currency: { JPY: 1 },
    country: { japan: 1 },
    // 上位10業種のみ開示のため合計≈0.873（残りは不明）
    sector: {
      industrials: 0.212, // 機械9.56+建設6.92+その他製品4.68
      tech: 0.192,        // サービス17.05+電気機器2.19
      comm: 0.081,        // 情報・通信8.09
      consumer: 0.071,    // 小売7.14
      realestate: 0.064,  // 不動産6.38
      financials: 0.062,  // 銀行6.17
      materials: 0.037,   // 化学3.74
      cash: 0.154,        // 現金等
    },
  },
  'ひふみXO': { // ひふみクロスオーバーpro（レオス月次レポート 2026年4月基準・実数）
    // 国内株式(上場)94.41% + 未上場3.03% / 現金2.56%、海外なし
    assetClass: { equity: 0.974, cash: 0.026 },
    currency: { JPY: 1 },
    country: { japan: 1 },
    // 上位10業種のみ開示のため合計≈0.78（残り≈0.22は未上場株・非開示業種＝不明）
    sector: {
      industrials: 0.244, // 機械10.50+卸売10.47+建設3.42
      tech: 0.186,        // 電気機器13.04+サービス5.53
      consumer: 0.135,    // 小売9.23+輸送用機器4.22
      comm: 0.100,        // 情報・通信10.03
      financials: 0.089,  // 銀行5.87+保険3.03
      cash: 0.026,        // 現金等
    },
  },
  'PIMCO-ST': { // ピムコ ショート・ターム（短期債券）
    assetClass: { bond: 1 }, currency: { USD: 1 },
    country: { us: 0.7, europe: 0.2, em: 0.1 }, sector: { bond: 1 }, // 短期債:グローバル分を近似配分
  },

  // ── 現金（手動入力・manual-assets.js で Exposure に投入）──
  '現金(円)': {
    assetClass: { cash: 1 }, currency: { JPY: 1 }, country: { japan: 1 }, sector: { cash: 1 },
  },
  '現金(USD)': {
    assetClass: { cash: 1 }, currency: { USD: 1 }, country: { us: 1 }, sector: { cash: 1 },
  },
};

// ── KV（マネックス取込）の symbol 表記ゆれを既存分類にエイリアス ──
// positions.js は 'ひふみ'/'マイクロSP'、KV 実保有は 'ひふみ投信'/'ひふみMS' のため両対応。
CONSTITUENTS['ひふみ投信'] = CONSTITUENTS['ひふみ'];
CONSTITUENTS['ひふみMS']  = CONSTITUENTS['マイクロSP'];

export { CONSTITUENTS };
