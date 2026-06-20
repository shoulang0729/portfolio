// @ts-check

// ══════════════════════════════════════════════════════════════
// valuation-tab.js  ―  「Value」タブ（4レンズ: 総合/バリュ/品質/モメンタム）
//
// 保有銘柄を各レンズの視点で並べ直し、メトリクスを表示する。
//
// 依存:
//   ./positions.js       (positions)
//   ./target-allocation.js (loadTargetAllocation, getTargetPct, getThemeOf, computeThemeUsage)
//   ./networth.js        (loadMfHoldings, getMfTotals)
//   ./valuations.js      (loadValuations, getValuation, computeVerdict, valuationsLoaded)
//   ./triggers.js        (loadTriggers, triggersLoaded, getTriggers, evaluateTriggers)
//   ./utils.js           (escapeHTML)
// ══════════════════════════════════════════════════════════════

import { positions } from './positions.js';
import { loadTargetAllocation, getTargetPct, getThemeOf, computeThemeUsage } from './target-allocation.js';
import { loadMfHoldings, getMfTotals } from './networth.js';
import { loadValuations, getValuation, computeVerdict, valuationsLoaded } from './valuations.js';
import { loadTriggers, triggersLoaded, getTriggers, evaluateTriggers } from './triggers.js';
import { loadVerdictOutcomes, outcomesLoaded, computeHitRate } from './verdict-outcomes.js';
import { escapeHTML } from './utils.js';

/** ローカルの once-guard: 並行二重ロードを防ぐ */
let _taLoaded = false;
let _mfLoaded = false;

/** 現在アクティブなレンズ */
let _lens = 'total';

/**
 * データを必要なら読み込む（既ロード済みならスキップ）。
 * @returns {Promise<void>}
 */
async function _ensureData() {
  const loads = [];
  if (!_taLoaded) {
    loads.push(
      loadTargetAllocation().then(() => {
        _taLoaded = true;
      })
    );
  }
  if (!_mfLoaded) {
    loads.push(
      loadMfHoldings().then(() => {
        _mfLoaded = true;
      })
    );
  }
  if (!valuationsLoaded()) {
    loads.push(loadValuations());
  }
  if (!triggersLoaded()) {
    loads.push(loadTriggers());
  }
  if (!outcomesLoaded()) {
    loads.push(loadVerdictOutcomes());
  }
  await Promise.all(loads);
}

/**
 * 数値を小数点1桁の文字列にフォーマットする。null/undefined は '—' を返す。
 * @param {number|null|undefined} n
 * @returns {string}
 */
function fmt1(n) {
  return n != null && isFinite(n) ? n.toFixed(1) : '—';
}

/**
 * PER/PEG 生値表示（小数点1桁）。
 * @param {number|null|undefined} n
 * @returns {string}
 */
function fmtRaw(n) {
  return n != null && isFinite(n) ? n.toFixed(1) : '—';
}

/**
 * バーディクトのクラス名から CSS クラス名（.vc-xxx）を返す。
 * @param {string} cls
 * @returns {string}
 */
function chipClass(cls) {
  return `val-chip vc-${escapeHTML(cls)}`;
}

/**
 * ギャップ数値からバッジ文字列を返す。
 * @param {number|null} gap
 * @returns {{ text: string, cls: string }}
 */
function gapBadge(gap) {
  if (gap == null) return { text: '—', cls: 'gap' };
  if (gap > 0.5) return { text: `+${fmt1(gap)}%`, cls: 'gap over' };
  if (gap < -0.5) return { text: `${fmt1(gap)}%`, cls: 'gap under' };
  return { text: `±${fmt1(Math.abs(gap))}%`, cls: 'gap fit' };
}

/**
 * サイズバー HTML を生成する。
 * @param {number} currentPct
 * @param {number|null} targetPct
 * @returns {string}
 */
