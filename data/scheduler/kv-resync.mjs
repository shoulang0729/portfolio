#!/usr/bin/env node
// @ts-check
// kv-resync.mjs — アプリKV(watchlist)を正本 data/valuations.json に決定論的に同期する（#652 PR1・#715 PR3）。
//
// 原本: docs/handoff/assets/2026-10-03-phase15/kv-resync.mjs（Mulmo ワークスペース版）。
//   curl/execSync を Node 標準の fetch（lib/worker-client.mjs）に置き換え、正本パスをリポ基準にした。
//   リトライ回数・exit コードは原本どおり。比較は valuation 全体・キー順非依存（#647・lib/kv-sync.mjs）。
//
// #715 PR3（docs/handoff/2026-10-05-watchlist-resync-worker.md §5）から、KV への書き込みは
//   Worker の POST /watchlist/resync（本文なし・Secrets 不要）に任せる。Worker が公開 main の
//   data/valuations.json を SHA 固定で取得し、valuation だけを差し替える（マージは Worker 側の lib/kv-sync.mjs）。
//   このスクリプトは PUT しない。
//
// 保証すること:
//   ①ズレ 0 なら同期要求を送らない ②同期要求を最大5回リトライ ③同期後 GET read-back で反映を必ず検証
//   ④検証失敗時は exit≠0 で落とす（＝「成功」と誤記録させない）
//   read-back の比較先は §5.3: Worker が見た SHA が手元 HEAD と同じ→手元の正本／Worker の方が新しい→その SHA の正本／
//   Worker の方が古い→15秒待って再要求（最大4回）。git が使えなければ手元の正本と比べる。
//
// KV各要素 = { key,symbol,name,exchange,cur,type, valuation:{...} }。
//   valuation だけを正本 valuations.json[symbol] で差し替え、他フィールド(name等)は保持する。
//   正本に無い銘柄(債券・取得不可)は KV 側を据え置く。
//
// 公開リポの Actions ログに出るため、KV やレスポンスの本文はログに出さない（シンボル・件数・HTTP コード・SHA 先頭7桁のみ）。
//
// 使い方:
//   node data/scheduler/kv-resync.mjs           # 再同期(POST /watchlist/resync→read-back検証)。成功 exit 0 / 失敗 exit 1
//   node data/scheduler/kv-resync.mjs --check   # ドリフト検知のみ(GET だけ・同期要求しない)。同期済 exit 0 / ズレあり exit 3
//   node data/scheduler/kv-resync.mjs --json    # 結果を1行JSON {ok,stage,drift,symbols,msg} で標準出力
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { execFileSync } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

import { workerFetch } from './lib/worker-client.mjs';
import { findDrift } from './lib/kv-sync.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const VAL = resolve(ROOT, 'data/valuations.json');
const PATH = '/watchlist';
const RESYNC_PATH = '/watchlist/resync';
/** Worker が古い main を見ていたときの再要求の回数と間隔（§5.3） */
const STALE_RETRIES = 4;
const STALE_WAIT_MS = 15_000;
const SHA_RE = /^[0-9a-f]{40}$/;

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const AS_JSON = args.includes('--json');

/** @param {...any} a */
const log = (...a) => {
  if (!AS_JSON) console.error(...a);
};
/** @param {unknown} e */
const errMsg = (e) => String((e && /** @type {any} */ (e).message) || e).slice(0, 60);

/**
 * @param {{ok: boolean, stage: string, drift?: number, symbols?: string[], msg: string}} obj
 * @param {number} code
 * @returns {never}
 */
function die(obj, code) {
  if (AS_JSON) console.log(JSON.stringify(obj));
  else log(`[kv-resync] ${obj.ok ? 'OK' : 'FAIL'}: ${obj.msg}`);
  process.exit(code);
}

