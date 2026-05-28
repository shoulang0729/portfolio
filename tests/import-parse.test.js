import { describe, it, expect, vi } from 'vitest';
import { parseManexFiles } from '../src/import-parse.js';

// Mock csv.js functions
vi.mock('../src/csv.js', () => ({
  parseCsvText: vi.fn((text) => {
    const lines = text.trim().split('\n');
    return lines.map(line => line.split('\t'));
  }),
  normalizeStr: vi.fn((s) => s.trim()),
  parseNum: vi.fn((s) => {
    if (s == null || s === '') return null;
    const num = parseFloat(String(s).replace(/,/g, ''));
    return isNaN(num) ? null : num;
  }),
  detectCsvType: vi.fn((row) => {
    if (row[3]) return 'jp'; // JP has symbol at index 3
    if (row[1]) return 'us'; // US has ticker at index 1
    if (row[2]) return 'fund'; // Fund has name at index 2
    return null;
  }),
}));

// Mock funds.js functions
vi.mock('../src/funds.js', () => ({
  fundSymbolFromName: vi.fn((name) => {
    const map = { 'ひふみ投信': '1312.T', 'ＳＰ５００': '0050.T' };
    return map[name] || null;
  }),
  fundProxyOf: vi.fn((symbol) => {
    if (symbol === '1312.T') return { ySymbol: '^N225', proxyName: '日経平均' };
    return null;
  }),
}));

// Mock config.js
vi.mock('../src/config.js', () => ({
  WORKER_URL: 'https://example.com',
}));

// Mock data.js
vi.mock('../src/data.js', () => ({
  fetchWithTimeout: vi.fn(),
}));

describe('import-parse.js', () => {
  it('parseManexFiles: 空ファイル配列', async () => {
    const result = await parseManexFiles([]);
    expect(result).toEqual([]);
  });

  it('parseManexFiles: ヘッダーのみのCSV（データなし）', async () => {
    const csvText = '銘柄\tコード\t\t\n\t\t\t';
    const file = {
      name: 'test.csv',
      arrayBuffer: async () => new TextEncoder().encode(csvText).buffer,
      type: 'text/csv',
    };
    const result = await parseManexFiles([file]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('parseManexFiles: パースエラーのファイルはスキップ', async () => {
    const file = {
      name: 'bad.csv',
      arrayBuffer: async () => { throw new Error('Read failed'); },
      type: 'text/csv',
    };
    const result = await parseManexFiles([file]);
    expect(result).toEqual([]);
  });

  it('parseManexFiles: 正しいフォーマットのヘッダーを検出', async () => {
    // Header row with symbol at index 3 (JP type)
    const csvText = '銘柄\tセクタ\t銘柄名\t9983\t\t\t100\t1000\t10\t\t\t5000\t200\n' +
                    'Foo\tBar\tBaz\t9984\t\t\t110\t1100\t11\t\t\t5500\t220';
    const file = {
      name: 'jp.csv',
      arrayBuffer: async () => new TextEncoder().encode(csvText).buffer,
      type: 'text/csv',
    };

    const result = await parseManexFiles([file]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('parseManexFiles: 複数行を処理', async () => {
    const csvText = 'H\tH\tH\t9983\t\t\t100\t1000\t10\t\t\t5000\t200\n' +
                    'H\tH\tH\t9984\t\t\t110\t1100\t11\t\t\t5500\t220';
    const file = {
      name: 'multi.csv',
      arrayBuffer: async () => new TextEncoder().encode(csvText).buffer,
      type: 'text/csv',
    };

    const result = await parseManexFiles([file]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('parseManexFiles: detectCsvType が null を返すとスキップ', async () => {
    const csvText = '\t\t\t\t\t\t\t\t\t\t\t\t\n\t\t\t';
    const file = {
      name: 'unknown.csv',
      arrayBuffer: async () => new TextEncoder().encode(csvText).buffer,
      type: 'text/csv',
    };

    const result = await parseManexFiles([file]);
    expect(Array.isArray(result)).toBe(true);
  });
});
