#!/usr/bin/env node
// @ts-check
// per-daily-gate.mjs — per-daily.yml の write ジョブが使う判定 CLI（#652 PR3・設計書 §6）。
// 判定ロジックは lib/per-daily.mjs の純関数（tests/per-daily.test.js）。
//
// 使い方:
//   node data/scheduler/per-daily-gate.mjs mode [--now <ISO>]      # write / compute-only を出力（20:55〜22:30 UTC 開始は compute-only）
//   node data/scheduler/per-daily-gate.mjs push-ok [--now <ISO>]   # push 可なら exit 0、21:00〜22:30 UTC は exit 3
//   node data/scheduler/per-daily-gate.mjs message <YYYY-MM-DD>    # コミットメッセージ `data: daily PER <日付>` を出力
//   node data/scheduler/per-daily-gate.mjs updated <watchlist-per.json> # ウォッチの更新件数を出力。0 件なら exit 4（コミットしない）
//   node data/scheduler/per-daily-gate.mjs check-diff              # HEAD と作業ツリーの data/valuations.json を比べ、
//                                                                  #   §6.3 の許可フィールド以外の変更・書式の変化があれば exit 1
//   node data/scheduler/per-daily-gate.mjs already-written [--now <ISO>] # 米国の引け（夏 20:00・冬 21:00 UTC）以降に当日分（bot・件名完全一致）が HEAD に
//                                                                  #   あれば written を出して exit 6、無ければ not-yet で exit 0（#708）
//   node data/scheduler/per-daily-gate.mjs on-time [--now <ISO>]   # 開始が引け〜21:44 UTC なら on-time で exit 0、
//                                                                  #   それ以外は late で exit 7（#708）
// 公開リポのログに出るため、check-diff が出すのはエントリ名とフィールド名だけ（値は出さない）。
import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import {
  dailyPerCommitMessage,
  runMode,
  isPushBlocked,
  findDisallowedChanges,
  countWatchlistUpdated,
  isAlreadyWritten,
  isOnTimeStart,
  writtenSinceIso,
} from './lib/per-daily.mjs';
import { detectFormat } from './lib/json-format.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const VAL_REL = 'data/valuations.json';

const [cmd, ...rest] = process.argv.slice(2);

/** @returns {Date} */
function nowArg() {
  const i = rest.indexOf('--now');
  if (i === -1) return new Date();
  const d = new Date(rest[i + 1]);
  if (Number.isNaN(d.getTime())) {
    console.error('[per-daily-gate] --now の日時が不正です');
    process.exit(2);
  }
  return d;
}

function checkDiff() {
  const beforeRaw = execFileSync('git', ['show', `HEAD:${VAL_REL}`], { cwd: ROOT, encoding: 'utf8' });
  const afterRaw = readFileSync(resolve(ROOT, VAL_REL), 'utf8');
  const bad = findDisallowedChanges(JSON.parse(beforeRaw), JSON.parse(afterRaw));
  const fb = detectFormat(beforeRaw);
  const fa = detectFormat(afterRaw);
  const formatChanged = fb.indent !== fa.indent || fb.trailingNewline !== fa.trailingNewline;
  if (formatChanged) {
    console.error(
      `[per-daily-gate] 書式が変わりました: indent ${JSON.stringify(fb.indent)}→${JSON.stringify(fa.indent)} ` +
        `trailingNewline ${fb.trailingNewline}→${fa.trailingNewline}`
    );
  }
  for (const b of bad) console.error(`[per-daily-gate] 許可外の変更: ${b.entry} ${b.field}`);
  if (formatChanged || bad.length) process.exit(1);
  console.log('[per-daily-gate] check-diff OK（許可フィールドのみ・書式不変）');
}

/**
 * HEAD の履歴から now の UTC 日付の米国の引け（夏 20:00・冬 21:00 UTC）以降のコミットを読み、
 * 当日分が書き込み済みかを判定する（#708）。
 * 出力は written / not-yet の 2 語だけ（コミットの一覧はログに出さない）。
 */
function alreadyWritten() {
  const now = nowArg();
  const out = execFileSync('git', ['log', 'HEAD', `--since=${writtenSinceIso(now)}`, '--format=%an%x09%cI%x09%s'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const commits = out
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const [author, committedAt, ...subject] = line.split('\t');
      return { author, committedAt, subject: subject.join('\t') };
    });
  if (isAlreadyWritten(commits, now)) {
    console.log('written');
    process.exit(6);
  }
  console.log('not-yet');
}

switch (cmd) {
  case 'mode':
    console.log(runMode(nowArg()));
    break;
  case 'push-ok':
    if (isPushBlocked(nowArg())) {
      console.log('blocked');
      process.exit(3);
    }
    console.log('ok');
    break;
  case 'message':
    try {
      console.log(dailyPerCommitMessage(rest[0]));
    } catch (e) {
      console.error(`[per-daily-gate] ${String((e && /** @type {any} */ (e).message) || e)}`);
      process.exit(2);
    }
    break;
  case 'updated': {
    if (!rest[0]) {
      console.error('[per-daily-gate] updated には watchlist-per の --out ファイルが必要です');
      process.exit(2);
    }
    const n = countWatchlistUpdated(JSON.parse(readFileSync(rest[0], 'utf8')));
    console.log(String(n));
    if (n === 0) process.exit(4);
    break;
  }
  case 'check-diff':
    checkDiff();
    break;
  case 'already-written':
    alreadyWritten();
    break;
  case 'on-time':
    if (!isOnTimeStart(nowArg())) {
      console.log('late');
      process.exit(7);
    }
    console.log('on-time');
    break;
  default:
    console.error(
      '[per-daily-gate] usage: mode | push-ok | message <YYYY-MM-DD> | updated <file> | check-diff | already-written | on-time'
    );
    process.exit(2);
}
