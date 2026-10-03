#!/usr/bin/env node
// @ts-check
// fund-per.mjs — アクティブ投信の「上位10銘柄 加重実績PER」を算出する（#652 PR2）。
// 入力: data/scheduler/fund-holdings.json（月次レポートの上位10＝code/weight・ファンドの公開開示）。
// 各 code の Yahoo trailingPE を Worker の /yahoo 中継口で取得し、組入比率で加重平均。
//
// 原本: docs/handoff/assets/2026-10-03-phase15/fund-per.mjs（Mulmo ワークスペース版・2026-06-28 新設）。
//   curl/execSync → lib/worker-client.mjs、パスはリポ基準。加重平均と coverage は原本どおり（lib/per-calc.mjs）。
//   --write の追加マージ `{...prev, ...e, status: prev.status || 'na'}` は原本どおり。書式は読み込んだファイルに合わせる。
//
// 使い方:
//   node data/scheduler/fund-per.mjs               # 標準出力に JSON（書き込みはしない）
//   node data/scheduler/fund-per.mjs --out <file>  # 結果 JSON をファイルへ
//   node data/scheduler/fund-per.mjs --write       # data/valuations.json に valuations[fundSymbol] を追加マージ
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import { yahooQuoteSummary } from './lib/worker-client.mjs';
import { pickTrailingPE, weightedPer } from './lib/per-calc.mjs';
import { detectFormat, stringifyLike } from './lib/json-format.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const HOLD = resolve(__dir, 'fund-holdings.json');
const VALJSON = resolve(ROOT, 'data/valuations.json');

const args = process.argv.slice(2);
const doWrite = args.includes('--write');
const outIdx = args.indexOf('--out');
const outFile = outIdx !== -1 ? args[outIdx + 1] : null;
if (outIdx !== -1 && (!outFile || outFile.startsWith('--'))) {
  console.error('[fund-per] --out にはファイルパスが必要です');
  process.exit(2);
}

/**
 * @param {string} ySymbol
 * @returns {Promise<number | null>}
 */
async function trailingPE(ySymbol) {
  try {
    return pickTrailingPE(await yahooQuoteSummary(ySymbol, 'summaryDetail,defaultKeyStatistics'));
  } catch {
    return null;
  }
}

async function main() {
  const funds = JSON.parse(readFileSync(HOLD, 'utf8'));
  /** @type {{asOf: string, source: string, funds: Record<string, any>}} */
  const out = { asOf: new Date().toISOString().slice(0, 10), source: 'fund-monthly-top10', funds: {} };

  for (const f of funds) {
    const comps = [];
    for (const h of f.top) {
      const per = await trailingPE(h.code);
      comps.push({ code: h.code, name: h.name, w: h.weight, per });
    }
    const { perCurrent, coverage } = weightedPer(comps);
    out.funds[f.fundSymbol] = {
      perCurrent,
      coverage, // 取れた上位銘柄の比率合計（NAV比）
      source: 'fund-monthly-top10',
      asOf: f.asOf, // 月次レポート基準月
      components: comps,
    };
  }

  if (doWrite) {
    const raw = existsSync(VALJSON) ? readFileSync(VALJSON, 'utf8') : null;
    const v = raw != null ? JSON.parse(raw) : { valuations: {} };
    const tbl = v.valuations || v;
    for (const [sym, e] of Object.entries(out.funds)) {
      const prev = tbl[sym] || {};
      tbl[sym] = { ...prev, ...e, status: prev.status || 'na' }; // 追加マージ・既存load-bearingは温存
    }
    // 読み込んだファイルの書式を保持（ファイルが無い場合は原本どおり 1 スペース＋末尾改行）
    const fmt = raw != null ? detectFormat(raw) : { indent: 1, trailingNewline: true };
    writeFileSync(VALJSON, stringifyLike(v, fmt));
  }

  if (outFile) {
    writeFileSync(outFile, `${JSON.stringify(out, null, 2)}\n`);
    // 公開ログには件数と PER/coverage だけを出す（いずれも valuations.json で公開される値）
    for (const [sym, e] of Object.entries(out.funds)) {
      const got = e.components.filter((/** @type {any} */ c) => c.per != null).length;
      console.log(
        `[fund-per] ${sym}: per=${e.perCurrent ?? '—'} coverage=${e.coverage} got=${got}/${e.components.length}`
      );
    }
    if (doWrite) console.log('[fund-per] wrote=data/valuations.json');
  } else {
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  }
}

main().catch((e) => {
  console.error(`[fund-per] 失敗: ${String((e && e.message) || e).slice(0, 120)}`);
  process.exit(1);
});
