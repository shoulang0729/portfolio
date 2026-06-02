import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { CONSTITUENTS } from '../src/constituents.js';

describe('CONSTITUENTS coverage', () => {
  it('data/positions.json のすべての symbol が CONSTITUENTS に存在する', () => {
    const positionsJson = JSON.parse(
      readFileSync(new URL('../data/positions.json', import.meta.url), 'utf-8')
    );
    const missing = positionsJson
      .filter(p => p.ySymbol && !p.isProxy)
      .map(p => p.symbol)
      .filter(sym => !CONSTITUENTS[sym]);

    if (missing.length > 0) {
      console.warn('[constituents] 未分類の銘柄:', missing.join(', '));
    }
    expect(missing, `CONSTITUENTS に未登録の銘柄: ${missing.join(', ')}`).toHaveLength(0);
  });
});
