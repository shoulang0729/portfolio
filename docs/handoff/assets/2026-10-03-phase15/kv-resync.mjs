#!/usr/bin/env node
// kv-resync.mjs — アプリKV(watchlist)を正本 valuations.json に決定論的に同期する。
//
// 背景: 段C の KV 書き込みは、その都度の手打ち curl+jq で「ボディ形状ミス(配列→オブジェクト)」
//   や「read-back 検証スキップ(通ってないのに成功扱い)」が起きやすく、2026-07-06〜08 に KV が
//   実質2日ズレたまま気づかれない事故が発生した。本スクリプトはその手順を1本にまとめ、
//   ①配列形状を必ず保持 ②PUT を最大5回リトライ ③PUT後 GET read-back で反映を必ず検証
//   ④検証失敗時は exit≠0 で落とす（＝「成功」と誤記録させない）を保証する。
//
// worker /watchlist は【JSON配列】を要求する（オブジェクトを送ると 400 "Array が必要です"）。
// KV各要素 = { key,symbol,name,exchange,cur,type, valuation:{...} }。
//   valuation だけを正本 valuations.json[symbol] で差し替え、他フィールド(name等)は保持する。
//   正本に無い銘柄(債券・取得不可)は KV 側を据え置く。
//
// 使い方:
//   node data/scheduler/kv-resync.mjs           # 再同期(マージ→PUT→read-back検証)。成功 exit 0 / 失敗 exit 1
//   node data/scheduler/kv-resync.mjs --check    # ドリフト検知のみ(PUTしない)。同期済 exit 0 / ズレあり exit 3
//   node data/scheduler/kv-resync.mjs --json     # 結果を1行JSONで標準出力(pack取り込み用)
//
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const WORKER = "https://portfolio-proxy.shoulang.workers.dev/watchlist";
const ORIGIN = "https://shoulang0729.github.io";
const VAL = "github/portfolio/data/valuations.json";

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes("--check");
const AS_JSON = args.includes("--json");

const log = (...a) => { if (!AS_JSON) console.error(...a); };
const die = (obj, code) => {
  if (AS_JSON) console.log(JSON.stringify(obj));
  else log(`[kv-resync] ${obj.ok ? "OK" : "FAIL"}: ${obj.msg}`);
  process.exit(code);
};

// --- 正本 valuations.json 読み込み ---
let valuations;
try {
  valuations = JSON.parse(readFileSync(VAL, "utf8")).valuations || {};
} catch (e) {
  die({ ok: false, stage: "read-valuations", msg: "正本読込失敗: " + (e.message || e) }, 1);
}

// --- KV GET (最大3回) ---
function getKV() {
  for (let i = 1; i <= 3; i++) {
    try {
      const raw = execSync(`curl -s --connect-timeout 10 --max-time 25 "${WORKER}"`,
        { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
      const j = JSON.parse(raw);
      if (Array.isArray(j)) return j;
      log(`  GET try${i}: 配列でない(type=${typeof j})→リトライ`);
    } catch (e) { log(`  GET try${i}: ${(e.message || e).toString().slice(0, 60)}`); }
    execSync("sleep 2");
  }
  return null;
}

const kv = getKV();
if (!kv) die({ ok: false, stage: "get", msg: "KV GET 失敗(配列取得できず)" }, 1);

// --- ドリフト算出（KV valuation vs 正本） ---
const norm = (v) => v ? `${v.perCurrent}/${v.status}/${v.asOf}` : "null";
const drift = [];
for (const el of kv) {
  const s = el.symbol;
  const want = valuations[s];
  if (!want) continue;               // 正本に無い銘柄は据え置き対象
  if (norm(el.valuation) !== norm(want)) drift.push(s);
}

if (CHECK_ONLY) {
  const ok = drift.length === 0;
  die({ ok, stage: "check", drift: drift.length, symbols: drift,
        msg: ok ? "KVは正本と同期済み" : `KVに${drift.length}銘柄のドリフト: ${drift.join(",")}` },
      ok ? 0 : 3);
}

if (drift.length === 0) {
  die({ ok: true, stage: "noop", drift: 0, msg: "既に同期済み(PUT不要)" }, 0);
}

// --- マージ（配列形状を保持し valuation のみ差し替え） ---
const merged = kv.map((el) => {
  const want = valuations[el.symbol];
  return want ? { ...el, valuation: want } : el;
});

// --- PUT (最大5回リトライ) ---
const TMP = "/tmp/kv-resync-body.json";
writeFileSync(TMP, JSON.stringify(merged));

let putOk = false, putResp = "";
for (let i = 1; i <= 5; i++) {
  // 単発で code+body を取得（body末尾に改行+HTTPコードを付与）
  try {
    const body = execSync(
      `curl -s -w "\\n%{http_code}" --connect-timeout 10 --max-time 30 ` +
      `-X PUT "${WORKER}" -H "Content-Type: application/json" -H "Origin: ${ORIGIN}" ` +
      `--data-binary @${TMP}`,
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
    const nl = body.lastIndexOf("\n");
    const code = body.slice(nl + 1).trim();
    putResp = body.slice(0, nl);
    log(`  PUT try${i}: http=${code} resp=${putResp.slice(0, 80)}`);
    if (code === "200" && /"ok"\s*:\s*true/.test(putResp)) { putOk = true; break; }
  } catch (e) {
    log(`  PUT try${i}: err=${(e.message || e).toString().slice(0, 60)}`);
  }
  execSync("sleep 2");
}
if (!putOk) die({ ok: false, stage: "put", drift: drift.length, symbols: drift,
                  msg: `PUT 5回全滅(最終resp=${putResp.slice(0, 60)})` }, 1);

// --- read-back 検証（PUT が本当に反映されたか） ---
const after = getKV();
if (!after) die({ ok: false, stage: "readback-get", msg: "read-back GET 失敗" }, 1);
const stillDrift = [];
for (const el of after) {
  const want = valuations[el.symbol];
  if (!want) continue;
  if (norm(el.valuation) !== norm(want)) stillDrift.push(el.symbol);
}
if (stillDrift.length > 0) {
  die({ ok: false, stage: "readback-verify", drift: stillDrift.length, symbols: stillDrift,
        msg: `read-back検証NG: ${stillDrift.length}銘柄が未反映(${stillDrift.join(",")})` }, 1);
}

die({ ok: true, stage: "resynced", drift: drift.length, symbols: drift,
      msg: `${drift.length}銘柄を同期しread-back検証OK` }, 0);
