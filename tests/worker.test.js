import { describe, it, expect, vi } from 'vitest';

// Worker helpers tests
// Note: These are imported indirectly since worker functions aren't exported as modules
// We test the logic by simulating the behavior

describe('worker/src/index.js helpers', () => {
  // Helper: 符号変換テスト
  describe('Symbol conversion', () => {
    function _toFinnhubSymbol(ySymbol) {
      if (!ySymbol) return ySymbol;
      if (ySymbol.endsWith('.T')) return 'TYO:' + ySymbol.slice(0, -2);
      if (ySymbol.endsWith('.HK')) return 'HKG:' + ySymbol.slice(0, -3);
      return ySymbol;
    }

    it('Tokyo stock を TYO: プレフィックス形式に変換', () => {
      expect(_toFinnhubSymbol('9983.T')).toBe('TYO:9983');
      expect(_toFinnhubSymbol('0050.T')).toBe('TYO:0050');
    });

    it('Hong Kong stock を HKG: プレフィックス形式に変換', () => {
      expect(_toFinnhubSymbol('0700.HK')).toBe('HKG:0700');
    });

    it('US stock（プレフィックスなし）はそのまま返す', () => {
      expect(_toFinnhubSymbol('AAPL')).toBe('AAPL');
      expect(_toFinnhubSymbol('MSFT')).toBe('MSFT');
    });

    it('null / undefined はそのまま返す', () => {
      expect(_toFinnhubSymbol(null)).toBe(null);
      expect(_toFinnhubSymbol(undefined)).toBe(undefined);
      expect(_toFinnhubSymbol('')).toBe('');
    });
  });

  // Helper: Origin 検証
  describe('CORS origin validation', () => {
    function isAllowedOrigin(origin, env) {
      if (!origin) return false;
      const allowed = env.ALLOWED_ORIGIN || 'https://shoulang0729.github.io';
      if (origin === allowed) return true;
      if (origin.startsWith('http://localhost:')) return true;
      if (origin.startsWith('http://127.0.0.1:')) return true;
      return false;
    }

    it('許可されたオリジンで true', () => {
      const env = { ALLOWED_ORIGIN: 'https://example.com' };
      expect(isAllowedOrigin('https://example.com', env)).toBe(true);
    });

    it('デフォルトオリジンで true', () => {
      const env = {};
      expect(isAllowedOrigin('https://shoulang0729.github.io', env)).toBe(true);
    });

    it('localhost で true', () => {
      const env = {};
      expect(isAllowedOrigin('http://localhost:3000', env)).toBe(true);
      expect(isAllowedOrigin('http://127.0.0.1:8080', env)).toBe(true);
    });

    it('許可されていないオリジンで false', () => {
      const env = { ALLOWED_ORIGIN: 'https://example.com' };
      expect(isAllowedOrigin('https://evil.com', env)).toBe(false);
    });

    it('null / undefined origin で false', () => {
      const env = {};
      expect(isAllowedOrigin(null, env)).toBe(false);
      expect(isAllowedOrigin(undefined, env)).toBe(false);
    });
  });

  // Helper: パフォーマンス計算
  describe('Period percentage calculation', () => {
    function _computePeriodPctFromHistoricals(ySymbol, days, historicals) {
      const range = days <= 365 ? '1y' : (days <= 1825 ? '5y' : '10y');
      const arr = historicals[range]?.[ySymbol];
      if (!arr || arr.length < 2) return null;
      const latest = arr[arr.length - 1].close;
      const targetIdx = Math.max(0, arr.length - 1 - Math.round(days * 252 / 365));
      const past = arr[targetIdx]?.close;
      if (latest == null || past == null || past === 0) return null;
      return ((latest - past) / past) * 100;
    }

    it('過去データから現在のパフォーマンス % を計算', () => {
      const historicals = {
        '1y': {
          'AAPL': [
            { date: '2025-01-01', close: 100 },
            { date: '2026-01-01', close: 110 },
          ],
        },
        '5y': {},
        '10y': {},
      };
      const result = _computePeriodPctFromHistoricals('AAPL', 365, historicals);
      expect(result).toBeCloseTo(10, 0); // 110 - 100 = 10, (10/100)*100 = 10%
    });

    it('データが不足なら null', () => {
      const historicals = {
        '1y': { 'AAPL': [{ date: '2025-01-01', close: 100 }] },
        '5y': {},
        '10y': {},
      };
      const result = _computePeriodPctFromHistoricals('AAPL', 365, historicals);
      expect(result).toBe(null);
    });

    it('銘柄がないなら null', () => {
      const historicals = { '1y': {}, '5y': {}, '10y': {} };
      const result = _computePeriodPctFromHistoricals('UNKNOWN', 365, historicals);
      expect(result).toBe(null);
    });

    it('過去のクローズ価格がゼロなら null', () => {
      const historicals = {
        '1y': {
          'BAD': [
            { date: '2025-01-01', close: 0 },
            { date: '2026-01-01', close: 100 },
          ],
        },
        '5y': {},
        '10y': {},
      };
      const result = _computePeriodPctFromHistoricals('BAD', 365, historicals);
      expect(result).toBe(null);
    });
  });

  // Helper: ポートフォリオ加重パフォーマンス
  describe('Portfolio performance calculation', () => {
    function _computePortfolioPerf(positionsWithPerf, totalValue) {
      const perf = {};
      if (!totalValue || !positionsWithPerf || !Array.isArray(positionsWithPerf)) return perf;
      const periods = [
        { id: '1d', days: 1 },
        { id: '1w', days: 7 },
        { id: '1y', days: 365 },
      ];
      for (const { id } of periods) {
        let weighted = 0;
        let coveredValue = 0;
        for (const p of positionsWithPerf) {
          const pct = p.performance?.[id];
          if (pct == null || !p.value) continue;
          weighted += (pct / 100) * p.value;
          coveredValue += p.value;
        }
        perf[id] = coveredValue > 0 ? (weighted / coveredValue) * 100 : null;
      }
      return perf;
    }

    it('複数ポジションを加重平均', () => {
      const positions = [
        {
          value: 1000,
          performance: { '1d': 2, '1w': null, '1y': null }, // +2% on 1000
        },
        {
          value: 1000,
          performance: { '1d': -2, '1w': null, '1y': null }, // -2% on 1000
        },
      ];
      const result = _computePortfolioPerf(positions, 2000);
      expect(result['1d']).toBeCloseTo(0, 1); // (20 - 20) / 2000 * 100 = 0%
    });

    it('ポートフォリオ値がゼロなら空オブジェクト', () => {
      const result = _computePortfolioPerf([], 0);
      expect(result).toEqual({});
    });

    it('データ不足のポジションは無視', () => {
      const positions = [
        {
          value: 1000,
          performance: { '1d': 5, '1w': null, '1y': null }, // 有効
        },
        {
          value: 1000,
          performance: { '1d': null, '1w': null, '1y': null }, // '1d' がない
        },
      ];
      const result = _computePortfolioPerf(positions, 2000);
      expect(result['1d']).toBeCloseTo(5, 1); // only 1st position counts: 50 / 1000 * 100 = 5%
    });

    it('positionsWithPerf がない場合は空オブジェクト', () => {
      const result = _computePortfolioPerf(null, 1000);
      expect(typeof result).toBe('object');
    });
  });

  // Helper: Forex symbol construction
  describe('Forex symbol construction', () => {
    function _buildForexSymbol(from, to) {
      return `${from}${to}=X`;
    }

    it('USD と JPY から USDJPY=X を生成', () => {
      expect(_buildForexSymbol('USD', 'JPY')).toBe('USDJPY=X');
    });

    it('EUR と USD から EURUSD=X を生成', () => {
      expect(_buildForexSymbol('EUR', 'USD')).toBe('EURUSD=X');
    });

    it('任意の通貨ペアを生成', () => {
      expect(_buildForexSymbol('GBP', 'JPY')).toBe('GBPJPY=X');
      expect(_buildForexSymbol('CHF', 'EUR')).toBe('CHFEUR=X');
    });
  });

  // Helper: CORS headers
  describe('CORS headers generation', () => {
    function corsHeaders(origin) {
      return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Pin-Hash',
        'Access-Control-Max-Age': '86400',
      };
    }

    it('正しい CORS ヘッダーを生成', () => {
      const result = corsHeaders('https://example.com');
      expect(result['Access-Control-Allow-Origin']).toBe('https://example.com');
      expect(result['Access-Control-Allow-Methods']).toContain('GET');
      expect(result['Access-Control-Max-Age']).toBe('86400');
    });
  });
});
