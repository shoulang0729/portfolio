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
import { loadTriggers, triggersLoaded, getTriggers, evaluateTriggers } from './triggers.js';
import { loadVerdictOutcomes, outcomesLoaded, computeHitRate } from './verdict-outcomes.js';
import { getAllHistorical } from './historical-cache.js';
import { computePriceMomentum } from './momentum-calc.js';
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
 * 総合レンズ用の等幅チップ（PER / PEG / Fスコア）HTML を生成する。
 * @param {any|null} val
 * @returns {string}
 */
function totalChipsHTML(val) {
  const v = (val && val.value) || {};
  const q = (val && val.quality) || {};
  const per = `${fmtRaw(v.perTrail)}→${fmtRaw(v.perFwd)}`;
  return `<div class="val-chips">
    <span class="val-c"><span class="k">PER</span><b>${escapeHTML(per)}</b></span>
    <span class="val-c"><span class="k">PEG</span><b>${escapeHTML(fmtRaw(v.peg))}</b></span>
    <span class="val-c"><span class="k">Fスコア</span><b>${escapeHTML(fmtRaw(q.fScore))}</b></span>
  </div>`;
}

/**
 * 1 銘柄分のカード HTML を生成する。
 * 構成: アクションバナー → シンボル+verdict → サイズバー → 指標チップ → 判定確度。
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

  // 上段: シンボル + 銘柄名（下揃え）+ verdict chip
  const chipHTML =
    verdict && verdict.label && verdict.label !== '-'
      ? `<span class="${chipClass(verdict)}" title="${escapeHTML(verdict.drivers.join('・'))}">${escapeHTML(verdict.label)}</span>`
      : '';
  const head = `<div class="val-head">
    <b class="val-tk">${escapeHTML(p.symbol)}</b>
    <span class="val-nm">${escapeHTML(p.name)}</span>
    ${chipHTML}
  </div>`;

  // サイズバー（全レンズ共通）
  const size = `<div class="val-size-wrap">${sizeBarHTML(currentPct, targetPct, conviction)}</div>`;

  // 指標: 総合は PER/PEG/F の等幅チップ、他レンズは従来メトリクス
  const metrics = _lens === 'total' ? totalChipsHTML(val) : line3HTML(val);

  // 判定確度（最下部・全レンズ共通）
  const confLine = confidenceHTML(verdict);

  return `<div class="val-row">${banner}<div class="val-body">${head}${size}${metrics}${confLine}</div></div>`;
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
 * Value タブ下部に常設する用語解説（タップ開閉・CSP安全な native details）。
 * @returns {string}
 */
function glossaryHTML() {
  return `<details class="val-gloss">
    <summary>用語解説</summary>
    <div class="val-gloss-body">
      <p><b>Verdict（正体）</b>：PERの割安/割高の「位置」と利益の「向き」を合成した結論。本物の割安/割高（行動できる）、見せかけ(フェア)＝割安/割高に見えて実態フェア、罠＝割安の罠/一過性益、中立、-（シクリカル＝PER採点外）の7種。</p>
      <p><b>PER 例: 52→38（実績→予想）</b>：左＝実績PER（過去12カ月）、右＝予想PER（来期予想）。右が小さい＝来期利益が増える見込み。向きが最重要シグナル。</p>
      <p><b>PEG</b>：PER ÷ 利益成長率。1未満＝割安寄り、3超＝割高。成長を加味した割高度。</p>
      <p><b>Fスコア（0〜9点・Piotroski）</b>：収益性・財務・効率の9項目を各1点で採点。7〜9＝健全、0〜2＝危険（罠濃厚）。割安が「本物か罠か」の品質点。</p>
      <p><b>判定確度</b>：エンジンのVerdict判定がどれだけ信頼できるか（データ充足＋シグナル一致＋境界余裕）。確信度（自分の自信＝サイズ入力）とは別物。</p>
      <p><b>確信度</b>：自分の主観的な自信。打診/標準/高確信で適正サイズ（%）を決める入力。サイズバーの適正マーカー脇に表示。</p>
    </div>
  </details>`;
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
    // 価格モメンタム（priceMom1Y / pos52w）を履歴から live 補完（null のみ）
    const liveMom = p.ySymbol ? computePriceMomentum(_hist[p.ySymbol]) : null;
    if (liveMom) {
      const m = (val && val.momentum) || {};
      val = {
        ...(val || {}),
        momentum: {
          ...m,
          priceMom1Y: m.priceMom1Y != null ? m.priceMom1Y : liveMom.priceMom1Y,
          pos52w: m.pos52w != null ? m.pos52w : liveMom.pos52w,
        },
      };
    }
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

    return { p, currentPct, targetPct, gap, verdict, val, tkey, trig, conviction };
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
  const rowsHTML = sorted
    .map((r) => rowHTML(r.p, r.currentPct, r.targetPct, r.verdict, r.val, r.trig, r.conviction))
    .join('');

  wrap.innerHTML = `${statsHTML}${lensHTML}<div class="val-list">${rowsHTML}</div>${glossaryHTML()}`;

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
