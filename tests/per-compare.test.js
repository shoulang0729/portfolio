import { describe, it, expect } from 'vitest';

import {
  compareDay,
  classifySymbol,
  addDays,
  parseStreak,
  nextStreak,
  streakMarker,
  renderComment,
  renderIssueBody,
} from '../data/scheduler/lib/per-compare.mjs';

// すべて合成値（実在の銘柄・評価とは無関係）。shadow 日付 D = 2026-01-10。
const D = '2026-01-10';

/** shadow（watchlist-per --out）の結果を作る */
function shadowOf(results, skipped = [], fund = null) {
  return {
    watchlist: { asOf: D, source: 'worker/yahoo trailingPE', runStartedAt: `${D}T20:15:03.000Z`, results, skipped },
    fund,
  };
}
const shUpd = (perCurrent, percentile, status, bandLow = 10, bandHigh = 30) => ({
  perCurrent,
  percentile,
  status,
  asOf: D,
  bandLow,
  bandHigh,
});
const shKeep = (bandLow = 10, bandHigh = 30) => ({
  perCurrent: 9.9,
  percentile: 50,
  status: 'fair',
  asOf: '2026-01-01',
  note: '自動取得不可→前回維持(週次Opusで補完)',
  bandLow,
  bandHigh,
});
const mu = (perCurrent, percentile, status, asOf = D, bandLow = 10, bandHigh = 30) => ({
  perCurrent,
  percentile,
  status,
  asOf,
  bandLow,
  bandHigh,
  note: '合成',
});

describe('addDays', () => {
  it('UTC で日付を進める（月跨ぎ）', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays(D, 1)).toBe('2026-01-11');
  });
});

describe('compareDay — 5 区分', () => {
  it('match: 両方更新で status と percentile が同じ（PER 値の差は許容）', () => {
    const r = compareDay(shadowOf({ AAA: shUpd(20.0, 50, 'fair') }), { valuations: { AAA: mu(20.04, 50, 'fair') } });
    expect(r.rows.map((x) => x.kind)).toEqual(['match']);
    expect(r.day).toBe('match');
  });

  it('match: 両方未更新', () => {
    const r = compareDay(shadowOf({ AAA: shKeep() }, [{ sym: 'AAA', reason: 'PE無し' }]), {
      valuations: { AAA: mu(9.9, 50, 'fair', '2026-01-01') },
    });
    expect(r.rows[0].kind).toBe('match');
    expect(r.day).toBe('match');
  });

  it('match: Mulmo が 0 時 UTC を跨いだ（asOf = D+1）も更新扱い', () => {
    const r = compareDay(shadowOf({ AAA: shUpd(20.0, 50, 'fair') }), {
      valuations: { AAA: mu(20.0, 50, 'fair', '2026-01-11') },
    });
    expect(r.rows[0].kind).toBe('match');
  });

  it('band-changed: Mulmo のバンドが shadow 計算時と違う → 除外', () => {
    const r = compareDay(shadowOf({ BBB: shUpd(20.0, 50, 'fair', 10, 30) }), {
      valuations: { BBB: mu(20.0, 44, 'fair', D, 12, 30) },
    });
    expect(r.rows[0].kind).toBe('band-changed');
    expect(r.counts['band-changed']).toBe(1);
    // 除外のみの日＝一致
    expect(r.day).toBe('match');
  });

  it('mismatch-input: 計算は同じで PER の入力だけ違う（設計書 §5.3 の例）', () => {
    const r = compareDay(shadowOf({ AAA: shUpd(20.0, 50, 'fair') }), { valuations: { AAA: mu(20.1, 51, 'fair') } });
    expect(r.rows[0].kind).toBe('mismatch-input');
    expect(r.day).toBe('mismatch');
  });

  it('mismatch-logic: Mulmo の値が shadow のバンドで再計算しても合わない', () => {
    const r = compareDay(shadowOf({ AAA: shUpd(20.0, 50, 'fair') }), { valuations: { AAA: mu(20.0, 80, 'rich') } });
    expect(r.rows[0].kind).toBe('mismatch-logic');
    expect(r.day).toBe('mismatch');
  });

  it('one-side-skip: shadow だけ更新／Mulmo だけ更新／Mulmo にエントリ無し', () => {
    const r = compareDay(
      shadowOf({ AAA: shUpd(20.0, 50, 'fair'), BBB: shKeep(), CCC: shUpd(15, 25, 'cheap') }, [
        { sym: 'BBB', reason: 'PE無し' },
      ]),
      {
        valuations: {
          AAA: mu(19.0, 45, 'fair', '2026-01-09'),
          BBB: mu(20.0, 50, 'fair'),
        },
      }
    );
    expect(Object.fromEntries(r.rows.map((x) => [x.sym, x.kind]))).toEqual({
      AAA: 'one-side-skip',
      BBB: 'one-side-skip',
      CCC: 'one-side-skip',
    });
    expect(r.counts['one-side-skip']).toBe(3);
    expect(r.day).toBe('mismatch');
  });

  it('classifySymbol は band-changed を先に判定する', () => {
    const sh = { updated: true, perCurrent: 20, percentile: 50, status: 'fair', bandLow: 10, bandHigh: 30 };
    expect(classifySymbol(sh, { ...sh, bandHigh: 31 })).toBe('band-changed');
    expect(classifySymbol(sh, { ...sh })).toBe('match');
    expect(classifySymbol(sh, null)).toBe('one-side-skip');
  });
});