function sizeBarHTML(currentPct, targetPct) {
  if (targetPct == null) {
    return `<span class="val-size"><span class="val-size-label">適正—</span></span>`;
  }
  // クランプして視覚的に崩れないようにする（最大 30% 分）
  const scale = 30;
  const curW = Math.min(100, (currentPct / scale) * 100);
  const tgtL = Math.min(100, (targetPct / scale) * 100);
  const badge = gapBadge(currentPct - targetPct);
  return `<span class="val-size">
    <span class="val-size-label">${fmt1(currentPct)}% → ${fmt1(targetPct)}%</span>
    <span class="val-bar" title="現在 ${fmt1(currentPct)}% vs 目標 ${fmt1(targetPct)}%">
      <span class="cur" style="width:${curW.toFixed(1)}%"></span>
      <span class="tgt" style="left:${tgtL.toFixed(1)}%"></span>
    </span>
    <span class="${escapeHTML(badge.cls)}">${escapeHTML(badge.text)}</span>
  </span>`;
}

/**
 * line3 メトリクス HTML を現在のレンズに応じて生成する。
 * @param {any|null} val  getValuation() の戻り値（null の場合は '—' のみ）
 * @returns {string}
 */
function line3HTML(val) {
  if (_lens === 'total') {
    if (!val) return '';
    const v = val.value || {};
    const pctTxt = val.percentile != null && isFinite(val.percentile) ? `${Math.round(val.percentile)}%ile` : '—';
    return `<div class="val-met">
      <span><b>PER</b> ${escapeHTML(fmtRaw(v.perTrail))}→${escapeHTML(fmtRaw(v.perFwd))}</span>
      <span><b>PEG</b> ${escapeHTML(fmtRaw(v.peg))}</span>
      <span><b>%タイル</b> ${escapeHTML(pctTxt)}</span>
    </div>`;
  }

  if (_lens === 'value') {
    if (!val) return '';
    const v = val.value || {};
    const pctTxt = val.percentile != null && isFinite(val.percentile) ? `${Math.round(val.percentile)}%ile` : '—';
    return `<div class="val-met">
      <span><b>PER</b> ${escapeHTML(fmtRaw(v.perTrail))}→${escapeHTML(fmtRaw(v.perFwd))}</span>
      <span><b>PEG</b> ${escapeHTML(fmtRaw(v.peg))}</span>
      <span><b>EV/EBITDA</b> ${escapeHTML(fmtRaw(v.evEbitda))}</span>
      <span><b>FCF利回り</b> ${escapeHTML(fmtRaw(v.fcfYield))}%</span>
      <span><b>還元</b> ${escapeHTML(fmtRaw(v.shareholderYield))}%</span>
      <span><b>%タイル</b> ${escapeHTML(pctTxt)}</span>
    </div>`;
  }

  if (_lens === 'quality') {
    if (!val) return '';
    const q = val.quality || {};
    // ROIC vs WACC のカラーキュー
    const roicNum = q.roic != null && isFinite(q.roic) ? q.roic : null;
    const waccNum = q.wacc != null && isFinite(q.wacc) ? q.wacc : null;
    const roicBad = roicNum != null && waccNum != null && roicNum < waccNum;
    const roicStr = `${escapeHTML(fmtRaw(roicNum))}%`;
    const waccStr = `${escapeHTML(fmtRaw(waccNum))}%`;
    const roicMetric = roicBad
      ? `<span class="val-bad">${roicStr} vs WACC ${waccStr}</span>`
      : `${roicStr} vs WACC ${waccStr}`;
    // Altman Z のカラーキュー
    const zNum = q.altmanZ != null && isFinite(q.altmanZ) ? q.altmanZ : null;
    const zStr = escapeHTML(fmtRaw(zNum));
    const zMetric = zNum != null && zNum < 3 ? `<span class="val-warn">${zStr}</span>` : zStr;
    return `<div class="val-met">
      <span><b>ROIC</b> ${roicMetric}</span>
      <span><b>粗利/資産</b> ${escapeHTML(fmtRaw(q.grossProf))}</span>
      <span><b>FCF変換</b> ${escapeHTML(fmtRaw(q.fcfConv))}</span>
      <span><b>F</b> ${escapeHTML(fmtRaw(q.fScore))}</span>
      <span><b>Z</b> ${zMetric}</span>
      <span><b>Q</b> ${escapeHTML(fmtRaw(q.qScore))}</span>
    </div>`;
  }

  if (_lens === 'momentum') {
    if (!val) return '';
    const m = val.momentum || {};
    // priceMom1Y の符号別クラス（日本市場慣例: 上昇=赤=up / 下落=緑=down）
    const mom1y = m.priceMom1Y != null && isFinite(m.priceMom1Y) ? m.priceMom1Y : null;
    const mom1yStr = mom1y != null ? (mom1y >= 0 ? `+${fmt1(mom1y)}` : fmt1(mom1y)) : '—';
    const mom1yCls = mom1y == null ? '' : mom1y >= 0 ? ' class="val-mom-up"' : ' class="val-mom-dn"';
    return `<div class="val-met">
      <span><b>改定90d</b> ${escapeHTML(fmtRaw(m.epsRev90d))}%</span>
      <span><b>1Y</b> <span${mom1yCls}>${escapeHTML(mom1yStr)}%</span></span>
      <span><b>52週位置</b> ${escapeHTML(fmtRaw(m.pos52w))}%</span>
      <span><b>対セクター</b> ${escapeHTML(fmtRaw(m.rsVsSector))}%</span>
    </div>`;
  }

  return '';
}

