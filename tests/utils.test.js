import { describe, it, expect, beforeEach } from 'vitest';
import { _tableSort, makeTh, makePctCell, makePeriodCells, makePeriodHeaderCells } from '../src/table.js';
import { getHistoricalChangePct, getDisplayPct, calcPortfolioPeriodPct } from '../src/portfolio-calc.js';
import { state } from '../src/state.js';
import { positions } from '../src/positions.js';

describe('_tableSort', () => {
  beforeEach(() => {
    state.testCol = null;
    state.testDir = 'asc';
  });

  it('sets column when not set', () => {
    _tableSort('testCol', 'testDir', 'name', []);
    expect(state.testCol).toBe('name');
    expect(state.testDir).toBe('desc');
  });

  it('toggles direction when clicking same column', () => {
    state.testCol = 'name';
    state.testDir = 'desc';
    _tableSort('testCol', 'testDir', 'name', []);
    expect(state.testDir).toBe('asc');
  });

  it('respects defaultAscCols', () => {
    _tableSort('testCol', 'testDir', 'symbol', ['symbol']);
    expect(state.testCol).toBe('symbol');
    expect(state.testDir).toBe('asc');
  });

  it('changes to desc for new column not in defaultAscCols', () => {
    _tableSort('testCol', 'testDir', 'pnl', ['symbol']);
    expect(state.testCol).toBe('pnl');
    expect(state.testDir).toBe('desc');
  });
});

describe('makeTh', () => {
  it('generates basic th without sort', () => {
    const html = makeTh('Symbol', '', 'center', null, 'asc');
    expect(html).toContain('<th');
    expect(html).toContain('Symbol');
    expect(html).not.toContain('data-action');
  });

  it('adds sort attributes when sortFnName provided', () => {
    const html = makeTh('Name', 'name', 'center', 'name', 'asc', 'slSort');
    expect(html).toContain('data-action="slSort"');
    expect(html).toContain('data-arg="name"');
  });

  it('includes active sort indicator', () => {
    const html = makeTh('Name', 'name', 'center', 'name', 'desc', 'slSort');
    expect(html).toContain('sort-desc');
  });

  it('includes center alignment class', () => {
    const html = makeTh('Return', 'return', 'center', null, 'asc');
    expect(html).toContain('sl-th-center');
  });

  it('does not add alignment class for non-center', () => {
    const html = makeTh('Name', 'name', 'left', null, 'asc');
    expect(html).not.toContain('sl-th-center');
  });

  it('includes data-col attribute', () => {
    const html = makeTh('Test', 'test-col', 'center', null, 'asc');
    expect(html).toContain('data-col="test-col"');
  });
});

describe('makePctCell', () => {
  it('handles null percentage with loading state', () => {
    state.fetchingRanges = new Set();
    state.historicalAttempted = {};
    const html = makePctCell(null, 25, '1y');
    expect(html).toContain('<td');
    expect(html).toContain('data-col="1y"');
    expect(html).toContain('sl-pct-cell');
  });
});


describe('makePeriodHeaderCells', () => {
  it('generates header cells for all periods', () => {
    const html = makePeriodHeaderCells(null, 'asc', null);
    expect(html).toContain('<th');
  });
});

describe('getHistoricalChangePct', () => {
  beforeEach(() => {
    state.historicalCache = {
      '1d': {
        'AAPL': [
          { date: new Date('2025-05-27'), close: 150 },
          { date: new Date('2025-05-28'), close: 155 },
        ],
      },
      '1y': {
        'AAPL': [
          { date: new Date('2024-05-28'), close: 100 },
          { date: new Date('2024-11-28'), close: 120 },
          { date: new Date('2025-05-28'), close: 155 },
        ],
      },
      '5y': {},
      '10y': {},
    };
  });

  it('calculates 1d change correctly', () => {
    const pct = getHistoricalChangePct('AAPL', '1d');
    expect(pct).toBeCloseTo(29.17, 1);
  });

  it('returns null for missing symbol', () => {
    const pct = getHistoricalChangePct('UNKNOWN', '1y');
    expect(pct).toBeNull();
  });

  it('returns null for invalid periodId', () => {
    const pct = getHistoricalChangePct('AAPL', 'invalid');
    expect(pct).toBeNull();
  });
});

describe('getDisplayPct', () => {
  beforeEach(() => {
    state.colorMode = 'pnl';
    state.changePeriod = '1d';
    state.historicalCache = {
      '1d': {},
      '1y': {},
      '5y': {},
      '10y': {},
    };
  });

  it('returns pnlPct when colorMode is pnl', () => {
    const p = { ySymbol: 'AAPL', pnlPct: 10.5, dayPct: 2.0 };
    const pct = getDisplayPct(p);
    expect(pct).toBe(10.5);
  });

  it('returns dayPct for 1d when available', () => {
    state.colorMode = 'change';
    const p = { ySymbol: 'AAPL', pnlPct: 10.5, dayPct: 2.0 };
    const pct = getDisplayPct(p);
    expect(pct).toBe(2.0);
  });

  it('returns null when no ySymbol', () => {
    state.colorMode = 'change';
    const p = { pnlPct: 10.5 };
    const pct = getDisplayPct(p);
    expect(pct).toBeNull();
  });
});

describe('calcPortfolioPeriodPct', () => {
  beforeEach(() => {
    positions.splice(0, positions.length);
    state.historicalCache = {
      '1d': {
        'AAPL': [
          { date: new Date(Date.now() - 86400000), close: 150 },
          { date: new Date(Date.now()), close: 153 },
        ],
      },
      '1y': {},
      '5y': {},
      '10y': {},
    };
  });

  it('calculates weighted portfolio return', () => {
    positions.push(
      { ySymbol: 'AAPL', value: 1000, dayPct: 2 },
      { ySymbol: 'GOOGL', value: 2000, dayPct: 1 },
    );
    const pct = calcPortfolioPeriodPct('1d');
    expect(pct).toBeCloseTo(1.33, 1);
  });

  it('returns null when no positions', () => {
    const pct = calcPortfolioPeriodPct('1d');
    expect(pct).toBeNull();
  });

  it('ignores positions with null pct', () => {
    positions.push({ ySymbol: 'AAPL', value: 1000 });
    const pct = calcPortfolioPeriodPct('1y');
    expect(pct).toBeNull();
  });
});
