// @ts-check
// per-daily.mjs — 毎日の PER 書き込み（per-daily.yml の write ジョブ）の判定用純関数（#652 PR3・設計書 §6）。
//
// - dailyPerCommitMessage(): 書き込みコミットのメッセージ（固定形式 `data: daily PER <YYYY-MM-DD>`）。
//   Mulmo が main 上のこのコミットの有無（文字列一致）で「Actions が当日分を書いたか」を判定する（§6.2・§9）。
// - runMode(): 引け前（force なしのとき）と 21:45〜22:59 UTC の開始は計算のみ（#708 PR3・2026-10-05-per-daily-dispatch.md §3.3）。
// - isPushBlocked(): 21:50〜22:59 UTC は push しない（#708 PR3・§3.3。Mulmo が PER を待つ期限 21:52 の後〜Mulmo の push 期限）。
// - findDisallowedChanges(): valuations.json の変更が §6.3 の許可フィールドだけかを検査する。
// - isAlreadyWritten(): 米国の引け（夏 20:00・冬 21:00 UTC）以降に当日分のコミットが main にあるか
//   （#708・2026-10-05-per-daily-dispatch.md §3.1・§4.1）。
// - isOnTimeStart(): 開始が引け〜21:44 UTC（Mulmo に間に合う時間帯）か（#708）。
// - writtenSinceIso(): 当日分として数える下限の時刻（ISO。per-daily-gate の git log --since と共用）。

import { FUND_SOURCE } from './per-calc.mjs';
import { usCloseUtcHHMM, MULMO_WAIT_CUTOFF_HHMM } from './us-market-time.mjs';

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

/** per-daily が push しない時間帯の開始（HHMM・#708 PR3 §3.3）。 */
export const PUSH_BLOCK_START_HHMM = 2150;
/** Mulmo の時間帯（計算のみ・push 禁止）の終わり（HHMM・この分を含む・#708 PR3 §3.3）。 */
export const MULMO_WINDOW_END_HHMM = 2259;

/**
 * 開始時刻から実行モードを決める（#708 PR3・2026-10-05-per-daily-dispatch.md §3.3・§4.3(a)）。
 * - 引け（夏 20:00・冬 21:00 UTC）より前: compute-only（引け前の値を書かない）。`force` なら write。
 * - 引け〜21:44: write（夏 20:20・冬 21:20 の Worker 起動はここ）。
 * - 21:45〜22:59（22:59 台を含む）: compute-only（Mulmo の時間帯。`force` でも書かない）。
 * - 23:00〜23:59: write（予備の schedule）。
 * @param {Date} start
 * @param {{ force?: boolean }} [opts]
 * @returns {'write' | 'compute-only'}
 */
export function runMode(start, { force = false } = {}) {
  const t = utcHHMM(start);
  if (t >= MULMO_WAIT_CUTOFF_HHMM && t <= MULMO_WINDOW_END_HHMM) return 'compute-only';
  if (t < usCloseUtcHHMM(start)) return force ? 'write' : 'compute-only';
  return 'write';
}

/**
 * push 禁止時間帯（21:50〜22:59 UTC・22:59 台を含む・#708 PR3 §3.3）。
 * @param {Date} now
 * @returns {boolean}
 */
export function isPushBlocked(now) {
  const t = utcHHMM(now);
  return t >= PUSH_BLOCK_START_HHMM && t <= MULMO_WINDOW_END_HHMM;
}

/** 書き込みコミットの author 名（Mulmo の判定と同じ条件）。 */
export const BOT_AUTHOR = 'github-actions[bot]';

/**
 * now の UTC 日付 D の米国の引けの時刻（`D T20:00:00Z` か `D T21:00:00Z`）。当日分として数える下限（#708 §4.1）。
 * @param {Date} now
 * @returns {string}
 */
