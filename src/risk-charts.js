// ══════════════════════════════════════════════════════════════
// risk-charts.js  ―  リスク断面タブの D3 ドーナツ円グラフ描画
//
// computeRiskBreakdown の結果を4枚のドーナツ（アセットクラス / 通貨 /
// 地域・国 / セクター）で可視化する。各グラフに凡例とカバレッジ率を表示。
// ══════════════════════════════════════════════════════════════

import {
  computeRiskBreakdown,
  toSlices,
  RISK_DIMENSIONS,
  UNKNOWN_KEY,
  getContributors,
  getClassificationSummary,
  getSourceSummary,
  annualizedVol,
  maxDrawdown,
  betaTo,
  alignReturnsByDate,
  highCorrelationPairs,
  computePortfolioReturns,
  eventStress,
} from './risk-calc.js';
import { getAllHistorical } from './historical-cache.js';
import { fetchSymbolHistory, batchWithRetry } from './data.js';
import { state } from './state.js';
import { computeLiquidity, ILLIQUID_DAYS } from './liquidity-calc.js';
import { fmtJPYInt, fmtPctInt, escapeHTML } from './utils.js';
import { glossaryHTML } from './glossary.js';
import { positions } from './positions.js';
import { MANUAL_ASSETS, MANUAL_SOURCES } from './manual-assets.js';
import { getMfManualAssets, getMfSources, getMfTotals } from './networth.js';
import {
  loadTargetAllocation,
  getTargetPct,
  getThemeOf,
  getThemeCap,
  computeThemeUsage,
  computeGap,
  themeLabel,
} from './target-allocation.js';
import { computeTrueRegionExposure, japanHomeBias, REGION_LABELS } from './region-calc.js';

/** D-6: region-map / region-weights のロードキャッシュ */
let _regionData = null;
async function loadRegionData() {
  if (_regionData) return _regionData;
  try {
    const [mapRes, wRes] = await Promise.all([
      fetch(`data/region-map.json?_=${Date.now()}`),
      fetch(`data/region-weights.json?_=${Date.now()}`),
    ]);
    const mapJson = mapRes.ok ? await mapRes.json() : null;
    const wJson = wRes.ok ? await wRes.json() : null;
    _regionData = {
      regionMap: (mapJson && mapJson.regions) || {},
      regionWeights: wJson || { lookThrough: {}, weights: {} },
      asOf: (wJson && wJson.asOf) || null,
    };
  } catch {
    _regionData = { regionMap: {}, regionWeights: { lookThrough: {}, weights: {} }, asOf: null };
  }
  return _regionData;
}

/**
 * D-6: 真の地域エクスポージャ（ルックスルー）カードを生成する。
 * 筆頭＝日本 真% ｜ ACWIベンチ5% ｜ ホームバイアス +Xpt。
 * @param {Array<{symbol?:string, ySymbol?:string, value?:number|null}>} holdings
 * @returns {Promise<{card: HTMLElement, japanTruePct: number}>} #545: 真の日本国比率を要約へクロス参照
 */
async function buildRegionCard(assets, manualSymbols) {
  const { regionMap, regionWeights, asOf } = await loadRegionData();
  // 全資産カバレッジ: 現金/暗号（非証券＝manualSymbols）は commodity_cash 固定に寄せる。
  // region-calc の地域分類ロジックは保持し、表示層側で分類用 map を拡張するのみ。
  const augMap = { ...(regionMap || {}) };
  for (const s of manualSymbols || []) augMap[s] = 'commodity_cash';
  const { pct } = computeTrueRegionExposure(assets, augMap, regionWeights);
  const bias = japanHomeBias(pct);
  const unknownPct = typeof pct.unknown === 'number' && isFinite(pct.unknown) ? pct.unknown : 0;
  const coveragePct = Math.max(0, Math.min(100, 100 - unknownPct));

  const card = document.createElement('div');
  card.className = 'risk-card region-card';

  // ── タイトル「地域」＋ルックスルー・ドーナツ＋凡例（#509 で復活）──
  // #502 で誤って構成バーに置換したドーナツを #451 の機構で復活。日本スライスはアクセント色で強調。
  // マザーマーケット（日本）偏りはドーナツの下（順序: タイトル→円グラフ→偏りバナー→注記）。算出は不変＝表示のみ。
  card.insertAdjacentHTML('beforeend', cardTitle('i-globe', '地域', 'ルックスルー・全資産'));

  const slices = Object.entries(pct)
    .filter(([, p]) => typeof p === 'number' && p > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, p]) => ({ key, pct: p }));

  const body = document.createElement('div');
  body.className = 'risk-card-body';
  card.appendChild(body);

  const size = 168;
  const radius = size / 2;
  const svg = d3
    .select(body)
    .append('svg')
    .attr('class', 'risk-donut')
    .attr('width', size)
    .attr('height', size)
    .attr('viewBox', `0 0 ${size} ${size}`)
    .attr('role', 'img')
    .attr('aria-label', '地域（ルックスルー）の構成円グラフ');
  const g = svg.append('g').attr('transform', `translate(${radius},${radius})`);
  const pie = d3
    .pie()
    .value((d) => d.pct)
    .sort(null);
  const arc = d3
    .arc()
    .innerRadius(radius * 0.58)
    .outerRadius(radius - 2);
  // 日本スライスはアクセント色（CSS の .is-jp で fill:var(--accent)）、他は固定パレット。
  g.selectAll('path')
    .data(pie(slices))
    .join('path')
    .attr('d', arc)
    .attr('class', (d) => (d.data.key === 'japan' ? 'is-jp' : null))
    .attr('fill', (d, i) => PALETTE[i % PALETTE.length])
    .append('title')
    .text((d) => `${REGION_LABELS[d.data.key] || d.data.key}: ${fmtPctInt(d.data.pct)}`);
  const center = g.append('text').attr('class', 'risk-donut-center');
  center
    .append('tspan')
    .attr('x', 0)
    .attr('dy', '-0.1em')
    .attr('font-size', '13px')
    .attr('font-weight', '700')
    .attr('text-anchor', 'middle')
    .text(`${coveragePct.toFixed(0)}%`);
  center
    .append('tspan')
    .attr('class', 'risk-donut-center-sub')
    .attr('x', 0)
    .attr('dy', '1.3em')
    .attr('font-size', '9px')
    .attr('text-anchor', 'middle')
    .text('カバレッジ');

  const legend = document.createElement('ul');
  legend.className = 'risk-legend';
  slices.forEach((s, i) => {
    const li = document.createElement('li');
    li.className = 'risk-legend-item';
    const sw = document.createElement('span');
    sw.className = 'risk-legend-swatch';
    if (s.key === 'japan') sw.classList.add('is-jp');
    else sw.style.background = PALETTE[i % PALETTE.length];
    const name = document.createElement('span');
    name.className = 'risk-legend-name';
    name.textContent = REGION_LABELS[s.key] || s.key;
    const p = document.createElement('span');
    p.className = 'risk-legend-pct';
    p.textContent = fmtPctInt(s.pct);
    li.append(sw, name, p);
    legend.appendChild(li);
  });
  body.appendChild(legend);

  // マザーマーケット（日本）偏り＝円グラフの下（japanHomeBias 流用・新規計算なし・ACWI は参考値）
  // #545: ホームバイアスは lenient。総資産の35%までは許容（情報）、超で「要注意（黄）」へ格上げ。
  // 日本の大きさ単独では赤にしない（設計思想＝マザーマーケット偏り許容）。分母＝総資産ベース（表示主数値と同物差し）。
  const HOME_JP_LIMIT = 35; // 日本ホーム許容の警告閾値（%・ルックスルー後・総資産ベース）
  const homeWarn = bias.japanPct > HOME_JP_LIMIT;
  const ratio = bias.benchPct > 0 ? bias.japanPct / bias.benchPct : null;
  const biasSign = bias.biasPt >= 0 ? '+' : '';
  const ratioTxt = ratio != null ? `（約${ratio.toFixed(ratio >= 10 ? 0 : 1)}倍）` : '';
  const tiltTxt = bias.biasPt >= 0 ? '世界平均より日本に厚い。' : '世界平均より日本は控えめ。';
  const homeBandTxt = homeWarn
    ? `目安${HOME_JP_LIMIT}%超＝要注意（黄）。ホームマーケットにつき高め許容だが、この水準は要確認。`
    : `ホームマーケットにつき〜${HOME_JP_LIMIT}%目安まで許容（情報）。`;
  card.insertAdjacentHTML(
    'beforeend',
    `<div class="rgn-bias${homeWarn ? ' warn' : ''}"><div class="rgn-bias-ic">${ric('i-home')}</div><div class="rgn-bias-body">` +
      `<div class="rgn-bias-h"><span>マザーマーケット（日本）への偏り${homeWarn ? ' ⚠要注意' : '（許容内）'}</span><span class="rgn-bias-v${homeWarn ? ' warn' : ''}">日本 ${bias.japanPct.toFixed(1)}%</span></div>` +
      `<div class="rgn-bias-cap">世界株指数(ACWI)の日本比率${bias.benchPct.toFixed(0)}%に対し ${biasSign}${bias.biasPt.toFixed(1)}pt${ratioTxt}。${tiltTxt}${homeBandTxt}</div>` +
      `</div></div>`
  );

  const note = document.createElement('div');
  note.className = 'risk-coverage-note';
  note.textContent = `ACWI ${bias.benchPct.toFixed(0)}%は世界平均の参考値で、合わせる必要はなく日本への傾きの目安。地域構成比は静的（鮮度 ${asOf || '—'}・四半期更新）。`;
  card.appendChild(note);

  // #545: 真の日本国比率（ルックスルー後・総資産ベース）をリスク要約へクロス参照させる。
  return { card, japanTruePct: bias.japanPct };
}

