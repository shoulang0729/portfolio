// ══════════════════════════════════════════════════════════════
// utils.js  ―  バレル再エクスポート
//
// 各関数は fmt.js / color.js / table.js に移動済み。
// 既存の `import { ... } from './utils.js'` はそのまま動く。
// ══════════════════════════════════════════════════════════════

export { escapeHTML, fmtJPY, fmtJPYFull, fmtPct, fmtPrice, sgn, fmtJPYInt, fmtPctInt, fmtShares } from './fmt.js';
export { cssVar, getColor, getCellTextColor, getCellTextColorSub } from './color.js';
export { makeTh, makePctCell, _tableSort, makePeriodCells, makePeriodHeaderCells } from './table.js';

import { state } from './state.js';
import { positions, PERIOD_MAP } from './positions.js';
import { getColor } from './color.js';

function getHistoricalChangePct(symbol, periodId) {
  const cfg = PERIOD_MAP[periodId];
  if (!cfg) return null;
  const data = state.historicalCache[cfg.range]?.[symbol];
  if (!data || data.length < 2) return null;

  let startPoint;
  if (periodId === '1d') {
    startPoint = data[data.length - 2];
  } else {
    const targetDate = new Date(Date.now() - cfg.days * 86400000);
    startPoint = null;
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].date <= targetDate) { startPoint = data[i]; break; }
    }
    if (!startPoint) startPoint = data[0];
  }

  const currentPrice = data[data.length - 1].close;
  return ((currentPrice - startPoint.close) / startPoint.close) * 100;
}

function getDisplayPct(p) {
  if (state.colorMode === 'pnl') return p.pnlPct;
  if (!p.ySymbol) return null;
  if (state.changePeriod === '1d' && p.dayPct != null) return p.dayPct;
  return getHistoricalChangePct(p.ySymbol, state.changePeriod);
}

function calcPortfolioPeriodPct(periodId) {
  let weightedSum = 0, totalWeight = 0;
  positions.forEach(p => {
    let pct = null;
    if (periodId === '1d' && p.dayPct !== null) {
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

export { getHistoricalChangePct, getDisplayPct, calcPortfolioPeriodPct };