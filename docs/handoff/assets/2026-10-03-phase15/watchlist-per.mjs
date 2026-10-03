#!/usr/bin/env node
// watchlist-per.mjs — ウォッチ/保有銘柄の現在PER(trailingPE)を portfolio-proxy worker の
// /yahoo プロキシ（Cloudflare egress＝レート制限なし・crumb自動付与）から決定論取得し、
// valuations.json のバンド内%タイル＆status を算術で再計算する。WebSearch/LLM 不要。
//
// 使い方:
//   node data/scheduler/watchlist-per.mjs            # 全銘柄を取得して標準出力にJSON（書き込みはしない）
//   node data/scheduler/watchlist-per.mjs --write     # valuations.json の perCurrent/percentile/status/asOf を更新保存
//   node data/scheduler/watchlist-per.mjs SYM1 SYM2   # 指定シンボルだけ（検証用）
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const VAL = "github/portfolio/data/valuations.json";
const PROXY = "https://portfolio-proxy.shoulang.workers.dev/yahoo";
const ORIGIN = "https://shoulang0729.github.io";
const today = new Date().toISOString().slice(0, 10);

function fetchPE(ySymbol) {
  const y = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySymbol)}?modules=summaryDetail,defaultKeyStatistics`;
  const u = `${PROXY}?url=${encodeURIComponent(y)}`;
  let raw;
  try {
    raw = execSync(`curl -s -m 25 -H "Origin: ${ORIGIN}" "${u}"`, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  } catch (e) { return { error: "fetch:" + (e.message || e).slice(0, 40) }; }
  let d; try { d = JSON.parse(raw); } catch { return { error: "parse" }; }
  const r = (d?.quoteSummary?.result || [])[0] || {};
  const sd = r.summaryDetail || {}, ks = r.defaultKeyStatistics || {};
  const pick = (o, k) => (o?.[k] && typeof o[k] === "object" ? o[k].raw : o?.[k]);
  const pe = pick(sd, "trailingPE") ?? pick(ks, "trailingPE") ?? null;
  return { trailingPE: (Number.isFinite(pe) && pe > 0) ? +pe.toFixed(2) : null,
           forwardPE: pick(sd, "forwardPE") ?? null };
}

// バンド内の線形%タイル（bandLow→0%, bandHigh→100%）と status
function score(per, lo, hi) {
  if (!Number.isFinite(per) || per <= 0 || !Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo)
    return { percentile: null, status: "hold" };
  const p = Math.max(0, Math.min(1, (per - lo) / (hi - lo)));
  const pct = Math.round(p * 100);
  const status = pct <= 33 ? "cheap" : pct <= 66 ? "fair" : "rich";
  return { percentile: pct, status };
}

const doWrite = process.argv.includes("--write");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const store = JSON.parse(readFileSync(VAL, "utf8"));
const out = { asOf: today, source: "worker/yahoo trailingPE", results: {}, skipped: [] };

for (const [sym, v] of Object.entries(store.valuations)) {
  if (only.length && !only.includes(sym)) continue;
  const lo = v.bandLow, hi = v.bandHigh;
  const f = fetchPE(sym);
  if (f.error || f.trailingPE == null) {
    out.skipped.push({ sym, reason: f.error || "PE無し(ETF/赤字NM等)" });
    out.results[sym] = { perCurrent: v.perCurrent ?? null, percentile: v.percentile ?? null,
                         status: v.status ?? "hold", asOf: v.asOf ?? null, note: "自動取得不可→前回維持(週次Opusで補完)" };
    continue;
  }
  const s = score(f.trailingPE, lo, hi);
  out.results[sym] = { perCurrent: f.trailingPE, forwardPE: f.forwardPE, ...s, asOf: today,
                       prev: { perCurrent: v.perCurrent, status: v.status } };
  if (doWrite) {
    store.valuations[sym] = { ...v, perCurrent: f.trailingPE, percentile: s.percentile, status: s.status, asOf: today };
  }
}

if (doWrite) {
  store.updated = today + "-auto-per";
  store.asOf = today;
  writeFileSync(VAL, JSON.stringify(store, null, 1));
  out.wrote = VAL;
}
process.stdout.write(JSON.stringify(out, null, 1) + "\n");
