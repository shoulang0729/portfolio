// ══════════════════════════════════════════════════════════════
// constituents.js  ―  リスク断面タブ用 look-through 分解データ（curated）ローダ
//
// 各保有銘柄を「資産クラス / 通貨 / 地域・国 / セクター」の4軸に分解した
// カテゴリ別ウェイト表。キーは positions[].symbol（一意）。
//
// ★ curated データ本体は data/constituents-overrides.json に外出し済み（#207）。
//   本ファイルは JSON をロードし、KV 表記ゆれの alias を適用して CONSTITUENTS
//   として公開するローダ。数値編集は JSON 側で行う。
//
// 各 dim マップのウェイト合計が 1 未満の場合、残差は「その他/不明」として
// 集計される（risk-calc.js）。アクティブ投信のセクター等、判明分のみ記載し
// 残りをカバレッジ未満として正直に扱う方針（要件定義 §5 参照）。
//
// データソースの優先順位（risk-calc.js でマージ）:
//   live（Worker /etf/constituents の holdings）> curated（この JSON）> 既定推定
//
// カテゴリキー（表示ラベルは risk-charts.js の LABELS で定義）:
//   assetClass: equity | bond | commodity | reit | cash | crypto
//   currency  : JPY | USD | EUR | other
//   country   : japan | us | europe | em | latam | china | global | commodity
//   sector    : tech | semis | financials | healthcare | consumer | staples |
//               industrials | energy | materials | comm | utilities |
//               realestate | commodity | bond | cash | crypto
// ══════════════════════════════════════════════════════════════

/** @typedef {Record<string, number>} WeightMap */
/** @typedef {{ assetClass: WeightMap, currency: WeightMap, country: WeightMap, sector: WeightMap }} Breakdown */

import CURATED_OVERRIDES from '../data/constituents-overrides.json';

/** @type {Record<string, Breakdown>} */
const CONSTITUENTS = { ...CURATED_OVERRIDES };

// ── KV（マネックス取込）の symbol 表記ゆれを既存分類にエイリアス ──
// positions.js は 'ひふみ'/'マイクロSP'、KV 実保有は 'ひふみ投信'/'ひふみMS' のため両対応。
// （alias は JSON では表現できないためローダ側で適用する）
CONSTITUENTS['ひふみ投信'] = CONSTITUENTS['ひふみ'];
CONSTITUENTS['ひふみMS']  = CONSTITUENTS['マイクロSP'];

export { CONSTITUENTS };
