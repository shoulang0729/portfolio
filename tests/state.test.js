import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage for state import
const localStorageMock = {
  data: {},
  getItem(key) {
    return this.data[key] || null;
  },
  setItem(key, value) {
    this.data[key] = value;
  },
  removeItem(key) {
    delete this.data[key];
  },
  clear() {
    this.data = {};
  },
};

global.localStorage = localStorageMock;

import { state, C, CHART_RANGES, SL_DETAIL_COLS } from '../src/state.js';

describe('state.js', () => {
  describe('C (constants)', () => {
    it('C is frozen object with layout constants', () => {
      expect(Object.isFrozen(C)).toBe(true);
      expect(typeof C).toBe('object');
    });

    it('C has required layout properties', () => {
      const requiredProps = [
        'MOBILE_BREAKPOINT',
        'HEATMAP_ASPECT_MOB',
        'HEATMAP_ASPECT_DSK',
        'HEATMAP_MINH_MOB',
        'HEATMAP_MINH_DSK',
        'SYM_FONT_COEFF',
        'SYM_FONT_MAX',
        'SYM_FONT_MIN',
        'PCT_FONT_RATIO',
        'PCT_FONT_MAX',
        'PCT_FONT_MIN',
        'GAP_RATIO',
        'GAP_SYM_OFFSET',
        'GAP_PCT_OFFSET',
      ];
      for (const prop of requiredProps) {
        expect(C).toHaveProperty(prop);
      }
    });

    it('C values are numbers', () => {
      for (const [key, value] of Object.entries(C)) {
        expect(typeof value).toBe('number');
      }
    });
  });

  describe('state (initial values)', () => {
    it('state matches snapshot', () => {
      // Create a snapshot-safe version (no Set or localStorage refs)
      const stateCopy = {
        ...state,
        fetchingRanges: Array.from(state.fetchingRanges),
      };
      expect(stateCopy).toMatchSnapshot();
    });

    it('state has required properties', () => {
      const requiredProps = [
        'colorMode',
        'changePeriod',
        'lastChangePeriod',
        'historicalCache',
        'fetchingRanges',
        'historicalAttempted',
        'yahooCrumb',
        'yahooCrumbExpiry',
        'autoInterval',
        'countdownTimer',
        'countdownVal',
        'autoSec',
        'currentPos',
        'currentRange',
        'statsVisible',
        'themeMode',
        'listSortCol',
        'listSortDir',
        'slDetailVisible',
        'activeTab',
        'lastUpdateText',
        'watchlist',
        'watchlistPrices',
        'wlSortCol',
        'wlSortDir',
        'prevPrices',
        'forexRate',
      ];
      for (const prop of requiredProps) {
        expect(state).toHaveProperty(prop);
      }
    });

    it('state properties have correct types', () => {
      expect(typeof state.colorMode).toBe('string');
      expect(typeof state.changePeriod).toBe('string');
      expect(typeof state.lastChangePeriod).toBe('string');
      expect(typeof state.historicalCache).toBe('object');
      expect(state.fetchingRanges instanceof Set).toBe(true);
      expect(typeof state.historicalAttempted).toBe('object');
      expect(typeof state.statsVisible).toBe('boolean');
      expect(typeof state.slDetailVisible).toBe('boolean');
      expect(typeof state.activeTab).toBe('string');
      expect(Array.isArray(state.watchlist)).toBe(true);
    });

    it('historicalCache has correct structure', () => {
      expect(state.historicalCache).toHaveProperty('1y');
      expect(state.historicalCache).toHaveProperty('5y');
      expect(state.historicalCache).toHaveProperty('10y');
      expect(typeof state.historicalCache['1y']).toBe('object');
    });
  });

  describe('CHART_RANGES', () => {
    it('CHART_RANGES has required keys', () => {
      const expectedRanges = ['1d', '1w', '1m', '3m', '6m', '9m', '1y', '3y', '5y', '10y'];
      for (const range of expectedRanges) {
        expect(CHART_RANGES).toHaveProperty(range);
      }
    });

    it('each range has required properties', () => {
      for (const [key, config] of Object.entries(CHART_RANGES)) {
        expect(config).toHaveProperty('yRange');
        expect(config).toHaveProperty('interval');
        expect(config).toHaveProperty('dateFmt');
        expect(config).toHaveProperty('label');
        expect(typeof config.yRange).toBe('string');
        expect(typeof config.interval).toBe('string');
        expect(typeof config.dateFmt).toBe('string');
        expect(typeof config.label).toBe('string');
      }
    });
  });

  describe('SL_DETAIL_COLS', () => {
    it('SL_DETAIL_COLS is array', () => {
      expect(Array.isArray(SL_DETAIL_COLS)).toBe(true);
    });

    it('SL_DETAIL_COLS has expected columns', () => {
      expect(SL_DETAIL_COLS).toContain('value');
      expect(SL_DETAIL_COLS).toContain('shares');
      expect(SL_DETAIL_COLS).toContain('avgCost');
      expect(SL_DETAIL_COLS).toContain('pnl');
      expect(SL_DETAIL_COLS).toContain('pnlPct');
    });
  });
});
