import { describe, it, expect } from 'vitest';
import { sortKeyForLens } from '../src/valuation-tab.js';

describe('sortKeyForLens', () => {
  it('total はサイズバー強調・チップ強調なし', () => {
    expect(sortKeyForLens('total')).toEqual({ chip: null, sizeBar: true });
  });

  it('value は %タイルチップを強調', () => {
    expect(sortKeyForLens('value')).toEqual({ chip: 'pct', sizeBar: false });
  });

  it('quality は Fチップを強調', () => {
    expect(sortKeyForLens('quality')).toEqual({ chip: 'f', sizeBar: false });
  });

  it('momentum はチップ・サイズバーとも強調なし', () => {
    expect(sortKeyForLens('momentum')).toEqual({ chip: null, sizeBar: false });
  });

  it('未知レンズも安全な既定（強調なし）', () => {
    expect(sortKeyForLens('unknown')).toEqual({ chip: null, sizeBar: false });
  });
});
