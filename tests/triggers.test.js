// Tests for src/triggers.js

import { describe, it, expect, beforeEach } from 'vitest';
import { __setTriggers, getTriggers, evaluateTriggers } from '../src/triggers.js';

/** Sample trigger definitions matching data/triggers.json */
const SAMPLE_TRIGGERS = {
  SMH: { sell: [{ type: 'concentration', theme: 'semiconductor', capPct: 13, action: '1.5〜2割トリム→AI電力へ' }] },
  '200A.T': {
    sell: [{ type: 'concentration', theme: 'semiconductor', capPct: 13, action: '半導体13%超なら二段目5〜10%トリム' }],
  },
  '9983.T': { sell: [{ type: 'valuation', pctGte: 95, action: '1/4トリム利確' }] },
  '8050.T': { sell: [{ type: 'thesis', note: '一過性益の剥落', action: 'winner利確' }] },
  TSLA: { sell: [{ type: 'valuation', pegGte: 3, action: '新規禁止・過大なら縮小' }] },
  MSFT: { buy: [{ type: 'valuation', pctLte: 5, action: '$15K打診→$50K' }] },
  AMZN: { buy: [{ type: 'limit', price: 237.5, dir: 'below', action: '$15K第1弾' }] },
  NLR: { buy: [{ type: 'thesis', note: 'AI電力本丸・マネックス確認後', action: '$50K' }] },
  VGK: { buy: [{ type: 'conditional', note: '原油<$85+ホルムズ正常化', action: '買い戻し' }] },
  CBRS: { buy: [{ type: 'limit', price: 220, dir: 'below', action: '打診' }] },
  '6016.T': { buy: [{ type: 'limit', price: 8500, dir: 'below', action: '打診' }] },
};

beforeEach(() => {
  __setTriggers(SAMPLE_TRIGGERS);
});

// ── getTriggers ───────────────────────────────────────────────
describe('getTriggers', () => {
  it('returns the entry for a known symbol', () => {
    expect(getTriggers('SMH')).toBeTruthy();
    expect(getTriggers('SMH')).toHaveProperty('sell');
  });

  it('returns null for an unknown symbol', () => {
    expect(getTriggers('UNKNOWN')).toBeNull();
  });

  it('returns null for null/undefined input', () => {
    expect(getTriggers(null)).toBeNull();
    expect(getTriggers(undefined)).toBeNull();
  });
});

// ── concentration ─────────────────────────────────────────────
describe('evaluateTriggers – concentration', () => {
  it('SMH: themeUsagePct 14.3 > cap 13 → active sell', () => {
    const result = evaluateTriggers('SMH', { themeUsagePct: 14.3 });
    expect(result.active).toHaveLength(1);
    expect(result.active[0].side).toBe('sell');
    expect(result.active[0].type).toBe('concentration');
    expect(result.active[0].reason).toContain('14.3');
    expect(result.active[0].reason).toContain('13');
  });

  it('SMH: themeUsagePct 12 <= cap 13 → no active', () => {
    const result = evaluateTriggers('SMH', { themeUsagePct: 12 });
    expect(result.active).toHaveLength(0);
  });

  it('SMH: themeUsagePct exactly 13 (not > cap) → no active', () => {
    const result = evaluateTriggers('SMH', { themeUsagePct: 13 });
    expect(result.active).toHaveLength(0);
  });

  it('SMH: themeUsagePct null → no active', () => {
    const result = evaluateTriggers('SMH', { themeUsagePct: null });
    expect(result.active).toHaveLength(0);
  });
});

// ── valuation sell pctGte ─────────────────────────────────────
describe('evaluateTriggers – valuation sell pctGte', () => {
  it('9983.T: percentile 97 >= pctGte 95 → active sell', () => {
    const result = evaluateTriggers('9983.T', { percentile: 97 });
    expect(result.active).toHaveLength(1);
    expect(result.active[0].side).toBe('sell');
    expect(result.active[0].type).toBe('valuation');
    expect(result.active[0].reason).toContain('97');
    expect(result.active[0].reason).toContain('95');
  });

  it('9983.T: percentile 95 >= pctGte 95 → active sell (boundary inclusive)', () => {
    const result = evaluateTriggers('9983.T', { percentile: 95 });
    expect(result.active).toHaveLength(1);
  });

  it('9983.T: percentile 90 < pctGte 95 → no active', () => {
    const result = evaluateTriggers('9983.T', { percentile: 90 });
    expect(result.active).toHaveLength(0);
  });

  it('9983.T: percentile null → no active', () => {
    const result = evaluateTriggers('9983.T', { percentile: null });
    expect(result.active).toHaveLength(0);
  });
});