// --- KV GET (最大3回) ---
/** @returns {Promise<Array<any> | null>} */
async function getKV() {
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await workerFetch(PATH);
      if (!res.ok) {
        log(`  GET try${i}: http=${res.status}→リトライ`);
      } else {
        const j = await res.json();
        if (Array.isArray(j)) return j;
        log(`  GET try${i}: 配列でない(type=${typeof j})→リトライ`);
      }
    } catch (e) {
      log(`  GET try${i}: ${errMsg(e)}`);
    }
    await sleep(2000);
  }
  return null;
}

/** SHA を先頭7桁に（ログ・JSON にはこれだけ出す）。 @param {string | null | undefined} sha */
const short = (sha) => (sha ? String(sha).slice(0, 7) : 'none');

/**
 * git をリポ直下で実行し stdout を返す（stderr は捨てる）。
 * @param {string[]} gitArgs
 * @returns {string}
 */
function git(gitArgs) {
  return String(
    execFileSync('git', gitArgs, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  ).trim();
}

/** 期待する SHA＝手元の HEAD。取れなければ null（SHA の判定を省く）。 @returns {string | null} */
function gitHead() {
  try {
    const sha = git(['rev-parse', 'HEAD']);
    return SHA_RE.test(sha) ? sha : null;
  } catch {
    return null;
  }
}

/**
 * read-back の比較先を決める（§5.3）。
 * - local: 手元の正本（SHA 一致・SHA 判定不能・git 失敗）
 * - newer: Worker の方が新しい → その SHA の正本
 * - stale: Worker が古い main を見た → 再要求
 * @param {string | null} expected 手元 HEAD
 * @param {string | null} got Worker 応答の sha
 * @param {Record<string, any>} local 手元の正本
 * @returns {{kind: 'local' | 'newer', valuations: Record<string, any>} | {kind: 'stale'}}
 */
function resolveBasis(expected, got, local) {
  if (!expected || !got || expected === got) return { kind: 'local', valuations: local };
  let isAncestor;
  try {
    git(['fetch', '--quiet', '--depth=50', 'origin', 'main']);
    try {
      git(['merge-base', '--is-ancestor', expected, got]);
      isAncestor = true;
    } catch (e) {
      // exit 1 = 祖先でない。それ以外（不明なオブジェクト等）は判定失敗
      if (/** @type {any} */ (e)?.status === 1) isAncestor = false;
      else throw e;
    }
  } catch (e) {
    log(`  git での sha 判定に失敗(${errMsg(e)})→手元の正本と比較`);
    return { kind: 'local', valuations: local };
  }
  if (!isAncestor) return { kind: 'stale' };
  try {
    const v = JSON.parse(git(['show', `${got}:data/valuations.json`])).valuations || {};
    log(`  Worker の sha=${short(got)} が手元 ${short(expected)} より新しい→その正本で検証`);
    return { kind: 'newer', valuations: v };
  } catch (e) {
    log(`  sha=${short(got)} の正本を読めない(${errMsg(e)})→手元の正本と比較`);
    return { kind: 'local', valuations: local };
  }
}

/**
 * POST /watchlist/resync（本文なし）。HTTP 200 かつ ok===true で成功。
 * 応答から読むのは ok と sha（40桁 hex のみ）だけ。本文はログに出さない。
 * @param {number} tries
 * @returns {Promise<{ok: true, sha: string | null} | {ok: false, lastCode: string}>}
 */
async function requestResync(tries) {
  let lastCode = '';
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await workerFetch(RESYNC_PATH, { method: 'POST' });
      lastCode = String(res.status);
      /** @type {any} */
      let j = null;
      try {
        j = await res.json();
      } catch {
        j = null;
      }
      const okBody = !!j && j.ok === true;
      const stage = j && typeof j.stage === 'string' ? j.stage.slice(0, 20) : '';
      log(`  resync try${i}: http=${lastCode} ok=${okBody}${stage ? ` stage=${stage}` : ''}`);
      if (res.status === 200 && okBody) {
        const sha = typeof j.sha === 'string' && SHA_RE.test(j.sha) ? j.sha : null;
        return { ok: true, sha };
      }
    } catch (e) {
      lastCode = 'error';
      log(`  resync try${i}: err=${errMsg(e)}`);
    }
    if (i < tries) await sleep(2000);
  }
  return { ok: false, lastCode };
}

