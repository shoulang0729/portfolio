#!/usr/bin/env node
// @ts-check
// fund-holdings-update.mjs — ひふみ上位10（data/scheduler/fund-holdings.json）を月次レポートから更新する（#656・#652 PR4）。
// 設計書: docs/handoff/2026-10-03-phase15-data-migration.md §7
//
// 流れ（ファンドごとに独立）：
//   対象月（既定＝実行日 UTC の前月／--month）が現在の asOf より新しいファンドだけ処理する（同じ・古いなら何もしない）。
//   PDF 取得 → pdftotext -layout → parseTop10 → validateTop10 → 既知月（2026-05）の自己検証 → top/asOf だけ差し替え。
//   - 対象月が 404：実行日 1〜19 日は成功扱い（翌日再試行）、20 日以降は失敗（stale）。
//   - 404 以外の取得エラー・検証 NG・自己検証 NG（既知月 PDF の取得失敗を含む）：失敗。そのファンドは書き込まない。
//   valuations.json は触らない。書式（インデント幅・末尾改行）は読み込んだファイルに合わせる（§2.4）。
//
// 使い方:
//   node data/scheduler/fund-holdings-update.mjs                    # 前月分で更新（書き込む）
//   node data/scheduler/fund-holdings-update.mjs --dry-run          # 書き込まず差分だけ出す
//   node data/scheduler/fund-holdings-update.mjs --month 202608     # 対象月を指定（asOf 以前なら書き込まない）
//   --out <file>   結果 JSON（ワークフローが commit / Issue 判定に使う）
//   --issue-body <file>  失敗・stale のとき Issue 本文（Markdown）を書く
// 終了コード: 0＝失敗なし（未公開の再試行待ちを含む）／1＝失敗あり／2＝引数・入力ファイルの不正。
// 公開リポのログには ファンド・月・銘柄コード・件数・HTTP ステータスだけを出す（レスポンス本文は出さない）。
import { readFileSync, writeFileSync, mkdtempSync, rmSync, appendFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

import { detectFormat, stringifyLike } from './lib/json-format.mjs';
import { RETRY_DELAYS_MS, TIMEOUT_MS, isRetryableStatus } from './lib/worker-client.mjs';
import { KNOWN_MONTH, KNOWN_TOP10 } from './lib/hifumi-known.mjs';
import {
  parseTop10Detailed,
  validateTop10,
  compareKnown,
  targetMonth,
  isValidMonth,
  monthToAsOf,
  isNewerThanAsOf,
  notPublishedAction,
  applyUpdates,
  diffTopMarkdown,
} from './lib/hifumi-parse.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const HOLD = resolve(__dir, 'fund-holdings.json');

/** ファンド種別 → fund-holdings.json の `fund` 値（§7.2）。クロスオーバーpro は対象外。 */
const FUNDS = /** @type {const} */ ([
  { key: 'toushin', fund: 'ひふみ投信' },
  { key: 'microscope', fund: 'ひふみマイクロスコープpro' },
]);

/** @param {'toushin'|'microscope'} f @param {string} month */
const pdfUrl = (f, month) => `https://hifumi.rheos.jp/fund/${f}/pdf/report${month}.pdf`;

const args = process.argv.slice(2);
/** @param {string} name */
function argValue(name) {
  const i = args.indexOf(name);
  if (i === -1) return null;
  const v = args[i + 1];
  if (!v || v.startsWith('--')) {
    console.error(`[fund-holdings] ${name} には値が必要です`);
    process.exit(2);
  }
  return v;
}
const dryRun = args.includes('--dry-run');
const monthArg = argValue('--month');
const outFile = argValue('--out');
const issueBodyFile = argValue('--issue-body');

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * PDF を取得する。404 は {status:'not-found'}。429/5xx/ネットワークエラーは 3 回リトライ（2s→4s→8s）の後に throw。
 * それ以外の非 2xx は即 throw。本文はログに出さない。
 * @param {string} url
 * @returns {Promise<{status: 'ok', data: Buffer} | {status: 'not-found'}>}
 */
async function fetchPdf(url) {
  /** @type {unknown} */
  let lastErr = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status === 404) return { status: 'not-found' };
      if (isRetryableStatus(res.status)) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { fatal: true });
      return { status: 'ok', data: Buffer.from(await res.arrayBuffer()) };
    } catch (e) {
      if (e && /** @type {any} */ (e).fatal) throw e;
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * PDF → テキスト（pdftotext -layout）。
 * @param {Buffer} data
 * @param {string} dir
 * @param {string} name
 */
function pdfToText(data, dir, name) {
  const p = join(dir, `${name}.pdf`);
  writeFileSync(p, data);
  return execFileSync('pdftotext', ['-layout', p, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/**
 * 1 本の PDF を取得・パース・検証する。
 * @param {'toushin'|'microscope'} f
 * @param {string} month
 * @param {string} dir
 * @returns {Promise<{status: 'ok', rows: import('./lib/hifumi-parse.mjs').TopRow[]} | {status: 'not-found'} | {status: 'error', reason: string}>}
 */
async function fetchAndParse(f, month, dir) {
  /** @type {Awaited<ReturnType<typeof fetchPdf>>} */
  let got;
  try {
    got = await fetchPdf(pdfUrl(f, month));
  } catch (e) {
    return { status: 'error', reason: `取得エラー（${e instanceof Error ? e.message : String(e)}）` };
  }
  if (got.status === 'not-found') return got;
  let text;
  try {
    text = pdfToText(got.data, dir, `${f}-${month}`);
  } catch {
    return { status: 'error', reason: 'pdftotext に失敗' };
  }
  const { rows, errors } = parseTop10Detailed(text, f);
  const v = validateTop10(errors.length ? [] : rows);
  if (errors.length || !v.ok) return { status: 'error', reason: `検証 NG: ${[...errors, ...v.errors].join(' / ')}` };
  return { status: 'ok', rows };
}

/**
 * @typedef {{
 *   key: string, fund: string, month: string, currentAsOf: string | null,
 *   status: 'updated' | 'would-update' | 'up-to-date' | 'not-published-retry' | 'not-published-stale' | 'error',
 *   reason?: string, diff?: string
 * }} FundResult
 */

async function main() {
  const now = new Date();
  if (monthArg != null && !isValidMonth(monthArg)) {
    console.error(`[fund-holdings] --month は YYYYMM で指定してください（${monthArg}）`);
    process.exit(2);
  }
  const month = monthArg ?? targetMonth(now);

  const raw = readFileSync(HOLD, 'utf8');
  /** @type {any[]} */
  const holdings = JSON.parse(raw);
  for (const { fund } of FUNDS) {
    if (!holdings.some((h) => h?.fund === fund)) {
      console.error(`[fund-holdings] fund-holdings.json に「${fund}」がありません（書き込みません）`);
      process.exit(2);
    }
  }

  const dir = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), 'hifumi-'));
  /** @type {FundResult[]} */
  const results = [];
  /** @type {Record<string, {asOf: string, top: any[]}>} */
  const updates = {};
  try {
    for (const { key, fund } of FUNDS) {
      const cur = holdings.find((h) => h.fund === fund);
      /** @type {FundResult} */
      const r = { key, fund, month, currentAsOf: cur.asOf ?? null, status: 'up-to-date' };
      results.push(r);
      if (!isNewerThanAsOf(cur.asOf, month)) {
        r.reason = `asOf ${cur.asOf} は ${monthToAsOf(month)} 以降（書き込まない）`;
        continue;
      }
      const target = await fetchAndParse(key, month, dir);
      if (target.status === 'not-found') {
        const action = notPublishedAction(now);
        r.status = action === 'stale' ? 'not-published-stale' : 'not-published-retry';
        r.reason = action === 'stale' ? '未公開（20 日以降）' : '未公開・翌日再試行';
        continue;
      }
      if (target.status === 'error') {
        r.status = 'error';
        r.reason = target.reason;
        continue;
      }
      // 既知月の自己検証（比較相手＝hifumi-known.mjs の定数。現行 JSON ではない）
      const known = await fetchAndParse(key, KNOWN_MONTH, dir);
      if (known.status !== 'ok') {
        r.status = 'error';
        r.reason = `自己検証できない（${KNOWN_MONTH}: ${known.status === 'not-found' ? '404' : known.reason}）`;
        continue;
      }
      const self = compareKnown(known.rows, KNOWN_TOP10[key]);
      if (!self.ok) {
        r.status = 'error';
        r.reason = `パーサ不整合（レイアウト変更の疑い）: ${self.errors.join(' / ')}`;
        continue;
      }
      r.diff = diffTopMarkdown(cur.top, target.rows);
      r.status = dryRun ? 'would-update' : 'updated';
      updates[fund] = { asOf: monthToAsOf(month), top: target.rows };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const changed = !dryRun && Object.keys(updates).length > 0;
  if (changed) writeFileSync(HOLD, stringifyLike(applyUpdates(holdings, updates), detectFormat(raw)));

  const failed = results.some((r) => r.status === 'error' || r.status === 'not-published-stale');
  // stale Issue の自動クローズ条件：失敗なし・未公開なし（全ファンドが今回の月で更新済み or 既に最新）
  const allCurrent = results.every((r) => ['updated', 'would-update', 'up-to-date'].includes(r.status));

  for (const r of results) {
    console.log(`[fund-holdings] ${r.key} ${r.month}: ${r.status}${r.reason ? ` — ${r.reason}` : ''}`);
  }

  const summary = [
    `## ひふみ上位10 月次更新（${monthToAsOf(month)}・${dryRun ? 'dry-run' : 'write'}）`,
    '',
    '| ファンド | 現行 asOf | 結果 | 備考 |',
    '|---|---|---|---|',
    ...results.map((r) => `| ${r.fund} | ${r.currentAsOf ?? '—'} | ${r.status} | ${r.reason ?? ''} |`),
    '',
  ];
  for (const r of results) {
    if (r.status === 'not-published-retry') summary.push(`- ${r.key} ${r.month} 未公開・翌日再試行`);
  }
  for (const r of results) {
    if (r.diff) summary.push('', `### ${r.fund}：現行 top → 新 top`, '', r.diff);
  }
  const summaryText = `${summary.join('\n')}\n`;
  console.log(summaryText);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryText);

  if (issueBodyFile && failed) {
    const checkedAt = now.toISOString();
    const body = [
      'ひふみ上位10（`data/scheduler/fund-holdings.json`）の月次更新が失敗、または前月分が 20 日時点で未公開です。',
      '',
      '| ファンド | 対象月 | 結果 | 理由 |',
      '|---|---|---|---|',
      ...results
        .filter((r) => r.status === 'error' || r.status === 'not-published-stale')
        .map((r) => `| ${r.fund} | ${monthToAsOf(r.month)} | ${r.status} | ${r.reason ?? ''} |`),
      '',
      `- **最終確認日時**: ${checkedAt}`,
      '- 設計書: `docs/handoff/2026-10-03-phase15-data-migration.md` §7',
      '',
      '> この Issue は `fund-holdings-monthly.yml` が自動管理しています（全ファンドの更新が成功すると自動クローズ）。',
      '',
    ].join('\n');
    writeFileSync(issueBodyFile, body);
  }

  if (outFile) {
    writeFileSync(
      outFile,
      `${JSON.stringify({ month, asOf: monthToAsOf(month), dryRun, changed, failed, allCurrent, results }, null, 2)}\n`
    );
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(`[fund-holdings] 失敗: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
