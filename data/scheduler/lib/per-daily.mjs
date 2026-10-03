// @ts-check
// per-daily.mjs — 毎日の PER 書き込み（per-daily.yml の write ジョブ）の判定用純関数（#652 PR3・設計書 §6）。
//
// - dailyPerCommitMessage(): 書き込みコミットのメッセージ（固定形式 `data: daily PER <YYYY-MM-DD>`）。
//   Mulmo が main 上のこのコミットの有無（文字列一致）で「Actions が当日分を書いたか」を判定する（§6.2・§9）。
// - runMode(): 開始時刻が 20:55〜22:30 UTC なら計算のみ（§2.6）。
// - isPushBlocked(): 21:00〜22:30 UTC は push しない（§2.3）。
// - findDisallowedChanges(): valuations.json の変更が §6.3 の許可フィールドだけかを検査する。

import { FUND_SOURCE } from './per-calc.mjs';

/** 書き込みコミットのメッセージの接頭辞（変更禁止・Mulmo が文字列一致で判定する）。 */
export const COMMIT_PREFIX = 'data: daily PER ';

/** watchlist-per --write が銘柄エントリで書き換えてよいフィールド（§6.3）。 */
export const STOCK_FIELDS = Object.freeze(['perCurrent', 'percentile', 'status', 'asOf']);
/** fund-per --write がファンドエントリで書き換えてよいフィールド（§6.3）。 */
export const FUND_FIELDS = Object.freeze(['perCurrent', 'coverage', 'source', 'asOf', 'components']);
/** トップレベルで書き換えてよいフィールド（§6.3）。 */
export const TOP_FIELDS = Object.freeze(['updated', 'asOf']);

/**
 * 書き込みコミットのメッセージ。日付は書き込んだ asOf と同じ実行時の UTC 日付（§2.5）。
 * @param {string} date `YYYY-MM-DD`
 * @returns {string}
 */
export function dailyPerCommitMessage(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`日付は YYYY-MM-DD 形式が必要です: ${String(date)}`);
  }
  return `${COMMIT_PREFIX}${date}`;
}

/**
 * UTC の時分を HHMM の整数にする（例 20:55 → 2055）。
 * @param {Date} d
 * @returns {number}
 */
export function utcHHMM(d) {
  return d.getUTCHours() * 100 + d.getUTCMinutes();
}

/**
 * 開始時刻から実行モードを決める。20:55〜22:30 UTC（22:30 台を含む）の開始は計算のみ（§2.6）。
 * @param {Date} start
 * @returns {'write' | 'compute-only'}
 */
export function runMode(start) {
  const t = utcHHMM(start);
  return t >= 2055 && t <= 2230 ? 'compute-only' : 'write';
}

/**
 * push 禁止時間帯（21:00〜22:30 UTC・22:30 台を含む。weekly-valuations.yml と同じ判定）。
 * @param {Date} now
 * @returns {boolean}
 */
export function isPushBlocked(now) {
  const t = utcHHMM(now);
  return t >= 2100 && t <= 2230;
}

/**
 * 構造の同値比較（JSON 由来の値のみ想定・キー順は問わない）。
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

/**
 * 2 つのオブジェクトで、許可フィールド以外に違いがあるキーを返す（追加・削除・値の変更）。
 * @param {Record<string, any>} before
 * @param {Record<string, any>} after
 * @param {readonly string[]} allowed
 * @returns {string[]}
 */
function changedKeysExcept(before, after, allowed) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const out = [];
  for (const k of keys) {
    if (allowed.includes(k)) continue;
    const inB = before != null && Object.prototype.hasOwnProperty.call(before, k);
    const inA = after != null && Object.prototype.hasOwnProperty.call(after, k);
    if (inB !== inA || !deepEqual(before[k], after[k])) out.push(k);
  }
  return out.sort();
}

/**
 * valuations.json の書き込み前後を比べ、§6.3 の許可範囲外の変更を列挙する。
 * 返すのはエントリ名（銘柄シンボル／投信名）とフィールド名だけ（値は返さない＝公開ログに出してよい）。
 * - トップ: `updated` / `asOf` 以外の変更は不可（`valuations` は中身を個別に検査）。
 * - エントリの追加・削除は不可。
 * - ファンドエントリ（前後どちらかの source が fund-monthly-top10）: perCurrent/coverage/source/asOf/components のみ可。
 * - それ以外（銘柄）: perCurrent/percentile/status/asOf のみ可。
 * @param {any} before
 * @param {any} after
 * @returns {Array<{entry: string, field: string}>}
 */
export function findDisallowedChanges(before, after) {
  /** @type {Array<{entry: string, field: string}>} */
  const out = [];
  for (const field of changedKeysExcept(before, after, [...TOP_FIELDS, 'valuations'])) {
    out.push({ entry: '(top)', field });
  }
  const vb = (before && before.valuations) || {};
  const va = (after && after.valuations) || {};
  const syms = [...new Set([...Object.keys(vb), ...Object.keys(va)])].sort();
  for (const sym of syms) {
    const inB = Object.prototype.hasOwnProperty.call(vb, sym);
    const inA = Object.prototype.hasOwnProperty.call(va, sym);
    if (!inB) {
      out.push({ entry: sym, field: '(entry added)' });
      continue;
    }
    if (!inA) {
      out.push({ entry: sym, field: '(entry removed)' });
      continue;
    }
    const isFund = vb[sym]?.source === FUND_SOURCE || va[sym]?.source === FUND_SOURCE;
    for (const field of changedKeysExcept(vb[sym], va[sym], isFund ? FUND_FIELDS : STOCK_FIELDS)) {
      out.push({ entry: sym, field });
    }
  }
  return out;
}
