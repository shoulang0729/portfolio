// Tests for live constituents IndexedDB cache (#205 / B6)

import { vi, describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

vi.mock('../src/state.js', () => ({
  state: { liveConstituents: {} },
}));

import { state } from '../src/state.js';
import {
  isStale,
  STALE_DAYS,
  setConstituentEntry,
  restoreConstituentsFromIDB,
  clearConstituentsIDB,
} from '../src/constituents-cache.js';

function entry(asOf) {
  return {
    holdings: [{ ticker: 'AAA', weight: 1, sector: 'tech', country: 'us', currency: 'USD', assetClass: 'equity' }],
    asOf,
    source: 'finnhub',
  };
}

beforeEach(async () => {
  state.liveConstituents = {};
  await clearConstituentsIDB();
});

describe('isStale', () => {
  it('treats missing / invalid asOf as stale', () => {
    expect(isStale(undefined)).toBe(true);
    expect(isStale('')).toBe(true);
    expect(isStale('not-a-date')).toBe(true);
  });

  it('fresh within STALE_DAYS, stale beyond', () => {
    const now = new Date().toISOString();
    expect(isStale(now)).toBe(false);
    const old = new Date(Date.now() - (STALE_DAYS + 1) * 86400000).toISOString();
    expect(isStale(old)).toBe(true);
    const recent = new Date(Date.now() - 2 * 86400000).toISOString();
    expect(isStale(recent)).toBe(false);
  });
});

describe('IDB roundtrip', () => {
  it('persists an entry and restores it into state.liveConstituents', async () => {
    await setConstituentEntry('NVDA', entry('2026-06-01T00:00:00.000Z'));
    expect(state.liveConstituents.NVDA).toBeUndefined(); // set はメモリに書かない

    const n = await restoreConstituentsFromIDB();
    expect(n).toBe(1);
    expect(state.liveConstituents.NVDA.source).toBe('finnhub');
    expect(state.liveConstituents.NVDA.holdings).toHaveLength(1);
  });

  it('does not overwrite an entry already in memory (memory wins)', async () => {
    await setConstituentEntry('NVDA', entry('2026-06-01T00:00:00.000Z'));
    state.liveConstituents.NVDA = entry('2026-06-05T00:00:00.000Z'); // メモリに新しいもの
    const n = await restoreConstituentsFromIDB();
    expect(n).toBe(0);
    expect(state.liveConstituents.NVDA.asOf).toBe('2026-06-05T00:00:00.000Z');
  });

  it('skips malformed stored values', async () => {
    await setConstituentEntry('BAD', /** @type {any} */ ({ asOf: 'x' })); // holdings 無し
    const n = await restoreConstituentsFromIDB();
    expect(n).toBe(0);
    expect(state.liveConstituents.BAD).toBeUndefined();
  });
});