async function main() {
  // --- 正本 valuations.json 読み込み ---
  /** @type {Record<string, any>} */
  let valuations = {};
  try {
    valuations = JSON.parse(readFileSync(VAL, 'utf8')).valuations || {};
  } catch (e) {
    die({ ok: false, stage: 'read-valuations', msg: `正本読込失敗: ${errMsg(e)}` }, 1);
  }

  const kv = await getKV();
  if (!kv) die({ ok: false, stage: 'get', msg: 'KV GET 失敗(配列取得できず)' }, 1);

  // --- ドリフト算出（KV valuation vs 正本） ---
  const drift = findDrift(kv, valuations);

  if (CHECK_ONLY) {
    const ok = drift.length === 0;
    die(
      {
        ok,
        stage: 'check',
        drift: drift.length,
        symbols: drift,
        msg: ok ? 'KVは正本と同期済み' : `KVに${drift.length}銘柄のドリフト: ${drift.join(',')}`,
      },
      ok ? 0 : 3
    );
  }

  if (drift.length === 0) {
    die({ ok: true, stage: 'noop', drift: 0, symbols: [], msg: '既に同期済み(同期要求不要)' }, 0);
  }

  // --- 同期要求 POST /watchlist/resync（本文なし・最大5回リトライ） ---
  // マージは Worker が公開 main の valuations.json（SHA 固定）で行う（#715 §5.2）。
  let resp = await requestResync(5);
  if (!resp.ok) {
    die(
      {
        ok: false,
        stage: 'put',
        drift: drift.length,
        symbols: drift,
        msg: `同期要求 5回全滅(最終http=${resp.lastCode})`,
      },
      1
    );
  }

  // --- read-back の比較先（§5.3）: Worker が見た SHA と手元の HEAD を突き合わせる ---
  const expected = gitHead();
  /** @type {Record<string, any>} */
  let basis = valuations;
  for (let retry = 0; ; retry++) {
    const b = resolveBasis(expected, resp.sha, valuations);
    if (b.kind !== 'stale') {
      basis = b.valuations;
      break;
    }
    if (retry >= STALE_RETRIES) {
      die(
        {
          ok: false,
          stage: 'readback-verify',
          drift: drift.length,
          symbols: drift,
          msg: `Worker が古い main を参照(${short(resp.sha)})`,
        },
        1
      );
    }
    log(`  Worker の sha=${short(resp.sha)} が手元 ${short(expected)} より古い→${STALE_WAIT_MS / 1000}秒待って再要求`);
    await sleep(STALE_WAIT_MS);
    const again = await requestResync(1);
    if (again.ok) resp = again;
  }

  // --- read-back 検証（Worker の同期が本当に反映されたか） ---
  const after = await getKV();
  if (!after) die({ ok: false, stage: 'readback-get', msg: 'read-back GET 失敗' }, 1);
  const stillDrift = findDrift(after, basis);
  if (stillDrift.length > 0) {
    die(
      {
        ok: false,
        stage: 'readback-verify',
        drift: stillDrift.length,
        symbols: stillDrift,
        msg: `read-back検証NG: ${stillDrift.length}銘柄が未反映(${stillDrift.join(',')})`,
      },
      1
    );
  }

  die(
    {
      ok: true,
      stage: 'resynced',
      drift: drift.length,
      symbols: drift,
      msg: `${drift.length}銘柄を同期しread-back検証OK(sha=${short(resp.sha)})`,
    },
    0
  );
}

main().catch((e) => die({ ok: false, stage: 'unexpected', msg: `想定外エラー: ${errMsg(e)}` }, 1));