/**
 * 総合レンズ専用: トリガー行 HTML を生成する。
 * @param {{ active: Array<{side:string,type:string,action:string,reason:string}>, watching: Array<{side:string,type:string,action:string,note:string}> }} trig
 * @returns {string}
 */
function triggerLineHTML(trig) {
  if (!trig || (trig.active.length === 0 && trig.watching.length === 0)) return '';

  if (trig.active.length > 0) {
    const t = trig.active[0];
    if (t.side === 'sell') {
      return `<div class="val-trig sell">🔴 売り発議: ${escapeHTML(t.action)} <span class="trg-r">(${escapeHTML(t.reason)})</span></div>`;
    }
    return `<div class="val-trig buy">🟢 買い余地: ${escapeHTML(t.action)}</div>`;
  }

  // watching のみ
  const w = trig.watching[0];
  return `<div class="val-trig watch">監視中: ${escapeHTML(w.action)}（${escapeHTML(w.note)}）</div>`;
}

/**
 * 1 銘柄分の行 HTML を生成する（_lens に応じて line3 を切り替える）。
 * @param {{ symbol:string, name:string, value:number, ySymbol:string, cat:string, cur:string }} p
 * @param {number} currentPct
 * @param {number|null} targetPct
 * @param {number|null} gap
 * @param {import('./valuations.js').Verdict|null} verdict
 * @param {any|null} val
 * @param {{ active: Array<any>, watching: Array<any> }|null} trig
 * @returns {string}
 */
function rowHTML(p, currentPct, targetPct, gap, verdict, val, trig) {
  // line 1: シンボル + 銘柄名 + verdict chip
  const chipHTML =
    verdict && verdict.class !== 'na'
      ? `<span class="${chipClass(verdict.class)}" title="${escapeHTML(verdict.drivers.join('・'))}">${escapeHTML(verdict.label)}</span>`
      : '';

  const line1 = `<div class="val-r1">
    <b class="val-tk">${escapeHTML(p.symbol)}</b>
    <span class="val-nm">${escapeHTML(p.name)}</span>
    ${chipHTML}
  </div>`;

  // line 2: サイズバー（全レンズ共通）
  const line2 = `<div class="val-r2">${sizeBarHTML(currentPct, targetPct)}</div>`;

  // line 3: レンズ別メトリクス
  const line3 = line3HTML(val);

  // トリガー行: 総合レンズのみ表示
  const trigLine = _lens === 'total' && trig ? triggerLineHTML(trig) : '';

  return `<div class="val-row">${line1}${line2}${line3}${trigLine}</div>`;
}

/**
 * 現在の _lens に応じて rows を並び替えて返す（元配列は変更しない）。
 * @param {Array<{p:any,currentPct:number,targetPct:number|null,gap:number|null,verdict:any,val:any,trig:any}>} rows
 * @returns {Array<{p:any,currentPct:number,targetPct:number|null,gap:number|null,verdict:any,val:any,trig:any}>}
 */