// ── valuation sell pegGte ─────────────────────────────────────
describe('evaluateTriggers – valuation sell pegGte', () => {
  it('TSLA: peg 4.06 >= pegGte 3 → active sell', () => {
    const result = evaluateTriggers('TSLA', { peg: 4.06 });
    expect(result.active).toHaveLength(1);
    expect(result.active[0].side).toBe('sell');
    expect(result.active[0].reason).toContain('4.1');
    expect(result.active[0].reason).toContain('3');
  });

  it('TSLA: peg 3 >= pegGte 3 → active sell (boundary inclusive)', () => {
    const result = evaluateTriggers('TSLA', { peg: 3 });
    expect(result.active).toHaveLength(1);
  });

  it('TSLA: peg 2 < pegGte 3 → no active', () => {
    const result = evaluateTriggers('TSLA', { peg: 2 });
    expect(result.active).toHaveLength(0);
  });

  it('TSLA: peg null → no active', () => {
    const result = evaluateTriggers('TSLA', { peg: null });
    expect(result.active).toHaveLength(0);
  });
});

// ── valuation buy pctLte ──────────────────────────────────────
describe('evaluateTriggers – valuation buy pctLte', () => {
  it('MSFT: percentile 0 <= pctLte 5 → active buy', () => {
    const result = evaluateTriggers('MSFT', { percentile: 0 });
    expect(result.active).toHaveLength(1);
    expect(result.active[0].side).toBe('buy');
    expect(result.active[0].type).toBe('valuation');
    expect(result.active[0].reason).toContain('0');
    expect(result.active[0].reason).toContain('5');
  });

  it('MSFT: percentile 5 <= pctLte 5 → active buy (boundary inclusive)', () => {
    const result = evaluateTriggers('MSFT', { percentile: 5 });
    expect(result.active).toHaveLength(1);
  });

  it('MSFT: percentile 30 > pctLte 5 → no active', () => {
    const result = evaluateTriggers('MSFT', { percentile: 30 });
    expect(result.active).toHaveLength(0);
  });
});

// ── limit ──────────────────────────────────────────────────────
describe('evaluateTriggers – limit', () => {
  it('AMZN: price 237 <= trigger 237.5 → active buy', () => {
    const result = evaluateTriggers('AMZN', { price: 237 });
    expect(result.active).toHaveLength(1);
    expect(result.active[0].side).toBe('buy');
    expect(result.active[0].type).toBe('limit');
    expect(result.active[0].reason).toContain('237');
  });

  it('AMZN: price 237.5 <= trigger 237.5 → active buy (boundary inclusive)', () => {
    const result = evaluateTriggers('AMZN', { price: 237.5 });
    expect(result.active).toHaveLength(1);
  });

  it('AMZN: price 245 > trigger 237.5 → no active', () => {
    const result = evaluateTriggers('AMZN', { price: 245 });
    expect(result.active).toHaveLength(0);
  });

  it('AMZN: price null → no active', () => {
    const result = evaluateTriggers('AMZN', { price: null });
    expect(result.active).toHaveLength(0);
  });
});

// ── thesis / conditional → watching ──────────────────────────
describe('evaluateTriggers – thesis/conditional always watching', () => {
  it('NLR thesis → watching (never active)', () => {
    const result = evaluateTriggers('NLR', {});
    expect(result.active).toHaveLength(0);
    expect(result.watching).toHaveLength(1);
    expect(result.watching[0].side).toBe('buy');
    expect(result.watching[0].type).toBe('thesis');
    expect(result.watching[0].note).toBe('AI電力本丸・マネックス確認後');
  });

  it('VGK conditional → watching (never active)', () => {
    const result = evaluateTriggers('VGK', { price: 1, percentile: 0 });
    expect(result.active).toHaveLength(0);
    expect(result.watching).toHaveLength(1);
    expect(result.watching[0].type).toBe('conditional');
  });

  it('8050.T thesis sell → watching (never active)', () => {
    const result = evaluateTriggers('8050.T', { percentile: 99, peg: 99 });
    expect(result.active).toHaveLength(0);
    expect(result.watching).toHaveLength(1);
    expect(result.watching[0].side).toBe('sell');
  });
});

// ── unknown symbol ─────────────────────────────────────────────
describe('evaluateTriggers – unknown symbol', () => {
  it('returns empty active and watching for unknown symbol', () => {
    const result = evaluateTriggers('UNKNOWN', { percentile: 99, peg: 99, themeUsagePct: 50 });
    expect(result.active).toHaveLength(0);
    expect(result.watching).toHaveLength(0);
  });
});
