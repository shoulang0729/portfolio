#!/usr/bin/env node
// @ts-check
// per-daily-gate.mjs — per-daily.yml の write ジョブが使う判定 CLI（#652 PR3・設計書 §6）。
// 判定ロジックは lib/per-daily.mjs の純関数（tests/per-daily.test.js）。
//
// 使い方:
//   node data/scheduler/per-daily-gate.mjs mode [--now <ISO>]      # write / compute-only を出力（20:55〜22:30 UTC 開始は compute-only）
//   node data/scheduler/per-daily-gate.mjs push-ok [--now <ISO>]   # push 可なら exit 0、21:00〜22:30 UTC は exit 3
//   node data/scheduler/per-daily-gate.mjs message <YYYY-MM-DD>    # コミットメッセージ `data: daily PER <日付>` を出力
//   node data/scheduler/per-daily-gate.mjs check-diff              # HEAD と作業ツリーの data/valuations.json を比べ、
//                                                                  #   §6.3 の許可フィールド以外の変更・書式の変化があれば exit 1
// 公開リポのログに出るため、check-diff が出すのはエントリ名とフィールド名だけ（値は出さない）。
import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import { dailyPerCommitMessage, runMode, isPushBlocked, findDisallowedChanges } from './lib/per-daily.mjs';
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
  case 'check-diff':
    checkDiff();
    break;
  default:
    console.error('[per-daily-gate] usage: mode | push-ok | message <YYYY-MM-DD> | check-diff');
    process.exit(2);
}
