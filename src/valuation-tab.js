// @ts-check

// ══════════════════════════════════════════════════════════════
// valuation-tab.js  ―  「Value」タブ（総合 lens）の描画
//
// 保有銘柄を適正サイズ乖離（gap = currentPct - targetPct）降順に並べ、
// バーディクト chip とサイズバーを表示する Phase 1 実装。
//
// 依存:
//   ./positions.js       (positions)
//   ./target-allocation.js (loadTargetAllocation, getTargetPct, getThemeOf)
//   ./networth.js        (loadMfHoldings, getMfTotals)
//   ./valuations.js      (loadValuations, getValuation, computeVerdict, valuationsLoaded)
//   ./utils.js           (escapeHTML)
// ══════════════════════════════════════════════════════════════

import { positions } from './positions.js';
import { loadTargetAllocation, getTargetPct, getThemeOf } from './target-allocation.js';
import { loadMfHoldings, getMfTotals } from './networth.js';
import { loadValuations, getValuation, computeVerdict, valuationsLoaded } from './valuations.js';
import { escapeHTML } from './utils.js';

/** ローカルの once-guard: 並行二重ロードを防ぐ */
let _taLoaded = false;
let _mfLoaded = false;

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
 * 1 銘柄分の行 HTML を生成する。
 * @param {{ symbol:string, name:string, value:number, ySymbol:string, cat:string, cur:string }} p
 * @param {number} currentPct
 * @param {number|null} targetPct
 * @param {number|null} gap
 * @param {import('./valuations.js').Verdict|null} verdict
 * @param {any|null} val
 * @returns {string}
 */
function rowHTML(p, currentPct, targetPct, gap, verdict, val) {
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

  // line 2: サイズバー
  const line2 = `<div class="val-r2">${sizeBarHTML(currentPct, targetPct)}</div>`;

  // line 3: メトリクス（バリュエーションがある場合のみ）
  let line3 = '';
  if (val) {
    const v = val.value || {};
    const pctTxt = val.percentile != null && isFinite(val.percentile) ? `${Math.round(val.percentile)}%ile` : '—';
    line3 = `<div class="val-met">
      <span><b>PER</b> ${escapeHTML(fmtRaw(v.perTrail))}→${escapeHTML(fmtRaw(v.perFwd))}</span>
      <span><b>PEG</b> ${escapeHTML(fmtRaw(v.peg))}</span>
      <span><b>%タイル</b> ${escapeHTML(pctTxt)}</span>
    </div>`;
  }

  return `<div class="val-row">${line1}${line2}${line3}</div>`;
}

/**
 * Value タブ（総合 lens）を描画する。
 * 保有銘柄をサイズ乖離降順（最も過大保有 → 過小保有 → 乖離不明）に並べ表示する。
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

  // 各銘柄のメトリクスを計算
  /** @type {Array<{p: any, currentPct: number, targetPct: number|null, gap: number|null, verdict: import('./valuations.js').Verdict|null, val: any|null, tkey: string|null}>} */
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

    return { p, currentPct, targetPct, gap, verdict, val, tkey };
  });

  // gap DESC (null は最後)
  rows.sort((a, b) => {
    if (a.gap == null && b.gap == null) return 0;
    if (a.gap == null) return 1;
    if (b.gap == null) return -1;
    return b.gap - a.gap;
  });

  // ヘッダー統計
  const overCount = rows.filter((r) => r.gap != null && r.gap > 0.5).length;
  const cheapCount = rows.filter((r) => r.verdict && r.verdict.class === 'cheap_real').length;

  const statsHTML = `<div class="val-stats">
    <div class="val-stat"><span class="k">過大ポジ</span><span class="v">${overCount}</span></div>
    <div class="val-stat"><span class="k">割安候補</span><span class="v">${cheapCount}</span></div>
    <div class="val-stat"><span class="k">的中率</span><span class="v">—</span></div>
    <div class="val-stat"><span class="k">トリガー</span><span class="v">—</span></div>
  </div>`;

  // レンズ切替ピル（バリュ/品質/モメンタムは Phase 2 以降）
  const lensHTML = `<div class="val-lens" role="tablist" aria-label="レンズ選択">
    <button class="val-seg on" role="tab" aria-selected="true" data-lens="total">総合</button>
    <button class="val-seg is-soon" role="tab" aria-selected="false" disabled title="Phase 2">バリュ</button>
    <button class="val-seg is-soon" role="tab" aria-selected="false" disabled title="Phase 2">品質</button>
    <button class="val-seg is-soon" role="tab" aria-selected="false" disabled title="Phase 2">モメンタム</button>
  </div>
  <div class="val-soon" id="val-soon-note" hidden>準備中（Phase 2）</div>`;

  // 全行を結合
  const rowsHTML = rows.map((r) => rowHTML(r.p, r.currentPct, r.targetPct, r.gap, r.verdict, r.val)).join('');

  wrap.innerHTML = `${statsHTML + lensHTML}<div class="val-list">${rowsHTML}</div>`;

  // Phase 2 ピルのクリックで「準備中」ノート表示（data-action 不使用・CSP 安全な addEventListener）
  const soonNote = wrap.querySelector('#val-soon-note');
  wrap.querySelectorAll('.val-seg.is-soon').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (soonNote) {
        // @ts-ignore
        soonNote.hidden = false;
        setTimeout(() => {
          if (soonNote) /** @type {HTMLElement} */ (soonNote).hidden = true;
        }, 2000);
      }
    });
  });
}