// ── D-1 ストレスシナリオ（名前付き歴史イベント）──────────────────────────────
/** stress-events.json のロードキャッシュ */
let _stressEvents = null;
async function loadStressEvents() {
  if (_stressEvents) return _stressEvents;
  try {
    const r = await fetch(`data/stress-events.json?_=${Date.now()}`);
    const j = r.ok ? await r.json() : null;
    _stressEvents = j && Array.isArray(j.events) ? j.events : [];
  } catch {
    _stressEvents = [];
  }
  return _stressEvents;
}

/**
 * ストレス計算用に保有銘柄の 5y 履歴を確保する（lazy・IDB のみ・sessionStorage 不使用）。
 * 既存 IDB をメモリに反映 → 未取得のみ fetchSymbolHistory('5y') で取得。
 * @param {string[]} symbols  ySymbol 配列
 * @returns {Promise<Record<string, Array<{date: Date, close: number}>>>}
 */
async function ensureStressHistory(symbols) {
  // 1. IDB 既存の 5y をメモリに反映（fetchSymbolHistory の skip 判定に使う）
  let cached = {};
  try {
    cached = await getAllHistorical('5y');
  } catch {
    cached = {};
  }
  if (!state.historicalCache['5y']) state.historicalCache['5y'] = {};
  for (const [sym, entries] of Object.entries(cached)) state.historicalCache['5y'][sym] = entries;

  // 2. 未取得銘柄のみ lazy fetch（5y は saveCacheToSession でスキップ＝IDB のみ永続）
  const missing = symbols.filter(
    (s) => !Array.isArray(state.historicalCache['5y'][s]) || state.historicalCache['5y'][s].length < 2
  );
  if (missing.length) {
    await batchWithRetry(missing, (s) => fetchSymbolHistory(s, '5y'), { batchSize: 6, delayMs: 1100 });
  }
  return state.historicalCache['5y'] || {};
}

// buildStressCard は ②クオンツ・リスク（_appendEventStress）へ統合・廃止（#488）。
// loadStressEvents / ensureStressHistory / eventStress は②から流用するため存続。

/** 軸ごとのタイトル */
const TITLES = {
  assetClass: 'アセットクラス',
  currency: '通貨',
  country: '国・地域',
  sector: 'セクター',
};

/** 軸ごとの見出しアイコン（自前 SVG スプライト・#509 B） */
const DIM_ICONS = {
  assetClass: 'i-assetclass',
  currency: 'i-currency',
  country: 'i-globe',
  sector: 'i-sector',
};

/** カテゴリキー → 表示ラベル */
const LABELS = {
  assetClass: {
    equity: '株式',
    bond: '債券',
    commodity: 'コモディティ',
    reit: 'REIT',
    cash: '現金',
    crypto: '暗号資産',
  },
  currency: { JPY: '円 JPY', USD: 'ドル USD', EUR: 'ユーロ EUR', other: 'その他通貨' },
  country: {
    japan: '日本',
    us: '米国',
    europe: '欧州',
    em: '新興国',
    latam: '中南米',
    china: '中国',
    global: '分散',
    commodity: 'コモディティ',
  },
  sector: {
    tech: 'ソフトウェア/IT',
    semis: '半導体',
    financials: '金融',
    healthcare: 'ヘルスケア',
    consumer: '一般消費財',
    staples: '生活必需品',
    industrials: '資本財',
    energy: 'エネルギー',
    materials: '素材',
    comm: '通信',
    utilities: '公益',
    realestate: '不動産',
    commodity: 'コモディティ',
    bond: '債券',
    cash: '現金',
    crypto: '暗号資産',
  },
};

