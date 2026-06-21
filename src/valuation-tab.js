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
import {
  loadTargetAllocation,
  getTargetPct,
  getConviction,
  getThemeOf,
  computeThemeUsage,
} from './target-allocation.js';
import { loadMfHoldings, getMfTotals } from './networth.js';
import { loadValuations, getValuation, computeVerdict, valuationsLoaded } from './valuations.js';
import { impliedGrowth, isGrowthOverheated } from './reverse-dcf.js';
import { glossaryHTML } from './glossary.js';
import { loadTriggers, triggersLoaded, getTriggers, evaluateTriggers } from './triggers.js';
import { loadVerdictOutcomes, outcomesLoaded, computeHitRate } from './verdict-outcomes.js';
import { getAllHistorical } from './historical-cache.js';
import { computePriceMomentum, relStrength } from './momentum-calc.js';
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
 * バーディクトから chip の CSS クラス名を返す。罠は2種を区別する。
 * @param {import('./valuations.js').Verdict} verdict
 * @returns {string}
 */
function chipClass(verdict) {
  if (verdict.class === 'trap') {
    return verdict.sub === 'trap_once' ? 'val-chip vc-trap-once' : 'val-chip vc-trap-cheap';
  }
  return `val-chip vc-${escapeHTML(verdict.class)}`;
}

/**
 * 確信度コードを日本語ラベルに変換する。
 * @param {'probe'|'standard'|'high'|null} conviction
 * @returns {string}
 */
function convictionLabel(conviction) {
  if (conviction === 'probe') return '打診';
  if (conviction === 'standard') return '標準';
  if (conviction === 'high') return '高確信';
  return '';
}

/**
 * サイズバー HTML を生成する（左端=0%・右端=適正×2・適正は常に中央）。
 * 塗りが中央を超える＝持ちすぎ、届かない＝持たなすぎ。
 * 適正の2倍超は塗りを満タンにし右端に倍率「× N」を表示。
 * 適正マーカー（▲）直下に「適正%（確信度）」を1行で示す。
 * @param {number} currentPct
 * @param {number|null} targetPct
 * @param {'probe'|'standard'|'high'|null} conviction
 * @returns {string}
 */
function sizeBarHTML(currentPct, targetPct, conviction) {
  if (targetPct == null || !isFinite(targetPct) || targetPct <= 0) {
    return `<div class="val-sb val-sb--na">
      <div class="val-sb-top"></div>
      <div class="val-sb-bar"></div>
      <div class="val-sb-scale"><span class="end"></span><span class="mid"><span class="lab">適正—</span></span><span class="end"></span></div>
    </div>`;
  }
  const scaleMax = targetPct * 2; // 右端 = 適正の2倍
  const ratio = currentPct / scaleMax; // 1.0 で中央=適正、0.5で左1/4…
  const fillW = Math.min(100, Math.max(0, ratio * 100));
  const diff = currentPct - targetPct;
  const fillCls = diff > 0.5 ? 'over' : diff < -0.5 ? 'under' : 'fit';
  const curLeft = Math.min(94, Math.max(6, fillW)); // tip ラベルの見切れ防止
  const overflow = currentPct > scaleMax;
  const mult = overflow ? currentPct / targetPct : null;
  const xnum = overflow && mult != null ? `<span class="val-sb-x">× ${mult.toFixed(1)}</span>` : '';
  const convTxt = convictionLabel(conviction);
  const convHTML = convTxt ? `<span class="cv">（${escapeHTML(convTxt)}）</span>` : '';
  return `<div class="val-sb">
    <div class="val-sb-top"><span class="val-sb-cur ${fillCls}" style="left:${curLeft.toFixed(0)}%">${fmt1(currentPct)}%</span></div>
    <div class="val-sb-bar"><span class="val-sb-fill ${fillCls}" style="width:${fillW.toFixed(1)}%"></span>${xnum}</div>
    <div class="val-sb-scale">
      <span class="end">持たなすぎ</span>
      <span class="mid"><span class="tri" aria-hidden="true"></span><span class="lab">${fmt1(targetPct)}%${convHTML}</span></span>
      <span class="end">持ちすぎ</span>
    </div>
  </div>`;
}

/**
 * レンズの並べ替え基準を、カード上で強調する対象に対応づける（純関数・テスト対象）。
 * @param {string} lens
 * @returns {{ chip: 'pct'|'f'|null, sizeBar: boolean }}
 */
