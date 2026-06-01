// ══════════════════════════════════════════════════════════════
// risk-charts.js  ―  リスク断面タブの D3 ドーナツ円グラフ描画
//
// computeRiskBreakdown の結果を4枚のドーナツ（アセットクラス / 通貨 /
// 地域・国 / セクター）で可視化する。各グラフに凡例とカバレッジ率を表示。
// ══════════════════════════════════════════════════════════════

import { computeRiskBreakdown, toSlices, RISK_DIMENSIONS, UNKNOWN_KEY, getContributors, getClassificationSummary } from './risk-calc.js';
import { fmtJPYInt, fmtPctInt, escapeHTML } from './utils.js';
import { positions } from './positions.js';
import { MANUAL_ASSETS, MANUAL_SOURCES } from './manual-assets.js';

/** 軸ごとのタイトル */
const TITLES = {
  assetClass: 'アセットクラス',
  currency: '通貨',
  country: '国・地域',
  sector: 'セクター',
};

/** カテゴリキー → 表示ラベル */
const LABELS = {
  assetClass: { equity: '株式', bond: '債券', commodity: 'コモディティ', reit: 'REIT', cash: '現金' },
  currency: { JPY: '円 JPY', USD: 'ドル USD', EUR: 'ユーロ EUR', other: 'その他通貨' },
  country: { japan: '日本', us: '米国', europe: '欧州', em: '新興国', latam: '中南米', china: '中国', global: '分散', commodity: 'コモディティ' },
  sector: {
    tech: 'ソフトウェア/IT', semis: '半導体', financials: '金融', healthcare: 'ヘルスケア',
    consumer: '一般消費財', staples: '生活必需品', industrials: '資本財', energy: 'エネルギー',
    materials: '素材', comm: '通信', utilities: '公益', realestate: '不動産',
    commodity: 'コモディティ', bond: '債券', cash: '現金',
  },
};

/** カテゴリ配色（Claude ウォームトーン基調の categorical パレット） */
const PALETTE = [
  '#cc785c', '#6a8caf', '#c2a36b', '#7fa885', '#a878a8',
  '#d09a4e', '#5f9ea0', '#bd6b6b', '#8a9a5b', '#9d8df1',
  '#d4a0b8', '#7ba6c9',
];
const UNKNOWN_COLOR = '#9ca3af';

/**
 * カテゴリキーの表示ラベルを返す。
 * @param {string} dim
 * @param {string} key
 */
function labelOf(dim, key) {
  if (key === UNKNOWN_KEY) return '不明';
  return LABELS[dim]?.[key] || key;
}

/** symbol → 銘柄名（ツールチップ表示用） */
function nameOfSymbol(sym) {
  const p = positions.find(x => x.symbol === sym);
  return p?.name || sym;
}

/**
 * 1軸ぶんのドーナツ + 凡例 + カバレッジを描画したカード要素を生成する。
 * @param {string} dim
 * @param {import('./risk-calc.js').DimResult} dimResult
 * @returns {HTMLElement}
 */
function buildChartCard(dim, dimResult) {
  const slices = toSlices(dimResult);

  const card = document.createElement('div');
  card.className = 'risk-card';

  const title = document.createElement('div');
  title.className = 'risk-card-title';
  title.textContent = TITLES[dim];
  card.appendChild(title);

  const body = document.createElement('div');
  body.className = 'risk-card-body';
  card.appendChild(body);

  // ── ドーナツ SVG ──
  const size = 168;
  const radius = size / 2;
  const svg = d3.select(body)
    .append('svg')
    .attr('class', 'risk-donut')
    .attr('width', size)
    .attr('height', size)
    .attr('viewBox', `0 0 ${size} ${size}`)
    .attr('role', 'img')
    .attr('aria-label', `${TITLES[dim]}の構成円グラフ`);

  const g = svg.append('g').attr('transform', `translate(${radius},${radius})`);

  const pie = d3.pie().value(d => d.value).sort(null);
  const arc = d3.arc().innerRadius(radius * 0.58).outerRadius(radius - 2);

  // 色割り当て（既知カテゴリはパレット順、__unknown__ はグレー固定）
  const colorOf = (key, i) => (key === UNKNOWN_KEY ? UNKNOWN_COLOR : PALETTE[i % PALETTE.length]);

  // 塗り分け色は固定パレット（テーマ非依存）。境界線(stroke)・中央文字色は
  // テーマ追従させるため CSS 側（var(--surface)/var(--text)）で指定する（ダークモード対応）。
  g.selectAll('path')
    .data(pie(slices))
    .join('path')
    .attr('d', arc)
    .attr('fill', (d, i) => colorOf(d.data.key, i))
    .append('title')
    .text(d => `${labelOf(dim, d.data.key)}: ${fmtJPYInt(d.data.value)}（${fmtPctInt(d.data.pct)}）`);

  // 中央のカバレッジ表示（色は CSS の .risk-donut-center / -sub = var(--text)/--text2）
  const coverage = dimResult.coverage;
  const center = g.append('text').attr('class', 'risk-donut-center');
  center.append('tspan')
    .attr('x', 0).attr('dy', '-0.1em')
    .attr('font-size', '13px').attr('font-weight', '700')
    .attr('text-anchor', 'middle')
    .text(`${Math.round(coverage * 100)}%`);
  center.append('tspan')
    .attr('class', 'risk-donut-center-sub')
    .attr('x', 0).attr('dy', '1.3em')
    .attr('font-size', '9px')
    .attr('text-anchor', 'middle')
    .text('判明');

  // ── 凡例 ──
  const legend = document.createElement('ul');
  legend.className = 'risk-legend';
  slices.forEach((s, i) => {
    const li = document.createElement('li');
    li.className = 'risk-legend-item';

    const sw = document.createElement('span');
    sw.className = 'risk-legend-swatch';
    sw.style.background = colorOf(s.key, i);

    const name = document.createElement('span');
    name.className = 'risk-legend-name';
    name.textContent = labelOf(dim, s.key);

    const pct = document.createElement('span');
    pct.className = 'risk-legend-pct';
    pct.textContent = fmtPctInt(s.pct);

    li.append(sw, name, pct);

    // ホバーで該当カテゴリの寄与銘柄を表示（#212）
    li.addEventListener('mouseenter', (ev) => showLegendTip(ev, dim, s.key, dimResult));
    li.addEventListener('mousemove', moveLegendTip);
    li.addEventListener('mouseleave', hideLegendTip);

    legend.appendChild(li);
  });
  body.appendChild(legend);

  // カバレッジ注記（判明率が 99% 未満のときのみ）
  if (coverage < 0.99) {
    const note = document.createElement('div');
    note.className = 'risk-coverage-note';
    note.textContent = `判明率 ${Math.round(coverage * 100)}%（残りは「不明」）`;
    card.appendChild(note);
  }

  return card;
}

