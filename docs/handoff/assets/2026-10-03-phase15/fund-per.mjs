#!/usr/bin/env node
// fund-per.mjs — アクティブ投信の「上位10銘柄 加重実績PER」を算出する。
// 入力: data/scheduler/fund-holdings.json（月次レポートの上位10＝code/weight・半手動ingest）。
// 各 code の Yahoo trailingPE を /yahoo プロキシで取得し、組入比率で加重平均。
// 出力: 標準出力に JSON。--write で github/portfolio/data/valuations.json に valuations[fundSymbol] を追加マージ。
// ★ひふみ等のプロキシ指数PERより本体に近い評価（カバー率=上位10の比率合計≒NAVの一部）。
//   2026-06-28 新設（設計: docs/handoff/2026-06-28-active-fund-valuation.md）。
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const HOLD = "data/scheduler/fund-holdings.json";
const VALJSON = "github/portfolio/data/valuations.json";
const PROXY = "https://portfolio-proxy.shoulang.workers.dev/yahoo";
const ORIGIN = "https://shoulang0729.github.io";

function trailingPE(ySymbol) {
  const y = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ySymbol)}?modules=summaryDetail,defaultKeyStatistics`;
  const u = `${PROXY}?url=${encodeURIComponent(y)}`;
  try {
    const raw = execSync(`curl -s -m 25 -H "Origin: ${ORIGIN}" "${u}"`, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    const d = JSON.parse(raw);
    const r = (d?.quoteSummary?.result || [])[0] || {};
    const sd = r.summaryDetail || {}, ks = r.defaultKeyStatistics || {};
    const pick = (o, k) => (o?.[k] && typeof o[k] === "object" ? o[k].raw : o?.[k]);
    const pe = pick(sd, "trailingPE") ?? pick(ks, "trailingPE") ?? null;
    return Number.isFinite(pe) && pe > 0 ? +pe.toFixed(2) : null;
  } catch { return null; }
}

const funds = JSON.parse(readFileSync(HOLD, "utf8"));
const out = { asOf: new Date().toISOString().slice(0, 10), source: "fund-monthly-top10", funds: {} };

for (const f of funds) {
  let wsum = 0, wper = 0;
  const comps = [];
  for (const h of f.top) {
    const per = trailingPE(h.code);
    comps.push({ code: h.code, name: h.name, w: h.weight, per });
    if (per != null) { wsum += h.weight; wper += per * h.weight; }
  }
  const perCurrent = wsum > 0 ? +(wper / wsum).toFixed(2) : null;
  out.funds[f.fundSymbol] = {
    perCurrent,
    coverage: +wsum.toFixed(4),          // 取れた上位銘柄の比率合計（NAV比）
    source: "fund-monthly-top10",
    asOf: f.asOf,                          // 月次レポート基準月
    components: comps,
  };
}

if (process.argv.includes("--write")) {
  const v = existsSync(VALJSON) ? JSON.parse(readFileSync(VALJSON, "utf8")) : { valuations: {} };
  const tbl = v.valuations || v;
  for (const [sym, e] of Object.entries(out.funds)) {
    const prev = tbl[sym] || {};
    tbl[sym] = { ...prev, ...e, status: prev.status || "na" }; // 追加マージ・既存load-bearingは温存
  }
  writeFileSync(VALJSON, JSON.stringify(v, null, 1) + "\n"); // 既存は1スペースindent＝合わせて最小diff
}

process.stdout.write(JSON.stringify(out, null, 2) + "\n");
