import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mergeDuplicatePositions, computeImportDiff } from '../src/positions-store.js';

describe('mergeDuplicatePositions', () => {
  it('重複なし：そのまま返す', () => {
    const input = [
      { symbol: 'AAPL', shares: 10, avgCost: 150, value: 1500, pnl: 100 },
      { symbol: 'GOOGL', shares: 5, avgCost: 2800, value: 14000, pnl: 500 },
    ];
    const result = mergeDuplicatePositions(input);
    expect(result).toHaveLength(2);
    expect(result[0].symbol).toBe('AAPL');
  });

  it('重複あり：shares合算・avgCost加重平均', () => {
    const input = [
      { symbol: 'AAPL', shares: 10, avgCost: 150, value: 1500, pnl: 100, price: 155 },
      { symbol: 'AAPL', shares: 20, avgCost: 160, value: 3200, pnl: 200, price: 160 },
    ];
    const result = mergeDuplicatePositions(input);
    expect(result).toHaveLength(1);
    expect(result[0].shares).toBe(30);
    expect(result[0].avgCost).toBeCloseTo((150 * 10 + 160 * 20) / 30, 1);
    expect(result[0].value).toBe(4700);
    expect(result[0].pnl).toBe(300);
  });

  it('3個の重複：複数マージ', () => {
    const input = [
      { symbol: 'BRK', shares: 5, avgCost: 500, value: 2500, pnl: 0 },
      { symbol: 'BRK', shares: 3, avgCost: 510, value: 1530, pnl: 30 },
      { symbol: 'BRK', shares: 2, avgCost: 490, value: 980, pnl: 0 },
    ];
    const result = mergeDuplicatePositions(input);
    expect(result).toHaveLength(1);
    expect(result[0].shares).toBe(10);
    expect(result[0].value).toBe(5010);
    expect(result[0].pnl).toBe(30);
  });

  it('空配列', () => {
    const result = mergeDuplicatePositions([]);
    expect(result).toEqual([]);
  });

  it('null入力', () => {
    const result = mergeDuplicatePositions(null);
    expect(result).toBe(null);
  });

  it('undefined入力', () => {
    const result = mergeDuplicatePositions(undefined);
    expect(result).toBe(undefined);
  });

  it('symbol未設定のポジション（ガード）', () => {
    const input = [
      { symbol: 'AAPL', shares: 10, avgCost: 150, value: 1500, pnl: 100 },
      { shares: 20, avgCost: 160, value: 3200, pnl: 200 },
    ];
    const result = mergeDuplicatePositions(input);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('AAPL');
  });

  it('pnlPct計算確認（重複マージ時）', () => {
    const input = [
      { symbol: 'TEST', shares: 10, avgCost: 100, value: 1000, pnl: 0 },
      { symbol: 'TEST', shares: 0, avgCost: 0, value: 100, pnl: 100 },
    ];
    const result = mergeDuplicatePositions(input);
    expect(result[0].pnlPct).toBeCloseTo(10, 1);
  });
});

describe('computeImportDiff', () => {
  it('added のみ', () => {
    const current = [{ symbol: 'AAPL', shares: 10, avgCost: 150 }];
    const incoming = [
      { symbol: 'AAPL', shares: 10, avgCost: 150 },
      { symbol: 'GOOGL', shares: 5, avgCost: 2800 },
    ];
    const { added, removed, changed, unchanged } = computeImportDiff(current, incoming);
    expect(added).toHaveLength(1);
    expect(added[0].symbol).toBe('GOOGL');
    expect(removed).toHaveLength(0);
    expect(changed).toHaveLength(0);
    expect(unchanged).toHaveLength(1);
  });

  it('removed のみ', () => {
    const current = [
      { symbol: 'AAPL', shares: 10, avgCost: 150 },
      { symbol: 'GOOGL', shares: 5, avgCost: 2800 },
    ];
    const incoming = [{ symbol: 'AAPL', shares: 10, avgCost: 150 }];
    const { added, removed, changed, unchanged } = computeImportDiff(current, incoming);
    expect(added).toHaveLength(0);
    expect(removed).toHaveLength(1);
    expect(removed[0].symbol).toBe('GOOGL');
    expect(unchanged).toHaveLength(1);
  });

  it('changed：shares が異なる', () => {
    const current = [{ symbol: 'AAPL', shares: 10, avgCost: 150 }];
    const incoming = [{ symbol: 'AAPL', shares: 20, avgCost: 150 }];
    const { added, removed, changed, unchanged } = computeImportDiff(current, incoming);
    expect(changed).toHaveLength(1);
    expect(changed[0].symbol).toBe('AAPL');
    expect(added).toHaveLength(0);
    expect(removed).toHaveLength(0);
  });

  it('changed：avgCost が異なる', () => {
    const current = [{ symbol: 'AAPL', shares: 10, avgCost: 150 }];
    const incoming = [{ symbol: 'AAPL', shares: 10, avgCost: 160 }];
    const { added, removed, changed, unchanged } = computeImportDiff(current, incoming);
    expect(changed).toHaveLength(1);
    expect(changed[0].symbol).toBe('AAPL');
  });

  it('unchanged：全く同じ', () => {
    const current = [{ symbol: 'AAPL', shares: 10, avgCost: 150 }];
    const incoming = [{ symbol: 'AAPL', shares: 10, avgCost: 150 }];
    const { added, removed, changed, unchanged } = computeImportDiff(current, incoming);
    expect(unchanged).toHaveLength(1);
    expect(unchanged[0].symbol).toBe('AAPL');
    expect(added).toHaveLength(0);
    expect(removed).toHaveLength(0);
    expect(changed).toHaveLength(0);
  });

  it('複合：added + removed + changed + unchanged', () => {
    const current = [
      { symbol: 'AAPL', shares: 10, avgCost: 150 },
      { symbol: 'GOOGL', shares: 5, avgCost: 2800 },
      { symbol: 'MSFT', shares: 15, avgCost: 300 },
      { symbol: 'AMZN', shares: 3, avgCost: 3200 },
    ];
    const incoming = [
      { symbol: 'AAPL', shares: 10, avgCost: 150 },
      { symbol: 'GOOGL', shares: 10, avgCost: 2800 },
      { symbol: 'MSFT', shares: 15, avgCost: 300 },
      { symbol: 'NVDA', shares: 7, avgCost: 800 },
    ];
    const { added, removed, changed, unchanged } = computeImportDiff(current, incoming);
    expect(added).toHaveLength(1);
    expect(added[0].symbol).toBe('NVDA');
    expect(removed).toHaveLength(1);
    expect(removed[0].symbol).toBe('AMZN');
    expect(changed).toHaveLength(1);
    expect(changed[0].symbol).toBe('GOOGL');
    expect(unchanged).toHaveLength(2);
    expect(unchanged.map(p => p.symbol).sort()).toEqual(['AAPL', 'MSFT']);
  });

  it('空リスト相互', () => {
    const { added, removed, changed, unchanged } = computeImportDiff([], []);
    expect(added).toHaveLength(0);
    expect(removed).toHaveLength(0);
    expect(changed).toHaveLength(0);
    expect(unchanged).toHaveLength(0);
  });
});
