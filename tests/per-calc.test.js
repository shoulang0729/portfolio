import { describe, it, expect } from 'vitest';

import { score, pickTrailingPE, pickForwardPE, weightedPer } from '../data/scheduler/lib/per-calc.mjs';

// すべて合成値（#652 設計書 §5.2 / §5.5 の例）

describe('score（バンド内の線形%タイル・原本どおり）', () => {
  it.each([
    [16.56, 12, 18.5, 70, 'rich'],
    [11.0, 12, 18.5, 0, 'cheap'],
    [14.1, 12, 18.5, 32, 'cheap'],
    [14.2, 12, 18.5, 34, 'fair'],
  ])('PER %s・band %s〜%s → %s / %s', (per, lo, hi, pct, status) => {
    expect(score(per, lo, hi)).toEqual({ percentile: pct, status });
  });

  it('上限超えは 100 にクランプ → rich', () => {
    expect(score(40, 12, 18.5)).toEqual({ percentile: 100, status: 'rich' });
  });

  it('境界: 33 は cheap・66 は fair・67 は rich', () => {
    expect(score(33, 0, 100)).toEqual({ percentile: 33, status: 'cheap' });
    expect(score(66, 0, 100)).toEqual({ percentile: 66, status: 'fair' });
    expect(score(67, 0, 100)).toEqual({ percentile: 67, status: 'rich' });
  });

  it.each([
    [15, 18.5, 18.5],
    [15, 18.5, 12],
    [15, null, 18.5],
    [15, 12, undefined],
    [0, 12, 18.5],
    [-3, 12, 18.5],
    [NaN, 12, 18.5],
  ])('不正入力（PER %s・band %s〜%s）→ null / hold', (per, lo, hi) => {
    expect(score(per, lo, hi)).toEqual({ percentile: null, status: 'hold' });
  });
});

const qs = (sd, ks) => ({ quoteSummary: { result: [{ summaryDetail: sd, defaultKeyStatistics: ks }] } });

describe('pickTrailingPE', () => {
  it('{raw: x} 形式と素の数値の両方を読む（小数2桁）', () => {
    expect(pickTrailingPE(qs({ trailingPE: { raw: 21.4567, fmt: '21.46' } }, {}))).toBe(21.46);
    expect(pickTrailingPE(qs({ trailingPE: 18.123 }, {}))).toBe(18.12);
  });

  it('summaryDetail 優先 → defaultKeyStatistics にフォールバック', () => {
    expect(pickTrailingPE(qs({ trailingPE: 10 }, { trailingPE: 20 }))).toBe(10);
    expect(pickTrailingPE(qs({}, { trailingPE: { raw: 20.5 } }))).toBe(20.5);
  });

  it.each([[0], [-5], [{ raw: -1 }], ['15'], [NaN], [Infinity], [null]])('%s は null', (v) => {
    expect(pickTrailingPE(qs({ trailingPE: v }, {}))).toBeNull();
  });

  it('result が無い・JSON が空なら null', () => {
    expect(pickTrailingPE({})).toBeNull();
    expect(pickTrailingPE(null)).toBeNull();
    expect(pickTrailingPE({ quoteSummary: { result: [] } })).toBeNull();
  });

  it('pickForwardPE は summaryDetail の forwardPE（無ければ null）', () => {
    expect(pickForwardPE(qs({ forwardPE: { raw: 15.2 } }, {}))).toBe(15.2);
    expect(pickForwardPE(qs({}, { forwardPE: 9 }))).toBeNull();
  });
});

describe('weightedPer', () => {
  it('PER null の銘柄を除いた加重平均と coverage', () => {
    const r = weightedPer([
      { w: 0.05, per: 20 },
      { w: 0.03, per: null },
      { w: 0.02, per: 10 },
    ]);
    expect(r).toEqual({ perCurrent: 17.14, coverage: 0.07 });
  });

  it('全銘柄 PER null なら perCurrent null・coverage 0', () => {
    expect(weightedPer([{ w: 0.05, per: null }])).toEqual({ perCurrent: null, coverage: 0 });
    expect(weightedPer([])).toEqual({ perCurrent: null, coverage: 0 });
  });
});
