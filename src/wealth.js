// ══════════════════════════════════════════════════════════════
// wealth.js ―― Wealth タブ（資産推移・#568）
// ※ d3（グローバル・CDN読込）を使うため @ts-check 対象外（heatmap/chart/risk-charts と同慣例）
//
// MF 実データ data/mf-history.json（fetch_mf_history.py が日次蓄積）を D3 で可視化する。
// 設計正本: docs/handoff/2026-07-09-asset-history-tab.md ／
// 見た目の正: docs/handoff/assets/2026-07-09-wealth-tab-mock.html。
//   - 期間ピル（3ヶ月〜全期間・既定1年）／表示切替（金額/構成比%）／対数軸（総資産1本ライン）
//   - 目隠し（hm-wealth-eye 永続・金額のみ伏字、比率%は表示）
//   - KPI（資産総額/現金比率/開設来倍率）＋現金比率の推移＋年末サマリ表
//   - total 列は使わず各カテゴリ和で総資産を算出（独立検証を兼ねる）
//   - X 軸はデータ点をそのまま打つ（直近=日次・過去=月末の混在。補間しない）
// ══════════════════════════════════════════════════════════════

import { escapeHTML, maskAmount, cssVar } from './utils.js';

/** カテゴリ定義（表示順・色は仕様書の表に従う。テーマ非依存の系列色） */
const CATS = [
  { key: 'equity', label: '株式(現物)', color: '#cc785c' },
  { key: 'fund', label: '投資信託', color: '#7ba0c4' },
  { key: 'pension', label: '年金', color: '#9c8fbc' },
  { key: 'cash', label: '預金・現金', color: '#6fae86' },
  { key: 'insurance', label: '保険', color: '#d9a441' },
  { key: 'crypto', label: '暗号資産', color: '#c98a5e' },
  { key: 'bond', label: '債券', color: '#b0b0b0' },
  { key: 'fx', label: 'FX', color: '#8c8c8c' },
  { key: 'equityMargin', label: '株式(信用)', color: '#e09070' },
  { key: 'points', label: 'ポイント', color: '#c9c2b8' },
];

/** 期間ピル定義（months=null は全期間） */
const PERIODS = [
  { id: '3m', label: '3ヶ月', months: 3 },
  { id: '6m', label: '6ヶ月', months: 6 },
  { id: '1y', label: '1年', months: 12 },
  { id: '3y', label: '3年', months: 36 },
  { id: '5y', label: '5年', months: 60 },
  { id: '10y', label: '10年', months: 120 },
  { id: 'all', label: '全期間', months: null },
];

/** @type {{series: Array<Record<string, any>>}|null} ロード済みデータ（1回だけ fetch） */
let _data = null;
/** UI 状態（タブ内ローカル） */
let _period = '1y';
let _mode = 'amount'; // 'amount' | 'pct'
let _log = false;
let _eye = false;
try {
  _eye = localStorage.getItem('hm-wealth-eye') === '1';
} catch {}

/** レコードの総資産＝各カテゴリ和（total 列は使わない） */
function totalOf(r) {
  return CATS.reduce((s, c) => s + (Number(r[c.key]) || 0), 0);
}

/** 金額表示。目隠しは Briefing/statsバーと同一の maskAmount（数字のみ*・¥とカンマ保持・設計追記） */
function fmtYen(v) {
  const s = `¥${Math.round(v).toLocaleString('ja-JP')}`;
  return _eye ? maskAmount(s) : s;
}

/** 億表記（5.73億 等・目隠しは maskAmount） */
function fmtOku(v) {
  const s = `${(v / 1e8).toFixed(2)}億`;
  return _eye ? maskAmount(s) : s;
}

/** Y軸の金額目盛（億/万で短縮・目隠しは maskAmount） */
function fmtAxisYen(v) {
  let s;
  if (v >= 1e8) s = `${(v / 1e8).toFixed(v >= 1e9 ? 0 : 1)}億`;
  else if (v >= 1e4) s = `${Math.round(v / 1e4).toLocaleString('ja-JP')}万`;
  else s = String(v);
  return _eye ? maskAmount(s) : s;
}

/** 期間フィルタ（最新日付から月単位で起点を算出） */
function filterByPeriod(series, periodId) {
  const p = PERIODS.find((x) => x.id === periodId);
  if (!p || p.months == null || series.length === 0) return series;
  const last = new Date(series[series.length - 1].date);
  const from = new Date(last);
  from.setMonth(from.getMonth() - p.months);
  return series.filter((r) => new Date(r.date) >= from);
}