export function writtenSinceIso(now) {
  const d = now.toISOString().slice(0, 10);
  const hh = String(Math.floor(usCloseUtcHHMM(now) / 100)).padStart(2, '0');
  return `${d}T${hh}:00:00Z`;
}

/**
 * per-daily-gate already-written が実行する `git log` の引数（#708）。
 * `--since` ではなく `--since-as-filter`（git 2.38+）を使う: `--since` は committer date が下限より古いコミットに
 * 当たった時点で走査を止めるため、HEAD 側に古い committer date のコミット（rebase・cherry-pick 等）があると、
 * その奥にある当日の bot コミットを見落とす。`--since-as-filter` は全履歴を走査して日付で絞り込む。
 * @param {Date} now
 * @returns {string[]}
 */
export function alreadyWrittenLogArgs(now) {
  return ['log', 'HEAD', `--since-as-filter=${writtenSinceIso(now)}`, '--format=%an%x09%cI%x09%s'];
}

/**
 * `alreadyWrittenLogArgs` の出力（`%an\t%cI\t%s` の行）をコミットの配列にする。
 * @param {string} out
 * @returns {Array<{author: string, committedAt: string, subject: string}>}
 */
export function parseCommitLog(out) {
  return String(out || '')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const [author, committedAt, ...subject] = line.split('\t');
      return { author, committedAt, subject: subject.join('\t') };
    });
}

/**
 * 米国の引け（夏 20:00・冬 21:00 UTC）以降に書かれた当日分のコミットがあるか（#708）。
 * 次をすべて満たすコミットが 1 つでもあれば true:
 * - author が `github-actions[bot]`
 * - 件名が `dailyPerCommitMessage(D)` に完全一致（D＝now の UTC 日付）
 * - `close(D) <= committedAt <= now`
 * @param {Array<{author: string, subject: string, committedAt: string}>} commits
 * @param {Date} now
 * @returns {boolean}
 */
export function isAlreadyWritten(commits, now) {
  const d = now.toISOString().slice(0, 10);
  const msg = dailyPerCommitMessage(d);
  const since = Date.parse(writtenSinceIso(now));
  const until = now.getTime();
  return (commits || []).some((c) => {
    if (!c || c.author !== BOT_AUTHOR || c.subject !== msg) return false;
    const t = Date.parse(c.committedAt);
    return !Number.isNaN(t) && t >= since && t <= until;
  });
}

/**
 * 開始が引け〜21:44 UTC（Mulmo に間に合う時間帯）か（#708）。夏は 20:00〜21:44、冬は 21:00〜21:44。
 * @param {Date} start
 * @returns {boolean}
 */
export function isOnTimeStart(start) {
  const t = utcHHMM(start);
  return t >= usCloseUtcHHMM(start) && t < MULMO_WAIT_CUTOFF_HHMM;
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

/**
 * watchlist-per の結果（`--out` の JSON）から、PER を新しく計算できた銘柄数を数える。
 * results のうち skipped に入っていない銘柄（投信エントリは skipped に入るので数えない）。
 * @param {any} watchlistOut `{ results: Record<string, any>, skipped: Array<{sym: string}> }`
 * @returns {number}
 */
export function countWatchlistUpdated(watchlistOut) {
  const results = (watchlistOut && watchlistOut.results) || {};
  const skipped = new Set(((watchlistOut && watchlistOut.skipped) || []).map((/** @type {any} */ s) => s && s.sym));
  return Object.keys(results).filter((sym) => !skipped.has(sym)).length;
}

/**
 * その日の書き込みをコミットしてよいか（2026-10-03 Toshio 決定）。
 * ウォッチの更新が 1 件も無い日は失敗扱い（コミットすると Mulmo が「当日分あり」と誤判定するため）。
 * fund-per だけ成功した日も同じく失敗。skipped の割合の閾値は設けない。
 * @param {any} watchlistOut
 * @returns {boolean}
 */
export function hasWatchlistUpdates(watchlistOut) {
  return countWatchlistUpdated(watchlistOut) > 0;
}