export function sortKeyForLens(lens) {
  switch (lens) {
    case 'total':
      return { chip: null, sizeBar: true }; // gap DESC → サイズバー強調
    case 'value':
      return { chip: 'pct', sizeBar: false }; // percentile ASC → %タイルチップ
    case 'quality':
      return { chip: 'f', sizeBar: false }; // qScore DESC → Fチップ（代表値）
    default:
      return { chip: null, sizeBar: false }; // momentum 等はチップ強調なし（レンズピルで表現）
  }
}

/**
 * 固定コアチップ（PER／PEG／%タイル／Fスコア の4枚・2×2）。レンズに応じて
 * 並べ替えキーのチップに is-sortkey を付与する。全レンズ同一構成（作り替えない）。
 * @param {any|null} val
 * @param {string} lens
 * @returns {string}
 */
function coreChipsHTML(val, lens) {
  const v = (val && val.value) || {};
  const q = (val && val.quality) || {};
  const sk = sortKeyForLens(lens);
  const per = `${fmtRaw(v.perTrail)}→${fmtRaw(v.perFwd)}`;
  const pct = val && val.percentile != null && isFinite(val.percentile) ? `${Math.round(val.percentile)}%ile` : '—';
  const chip = (id, k, b) =>
    `<span class="val-c${sk.chip === id ? ' is-sortkey' : ''}"><span class="k">${k}</span><b>${escapeHTML(b)}</b></span>`;
  return `<div class="val-chips">
    ${chip('per', 'PER', per)}
    ${chip('peg', 'PEG', fmtRaw(v.peg))}
    ${chip('pct', '%タイル', pct)}
    ${chip('f', 'Fスコア', fmtRaw(q.fScore))}
  </div>`;
}

/**
 * 「詳細指標」タップ展開（全レンズ同一内容）。コア4項目（PER/PEG/%タイル/F）は
 * 重複回避のため載せない。色キュー（ROIC<WACC=赤・Altman Z<3・符号色）は保持。
 * @param {any|null} val
 * @returns {string}
 */
function detailHTML(val) {
  if (!val) return '';
  const v = val.value || {};
  const q = val.quality || {};
  const m = val.momentum || {};

  // 各指標は `<b>ラベル</b><span>値</span>` のフラットペア（.val-met=2列grid で行高を揃える）。
  // 閾値は値の隣に記号併記（色だけに頼らない＝色覚配慮）。

  // ── バリュ ──（1段Gordon は永久一定成長前提＝シクリカルには不適 → cyclical は —）
  const ig = v.cyclical === true ? null : impliedGrowth(v.fcfYield, q.wacc != null ? q.wacc : null);
  const igTxt = ig != null && isFinite(ig) ? `${fmt1(ig)}%${isGrowthOverheated(ig) ? ' ⚠期待過多' : ''}` : '—';
  const igCls = isGrowthOverheated(ig) ? ' class="val-warn"' : '';
  const tg = v.targetGapPct != null && isFinite(v.targetGapPct) ? v.targetGapPct : null;
  const tgTxt = tg != null ? `${tg >= 0 ? '+' : ''}${fmt1(tg)}%` : '—';
  const tgCls = tg == null ? '' : tg >= 0 ? ' class="val-mom-up"' : ' class="val-mom-dn"';
  const valueGrp = `<div class="val-met">
      <b>EV/EBITDA</b><span>${escapeHTML(fmtRaw(v.evEbitda))}</span>
      <b>FCF利回り</b><span>${escapeHTML(fmtRaw(v.fcfYield))}%</span>
      <b>株主還元</b><span>${escapeHTML(fmtRaw(v.shareholderYield))}%</span>
      <b>織込成長</b><span${igCls}>${escapeHTML(igTxt)}</span>
      <b>目標乖離</b><span${tgCls}>${escapeHTML(tgTxt)}</span>
    </div>`;

  // ── 品質 ──
  const roicNum = q.roic != null && isFinite(q.roic) ? q.roic : null;
  const waccNum = q.wacc != null && isFinite(q.wacc) ? q.wacc : null;
  const roicBad = roicNum != null && waccNum != null && roicNum < waccNum;
  const roicStr = `${escapeHTML(fmtRaw(roicNum))}% vs WACC ${escapeHTML(fmtRaw(waccNum))}%`;
  const roicMetric = roicBad ? `<span class="val-bad">${roicStr} ⚠下回り</span>` : roicStr;
  const zNum = q.altmanZ != null && isFinite(q.altmanZ) ? q.altmanZ : null;
  const zStr = escapeHTML(fmtRaw(zNum));
  const zMetric = zNum != null && zNum < 3 ? `<span class="val-warn">${zStr} ⚠&lt;3</span>` : zStr;
  const qualGrp = `<div class="val-met">
      <b>ROIC</b><span>${roicMetric}</span>
      <b>粗利/資産</b><span>${escapeHTML(fmtRaw(q.grossProf))}</span>
      <b>FCF変換</b><span>${escapeHTML(fmtRaw(q.fcfConv))}</span>
      <b>Altman Z</b><span>${zMetric}</span>
      <b>Qスコア</b><span>${escapeHTML(fmtRaw(q.qScore))}</span>
    </div>`;

  // ── モメンタム ──（日本市場慣例: 上昇=赤=up / 下落=緑=down）
  const mom1y = m.priceMom1Y != null && isFinite(m.priceMom1Y) ? m.priceMom1Y : null;
  const mom1yStr = mom1y != null ? (mom1y >= 0 ? `+${fmt1(mom1y)}` : fmt1(mom1y)) : '—';
  const mom1yCls = mom1y == null ? '' : mom1y >= 0 ? ' class="val-mom-up"' : ' class="val-mom-dn"';
  const momGrp = `<div class="val-met">
      <b>改定90d</b><span>${escapeHTML(fmtRaw(m.epsRev90d))}%</span>
      <b>1Y騰落</b><span${mom1yCls}>${escapeHTML(mom1yStr)}%</span>
      <b>52週位置</b><span>${escapeHTML(fmtRaw(m.pos52w))}%</span>
      <b>対市場</b><span>${escapeHTML(fmtRaw(m.rsVsSector))}%</span>
    </div>`;

  // グループ凡例（1行・常時表示でモバイルでも分かる。詳しくは下部の用語解説）
  const grp = (lab, cap, body) =>
    `<div class="val-detail-grp"><span class="lab">${lab}<span class="grp-cap">${cap}</span></span>${body}</div>`;
  return `<details class="val-detail"><summary>詳細指標</summary>
    ${grp('バリュ', '価格が割安か', valueGrp)}
    ${grp('品質', '罠でないか・稼ぐ力', qualGrp)}
    ${grp('モメンタム', '勢いと市場対比', momGrp)}
  </details>`;
}

