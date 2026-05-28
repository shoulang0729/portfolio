import { describe, it, expect } from 'vitest';
import { FUND_DEFS, fundSymbolFromName, fundProxyOf, canonicalizeFundPosition } from '../src/funds.js';

describe('funds.js', () => {
  describe('FUND_DEFS structure', () => {
    it('FUND_DEFS は配列', () => {
      expect(Array.isArray(FUND_DEFS)).toBe(true);
      expect(FUND_DEFS.length).toBeGreaterThan(0);
    });

    it('各エントリが必須プロパティを持つ', () => {
      for (const def of FUND_DEFS) {
        expect(def).toHaveProperty('patterns');
        expect(def).toHaveProperty('symbol');
        expect(def).toHaveProperty('canonicalName');
        expect(def).toHaveProperty('ySymbol');
        expect(def).toHaveProperty('proxyName');
        expect(Array.isArray(def.patterns)).toBe(true);
        expect(def.patterns.length).toBeGreaterThan(0);
        expect(typeof def.symbol).toBe('string');
        expect(typeof def.canonicalName).toBe('string');
        expect(typeof def.ySymbol).toBe('string');
        expect(typeof def.proxyName).toBe('string');
      }
    });
  });

  describe('fundSymbolFromName', () => {
    it('引数が null / undefined の場合は null を返す', () => {
      expect(fundSymbolFromName(null)).toBe(null);
      expect(fundSymbolFromName(undefined)).toBe(null);
      expect(fundSymbolFromName('')).toBe(null);
    });

    it('未登録の銘柄名で null を返す', () => {
      expect(fundSymbolFromName('未知の投資信託')).toBe(null);
      expect(fundSymbolFromName('XYZ Fund')).toBe(null);
    });

    it('パターンマッチで登録済み銘柄のシンボルを返す', () => {
      expect(fundSymbolFromName('全世界株式')).toBe('オルカン');
      expect(fundSymbolFromName('ひふみ投信')).toBe('ひふみ投信');
      expect(fundSymbolFromName('マイクロスコープpro')).toBe('ひふみMS');
    });

    it('部分一致でマッチする', () => {
      expect(fundSymbolFromName('eMAXIS Slim 全世界株式(オール・カントリー)')).toBe('オルカン');
      expect(fundSymbolFromName('マイクロプラスプロ')).toBe('ひふみMS');
      expect(fundSymbolFromName('クロスオーバー')).toBe('ひふみXO');
    });

    it('複数パターンで同じシンボルを返す（最初にマッチしたものを返す）', () => {
      // ひふみMS と ひふみ は複数パターンを持つ
      expect(fundSymbolFromName('マイクロスコープ')).toBe('ひふみMS');
      expect(fundSymbolFromName('マイクロプラス')).toBe('ひふみMS');
      expect(fundSymbolFromName('ひふみ')).toBe('ひふみ投信');
    });
  });

  describe('fundProxyOf', () => {
    it('登録済みシンボルに対応する proxy を返す', () => {
      const proxy = fundProxyOf('オルカン');
      expect(proxy).not.toBeNull();
      expect(proxy.ySymbol).toBe('ACWI');
      expect(typeof proxy.proxyName).toBe('string');
    });

    it('未登録シンボルで null を返す', () => {
      expect(fundProxyOf('未知のシンボル')).toBe(null);
      expect(fundProxyOf('XYZ')).toBe(null);
      expect(fundProxyOf('')).toBe(null);
    });

    it('複数のシンボルに異なる proxy を返す', () => {
      const p1 = fundProxyOf('オルカン');
      const p2 = fundProxyOf('ひふみMS');
      expect(p1).not.toBeNull();
      expect(p2).not.toBeNull();
      expect(p1.ySymbol).not.toBe(p2.ySymbol); // または同じ場合も考慮
    });
  });

  describe('canonicalizeFundPosition', () => {
    it('投資信託以外は変更しない', () => {
      const pos = { cat: '日本株・ETF', symbol: '9983', name: 'Company' };
      const result = canonicalizeFundPosition(pos);
      expect(result).toEqual(pos);
    });

    it('null / undefined は null / undefined を返す', () => {
      expect(canonicalizeFundPosition(null)).toBe(null);
      expect(canonicalizeFundPosition(undefined)).toBe(undefined);
    });

    it('投資信託でパターンマッチしたら canonicalName で上書き', () => {
      const pos = {
        cat: '投資信託',
        symbol: '未知',
        name: '全世界株式インデックス',
      };
      const result = canonicalizeFundPosition(pos);
      expect(result.name).toBe('eMAXIS Slim 全世界株式(オール・カントリー)');
      expect(result.symbol).toBe('オルカン');
      expect(result.ySymbol).toBe('ACWI');
    });

    it('投資信託でマッチしなかったら元の値を返す', () => {
      const pos = {
        cat: '投資信託',
        symbol: '未知',
        name: 'Unknown Fund',
      };
      const result = canonicalizeFundPosition(pos);
      expect(result).toEqual(pos);
    });

    it('isProxy フラグを true に設定', () => {
      const pos = {
        cat: '投資信託',
        symbol: '未知',
        name: 'ひふみ投信',
      };
      const result = canonicalizeFundPosition(pos);
      expect(result.isProxy).toBe(true);
    });
  });
});
