#!/usr/bin/env node
// @ts-check
// watchlist-per.mjs — ウォッチ/保有銘柄の現在PER(trailingPE)を Worker の /yahoo 中継口から決定論取得し、
// valuations.json のバンド内%タイル＆status を算術で再計算する（#652 PR2）。WebSearch/LLM 不要。
//
// 原本: docs/handoff/assets/2026-10-03-phase15/watchlist-per.mjs（Mulmo ワークスペース版）。
//   curl/execSync → lib/worker-client.mjs（Origin・タイムアウト・リトライ・スロットル）、パスはリポ基準。
//   score()・PER の取り出し・前回値維持・--write の更新フィールドは原本どおり（lib/per-calc.mjs）。
//   出力に影響しない変更: source==='fund-monthly-top10' のエントリ（投信名キー）は Yahoo に問い合わせずスキップ
//   （原本でも取得失敗→前回維持になるだけ）。--write は読み込んだファイルの書式（インデント・末尾改行）を保持する。
//
// 使い方:
//   node data/scheduler/watchlist-per.mjs                 # 全銘柄を取得して標準出力に JSON（書き込みはしない）
//   node data/scheduler/watchlist-per.mjs --out <file>    # 結果 JSON をファイルへ（bandLow/bandHigh・runStartedAt 付き）
//   node data/scheduler/watchlist-per.mjs --write         # valuations.json の perCurrent/percentile/status/asOf を更新保存
//   node data/scheduler/watchlist-per.mjs SYM1 SYM2       # 指定シンボルだけ（検証用）
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import { yahooQuoteSummary } from './lib/worker-client.mjs';
import { pickTrailingPE, pickForwardPE, score, FUND_SOURCE } from './lib/per-calc.mjs';
import { detectFormat, stringifyLike } from './lib/json-format.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const VAL = resolve(ROOT, 'data/valuations.json');

const runStartedAt = new Date().toISOString();
const today = runStartedAt.slice(0, 10);

const args = process.argv.slice(2);
const doWrite = args.includes('--write');
const outIdx = args.indexOf('--out');
const outFile = outIdx !== -1 ? args[outIdx + 1] : null;
if (outIdx !== -1 && (!outFile || outFile.startsWith('--'))) {
  console.error('[watchlist-per] --out にはファイルパスが必要です');
  process.exit(2);
}
const only = args.filter((a, i) => !a.startsWith('--') && !(outIdx !== -1 && i === outIdx + 1));

/**
 * @param {string} ySymbol
 * @returns {Promise<{error?: string, trailingPE?: number | null, forwardPE?: any}>}
 */
async function fetchPE(ySymbol) {
  let d;
  try {
    d = await yahooQuoteSummary(ySymbol, 'summaryDetail,defaultKeyStatistics');
  } catch (e) {
    return { error: `fetch:${String((e && /** @type {any} */ (e).message) || e).slice(0, 40)}` };
  }
  return { trailingPE: pickTrailingPE(d), forwardPE: pickForwardPE(d) };
}

async function main() {
  const raw = readFileSync(VAL, 'utf8');
  const store = JSON.parse(raw);
  /** @type {{asOf: string, source: string, runStartedAt: string, results: Record<string, any>, skipped: Array<{sym: string, reason: string}>, wrote?: string}} */
  const out = { asOf: today, source: 'worker/yahoo trailingPE', runStartedAt, results: {}, skipped: [] };

  for (const [sym, v] of Object.entries(store.valuations)) {
    if (only.length && !only.includes(sym)) continue;
    const lo = v.bandLow,
      hi = v.bandHigh;
    const isFund = v.source === FUND_SOURCE;
    const f = isFund ? { error: 'fund-monthly-top10（fund-per で計算）' } : await fetchPE(sym);
    if (f.error || f.trailingPE == null) {
      out.skipped.push({ sym, reason: f.error || 'PE無し(ETF/赤字NM等)' });
      out.results[sym] = {
        perCurrent: v.perCurrent ?? null,
        percentile: v.percentile ?? null,
        status: v.status ?? 'hold',
        asOf: v.asOf ?? null,
        note: '自動取得不可→前回維持(週次Opusで補完)',
        bandLow: lo ?? null,
        bandHigh: hi ?? null,
        ...(isFund ? { source: FUND_SOURCE } : {}),
      };
      continue;
    }
    const s = score(f.trailingPE, lo, hi);
    out.results[sym] = {
      perCurrent: f.trailingPE,
      forwardPE: f.forwardPE,
      ...s,
      asOf: today,
      prev: { perCurrent: v.perCurrent, status: v.status },
      bandLow: lo ?? null,
      bandHigh: hi ?? null,
    };
    if (doWrite) {
      store.valuations[sym] = {
        ...v,
        perCurrent: f.trailingPE,
        percentile: s.percentile,
        status: s.status,
        asOf: today,
      };
    }
  }

  if (doWrite) {
    store.updated = `${today}-auto-per`;
    store.asOf = today;
    writeFileSync(VAL, stringifyLike(store, detectFormat(raw)));
    out.wrote = 'data/valuations.json';
  }

  if (outFile) {
    writeFileSync(outFile, `${JSON.stringify(out, null, 1)}\n`);
    // 公開ログには件数と skipped の銘柄シンボルだけを出す
    const total = Object.keys(out.results).length;
    const skippedSyms = out.skipped.map((s) => s.sym).join(', ');
    console.log(
      `[watchlist-per] asOf=${today} total=${total} updated=${total - out.skipped.length} skipped=${out.skipped.length}${skippedSyms ? ` (${skippedSyms})` : ''}${doWrite ? ' wrote=data/valuations.json' : ''}`
    );
  } else {
    process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
  }
}

main().catch((e) => {
  console.error(`[watchlist-per] 失敗: ${String((e && e.message) || e).slice(0, 120)}`);
  process.exit(1);
});