/**
 * カード上部のアクションバナー HTML を生成する。
 * トリガーがあればその行動（トリム/積増/監視）、無ければ「維持」。
 * @param {{ active: Array<{side:string,type:string,action:string,reason:string}>, watching: Array<{side:string,type:string,action:string,note:string}> }|null} trig
 * @returns {string}
 */
function bannerHTML(trig) {
  let kind = 'hold';
  let glyph = '▪';
  let action = '維持';
  let reason = '';
  if (trig && trig.active.length > 0) {
    const t = trig.active[0];
    if (t.side === 'sell') {
      kind = 'sell';
      glyph = '▼';
      action = 'トリム';
    } else {
      kind = 'buy';
      glyph = '▲';
      action = '積増';
    }
    reason = t.reason || t.action || '';
  } else if (trig && trig.watching.length > 0) {
    const w = trig.watching[0];
    kind = 'watch';
    glyph = '◦';
    action = '監視';
    reason = w.note || w.action || '';
  }
  const reasonHTML = reason ? `<span class="vb">${escapeHTML(reason)}</span>` : '';
  return `<div class="val-banner val-banner--${kind}"><span class="va"><span class="gl" aria-hidden="true">${glyph}</span>${action}</span>${reasonHTML}</div>`;
}

/**
 * カード下部の判定確度 行 HTML を生成する（confidence が無ければ空文字）。
 * @param {import('./valuations.js').Verdict|null} verdict
 * @returns {string}
 */
function confidenceHTML(verdict) {
  if (!verdict || verdict.confidence == null) return '';
  const lv = verdict.confidence;
  const dots = lv === '高' ? 3 : lv === '中' ? 2 : 1;
  let dotsHTML = '';
  for (let i = 0; i < 3; i++) dotsHTML += `<i class="d${i < dots ? ' on' : ''}"></i>`;
  const drv =
    verdict.drivers && verdict.drivers.length
      ? `<span class="drv">根拠: ${escapeHTML(verdict.drivers.join('・'))}</span>`
      : '';
  return `<div class="val-jc"><span class="jc-nm">判定確度</span><span class="jc-dots" aria-label="判定確度 ${escapeHTML(lv)}">${dotsHTML}<span class="lv">${escapeHTML(lv)}</span></span>${drv}</div>`;
}

