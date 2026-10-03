// @ts-check
// per-compare.mjs（lib）— 毎日の PER 並行運転の突き合わせ（純関数・#652 §5.3）。
//
// shadow（Actions の計算のみ実行の結果）と Mulmo の確定値（valuations.json）を銘柄ごとに比べ、5 区分に分ける。
//   match          両方更新で status と percentile が同じ／両方未更新            → 一致
//   band-changed   Mulmo 確定値の bandLow/bandHigh が shadow 計算時と違う       → 集計から除外
//   mismatch-input 不一致だが score(Mulmo の perCurrent, shadow のバンド) が Mulmo の値と一致 → 不一致（診断用の区分）
//   mismatch-logic 上記以外の不一致                                              → 不一致
//   one-side-skip  片方だけ更新                                                  → 不一致
// 日の判定: 比較対象（除外後）がすべて match → match（一致日）／1 件でも不一致 → mismatch（不一致日）／
//   shadow 結果が無い・Mulmo の確定値が無い → undetermined（判定不能日・連続日数は据え置き）。
// 投信エントリ（fund-per）は perCurrent と coverage を参考表示のみ（判定に使わない）。

import { score, FUND_SOURCE } from './per-calc.mjs';

export const KINDS = /** @type {const} */ ([
  'match',
  'band-changed',
  'mismatch-input',
  'mismatch-logic',
  'one-side-skip',
]);
export const MISMATCH_KINDS = new Set(['mismatch-input', 'mismatch-logic', 'one-side-skip']);

/**
 * 'YYYY-MM-DD' に n 日足す（UTC）。
 * @param {string} date
 * @param {number} n
 */
export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** @param {any} a @param {any} b */
const sameNum = (a, b) => (a ?? null) === (b ?? null);

/**
 * 1 銘柄の区分を決める。
 * @param {{updated: boolean, perCurrent: any, percentile: any, status: any, bandLow: any, bandHigh: any}} sh
 * @param {{updated: boolean, perCurrent: any, percentile: any, status: any, bandLow: any, bandHigh: any} | null} mu
 * @returns {string}
 */
export function classifySymbol(sh, mu) {
  if (mu && (!sameNum(mu.bandLow, sh.bandLow) || !sameNum(mu.bandHigh, sh.bandHigh))) return 'band-changed';
  const muUpdated = !!(mu && mu.updated);
  if (!sh.updated && !muUpdated) return 'match';
  if (sh.updated !== muUpdated) return 'one-side-skip';
  if (sh.status === mu.status && sh.percentile === mu.percentile) return 'match';
  const re = score(mu.perCurrent, sh.bandLow, sh.bandHigh);
  if (re.status === mu.status && re.percentile === mu.percentile) return 'mismatch-input';
  return 'mismatch-logic';
}

/**
 * @typedef {{
 *   day: 'match' | 'mismatch' | 'undetermined',
 *   date: string | null,
 *   reason?: string,
 *   rows: Array<{sym: string, kind: string, shadow: any, mulmo: any}>,
 *   funds: Array<{sym: string, shadow: {perCurrent: any, coverage: any} | null, mulmo: {perCurrent: any, coverage: any} | null}>,
 *   counts: Record<string, number>,
 * }} CompareResult
 */

/** @returns {Record<string, number>} */
const emptyCounts = () => Object.fromEntries(KINDS.map((k) => [k, 0]));

/**
 * 1 日分の突き合わせ。
 * @param {{watchlist?: any, fund?: any} | null} shadow  watchlist-per と fund-per の `--out` 結果
 * @param {any} mulmoDoc Mulmo の確定コミット時点の valuations.json（無ければ null）
 * @returns {CompareResult}
 */
