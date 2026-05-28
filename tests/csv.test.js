import { vi, describe, it, expect } from 'vitest';

vi.mock('../src/funds.js', () => ({
  fundSymbolFromName: (name) => {
    // Mock: '投資信託A' → '1234.T'
    return name === '投資信託A' ? '1234.T' : null;
  }
}));

import { normalizeStr, parseCsvText, parseNum, detectCsvType, parseJpRow, parseUsRow, parseFundRow } from '../src/csv.js';

describe('normalizeStr', () => {
  it('should convert full-width alphanum to half-width', () => {
    const result = normalizeStr('ＡＢＣ１２３');
    expect(result).toBe('ABC123');
  });

  it('should trim spaces and convert full-width spaces to half-width', () => {
    const result = normalizeStr('　テスト　');
    expect(result).toBe('テスト');
  });
});

describe('parseNum', () => {
  it('should parse simple numbers', () => {
    expect(parseNum('100')).toBe(100);
    expect(parseNum('3.14')).toBe(3.14);
  });

  it('should remove commas from numbers', () => {
    expect(parseNum('1,000,000')).toBe(1000000);
  });

  it('should remove % sign', () => {
    expect(parseNum('5.5%')).toBe(5.5);
  });

  it('should return null for empty string or null input', () => {
    expect(parseNum('')).toBeNull();
    expect(parseNum(null)).toBeNull();
    expect(parseNum(undefined)).toBeNull();
  });

  it('should return null for non-numeric strings', () => {
    expect(parseNum('abc')).toBeNull();
  });
});

describe('parseCsvText', () => {
  it('should parse basic CSV with commas', () => {
    const text = 'a,b,c\n1,2,3';
    const result = parseCsvText(text);
    expect(result).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3']
    ]);
  });

  it('should handle quoted cells with commas inside', () => {
    const text = '"a,b",c,d\n"1,2",3,4';
    const result = parseCsvText(text);
    expect(result).toEqual([
      ['a,b', 'c', 'd'],
      ['1,2', '3', '4']
    ]);
  });

  it('should skip empty lines', () => {
    const text = 'a,b\n\n1,2';
    const result = parseCsvText(text);
    expect(result).toEqual([
      ['a', 'b'],
      ['1', '2']
    ]);
  });

  it('should handle escaped quotes inside quoted cells', () => {
    const text = '"a""b",c';
    const result = parseCsvText(text);
    expect(result).toEqual([
      ['a"b', 'c']
    ]);
  });
});

describe('detectCsvType', () => {
  it('should detect JP stock CSV by 銘柄コード', () => {
    const headerRow = ['日付', '銘柄コード', '銘柄名'];
    expect(detectCsvType(headerRow)).toBe('jp');
  });

  it('should detect US stock CSV by 保有数[株]', () => {
    const headerRow = ['銘柄', '保有数[株]', '価格'];
    expect(detectCsvType(headerRow)).toBe('us');
  });

  it('should detect fund CSV by 基準価額', () => {
    const headerRow = ['銘柄名', '基準価額', '口数'];
    expect(detectCsvType(headerRow)).toBe('fund');
  });

  it('should return null for unknown CSV type', () => {
    const headerRow = ['col1', 'col2', 'col3'];
    expect(detectCsvType(headerRow)).toBeNull();
  });
});

describe('parseJpRow', () => {
  it('should parse JP stock row correctly', () => {
    const row = [
      '2026-01-01', '10:00', 'テスト銘柄', '9983', '東証', '特別', '全額',
      '100', '90', '100', 'xxx', 'xxx', '10000', '1000'
    ];
    const result = parseJpRow(row);
    expect(result).toEqual({
      symbol: '9983',
      price: 100,
      avgCost: 90,
      shares: 100,
      value: 10000,
      pnl: 1000,
      pnlPct: expect.closeTo(11.11, 1) // 1000 / (90 * 100) * 100 = 11.11%
    });
  });

  it('should return null when symbol is empty', () => {
    const row = ['', '', '', '', '', '', '', '100', '90', '100'];
    const result = parseJpRow(row);
    expect(result).toBeNull();
  });

  it('should handle missing PnL columns', () => {
    const row = ['date', 'time', 'name', '9983', 'market', 'account', 'deposit', '100', '90', '100', 'x', 'x', '10000'];
    const result = parseJpRow(row);
    expect(result?.pnlPct).toBeNull(); // pnl is undefined/null
  });
});

describe('parseUsRow', () => {
  it('should parse US stock row correctly', () => {
    // cols: [0]name, [1]ticker, [2]market, [3]account, [4]shares, [5]x, [6]x, [7]avgCost, [8-9]x, [10]price, [11-15]x, [16]value, [17]x, [18]pnl
    const row = [
      'Apple Inc.', 'AAPL', 'NASDAQ', 'account', '100',
      'x', 'x', '150', 'x', 'x', '160',
      'x', 'x', 'x', 'x', 'x', '16000', 'x', '1000'
    ];
    const result = parseUsRow(row);
    expect(result?.ticker).toBe('AAPL');
    expect(result?.shares).toBe(100);
    expect(result?.avgCost).toBe(150);
    expect(result?.price).toBe(160);
    expect(result?.value).toBe(16000);
    expect(result?.pnl).toBe(1000);
  });

  it('should return null when ticker is empty', () => {
    const row = ['Apple Inc.', '', 'NASDAQ'];
    const result = parseUsRow(row);
    expect(result).toBeNull();
  });
});

describe('parseFundRow', () => {
  it('should parse fund row and map name to symbol via fundSymbolFromName', () => {
    const row = [
      'date', 'time', '投資信託A', 'account', 'deposit', '100', 'type', '10000',
      'xxx', 'xxx', 'xxx', '95', '10000', '500'
    ];
    const result = parseFundRow(row);
    expect(result?.symbol).toBe('1234.T'); // mock returns this for '投資信託A'
    expect(result?.price).toBe(100);
    expect(result?.value).toBe(10000);
    expect(result?.pnl).toBe(500);
  });

  it('should return null when fundSymbolFromName returns null', () => {
    const row = ['date', 'time', '未知の投信', 'account', 'deposit'];
    const result = parseFundRow(row);
    expect(result).toBeNull();
  });

  it('should return null when fund name is empty', () => {
    const row = ['date', 'time', '', 'account'];
    const result = parseFundRow(row);
    expect(result).toBeNull();
  });
});