/**
 * 1 銘柄分のカード HTML を生成する。
 * 構成: アクションバナー → シンボル+verdict → サイズバー → コアチップ → 判定確度 → 詳細指標。
 * @param {{ symbol:string, name:string, value:number, ySymbol:string, cat:string, cur:string }} p
 * @param {number} currentPct
 * @param {number|null} targetPct
 * @param {import('./valuations.js').Verdict|null} verdict
 * @param {any|null} val
 * @param {{ active: Array<any>, watching: Array<any> }|null} trig
 * @param {'probe'|'standard'|'high'|null} conviction
 * @returns {string}
 */
function rowHTML(p, currentPct, targetPct, verdict, val, trig, conviction) {
  // アクションバナー（全レンズ共通・常時表示）
  const banner = bannerHTML(trig);

  // 上段: シンボル + 銘柄名（下揃え）+ verdict chip + proxy バッジ
  const chipHTML =
    verdict && verdict.label && verdict.label !== '-'
      ? `<span class="${chipClass(verdict)}" title="${escapeHTML(verdict.drivers.join('・'))}">${escapeHTML(verdict.label)}</span>`
      : '';
  // proxy ETF（value.perSource:"fund-trailing"）は判定が proxy 由来である旨をバッジ表示
  const isProxy = !!(val && val.value && val.value.perSource === 'fund-trailing');
  const proxyHTML = isProxy
    ? `<span class="val-proxy" title="ETFのファンド実績PER。予想PER不在のため%タイル基準の粗い判定">proxy</span>`
    : '';
  const head = `<div class="val-head">
    <b class="val-tk">${escapeHTML(p.symbol)}</b>
    <span class="val-nm">${escapeHTML(p.name)}</span>
    ${chipHTML}${proxyHTML}
  </div>`;

  // サイズバー（全レンズ共通）。total レンズは並べ替えキー＝サイズ乖離なのでリング強調。
  const sk = sortKeyForLens(_lens);
  const size = `<div class="val-size-wrap${sk.sizeBar ? ' is-sortkey' : ''}">${sizeBarHTML(currentPct, targetPct, conviction)}</div>`;

  // 指標段はレンズ非依存に統一: 固定コアチップ4枚＋詳細展開（作り替えない）
  const metrics = coreChipsHTML(val, _lens);
  const detail = detailHTML(val);

  // 判定確度（全レンズ共通）
  const confLine = confidenceHTML(verdict);

  // 並び: banner → head → size → metrics → 判定確度 → detail
  return `<div class="val-row">${banner}<div class="val-body">${head}${size}${metrics}${confLine}${detail}</div></div>`;
}

