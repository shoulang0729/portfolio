import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../src/state.js', () => ({
  state: { historicalCache: {}, colorMode: 'change', changePeriod: '1d' }
}));
vi.mock('../src/positions.js', () => ({
  positions: [],
  PERIOD_MAP: {
    '1d':  { id: '1d',  range: '1y', days: 1 },
    '1m':  { id: '1m',  range: '1y', days: 30 },
    '1y':  { id: '1y',  range: '5y', days: 365 },
    '5y':  { id: '5y',  range: '5y', days: 1825 },
  }
}));

import { state } from '../src/state.js';
import { positions } from '../src/positions.js';
import { getHistoricalChangePct, getDisplayPct, calcPortfolioPeriodPct } from '../src/portfolio-calc.js';

beforeEach(() => {
  state.historicalCache = {};
  state.colorMode = 'change';
  state.changePeriod = '1d';
  positions.length = 0;
});

describe('getHistoricalChangePct', () => {
  it('should calculate 1d percentage correctly', () => {
    state.historicalCache['1y'] = {
      'AAPL': [
        { date: new Date('2025-01-01'), close: 100 },
        { date: new Date('2025-01-02'), close: 110 }
      ]
    };
    const pct = getHistoricalChangePct('AAPL', '1d');
    expect(pct).toBeCloseTo(10, 0.001);
  });

  it('should calculate 1m percentage with date-based startPoint', () => {
    const baseDate = new Date();
    const thirtyDaysAgo = new Date(baseDate.getTime() - 30 * 86400000);
    state.historicalCache['1y'] = {
      'TSLA': [
        { date: new Date('2024-12-01'), close: 100 },
        { date: thirtyDaysAgo, close: 105 },
        { date: baseDate, close: 115 }
      ]
    };
    const pct = getHistoricalChangePct('TSLA', '1m');
    expect(pct).toBeCloseTo((115 - 105) / 105 * 100, 0.001);
  });

  it('should return null for unknown periodId', () => {
    const pct = getHistoricalChangePct('AAPL', 'unknown');
    expect(pct).toBeNull();
  });

  it('should return null if data is not in cache', () => {
    state.historicalCache['1y'] = {};
    const pct = getHistoricalChangePct('MISSING', '1d');
    expect(pct).toBeNull();
  });

  it('should return null if data has less than 2 points', () => {
    state.historicalCache['1y'] = {
      'AAPL': [{ date: new Date('2025-01-01'), close: 100 }]
    };
    const pct = getHistoricalChangePct('AAPL', '1d');
    expect(pct).toBeNull();
  });

  it('should fallback to data[0] when no startPoint before targetDate', () => {
    const baseDate = new Date();
    state.historicalCache['5y'] = {
      'MSFT': [
        { date: new Date('2025-01-01'), close: 100 },
        { date: baseDate, close: 150 }
      ]
    };
    // 1y で targetDate = 365 days ago、data[0] の 2025-01-01 がそれより前なので fallback
    const pct = getHistoricalChangePct('MSFT', '1y');
    expect(pct).toBeCloseTo((150 - 100) / 100 * 100, 0.001);
  });
});

describe('getDisplayPct', () => {
  it('should return pnlPct when colorMode is "pnl"', () => {
    state.colorMode = 'pnl';
    const pos = { pnlPct: 25.5, ySymbol: 'AAPL', dayPct: 1 };
    const pct = getDisplayPct(pos);
    expect(pct).toBe(25.5);
  });

  it('should return null when ySymbol is undefined', () => {
    state.colorMode = 'change';
    const pos = { pnlPct: 10, dayPct: 1 };
    const pct = getDisplayPct(pos);
    expect(pct).toBeNull();
  });

  it('should return dayPct when changePeriod is "1d" and dayPct is defined', () => {
    state.colorMode = 'change';
    state.changePeriod = '1d';
    const pos = { pnlPct: 10, ySymbol: 'AAPL', dayPct: 5 };
    const pct = getDisplayPct(pos);
    expect(pct).toBe(5);
  });

  it('should call getHistoricalChangePct for non-1d periods', () => {
    state.colorMode = 'change';
    state.changePeriod = '1m';
    const baseDate = new Date();
    const thirtyDaysAgo = new Date(baseDate.getTime() - 30 * 86400000);
    state.historicalCache['1y'] = {
      'GOOGL': [
        { date: thirtyDaysAgo, close: 100 },
        { date: baseDate, close: 120 }
      ]
    };
    const pos = { pnlPct: 10, ySymbol: 'GOOGL', dayPct: 5 };
    const pct = getDisplayPct(pos);
    expect(pct).toBeCloseTo((120 - 100) / 100 * 100, 0.001);
  });
});