export function compareDay(shadow, mulmoDoc) {
  const wl = shadow?.watchlist;
  const date = wl?.asOf ?? null;
  if (!wl || !wl.results || !date) {
    return {
      day: 'undetermined',
      date,
      reason: 'shadow の結果（artifact）が無い',
      rows: [],
      funds: [],
      counts: emptyCounts(),
    };
  }
  if (!mulmoDoc || !mulmoDoc.valuations) {
    return {
      day: 'undetermined',
      date,
      reason: 'shadow 実行開始以降の Mulmo の確定コミットが無い',
      rows: [],
      funds: [],
      counts: emptyCounts(),
    };
  }

  const vals = mulmoDoc.valuations;
  const okDates = new Set([date, addDays(date, 1)]);
  const skipped = new Set((wl.skipped || []).map((/** @type {any} */ s) => s.sym));
  const fundSyms = new Set(Object.keys(shadow?.fund?.funds || {}));

  const rows = [];
  const counts = emptyCounts();
  for (const [sym, r] of Object.entries(wl.results)) {
    const m = vals[sym];
    if (r?.source === FUND_SOURCE || m?.source === FUND_SOURCE || fundSyms.has(sym)) continue;
    const sh = {
      updated: !skipped.has(sym),
      perCurrent: r.perCurrent ?? null,
      percentile: r.percentile ?? null,
      status: r.status ?? null,
      bandLow: r.bandLow ?? null,
      bandHigh: r.bandHigh ?? null,
    };
    const mu = m
      ? {
          updated: okDates.has(m.asOf),
          perCurrent: m.perCurrent ?? null,
          percentile: m.percentile ?? null,
          status: m.status ?? null,
          bandLow: m.bandLow ?? null,
          bandHigh: m.bandHigh ?? null,
        }
      : null;
    const kind = classifySymbol(sh, mu);
    counts[kind]++;
    rows.push({ sym, kind, shadow: sh, mulmo: mu });
  }

  const funds = [];
  const fundKeys = new Set([...fundSyms, ...Object.keys(vals).filter((k) => vals[k]?.source === FUND_SOURCE)]);
  for (const sym of fundKeys) {
    const s = shadow?.fund?.funds?.[sym];
    const m = vals[sym];
    funds.push({
      sym,
      shadow: s ? { perCurrent: s.perCurrent ?? null, coverage: s.coverage ?? null } : null,
      mulmo: m ? { perCurrent: m.perCurrent ?? null, coverage: m.coverage ?? null } : null,
    });
  }

  const day = rows.some((x) => MISMATCH_KINDS.has(x.kind)) ? 'mismatch' : 'match';
  return { day, date, rows, funds, counts };
}

// ---------------------------------------------------------------------------
// トラッキング Issue の連続一致日数
// ---------------------------------------------------------------------------

export const STREAK_TARGET = 3;

/**
 * Issue 本文の `<!-- per-shadow-streak: N last: YYYY-MM-DD -->` を読む。無ければ {0, null}。
 * @param {string | null | undefined} body
 * @returns {{streak: number, last: string | null}}
 */
export function parseStreak(body) {
  const m = /<!--\s*per-shadow-streak:\s*(\d+)\s+last:\s*(\S+)\s*-->/.exec(body || '');
  if (!m) return { streak: 0, last: null };
  return { streak: Number(m[1]), last: m[2] === '-' ? null : m[2] };
}

/** @param {{streak: number, last: string | null}} s */
export function streakMarker(s) {
  return `<!-- per-shadow-streak: ${s.streak} last: ${s.last ?? '-'} -->`;
}

/**
 * 連続一致日数を進める。一致日 N+1・不一致日 N=0・判定不能日は据え置き。
 * 同じ日付（または過去の日付）の再実行では数えない（last で判定）。
 * @param {{streak: number, last: string | null}} prev
 * @param {string | null} date
 * @param {'match' | 'mismatch' | 'undetermined'} day
 * @returns {{streak: number, last: string | null, counted: boolean, duplicate: boolean, reached: boolean}}
 */
export function nextStreak(prev, date, day) {
  if (day === 'undetermined' || !date) return { ...prev, counted: false, duplicate: false, reached: false };
  if (prev.last && date <= prev.last) return { ...prev, counted: false, duplicate: true, reached: false };
  const streak = day === 'match' ? prev.streak + 1 : 0;
  return { streak, last: date, counted: true, duplicate: false, reached: day === 'match' && streak === STREAK_TARGET };
}

// ---------------------------------------------------------------------------
// Markdown（公開 Issue に出す。銘柄シンボル・PER・%タイル・status・件数のみ）
// ---------------------------------------------------------------------------

/** @param {any} v */
const cell = (v) => (v === null || v === undefined ? '—' : String(v));

/** @param {any} x */
const side = (x) =>
  x
    ? `${cell(x.perCurrent)} / ${cell(x.percentile)} / ${cell(x.status)}${x.updated ? '' : '（未更新）'}`
    : '（エントリ無し）';

