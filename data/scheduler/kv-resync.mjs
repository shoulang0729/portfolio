#!/usr/bin/env node
// @ts-check
// kv-resync.mjs — アプリKV(watchlist)を正本 data/valuations.json に決定論的に同期する（#652 PR1）。
//
// 原本: docs/handoff/assets/2026-10-03-phase15/kv-resync.mjs（Mulmo ワークスペース版）。
//   curl/execSync を Node 標準の fetch（lib/worker-client.mjs）に置き換え、正本パスをリポ基準にした。
//   比較キー・マージ・リトライ回数・exit コードは原本どおり。
//
// 保証すること:
//   ①配列形状を必ず保持 ②PUT を最大5回リトライ ③PUT後 GET read-back で反映を必ず検証
//   ④検証失敗時は exit≠0 で落とす（＝「成功」と誤記録させない）
//
// worker /watchlist は【JSON配列】を要求する（オブジェクトを送ると 400）。
// KV各要素 = { key,symbol,name,exchange,cur,type, valuation:{...} }。
//   valuation だけを正本 valuations.json[symbol] で差し替え、他フィールド(name等)は保持する。
//   正本に無い銘柄(債券・取得不可)は KV 側を据え置く。
//
// 公開リポの Actions ログに出るため、KV やレスポンスの本文はログに出さない（シンボル・件数・HTTP コードのみ）。
//
// 使い方:
//   node data/scheduler/kv-resync.mjs           # 再同期(マージ→PUT→read-back検証)。成功 exit 0 / 失敗 exit 1
//   node data/scheduler/kv-resync.mjs --check   # ドリフト検知のみ(PUTしない)。同期済 exit 0 / ズレあり exit 3
//   node data/scheduler/kv-resync.mjs --json    # 結果を1行JSON {ok,stage,drift,symbols,msg} で標準出力
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import { workerFetch } from './lib/worker-client.mjs';
import { findDrift, mergeValuations } from './lib/kv-sync.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const VAL = resolve(ROOT, 'data/valuations.json');
const PATH = '/watchlist';

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const AS_JSON = args.includes('--json');

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
    die({ ok: true, stage: 'noop', drift: 0, symbols: [], msg: '既に同期済み(PUT不要)' }, 0);
  }

  // --- マージ（配列形状を保持し valuation のみ差し替え） ---
  const body = JSON.stringify(mergeValuations(kv, valuations));

  // --- PUT (最大5回リトライ) ---
  let putOk = false;
  let lastCode = '';
  for (let i = 1; i <= 5; i++) {
    try {
      const res = await workerFetch(PATH, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      lastCode = String(res.status);
      const text = await res.text();
      const okBody = /"ok"\s*:\s*true/.test(text);
      log(`  PUT try${i}: http=${lastCode} ok=${okBody}`);
      if (res.status === 200 && okBody) {
        putOk = true;
        break;
      }
    } catch (e) {
      lastCode = 'error';
      log(`  PUT try${i}: err=${errMsg(e)}`);
    }
    await sleep(2000);
  }
  if (!putOk) {
    die(
      {
        ok: false,
        stage: 'put',
        drift: drift.length,
        symbols: drift,
        msg: `PUT 5回全滅(最終http=${lastCode})`,
      },
      1
    );
  }

  // --- read-back 検証（PUT が本当に反映されたか） ---
  const after = await getKV();
  if (!after) die({ ok: false, stage: 'readback-get', msg: 'read-back GET 失敗' }, 1);
  const stillDrift = findDrift(after, valuations);
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
      msg: `${drift.length}銘柄を同期しread-back検証OK`,
    },
    0
  );
}

main().catch((e) => die({ ok: false, stage: 'unexpected', msg: `想定外エラー: ${errMsg(e)}` }, 1));
