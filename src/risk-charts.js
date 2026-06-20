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
} from './risk-calc.js';
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
  note.textContent = '※ ベータ・相関・ストレス・流動性は次段（4b）で追加予定';
  card.appendChild(note);

  return card;
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
