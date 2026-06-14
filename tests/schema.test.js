// Tests for watchlist item / valuation validation in src/schema.js

import { describe, it, expect } from 'vitest';
import { validateWatchlistItem, validateWatchlistValuation } from '../src/schema.js';

const baseItem = {
  symbol: '2800.HK',
  name: 'Tracker Fund of Hong Kong',
  exchange: '香港',
  type: 'ETF',
  cur: 'HKD',
};

const validValuation = {
  perCurrent: 13.5,
  bandLow: 6.7,
  bandHigh: 24.2,
  bandMedian: 10.2,
  percentile: 75,
  status: 'rich',
  asOf: '2026-06-14',
  note: '標準域の上限超',
};

describe('validateWatchlistItem', () => {
  it('accepts a minimal valid item (no valuation)', () => {
    expect(() => validateWatchlistItem(baseItem)).not.toThrow();
  });

  it('accepts an item with a valid valuation', () => {
    expect(() => validateWatchlistItem({ ...baseItem, valuation: validValuation })).not.toThrow();
  });

  it('accepts valuation === null (treated as absent)', () => {
    expect(() => validateWatchlistItem({ ...baseItem, valuation: null })).not.toThrow();
  });

  it('rejects missing symbol', () => {
    expect(() => validateWatchlistItem({ ...baseItem, symbol: '' })).toThrow(/symbol/);
  });

  it('rejects a malformed valuation through the item validator', () => {
    expect(() => validateWatchlistItem({ ...baseItem, valuation: { ...validValuation, percentile: 150 } })).toThrow(/percentile/);
  });
});

describe('validateWatchlistValuation', () => {
  it('accepts a valid valuation', () => {
    expect(() => validateWatchlistValuation(validValuation)).not.toThrow();
  });

  it('accepts bandMedian === null', () => {
    expect(() => validateWatchlistValuation({ ...validValuation, bandMedian: null })).not.toThrow();
  });

  it('accepts a valuation without optional note', () => {
    const { note, ...noNote } = validValuation;
    expect(() => validateWatchlistValuation(noNote)).not.toThrow();
  });

  it.each(['perCurrent', 'bandLow', 'bandHigh', 'percentile'])('rejects non-numeric %s', (field) => {
    expect(() => validateWatchlistValuation({ ...validValuation, [field]: 'x' })).toThrow(new RegExp(field));
  });

  it('rejects percentile out of 0–100 range', () => {
    expect(() => validateWatchlistValuation({ ...validValuation, percentile: -1 })).toThrow(/percentile/);
    expect(() => validateWatchlistValuation({ ...validValuation, percentile: 101 })).toThrow(/percentile/);
  });

  it('rejects an unknown status', () => {
    expect(() => validateWatchlistValuation({ ...validValuation, status: 'expensive' })).toThrow(/status/);
  });

  it.each(['cheap', 'fair', 'rich', 'hold'])('accepts known status %s', (status) => {
    expect(() => validateWatchlistValuation({ ...validValuation, status })).not.toThrow();
  });

  it('rejects missing asOf', () => {
    const { asOf, ...noAsOf } = validValuation;
    expect(() => validateWatchlistValuation(noAsOf)).toThrow(/asOf/);
  });

  it('rejects a non-string note', () => {
    expect(() => validateWatchlistValuation({ ...validValuation, note: 42 })).toThrow(/note/);
  });
});
