// @ts-check
// us-market-time.mjs — 米国東部の夏時間の判定と米国の引けの時刻（UTC）（#708・docs/handoff/2026-10-05-per-daily-dispatch.md §4.1(a)）。
//
// 規則（2007 年以降の米国の規則）: 夏時間は 3 月第 2 日曜 07:00 UTC 〜 11 月第 1 日曜 06:00 UTC。
// per-daily の起動は 20:20／21:20 UTC（切替は日曜の朝に済んでいる）なので、UTC の暦日だけで判定する。
// Intl には依存しない純関数（Worker 側 worker/src/us-dst.js は同じ規則の複製・PR2）。

/** per-daily が書いてよい開始時刻の上限（これ以上は Mulmo の時間帯）。 */
export const MULMO_WAIT_CUTOFF_HHMM = 2145;

/**
 * その年・月（0 始まり）の第 n 日曜の日（1〜31）。
 * @param {number} year
 * @param {number} month0
 * @param {number} n
 * @returns {number}
 */
function nthSunday(year, month0, n) {
  const dow1 = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  return 1 + ((7 - dow1) % 7) + 7 * (n - 1);
}

/**
 * 米国東部が夏時間か（UTC の暦日で判定。3 月第 2 日曜〜11 月第 1 日曜の前日まで true）。
 * @param {Date} date
 * @returns {boolean}
 */
export function isUsEasternDst(date) {
  const y = date.getUTCFullYear();
  const day = Date.UTC(y, date.getUTCMonth(), date.getUTCDate());
  const start = Date.UTC(y, 2, nthSunday(y, 2, 2));
  const end = Date.UTC(y, 10, nthSunday(y, 10, 1));
  return day >= start && day < end;
}

/**
 * その UTC 日付の米国の引けの時刻（HHMM 整数）。夏時間 2000・冬時間 2100。
 * @param {Date} date
 * @returns {2000 | 2100}
 */
export function usCloseUtcHHMM(date) {
  return isUsEasternDst(date) ? 2000 : 2100;
}
