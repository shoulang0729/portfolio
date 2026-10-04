#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════
// order-plan.mjs  ―  注文表の設定（Worker KV `order:plan`）の取得・検証・投入
//
// 設計: docs/handoff/2026-10-03-order-sheet.md §9（PR6・#675）／運用手順: docs/order-sheet-ops.md
//
// 使い方（Mac・リポのルートで）:
//   node scripts/order-plan.mjs validate <file>   ローカルで validatePlan を通す（通信しない）
//   node scripts/order-plan.mjs put <file>        validatePlan を通してから PUT /order-sheet/plan
//   node scripts/order-plan.mjs get <file>        GET /order-sheet/plan の結果を <file> に保存（上書きしない）
//
// 環境変数:
//   MF_PIN_HASH  PIN ハッシュ（X-Pin-Hash にそのまま使う。Mac mini の既存環境変数）。get / put で必須
//   WORKER_URL   Worker のベース URL（既定 https://portfolio-proxy.shoulang.workers.dev）
//
// 公開リポの約束:
// - KV に直接書かない（必ず Worker の PUT /order-sheet/plan を通す＝検証と楽観ロックが効く）。
// - <file> がリポジトリ（git の作業ツリー）の中なら拒否する（実値の誤コミット防止）。
// - 標準出力・標準エラーに plan の値（目標額・指値・株数・金額）や PIN ハッシュを出さない。
//   出すのは件数・rev・HTTP ステータス・検証エラーの場所（シンボル名と項目名）だけ。
// ══════════════════════════════════════════════════════════════

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEFAULT_WORKER_URL = 'https://portfolio-proxy.shoulang.workers.dev';
const USER_AGENT = 'portfolio-order-plan/1 (+https://github.com/shoulang0729/portfolio)';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * worker/src/order-plan.js の validatePlan を読み込む。
 * worker/package.json が "type": "commonjs" のため、Node から ESM の名前付き import ができない。
 * order-plan.js は import を持たない純関数モジュールなので、ソースを ESM として data: URL で読む。
 * @returns {Promise<(plan: unknown) => {ok: boolean, errors: string[]}>}
 */
export async function loadValidatePlan() {
  const src = readFileSync(path.join(REPO_ROOT, 'worker', 'src', 'order-plan.js'), 'utf8');
  const mod = await import(`data:text/javascript;base64,${Buffer.from(src, 'utf8').toString('base64')}`);
  if (typeof mod.validatePlan !== 'function') throw new Error('validatePlan を読み込めません');
  return mod.validatePlan;
}

const USAGE = `使い方:
  node scripts/order-plan.mjs validate <file>
  node scripts/order-plan.mjs put <file>
  node scripts/order-plan.mjs get <file>
<file> はリポジトリの外に置く（例 ~/private/2026-10-03.order-plan.json）。
環境変数: MF_PIN_HASH（get/put で必須）・WORKER_URL（任意）`;

/** 使い方の誤り・入力の誤り（終了コード 2） */
export class UsageError extends Error {}

/**
 * パスを実体（シンボリックリンク解決後）の絶対パスにする。ファイルが無ければ親ディレクトリで解決する。
 * @param {string} p
 */
function resolveReal(p) {
  const abs = path.resolve(p);
  if (existsSync(abs)) return realpathSync(abs);
  const dir = path.dirname(abs);
  return existsSync(dir) ? path.join(realpathSync(dir), path.basename(abs)) : abs;
}

/**
 * child が dir と同じか dir の配下か。
 * @param {string} child 絶対パス
 * @param {string} dir 絶対パス
 */