/** カテゴリ配色（Claude ウォームトーン基調の categorical パレット） */
const PALETTE = [
  '#cc785c',
  '#6a8caf',
  '#c2a36b',
  '#7fa885',
  '#a878a8',
  '#d09a4e',
  '#5f9ea0',
  '#bd6b6b',
  '#8a9a5b',
  '#9d8df1',
  '#d4a0b8',
  '#7ba6c9',
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

/** symbol/ySymbol → 銘柄名（生ティッカーの代わりに表示） */
function nameOfSymbol(sym) {
  const p = positions.find((x) => x.symbol === sym || x.ySymbol === sym);
  return p?.name || sym;
}

/** 鮮度警告のしきい値（日）。oldestAsOf がこれより古いと注意表示（#208） */
const STALE_WARN_DAYS = 14;

/** ISO 日付を YYYY-MM-DD に整形（無効なら空） */
function fmtAsOf(asOf) {
  if (!asOf) return '';
  const t = Date.parse(asOf);
  if (Number.isNaN(t)) return '';
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * 軸のソース構成バッジ（live/curated/推定 の value 加重% + asOf + 鮮度警告）を生成。
 * 全量 curated/推定 で live が無い場合も、内訳を簡潔に示す。
 * @param {import('./risk-calc.js').DimSource} dimSource
 * @returns {HTMLElement}
 */
function buildSourceBadge(dimSource) {
  const badge = document.createElement('div');
  badge.className = 'risk-source-badge';

  const pct = (x) => Math.round(x * 100);
  /** @type {Array<[string,string,number]>} */
  const parts = [
    ['live', 'ライブ', dimSource.live],
    ['curated', '登録', dimSource.curated],
    ['est', '推定', dimSource.estimated],
  ];
  for (const [cls, label, frac] of parts) {
    if (frac < 0.005) continue; // 0% は省略
    const pill = document.createElement('span');
    pill.className = `risk-src-pill risk-src-${cls}`;
    pill.textContent = `${label} ${pct(frac)}%`;
    badge.appendChild(pill);
  }

  // live がある場合は最古 asOf を表示し、古ければ警告
  const asOfStr = fmtAsOf(dimSource.oldestAsOf);
  if (asOfStr) {
    const stale = Date.now() - Date.parse(dimSource.oldestAsOf) > STALE_WARN_DAYS * 86400000;
    const meta = document.createElement('span');
    meta.className = `risk-src-asof${stale ? ' risk-src-stale' : ''}`;
    meta.textContent = stale ? `⚠ ${asOfStr} 更新（古い）` : `${asOfStr} 更新`;
    if (stale) meta.title = `ライブデータが ${STALE_WARN_DAYS} 日以上更新されていません`;
    badge.appendChild(meta);
  }
  return badge;
}

/**
 * 1軸ぶんのドーナツ + 凡例 + カバレッジを描画したカード要素を生成する。
 * @param {string} dim
 * @param {import('./risk-calc.js').DimResult} dimResult
 * @param {import('./risk-calc.js').DimSource} [dimSource]
 * @returns {HTMLElement}
 */
function buildChartCard(dim, dimResult, dimSource) {
  const slices = toSlices(dimResult);

  const card = document.createElement('div');
  card.className = 'risk-card';

  // 見出しを共通 .card-ttl（アイコン箱）へ統一（#515 P2）。
  card.insertAdjacentHTML('beforeend', cardTitle(DIM_ICONS[dim] || 'i-layers', TITLES[dim]));

  // ソース構成バッジ（ライブ/登録/推定 + asOf + 鮮度警告・#208）
  if (dimSource) card.appendChild(buildSourceBadge(dimSource));

  const body = document.createElement('div');
  body.className = 'risk-card-body';
  card.appendChild(body);

  // ── ドーナツ SVG ──
  const size = 168;
  const radius = size / 2;
  const svg = d3
    .select(body)
    .append('svg')
    .attr('class', 'risk-donut')
    .attr('width', size)
    .attr('height', size)
    .attr('viewBox', `0 0 ${size} ${size}`)
    .attr('role', 'img')
    .attr('aria-label', `${TITLES[dim]}の構成円グラフ`);

  const g = svg.append('g').attr('transform', `translate(${radius},${radius})`);

  const pie = d3
    .pie()
    .value((d) => d.value)
    .sort(null);
  const arc = d3
    .arc()
    .innerRadius(radius * 0.58)
    .outerRadius(radius - 2);

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
    .text((d) => `${labelOf(dim, d.data.key)}: ${fmtJPYInt(d.data.value)}（${fmtPctInt(d.data.pct)}）`);

  // 中央のカバレッジ表示（色は CSS の .risk-donut-center / -sub = var(--text)/--text2）
  const coverage = dimResult.coverage;
  const center = g.append('text').attr('class', 'risk-donut-center');
  center
    .append('tspan')
    .attr('x', 0)
    .attr('dy', '-0.1em')
    .attr('font-size', '13px')
    .attr('font-weight', '700')
    .attr('text-anchor', 'middle')
    .text(`${Math.round(coverage * 100)}%`);
  center
    .append('tspan')
    .attr('class', 'risk-donut-center-sub')
    .attr('x', 0)
    .attr('dy', '1.3em')
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

// ── リスク要約カード（Phase 4 v1: 集中度・サイズリスク）────────────────────

/**
 * 全 positions の tkey を解決して { tkey, currentPct } を返す内部ヘルパー。
 * @param {number} denom 分母（総評価額 JPY）
 * @returns {Array<{p: any, tkey: string|null, currentPct: number}>}
 */
function _resolvePositionTkeys(denom) {
  return positions.map((p) => {
    const currentPct = ((p.value || 0) / denom) * 100;
    let tkey = null;
    for (const candidate of [p.ySymbol, p.symbol, p.name]) {
      if (!candidate) continue;
      if (getTargetPct(candidate) != null || getThemeOf(candidate) != null) {
        tkey = candidate;
        break;
      }
    }
    return { p, tkey, currentPct };
  });
}

/** 自前アイコン参照（絵文字廃止・#488）。`<svg class="ric"><use href="#i-…"/>` 文字列を返す。 */
function ric(id, sm) {
  return `<svg class="ric${sm ? ' ric-sm' : ''}" aria-hidden="true"><use href="#${id}"/></svg>`;
}

/**
 * 共通カード見出し（#515 P2・全タブ統一）。アイコン箱(.tic)＋名前＋右に任意タグ。
 * @param {string} iconId  スプライト id（i-shield 等）
 * @param {string} name    見出し文字列
 * @param {string} [tag]   右端タグ（任意）
 * @returns {string}
 */
function cardTitle(iconId, name, tag) {
  const tagHTML = tag ? `<span class="tag">${escapeHTML(tag)}</span>` : '';
  return `<div class="card-ttl"><span class="tic">${ric(iconId)}</span>${escapeHTML(name)}${tagHTML}</div>`;
}

/**
 * リスク要約カード（信号機・銘柄名つき・#488）を生成する。
 * 総合判定バナー＋4行（アイコン/ラベル/状態ピル/値/該当銘柄/一言）。
 * @returns {HTMLElement}
 */
function buildRiskOverviewCard(japanTruePct) {
  const card = document.createElement('div');
  card.className = 'risk-overview';

  const totals = getMfTotals();
  const denom = (totals && totals.imported) || positions.reduce((s, p) => s + (p.value || 0), 0);
  const taAvailable = denom > 0;
  let breaches = 0;

  // 1. キャッシュ比率（5–20% 適正）
  let cashVal = '—';
  let cashOut = false;
  if (totals) {
    const cr = totals.cashRatio;
    cashOut = cr < 5 || cr > 20;
    cashVal = `${cr.toFixed(1)}%`;
    if (cashOut) breaches++;
  }

  const resolved = taAvailable ? _resolvePositionTkeys(denom) : [];

  // 2. 最大集中（テーマ／単銘柄）＋構成銘柄
  /** @type {Record<string, number>} */
  const themeUsedPct = {};
  /** @type {Record<string, Array<{name:string, pct:number}>>} */
  const themeMembers = {};
  for (const { p, tkey, currentPct } of resolved) {
    if (!tkey) continue;
    const theme = getThemeOf(tkey);
    if (!theme) continue;
    themeUsedPct[theme] = (themeUsedPct[theme] || 0) + currentPct;
    // 構成銘柄はティッカー表示（#502 B）
    (themeMembers[theme] = themeMembers[theme] || []).push({ name: p.symbol || '', pct: currentPct });
  }
  /** @type {string|null} */
  let maxLabel = null;
  /** @type {string|null} */
  let maxTheme = null; // #544: cap 判定用の生テーマキー
  let maxPct = 0;
  /** @type {Array<{name:string, pct:number}>} */
  let maxMembers = [];
  for (const [theme, used] of Object.entries(themeUsedPct)) {
    if (used > maxPct) {
      maxPct = used;
      maxTheme = theme;
      maxLabel = themeLabel(theme); // 自然言語化（#502 B）
      maxMembers = (themeMembers[theme] || []).slice().sort((a, b) => b.pct - a.pct);
    }
  }
  // 単銘柄が最大ならティッカーで
  if (taAvailable) {
    for (const p of positions) {
      const pct = ((p.value || 0) / denom) * 100;
      if (pct > maxPct) {
        maxPct = pct;
        maxTheme = null; // 単銘柄はテーマ cap 対象外 → 従来閾値へフォールバック
        maxLabel = p.symbol || '';
        maxMembers = [{ name: p.symbol || '', pct }];
      }
    }
  }
  // #544: 最大集中の判定を一律20%からテーマ別キャップ基準へ統一。
  // cap 未設定テーマ／単銘柄のみ従来閾値（20%）へフォールバック。breach 加算は overThemes 計算後（二重カウント回避）。
  const maxCap = maxTheme ? getThemeCap(maxTheme) : null;
  const concOver = taAvailable && (maxCap != null ? maxPct > maxCap : maxPct > 20);

  // 3. 過大ポジ（gapPct = current − target が 0.5pt 超）
  /** @type {Array<{name:string, cur:number, target:number|null, pt:number}>} */
  const overPos = [];
  for (const { p, tkey, currentPct } of resolved) {
    if (!tkey) continue;
    const gap = computeGap(tkey, currentPct);
    if (gap.gapPct != null && gap.gapPct > 0.5) {
      overPos.push({ name: p.symbol || '', cur: currentPct, target: gap.targetPct, pt: gap.gapPct });
    }
  }
  overPos.sort((a, b) => b.pt - a.pt);
  if (overPos.length > 0) breaches++;

  // 4. テーマ上限超過
  /** @type {Record<string, number>} */
  const curPctBySym = {};
  for (const p of positions) {
    const pct = taAvailable ? ((p.value || 0) / denom) * 100 : 0;
    if (p.ySymbol) curPctBySym[p.ySymbol] = (curPctBySym[p.ySymbol] || 0) + pct;
    if (p.symbol && p.symbol !== p.ySymbol) curPctBySym[p.symbol] = (curPctBySym[p.symbol] || 0) + pct;
  }
  /** @type {Set<string>} */
  const themesSet = new Set();
  for (const { tkey } of resolved) {
    if (tkey) {
      const th = getThemeOf(tkey);
      if (th) themesSet.add(th);
    }
  }
  /** @type {Array<{theme:string, used:number, cap:number}>} */
  const overThemes = [];
  if (taAvailable) {
    for (const theme of themesSet) {
      const cap = getThemeCap(theme);
      if (cap == null) continue;
      const usage = computeThemeUsage(theme, curPctBySym);
      if (usage.used > cap) overThemes.push({ theme, used: usage.used, cap });
    }
  }
  if (overThemes.length > 0) breaches++;

  // #544: 最大集中の breach は、テーマ cap 超過（overThemes）と二重カウントしない。
  // cap 未設定テーマ／単銘柄の閾値超過のみ、最大集中として独立に breach 加算する。
  if (concOver && !(maxTheme && overThemes.some((o) => o.theme === maxTheme))) breaches++;

  // ── 総合判定バナー（緑/黄/赤） ──
  const vCls = breaches === 0 ? 'ok' : breaches === 1 ? 'warn' : 'bad';
  const vt =
    breaches === 0
      ? 'リスク低 — 閾値抵触なし'
      : breaches === 1
        ? '注意 — 1件が基準オーバー'
        : `要注意 — ${breaches}件が基準オーバー`;
  const subBits = [];
  if (cashOut) subBits.push('キャッシュ比率が範囲外');
  if (concOver) subBits.push('集中が高い');
  if (overPos.length) subBits.push(`過大ポジ${overPos.length}件`);
  if (overThemes.length) subBits.push('テーマ上限超過');
  const vs = subBits.length
    ? `${subBits.join('・')}。値動きは下のクオンツへ。`
    : '集中・過大ポジ・キャッシュ・テーマ上限すべて適正圏。値動きは下のクオンツへ。';

  // ── 統一 stat-block（#564・モック 2026-07-08-risk-summary-unified-mock.html 準拠）──
  // 全セクション同型: ヘッダー（アイコン箱＋タイトル＋右pill）＋ body。
  // 少数×文脈あり（現金/テーマ集中/国ホーム）＝大きな stat row（対象名→大%→上限/許容）。
  // 多数×単純（過大ポジ）＝コンパクト1行×N（最大ズレのみ強調）。
  // 判定テキスト（⚠超過・トリム候補 等）は出さない＝pill＋色＋"%>上限%"で伝える。
  // 表示のみの再構成＝集計/判定ロジック（breaches・cap・region）は不変。
  const sec = (icon, title, pillCls, pillTxt, bodyHTML) => `
    <div class="rms-sec">
      <div class="rms-hd"><div class="rmic">${ric(icon)}</div><span class="rms-ttl">${escapeHTML(title)}</span><span class="rpill ${pillCls}">${escapeHTML(pillTxt)}</span></div>
      ${bodyHTML}
    </div>`;
  // 行＝左:対象名／右:値（補助テキスト＋大きな数字）の2カラム。大きな数字は min-width＋右揃えで
  // 全カード右端の同じ縦ラインに揃える（#566・右揃えモック準拠）。
  const entry = (ent, tone, bigTxt, subTxt, chipsHTML) => `
    <div class="rms-row">
      <div class="rms-line"><div class="rms-ent">${escapeHTML(ent)}</div><div class="rms-val">${subTxt ? `<span class="rms-sub">${escapeHTML(subTxt)}</span>` : ''}<span class="rms-big ${tone}">${escapeHTML(bigTxt)}</span></div></div>
      ${chipsHTML ? `<div class="rholds">${chipsHTML}</div>` : ''}
    </div>`;

  // ① 投資用キャッシュ比率
  const cashSec = sec(
    'i-coin',
    '投資用キャッシュ比率',
    cashOut ? 'warn' : 'ok',
    cashOut ? '範囲外' : '適正',
    entry('投資資産に対する現金', cashOut ? 'warn' : 'ok', cashVal, '適正レンジ 5–20%', '')
  );

  // ② 過大ポジ（コンパクト1行×N・最大ズレ=先頭のみ強調）
  const overBody = overPos.length
    ? `<div class="rms-minis">${overPos
        .map(
          (o, i) =>
            `<div class="rms-mini${i === 0 ? ' top' : ''}"><span class="lft"><b>${escapeHTML(o.name)}</b>目標${o.target != null ? o.target.toFixed(0) : '—'}% → 現${o.cur.toFixed(1)}%</span><span class="pt">+${o.pt.toFixed(1)}pt</span></div>`
        )
        .join('')}</div>`
    : `<div class="rms-row"><div class="rms-ent">目標配分を上回る保有はなし</div></div>`;
  const overSec = sec(
    'i-expand',
    '過大ポジ',
    overPos.length ? 'warn' : 'ok',
    overPos.length ? `注意 ${overPos.length}件` : 'なし',
    overBody
  );

  // ③ テーマ集中（テーマ上限超過を統合＝cap 超過テーマを全列挙。二重表示解消・#564）
  const themeChips = (theme) =>
    (themeMembers[theme] || [])
      .slice()
      .sort((a, b) => b.pct - a.pct)
      .map((m) => `<span class="htag">${escapeHTML(m.name)} <b>${m.pct.toFixed(1)}%</b></span>`)
      .join('');
  let concBody;
  let concPillCls;
  let concPillTxt;
  if (overThemes.length) {
    const sorted = overThemes.slice().sort((a, b) => b.used - a.used);
    concBody = sorted
      .map((o) => entry(themeLabel(o.theme), 'bad', `${o.used.toFixed(1)}%`, `上限 ${o.cap}%`, themeChips(o.theme)))
      .join('');
    concPillCls = 'bad';
    concPillTxt = `超過 ${overThemes.length}件`;
  } else if (taAvailable && maxLabel) {
    // 超過ゼロの日＝最大テーマ1行＋pill 適正
    const concHolds = maxMembers.length
      ? maxMembers.map((m) => `<span class="htag">${escapeHTML(m.name)} <b>${m.pct.toFixed(1)}%</b></span>`).join('')
      : '';
    concBody = entry(
      maxLabel,
      concOver ? 'bad' : 'ok',
      `${maxPct.toFixed(1)}%`,
      maxCap != null ? `上限 ${maxCap}%` : '目安 20%',
      concHolds
    );
    concPillCls = concOver ? 'bad' : 'ok';
    concPillTxt = concOver ? '超過' : '適正';
  } else {
    concBody = entry('—', 'ok', '—', '', '');
    concPillCls = 'ok';
    concPillTxt = '—';
  }
  const concSec = sec('i-target', 'テーマ集中', concPillCls, concPillTxt, concBody);

  // ④ 国・ホーム偏り（日本のみ＝自国オーバーウェイトだけが偏りリスク。全景は下段の地域ドーナツ担当）
  const HOME_JP_LIMIT = 35;
  const homeWarn = japanTruePct != null && isFinite(japanTruePct) && japanTruePct > HOME_JP_LIMIT;
  const homeSec =
    japanTruePct != null && isFinite(japanTruePct)
      ? sec(
          'i-home',
          '国・ホーム偏り',
          homeWarn ? 'warn' : 'ok',
          homeWarn ? '要注意' : '許容内',
          entry(
            '日本（投信ルックスルー）',
            homeWarn ? 'warn' : 'ok',
            `${japanTruePct.toFixed(1)}%`,
            `許容 ${HOME_JP_LIMIT}%`,
            ''
          )
        )
      : '';

  // 順序（確定・#564）: 現金 → 過大ポジ → テーマ集中 → 国・ホーム偏り
  card.innerHTML = `
    ${cardTitle('i-shield', 'リスク要約', '致命傷を避けられているか')}
    <div class="rv ${vCls}">
      <div class="rv-badge">${ric(breaches === 0 ? 'i-shield' : 'i-warn')}</div>
      <div><div class="rv-t">${escapeHTML(vt)}</div><div class="rv-s">${escapeHTML(vs)}</div></div>
    </div>
    ${cashSec}${overSec}${concSec}${homeSec}`;

  return card;
}

// ── Phase 4b: クオンツ・リスクカード ────────────────────────────────────────

/**
 * 数値を百分率文字列に整形（小数1桁、符号付き）。
 * @param {number|null} v
 * @param {boolean} [forcePlus]
 * @returns {string}
 */
function _pct1(v, forcePlus = false) {
  if (v === null || !Number.isFinite(v)) return '—';
  const s = `${(v * 100).toFixed(1)}%`;
  return forcePlus && v > 0 ? `+${s}` : s;
}

/** rq-note 段落を返す（履歴未取得等の案内）。 */
function _rqNote(msg) {
  const p = document.createElement('p');
  p.className = 'rq-note';
  p.textContent = msg;
  return p;
}

/**
 * イベント名から西暦4桁を除去（日付は別表示するため重複を消す・#502 C）。
 * stress-events.json の label は変えず表示時のみ。例「関税ショック 2025」→「関税ショック」。
 * @param {string} label
 * @returns {string}
 */
function stripEventYear(label) {
  return (label || '')
    .replace(/\b(?:19|20)\d{2}\b/g, '') // 西暦4桁を除去
    .replace(/[（(]\s*[）)]/g, '') // 年除去で空になった括弧を削除（中身ある括弧は温存）
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * イベント日付を「YYYY年M月／YYYY年M〜M月／YYYY年M月〜YYYY年M月」表記にする（#488 §2-2）。
 * @param {string} from YYYY-MM-DD
 * @param {string} to   YYYY-MM-DD
 * @returns {string}
 */
function fmtEventPeriod(from, to) {
  const f = new Date(from);
  const t = new Date(to);
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return '';
  const fy = f.getFullYear();
  const ty = t.getFullYear();
  const fm = f.getMonth() + 1;
  const tm = t.getMonth() + 1;
  if (fy === ty && fm === tm) return `${fy}年${fm}月`;
  if (fy === ty) return `${fy}年${fm}〜${tm}月`;
  return `${fy}年${fm}月〜${ty}年${tm}月`;
}

/**
 * §2-1 イベント別「下落の深さ」を card に追記する（5y 履歴 × eventStress・深い順）。
 * 別カード buildStressCard を②へ統合したもの。
 * @param {HTMLElement} card
 * @param {Array<{ySymbol?:string, value?:number}>} holdings
 * @returns {Promise<void>}
 */
async function _appendEventStress(card, holdings) {
  // 「これは何？」の1行のみ（物語/読み筋キャプションは廃止・#502 C）
  const lead = document.createElement('p');
  lead.className = 'q-lead';
  lead.textContent = '現PFのウェイトで過去の暴落を再現し、その期間の下落率を出したもの（下落の大きい順）。';
  card.appendChild(lead);

  const events = await loadStressEvents();
  if (events.length === 0) {
    card.appendChild(_rqNote('イベントカタログ未取得。'));
    return;
  }
  /** @type {Record<string, number>} */
  const weights = {};
  for (const p of holdings) {
    if (p.ySymbol) weights[p.ySymbol] = (weights[p.ySymbol] || 0) + (p.value || 0);
  }
  let seriesMap;
  try {
    seriesMap = await ensureStressHistory(Object.keys(weights));
  } catch {
    card.appendChild(_rqNote('5y履歴の取得に失敗しました（時間をおいて再表示してください）。'));
    return;
  }

  const rows = events
    .map((ev) => ({ ev, res: eventStress(seriesMap, weights, ev.from, ev.to) }))
    .sort((a, b) => (a.res.ret == null ? Infinity : a.res.ret) - (b.res.ret == null ? Infinity : b.res.ret));
  const maxAbs = Math.max(0.0001, ...rows.map((r) => (r.res.ret == null ? 0 : Math.abs(r.res.ret))));

  for (const { ev, res } of rows) {
    const has = res.ret != null;
    const lowCov = res.coveragePct < 90;
    const w = has ? Math.min(100, (Math.abs(res.ret) / maxAbs) * 100) : 0;
    const retTxt = has ? `${(res.ret * 100).toFixed(1)}%` : '—';
    const el = document.createElement('div');
    el.className = 'rev';
    el.innerHTML = `
      <div class="rev-en"><span class="rev-nm">${escapeHTML(stripEventYear(ev.label))}</span><span class="rev-dt">${escapeHTML(fmtEventPeriod(ev.from, ev.to))}</span></div>
      <div class="rev-v">${escapeHTML(retTxt)}</div>
      <div class="rev-track">${has ? `<span class="rev-fill" style="width:${w.toFixed(0)}%"></span>` : ''}</div>
      <div class="rev-cov${lowCov ? ' low' : ''}">cov ${Math.round(res.coveragePct)}%${lowCov ? ' ⚠' : ''}</div>`;
    const en = el.querySelector('.rev-en');
    if (en) en.setAttribute('title', `${ev.from}〜${ev.to}${ev.note ? ` / ${ev.note}` : ''}`);
    card.appendChild(el);
  }

  // 窓内に価格のある保有が少なく1件も算出できない場合だけ案内（読み筋キャプションは廃止・#502 C）
  if (!rows.some((r) => r.res.ret != null)) {
    card.appendChild(_rqNote('窓内に価格のある保有がまだ少なく、イベント再現を算出できません。'));
  }
}

/**
 * クオンツ・リスクカードを非同期で生成する。
 * 履歴データが未取得の場合は案内メッセージのみのカードを返す。
 * @param {Array<{symbol:string, name?:string, value?:number, ySymbol?:string, shares?:number}>} posList
 * @returns {Promise<HTMLElement>}
 */
async function buildQuantCard(posList) {
  const card = document.createElement('div');
  card.className = 'risk-quant';

  card.insertAdjacentHTML('beforeend', cardTitle('i-history', 'クオンツ・リスク', '現PFで過去危機を再現'));

  // §2-1 イベント別「下落の深さ」（5y・stress-events 流用。別カードは②へ統合・廃止）
  await _appendEventStress(card, posList);

  // 参考スタッツ／寄与／分散は 1y 履歴ベース。未取得なら案内のみ追記して返す。
  function _fallback(msg) {
    const block = document.createElement('div');
    block.className = 'q-block';
    block.appendChild(_rqNote(msg));
    card.appendChild(block);
    return card;
  }

  // 履歴を取得
  /** @type {Record<string, Array<{date: Date, close: number}>>} */
  let hist;
  try {
    hist = await getAllHistorical('1y');
  } catch {
    return _fallback('履歴未取得（Historical/Watch タブを開くと日次系列が蓄積され算出されます）');
  }
  if (!hist || Object.keys(hist).length === 0) {
    return _fallback('履歴未取得（Historical/Watch タブを開くと日次系列が蓄積され算出されます）');
  }

  // 履歴ありポジションのみ対象（>=2点を持つ系列）
  const covered = posList.filter((p) => p.ySymbol && Array.isArray(hist[p.ySymbol]) && hist[p.ySymbol].length >= 2);

  if (covered.length < 2) {
    return _fallback('履歴未取得（Historical/Watch タブを開くと日次系列が蓄積され算出されます）');
  }

  // ウェイト（denom ベース; covered 内で正規化）
  /** @type {Record<string, number>} */
  const rawWeights = {};
  for (const p of covered) {
    rawWeights[/** @type {string} */ (p.ySymbol)] = (rawWeights[p.ySymbol] || 0) + (p.value || 0);
  }
  const wTotal = Object.values(rawWeights).reduce((s, w) => s + w, 0);
  /** @type {Record<string, number>} */
  const normWeights = {};
  for (const [sym, w] of Object.entries(rawWeights)) {
    normWeights[sym] = wTotal > 0 ? w / wTotal : 0;
  }

  // seriesMap: ySymbol → 価格系列
  /** @type {Record<string, Array<{date: Date, close: number}>>} */
  const seriesMap = {};
  for (const p of covered) {
    if (p.ySymbol && !seriesMap[p.ySymbol]) seriesMap[p.ySymbol] = hist[p.ySymbol];
  }

  // 日付アライメント & ポートフォリオリターン
  const aligned = alignReturnsByDate(seriesMap);
  const portReturns = computePortfolioReturns(aligned.bySym, normWeights);

  // ポートフォリオ指標（参考値）
  const pfVol = annualizedVol(portReturns);

  // PF 最大 DD: portReturns から累積系列を O(n) で再構築して maxDrawdown へ
  let _cum = 100;
  const pfSeriesLinear = portReturns.map((r, i) => {
    _cum *= 1 + r;
    return { date: new Date(aligned.dates[i] || '2000-01-01'), close: _cum };
  });
  const pfMaxDD = maxDrawdown(pfSeriesLinear);

  // 高相関ペア
  const corrPairs = highCorrelationPairs(aligned.bySym, 0.85);

  // 銘柄別: vol, beta, maxDD（リスク寄与降順）
  /** @type {Array<{sym: string, vol: number, beta: number|null, dd: number}>} */
  const perHolding = [];
  for (const sym of Object.keys(aligned.bySym)) {
    const rets = aligned.bySym[sym];
    const vol = annualizedVol(rets) ?? 0;
    const beta = betaTo(rets, portReturns);
    const dd = maxDrawdown(seriesMap[sym]);
    perHolding.push({ sym, vol, beta, dd });
  }
  // リスク寄与 = vol * |beta|（beta null は vol のみで比較）
  perHolding.sort((a, b) => {
    const ra = a.vol * Math.abs(a.beta ?? 1);
    const rb = b.vol * Math.abs(b.beta ?? 1);
    return rb - ra;
  });
  const excluded = posList.length - covered.length;

  // ── §2-3 参考スタッツ＋寄与＋分散（1y 履歴ベース・DOM 構築）─────────────────

  // 参考値（恣意的な"適正≤20%"バンドは出さない）: 年率ボラ／最大DD
  card.insertAdjacentHTML(
    'beforeend',
    `<div class="q-sub">
      <div class="q-stat2"><div class="qsl"><span class="qsl-l">${ric('i-pulse', true)}年率ボラ</span><span class="qsv">${escapeHTML(_pct1(pfVol))}</span></div><div class="qsc">日次騰落のばらつき×√252。1年あたりの値動きの大きさ（過去1年）。</div></div>
      <div class="q-stat2"><div class="qsl"><span class="qsl-l">${ric('i-history', true)}最大DD</span><span class="qsv">${escapeHTML(_pct1(pfMaxDD))}</span></div><div class="qsc">ピークから谷までの最大下落（過去1年）。</div></div>
    </div>`
  );

  // リスク寄与 Top3（寄与 = vol×|β|。最大寄与=バー100%、値は全体に占めるシェア%）
  const contribs = perHolding.map((h) => ({ sym: h.sym, c: (h.vol ?? 0) * Math.abs(h.beta ?? 1) }));
  const sumC = contribs.reduce((s, x) => s + x.c, 0) || 1;
  const maxC = Math.max(0.0001, ...contribs.map((x) => x.c));
  const top3c = [...contribs].sort((a, b) => b.c - a.c).slice(0, 3);
  if (top3c.length > 0) {
    const contribHTML = top3c
      .map(
        (x) =>
          `<div class="contrib"><span class="ck">${escapeHTML(x.sym)}</span><span class="ct"><span class="cf" style="width:${((x.c / maxC) * 100).toFixed(0)}%"></span></span><span class="cv">${Math.round((x.c / sumC) * 100)}%</span></div>`
      )
      .join('');
    card.insertAdjacentHTML(
      'beforeend',
      `<div class="q-block"><div class="q-bhd">${ric('i-pulse', true)}リスク寄与 Top3 <span class="rq-muted">（PF全体の振れを押し上げる順）</span></div>${contribHTML}</div>`
    );
  }

  // 分散・流動性（高相関ペア＋出口日数・最長。名称化）
  const liqHoldings = covered
    .filter((p) => typeof p.shares === 'number' && p.shares > 0 && Array.isArray(hist[p.ySymbol]))
    .map((p) => ({
      sym: /** @type {string} */ (p.ySymbol),
      shares: /** @type {number} */ (p.shares),
      series: hist[/** @type {string} */ (p.ySymbol)],
    }));
  const liq = computeLiquidity(liqHoldings).filter((x) => x.days != null);
  const longest = liq.length ? [...liq].sort((a, b) => (b.days ?? 0) - (a.days ?? 0))[0] : null;
  const topPair = corrPairs[0] || null;
  const corrDn = topPair
    ? `${escapeHTML(nameOfSymbol(topPair.a))} × ${escapeHTML(nameOfSymbol(topPair.b))}（相関 ${topPair.corr.toFixed(2)}・ほぼ同じ動き）`
    : '高相関ペアなし＝分散が効いている';
  const longSev = longest && longest.days > ILLIQUID_DAYS;
  const liqDv = longest ? `${longest.days < 1 ? longest.days.toFixed(1) : Math.round(longest.days)}日` : '—';
  const liqDn = longest
    ? `${escapeHTML(nameOfSymbol(longest.sym))}。${longSev ? '⚠出口に時間がかかる' : '短い＝流動性良好'}。`
    : '出来高データ未取得（価格更新後に算出）';
  card.insertAdjacentHTML(
    'beforeend',
    `<div class="q-block"><div class="q-bhd">${ric('i-link', true)}分散・流動性</div>
      <div class="divchips">
        <div class="divchip"><div class="dl">高相関ペア（≥0.85）</div><div class="dv">${corrPairs.length ? `${corrPairs.length}組` : 'なし'}</div><div class="dn">${corrDn}</div></div>
        <div class="divchip"><div class="dl">出口日数（売り切り・最長）</div><div class="dv${longSev ? ' rq-sev' : ''}">${escapeHTML(liqDv)}</div><div class="dn">${liqDn}</div></div>
      </div>
    </div>`
  );

  // 脚注
  card.insertAdjacentHTML(
    'beforeend',
    `<p class="rq-note">※ ベータはPF自身への感応度（市場ベンチマーク不要）。年率ボラ／最大DDは過去1年の参考値（適正バンドは示さない）。出口日数＝株数÷(平均出来高×参加率)の概算。${covered.length}銘柄で算出（履歴未取得${excluded}除外）。</p>`
  );

  return card;
}

/**
 * Risk タブ下部に常設する用語解説（タップ開閉・CSP安全な native details）。
 * 用語データは glossary-data.js（#445）。glossaryHTML('risk') の文字列から要素化する。
 * @returns {HTMLElement}
 */
function buildRiskGlossary() {
  const tpl = document.createElement('template');
  tpl.innerHTML = glossaryHTML('risk').trim();
  return /** @type {HTMLElement} */ (tpl.content.firstElementChild);
}

// ── once-guard: target-allocation を二重ロードしない ───────────────────────
let _taLoaded = false;

// レンダー世代トークン（#502 A・カード重複バグ対策）。renderRiskCharts が後発に
// 追い越されたら旧 run を破棄する。
let _riskRenderSeq = 0;

/**
 * リスク断面タブを描画する。panel が hidden のときは何もしない。
 * @returns {Promise<void>}
 */
export async function renderRiskCharts() {
  const panel = document.getElementById('panel-risk');
  if (!panel || panel.hidden) return;
  const wrap = document.getElementById('risk-charts-wrap');
  if (!wrap) return;
  if (typeof d3 === 'undefined') return;

  // 世代トークン＋レンダーガード（#502 A）: タブ連打/価格更新で renderRiskCharts が
  // 二重起動されると await を挟むカード（クオンツ等）が重複 append される。後発に
  // 追い越された旧 run は各 await 直後に破棄し、クリア＆append は最新 run のみ行う。
  const myRun = ++_riskRenderSeq;

  // target-allocation をロード（未ロード時のみ）
  if (!_taLoaded) {
    await loadTargetAllocation();
    _taLoaded = true;
  }
  if (_riskRenderSeq !== myRun) return;

  // 証券（positions・ライブ）＋非証券（現金・暗号資産）を合算して look-through。
  // 非証券は Money Forward 実値（mf-holdings）を優先。未ロード時のみ manual-assets.js にフォールバック。
  const manualAssets = getMfManualAssets() || MANUAL_ASSETS;
  const assets = [...positions, ...manualAssets];
  const breakdown = computeRiskBreakdown(assets);
  const sourceSummary = getSourceSummary(assets);

  // 重い await（クオンツ・地域）を先に解決してから一括クリア＆append（交錯による重複を防ぐ）。
  const quantCard = await buildQuantCard(positions);
  if (_riskRenderSeq !== myRun) return;
  const manualSymbols = manualAssets.map((a) => a.symbol);
  const { card: regionCard, japanTruePct } = await buildRegionCard(assets, manualSymbols);
  if (_riskRenderSeq !== myRun) return;

  wrap.textContent = '';

  // ── リスク要約カード（Phase 4 v1）────────────────────────────────────────
  wrap.appendChild(buildRiskOverviewCard(japanTruePct));
  // ── /リスク要約カード ────────────────────────────────────────────────────

  // ── クオンツ・リスクカード（Phase 4b）────────────────────────────────────
  wrap.appendChild(quantCard);
  // ── /クオンツ・リスクカード ──────────────────────────────────────────────

  // ストレスは②クオンツ・リスクへ統合（別カード廃止・#488）。

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
  // 地域は下部「地域（ルックスルー）」カードに一本化したため、curated「国・地域」
  // ドーナツはグリッドから外す（grid = アセットクラス/通貨/セクターの3つ）。
  for (const dim of RISK_DIMENSIONS) {
    if (dim === 'country') continue;
    grid.appendChild(buildChartCard(dim, breakdown[dim], sourceSummary[dim]));
  }
  // ── 地域（ルックスルー）も同じグリッドに入れて4円グラフを 2×2 に（#525 R2）──
  // 真の地域配分（特に日本のホームバイアス）。build は上部で await 済み。全幅特例は撤廃しグリッド子化。
  grid.appendChild(regionCard);
  wrap.appendChild(grid);

  // データソース明記（#214）＋ 手動入力データの引用元（現金・ひふみ等）
  const src = document.createElement('div');
  src.className = 'risk-source';
  const baseSrc =
    'データソース: 価格 = Finnhub / Yahoo Finance ・ アセットクラス/通貨/国/セクター分類 = 銘柄マスタ（positions.js・constituents.js）';
  const mfSrc = getMfSources();
  // 現金ソース: mf-holdings ロード時はそちら、未ロード時は manual-assets の現金行。ひふみ分類注記は常に残す。
  const srcLines = mfSrc ? [baseSrc, ...mfSrc, MANUAL_SOURCES[1]] : [baseSrc, ...MANUAL_SOURCES];
  src.textContent = srcLines.filter(Boolean).join(' ／ ');
  wrap.appendChild(src);

  // ── 用語解説（常設・タブ末尾）────────────────────────────────────────────
  wrap.appendChild(buildRiskGlossary());
}

// ── 凡例ホバー時の構成銘柄ツールチップ（#212）─────────────────────────
function showLegendTip(ev, dim, key, dimResult) {
  const tip = document.getElementById('tooltip');
  if (!tip) return;
  const items = getContributors(dimResult, key).slice(0, 12);
  const maxPct = items.length ? Math.max(...items.map((c) => c.pct)) : 1;
  const rows = items
    .map((c) => {
      const barW = maxPct > 0 ? ((c.pct / maxPct) * 100).toFixed(1) : 0;
      return `<div class="tt-risk-row"><span class="tt-risk-ticker">${escapeHTML(c.symbol || '—')}</span><span class="tt-risk-name">${escapeHTML(c.name)}</span><div class="tt-risk-bar-wrap"><div class="tt-risk-bar" style="width:${barW}%"></div></div><span class="tt-risk-pct">${fmtPctInt(c.pct)}</span></div>`;
    })
    .join('');
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
  const rows = symbols && symbols.length ? symbols.map((s) => escapeHTML(nameOfSymbol(s))).join('<br>') : '（なし）';
  tip.innerHTML = `<div class="tt-hdr">${escapeHTML(title)}</div>${rows}`;
  tip.style.display = 'block';
  moveLegendTip(ev);
}
