// @ts-check
// Tests for computeVerdict in src/valuations.js

import { describe, it, expect } from 'vitest';
import { computeVerdict } from '../src/valuations.js';

// ── null / cyclical edge cases ─────────────────────────────────
describe('computeVerdict edge cases', () => {
  it('returns na when percentile is null', () => {
    const result = computeVerdict({ percentile: null, value: { perTrail: 20, perFwd: 18 } });
    expect(result.class).toBe('na');
    expect(result.drivers).toEqual([]);
  });

  it('returns na when percentile is undefined', () => {
    const result = computeVerdict({});
    expect(result.class).toBe('na');
  });

  it('returns na with cyclical label when cyclical:true', () => {
    const result = computeVerdict({ percentile: 50, value: { perTrail: 15, perFwd: 20, cyclical: true } });
    expect(result.class).toBe('na');
    expect(result.label).toBe('シクリカル(別物差し)');
    expect(result.drivers).toContain('cyclical');
  });
});

// ── MSFT: percentile=0, cheap zone, fwd<trail, debtHeavy=false → cheap_real ──
describe('computeVerdict MSFT', () => {
  it('cheap_real: low percentile, fwd not rising fast, no debt', () => {
    // perTrail=22.6, perFwd=20.5 → rising check: 20.5 <= 22.6*0.9=20.34? NO (20.5>20.34)
    // f>40? NO. debtHeavy? NO → cheap_real
    const result = computeVerdict({
      percentile: 0,
      value: { perTrail: 22.6, perFwd: 20.5, peg: 1.27, evEbitda: 15.5, debtHeavy: false, targetGapPct: 48 },
    });
    expect(result.class).toBe('cheap_real');
    expect(result.label).toBe('本物の割安');
  });
});

// ── AMZN: percentile=24, cheap zone, debtHeavy=true → cheap_fake ──
describe('computeVerdict AMZN', () => {
  it('cheap_fake: low percentile, debtHeavy=true', () => {
    // perTrail=null → no direction. f=29<40. debtHeavy=true → cheap_fake
    const result = computeVerdict({
      percentile: 24,
      value: { perTrail: null, perFwd: 29.0, peg: 1.37, evEbitda: 17.3, debtHeavy: true },
    });
    expect(result.class).toBe('cheap_fake');
    expect(result.label).toBe('見せかけの割安(フェア)');
  });
});

// ── AAPL: percentile=75, rich zone, not rising/falling → rich_real ──
describe('computeVerdict AAPL', () => {
  it('rich_real: rich percentile, PEG>2, not rising', () => {
    // perTrail=36.1, perFwd=32.7 → rising: 32.7<=36.1*0.9=32.49? NO (32.7>32.49)
    // falling: 32.7>=36.1*1.05=37.905? NO → rich_real
    const result = computeVerdict({
      percentile: 75,
      value: { perTrail: 36.1, perFwd: 32.7, peg: 2.85, evEbitda: 27.0, debtHeavy: false, targetGapPct: 5 },
    });
    expect(result.class).toBe('rich_real');
    expect(result.label).toBe('本物の割高');
  });
});

// ── GOOGL: percentile=59, mid zone → fair ──
describe('computeVerdict GOOGL', () => {
  it('fair: mid zone (31-69)', () => {
    const result = computeVerdict({
      percentile: 59,
      value: { perTrail: 28.1, perFwd: 29.4, peg: 1.83, evEbitda: 27.7, debtHeavy: false },
    });
    expect(result.class).toBe('fair');
    expect(result.drivers).toEqual([]);
  });
});

// ── TSLA: percentile=100, rich zone, rising (186<=389*0.9=350.1) but peg=4.06≥2 → rich_real ──
describe('computeVerdict TSLA', () => {
  it('rich_real: rising but peg>=2 so not rich_fake', () => {
    // perTrail=389, perFwd=186 → rising: 186<=389*0.9=350.1 YES → but peg=4.06≥2 → NOT rich_fake
    // falling: 186>=389*1.05=408.45? NO → rich_real
    const result = computeVerdict({
      percentile: 100,
      value: { perTrail: 389, perFwd: 186, peg: 4.06, evEbitda: 133, debtHeavy: false },
    });
    expect(result.class).toBe('rich_real');
  });
});

