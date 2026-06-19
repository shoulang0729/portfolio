// Tests for src/target-allocation.js

import { describe, it, expect, beforeEach } from 'vitest';
import {
  __setConfig,
  getThemeOf,
  getTargetPct,
  getThemeCap,
  computeThemeUsage,
  computeGap,
} from '../src/target-allocation.js';

/** Minimal config matching the real data/target-allocation.json schema */
const TEST_CONFIG = {
  updated: '2026-06-19',
  denominator: 'managedAssets',
  unitUSD: 50000,
  probeUSD: 10000,
  convictionPct: { probe: 0.3, standard: 1.4, high: 3.0 },
  tiers: {
    core: {
      rule: 'hold/accumulate・トリムしない',
      targets: { オルカン: 11, ひふみ計: 8, '1306.T': 5, ILF: 1.5 },
    },
    defensive: {
      rule: '固定',
      targets: { GLDM: 8, cash: 12.5 },
    },
  },
  themeCaps: {
    semiconductor: { cap: 13, members: ['SMH', '200A.T'] },
    ai_power: { cap: 10, members: ['NLR', 'DTCR', 'URA'] },
    megatech: { cap: 15, members: ['MSFT', 'AMZN', 'AAPL', 'GOOGL', 'TSLA', 'PLTR'] },
    japan_theme: { cap: 10, members: ['1615.T', '1629.T', '9983.T', '8050.T', '6301.T'] },
    commodity_miner: { cap: 5, members: ['COPX', 'REMX'] },
    silver: { cap: 1.5, members: ['SLV'] },
    space: { cap: 3, members: ['SPCX', 'RKLB', 'RDW'] },
    europe: { cap: 5, members: ['VGK'] },
    energy: { cap: 5, members: ['XLE'] },
  },
  themeEtfs: ['SMH', '200A.T', 'NLR', 'DTCR', 'URA', '1615.T', '1629.T', 'COPX', 'REMX', 'SLV', 'VGK', 'XLE'],
  conviction: { MSFT: 'high', AMZN: 'standard' },
  override: { GLDM: { targetPct: 8, note: '保険・$300K例外・固定' } },
};

beforeEach(() => {
  __setConfig(TEST_CONFIG);
});

// ── getTargetPct ─────────────────────────────────────────────
describe('getTargetPct', () => {
  it('returns override targetPct for GLDM (override takes priority over tier)', () => {
    // GLDM is also in tiers.defensive, but override should win
    expect(getTargetPct('GLDM')).toBe(8);
  });

  it('returns core tier target for オルカン', () => {
    expect(getTargetPct('オルカン')).toBe(11);
  });

  it('returns core tier target for 1306.T', () => {
    expect(getTargetPct('1306.T')).toBe(5);
  });

  it('returns convictionPct[high] for MSFT (megatech member with high conviction)', () => {
    expect(getTargetPct('MSFT')).toBe(3.0);
  });

  it('returns convictionPct[standard] for AAPL (megatech member with no explicit conviction)', () => {
    expect(getTargetPct('AAPL')).toBe(1.4);
  });

  it('returns null for unknown symbol', () => {
    expect(getTargetPct('UNKNOWN_XYZ')).toBeNull();
  });

  // テーマ代表ETF: target = テーマ上限 ÷ そのテーマのETF数
  it('theme ETF SMH → semiconductor cap 13 ÷ 2 ETFs = 6.5', () => {
    expect(getTargetPct('SMH')).toBe(6.5);
  });

  it('sole-ETF theme XLE → energy cap 5 ÷ 1 = 5', () => {
    expect(getTargetPct('XLE')).toBe(5);
  });

  it('japan_theme cap 10 split among its 2 ETFs → 1615.T = 5', () => {
    expect(getTargetPct('1615.T')).toBe(5);
  });

  it('single-stock theme member keeps conviction (not ETF rule) → 9983.T = 1.4', () => {
    expect(getTargetPct('9983.T')).toBe(1.4);
  });
});

// ── getThemeOf ───────────────────────────────────────────────
describe('getThemeOf', () => {
  it('returns semiconductor for SMH', () => {
    expect(getThemeOf('SMH')).toBe('semiconductor');
  });

  it('returns europe for VGK', () => {
    expect(getThemeOf('VGK')).toBe('europe');
  });

  it('returns null for unknown symbol', () => {
    expect(getThemeOf('UNKNOWN_XYZ')).toBeNull();
  });

  it('returns null when config is not loaded', () => {
    __setConfig(null);
    expect(getThemeOf('SMH')).toBeNull();
  });
});

// ── computeGap ───────────────────────────────────────────────
describe('computeGap', () => {
  it('over case: currentPct 7.4, target 5 → gapPct ≈ 2.4', () => {
    const result = computeGap('1306.T', 7.4);
    expect(result.symbol).toBe('1306.T');
    expect(result.currentPct).toBe(7.4);
    expect(result.targetPct).toBe(5);
    expect(result.gapPct).toBeCloseTo(2.4, 10);
  });

  it('under case: currentPct 0.5, target 1.5 → gapPct ≈ -1.0', () => {
    const result = computeGap('ILF', 0.5);
    expect(result.targetPct).toBe(1.5);
    expect(result.gapPct).toBeCloseTo(-1.0, 10);
  });

  it('null target → gapPct is null', () => {
    const result = computeGap('UNKNOWN_XYZ', 3.0);
    expect(result.targetPct).toBeNull();
    expect(result.gapPct).toBeNull();
  });
});

// ── computeThemeUsage ────────────────────────────────────────
describe('computeThemeUsage', () => {
  it('semiconductor: used = SMH(7.4) + 200A.T(6.8) = 14.2, cap 13, headroom -1.2', () => {
    const result = computeThemeUsage('semiconductor', { SMH: 7.4, '200A.T': 6.8 });
    expect(result.theme).toBe('semiconductor');
    expect(result.cap).toBe(13);
    expect(result.used).toBeCloseTo(14.2, 10);
    expect(result.headroom).toBeCloseTo(-1.2, 10);
  });

  it('missing member defaults to 0 in used sum', () => {
    const result = computeThemeUsage('semiconductor', { SMH: 7.4 });
    expect(result.used).toBeCloseTo(7.4, 10);
    expect(result.headroom).toBeCloseTo(5.6, 10);
  });

  it('unknown theme → cap null, used 0, headroom null', () => {
    const result = computeThemeUsage('no_such_theme', {});
    expect(result.cap).toBeNull();
    expect(result.used).toBe(0);
    expect(result.headroom).toBeNull();
  });
});

// ── getThemeCap ──────────────────────────────────────────────
describe('getThemeCap', () => {
  it('returns cap for known theme', () => {
    expect(getThemeCap('megatech')).toBe(15);
    expect(getThemeCap('silver')).toBe(1.5);
  });

  it('returns null for unknown theme', () => {
    expect(getThemeCap('nonexistent')).toBeNull();
  });
});
