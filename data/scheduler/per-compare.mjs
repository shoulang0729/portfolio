#!/usr/bin/env node
// @ts-check
// per-compare.mjs — 毎日の PER 並行運転の突き合わせ CLI（#652 PR2・設計書 §5.3）。
//
// 入力:
//   ① shadow の結果（artifact per-shadow-<D> を展開したディレクトリ: watchlist-per.json / fund-per.json）
//   ② Mulmo の確定値 = shadow 実行開始（runStartedAt）以降に data/valuations.json を変更した最後のコミット
//      （author が github-actions[bot] 以外）時点のファイル。git 履歴から読む（要 fetch-depth: 0）。
// 出力（--out-dir）:
//   result.json  {day, date, reason?, counts, streak, last, counted, duplicate, reached, mulmoSha}
//   comment.md   トラッキング Issue へのコメント
//   body.md      トラッキング Issue の新しい本文（連続一致日数のマーカー入り）
//   summary.md   ジョブサマリ用
// 公開リポのログ・Issue に出すのは銘柄シンボル・PER・%タイル・status・件数のみ。
// data/** には書き込まない。
//
// 使い方:
//   node data/scheduler/per-compare.mjs --shadow-dir <dir> --out-dir <dir> [--streak-body <file>] [--run-url <url>]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import { execFileSync } from 'child_process';

import {
  compareDay,
  parseStreak,
  nextStreak,
  renderComment,
  renderIssueBody,
  renderCounts,
  renderDiffTable,
  renderFundTable,
  STREAK_TARGET,
} from './lib/per-compare.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const VAL_REL = 'data/valuations.json';
const BOT = 'github-actions[bot]';

const args = process.argv.slice(2);
/** @param {string} name */
const opt = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : null;
};
const shadowDir = opt('--shadow-dir');
const outDir = opt('--out-dir');
const streakBody = opt('--streak-body');
const runUrl = opt('--run-url');
if (!outDir) {
  console.error('[per-compare] --out-dir が必要です');
  process.exit(2);
}

/** @param {string | null} p */
function readJsonIfExists(p) {
  if (!p || !existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/** @param {string[]} a */
const git = (a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/**
 * runStartedAt 以降に valuations.json を変更した、bot 以外の最後のコミット。
 * @param {string} since ISO 時刻
 * @returns {{sha: string, doc: any} | null}
 */
function findMulmoCommit(since) {
  const log = git(['log', `--since=${since}`, '--format=%H%x09%an', '--', VAL_REL]).trim();
  if (!log) return null;
  for (const line of log.split('\n')) {
    const [sha, author] = line.split('\t');
    if (author === BOT) continue;
    try {
      return { sha, doc: JSON.parse(git(['show', `${sha}:${VAL_REL}`])) };
    } catch {
      return null;
    }
  }
  return null;
}

function main() {
  const watchlist = readJsonIfExists(shadowDir && join(shadowDir, 'watchlist-per.json'));
  const fund = readJsonIfExists(shadowDir && join(shadowDir, 'fund-per.json'));
  const shadow = watchlist ? { watchlist, fund } : null;

  const mulmo = watchlist?.runStartedAt ? findMulmoCommit(watchlist.runStartedAt) : null;
  const result = compareDay(shadow, mulmo ? mulmo.doc : null);

  const prev = parseStreak(streakBody && existsSync(streakBody) ? readFileSync(streakBody, 'utf8') : '');
  const st = nextStreak(prev, result.date, result.day);
  const meta = { mulmoSha: mulmo?.sha ?? null, runUrl };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'result.json'),
    `${JSON.stringify(
      {
        day: result.day,
        date: result.date,
        reason: result.reason ?? null,
        counts: result.counts,
        streak: st.streak,
        last: st.last,
        counted: st.counted,
        duplicate: st.duplicate,
        reached: st.reached,
        target: STREAK_TARGET,
        mulmoSha: meta.mulmoSha,
      },
      null,
      2
    )}\n`
  );
  writeFileSync(join(outDir, 'comment.md'), `${renderComment(result, st, meta)}\n`);
  writeFileSync(join(outDir, 'body.md'), `${renderIssueBody(st)}\n`);

  const summary = [
    `## PER 並行運転の突き合わせ（shadow 日付 ${result.date ?? '不明'}）`,
    '',
    `- 判定: **${result.day}**${result.reason ? `（${result.reason}）` : ''}`,
    `- Mulmo 確定コミット: ${meta.mulmoSha ? meta.mulmoSha.slice(0, 7) : '—'}`,
    `- 連続一致日数: ${st.streak} / ${STREAK_TARGET}${st.duplicate ? '（同日再判定・変更なし）' : ''}`,
    `- 内訳: ${renderCounts(result)}`,
  ];
  const diff = renderDiffTable(result);
  if (diff) summary.push('', diff);
  const ft = renderFundTable(result);
  if (ft) summary.push('', ft);
  writeFileSync(join(outDir, 'summary.md'), `${summary.join('\n')}\n`);

  console.log(
    `[per-compare] date=${result.date ?? '-'} day=${result.day} streak=${st.streak} counted=${st.counted} reached=${st.reached} ${renderCounts(result)}`
  );
}

try {
  main();
} catch (e) {
  console.error(`[per-compare] 失敗: ${String((e && /** @type {any} */ (e).message) || e).slice(0, 120)}`);
  process.exit(1);
}