/** data/mf-history.json をロード（キャッシュ） */
async function loadHistory() {
  if (_data) return _data;
  const r = await fetch(`data/mf-history.json?_=${Date.now()}`);
  if (!r.ok) throw new Error(`mf-history ${r.status}`);
  const j = await r.json();
  _data = { series: Array.isArray(j.series) ? j.series : [] };
  return _data;
}

/**
 * Wealth タブを描画する（コントロール操作ごとに全再構築＝データ小・シンプル優先）。
 * @returns {Promise<void>}
 */
export async function renderWealthTab() {
  const wrap = document.getElementById('wealth-wrap');
  if (!wrap) return;
  if (typeof d3 === 'undefined') return;

  let series;
  try {
    series = (await loadHistory()).series;
  } catch {
    wrap.innerHTML = '<div class="val-soon">資産推移データ（data/mf-history.json）を取得できませんでした。</div>';
    return;
  }
  if (!series.length) {
    wrap.innerHTML = '<div class="val-soon">資産推移データがまだありません。</div>';
    return;
  }

  const view = filterByPeriod(series, _period);
  const latest = series[series.length - 1];
  const first = series[0];
  const latestTotal = totalOf(latest);
  const firstTotal = totalOf(first);
  const cashRatio = latestTotal > 0 ? ((Number(latest.cash) || 0) / latestTotal) * 100 : 0;
  const multiple = firstTotal > 0 ? latestTotal / firstTotal : null;

  // 表示レンジ内で常に 0 のカテゴリは凡例・チャートから省略（仕様）
  const activeCats = CATS.filter((c) => view.some((r) => (Number(r[c.key]) || 0) > 0));

  // ── KPI（3枚・常に横並び・値は右寄せ・補助は下段 sub2 に分離＝設計追記 2026-07-09） ──
  const multTxt = multiple == null ? '—' : `×${multiple.toFixed(1)}`;
  const okuRange = `${_eye ? maskAmount((firstTotal / 1e8).toFixed(2)) : (firstTotal / 1e8).toFixed(2)}→${fmtOku(latestTotal)}`;
  const kpis = `<div class="we-kpis">
    <div class="we-kpi"><div class="l">資産総額</div><div class="v">${escapeHTML(fmtYen(latestTotal))}</div><div class="sub2">${escapeHTML(latest.date)}</div></div>
    <div class="we-kpi"><div class="l">現金比率</div><div class="v">${cashRatio.toFixed(1)}<small>%</small></div><div class="sub2">&nbsp;</div></div>
    <div class="we-kpi"><div class="l">開設来</div><div class="v">${escapeHTML(_eye ? maskAmount(multTxt) : multTxt)}</div><div class="sub2">${escapeHTML(okuRange)}</div></div>
  </div>`;

  // ── コントロール（期間ピル＋目隠し／表示切替＋対数） ──
  const periodSeg = `<span class="seg we-seg">${PERIODS.map(
    (p) =>
      `<button class="${_period === p.id ? 'on' : ''}" data-period="${p.id}" aria-pressed="${_period === p.id}">${p.label}</button>`
  ).join('')}</span>`;
  const modeSeg = `<span class="seg we-seg">
    <button class="${_mode === 'amount' ? 'on' : ''}" data-mode="amount" aria-pressed="${_mode === 'amount'}">金額</button>
    <button class="${_mode === 'pct' ? 'on' : ''}" data-mode="pct" aria-pressed="${_mode === 'pct'}">構成比%</button>
  </span>`;
  const logChk = `<label class="we-chk"><input type="checkbox" id="we-log" ${_log ? 'checked' : ''}> 対数軸（総資産）</label>`;
  const eyeBtn = `<button class="eye-btn we-eye" id="we-eye" title="金額の表示／マスク" aria-label="金額を表示またはマスク" aria-pressed="${_eye}">
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 1C5 1 1.5 4 1 7c.5 3 3.5 6 8 6s7.5-3 8-6c-.5-3-4-6-8-6z" stroke="currentColor" stroke-width="1.5" fill="none"/>
      <circle cx="9" cy="7" r="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
      <line x1="2" y1="2" x2="16" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="display:${_eye ? '' : 'none'}"/>
    </svg>
  </button>`;
  const legend = `<div class="we-lgs">${activeCats
    .map((c) => `<span class="we-lg"><i style="background:${c.color}"></i>${escapeHTML(c.label)}</span>`)
    .join('')}</div>`;

  // ── DOM 骨格 ──
  wrap.innerHTML = `
    ${kpis}
    <div class="card we-card">
      <div class="we-bar">${periodSeg}${eyeBtn}</div>
      <div class="we-bar">${modeSeg}${logChk}</div>
      ${_log ? '' : legend}
      <div id="we-main-chart"></div>
    </div>
    <div class="card we-card"><h2 class="we-h2">現金比率の推移（%）</h2><div id="we-cash-chart"></div></div>
    <div class="card we-card"><h2 class="we-h2">年末サマリ</h2><div class="we-table-wrap">${yearTableHTML(series)}</div></div>`;

  // ── D3 チャート描画 ──
  drawMainChart(view, activeCats);
  drawCashChart(view);

  // ── イベント（再描画はタブ全再構築） ──
  wrap.querySelectorAll('[data-period]').forEach((b) =>
    b.addEventListener('click', () => {
      _period = /** @type {HTMLElement} */ (b).dataset.period || '1y';
      renderWealthTab();
    })
  );
  wrap.querySelectorAll('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      _mode = /** @type {HTMLElement} */ (b).dataset.mode === 'pct' ? 'pct' : 'amount';
      renderWealthTab();
    })
  );
  const log = wrap.querySelector('#we-log');
  if (log)
    log.addEventListener('change', () => {
      _log = /** @type {HTMLInputElement} */ (log).checked;
      renderWealthTab();
    });
  const eye = wrap.querySelector('#we-eye');
  if (eye)
    eye.addEventListener('click', () => {
      _eye = !_eye;
      try {
        localStorage.setItem('hm-wealth-eye', _eye ? '1' : '0');
      } catch {}
      renderWealthTab();
    });
}

