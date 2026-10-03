#!/usr/bin/env node
// @ts-check
// diff-report.mjs — 週次バッチの差分レポート（#652 PR5・§8.1）。
//
// `git show HEAD:<file>`（バッチ実行前）と作業ツリー（バッチ実行後）を比べ、Markdown を標準出力に出す。
//   - data/valuations.json      : 銘柄 × ブロック（quality / value / sectorMedian）のフィールド単位 old→new
//   - data/verdict-outcomes.json: proposedOutcome / resolvedAt の変化
//   - data/valuations.json の staleFields（#652 PR6・null ガード）: null 化（保持）／保持継続／回復
// ファイルは読むだけで書き換えない。出す値はいずれも公開済みの JSON 由来（保有額・資産実額は扱わない）。
//
// 使い方:
//   node data/scheduler/diff-report.mjs                # Markdown を標準出力へ
//   node data/scheduler/diff-report.mjs --date 2026-10-04
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { execFileSync } from 'child_process';

export const VALUATION_BLOCKS = ['quality', 'value', 'sectorMedian'];
export const OUTCOME_FIELDS = ['proposedOutcome', 'resolvedAt'];

/**
 * @typedef {{symbol: string, block: string, field: string, old: unknown, new: unknown}} ValuationChange
 * @typedef {{index: number, symbol: string, date: string, kind: string, field: string, old: unknown, new: unknown}} OutcomeChange
 * @typedef {{symbol: string, key: string, kind: 'kept-new' | 'kept-cont' | 'recovered', since: string, old: unknown, new: unknown}} StaleChange
 */

/** @param {unknown} a @param {unknown} b */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** @param {unknown} x @returns {Record<string, any>} */
const asObj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? /** @type {any} */ (x) : {});

/**
 * valuations.json の銘柄 × ブロックのフィールド差分。
 * ブロックがオブジェクトでない（null 等）場合はブロック全体を 1 フィールド（field='(block)'）として比べる。
 * @param {any} oldDoc
 * @param {any} newDoc
 * @param {string[]} [blocks]
 * @returns {ValuationChange[]}
 */
export function diffValuations(oldDoc, newDoc, blocks = VALUATION_BLOCKS) {
  const oldV = asObj(oldDoc && oldDoc.valuations);
  const newV = asObj(newDoc && newDoc.valuations);
  const symbols = [...new Set([...Object.keys(oldV), ...Object.keys(newV)])].sort();
  /** @type {ValuationChange[]} */
  const out = [];
  for (const symbol of symbols) {
    const oe = asObj(oldV[symbol]);
    const ne = asObj(newV[symbol]);
    for (const block of blocks) {
      const ob = oe[block];
      const nb = ne[block];
      if (same(ob, nb)) continue;
      const oIsObj = ob === undefined || (ob && typeof ob === 'object' && !Array.isArray(ob));
      const nIsObj = nb === undefined || (nb && typeof nb === 'object' && !Array.isArray(nb));
      if (!oIsObj || !nIsObj) {
        out.push({ symbol, block, field: '(block)', old: ob, new: nb });
        continue;
      }
      const ofs = asObj(ob);
      const nfs = asObj(nb);
      const fields = [...new Set([...Object.keys(ofs), ...Object.keys(nfs)])];
      for (const field of fields) {
        if (!same(ofs[field], nfs[field])) out.push({ symbol, block, field, old: ofs[field], new: nfs[field] });
      }
    }
  }
  return out;
}

/**
 * verdict-outcomes.json の proposedOutcome / resolvedAt の差分（配列の位置で対応づける）。
 * @param {any} oldDoc
 * @param {any} newDoc
 * @returns {OutcomeChange[]}
 */
export function diffOutcomes(oldDoc, newDoc) {
  const oldO = Array.isArray(oldDoc && oldDoc.outcomes) ? oldDoc.outcomes : [];
  const newO = Array.isArray(newDoc && newDoc.outcomes) ? newDoc.outcomes : [];
  /** @type {OutcomeChange[]} */
  const out = [];
  const n = Math.max(oldO.length, newO.length);
  for (let i = 0; i < n; i++) {
    const o = asObj(oldO[i]);
    const c = asObj(newO[i]);
    const id = newO[i] ? c : o;
    for (const field of OUTCOME_FIELDS) {
      if (same(o[field], c[field])) continue;
      out.push({
        index: i,
        symbol: String(id.symbol ?? ''),
        date: String(id.date ?? ''),
        kind: String(id.kind ?? 'action'),
        field,
        old: o[field],
        new: c[field],
      });
    }
  }
  return out;
}

