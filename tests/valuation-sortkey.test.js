import { describe, it, expect } from 'vitest';
import { sortKeyForLens } from '../src/valuation-tab.js';

describe('sortKeyForLens', () => {
  it('total はサイズバー強調・チップ強調なし', () => {
    expect(sortKeyForLens('total')).toEqual({ chip: null, sizeBar: true });
  });

  it('value は %タイルチップを強調', () => {
    expect(sortKeyForLens('value')).toEqual({ chip: 'pct', sizeBar: false });
  });

  it('quality は品質チップを強調（#504 F）', () => {
    expect(sortKeyForLens('quality')).toEqual({ chip: 'qual', sizeBar: false });
  });

  it('momentum はモメンタムチップを強調（#504 F）', () => {
    expect(sortKeyForLens('momentum')).toEqual({ chip: 'mom', sizeBar: false });
  });

  it('未知レンズも安全な既定（強調なし）', () => {
    expect(sortKeyForLens('unknown')).toEqual({ chip: null, sizeBar: false });
  });
});
