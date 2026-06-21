// @ts-check
// Tests for computeHitRate / __setOutcomes in src/verdict-outcomes.js

import { describe, it, expect } from 'vitest';
import { computeHitRate, resolveOutcome, __setOutcomes } from '../src/verdict-outcomes.js';

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

// ── D-4: resolveOutcome（対ACWI相対で hit/miss）──
describe('resolveOutcome', () => {
  it('action sell: アンダーパフォームで hit / アウトパフォームで miss', () => {
    expect(resolveOutcome({ kind: 'action', dir: 'sell' }, -0.05, 0.02)).toBe('hit'); // pf<bench
    expect(resolveOutcome({ kind: 'action', dir: 'sell' }, 0.05, 0.02)).toBe('miss'); // pf>bench
  });

  it('action buy: アウトパフォームで hit', () => {
    expect(resolveOutcome({ kind: 'action', dir: 'buy' }, 0.08, 0.02)).toBe('hit');
    expect(resolveOutcome({ kind: 'action', dir: 'buy' }, -0.01, 0.02)).toBe('miss');
  });

  it('verdict cheap: アウトパフォームで hit / rich: アンダーパフォームで hit', () => {
    expect(resolveOutcome({ kind: 'verdict', dir: 'cheap' }, 0.1, 0.03)).toBe('hit');
    expect(resolveOutcome({ kind: 'verdict', dir: 'rich' }, -0.04, 0.01)).toBe('hit');
    expect(resolveOutcome({ kind: 'verdict', dir: 'rich' }, 0.04, 0.01)).toBe('miss');
  });

  it('kind 未指定は action 扱い', () => {
    expect(resolveOutcome({ dir: 'sell' }, -0.05, 0.0)).toBe('hit');
  });

  it('方向不明（fair 等）・素材欠損は null', () => {
    expect(resolveOutcome({ kind: 'verdict', dir: 'fair' }, 0.1, 0.0)).toBeNull();
    expect(resolveOutcome({ kind: 'action' }, 0.1, 0.0)).toBeNull(); // dir 無し
    expect(resolveOutcome({ kind: 'action', dir: 'buy' }, null, 0.0)).toBeNull();
    expect(resolveOutcome(null, 0.1, 0.0)).toBeNull();
  });
});

// ── D-4: kind 別 hitRate ＋ proposedOutcome フィル（手動優先）──
describe('computeHitRate – kind 別 / proposedOutcome', () => {
  const sample = [
    { kind: 'action', dir: 'sell', outcome: 'hit', proposedOutcome: null },
    { kind: 'action', dir: 'buy', outcome: 'miss', proposedOutcome: null },
    { kind: 'action', dir: 'buy', outcome: 'pending', proposedOutcome: 'hit' }, // 提案で resolved
    { kind: 'verdict', dir: 'rich', outcome: 'pending', proposedOutcome: 'hit' },
    { kind: 'verdict', dir: 'cheap', outcome: 'pending', proposedOutcome: null }, // pending のまま
  ];

  it('action だけ集計（提案がフィルされる）', () => {
    __setOutcomes(sample);
    const r = computeHitRate('action');
    expect(r.hits).toBe(2); // hit + proposed hit
    expect(r.misses).toBe(1);
    expect(r.pending).toBe(0);
    expect(r.ratePct).toBe(67);
  });

  it('verdict だけ集計', () => {
    __setOutcomes(sample);
    const r = computeHitRate('verdict');
    expect(r.hits).toBe(1); // proposed hit
    expect(r.misses).toBe(0);
    expect(r.pending).toBe(1);
  });

  it('手動 outcome は proposedOutcome より優先', () => {
    __setOutcomes([{ kind: 'action', dir: 'buy', outcome: 'miss', proposedOutcome: 'hit' }]);
    const r = computeHitRate('action');
    expect(r.misses).toBe(1);
    expect(r.hits).toBe(0);
  });
});
