// @ts-check
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import { normalizeEdinetFinancials, resolveEdinetCode } from '../../src/edinet-normalize.js';
import { computeQuality } from '../../src/quality-calc.js';
import { writeQualityBlocks } from './writeback.mjs';
import { edinetDb } from './lib/worker-client.mjs';

// EDINET DB は Worker 中継口（/edinet-db）経由（X-API-Key は Worker Secrets・#652 PR5）。
// コミットはしない（ワークフロー weekly-valuations.yml が 1 回でコミットする）。

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const VALS_PATH = resolve(ROOT, 'data/valuations.json');

const JP_ETF_SKIP = new Set([
  '1306.T', '1615.T', '1629.T', '1477.T', '2516.T', '200A.T',
]);

// --- CLI flags ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const symbolFlag = (() => {
  const idx = args.indexOf('--symbol');
  return idx !== -1 ? args[idx + 1] : null;
})();

// --- Target symbol resolution ---
// valuations は { "SYM": {entry} } 構造（シンボルキー付きオブジェクト）
function resolveTargets(valuations) {
  return Object.keys(valuations).filter(sym => {
    if (!sym.endsWith('.T')) return false;
    if (JP_ETF_SKIP.has(sym)) return false;
    return true;
  });
}

// --- Per-symbol processing ---
async function processSymbol(sym) {
  const code4 = sym.replace('.T', '');

  console.log(`[${sym}] EDINET検索中...`);
  let searchResp;
  try {
    searchResp = await edinetDb('/v1/search', { q: code4 });
  } catch (e) {
    console.warn(`[${sym}] 検索失敗: ${e.message}`);
    return null;
  }

  const edinetCode = resolveEdinetCode(searchResp, code4);
  if (!edinetCode) {
    console.warn(`[${sym}] EDINETコード未解決`);
    return null;
  }

  console.log(`[${sym}] 財務データ取得中 (${edinetCode})...`);
  let finResp;
  try {
    finResp = await edinetDb(`/v1/companies/${edinetCode}/financials`, { period: 'annual', limit: 2 });
  } catch (e) {
    console.warn(`[${sym}] 財務データ取得失敗: ${e.message}`);
    return null;
  }

  let fundamentals;
  try {
    fundamentals = normalizeEdinetFinancials(finResp, { market: 'jp', marketCap: null });
  } catch (e) {
    console.warn(`[${sym}] 財務データ正規化失敗: ${e.message}`);
    return null;
  }

  let quality;
  try {
    quality = computeQuality(fundamentals);
  } catch (e) {
    console.warn(`[${sym}] quality計算失敗: ${e.message}`);
    return null;
  }

  console.log(`[${sym}] quality計算完了:`, quality);
  return quality;
}

// --- Main ---
async function main() {
  // valuations.json は { updated, note, asOf, valuations: { "SYM": {entry} } } 構造
  const doc = JSON.parse(readFileSync(VALS_PATH, 'utf8'));
  const valuations = doc.valuations || {};

  let targets = resolveTargets(valuations);
  if (symbolFlag) {
    if (!targets.includes(symbolFlag)) {
      console.error(`Error: ${symbolFlag} は対象JP株ではありません`);
      process.exit(1);
    }
    targets = [symbolFlag];
  }

  console.log(`処理対象: ${targets.join(', ')}`);
  if (DRY_RUN) console.log('[DRY RUN] ファイル書き込みはスキップします');

  const results = {};
  for (const sym of targets) {
    const quality = await processSymbol(sym);
    if (quality !== null) {
      results[sym] = quality;
    }
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] 計算結果:');
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // Write back: 元フォーマットを保ったまま quality ブロックだけ差し替え
  const updated = writeQualityBlocks(VALS_PATH, results);
  console.log(`\nvaluations.json 更新完了 (${updated}銘柄)`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
