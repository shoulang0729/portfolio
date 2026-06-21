// @ts-check
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { execSync } from 'child_process';
import { resolveOutcome, HORIZON_DAYS, DEFAULT_BENCHMARK } from '../../src/verdict-outcomes.js';

// ══════════════════════════════════════════════════════════════
// hit-rate.mjs ―― verdict-outcomes の pending を自動採点する週次バッチ（D-4）
//
// horizon（発議21営業日 / verdict126営業日）を経過した pending entry に、
// 履歴（Yahoo chart・Worker /yahoo 経由）から対ACWI相対リターンを計算し、
// resolveOutcome() で hit/miss を `proposedOutcome` に提案する。
// 手動 `outcome`（hit/miss）が設定済みの entry は触らない（手動優先）。
//
// 設計正本: docs/handoff/2026-06-21-risk-discipline-designs.md §D-4。
// ══════════════════════════════════════════════════════════════

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const OUT_PATH = resolve(ROOT, 'data/verdict-outcomes.json');
const WORKER = 'https://portfolio-proxy.shoulang.workers.dev';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

/** 営業日ホライズン → 概算カレンダー日（×7/5、切り上げ）。 */
function calendarDays(tradingDays) {
  return Math.ceil((tradingDays * 7) / 5);
}

/** ログのシンボルを Yahoo シンボルへ（4桁数値は東証＝.T 付与）。 */
function toYahooSymbol(sym) {
  return /^\d{4}$/.test(sym) ? `${sym}.T` : sym;
}

/** Worker /yahoo 経由で chart（日足）を取得。{tsSec[], close[]} を返す。 */
async function fetchChart(sym, range = '1y') {
  const yurl = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=${range}`;
  const r = await fetch(`${WORKER}/yahoo?url=${encodeURIComponent(yurl)}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const res = j && j.chart && j.chart.result && j.chart.result[0];
  const ts = res && res.timestamp;
  const close = res && res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close;
  if (!Array.isArray(ts) || !Array.isArray(close)) throw new Error('chart 形式不正');
  return { ts, close };
}

/** 指定日（ms）以前で最も近い終値。 */
function closeOnOrBefore(chart, targetMs) {
  let best = null;
  for (let i = 0; i < chart.ts.length; i++) {
    const c = chart.close[i];
    if (c == null || !isFinite(c)) continue;
    const ms = chart.ts[i] * 1000;
    if (ms <= targetMs) best = c;
    else break;
  }
  return best;
}

/** entry のウィンドウ内リターン（小数）。素材欠損は null。 */
function windowReturn(chart, startMs, endMs) {
  const a = closeOnOrBefore(chart, startMs);
  const b = closeOnOrBefore(chart, endMs);
  if (a == null || b == null || a === 0) return null;
  return b / a - 1;
}

async function main() {
  const doc = JSON.parse(readFileSync(OUT_PATH, 'utf8'));
  const outcomes = Array.isArray(doc.outcomes) ? doc.outcomes : [];
  const todayMs = Date.now();

  // 採点対象＝手動 outcome 未確定 ＆ 既提案なし ＆ horizon 経過
  const eligible = outcomes.filter((o) => {
    if (o.outcome === 'hit' || o.outcome === 'miss') return false; // 手動優先
    if (o.proposedOutcome === 'hit' || o.proposedOutcome === 'miss') return false; // 既提案
    const kind = o.kind || 'action';
    const hd = o.horizonDays || HORIZON_DAYS[kind] || 21;
    const startMs = Date.parse(o.date);
    if (Number.isNaN(startMs)) return false;
    const endMs = startMs + calendarDays(hd) * 864e5;
    return todayMs >= endMs;
  });

  console.log(`${outcomes.length} outcomes / ${eligible.length} eligible (horizon 経過 pending)`);
  if (eligible.length === 0) {
    console.log('採点対象なし。終了。');
    return;
  }

  // ベンチ（ACWI）chart は一度だけ取得
  const bench = await fetchChart(DEFAULT_BENCHMARK);
  let proposed = 0;
  for (const o of eligible) {
    try {
      const kind = o.kind || 'action';
      const hd = o.horizonDays || HORIZON_DAYS[kind] || 21;
      const startMs = Date.parse(o.date);
      const endMs = Math.min(startMs + calendarDays(hd) * 864e5, todayMs);
      const sym = await fetchChart(toYahooSymbol(o.symbol));
      const pfRet = windowReturn(sym, startMs, endMs);
      const benchRet = windowReturn(bench, startMs, endMs);
      const res = resolveOutcome(o, pfRet, benchRet);
      if (res == null) {
        console.warn(`  ${o.symbol}(${o.date}): 判定不能（方向不明/データ欠損）→ skip`);
        continue;
      }
      o.proposedOutcome = res;
      o.resolvedAt = new Date(todayMs).toISOString().slice(0, 10);
      proposed++;
      console.log(`  ${o.symbol}(${o.date}) ${kind}/${o.dir}: pf ${(pfRet * 100).toFixed(1)}% vs ACWI ${(benchRet * 100).toFixed(1)}% → ${res}`);
    } catch (e) {
      console.warn(`  ${o.symbol}(${o.date}): ${e.message}（スキップ）`);
    }
  }

  if (DRY_RUN) {
    console.log(`\nDRY RUN — ${proposed} 件提案（書き込まない）`);
    return;
  }
  if (proposed === 0) {
    console.log('提案ゼロ。書き込み無し。');
    return;
  }

  writeFileSync(OUT_PATH, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  console.log(`\nWrote ${OUT_PATH} (${proposed} proposed)`);
  execSync(`git commit data/verdict-outcomes.json -m "chore: verdict-outcomes proposedOutcome auto-update $(date +%F)"`, {
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