/**
 * "<ブロック>.<フィールド>" のフィールド値を取り出す（無ければ undefined）。
 * @param {Record<string, any>} entry
 * @param {string} key
 */
function fieldOf(entry, key) {
  const i = key.indexOf('.');
  if (i === -1) return undefined;
  return asObj(entry[key.slice(0, i)])[key.slice(i + 1)];
}

/**
 * valuations.json の各銘柄の `staleFields`（null ガードの印）の変化（§8.4.5）。
 *   - kept-new  : null 化（保持）＝HEAD に無いキーが作業ツリーにある
 *   - kept-cont : 保持継続＝両方にある
 *   - recovered : 回復＝HEAD にあり作業ツリーに無い
 * `old` / `new` は HEAD / 作業ツリーの該当フィールド値（kept-* の `new` は保持している値）。
 * @param {any} oldDoc
 * @param {any} newDoc
 * @returns {StaleChange[]}
 */
export function diffStale(oldDoc, newDoc) {
  const oldV = asObj(oldDoc && oldDoc.valuations);
  const newV = asObj(newDoc && newDoc.valuations);
  const symbols = [...new Set([...Object.keys(oldV), ...Object.keys(newV)])].sort();
  /** @type {StaleChange[]} */
  const out = [];
  for (const symbol of symbols) {
    const oe = asObj(oldV[symbol]);
    const ne = asObj(newV[symbol]);
    const os = asObj(oe.staleFields);
    const ns = asObj(ne.staleFields);
    const keys = [...new Set([...Object.keys(os), ...Object.keys(ns)])];
    for (const key of keys) {
      const inOld = Object.prototype.hasOwnProperty.call(os, key);
      const inNew = Object.prototype.hasOwnProperty.call(ns, key);
      /** @type {StaleChange['kind']} */
      const kind = inOld && inNew ? 'kept-cont' : inNew ? 'kept-new' : 'recovered';
      const since = String(inNew ? ns[key] : os[key]);
      out.push({ symbol, key, kind, since, old: fieldOf(oe, key), new: fieldOf(ne, key) });
    }
  }
  return out;
}

/**
 * Markdown のセル用に値を整形する（undefined は「—」、`|` と改行はエスケープ）。
 * @param {unknown} v
 */