describe('calcPortfolioPeriodPct', () => {
  it('should calculate weighted average percentage', () => {
    const baseDate = new Date();
    const thirtyDaysAgo = new Date(baseDate.getTime() - 30 * 86400000);
    state.historicalCache['1y'] = {
      'AAPL': [
        { date: thirtyDaysAgo, close: 100 },
        { date: baseDate, close: 101 }
      ],
      'TSLA': [
        { date: thirtyDaysAgo, close: 100 },
        { date: baseDate, close: 98 }
      ]
    };
    positions.push(
      { ySymbol: 'AAPL', value: 1000000, dayPct: null },
      { ySymbol: 'TSLA', value: 2000000, dayPct: null }
    );
    const pct = calcPortfolioPeriodPct('1m');
    // (1000000 * 1 + 2000000 * (-2)) / 3000000 = (1000000 - 4000000) / 3000000 = -1
    expect(pct).toBeCloseTo(-1, 0.001);
  });

  it('should exclude positions where pct is null', () => {
    const baseDate = new Date();
    const thirtyDaysAgo = new Date(baseDate.getTime() - 30 * 86400000);
    state.historicalCache['1y'] = {
      'AAPL': [
        { date: thirtyDaysAgo, close: 100 },
        { date: baseDate, close: 110 }
      ]
    };
    positions.push(
      { ySymbol: 'AAPL', value: 1000000, dayPct: null },
      { ySymbol: 'MISSING', value: 500000, dayPct: null }
    );
    const pct = calcPortfolioPeriodPct('1m');
    // only AAPL counts: (1000000 * 10) / 1000000 = 10
    expect(pct).toBeCloseTo(10, 0.001);
  });

  it('should return null when positions array is empty', () => {
    const pct = calcPortfolioPeriodPct('1d');
    expect(pct).toBeNull();
  });

  it('should return null when all positions have pct=null', () => {
    positions.push(
      { ySymbol: 'MISSING1', value: 1000000, dayPct: null },
      { ySymbol: 'MISSING2', value: 2000000, dayPct: null }
    );
    const pct = calcPortfolioPeriodPct('1y');
    expect(pct).toBeNull();
  });

  it('should use dayPct for 1d period when defined', () => {
    positions.push(
      { ySymbol: 'AAPL', value: 1000000, dayPct: 2 },
      { ySymbol: 'TSLA', value: 1000000, dayPct: 4 }
    );
    const pct = calcPortfolioPeriodPct('1d');
    // (1000000 * 2 + 1000000 * 4) / 2000000 = 3
    expect(pct).toBeCloseTo(3, 0.001);
  });

  it('should exclude positions where dayPct is undefined (1d period)', () => {
    positions.push(
      { ySymbol: 'AAPL', value: 1000000, dayPct: 5 },
      { ySymbol: 'TSLA', value: 1000000 }  // dayPct プロパティ無し → undefined
    );
    const pct = calcPortfolioPeriodPct('1d');
    // TSLA は dayPct undefined で除外、AAPL のみ計上
    expect(pct).toBeCloseTo(5, 0.001);
    expect(pct).not.toBeNaN();
  });
});

describe('getDisplayPct with undefined dayPct', () => {
  it('getDisplayPct should return null when dayPct is undefined for 1d', () => {
    state.colorMode = 'change';
    state.changePeriod = '1d';
    const pos = { ySymbol: 'AAPL' };  // dayPct 無し
    const pct = getDisplayPct(pos);
    expect(pct).toBeNull();
  });
});
