// Tests for src/target-allocation.js

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import {
  __setConfig,
  getThemeOf,
  getTargetPct,
  getThemeCap,
  computeThemeUsage,
  computeGap,
  getAiTechConfig,
  getStressConfig,
  getOrderSheetConfig,
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
    semiconductor: { cap: 15, members: ['SMH', '200A.T'] },
    ai_power: { cap: 10, members: ['NLR', 'DTCR', 'URA'] },
    megatech: { cap: 17, members: ['MSFT', 'AMZN', 'AAPL', 'GOOGL', 'TSLA', 'PLTR'] },
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
  it('theme ETF SMH → semiconductor cap 15 ÷ 2 ETFs = 7.5', () => {
    expect(getTargetPct('SMH')).toBe(7.5);
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
  it('semiconductor: used = SMH(8.4) + 200A.T(7.8) = 16.2, cap 15, headroom -1.2', () => {
    const result = computeThemeUsage('semiconductor', { SMH: 8.4, '200A.T': 7.8 });
    expect(result.theme).toBe('semiconductor');
    expect(result.cap).toBe(15);
    expect(result.used).toBeCloseTo(16.2, 10);
    expect(result.headroom).toBeCloseTo(-1.2, 10);
  });

  it('missing member defaults to 0 in used sum', () => {
    const result = computeThemeUsage('semiconductor', { SMH: 7.4 });
    expect(result.used).toBeCloseTo(7.4, 10);
    expect(result.headroom).toBeCloseTo(7.6, 10);
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
    expect(getThemeCap('megatech')).toBe(17);
    expect(getThemeCap('silver')).toBe(1.5);
  });

  it('returns null for unknown theme', () => {
    expect(getThemeCap('nonexistent')).toBeNull();
  });
});

// ── 実データ data/target-allocation.json（#668・2026-10-03 本人決定） ─────
describe('data/target-allocation.json の設定値（#668）', () => {
  const real = JSON.parse(readFileSync(new URL('../data/target-allocation.json', import.meta.url), 'utf8'));

  it('半導体テーマ上限は 15%・megatech は 17%', () => {
    __setConfig(real);
    expect(getThemeCap('semiconductor')).toBe(15);
    expect(getThemeCap('megatech')).toBe(17);
  });
});

// ── 注文表の戦略設定（#671・設計書 2026-10-03-order-sheet §3.2 / §12） ─────
describe('getAiTechConfig / getStressConfig / getOrderSheetConfig', () => {
  const DEFAULT_SCENARIOS = [
    {
      id: 'ai-crash',
      label: 'AI −40%・他の株 −15%',
      shocks: [
        { group: 'aiTech', pct: -40 },
        { group: 'otherEquity', pct: -15 },
      ],
    },
    { id: 'semi-crash', label: '半導体 −50%', shocks: [{ group: 'theme:semiconductor', pct: -50 }] },
  ];

  it('config 未読込（null）なら §3.2 の既定値を返す', () => {
    __setConfig(null);
    expect(getAiTechConfig()).toEqual({ themes: ['semiconductor', 'megatech'], capPct: 29 });
    expect(getStressConfig()).toEqual({
      tolerancePct: 20,
      nonEquity: ['JPST', 'GLDM', 'SLV'],
      scenarios: DEFAULT_SCENARIOS,
    });
    expect(getOrderSheetConfig()).toEqual({ cashFloorPct: 12, rebaseMovePct: 5 });
  });

  it('新キーが無い config（既存キーのみ）でも既定値を返す', () => {
    __setConfig(TEST_CONFIG);
    expect(getAiTechConfig().capPct).toBe(29);
    expect(getStressConfig().tolerancePct).toBe(20);
    expect(getOrderSheetConfig().rebaseMovePct).toBe(5);
  });

  it('設定値があればそれを優先し、欠けた・型不正の項目だけ既定値で補う（合成値）', () => {
    __setConfig({
      ...TEST_CONFIG,
      aiTech: { themes: ['megatech'], capPct: 'x' },
      stress: { tolerancePct: 15, scenarios: [{ id: 's1', label: 'AAA −10%', shocks: [] }] },
      orderSheet: { cashFloorPct: 9 },
    });
    expect(getAiTechConfig()).toEqual({ themes: ['megatech'], capPct: 29 });
    expect(getStressConfig()).toEqual({
      tolerancePct: 15,
      nonEquity: ['JPST', 'GLDM', 'SLV'],
      scenarios: [{ id: 's1', label: 'AAA −10%', shocks: [] }],
    });
    expect(getOrderSheetConfig()).toEqual({ cashFloorPct: 9, rebaseMovePct: 5 });
  });

  it('戻り値を書き換えても既定値は変わらない', () => {
    __setConfig(null);
    getAiTechConfig().themes.push('ai_power');
    getStressConfig().scenarios[0].shocks[0].pct = 0;
    expect(getAiTechConfig().themes).toEqual(['semiconductor', 'megatech']);
    expect(getStressConfig().scenarios[0].shocks[0].pct).toBe(-40);
  });

  it('実データ data/target-allocation.json に aiTech・stress・orderSheet があり §12 の既定案と一致する', () => {
    const real = JSON.parse(readFileSync(new URL('../data/target-allocation.json', import.meta.url), 'utf8'));
    expect(real.aiTech).toMatchObject({ themes: ['semiconductor', 'megatech'], capPct: 29 });
    expect(typeof real.aiTech.note).toBe('string');
    expect(real.stress).toEqual({ tolerancePct: 20, nonEquity: ['JPST', 'GLDM', 'SLV'], scenarios: DEFAULT_SCENARIOS });
    expect(real.orderSheet).toMatchObject({ cashFloorPct: 12, rebaseMovePct: 5 });
    expect(typeof real.orderSheet.note).toBe('string');
    __setConfig(real);
    expect(getAiTechConfig()).toEqual({ themes: ['semiconductor', 'megatech'], capPct: 29 });
    expect(getStressConfig().scenarios).toEqual(DEFAULT_SCENARIOS);
    expect(getOrderSheetConfig()).toEqual({ cashFloorPct: 12, rebaseMovePct: 5 });
  });

  it('既存キーの値は変わっていない（#668 の値を維持）', () => {
    const real = JSON.parse(readFileSync(new URL('../data/target-allocation.json', import.meta.url), 'utf8'));
    expect(real.convictionPct).toEqual({ probe: 0.3, standard: 1.4, high: 3.0 });
    expect(real.themeCaps.semiconductor.cap).toBe(15);
    expect(real.themeCaps.megatech.cap).toBe(17);
  });
});
