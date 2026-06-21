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
  worstReturn,
  worstWindow,
  alignReturnsByDate,
  highCorrelationPairs,
  computePortfolioReturns,
  eventStress,
} from './risk-calc.js';
import { getAllHistorical } from './historical-cache.js';
import { fetchSymbolHistory, batchWithRetry } from './data.js';
import { state } from './state.js';
import { computeLiquidity, ILLIQUID_DAYS, ADV_WINDOW, PARTICIPATION } from './liquidity-calc.js';
import { fmtJPYInt, fmtPctInt, escapeHTML } from './utils.js';
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
 * @returns {Promise<HTMLElement>}
 */
async function buildRegionCard(holdings) {
  const { regionMap, regionWeights, asOf } = await loadRegionData();
  const { pct } = computeTrueRegionExposure(holdings, regionMap, regionWeights);
  const bias = japanHomeBias(pct);

  const card = document.createElement('div');
  card.className = 'risk-card region-card';

  const title = document.createElement('div');
  title.className = 'risk-card-title';
  title.textContent = '地域エクスポージャ（ルックスルー）';
  card.appendChild(title);

  // 筆頭カード: 日本の真% / ベンチ / ホームバイアス
  const hero = document.createElement('div');
  hero.className = 'region-hero';
  const biasSign = bias.biasPt >= 0 ? '+' : '';
  const biasCls = bias.biasPt >= 0 ? 'region-bias-over' : 'region-bias-under';
  hero.innerHTML = `
    <div class="region-hero-main"><span class="region-hero-k">日本 真%</span><span class="region-hero-v">${bias.japanPct.toFixed(1)}%</span></div>
    <div class="region-hero-sub">ACWIベンチ ${bias.benchPct}% ｜ ホームバイアス <span class="${biasCls}">${biasSign}${bias.biasPt.toFixed(1)}pt</span></div>`;
  card.appendChild(hero);

  // 全地域の真% リスト（降順）
  const list = document.createElement('ul');
  list.className = 'region-list';
  const rows = Object.entries(pct).sort((a, b) => b[1] - a[1]);
  for (const [region, p] of rows) {
    const li = document.createElement('li');
    li.className = 'region-list-item';
    const name = document.createElement('span');
    name.className = 'region-name';
    name.textContent = REGION_LABELS[region] || region;
    const val = document.createElement('span');
    val.className = 'region-pct';
    val.textContent = `${p.toFixed(1)}%`;
    li.appendChild(name);
    li.appendChild(val);
    list.appendChild(li);
  }
  card.appendChild(list);

  // 鮮度・方式注記
  const note = document.createElement('div');
  note.className = 'risk-coverage-note';
  note.textContent = `直接タグ＋ルックスルー按分（オルカン/ひふみ/ひふみXO）。地域構成比は静的（鮮度 ${asOf || '—'}・四半期更新）。VGK/2800.HK は未保有＝0%。`;
  card.appendChild(note);

  return card;
}

