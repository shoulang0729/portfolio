import { describe, it, expect } from 'vitest';
import { eventStress } from '../src/risk-calc.js';

/** ヘルパー: {date, close} 系列を作る */
const series = (pairs) => pairs.map(([d, c]) => ({ date: new Date(d), close: c }));

describe('eventStress', () => {
  it('現ウェイトで窓内の期間累積リターンを返す（等加重・1営業日窓）', () => {
    const seriesMap = {
      AAPL: series([['2024-07-31', 100], ['2024-08-05', 90]]), // -10%
      MSFT: series([['2024-07-31', 200], ['2024-08-05', 190]]), // -5%
    };
    const weights = { AAPL: 1, MSFT: 1 };
    const r = eventStress(seriesMap, weights, '2024-07-31', '2024-08-05');
    expect(r.ret).toBeCloseTo(-0.075, 4); // 等加重 → (-10-5)/2
    expect(r.coveragePct).toBe(100);
    expect(r.missing).toEqual([]);
  });

  it('価値ウェイトで加重される', () => {
    const seriesMap = {
      A: series([['2024-07-31', 100], ['2024-08-05', 80]]), // -20%
      B: series([['2024-07-31', 100], ['2024-08-05', 100]]), // 0%
    };
    // A=3, B=1 → -15%
    const r = eventStress(seriesMap, { A: 3, B: 1 }, '2024-07-31', '2024-08-05');
    expect(r.ret).toBeCloseTo(-0.15, 4);
  });

  it('窓内に価格が無い銘柄は除外・再正規化し coverage に反映', () => {
    const seriesMap = {
      A: series([['2024-07-31', 100], ['2024-08-05', 90]]), // -10%
      // B は窓外データのみ → 除外
      B: series([['2023-01-01', 100], ['2023-01-02', 50]]),
    };
    const r = eventStress(seriesMap, { A: 1, B: 1 }, '2024-07-31', '2024-08-05');
    expect(r.ret).toBeCloseTo(-0.1, 4); // A のみで正規化（=A単独）
    expect(r.coveragePct).toBe(50); // 2 本中 1 本
    expect(r.missing).toEqual(['B']);
  });

  it('複数営業日窓は日次リターンを compound する', () => {
    const seriesMap = {
      A: series([
        ['2025-04-02', 100],
        ['2025-04-03', 90], // -10%
        ['2025-04-08', 81], // -10%
      ]),
    };
    const r = eventStress(seriesMap, { A: 1 }, '2025-04-02', '2025-04-08');
    // 0.9 * 0.9 - 1 = -0.19
    expect(r.ret).toBeCloseTo(-0.19, 4);
    expect(r.usableFrom).toBe('2025-04-03');
    expect(r.usableTo).toBe('2025-04-08');
  });

  it('窓内に1点しか無い銘柄のみ → ret null（リターン算出不能）', () => {
    const seriesMap = { A: series([['2024-08-05', 90]]) };
    const r = eventStress(seriesMap, { A: 1 }, '2024-07-31', '2024-08-05');
    expect(r.ret).toBeNull();
    expect(r.coveragePct).toBe(0);
    expect(r.missing).toEqual(['A']);
  });

  it('不正な日付・空ウェイトは安全に null/0', () => {
    expect(eventStress({}, {}, '2024-01-01', '2024-01-05').ret).toBeNull();
    expect(eventStress({ A: series([['2024-01-01', 1]]) }, { A: 1 }, 'bad', 'date').ret).toBeNull();
    // from > to
    expect(eventStress({}, { A: 1 }, '2024-08-05', '2024-07-31').ret).toBeNull();
  });
});
