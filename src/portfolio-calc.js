// @ts-check
// ══════════════════════════════════════════════════════════════
// portfolio-calc.js  ―  ポートフォリオ計算ロジック
// state.historicalCache / positions / state.colorMode に依存
// ══════════════════════════════════════════════════════════════

import { state } from './state.js';
import { positions, PERIOD_MAP } from './positions.js';

/**
 * @param {string} symbol  Yahoo Finance シンボル
 * @param {string} periodId  PERIOD_MAP のキー（例: '1d', '1m', '1y'）
 * @returns {number|null}  期間騰落率（%）。データ不足時は null
 */
function getHistoricalChangePct(symbol, periodId) {
  const cfg = PERIOD_MAP[periodId];
  if (!cfg) return null;
  const data = state.historicalCache[cfg.range]?.[symbol];
  if (!data || data.length < 2) return null;

  let startPoint;
  if (periodId === '1d') {
    startPoint = data[data.length - 2];
  } else {
    // 基準は「現在時刻」ではなく履歴データの最終点。アプリ時刻と履歴の最終日がズレても
    // 期間が潰れない（履歴が数日古いと 1w が同一点を拾って 0% になるバグの修正）。
    const lastPt = data[data.length - 1];
    const lastMs = lastPt.date instanceof Date ? lastPt.date.getTime() : new Date(lastPt.date).getTime();
    const targetDate = new Date(lastMs - cfg.days * 86400000);
    startPoint = null;
    for (let i = data.length - 2; i >= 0; i--) {
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
    if (periodId === '1d' && p.dayPct != null) {
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