export function fmtCell(v) {
  if (v === undefined) return '—';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/** @param {unknown} v */
const isNullish = (v) => v === null || v === undefined;

/**
 * 差分レポートの Markdown を組み立てる。
 * @param {{valuations: ValuationChange[], outcomes: OutcomeChange[], stale?: StaleChange[], date?: string, notes?: string[]}} input
 * @returns {string}
 */
export function renderMarkdown({ valuations, outcomes, stale = [], date, notes = [] }) {
  const lines = [];
  lines.push(`# 週次バッチ 差分レポート${date ? `（${date}）` : ''}`);
  lines.push('');
  lines.push('`git show HEAD:<file>`（実行前）と作業ツリー（実行後）の比較。このレポートはファイルを書き換えない。');
  lines.push('');
  for (const n of notes) lines.push(`> ${n}`);
  if (notes.length) lines.push('');

  // ── サマリ ──
  lines.push('## サマリ');
  lines.push('');
  lines.push(
    '| 対象 | 変化した銘柄（outcomes は entry 数） | 変化したフィールド | うち null 化 | うち null 化（保持） |'
  );
  lines.push('|---|---|---|---|---|');
  for (const block of VALUATION_BLOCKS) {
    const rows = valuations.filter((c) => c.block === block);
    const syms = new Set(rows.map((c) => c.symbol)).size;
    // 「うち null 化」＝保持されずに null になった件数（ガード対象外の経路・想定外の null を見落とさない）
    const nulled = rows.filter((c) => !isNullish(c.old) && isNullish(c.new)).length;
    // 「うち null 化（保持）」＝null ガードで既存値を保持した件数（staleFields の新しい印）
    const kept = stale.filter((c) => c.kind === 'kept-new' && c.key.startsWith(`${block}.`)).length;
    lines.push(`| valuations.${block} | ${syms} | ${rows.length} | ${nulled} | ${kept} |`);
  }
  {
    const entries = new Set(outcomes.map((c) => c.index)).size;
    const nulled = outcomes.filter((c) => !isNullish(c.old) && isNullish(c.new)).length;
    lines.push(`| verdict-outcomes | ${entries} | ${outcomes.length} | ${nulled} | — |`);
  }
  lines.push('');

  // ── valuations.json ──
  lines.push('## data/valuations.json');
  lines.push('');
  if (valuations.length === 0) {
    lines.push('変化なし。');
    lines.push('');
  } else {
    for (const block of VALUATION_BLOCKS) {
      const rows = valuations.filter((c) => c.block === block);
      if (rows.length === 0) continue;
      lines.push(`### ${block}`);
      lines.push('');
      lines.push('| 銘柄 | フィールド | old | new |');
      lines.push('|---|---|---|---|');
      for (const c of rows) {
        lines.push(`| ${fmtCell(c.symbol)} | ${fmtCell(c.field)} | ${fmtCell(c.old)} | ${fmtCell(c.new)} |`);
      }
      lines.push('');
    }
  }

  // ── staleFields（null ガード）── 0 件の節は省略
  const keptNew = stale.filter((c) => c.kind === 'kept-new');
  const keptCont = stale.filter((c) => c.kind === 'kept-cont');
  const recovered = stale.filter((c) => c.kind === 'recovered');
  if (keptNew.length) {
    lines.push('### null 化（保持）');
    lines.push('');
    lines.push('| 銘柄 | フィールド | stale since | 保持している値 |');
    lines.push('|---|---|---|---|');
    for (const c of keptNew) {
      lines.push(`| ${fmtCell(c.symbol)} | ${fmtCell(c.key)} | ${fmtCell(c.since)} | ${fmtCell(c.new)} |`);
    }
    lines.push('');
  }
  if (keptCont.length) {
    lines.push('### 保持継続');
    lines.push('');
    lines.push('| 銘柄 | フィールド | stale since | 保持している値 |');
    lines.push('|---|---|---|---|');
    for (const c of keptCont) {
      lines.push(`| ${fmtCell(c.symbol)} | ${fmtCell(c.key)} | ${fmtCell(c.since)} | ${fmtCell(c.new)} |`);
    }
    lines.push('');
  }
  if (recovered.length) {
    lines.push('### 回復（old→new）');
    lines.push('');
    lines.push('| 銘柄 | フィールド | stale since | old | new |');
    lines.push('|---|---|---|---|---|');
    for (const c of recovered) {
      lines.push(
        `| ${fmtCell(c.symbol)} | ${fmtCell(c.key)} | ${fmtCell(c.since)} | ${fmtCell(c.old)} | ${fmtCell(c.new)} |`
      );
    }
    lines.push('');
  }

  // ── verdict-outcomes.json ──
  lines.push('## data/verdict-outcomes.json');
  lines.push('');
  if (outcomes.length === 0) {
    lines.push('変化なし。');
    lines.push('');
  } else {
    lines.push('| # | 銘柄 | 日付 | kind | フィールド | old | new |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const c of outcomes) {
      lines.push(
        `| ${c.index} | ${fmtCell(c.symbol)} | ${fmtCell(c.date)} | ${fmtCell(c.kind)} | ${c.field} | ${fmtCell(c.old)} | ${fmtCell(c.new)} |`
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ── CLI ──────────────────────────────────────────────

/**
 * HEAD 版のファイル内容を JSON で返す（HEAD に無ければ null）。
 * @param {string} root
 * @param {string} rel
 */
function readHeadJson(root, rel) {
  try {
    const txt = execFileSync('git', ['show', `HEAD:${rel}`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

/**
 * 作業ツリーのファイル内容を JSON で返す（無ければ null）。
 * @param {string} root
 * @param {string} rel
 */
function readWorkJson(root, rel) {
  const p = resolve(root, rel);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

function main() {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const ROOT = resolve(__dir, '../..');
  const args = process.argv.slice(2);
  const di = args.indexOf('--date');
  const date = di !== -1 ? args[di + 1] : new Date().toISOString().slice(0, 10);

  const notes = [];
  const files = { vals: 'data/valuations.json', outs: 'data/verdict-outcomes.json' };
  const oldVals = readHeadJson(ROOT, files.vals);
  const newVals = readWorkJson(ROOT, files.vals);
  const oldOuts = readHeadJson(ROOT, files.outs);
  const newOuts = readWorkJson(ROOT, files.outs);
  if (oldVals == null) notes.push(`HEAD に ${files.vals} がありません（全件を追加として扱います）。`);
  if (oldOuts == null) notes.push(`HEAD に ${files.outs} がありません（全件を追加として扱います）。`);

  const md = renderMarkdown({
    valuations: diffValuations(oldVals, newVals),
    outcomes: diffOutcomes(oldOuts, newOuts),
    stale: diffStale(oldVals, newVals),
    date,
    notes,
  });
  process.stdout.write(`${md}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
