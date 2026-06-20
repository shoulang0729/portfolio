// @ts-check
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { execSync } from 'child_process';
import { writeBlocks } from './writeback.mjs';

// ══════════════════════════════════════════════════════════════
// etf-pe.mjs ―― ETF の実績PER（trailing P/E）を valuations.json に投入する週次バッチ（A4）
//
// FMP は ETF のファンドレベル PER を持たない（§6 調査）。Yahoo Finance
// `summaryDetail.trailingPE` が唯一の自動取得手段なので、Worker `/yahoo` 経由で取得し、
// 対象 ETF の value.perTrail / value.perSource を更新する。
//
// 設計根拠: docs/d3-etf-proxy-data-availability.md §7（確定設計 A4）。
//   - perFwd / peg は ETF では取得不能 → 触らない（null のまま）。
//   - perSource:"fund-trailing" を立て、UI で proxy バッジ＋低 confidence を表示。
//   - 対象は §7.2「広域株式」「セクター/テーマ株式」の上2区分のみ（10銘柄）。
//     シクリカル(COPX/REMX/XLE=cyclical na)・日本欠損 ETF は対象外。
// ══════════════════════════════════════════════════════════════

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const VALS_PATH = resolve(ROOT, 'data/valuations.json');

const WORKER = 'https://portfolio-proxy.shoulang.workers.dev';

// §7.2 上2区分（広域株式 + セクター/テーマ株式）= proxy 対象 ETF
const TARGET_ETFS = ['VT', 'VEA', 'VGK', 'ACWI', 'SMH', 'XLF', 'XLV', 'XLP', 'DTCR', 'SHLD'];

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
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        throw e;
      }
    }
  }
}

/**
 * ETF の trailingPE を取得（取れなければ null）。
 * @param {string} sym
 * @returns {Promise<number|null>}
 */
async function fetchTrailingPE(sym) {
  const yurl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=summaryDetail`;
  const j = await fetchYahoo(yurl);
  const r = j && j.quoteSummary && j.quoteSummary.result && j.quoteSummary.result[0];
  const pe = r && r.summaryDetail && r.summaryDetail.trailingPE;
  const raw = pe && typeof pe.raw === 'number' ? pe.raw : null;
  return raw != null && isFinite(raw) && raw > 0 ? +raw.toFixed(2) : null;
}

async function main() {
  let targets = TARGET_ETFS;
  if (ONLY_SYMBOL) {
    if (!targets.includes(ONLY_SYMBOL)) {
      console.error(`${ONLY_SYMBOL} は対象 ETF ではありません（対象: ${TARGET_ETFS.join(', ')}）`);
      process.exit(1);
    }
    targets = [ONLY_SYMBOL];
  }

  console.log(`Processing ${targets.length} ETFs: ${targets.join(', ')}`);
  if (DRY_RUN) console.log('DRY RUN — will not write or commit');

  /** @type {Record<string, {perTrail:number, perSource:string}>} */
  const results = {};
  for (const sym of targets) {
    try {
      const perTrail = await fetchTrailingPE(sym);
      if (perTrail == null) {
        console.warn(`  ${sym}: trailingPE 取得できず（スキップ）`);
        continue;
      }
      // perFwd / peg は ETF では取れないため value は perTrail + perSource のみ。
      // 既存ブロック（SMH の NVDA seed 等）は writeBlocks が丸ごと置換する＝seed 撤去も兼ねる。
      results[sym] = { perTrail, perSource: 'fund-trailing' };
      console.log(`  ${sym}: perTrail = ${perTrail}`);
    } catch (err) {
      console.warn(`  ${sym}: ${err.message}（スキップ）`);
    }
  }

  if (DRY_RUN) {
    console.log('\n--- DRY RUN results ---');
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  const written = writeBlocks(VALS_PATH, results, 'value');
  console.log(`\nWrote ${VALS_PATH} (${written} ETFs)`);

  // パス限定コミット（共有ワークツリーで他にステージ済みでも valuations.json だけ）
  execSync(`git commit data/valuations.json -m "chore: ETF trailingPE auto-update $(date +%F)"`, {
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
