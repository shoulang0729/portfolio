import { describe, it, expect } from 'vitest';

import { isUsEasternDst, usCloseUtcHHMM, MULMO_WAIT_CUTOFF_HHMM } from '../data/scheduler/lib/us-market-time.mjs';

// #708・docs/handoff/2026-10-05-per-daily-dispatch.md §4.1(a)。日付は UTC。

describe('isUsEasternDst / usCloseUtcHHMM（設計書の表）', () => {
  it.each([
    ['2026-03-07', false, 2100],
    ['2026-03-08', true, 2000], // 第 2 日曜
    ['2026-10-30', true, 2000], // 金
    ['2026-10-31', true, 2000],
    ['2026-11-01', false, 2100], // 第 1 日曜
    ['2026-11-02', false, 2100], // 月
    ['2027-03-13', false, 2100],
    ['2027-03-14', true, 2000], // 第 2 日曜
    ['2027-11-06', true, 2000],
    ['2027-11-07', false, 2100], // 第 1 日曜
  ])('%s → dst=%s close=%s', (day, dst, close) => {
    for (const hhmm of ['00:00', '20:20', '21:20', '23:59']) {
      const d = new Date(`${day}T${hhmm}:00Z`);
      expect(isUsEasternDst(d)).toBe(dst);
      expect(usCloseUtcHHMM(d)).toBe(close);
    }
  });

  it('MULMO_WAIT_CUTOFF_HHMM は 2145', () => {
    expect(MULMO_WAIT_CUTOFF_HHMM).toBe(2145);
  });
});

describe('isUsEasternDst は Intl（America/New_York）と 2026〜2035 の毎日 21:20 UTC で一致する', () => {
  it('10 年分の毎日', () => {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' });
    const offsetOf = (d) => fmt.formatToParts(d).find((p) => p.type === 'timeZoneName')?.value;
    const mismatches = [];
    let days = 0;
    for (let t = Date.UTC(2026, 0, 1, 21, 20); t <= Date.UTC(2035, 11, 31, 21, 20); t += 86400000) {
      const d = new Date(t);
      const intlDst = offsetOf(d) === 'GMT-4';
      if (intlDst !== isUsEasternDst(d)) mismatches.push(d.toISOString());
      days++;
    }
    expect(days).toBe(3652);
    expect(mismatches).toEqual([]);
  });
});