export function isInsideDir(child, dir) {
  const rel = path.relative(dir, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * dir が git の作業ツリーの中なら、そのルートを返す（git が無い・作業ツリー外なら null）。
 * @param {string} dir
 */
function gitTopLevel(dir) {
  if (!existsSync(dir)) return null;
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * 入力/出力ファイルのパスを検査する。リポジトリ（このスクリプトのリポ・任意の git 作業ツリー）の中なら拒否する。
 * @param {string} file
 * @param {{repoRoot?: string, gitTop?: (dir: string) => string|null}} [opts]
 * @returns {string} 実体の絶対パス
 */
export function assertOutsideRepo(file, opts = {}) {
  if (!file) throw new UsageError('ファイルを指定してください');
  const repoRoot = resolveReal(opts.repoRoot || REPO_ROOT);
  const real = resolveReal(file);
  if (isInsideDir(real, repoRoot)) {
    throw new UsageError(
      'リポジトリ内のファイルは使えません（実値の誤コミット防止）。リポの外（例 ~/private/）に置いてください'
    );
  }
  const top = (opts.gitTop || gitTopLevel)(path.dirname(real));
  if (top) {
    throw new UsageError(
      'git の作業ツリー内のファイルは使えません（実値の誤コミット防止）。リポの外（例 ~/private/）に置いてください'
    );
  }
  return real;
}

/**
 * plan の件数だけの要約（値は含めない）。
 * @param {any} plan
 */
export function summarizePlan(plan) {
  const symbols = plan && plan.symbols && typeof plan.symbols === 'object' ? Object.values(plan.symbols) : [];
  let stages = 0;
  let working = 0;
  for (const s of symbols) {
    const list = Array.isArray(s?.stages) ? s.stages : [];
    stages += list.length;
    working += list.filter((st) => st && st.state === 'working').length;
  }
  return {
    symbols: symbols.length,
    stages,
    working,
    rev: plan && Number.isInteger(plan.rev) ? plan.rev : null,
  };
}

/** @param {ReturnType<typeof summarizePlan>} s */
function fmtSummary(s) {
  return `銘柄 ${s.symbols}・段 ${s.stages}（working ${s.working}）・rev ${s.rev ?? '未設定'}`;
}

/**
 * JSON ファイルを読む（パースエラーのメッセージは入力の断片を含みうるので出さない）。
 * @param {string} file
 */
function readPlanFile(file) {
  if (!existsSync(file)) throw new UsageError('ファイルがありません');
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new UsageError('JSON として読めません（構文を確認してください）');
  }
}

/**
 * validatePlan を通す。エラーは場所と理由だけ（validatePlan のメッセージは値を含まない）。
 * @param {any} plan
 */
function validateOrThrow(plan, validatePlan) {
  const v = validatePlan(plan);
  if (!v.ok) {
    const lines = v.errors.map((e) => `  - ${e}`).join('\n');
    throw new UsageError(`plan が不正です（${v.errors.length} 件）:\n${lines}`);
  }
}

function workerEnv(env) {
  const pin = env.MF_PIN_HASH;
  if (!pin) throw new UsageError('環境変数 MF_PIN_HASH が未設定です');
  const base = (env.WORKER_URL || DEFAULT_WORKER_URL).replace(/\/+$/, '');
  return { pin, base };
}

/**
 * Worker のエラー応答を値を出さずに要約する。
 * @param {Response} res
 */
async function describeError(res) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* 本文なし */
  }
  if (res.status === 401 || res.status === 428) return `HTTP ${res.status}（PIN 認証に失敗。MF_PIN_HASH を確認）`;
  if (res.status === 409) {
    const rev = Number.isInteger(body?.rev) ? body.rev : '不明';
    return `HTTP 409（rev 不一致: Worker の現在の rev=${rev}。get で取り直して編集し直すか、ファイルの rev を合わせて再実行）`;
  }
  if (res.status === 400 && Array.isArray(body?.errors)) {
    return `HTTP 400（plan が不正・${body.errors.length} 件）:\n${body.errors.map((e) => `  - ${e}`).join('\n')}`;
  }
  return `HTTP ${res.status}`;
}

async function cmdValidate(file, validatePlan, log) {
  const real = assertOutsideRepo(file);
  const plan = readPlanFile(real);
  validateOrThrow(plan, validatePlan);
  log(`OK: ${fmtSummary(summarizePlan(plan))}`);
}

async function cmdPut(file, validatePlan, env, fetchImpl, log) {
  const real = assertOutsideRepo(file);
  const plan = readPlanFile(real);
  validateOrThrow(plan, validatePlan);
  const { pin, base } = workerEnv(env);
  const res = await fetchImpl(`${base}/order-sheet/plan`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Pin-Hash': pin, 'User-Agent': USER_AGENT },
    body: JSON.stringify(plan),
  });
  if (!res.ok) throw new Error(`PUT に失敗: ${await describeError(res)}`);
  const out = await res.json().catch(() => ({}));
  const s = summarizePlan(plan);
  log(`PUT OK: 銘柄 ${s.symbols}・段 ${s.stages}（working ${s.working}）→ rev ${out?.rev ?? '不明'}`);
}

async function cmdGet(file, env, fetchImpl, log) {
  const real = assertOutsideRepo(file);
  if (existsSync(real))
    throw new UsageError('出力先が既にあります（上書きしません）。別のファイル名を指定してください');
  const { pin, base } = workerEnv(env);
  const res = await fetchImpl(`${base}/order-sheet/plan`, {
    method: 'GET',
    headers: { 'X-Pin-Hash': pin, 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`GET に失敗: ${await describeError(res)}`);
  const plan = await res.json();
  if (plan == null) {
    log('order:plan は未投入です（ファイルは作りません）');
    return;
  }
  writeFileSync(real, `${JSON.stringify(plan, null, 2)}\n`, { mode: 0o600 });
  log(`GET OK: ${fmtSummary(summarizePlan(plan))} を保存しました`);
}

/**
 * @param {string[]} argv コマンド以降の引数
 * @param {{env?: Record<string, string|undefined>, fetchImpl?: typeof fetch, log?: (s: string) => void,
 *   validatePlan?: (plan: unknown) => {ok: boolean, errors: string[]}}} [deps]
 */
export async function main(argv, deps = {}) {
  const env = deps.env || process.env;
  const fetchImpl = deps.fetchImpl || fetch;
  const log = deps.log || ((s) => process.stdout.write(`${s}\n`));
  const [cmd, file, ...rest] = argv;
  if (!cmd || !file || rest.length) throw new UsageError(USAGE);
  if (cmd === 'validate') return cmdValidate(file, deps.validatePlan || (await loadValidatePlan()), log);
  if (cmd === 'put') return cmdPut(file, deps.validatePlan || (await loadValidatePlan()), env, fetchImpl, log);
  if (cmd === 'get') return cmdGet(file, env, fetchImpl, log);
  throw new UsageError(USAGE);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(resolveReal(process.argv[1])).href;
if (isDirectRun) {
  main(process.argv.slice(2)).catch((e) => {
    process.stderr.write(`${e instanceof Error ? e.message : '失敗しました'}\n`);
    process.exit(e instanceof UsageError ? 2 : 1);
  });
}