function sortedRows(rows) {
  const copy = rows.slice();
  if (_lens === 'total') {
    // gap DESC (null は最後)
    copy.sort((a, b) => {
      if (a.gap == null && b.gap == null) return 0;
      if (a.gap == null) return 1;
      if (b.gap == null) return -1;
      return b.gap - a.gap;
    });
  } else if (_lens === 'value') {
    // percentile ASC (cheap first; null last)
    copy.sort((a, b) => {
      const pa = a.val && a.val.percentile != null && isFinite(a.val.percentile) ? a.val.percentile : null;
      const pb = b.val && b.val.percentile != null && isFinite(b.val.percentile) ? b.val.percentile : null;
      if (pa == null && pb == null) return 0;
      if (pa == null) return 1;
      if (pb == null) return -1;
      return pa - pb;
    });
  } else if (_lens === 'quality') {
    // qScore DESC (null last)
    copy.sort((a, b) => {
      const qa =
        a.val && a.val.quality && a.val.quality.qScore != null && isFinite(a.val.quality.qScore)
          ? a.val.quality.qScore
          : null;
      const qb =
        b.val && b.val.quality && b.val.quality.qScore != null && isFinite(b.val.quality.qScore)
          ? b.val.quality.qScore
          : null;
      if (qa == null && qb == null) return 0;
      if (qa == null) return 1;
      if (qb == null) return -1;
      return qb - qa;
    });
  } else if (_lens === 'momentum') {
    // priceMom1Y DESC (null last)
    copy.sort((a, b) => {
      const ma =
        a.val && a.val.momentum && a.val.momentum.priceMom1Y != null && isFinite(a.val.momentum.priceMom1Y)
          ? a.val.momentum.priceMom1Y
          : null;
      const mb =
        b.val && b.val.momentum && b.val.momentum.priceMom1Y != null && isFinite(b.val.momentum.priceMom1Y)
          ? b.val.momentum.priceMom1Y
          : null;
      if (ma == null && mb == null) return 0;
      if (ma == null) return 1;
      if (mb == null) return -1;
      return mb - ma;
    });
  }
  return copy;
}

/**
 * レンズごとのキャプション文字列を返す。
 * @param {string} lens
 * @returns {string}
 */
function lensCap(lens) {
  if (lens === 'total') return '乖離順｜サイズ過大が上';
  if (lens === 'value') return '%タイル昇順｜割安が上';
  if (lens === 'quality') return 'qScore順｜ROIC<WACCは赤・Altman Z<3は注意色';
  if (lens === 'momentum') return '1Y騰落順';
  return '';
}

/**
 * Value タブを描画する。_lens に応じてソート・メトリクスを切り替える。
 * @returns {Promise<void>}
 */
