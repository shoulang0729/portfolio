// @ts-check
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { execSync } from 'child_process';
import { writeBlocks } from './writeback.mjs';

// ══════════════════════════════════════════════════════════════
// sector-median.mjs ―― 同業（セクター）中央値ベンチマークを valuations.json に投入する週次バッチ（#493）
//
// 設計＝docs/handoff/2026-06-24-sector-average-benchmark.md（#492 スパイク結論）。
//   - Finnhub `/stock/peers`→`/stock/metric` を Worker `/finnhub` proxy 経由で叩く（キーは Worker Secret）。
//   - 米個別株のみ（Finnhub の peers/metric は日本株(.T)・ETF で空＝スパイク実測）。空は縮退（破線なし）。
//   - peer 群の中央値（外れ値に強い）を算出し valuations[sym].sectorMedian へ格納（追加のみ・load-bearing 不変）。
//     { per(peTTM), evEbitda(evEbitdaTTM), grossMargin(grossMarginTTM), pb(pbQuarterly), n, source, asOf }。n<3 は出力しない。
//   - render 時に外部 API を叩かない＝バッチ→ファイル。レートは metric 呼び出し間 throttle で 60/分 内に収める。
// ══════════════════════════════════════════════════════════════

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const VALS_PATH = resolve(ROOT, 'data/valuations.json');
const WORKER = 'https://portfolio-proxy.shoulang.workers.dev';
const THROTTLE_MS = 1100; // 60/分 を超えないよう metric 呼び出しを間引く

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const symbolIdx = args.indexOf('--symbol');
const ONLY_SYMBOL = symbolIdx !== -1 ? args[symbolIdx + 1] : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Worker /finnhub 経由で JSON を取得（1回リトライ）。 */
async function finnhub(path, symbol, extra = '') {
  const url = `${WORKER}/finnhub?path=${encodeURIComponent(path)}&symbol=${encodeURIComponent(symbol)}${extra}`;
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt === 0) await sleep(3000);
      else throw e;
    }
  }
}

/** 数値配列の中央値（空は null）。 */
function median(arr) {
  const xs = arr.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

function round1(x) {
  return typeof x === 'number' && Number.isFinite(x) ? +x.toFixed(1) : null;
}

/** 1銘柄の sectorMedian を算出（取れなければ null）。 */
async function computeSectorMedian(sym) {
  const peersRes = await finnhub('/stock/peers', sym);
  const peers = Array.isArray(peersRes) ? [...new Set(peersRes.filter((p) => typeof p === 'string'))] : [];
  if (peers.length < 3) {
    console.warn(`  ${sym}: peers ${peers.length}件（<3）→ スキップ`);
    return null;
  }
  const per = [];
  const evEbitda = [];
  const grossMargin = [];
  const pb = [];
  for (const peer of peers) {
    let m;
    try {
      const res = await finnhub('/stock/metric', peer, '&metric=all');
      m = (res && res.metric) || {};
    } catch (e) {
      console.warn(`    ${sym} peer ${peer}: metric 取得失敗（${e.message}）`);
      m = {};
    }
    if (Number.isFinite(m.peTTM)) per.push(m.peTTM);
    if (Number.isFinite(m.evEbitdaTTM)) evEbitda.push(m.evEbitdaTTM);
    if (Number.isFinite(m.grossMarginTTM)) grossMargin.push(m.grossMarginTTM);
    if (Number.isFinite(m.pbQuarterly)) pb.push(m.pbQuarterly);
    await sleep(THROTTLE_MS);
  }
  // n＝最も母数の多い指標（peTTM）のサンプル数。n<3 は全体スキップ。
  const n = per.length;
  if (n < 3) {
    console.warn(`  ${sym}: 有効 metric ${n}件（<3）→ スキップ`);
    return null;
  }
  return {
    per: round1(median(per)),
    evEbitda: round1(median(evEbitda)),
    grossMargin: round1(median(grossMargin)),
    pb: round1(median(pb)),
    n,
    source: 'finnhub-peers',
    asOf: new Date().toISOString().slice(0, 10),
  };
}

async function main() {
  // valuations.json は { valuations: { "SYM": {entry} } } 構造
  const doc = JSON.parse(readFileSync(VALS_PATH, 'utf8'));
  const valuations = doc.valuations || {};

  // 対象＝米個別株（quality あり・.T/.HK でない・ETF でない）。Finnhub 不可はバッチが縮退。
  let targets = Object.keys(valuations).filter((sym) => {
    if (/\.(T|HK)$/i.test(sym)) return false;
    const e = valuations[sym];
    if (!e || !e.quality) return false; // 個別株のみ（ETF は quality 無し）
    if (e.value && e.value.perSource === 'fund-trailing') return false; // ETF proxy 除外
    return true;
  });
  if (ONLY_SYMBOL) {
    if (!targets.includes(ONLY_SYMBOL)) {
      console.error(`${ONLY_SYMBOL} は対象（米個別株）ではありません`);
      process.exit(1);
    }
    targets = [ONLY_SYMBOL];
  }

  console.log(`Processing ${targets.length} US stocks: ${targets.join(', ')}`);
  if (DRY_RUN) console.log('DRY RUN — will not write or commit');

  /** @type {Record<string, object>} */
  const results = {};
  for (const sym of targets) {
    console.log(`\n[${sym}]`);
    try {
      const sm = await computeSectorMedian(sym);
      if (sm) {
        results[sym] = sm;
        console.log(`  sectorMedian: per=${sm.per} evEbitda=${sm.evEbitda} grossMargin=${sm.grossMargin} pb=${sm.pb} (n=${sm.n})`);
      }
    } catch (e) {
      console.warn(`  ${sym}: ${e.message}（スキップ）`);
    }
  }

  if (DRY_RUN) {
    console.log('\n--- DRY RUN results ---');
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  if (Object.keys(results).length === 0) {
    console.log('投入対象なし（米株の peer が全て空）。');
    return;
  }

  const written = writeBlocks(VALS_PATH, results, 'sectorMedian');
  console.log(`\nWrote ${VALS_PATH} (${written} symbols)`);

  execSync(`git commit data/valuations.json -m "chore: sector median auto-update $(date +%F)"`, {
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
