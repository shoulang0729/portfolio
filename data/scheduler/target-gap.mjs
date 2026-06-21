// @ts-check
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { execSync } from 'child_process';
import { writeBlocks } from './writeback.mjs';

// ══════════════════════════════════════════════════════════════
// target-gap.mjs ―― アナリスト目標株価乖離（targetGapPct）を投入する週次バッチ（D-5②）
//
// Yahoo `financialData.targetMeanPrice` / `currentPrice`（Worker `/yahoo` 経由）から
//   targetGapPct = round((targetMean / currentPrice − 1) × 100)   [%]
// を算出し、対象個別株の value.targetGapPct を更新する（#427 で可用性確認済）。
//
//   - 対象＝個別株のみ（quality ブロックあり・ETF/HK 除外）。
//   - アナリスト未カバー（targetMeanPrice 欠損・例 6016.T）は null 継続＝スキップ。
//   - 既存 value ブロックの他フィールド（fcfYield/peg 等）は保全（マージ書き戻し）。
//   - numberOfAnalystOpinions が小さい銘柄は信頼度が低い（将来 confidence 連動・本バッチでは値のみ）。
// ══════════════════════════════════════════════════════════════

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const VALS_PATH = resolve(ROOT, 'data/valuations.json');
const WORKER = 'https://portfolio-proxy.shoulang.workers.dev';

// --- CLI flags ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const symbolIdx = args.indexOf('--symbol');
const ONLY_SYMBOL = symbolIdx !== -1 ? args[symbolIdx + 1] : null;

/**
 * Worker /yahoo 経由で JSON を取得（1回リトライ）。
 * @param {string} yahooUrl
 * @returns {Promise<any>}
 */
async function fetchYahoo(yahooUrl) {
  const url = `${WORKER}/yahoo?url=${encodeURIComponent(yahooUrl)}`;
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt === 0) await new Promise((r) => setTimeout(r, 3000));
      else throw e;
    }
  }
}

/**
 * 個別株の targetGapPct を取得（未カバー/取得不可は null）。
 * @param {string} sym
 * @returns {Promise<{gap:number, n:number|null}|null>}
 */
async function fetchTargetGap(sym) {
  const yurl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=financialData`;
  const j = await fetchYahoo(yurl);
  const fd = j && j.quoteSummary && j.quoteSummary.result && j.quoteSummary.result[0] && j.quoteSummary.result[0].financialData;
  if (!fd) return null; // ETF 等 financialData 不在
  const tm = fd.targetMeanPrice && typeof fd.targetMeanPrice.raw === 'number' ? fd.targetMeanPrice.raw : null;
  const cp = fd.currentPrice && typeof fd.currentPrice.raw === 'number' ? fd.currentPrice.raw : null;
  const n = fd.numberOfAnalystOpinions && typeof fd.numberOfAnalystOpinions.raw === 'number' ? fd.numberOfAnalystOpinions.raw : null;
  if (tm == null || cp == null || cp === 0) return null; // 未カバー
  return { gap: Math.round((tm / cp - 1) * 100), n };
}

/**
 * 対象個別株を valuations.json から導出。
 * quality ブロックを持つ＝個別株（ETF は quality 無し）。アナリスト目標は
 * シクリカル個別株（例 6301.T コマツ）にも有効なので cyclical では除外しない。
 * @param {Record<string, any>} valuations
 * @returns {string[]}
 */
function resolveTargets(valuations) {
  return Object.keys(valuations).filter((sym) => {
    const e = valuations[sym];
    if (!e || !e.quality) return false; // 個別株のみ（quality 持ち＝ETF を自動除外）
    if (sym.endsWith('.HK')) return false; // HK は ETF のみ・financialData 不在
    return true;
  });
}

async function main() {
  const doc = JSON.parse(readFileSync(VALS_PATH, 'utf8'));
  const valuations = doc.valuations || {};

  let targets = resolveTargets(valuations);
  if (ONLY_SYMBOL) {
    if (!targets.includes(ONLY_SYMBOL)) {
      console.error(`${ONLY_SYMBOL} は対象個別株ではありません`);
      process.exit(1);
    }
    targets = [ONLY_SYMBOL];
  }

  console.log(`Processing ${targets.length} stocks: ${targets.join(', ')}`);
  if (DRY_RUN) console.log('DRY RUN — will not write or commit');

  /** @type {Record<string, object>} 既存 value にマージした完全ブロック */
  const merged = {};
  for (const sym of targets) {
    try {
      const r = await fetchTargetGap(sym);
      if (r == null) {
        console.warn(`  ${sym}: 目標株価なし（未カバー/ETF）→ skip`);
        continue;
      }
      // 既存 value を保全しつつ targetGapPct だけ更新（他フィールドは触らない）
      merged[sym] = { ...(valuations[sym].value || {}), targetGapPct: r.gap };
      console.log(`  ${sym}: targetGapPct = ${r.gap >= 0 ? '+' : ''}${r.gap}% (n=${r.n ?? '—'})`);
    } catch (err) {
      console.warn(`  ${sym}: ${err.message}（スキップ）`);
    }
  }

  if (DRY_RUN) {
    console.log('\n--- DRY RUN results (targetGapPct only) ---');
    console.log(JSON.stringify(Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, v.targetGapPct])), null, 2));
    return;
  }

  const written = writeBlocks(VALS_PATH, merged, 'value');
  console.log(`\nWrote ${VALS_PATH} (${written} stocks)`);

  execSync(`git commit data/valuations.json -m "chore: targetGapPct auto-update $(date +%F)"`, {
    cwd: ROOT,
    shell: true,
  });
  execSync('git push', { cwd: ROOT });
  console.log('Committed and pushed.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