// ── PLTR: percentile=4, cheap zone, fwd=81>40 → rich_fake ──
describe('computeVerdict PLTR', () => {
  it('rich_fake: cheap %tile but absolute fwd PER >40', () => {
    // zone=cheap. falling: 81>=144*1.05=151.2? NO. f=81>40 → rich_fake
    const result = computeVerdict({
      percentile: 4,
      value: { perTrail: 144, perFwd: 81, peg: 1.58, evEbitda: 149, debtHeavy: false },
    });
    expect(result.class).toBe('rich_fake');
    expect(result.label).toBe('見せかけの割高(フェア)');
  });
});

// ── 9983.T: percentile=97, rich zone, not rising (48.9>52.8*0.9=47.52) → rich_real ──
describe('computeVerdict 9983.T', () => {
  it('rich_real: rich zone, fwd not rising enough vs trail', () => {
    // rising: 48.9<=52.8*0.9=47.52? NO (48.9>47.52)
    // falling: 48.9>=52.8*1.05=55.44? NO → rich_real
    const result = computeVerdict({
      percentile: 97,
      value: { perTrail: 52.8, perFwd: 48.9, peg: 5.26, debtHeavy: false },
    });
    expect(result.class).toBe('rich_real');
  });
});

// ── 8050.T: percentile=100, rich zone, fwd=23.0 >= trail*1.05=12.285 → trap ──
describe('computeVerdict 8050.T', () => {
  it('trap: rich zone, fwd much higher than trail (falling earnings masked by %tile)', () => {
    // falling: 23.0>=11.7*1.05=12.285 YES → trap
    const result = computeVerdict({
      percentile: 100,
      value: { perTrail: 11.7, perFwd: 23.0, debtHeavy: false },
    });
    expect(result.class).toBe('trap');
    expect(result.label).toBe('罠・一過性益');
    expect(result.sub).toBe('trap_once');
  });
});

// ── 6301.T: cyclical:true → na ──
describe('computeVerdict 6301.T', () => {
  it('na: cyclical flag overrides percentile zone', () => {
    const result = computeVerdict({
      percentile: 79,
      value: { perFwd: 15.9, peg: 2.3, debtHeavy: true, cyclical: true },
    });
    expect(result.class).toBe('na');
    expect(result.label).toBe('シクリカル(別物差し)');
    expect(result.drivers).toContain('cyclical');
  });
});

// ── 罠サブ種別: 割安圏で減益 → trap_cheap ──
describe('computeVerdict trap subtype', () => {
  it('trap_cheap: cheap zone with falling earnings (fwd >> trail)', () => {
    // zone=cheap (pct=15). falling: 18>=12*1.05=12.6 YES → 割安の罠
    const result = computeVerdict({
      percentile: 15,
      value: { perTrail: 12, perFwd: 18, debtHeavy: false },
    });
    expect(result.class).toBe('trap');
    expect(result.sub).toBe('trap_cheap');
    expect(result.label).toBe('罠・割安の罠');
  });
});

// ── 判定確度（confidence）の付与 ──
describe('computeVerdict confidence', () => {
  it('attaches 高/中/低 for a scored verdict', () => {
    const result = computeVerdict({
      percentile: 8,
      value: { perTrail: 18, perFwd: 16, peg: 1.1, debtHeavy: false },
      quality: { fScore: 8 },
    });
    expect(result.class).toBe('cheap_real');
    expect(['高', '中', '低']).toContain(result.confidence);
  });

  it('confidence is null for na / cyclical', () => {
    const na = computeVerdict({ percentile: null, value: {} });
    expect(na.confidence).toBeNull();
    const cyc = computeVerdict({ percentile: 50, value: { cyclical: true } });
    expect(cyc.confidence).toBeNull();
  });
});