/**
 * リスク断面タブを描画する。panel が hidden のときは何もしない。
 * @returns {void}
 */
export function renderRiskCharts() {
  const panel = document.getElementById('panel-risk');
  if (!panel || panel.hidden) return;
  const wrap = document.getElementById('risk-charts-wrap');
  if (!wrap) return;
  if (typeof d3 === 'undefined') return;

  // 証券（positions）＋手動入力資産（現金など manual-assets.js）を合算して look-through。
  const assets = [...positions, ...MANUAL_ASSETS];
  const breakdown = computeRiskBreakdown(assets);

  wrap.textContent = '';

  // 分類状況サマリーバー（#217）。各セグメントをホバーで内訳（銘柄一覧）表示。
  const sumInfo = getClassificationSummary(assets);
  const summary = document.createElement('div');
  summary.className = 'risk-summary';
  const warn = sumInfo.unclassified > 0 ? ' ⚠' : '';
  const segs = [
    { label: `対象 ${sumInfo.total} 銘柄`, syms: sumInfo.allSymbols },
    { label: `分類済み ${sumInfo.classified}`, syms: sumInfo.classifiedSymbols },
    { label: `分類不明 ${sumInfo.unclassified}${warn}`, syms: sumInfo.unclassifiedSymbols },
  ];
  segs.forEach((seg, i) => {
    if (i) summary.appendChild(document.createTextNode('　┃　'));
    const span = document.createElement('span');
    span.className = 'risk-summary-seg';
    span.textContent = seg.label;
    span.addEventListener('mouseenter', (ev) => showSymbolTip(ev, seg.label, seg.syms));
    span.addEventListener('mousemove', moveLegendTip);
    span.addEventListener('mouseleave', hideLegendTip);
    summary.appendChild(span);
  });
  wrap.appendChild(summary);

  const grid = document.createElement('div');
  grid.className = 'risk-grid';
  for (const dim of RISK_DIMENSIONS) {
    grid.appendChild(buildChartCard(dim, breakdown[dim]));
  }
  wrap.appendChild(grid);

  // データソース明記（#214）＋ 手動入力データの引用元（現金・ひふみ等）
  const src = document.createElement('div');
  src.className = 'risk-source';
  const baseSrc = 'データソース: 価格 = Finnhub / Yahoo Finance ・ アセットクラス/通貨/国/セクター分類 = 銘柄マスタ（positions.js・constituents.js）';
  src.textContent = [baseSrc, ...MANUAL_SOURCES].join(' ／ ');
  wrap.appendChild(src);
}

// ── 凡例ホバー時の構成銘柄ツールチップ（#212）─────────────────────────
function showLegendTip(ev, dim, key, dimResult) {
  const tip = document.getElementById('tooltip');
  if (!tip) return;
  const items = getContributors(dimResult, key).slice(0, 12);
  const rows = items.map(c => `${escapeHTML(c.name)}　${fmtPctInt(c.pct)}`).join('<br>');
  tip.innerHTML = `<div class="tt-hdr">${escapeHTML(labelOf(dim, key))}</div>${rows || '―'}`;
  tip.style.display = 'block';
  moveLegendTip(ev);
}

function moveLegendTip(ev) {
  const tip = document.getElementById('tooltip');
  if (!tip || tip.style.display !== 'block') return;
  // .tooltip は position:fixed のためビューポート座標を使う
  const pad = 14;
  const w = tip.offsetWidth || 240;
  let left = ev.clientX + pad;
  if (left + w > window.innerWidth - 8) left = ev.clientX - w - pad;
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${Math.min(ev.clientY + pad, window.innerHeight - tip.offsetHeight - 8)}px`;
}

function hideLegendTip() {
  const tip = document.getElementById('tooltip');
  if (tip) tip.style.display = 'none';
}

// ── サマリーバーのセグメントホバー時の銘柄内訳ツールチップ（#217）────────
function showSymbolTip(ev, title, symbols) {
  const tip = document.getElementById('tooltip');
  if (!tip) return;
  const rows = (symbols && symbols.length)
    ? symbols.map(s => escapeHTML(nameOfSymbol(s))).join('<br>')
    : '（なし）';
  tip.innerHTML = `<div class="tt-hdr">${escapeHTML(title)}</div>${rows}`;
  tip.style.display = 'block';
  moveLegendTip(ev);
}
