// @ts-check
// Tests for computeHitRate / __setOutcomes in src/verdict-outcomes.js

import { describe, it, expect } from 'vitest';
import { computeHitRate, __setOutcomes } from '../src/verdict-outcomes.js';

describe('computeHitRate', () => {
  it('3 hits, 1 miss, 2 pending → resolved=4, ratePct=75', () => {
    __setOutcomes([
      { date: '2026-06-04', symbol: 'SMH', call: '売り', outcome: 'hit', note: '' },
      { date: '2026-06-04', symbol: 'GOOGL', call: '売り', outcome: 'hit', note: '' },
      { date: '2026-06-04', symbol: 'SHLD', call: '損切り', outcome: 'hit', note: '' },
      { date: '2026-06-10', symbol: 'NVDA', call: '買い', outcome: 'miss', note: '' },
      { date: '2026-06-19', symbol: 'MSFT', call: '買い', outcome: 'pending', note: '' },
      { date: '2026-06-19', symbol: 'AMZN', call: 'hold', outcome: 'pending', note: '' },
    ]);
    const r = computeHitRate();
    expect(r.hits).toBe(3);
    expect(r.misses).toBe(1);
    expect(r.pending).toBe(2);
    expect(r.resolved).toBe(4);
    expect(r.ratePct).toBe(75);
  });

  it('all pending → resolved=0, ratePct=null', () => {
    __setOutcomes([
      { date: '2026-06-19', symbol: 'MSFT', call: '買い', outcome: 'pending', note: '' },
      { date: '2026-06-19', symbol: 'AMZN', call: 'hold', outcome: 'pending', note: '' },
    ]);
    const r = computeHitRate();
    expect(r.hits).toBe(0);
    expect(r.misses).toBe(0);
    expect(r.pending).toBe(2);
    expect(r.resolved).toBe(0);
    expect(r.ratePct).toBeNull();
  });

  it('empty array → all zeros, ratePct=null', () => {
    __setOutcomes([]);
    const r = computeHitRate();
    expect(r.hits).toBe(0);
    expect(r.misses).toBe(0);
    expect(r.pending).toBe(0);
    expect(r.resolved).toBe(0);
    expect(r.ratePct).toBeNull();
  });
});