/** 年末サマリ表（年/総資産/現金比率/株式比率）。各年の 12-31 に最も近いレコード・最新年は最終レコード */
function yearTableHTML(series) {
  /** @type {Record<string, any>} 年 → 年末に最も近いレコード */
  const byYear = {};
  for (const r of series) {
    const y = r.date.slice(0, 4);
    const target = new Date(`${y}-12-31`).getTime();
    const cur = byYear[y];
    if (!cur || Math.abs(new Date(r.date).getTime() - target) < Math.abs(new Date(cur.date).getTime() - target)) {
      byYear[y] = r;
    }
  }
  const lastYear = series[series.length - 1].date.slice(0, 4);
  byYear[lastYear] = series[series.length - 1]; // 最新年は最終レコード
  const rows = Object.keys(byYear)
    .sort()
    .map((y) => {
      const r = byYear[y];
      const t = totalOf(r);
      const cashPct = t > 0 ? ((Number(r.cash) || 0) / t) * 100 : 0;
      const eqPct = t > 0 ? ((Number(r.equity) || 0) / t) * 100 : 0;
      return `<tr><td>${escapeHTML(y)}</td><td>${escapeHTML(fmtYen(t))}</td><td>${cashPct.toFixed(1)}%</td><td>${eqPct.toFixed(1)}%</td></tr>`;
    })
    .join('');
  return `<table class="t we-table"><thead><tr><th>年</th><th>総資産</th><th>現金比率</th><th>株式比率</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** チャート共通のサイズ・マージン */
function chartBox(el, height) {
  const width = Math.max(280, el.clientWidth || 320);
  const margin = { top: 8, right: 12, bottom: 22, left: 46 };
  return { width, height, margin, iw: width - margin.left - margin.right, ih: height - margin.top - margin.bottom };
}

/** メインチャート: 積み上げ面（金額/構成比%）／対数 ON は総資産1本ライン */
function drawMainChart(view, activeCats) {
  const el = document.getElementById('we-main-chart');
  if (!el || view.length === 0) return;
  const { width, height, margin, iw, ih } = chartBox(el, 300);
  const svg = d3
    .select(el)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', '100%')
    .attr('role', 'img')
    .attr('aria-label', '資産推移チャート');
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const dates = view.map((r) => new Date(r.date));
  const x = d3
    .scaleTime()
    .domain([dates[0], dates[dates.length - 1]])
    .range([0, iw]);
  const xAxis = d3.axisBottom(x).ticks(Math.min(6, view.length)).tickSizeOuter(0);

  if (_log) {
    // 総資産1本ライン（対数軸）。積み上げ×対数は各カテゴリが読めないため禁止（仕様）
    const totals = view.map((r) => ({ date: new Date(r.date), v: totalOf(r) }));
    const min = d3.min(totals, (d) => d.v) || 1;
    const max = d3.max(totals, (d) => d.v) || 1;
    const y = d3
      .scaleLog()
      .domain([Math.max(1, min * 0.9), max * 1.05])
      .range([ih, 0]);
    g.append('g')
      .attr('class', 'we-grid')
      .call(
        d3
          .axisLeft(y)
          .ticks(5, (d) => fmtAxisYen(d))
          .tickSize(-iw)
      );
    const line = d3
      .line()
      .x((d) => x(d.date))
      .y((d) => y(d.v));
    g.append('path')
      .datum(totals)
      .attr('fill', 'none')
      .attr('stroke', cssVar('--accent'))
      .attr('stroke-width', 2)
      .attr('d', line);
  } else {
    const keys = activeCats.map((c) => c.key);
    const colorOf = Object.fromEntries(activeCats.map((c) => [c.key, c.color]));
    const stack = d3
      .stack()
      .keys(keys)
      .value((r, k) => Number(r[k]) || 0);
    if (_mode === 'pct') stack.offset(d3.stackOffsetExpand);
    const stacked = stack(view);
    const yMax = _mode === 'pct' ? 1 : (d3.max(view, (r) => totalOf(r)) || 1) * 1.05;
    const y = d3.scaleLinear().domain([0, yMax]).range([ih, 0]);
    g.append('g')
      .attr('class', 'we-grid')
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((d) => (_mode === 'pct' ? `${Math.round(Number(d) * 100)}%` : fmtAxisYen(Number(d))))
          .tickSize(-iw)
      );
    const area = d3
      .area()
      .x((d, i) => x(new Date(view[i].date)))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]));
    g.selectAll('path.we-area')
      .data(stacked)
      .join('path')
      .attr('class', 'we-area')
      .attr('fill', (d) => colorOf[d.key])
      .attr('fill-opacity', 0.85)
      .attr('d', area)
      .append('title')
      .text((d) => activeCats.find((c) => c.key === d.key)?.label || d.key);
  }
  g.append('g').attr('class', 'we-axis').attr('transform', `translate(0,${ih})`).call(xAxis);
}

/** 現金比率の推移ライン（%・色 #6fae86） */
function drawCashChart(view) {
  const el = document.getElementById('we-cash-chart');
  if (!el || view.length === 0) return;
  const { width, height, margin, iw, ih } = chartBox(el, 170);
  const svg = d3
    .select(el)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', '100%')
    .attr('role', 'img')
    .attr('aria-label', '現金比率の推移チャート');
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const pts = view.map((r) => {
    const t = totalOf(r);
    return { date: new Date(r.date), v: t > 0 ? ((Number(r.cash) || 0) / t) * 100 : 0 };
  });
  const x = d3
    .scaleTime()
    .domain([pts[0].date, pts[pts.length - 1].date])
    .range([0, iw]);
  const y = d3
    .scaleLinear()
    .domain([0, Math.max(10, (d3.max(pts, (d) => d.v) || 10) * 1.1)])
    .range([ih, 0]);
  g.append('g')
    .attr('class', 'we-grid')
    .call(
      d3
        .axisLeft(y)
        .ticks(5)
        .tickFormat((d) => `${d}%`)
        .tickSize(-iw)
    );
  const area = d3
    .area()
    .x((d) => x(d.date))
    .y0(ih)
    .y1((d) => y(d.v));
  const line = d3
    .line()
    .x((d) => x(d.date))
    .y((d) => y(d.v));
  const cashColor = cssVar('--wealth-cash');
  g.append('path').datum(pts).attr('fill', cashColor).attr('fill-opacity', 0.18).attr('d', area);
  g.append('path').datum(pts).attr('fill', 'none').attr('stroke', cashColor).attr('stroke-width', 2).attr('d', line);
  g.append('g')
    .attr('class', 'we-axis')
    .attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(Math.min(6, pts.length)).tickSizeOuter(0));
}
