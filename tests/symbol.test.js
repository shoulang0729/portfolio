// Tests for toFinnhubSymbol in src/data.js

import { describe, it, expect } from 'vitest';
import { toFinnhubSymbol } from '../src/data.js';

describe('toFinnhubSymbol', () => {
  it('converts Tokyo .T suffix', () => {
    expect(toFinnhubSymbol('9983.T')).toBe('TYO:9983');
    expect(toFinnhubSymbol('7203.T')).toBe('TYO:7203');
  });

  it('converts Hong Kong .HK suffix', () => {
    expect(toFinnhubSymbol('0700.HK')).toBe('HKG:0700');
    expect(toFinnhubSymbol('9988.HK')).toBe('HKG:9988');
  });

  it('passes through US symbols unchanged', () => {
    expect(toFinnhubSymbol('AAPL')).toBe('AAPL');
    expect(toFinnhubSymbol('MSFT')).toBe('MSFT');
  });

  it('handles null/undefined gracefully', () => {
    expect(toFinnhubSymbol(null)).toBeNull();
    expect(toFinnhubSymbol(undefined)).toBeNull();
    expect(toFinnhubSymbol('')).toBeNull();
  });
});