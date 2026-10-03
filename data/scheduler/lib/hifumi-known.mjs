// @ts-check
// hifumi-known.mjs — 既知月（2026-05）の上位10の定数（#656・#652 PR4）。
// 設計書: docs/handoff/2026-10-03-phase15-data-migration.md §7.2.3
//
// PDF（月次レポート）由来の正しい値。自己検証（fund-holdings-update.mjs）とテスト（tests/hifumi-parse.test.js）が
// 共用する唯一の定義元。比較相手は現行 data/scheduler/fund-holdings.json ではない（microscope が誤っているため・§7.4）。
// name は PDF 表記（全角英字・中黒を含む）。

/** @typedef {import('./hifumi-parse.mjs').TopRow} TopRow */

export const KNOWN_MONTH = '202605';

/** @type {{toushin: TopRow[], microscope: TopRow[]}} */
export const KNOWN_TOP10 = Object.freeze({
  toushin: [
    { code: '8001.T', name: '伊藤忠商事', weight: 0.0528 },
    { code: '5802.T', name: '住友電気工業', weight: 0.0513 },
    { code: '6723.T', name: 'ルネサスエレクトロニクス', weight: 0.0411 },
    { code: '7012.T', name: '川崎重工業', weight: 0.0411 },
    { code: '8002.T', name: '丸紅', weight: 0.0406 },
    { code: '8035.T', name: '東京エレクトロン', weight: 0.0392 },
    { code: '8411.T', name: 'みずほフィナンシャルグループ', weight: 0.038 },
    { code: '8802.T', name: '三菱地所', weight: 0.0352 },
    { code: '8031.T', name: '三井物産', weight: 0.0328 },
    { code: '6981.T', name: '村田製作所', weight: 0.0328 },
  ],
  microscope: [
    { code: '7806.T', name: 'ＭＴＧ', weight: 0.0428 },
    { code: '6492.T', name: '岡野バルブ製造', weight: 0.0398 },
    { code: '5074.T', name: 'テスホールディングス', weight: 0.0393 },
    { code: '3480.T', name: 'ジェイ・エス・ビー', weight: 0.0313 },
    { code: '8366.T', name: '滋賀銀行', weight: 0.0262 },
    { code: '4390.T', name: 'ＩＰＳ', weight: 0.0239 },
    { code: '2170.T', name: 'リンクアンドモチベーション', weight: 0.0225 },
    { code: '4275.T', name: 'カーリット', weight: 0.0223 },
    { code: '6143.T', name: 'ソディック', weight: 0.0218 },
    { code: '4377.T', name: 'ワンキャリア', weight: 0.021 },
  ],
});
