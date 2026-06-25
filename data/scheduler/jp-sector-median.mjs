// @ts-check
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { execSync } from 'child_process';
import { writeBlocks } from './writeback.mjs';

// ══════════════════════════════════════════════════════════════
// jp-sector-median.mjs ―― 日本株のファンダ＋セクター中央値（PER）を valuations.json に投入する週次バッチ（#497）
//
// 設計＝docs/handoff/2026-06-25-jp-fundamentals-source.md（#496 スパイク結論）。Finnhub が日本株を
// カバーしない穴を埋める。Phase1（#493・米株 Finnhub）と独立。
//   ① 個別ファンダ: Yahoo quoteSummary（Worker /yahoo 経由）で trailingPE/EV-EBITDA/PEG を取得し、
//      value.{perTrail,evEbitda,peg} の **未設定のみ** 補完（手動シードは上書きしない）。
//   ② セクター中央値: TOPIX-17 セクターETF proxy の **PER のみ**（ETF では PER しか出ない）。
//      sym→ETF の小さな静的マップで紐付け。sectorMedian={per,n:null,source:"etf-proxy",etf,asOf}。
//   日本株/ETF は EV/EBITDA 等の peer 破線を出さない縮退。render 時に外部 API は叩かない（バッチ→ファイル）。
// ══════════════════════════════════════════════════════════════

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const VALS_PATH = resolve(ROOT, 'data/valuations.json');
const WORKER = 'https://portfolio-proxy.shoulang.workers.dev';

// sym → TOPIX-17 セクターETF（NEXT FUNDS）。銘柄追加時はここに1行足す。
const JP_SECTOR_ETF = {
  '6301.T': '1624.T', // 小松＝機械
  '6016.T': '1624.T', // ジャパンエンジン（舶用エンジン）＝機械
  '8050.T': '1625.T', // セイコー＝電機・精密
  '9983.T': '1630.T', // ファストリ＝小売
};

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Worker /yahoo 経由で quoteSummary を取得（1回リトライ）。 */
async function quoteSummary(sym, modules) {
  const yurl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=${modules}`;
  const url = `${WORKER}/yahoo?url=${encodeURIComponent(yurl)}`;
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      return (j && j.quoteSummary && j.quoteSummary.result && j.quoteSummary.result[0]) || null;
    } catch (e) {
      if (attempt === 0) await sleep(3000);
      else throw e;
    }
  }
}

/** raw 数値を安全に取り出す（{raw} or 素の数値）。 */
function raw(x) {
  if (x == null) return null;
  const v = typeof x === 'object' ? x.raw : x;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function round1(x) {
  return typeof x === 'number' && Number.isFinite(x) ? +x.toFixed(1) : null;
}

/** ETF の trailingPE を取得（セクター中央値 proxy）。 */
async function etfPer(etf) {
  const r = await quoteSummary(etf, 'summaryDetail');
  return round1(raw(r && r.summaryDetail && r.summaryDetail.trailingPE));
}

async function main() {
  // valuations.json は { valuations: { "SYM": {entry} } } 構造
  const doc = JSON.parse(readFileSync(VALS_PATH, 'utf8'));
  const valuations = doc.valuations || {};

  // 対象＝日本個別株（.T・quality あり・ETF でない・セクターETF マップに在る）
  const targets = Object.keys(valuations).filter((sym) => {
    if (!sym.endsWith('.T')) return false;
    const e = valuations[sym];
    if (!e || !e.quality) return false; // 個別株のみ（ETF は quality 無し）
    if (!JP_SECTOR_ETF[sym]) return false; // セクターマップ未登録はスキップ
    return true;
  });

  console.log(`Processing ${targets.length} JP stocks: ${targets.join(', ')}`);
  if (DRY_RUN) console.log('DRY RUN — will not write or commit');

  // セクターETF の PER をキャッシュ（複数銘柄で共有）
  /** @type {Record<string, number|null>} */
  const etfPerCache = {};
  const asOf = new Date().toISOString().slice(0, 10);

  /** @type {Record<string, object>} */
  const valueResults = {};
  /** @type {Record<string, object>} */
  const smResults = {};

  for (const sym of targets) {
    console.log(`\n[${sym}]`);
    try {
      // ① 個別ファンダ（Yahoo）→ 未設定のみ補完
      const r = await quoteSummary(sym, 'summaryDetail,defaultKeyStatistics');
      const sd = (r && r.summaryDetail) || {};
      const ks = (r && r.defaultKeyStatistics) || {};
      const yPerTrail = round1(raw(sd.trailingPE));
      const yEvEbitda = round1(raw(ks.enterpriseToEbitda));
      const yPeg = round1(raw(ks.pegRatio));

      const cur = valuations[sym].value || {};
      const merged = { ...cur };
      let filled = [];
      if (merged.perTrail == null && yPerTrail != null) {
        merged.perTrail = yPerTrail;
        filled.push(`perTrail=${yPerTrail}`);
      }
      if (merged.evEbitda == null && yEvEbitda != null) {
        merged.evEbitda = yEvEbitda;
        filled.push(`evEbitda=${yEvEbitda}`);
      }
      if (merged.peg == null && yPeg != null) {
        merged.peg = yPeg;
        filled.push(`peg=${yPeg}`);
      }
      if (filled.length) {
        valueResults[sym] = merged;
        console.log(`  value 補完: ${filled.join(' ')}`);
      } else {
        console.log('  value 補完なし（手動シード済 or Yahoo 欠損）');
      }

      // ② セクター中央値（TOPIX-17 ETF proxy の PER）
      const etf = JP_SECTOR_ETF[sym];
      if (!(etf in etfPerCache)) {
        etfPerCache[etf] = await etfPer(etf);
        await sleep(800);
      }
      const per = etfPerCache[etf];
      if (per != null) {
        smResults[sym] = { per, n: null, source: 'etf-proxy', etf, asOf };
        console.log(`  sectorMedian: per=${per}（proxy ${etf}）`);
      } else {
        console.warn(`  sectorMedian: ${etf} の PER 取得できず（スキップ）`);
      }
      await sleep(800);
    } catch (e) {
      console.warn(`  ${sym}: ${e.message}（スキップ）`);
    }
  }

  if (DRY_RUN) {
    console.log('\n--- DRY RUN: value 補完 ---');
    console.log(JSON.stringify(valueResults, null, 2));
    console.log('--- DRY RUN: sectorMedian ---');
    console.log(JSON.stringify(smResults, null, 2));
    return;
  }

  let written = 0;
  if (Object.keys(valueResults).length) written += writeBlocks(VALS_PATH, valueResults, 'value');
  if (Object.keys(smResults).length) written += writeBlocks(VALS_PATH, smResults, 'sectorMedian');
  if (written === 0) {
    console.log('投入対象なし。');
    return;
  }
  console.log(`\nWrote ${VALS_PATH}`);

  execSync(`git commit data/valuations.json -m "chore: JP sector median + fundamentals auto-update $(date +%F)"`, {
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