/**
 * 現在の _lens に応じて rows を並び替えて返す（元配列は変更しない）。
 * @param {Array<{p:any,currentPct:number,targetPct:number|null,gap:number|null,verdict:any,val:any,trig:any,conviction?:any}>} rows
 * @returns {Array<{p:any,currentPct:number,targetPct:number|null,gap:number|null,verdict:any,val:any,trig:any,conviction?:any}>}
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

  // 価格モメンタムを履歴キャッシュ（1y close 系列）から自動算出。
  // valuations.json の手動シードが優先、null の項目だけ live 値で埋める。
  // getAllHistorical は内部で例外を握り潰し {} を返すため try/catch 不要。
  const _hist = /** @type {Record<string, Array<{date: Date, close: number}>>} */ (await getAllHistorical('1y'));
  // 対市場の相対強さ（rsVsSector）のベンチ＝世界株 ACWI（保有・履歴キャッシュにある）。
  const _benchSeries = _hist['ACWI'] || null;

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
  /** @type {Array<{p: any, currentPct: number, targetPct: number|null, gap: number|null, verdict: import('./valuations.js').Verdict|null, val: any|null, tkey: string|null, trig: {active:Array<any>,watching:Array<any>}|null, conviction: 'probe'|'standard'|'high'|null}>} */
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
    const conviction = tkey != null ? getConviction(tkey) : null;

    let val = getValuation(p.ySymbol);
    // 価格モメンタム（priceMom1Y / pos52w / rsVsSector=対ACWI）を履歴から live 補完（null のみ）
    const liveMom = p.ySymbol ? computePriceMomentum(_hist[p.ySymbol]) : null;
    const liveRs = p.ySymbol && _benchSeries ? relStrength(_hist[p.ySymbol], _benchSeries) : null;
    if (liveMom || liveRs != null) {
      const m = (val && val.momentum) || {};
      val = {
        ...(val || {}),
        momentum: {
          ...m,
          priceMom1Y: m.priceMom1Y != null ? m.priceMom1Y : liveMom ? liveMom.priceMom1Y : null,
          pos52w: m.pos52w != null ? m.pos52w : liveMom ? liveMom.pos52w : null,
          rsVsSector: m.rsVsSector != null ? m.rsVsSector : liveRs,
        },
      };
    }
    const verdict = val ? computeVerdict(val) : null;

    // テーマ使用率（concentration トリガー用）
    const trigTheme = (tkey && getThemeOf(tkey)) || (p.ySymbol && getThemeOf(p.ySymbol)) || null;
    const themeUsagePct = trigTheme ? computeThemeUsage(trigTheme, currentPctBySymbol).used : null;

    // proxy ETF 判定（value.perSource:"fund-trailing" が立っている＝自前PERが proxy）
    const isEtf = !!(val && val.value && val.value.perSource === 'fund-trailing');

    // トリガーを評価（ySymbol 優先、次に symbol）
    const trigSymbol = getTriggers(p.ySymbol) ? p.ySymbol : getTriggers(p.symbol) ? p.symbol : null;
    const trig = trigSymbol
      ? evaluateTriggers(trigSymbol, {
          percentile: val && val.percentile != null ? val.percentile : null,
          peg: val && val.value && val.value.peg != null ? val.value.peg : null,
          themeUsagePct,
          price: p.price != null ? p.price : null,
          isEtf,
        })
      : null;

    return { p, currentPct, targetPct, gap, verdict, val, tkey, trig, conviction };
  });

  // ヘッダー統計（常に総合ベースで計算）
  const overCount = rows.filter((r) => r.gap != null && r.gap > 0.5).length;
  const cheapCount = rows.filter((r) => r.verdict && r.verdict.class === 'cheap_real').length;
  const triggerCount = rows.filter((r) => r.trig && r.trig.active.length > 0).length;
  const watchCount = rows.filter((r) => r.trig && r.trig.watching.length > 0).length;

  // D-4 / #450: 的中率を 発議(action) / 判定(verdict) 別に hits/resolved 表記で表示する。
  // `-` の引き算誤読を避け、未判定は「判定待ちN」で集計中を明示。率が高いと軽い accent。
  const hrA = computeHitRate('action');
  const hrV = computeHitRate('verdict');
  const hrPart = (label, hr) => {
    if (hr.resolved > 0) {
      const hot = hr.ratePct != null && hr.ratePct >= 60 ? ' hr-hot' : '';
      return `<span class="hr-p${hot}" title="${label}的中率 ${hr.ratePct}%（hits/判定済・対ACWI相対）" aria-label="${label} ${hr.hits}当たり ${hr.resolved}件中">${label} ${hr.hits}/${hr.resolved}</span>`;
    }
    if (hr.pending > 0) return `<span class="hr-p">${label} 判定待ち${hr.pending}</span>`;
    return `<span class="hr-p">${label}—</span>`;
  };
  const hitRateVal = `${hrPart('発議', hrA)}<span class="hr-sep"> / </span>${hrPart('判定', hrV)}`;
  // トリガー: active=抵触 / watching=監視 を併記（ヘッダ値は抵触＝アクションバナー化する銘柄数）
  const trigVal = `<span class="hr-p">抵触${triggerCount}</span><span class="hr-sep">・</span><span class="hr-p">監視${watchCount}</span>`;
  // tap-to-explain（CSP安全な native details・3行）。正本の定義は用語解説「規律」カテゴリ。
  const statsExplain = `<details class="val-stats-help">
    <summary>ⓘ 統計の見方</summary>
    <p><b>発議</b>：自分の売買が約1ヶ月後に対ACWIで正しかったか（当たり / 判定済）。</p>
    <p><b>判定</b>：エンジンの cheap/rich が約6ヶ月後に対ACWIで当たったか。</p>
    <p><b>抵触/監視</b>：事前ルールに今抵触している銘柄数 / 監視中の銘柄数。</p>
  </details>`;
  const statsHTML = `<div class="val-stats">
    <div class="val-stat"><span class="k">過大ポジ</span><span class="v">${overCount}</span></div>
    <div class="val-stat"><span class="k">割安候補</span><span class="v">${cheapCount}</span></div>
    <div class="val-stat"><span class="k">的中率</span><span class="v">${hitRateVal}</span></div>
    <div class="val-stat"><span class="k">トリガー</span><span class="v">${trigVal}</span></div>
  </div>${statsExplain}`;

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
  const rowsHTML = sorted
    .map((r) => rowHTML(r.p, r.currentPct, r.targetPct, r.verdict, r.val, r.trig, r.conviction))
    .join('');

  wrap.innerHTML = `${statsHTML}${lensHTML}<div class="val-list">${rowsHTML}</div>${glossaryHTML('value')}`;

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