export async function renderValuationTab() {
  const wrap = document.getElementById('value-wrap');
  if (!wrap) return;

  // データ読み込み
  await _ensureData();

  // 分母（総評価額 JPY）
  const totals = getMfTotals();
  const denom = (totals && totals.imported) || positions.reduce((s, p) => s + (p.value || 0), 0);

  if (denom <= 0 || positions.length === 0) {
    wrap.innerHTML = '<div class="val-soon">データ準備中。マネフォ取込またはCSV取込を実行してください。</div>';
    return;
  }

  // symbol → currentPct マップ（テーマ使用率計算用）
  /** @type {Record<string, number>} */
  const currentPctBySymbol = {};
  for (const p of positions) {
    const pct = ((p.value || 0) / denom) * 100;
    // ySymbol と symbol 両方にマップ（computeThemeUsage は members で参照するため）
    if (p.ySymbol) currentPctBySymbol[p.ySymbol] = pct;
    if (p.symbol && p.symbol !== p.ySymbol) currentPctBySymbol[p.symbol] = pct;
  }

  // 各銘柄のメトリクスを計算
  /** @type {Array<{p: any, currentPct: number, targetPct: number|null, gap: number|null, verdict: import('./valuations.js').Verdict|null, val: any|null, tkey: string|null, trig: {active:Array<any>,watching:Array<any>}|null}>} */
  const rows = positions.map((p) => {
    const currentPct = ((p.value || 0) / denom) * 100;

    // target key を解決: ySymbol → symbol → name の優先順で最初に結果が得られるものを使う
    /** @type {string|null} */
    let tkey = null;
    for (const candidate of [p.ySymbol, p.symbol, p.name]) {
      if (!candidate) continue;
      if (getTargetPct(candidate) != null || getThemeOf(candidate) != null) {
        tkey = candidate;
        break;
      }
    }

    const targetPct = tkey != null ? getTargetPct(tkey) : null;
    const gap = targetPct != null ? currentPct - targetPct : null;

    const val = getValuation(p.ySymbol);
    const verdict = val ? computeVerdict(val) : null;

    // テーマ使用率（concentration トリガー用）
    const trigTheme = (tkey && getThemeOf(tkey)) || (p.ySymbol && getThemeOf(p.ySymbol)) || null;
    const themeUsagePct = trigTheme ? computeThemeUsage(trigTheme, currentPctBySymbol).used : null;

    // トリガーを評価（ySymbol 優先、次に symbol）
    const trigSymbol = getTriggers(p.ySymbol) ? p.ySymbol : getTriggers(p.symbol) ? p.symbol : null;
    const trig = trigSymbol
      ? evaluateTriggers(trigSymbol, {
          percentile: val && val.percentile != null ? val.percentile : null,
          peg: val && val.value && val.value.peg != null ? val.value.peg : null,
          themeUsagePct,
          price: p.price != null ? p.price : null,
        })
      : null;

    return { p, currentPct, targetPct, gap, verdict, val, tkey, trig };
  });

  // ヘッダー統計（常に総合ベースで計算）
  const overCount = rows.filter((r) => r.gap != null && r.gap > 0.5).length;
  const cheapCount = rows.filter((r) => r.verdict && r.verdict.class === 'cheap_real').length;
  const triggerCount = rows.filter((r) => r.trig && r.trig.active.length > 0).length;

  const hr = computeHitRate();
  const hitRateVal =
    hr.resolved > 0
      ? `<span title="${hr.ratePct}%" aria-label="的中率${hr.ratePct}%">${hr.hits}-${hr.misses}</span>`
      : '—';
  const statsHTML = `<div class="val-stats">
    <div class="val-stat"><span class="k">過大ポジ</span><span class="v">${overCount}</span></div>
    <div class="val-stat"><span class="k">割安候補</span><span class="v">${cheapCount}</span></div>
    <div class="val-stat"><span class="k">的中率</span><span class="v">${hitRateVal}</span></div>
    <div class="val-stat"><span class="k">トリガー</span><span class="v">${triggerCount}</span></div>
  </div>`;

  // レンズ切替ピル（4つすべて有効）
  const lenses = [
    { key: 'total', label: '総合' },
    { key: 'value', label: 'バリュ' },
    { key: 'quality', label: '品質' },
    { key: 'momentum', label: 'モメンタム' },
  ];
  const pillsHTML = lenses
    .map(
      (l) =>
        `<button class="val-seg${_lens === l.key ? ' on' : ''}" role="tab" aria-selected="${_lens === l.key}" data-lens="${escapeHTML(l.key)}">${escapeHTML(l.label)}</button>`
    )
    .join('');
  const lensHTML = `<div class="val-lens" role="tablist" aria-label="レンズ選択">${pillsHTML}</div>
  <div class="val-lens-cap">${escapeHTML(lensCap(_lens))}</div>`;

  // 現在レンズでソートして行を生成
  const sorted = sortedRows(rows);
  const rowsHTML = sorted.map((r) => rowHTML(r.p, r.currentPct, r.targetPct, r.gap, r.verdict, r.val, r.trig)).join('');

  wrap.innerHTML = `${statsHTML}${lensHTML}<div class="val-list">${rowsHTML}</div>`;

  // ピルのクリックで _lens を更新して再描画（CSP 安全な addEventListener）
  wrap.querySelectorAll('.val-seg[data-lens]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextLens = /** @type {HTMLElement} */ (btn).dataset.lens;
      if (!nextLens || nextLens === _lens) return;
      _lens = nextLens;
      renderValuationTab();
    });
  });
}
