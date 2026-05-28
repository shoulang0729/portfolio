// ══════════════════════════════════════════════════════════════
// utils.js  ―  バレル再エクスポート
//
// フォーマッタ・色計算・テーブルヘルパー・ポートフォリオ計算は
// それぞれ独立ファイルに分離済み。
// 既存の `import { ... } from './utils.js'` はそのまま動く。
// ══════════════════════════════════════════════════════════════

export { escapeHTML, fmtJPY, fmtJPYFull, fmtPct, fmtPrice, sgn, fmtJPYInt, fmtPctInt, fmtShares } from './fmt.js';
export { cssVar, getColor, getCellTextColor, getCellTextColorSub } from './color.js';
export { makeTh, makePctCell, _tableSort, makePeriodCells, makePeriodHeaderCells } from './table.js';
export { getHistoricalChangePct, getDisplayPct, calcPortfolioPeriodPct } from './portfolio-calc.js';