describe('compareDay — 投信と日の判定', () => {
  const fundOut = {
    asOf: D,
    source: 'fund-monthly-top10',
    funds: { 合成ファンド: { perCurrent: 17.14, coverage: 0.07, source: 'fund-monthly-top10', asOf: '2026-01' } },
  };

  it('投信エントリは判定から除き、perCurrent / coverage を参考表示する', () => {
    const r = compareDay(
      shadowOf(
        {
          AAA: shUpd(20.0, 50, 'fair'),
          合成ファンド: { perCurrent: 17, percentile: null, status: 'na', source: 'fund-monthly-top10' },
        },
        [{ sym: '合成ファンド', reason: 'fund-monthly-top10（fund-per で計算）' }],
        fundOut
      ),
      {
        valuations: {
          AAA: mu(20.0, 50, 'fair'),
          合成ファンド: {
            perCurrent: 17.2,
            coverage: 0.07,
            status: 'na',
            source: 'fund-monthly-top10',
            asOf: '2026-01',
          },
        },
      }
    );
    expect(r.rows.map((x) => x.sym)).toEqual(['AAA']);
    expect(r.funds).toEqual([
      {
        sym: '合成ファンド',
        shadow: { perCurrent: 17.14, coverage: 0.07 },
        mulmo: { perCurrent: 17.2, coverage: 0.07 },
      },
    ]);
    expect(r.day).toBe('match');
  });

  it('一致日: 全銘柄 match', () => {
    const r = compareDay(shadowOf({ AAA: shUpd(20, 50, 'fair'), BBB: shUpd(12, 10, 'cheap') }), {
      valuations: { AAA: mu(20, 50, 'fair'), BBB: mu(12.01, 10, 'cheap') },
    });
    expect(r.day).toBe('match');
    expect(r.counts.match).toBe(2);
  });

  it('不一致日: 1 件でも不一致があれば mismatch（band-changed が混じっても）', () => {
    const r = compareDay(
      shadowOf({ AAA: shUpd(20, 50, 'fair'), BBB: shUpd(20, 50, 'fair'), CCC: shUpd(20, 50, 'fair') }),
      {
        valuations: {
          AAA: mu(20, 50, 'fair'),
          BBB: mu(20, 44, 'fair', D, 12, 30),
          CCC: mu(29, 95, 'rich'),
        },
      }
    );
    expect(r.counts).toMatchObject({ match: 1, 'band-changed': 1, 'mismatch-input': 1 });
    expect(r.day).toBe('mismatch');
  });

  it('判定不能: shadow の結果が無い', () => {
    const r = compareDay(null, { valuations: {} });
    expect(r.day).toBe('undetermined');
    expect(r.reason).toMatch(/shadow/);
  });

  it('判定不能: Mulmo の確定コミットが無い', () => {
    const r = compareDay(shadowOf({ AAA: shUpd(20, 50, 'fair') }), null);
    expect(r.day).toBe('undetermined');
    expect(r.date).toBe(D);
    expect(r.reason).toMatch(/Mulmo/);
  });
});

describe('連続一致日数（トラッキング Issue のマーカー）', () => {
  it('parseStreak: マーカーが無ければ 0 / null、あれば読む', () => {
    expect(parseStreak('')).toEqual({ streak: 0, last: null });
    expect(parseStreak(null)).toEqual({ streak: 0, last: null });
    expect(parseStreak(`本文\n<!-- per-shadow-streak: 2 last: ${D} -->`)).toEqual({ streak: 2, last: D });
    expect(parseStreak(streakMarker({ streak: 0, last: null }))).toEqual({ streak: 0, last: null });
  });

  it('一致日で N+1・不一致日で N=0・判定不能日は据え置き', () => {
    expect(nextStreak({ streak: 1, last: '2026-01-09' }, D, 'match')).toMatchObject({
      streak: 2,
      last: D,
      counted: true,
    });
    expect(nextStreak({ streak: 2, last: '2026-01-09' }, D, 'mismatch')).toMatchObject({
      streak: 0,
      last: D,
      counted: true,
    });
    expect(nextStreak({ streak: 2, last: '2026-01-08' }, D, 'undetermined')).toMatchObject({
      streak: 2,
      last: '2026-01-08',
      counted: false,
    });
  });

  it('同じ日付の二重実行では二重カウントしない', () => {
    const once = nextStreak({ streak: 1, last: '2026-01-09' }, D, 'match');
    const twice = nextStreak(once, D, 'match');
    expect(twice).toMatchObject({ streak: 2, last: D, counted: false, duplicate: true, reached: false });
  });

  it('3 に達した日だけ reached', () => {
    expect(nextStreak({ streak: 2, last: '2026-01-09' }, D, 'match').reached).toBe(true);
    expect(nextStreak({ streak: 3, last: '2026-01-09' }, D, 'match').reached).toBe(false);
    expect(nextStreak({ streak: 1, last: '2026-01-09' }, D, 'match').reached).toBe(false);
  });

  it('Issue 本文にマーカーが入り、往復で読める', () => {
    const body = renderIssueBody({ streak: 3, last: D });
    expect(parseStreak(body)).toEqual({ streak: 3, last: D });
  });

  it('不一致日のコメントに差分表（銘柄・区分・PER/%/status）が入る', () => {
    const r = compareDay(shadowOf({ AAA: shUpd(20.0, 50, 'fair') }), { valuations: { AAA: mu(20.1, 51, 'fair') } });
    const st = nextStreak({ streak: 2, last: '2026-01-09' }, r.date, r.day);
    const c = renderComment(r, st);
    expect(c).toContain('| AAA | `mismatch-input` | 20 / 50 / fair | 20.1 / 51 / fair |');
    expect(c).toContain('リセット');
  });
});