/**
 * 不一致・除外の銘柄の差分表。
 * @param {CompareResult} result
 */
export function renderDiffTable(result) {
  const rows = result.rows.filter((r) => r.kind !== 'match');
  if (rows.length === 0) return '';
  const lines = ['| 銘柄 | 区分 | shadow PER / % / status | Mulmo PER / % / status |', '|---|---|---|---|'];
  for (const r of rows) {
    const band =
      r.kind === 'band-changed'
        ? `（band shadow ${cell(r.shadow.bandLow)}〜${cell(r.shadow.bandHigh)} → Mulmo ${cell(r.mulmo?.bandLow)}〜${cell(r.mulmo?.bandHigh)}）`
        : '';
    lines.push(`| ${r.sym} | \`${r.kind}\`${band} | ${side(r.shadow)} | ${side(r.mulmo)} |`);
  }
  return lines.join('\n');
}

/** @param {CompareResult} result */
export function renderFundTable(result) {
  if (result.funds.length === 0) return '';
  const lines = ['| 投信（参考・判定外） | shadow PER / coverage | Mulmo PER / coverage |', '|---|---|---|'];
  for (const f of result.funds) {
    const s = f.shadow ? `${cell(f.shadow.perCurrent)} / ${cell(f.shadow.coverage)}` : '—';
    const m = f.mulmo ? `${cell(f.mulmo.perCurrent)} / ${cell(f.mulmo.coverage)}` : '—';
    lines.push(`| ${f.sym} | ${s} | ${m} |`);
  }
  return lines.join('\n');
}

/** @param {CompareResult} result */
export function renderCounts(result) {
  return KINDS.map((k) => `${k} ${result.counts[k] ?? 0}`).join(' · ');
}

/**
 * 日次コメント本文。
 * @param {CompareResult} result
 * @param {{streak: number, counted: boolean, duplicate: boolean}} st
 * @param {{mulmoSha?: string | null, runUrl?: string | null}} [meta]
 */
export function renderComment(result, st, meta = {}) {
  const d = result.date ?? '不明';
  const tail = st.duplicate ? '（同じ日付の再判定のため連続日数は変更なし）' : '';
  const runLine = meta.runUrl ? `\n\nRun: ${meta.runUrl}` : '';
  if (result.day === 'undetermined') {
    return `⏸ ${d}: 判定不能 — ${result.reason}。連続一致日数は据え置き（${st.streak}）。${runLine}`;
  }
  const sha = meta.mulmoSha ? `（Mulmo 確定コミット ${meta.mulmoSha.slice(0, 7)}）` : '';
  if (result.day === 'match') {
    const excl = result.counts['band-changed'] ? `・band-changed 除外 ${result.counts['band-changed']}` : '';
    return `✅ ${d}: 一致（match ${result.counts.match}${excl}）${sha}。連続一致 ${st.streak} 日${tail}${runLine}`;
  }
  const parts = [
    `❌ ${d}: 不一致${sha}。連続一致日数をリセット（${st.streak}）${tail}`,
    '',
    renderCounts(result),
    '',
    renderDiffTable(result),
  ];
  const ft = renderFundTable(result);
  if (ft) parts.push('', ft);
  return parts.join('\n') + runLine;
}

/**
 * トラッキング Issue の本文（毎回全体を作り直す）。
 * @param {{streak: number, last: string | null}} s
 */
export function renderIssueBody(s) {
  return [
    '毎日の PER を GitHub Actions で計算のみ実行（20:15 UTC・shadow）し、Mulmo の確定値と突き合わせる（01:30 UTC・compare）トラッキング Issue です（#652 PR2・設計書 §5.3）。',
    '',
    `- **連続一致日数**: ${s.streak} / ${STREAK_TARGET}`,
    `- **最終判定日（shadow 日付・UTC）**: ${s.last ?? '—'}`,
    '',
    '一致＝status と %タイルが全銘柄で一致（band-changed は除外）。判定不能日は数えず、リセットもしない。',
    `${STREAK_TARGET} 日連続一致で PR3（書き込みへの切り替え）に着手可。この Issue は PR3 マージ後に PM がクローズする。`,
    '',
    '> このIssueは `PER Daily` ワークフロー（`per-daily.yml`）が自動更新しています。下の行は機械可読のため編集しないでください。',
    '',
    streakMarker(s),
  ].join('\n');
}