// ── D-1 ストレスシナリオ（名前付き歴史イベント）──────────────────────────────
/** stress-events.json のロードキャッシュ */
let _stressEvents = null;
async function loadStressEvents() {
  if (_stressEvents) return _stressEvents;
  try {
    const r = await fetch(`data/stress-events.json?_=${Date.now()}`);
    const j = r.ok ? await r.json() : null;
    _stressEvents = (j && Array.isArray(j.events) ? j.events : []);
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
  const missing = symbols.filter((s) => !Array.isArray(state.historicalCache['5y'][s]) || state.historicalCache['5y'][s].length < 2);
  if (missing.length) {
    await batchWithRetry(missing, (s) => fetchSymbolHistory(s, '5y'), { batchSize: 6, delayMs: 1100 });
  }
  return state.historicalCache['5y'] || {};
}

/**
 * D-1: 名前付きイベントのストレス表カードを生成する。
 * 「現PFが当時を再体験したら」の what-if。イベント名｜PF下落%｜カバレッジ%。
 * @param {Array<{symbol?:string, ySymbol?:string, value?:number|null}>} holdings
 * @returns {Promise<HTMLElement>}
 */
async function buildStressCard(holdings) {
  const card = document.createElement('div');
  card.className = 'risk-card stress-card';
  const title = document.createElement('div');
  title.className = 'risk-card-title';
  title.textContent = 'ストレスシナリオ（現PFが当時を再体験したら）';
  card.appendChild(title);

  const events = await loadStressEvents();
  if (events.length === 0) {
    const p = document.createElement('p');
    p.className = 'risk-coverage-note';
    p.textContent = 'イベントカタログ未取得。';
    card.appendChild(p);
    return card;
  }

  // 値ベースのウェイト（全保有・カバレッジ分母）
  /** @type {Record<string, number>} */
  const weights = {};
  for (const p of holdings) {
    if (p.ySymbol) weights[p.ySymbol] = (weights[p.ySymbol] || 0) + (p.value || 0);
  }
  const symbols = Object.keys(weights);

  let seriesMap;
  try {
    seriesMap = await ensureStressHistory(symbols);
  } catch {
    const p = document.createElement('p');
    p.className = 'risk-coverage-note';
    p.textContent = '5y履歴の取得に失敗しました（時間をおいて再表示してください）。';
    card.appendChild(p);
    return card;
  }

  // 各イベントを採点して下落大きい順
  const rows = events
    .map((ev) => ({ ev, res: eventStress(seriesMap, weights, ev.from, ev.to) }))
    .sort((a, b) => {
      const ra = a.res.ret == null ? Infinity : a.res.ret;
      const rb = b.res.ret == null ? Infinity : b.res.ret;
      return ra - rb; // 下落（負が大）が上
    });

  const table = document.createElement('div');
  table.className = 'stress-table';
  for (const { ev, res } of rows) {
    const row = document.createElement('div');
    row.className = 'stress-row';
    const lowCov = res.coveragePct < 90;
    const retTxt = res.ret == null ? '—' : `${(res.ret * 100).toFixed(1)}%`;
    const retCls = res.ret != null && res.ret < 0 ? 'stress-neg' : '';
    const covCls = lowCov ? 'stress-cov-low' : '';
    row.innerHTML = `
      <span class="stress-name" title="${escapeHTML(`${ev.from}〜${ev.to}${ev.note ? ` / ${ev.note}` : ''}`)}">${escapeHTML(ev.label)}</span>
      <span class="stress-ret ${retCls}">${escapeHTML(retTxt)}</span>
      <span class="stress-cov ${covCls}">cov ${Math.round(res.coveragePct)}%${lowCov ? ' ⚠' : ''}</span>`;
    table.appendChild(row);
  }
  card.appendChild(table);

  const note = document.createElement('div');
  note.className = 'risk-coverage-note';
  note.textContent = '実履歴 replay × 現ウェイトの what-if（実損益ではない）。窓内に価格が無い保有は除外・再正規化し coverage% に反映（<90% は注意）。履歴は保有限定 5y（IDB）。';
  card.appendChild(note);
  return card;
}

/** 軸ごとのタイトル */
const TITLES = {
  assetClass: 'アセットクラス',
  currency: '通貨',
  country: '国・地域',
  sector: 'セクター',
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

/** symbol → 銘柄名（ツールチップ表示用） */
function nameOfSymbol(sym) {
  const p = positions.find((x) => x.symbol === sym);
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

  const title = document.createElement('div');
  title.className = 'risk-card-title';
  title.textContent = TITLES[dim];
  card.appendChild(title);

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

/**
 * リスク要約カード（致命傷回避サーフェス）を生成する。
 * @returns {HTMLElement}
 */
function buildRiskOverviewCard() {
  const card = document.createElement('div');
  card.className = 'risk-overview';

  // タイトル
  const h4 = document.createElement('h4');
  h4.textContent = 'リスク要約（致命傷回避）';
  card.appendChild(h4);

  const roRow = document.createElement('div');
  roRow.className = 'ro-row';
  card.appendChild(roRow);

  // 分母を確定（MF実値 → positions 合計フォールバック）
  const totals = getMfTotals();
  const denom = (totals && totals.imported) || positions.reduce((s, p) => s + (p.value || 0), 0);

  // ── 1. キャッシュ比率 ────────────────────────────────────────────────────
  const cashRatioStat = document.createElement('div');
  cashRatioStat.className = 'ro-stat';
  const cashLabel = document.createElement('div');
  cashLabel.className = 'ro-stat-label';
  cashLabel.textContent = '投資用キャッシュ比率';
  cashRatioStat.appendChild(cashLabel);
  const cashVal = document.createElement('div');
  cashVal.className = 'ro-stat-value';
  if (totals) {
    const cr = totals.cashRatio;
    const outOfRange = cr < 5 || cr > 20;
    cashVal.textContent = `${cr.toFixed(1)}%`;
    cashVal.style.color = outOfRange ? 'var(--up)' : 'var(--text)';
    if (outOfRange) cashVal.title = cr < 5 ? 'キャッシュ不足（<5%）' : 'キャッシュ過多（>20%）';
  } else {
    cashVal.textContent = '—';
  }
  cashRatioStat.appendChild(cashVal);
  roRow.appendChild(cashRatioStat);

  // 以下の指標は target-allocation が必要。未ロード時はグレースフルデグレード。
  const taAvailable = /** @type {boolean} */ (denom > 0);

  // ── 2. 過大ポジション（gapPct > 0.5）────────────────────────────────────
  const oversizeStat = document.createElement('div');
  oversizeStat.className = 'ro-stat';
  const oversizeLabel = document.createElement('div');
  oversizeLabel.className = 'ro-stat-label';
  oversizeLabel.textContent = '過大ポジ';
  oversizeStat.appendChild(oversizeLabel);
  const oversizeVal = document.createElement('div');
  oversizeVal.className = 'ro-stat-value';
  if (taAvailable) {
    const resolved = _resolvePositionTkeys(denom);
    let oversizeCount = 0;
    for (const { tkey, currentPct } of resolved) {
      if (!tkey) continue;
      const gap = computeGap(tkey, currentPct);
      if (gap.gapPct != null && gap.gapPct > 0.5) oversizeCount++;
    }
    oversizeVal.textContent = `${oversizeCount} 件`;
    if (oversizeCount > 0) oversizeVal.style.color = 'var(--up)';
  } else {
    oversizeVal.textContent = '—';
  }
  oversizeStat.appendChild(oversizeVal);
  roRow.appendChild(oversizeStat);

  // ── 3. 最大集中（テーマ or 単銘柄）─────────────────────────────────────
  const maxConStat = document.createElement('div');
  maxConStat.className = 'ro-stat';
  const maxConLabel = document.createElement('div');
  maxConLabel.className = 'ro-stat-label';
  maxConLabel.textContent = '最大集中';
  maxConStat.appendChild(maxConLabel);
  const maxConVal = document.createElement('div');
  maxConVal.className = 'ro-stat-value';
  if (taAvailable && denom > 0) {
    // テーマ別集計
    /** @type {Record<string, number>} */
    const currentPctBySymbol = {};
    for (const p of positions) {
      const pct = ((p.value || 0) / denom) * 100;
      if (p.ySymbol) currentPctBySymbol[p.ySymbol] = (currentPctBySymbol[p.ySymbol] || 0) + pct;
      if (p.symbol && p.symbol !== p.ySymbol) currentPctBySymbol[p.symbol] = (currentPctBySymbol[p.symbol] || 0) + pct;
    }
    /** @type {string|null} */
    let maxLabel = null;
    let maxPct = 0;
    // themeCaps は getThemeCap を通じてアクセスする。既知テーマ一覧は getThemeOf から逆引き不可なので
    // positions から tkey を解決し、テーマ別に合算する。
    /** @type {Record<string, number>} */
    const themeUsedPct = {};
    const resolved2 = _resolvePositionTkeys(denom);
    for (const { tkey, currentPct } of resolved2) {
      if (!tkey) continue;
      const theme = getThemeOf(tkey);
      if (theme) {
        themeUsedPct[theme] = (themeUsedPct[theme] || 0) + currentPct;
      }
    }
    for (const [theme, used] of Object.entries(themeUsedPct)) {
      if (used > maxPct) {
        maxPct = used;
        maxLabel = escapeHTML(theme);
      }
    }
    // 単銘柄も確認（テーマ未分類）
    for (const p of positions) {
      const pct = ((p.value || 0) / denom) * 100;
      if (pct > maxPct) {
        maxPct = pct;
        maxLabel = escapeHTML(p.name || p.symbol || '');
      }
    }
    if (maxLabel) {
      maxConVal.textContent = `${maxLabel} ${maxPct.toFixed(1)}%`;
      if (maxPct > 20) maxConVal.style.color = 'var(--up)';
    } else {
      maxConVal.textContent = '—';
    }
  } else {
    maxConVal.textContent = '—';
  }
  maxConStat.appendChild(maxConVal);
  roRow.appendChild(maxConStat);

  // ── 4. テーマ上限超過チップ ──────────────────────────────────────────────
  const chipsStat = document.createElement('div');
  chipsStat.className = 'ro-stat ro-stat-chips';
  const chipsLabel = document.createElement('div');
  chipsLabel.className = 'ro-stat-label';
  chipsLabel.textContent = 'テーマ上限超過';
  chipsStat.appendChild(chipsLabel);

  if (taAvailable && denom > 0) {
    /** @type {Record<string, number>} */
    const currentPctBySymbol2 = {};
    for (const p of positions) {
      const pct = ((p.value || 0) / denom) * 100;
      if (p.ySymbol) currentPctBySymbol2[p.ySymbol] = (currentPctBySymbol2[p.ySymbol] || 0) + pct;
      if (p.symbol && p.symbol !== p.ySymbol)
        currentPctBySymbol2[p.symbol] = (currentPctBySymbol2[p.symbol] || 0) + pct;
    }

    // 全 positions のテーマを収集してユニークなテーマセットを得る
    const resolvedForTheme = _resolvePositionTkeys(denom);
    /** @type {Set<string>} */
    const themes = new Set();
    for (const { tkey } of resolvedForTheme) {
      if (!tkey) continue;
      const th = getThemeOf(tkey);
      if (th) themes.add(th);
    }

    /** @type {Array<{theme: string, used: number, cap: number}>} */
    const overThemes = [];
    for (const theme of themes) {
      const cap = getThemeCap(theme);
      if (cap == null) continue;
      const usage = computeThemeUsage(theme, currentPctBySymbol2);
      if (usage.used > cap) overThemes.push({ theme, used: usage.used, cap });
    }

    if (overThemes.length === 0) {
      const ok = document.createElement('span');
      ok.className = 'ro-ok';
      ok.textContent = 'なし';
      chipsStat.appendChild(ok);
    } else {
      const chipsWrap = document.createElement('div');
      chipsWrap.className = 'ro-chips-wrap';
      for (const { theme, used, cap } of overThemes) {
        const chip = document.createElement('span');
        chip.className = 'ro-chip';
        chip.textContent = `${escapeHTML(theme)} ${used.toFixed(1)}%>${cap}%`;
        chipsWrap.appendChild(chip);
      }
      chipsStat.appendChild(chipsWrap);
    }
  } else {
    const dash = document.createElement('span');
    dash.textContent = '—';
    chipsStat.appendChild(dash);
  }
  card.appendChild(chipsStat);

  // ── 注記 ─────────────────────────────────────────────────────────────────
  const note = document.createElement('div');
  note.className = 'ro-note';
  note.textContent = '※ ベータ・相関は下段クオンツカード（4b）を参照。ストレス・流動性は 4b+ 予定';
  card.appendChild(note);

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

/**
 * クオンツ・リスクカードを非同期で生成する。
 * 履歴データが未取得の場合は案内メッセージのみのカードを返す。
 * @param {Array<{symbol:string, name?:string, value?:number, ySymbol?:string, shares?:number}>} posList
 * @returns {Promise<HTMLElement>}
 */
async function buildQuantCard(posList) {
  const card = document.createElement('div');
  card.className = 'risk-quant';

  const title = document.createElement('h4');
  title.textContent = 'クオンツ・リスク（過去1年・履歴ベース）';
  card.appendChild(title);

  /** 案内メッセージを出してカードを返す内部ヘルパー */
  function _fallback(msg) {
    const p = document.createElement('p');
    p.className = 'rq-note';
    p.style.color = 'var(--text2)';
    p.textContent = msg;
    card.appendChild(p);
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

  // ポートフォリオ指標
  const pfVol = annualizedVol(portReturns);
  const pfWorstD = worstReturn(portReturns);
  const pfWorstW = worstWindow(portReturns, 5); // 最悪1週(5営業日)
  const pfWorstM = worstWindow(portReturns, 21); // 最悪1ヶ月(21営業日)
  const pfWorstQ = worstWindow(portReturns, 63); // 最悪3ヶ月(63営業日)

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
  const top3 = perHolding.slice(0, 3);

  const excluded = posList.length - covered.length;

  // ── DOM 構築 ──────────────────────────────────────────────────────────────

  // PF 行
  const pfRow = document.createElement('div');
  pfRow.className = 'rq-row';

  /** @param {string} label @param {string} valText @param {boolean} [isSev] */
  function _stat(label, valText, isSev = false) {
    const el = document.createElement('div');
    el.className = 'rq-stat';
    const lb = document.createElement('span');
    lb.className = 'rq-stat-label';
    lb.textContent = label;
    const vl = document.createElement('span');
    vl.className = `rq-stat-value${isSev ? ' rq-sev' : ''}`;
    vl.textContent = valText;
    el.appendChild(lb);
    el.appendChild(vl);
    return el;
  }

  pfRow.appendChild(_stat('年率ボラ', _pct1(pfVol), (pfVol ?? 0) > 0.2));
  pfRow.appendChild(_stat('最大DD', _pct1(pfMaxDD), true));
  card.appendChild(pfRow);

  // ── ストレス（過去1年の最悪局面・PF）─────────────────────────────────────
  const stressTitle = document.createElement('div');
  stressTitle.className = 'rq-stat-label';
  stressTitle.style.marginTop = '8px';
  stressTitle.textContent = 'ストレス（過去1年の最悪局面・PF）';
  card.appendChild(stressTitle);

  const stressRow = document.createElement('div');
  stressRow.className = 'rq-row';
  stressRow.appendChild(_stat('最悪1日', _pct1(pfWorstD), true));
  stressRow.appendChild(_stat('最悪1週', _pct1(pfWorstW), true));
  stressRow.appendChild(_stat('最悪1ヶ月', _pct1(pfWorstM), true));
  stressRow.appendChild(_stat('最悪3ヶ月', _pct1(pfWorstQ), true));
  card.appendChild(stressRow);

  // カバレッジ注記
  const covNote = document.createElement('p');
  covNote.className = 'rq-note';
  covNote.textContent = `${covered.length}銘柄で算出（履歴未取得${excluded}除外）`;
  card.appendChild(covNote);

  // 高相関ペア
  const corrTitle = document.createElement('div');
  corrTitle.className = 'rq-stat-label';
  corrTitle.textContent = '高相関ペア（≥0.85）';
  card.appendChild(corrTitle);

  const corrRow = document.createElement('div');
  corrRow.className = 'rq-row';
  const top5Pairs = corrPairs.slice(0, 5);
  if (top5Pairs.length === 0) {
    const okChip = document.createElement('span');
    okChip.className = 'rq-chip rq-ok';
    okChip.textContent = 'なし';
    corrRow.appendChild(okChip);
  } else {
    for (const { a, b, corr } of top5Pairs) {
      const chip = document.createElement('span');
      chip.className = 'rq-chip';
      // escapeHTML applied to dynamic symbol strings
      const escA = escapeHTML(a);
      const escB = escapeHTML(b);
      chip.textContent = `${escA}–${escB} ${corr.toFixed(2)}`;
      corrRow.appendChild(chip);
    }
  }
  card.appendChild(corrRow);

  // リスク寄与トップ3
  if (top3.length > 0) {
    const contribTitle = document.createElement('div');
    contribTitle.className = 'rq-stat-label';
    contribTitle.style.marginTop = '8px';
    contribTitle.textContent = 'リスク寄与 Top3（vol×|β|降順）';
    card.appendChild(contribTitle);

    const contribRow = document.createElement('div');
    contribRow.className = 'rq-row';
    for (const { sym, vol, beta } of top3) {
      const el = document.createElement('div');
      el.className = 'rq-stat';
      const lb = document.createElement('span');
      lb.className = 'rq-stat-label';
      lb.textContent = escapeHTML(sym);
      const vl = document.createElement('span');
      vl.className = 'rq-stat-value';
      const betaStr = beta !== null ? ` β${beta.toFixed(1)}` : '';
      vl.textContent = `vol ${_pct1(vol)}${betaStr}`;
      el.appendChild(lb);
      el.appendChild(vl);
      contribRow.appendChild(el);
    }
    card.appendChild(contribRow);
  }

  // ── 流動性（出口日数）─────────────────────────────────────────────────────
  // 履歴に出来高(vol)がある銘柄のみ。出口日数 = 株数 ÷ (ADV × 参加率)。
  const liqHoldings = covered
    .filter((p) => typeof p.shares === 'number' && p.shares > 0 && Array.isArray(hist[p.ySymbol]))
    .map((p) => ({
      sym: /** @type {string} */ (p.ySymbol),
      shares: /** @type {number} */ (p.shares),
      series: hist[/** @type {string} */ (p.ySymbol)],
    }));
  const liq = computeLiquidity(liqHoldings).filter((x) => x.days != null);

  const liqTitle = document.createElement('div');
  liqTitle.className = 'rq-stat-label';
  liqTitle.style.marginTop = '8px';
  liqTitle.textContent = `流動性 出口日数（ADV${ADV_WINDOW}×${Math.round(PARTICIPATION * 100)}%/日）`;
  card.appendChild(liqTitle);

  if (liq.length === 0) {
    const liqNote = document.createElement('p');
    liqNote.className = 'rq-note';
    liqNote.textContent = '出来高データ未取得（価格更新後に蓄積され算出されます）';
    card.appendChild(liqNote);
  } else {
    const liqRow = document.createElement('div');
    liqRow.className = 'rq-row';
    // 捌きにくい順に最大5件
    for (const { sym, days } of liq.slice(0, 5)) {
      const el = document.createElement('div');
      el.className = 'rq-stat';
      const lb = document.createElement('span');
      lb.className = 'rq-stat-label';
      lb.textContent = escapeHTML(sym);
      const vl = document.createElement('span');
      const sev = days != null && days > ILLIQUID_DAYS;
      vl.className = `rq-stat-value${sev ? ' rq-sev' : ''}`;
      vl.textContent = days != null ? `${days < 1 ? days.toFixed(1) : Math.round(days)}日` : '—';
      el.appendChild(lb);
      el.appendChild(vl);
      liqRow.appendChild(el);
    }
    card.appendChild(liqRow);

    const illiquidCount = liq.filter((x) => x.days != null && x.days > ILLIQUID_DAYS).length;
    if (illiquidCount > 0) {
      const liqWarn = document.createElement('p');
      liqWarn.className = 'rq-note';
      liqWarn.textContent = `出口に${ILLIQUID_DAYS}営業日超かかる保有 ${illiquidCount}件`;
      card.appendChild(liqWarn);
    }
  }

  // 脚注
  const foot = document.createElement('p');
  foot.className = 'rq-note';
  foot.textContent =
    '※ベータはポートフォリオ自身への感応度（市場ベンチマーク不要の履歴算出）。ストレスは過去1年の最悪局面（イベント名付きシナリオは将来拡張）。出口日数は株数÷(平均出来高×参加率)の概算。';
  card.appendChild(foot);

  return card;
}

/**
 * Risk タブ下部に常設する用語解説（タップ開閉・CSP安全な native details）。
 * Value タブの .val-gloss と同じスタイルを流用する。
 * @returns {HTMLElement}
 */
function buildRiskGlossary() {
  const d = document.createElement('details');
  d.className = 'val-gloss';
  d.innerHTML = `<summary>用語解説</summary>
    <div class="val-gloss-body">
      <p><b>集中度</b>：1銘柄・1テーマ・1通貨への偏り。致命傷を避けるため上限バンドで管理。</p>
      <p><b>年率ボラ</b>：日次リターンのばらつき（標準偏差）を年率換算。大きいほど値動きが荒い。</p>
      <p><b>相関（≥0.85）</b>：2銘柄が一緒に動く度合い（-1〜+1）。高相関ペアばかりだと分散が効かず一緒に下げる。</p>
      <p><b>最大DD（ドローダウン）</b>：高値から谷までの最大下落率。最も苦しい局面の沈み込み。</p>
      <p><b>ストレス（最悪1日/1週/1ヶ月/3ヶ月）</b>：過去1年でその期間に被った最悪の下落率。「最悪どれだけ食らうか」の体感。</p>
      <p><b>PFβ（ポートフォリオ・ベータ）</b>：各銘柄がPF全体に対しどれだけ敏感に動くか。市場ベンチマーク不要の履歴算出。</p>
      <p><b>リスク寄与（vol×|β|）</b>：ボラ×ベータ絶対値。PFリスクへの寄与が大きい銘柄ほど上位。</p>
      <p><b>出口日数</b>：保有を捌くのにかかる営業日数＝株数÷(平均出来高ADV×参加率)。5営業日超は流動性リスクとして警告。</p>
      <p><b>ストレスシナリオ</b>：名前付きの過去暴落（円キャリー巻き戻し/DeepSeek/関税等）を、現在のPFウェイト×実履歴で当時のレンジを再生した「現PFが当時を再体験したら」の下落率。実損益ではない what-if。窓内に価格が無い後発IPO等は除外・再正規化し coverage%（<90%は注意）で明示。</p>
    </div>`;
  return d;
}

// ── once-guard: target-allocation を二重ロードしない ───────────────────────
let _taLoaded = false;

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

  // target-allocation をロード（未ロード時のみ）
  if (!_taLoaded) {
    await loadTargetAllocation();
    _taLoaded = true;
  }

  // 証券（positions・ライブ）＋非証券（現金・暗号資産）を合算して look-through。
  // 非証券は Money Forward 実値（mf-holdings）を優先。未ロード時のみ manual-assets.js にフォールバック。
  const manualAssets = getMfManualAssets() || MANUAL_ASSETS;
  const assets = [...positions, ...manualAssets];
  const breakdown = computeRiskBreakdown(assets);
  const sourceSummary = getSourceSummary(assets);

  wrap.textContent = '';

  // ── リスク要約カード（Phase 4 v1）────────────────────────────────────────
  wrap.appendChild(buildRiskOverviewCard());
  // ── /リスク要約カード ────────────────────────────────────────────────────

  // ── クオンツ・リスクカード（Phase 4b）────────────────────────────────────
  wrap.appendChild(await buildQuantCard(positions));
  // ── /クオンツ・リスクカード ──────────────────────────────────────────────

  // ── ストレスシナリオ（名前付き歴史イベント・D-1）──────────────────────────
  // 保有 5y を lazy 取得（IDB のみ）して現PFの what-if 下落を表示。
  wrap.appendChild(await buildStressCard(positions));
  // ── /ストレスシナリオ ────────────────────────────────────────────────────

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
    grid.appendChild(buildChartCard(dim, breakdown[dim], sourceSummary[dim]));
  }
  wrap.appendChild(grid);

  // ── 地域エクスポージャ（ルックスルー・D-6）────────────────────────────────
  // 真の地域配分（特に日本のホームバイアス）を可視化。証券保有のみ対象。
  wrap.appendChild(await buildRegionCard(positions));
  // ── /地域エクスポージャ ──────────────────────────────────────────────────

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
