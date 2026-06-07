// Tests for Finnhub profile2 → app attribute mapping (#203 / B4)

import { describe, it, expect } from 'vitest';
import { mapFinnhubIndustry, mapFinnhubCountry, buildStockConstituent } from '../src/data-stock-profile.js';

describe('mapFinnhubIndustry', () => {
  it('maps exact industry strings (case-insensitive)', () => {
    expect(mapFinnhubIndustry('Technology')).toBe('tech');
    expect(mapFinnhubIndustry('semiconductors')).toBe('semis');
    expect(mapFinnhubIndustry('Banking')).toBe('financials');
    expect(mapFinnhubIndustry('Pharmaceuticals')).toBe('healthcare');
    expect(mapFinnhubIndustry('Oil & Gas')).toBe('energy');
    expect(mapFinnhubIndustry('Real Estate')).toBe('realestate');
  });

  it('falls back to partial match', () => {
    // 'Internet Software & Services' は完全一致しないが 'internet'/'software' を含む
    expect(mapFinnhubIndustry('Internet Software & Services')).toBe('tech');
  });

  it('returns null for unknown / empty', () => {
    expect(mapFinnhubIndustry('Quantum Widgets')).toBeNull();
    expect(mapFinnhubIndustry('')).toBeNull();
    expect(mapFinnhubIndustry(undefined)).toBeNull();
  });
});

describe('mapFinnhubCountry', () => {
  it('maps ISO-2 codes to app country keys', () => {
    expect(mapFinnhubCountry('US')).toBe('us');
    expect(mapFinnhubCountry('jp')).toBe('japan');
    expect(mapFinnhubCountry('HK')).toBe('china');
    expect(mapFinnhubCountry('BR')).toBe('latam');
    expect(mapFinnhubCountry('DE')).toBe('europe');
    expect(mapFinnhubCountry('IN')).toBe('em');
  });

  it('returns null for unknown / empty', () => {
    expect(mapFinnhubCountry('ZZ')).toBeNull();
    expect(mapFinnhubCountry('')).toBeNull();
    expect(mapFinnhubCountry(undefined)).toBeNull();
  });
});

describe('buildStockConstituent', () => {
  it('builds a single weight-1 holding with mapped sector/country and equity assetClass', () => {
    const entry = buildStockConstituent(
      { finnhubIndustry: 'Technology', country: 'US' }, 'NVDA', 'USD'
    );
    expect(entry).not.toBeNull();
    expect(entry.source).toBe('finnhub');
    expect(entry.holdings).toHaveLength(1);
    const h = entry.holdings[0];
    expect(h.weight).toBe(1);
    expect(h.sector).toBe('tech');
    expect(h.country).toBe('us');
    expect(h.currency).toBe('USD');
    expect(h.assetClass).toBe('equity');
  });

  it('omits an unmapped dimension but still builds when the other maps', () => {
    const entry = buildStockConstituent(
      { finnhubIndustry: 'Quantum Widgets', country: 'JP' }, '9999', 'JPY'
    );
    expect(entry).not.toBeNull();
    const h = entry.holdings[0];
    expect(h.sector).toBeUndefined();   // 未マップ業種はセクターを付けない
    expect(h.country).toBe('japan');
    expect(h.currency).toBe('JPY');
  });

  it('returns null when neither sector nor country can be mapped', () => {
    const entry = buildStockConstituent(
      { finnhubIndustry: 'Quantum Widgets', country: 'ZZ' }, 'XXXX', 'USD'
    );
    expect(entry).toBeNull();
  });
});
