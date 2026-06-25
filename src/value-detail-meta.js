// @ts-check

// ══════════════════════════════════════════════════════════════
// value-detail-meta.js ―― Value タブ詳細指標「目安ゲージ行」の正本データ（#475 rev2）
//
// 付録「指標メタ表」を定数化。detailHTML はこれを回して 1指標=1行のゲージ行を作る。
// 判定バッジ・gauge 位置・キャプション・グループ（3つの問い）を一元管理する。
//   静的しきい値系: min/max/good/tick + judge(値→トーン)。
//   ライブ相対系  : live:true（PER/%タイル=自分の過去バンド、ROIC=vs WACC、対市場=対ACWI 等）。
// 算出ロジック（computeVerdict 等）には触れず、表示用の閾値のみここに集約する。
// ══════════════════════════════════════════════════════════════

import { impliedGrowth, isGrowthOverheated } from './reverse-dcf.js';

/** トーン → 既定グリフ／ラベル（色覚配慮でグリフ併記）。 */
const J = {
  good: { tone: 'good', glyph: '◎', label: '良い' },
  ok: { tone: 'ok', glyph: '○', label: '標準' },
  warn: { tone: 'warn', glyph: '△', label: '注意' },
  bad: { tone: 'warn', glyph: '⚠', label: '危険' }, // 色は warn 系・グリフで強調
  neu: { tone: 'neu', glyph: '・', label: '文脈次第' },
};

/** 有限数値か。 */
function num(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

/** 小数1桁（null は '—'）。 */
function fmt1(n) {
  return num(n) ? n.toFixed(1) : '—';
}

/** 値表示（小数1桁・既存 fmtRaw と同等）。 */
function fmtRaw(n) {
  return num(n) ? n.toFixed(1) : '—';
}

// ── 各指標のメタ（付録表）。group: 1=割安か / 2=稼ぐか / 3=期待・勢い ──
/**
 * @typedef {{
 *   key:string, label:string, group:1|2|3, cap:string,
 *   read:(val:any)=>number|null, display:(val:any)=>string,
 *   min:number|((val:any)=>number), max:number|((val:any)=>number),
 *   good?:(val:any)=>[number,number]|null, tick?:(val:any)=>number|null,
 *   judge?:(val:any)=>{tone:string,glyph:string,label:string}|null,
 *   live?:boolean, liveTag?:string,
 * }} MetricMeta
 */

const V = (val) => (val && val.value) || {};
const Q = (val) => (val && val.quality) || {};
const M = (val) => (val && val.momentum) || {};

/** @type {MetricMeta[]} */
export const VALUE_DETAIL_META = [
  // ── ① 価格は割安か？ ──
  {
    key: 'per',
    label: 'PER',
    group: 1,
    cap: '自分の過去PERバンドでの位置。左＝割安。',
    read: (val) => (num(V(val).perTrail) ? V(val).perTrail : null),
    display: (val) => `${fmtRaw(V(val).perTrail)}→${fmtRaw(V(val).perFwd)}`,
    min: (val) => (num(val.bandLow) ? val.bandLow : 0),
    max: (val) => (num(val.bandHigh) ? val.bandHigh : (num(V(val).perTrail) ? V(val).perTrail * 2 : 1)),
    good: (val) => [num(val.bandLow) ? val.bandLow : 0, num(val.bandMedian) ? val.bandMedian : (num(V(val).perTrail) ? V(val).perTrail : 1)],
    tick: (val) => (num(val.bandMedian) ? val.bandMedian : null),
    live: true,
    liveTag: '過去比',
    judge: (val) => {
      const p = val.percentile;
      if (!num(p)) return null;
      return p < 40 ? J.good : p <= 70 ? J.ok : J.warn;
    },
  },
  {
    key: 'peg',
    label: 'PEG',
    group: 1,
    cap: '成長を加味した割高度。1未満で割安寄り。',
    read: (val) => (num(V(val).peg) ? V(val).peg : null),
    display: (val) => fmtRaw(V(val).peg),
    min: 0,
    max: 3,
    good: () => [0, 1],
    tick: () => 1,
    judge: (val) => {
      const x = V(val).peg;
      return x < 1 ? J.good : x <= 2 ? J.ok : J.warn;
    },
  },
  {
    key: 'evEbitda',
    label: 'EV/EBITDA',
    group: 1,
    cap: '借金込みで会社を丸ごと買うと本業利益の何年分。低い＝割安。',
    read: (val) => (num(V(val).evEbitda) ? V(val).evEbitda : null),
    display: (val) => `${fmtRaw(V(val).evEbitda)}x`,
    min: 0,
    max: 20,
    good: () => [0, 8],
    tick: () => 15,
    judge: (val) => {
      const x = V(val).evEbitda;
      return x < 8 ? J.good : x <= 15 ? J.ok : J.warn;
    },
  },
  {
    key: 'percentile',
    label: '%タイル',
    group: 1,
    cap: '自分の過去バンドで今が何%の位置か。低い＝割安。',
    read: (val) => (num(val.percentile) ? val.percentile : null),
    display: (val) => `${Math.round(val.percentile)}%ile`,
    min: 0,
    max: 100,
    good: () => [0, 40],
    tick: () => 50,
    live: true,
    liveTag: '過去比',
    judge: (val) => {
      const p = val.percentile;
      return p < 40 ? J.good : p <= 70 ? J.ok : J.warn;
    },
  },

  // ── ② ちゃんと稼ぐか・株主に返すか？ ──
  {
    key: 'fcfYield',
    label: 'FCF利回り',
    group: 2,
    cap: '時価総額に対する現金創出力。4%超で妙味。',
    read: (val) => (num(V(val).fcfYield) ? V(val).fcfYield : null),
    display: (val) => `${fmtRaw(V(val).fcfYield)}%`,
    min: 0,
    max: 10,
    good: () => [4, 10],
    tick: () => 4,
    judge: (val) => {
      const x = V(val).fcfYield;
      return x > 4 ? J.good : x >= 2 ? J.ok : J.warn;
    },
  },
  {
    key: 'shareholderYield',
    label: '株主還元',
    group: 2,
    cap: '配当＋自社株買いの利回り。3%超で手厚い。',
    read: (val) => (num(V(val).shareholderYield) ? V(val).shareholderYield : null),
    display: (val) => `${fmtRaw(V(val).shareholderYield)}%`,
    min: 0,
    max: 8,
    good: () => [3, 8],
    tick: () => 3,
    judge: (val) => {
      const x = V(val).shareholderYield;
      return x > 3 ? J.good : x >= 1 ? J.ok : J.warn;
    },
  },
  {
    key: 'fcfConversion',
    label: 'FCF変換',
    group: 2,
    cap: '帳簿利益が現金にどれだけ化けるか。1.0近辺以上が健全。',
    read: (val) => (num(Q(val).fcfConv) ? Q(val).fcfConv : null),
    display: (val) => fmtRaw(Q(val).fcfConv),
    min: 0,
    max: 2,
    good: () => [0.9, 2],
    tick: () => 1,
    judge: (val) => {
      const x = Q(val).fcfConv;
      return x > 0.9 ? J.good : x >= 0.6 ? J.ok : J.warn;
    },
  },
  {
    key: 'roic',
    label: 'ROIC',
    group: 2,
    cap: '投下資本の稼ぐ利率がWACCを超えるか。超え＝価値創造。',
    read: (val) => (num(Q(val).roic) ? Q(val).roic : null),
    display: (val) => {
      const r = Q(val).roic;
      const w = Q(val).wacc;
      const s = `${fmtRaw(r)}% vs WACC ${fmtRaw(w)}%`;
      return num(r) && num(w) && r < w ? `<span class="val-bad">${s} ⚠下回り</span>` : s;
    },
    min: 0,
    max: 25,
    good: (val) => (num(Q(val).wacc) ? [Q(val).wacc, 25] : null),
    tick: (val) => (num(Q(val).wacc) ? Q(val).wacc : null),
    live: true,
    liveTag: 'vs WACC',
    judge: (val) => {
      const r = Q(val).roic;
      const w = Q(val).wacc;
      if (!num(w)) return null;
      const d = r - w;
      return d >= 1 ? J.good : d > -1 ? J.ok : J.bad;
    },
  },
  {
    key: 'grossProfitability',
    label: '粗利/資産',
    group: 2,
    cap: '資産規模に対する粗利。質の高い割安株の指標。',
    read: (val) => (num(Q(val).grossProf) ? Q(val).grossProf : null),
    display: (val) => fmtRaw(Q(val).grossProf),
    min: 0,
    max: 1,
    good: () => [0.33, 1],
    tick: () => 0.33,
    judge: (val) => {
      const x = Q(val).grossProf;
      return x > 0.33 ? J.good : x >= 0.2 ? J.ok : J.warn;
    },
  },
  {
    key: 'altmanZ',
    label: 'Altman Z',
    group: 2,
    cap: '倒産の起きにくさ。3超で安全圏、1.8未満で危険。',
    read: (val) => (num(Q(val).altmanZ) ? Q(val).altmanZ : null),
    display: (val) => {
      const z = Q(val).altmanZ;
      const s = fmtRaw(z);
      return num(z) && z < 3 ? `<span class="val-warn">${s} ⚠&lt;3</span>` : s;
    },
    min: 0,
    max: 8,
    good: () => [3, 8],
    tick: () => 3,
    judge: (val) => {
      const z = Q(val).altmanZ;
      return z >= 3 ? J.good : z >= 1.8 ? J.ok : J.bad;
    },
  },
  {
    key: 'fScore',
    label: 'F/Qスコア',
    group: 2,
    cap: '収益性・財務・効率の健全度（0〜9）。7以上が健全。',
    read: (val) => (num(Q(val).fScore) ? Q(val).fScore : null),
    display: (val) => fmtRaw(Q(val).fScore),
    min: 0,
    max: 9,
    good: () => [7, 9],
    tick: () => 5,
    judge: (val) => {
      const f = Q(val).fScore;
      return f >= 7 ? J.good : f >= 5 ? J.ok : J.warn;
    },
  },

  // ── ③ 市場の期待・勢いは？ ──
  {
    key: 'impliedGrowth',
    label: '織込成長',
    group: 3,
    cap: '今の株価が前提にする長期FCF成長率。7%超で期待過多。',
    read: (val) => {
      if (V(val).cyclical === true) return null; // シクリカルは行を出さない（既存挙動）
      const ig = impliedGrowth(V(val).fcfYield, num(Q(val).wacc) ? Q(val).wacc : null);
      return num(ig) ? ig : null;
    },
    display: (val) => {
      const ig = impliedGrowth(V(val).fcfYield, num(Q(val).wacc) ? Q(val).wacc : null);
      const txt = `${fmt1(ig)}%${isGrowthOverheated(ig) ? ' ⚠期待過多' : ''}`;
      return isGrowthOverheated(ig) ? `<span class="val-warn">${txt}</span>` : txt;
    },
    min: 0,
    max: 15,
    good: () => [0, 7],
    tick: () => 7,
    judge: (val) => {
      const ig = impliedGrowth(V(val).fcfYield, num(Q(val).wacc) ? Q(val).wacc : null);
      return isGrowthOverheated(ig) ? J.warn : J.ok;
    },
  },
  {
    key: 'targetGap',
    label: '目標乖離',
    group: 3,
    cap: 'アナリスト平均目標株価との差。＋＝上値余地。',
    read: (val) => (num(V(val).targetGapPct) ? V(val).targetGapPct : null),
    display: (val) => {
      const tg = V(val).targetGapPct;
      const txt = `${tg >= 0 ? '+' : ''}${fmt1(tg)}%`;
      return `<span class="${tg >= 0 ? 'val-mom-up' : 'val-mom-dn'}">${txt}</span>`;
    },
    min: -30,
    max: 50,
    good: () => [0, 50],
    tick: () => 0,
    live: true,
    liveTag: '対目標',
    judge: (val) => (V(val).targetGapPct > 0 ? J.good : J.warn),
  },
  {
    key: 'epsRev90d',
    label: '改定90d',
    group: 3,
    cap: '直近90日のEPS予想改定。＋＝上方修正。',
    read: (val) => (num(M(val).epsRev90d) ? M(val).epsRev90d : null),
    display: (val) => `${fmtRaw(M(val).epsRev90d)}%`,
    min: -10,
    max: 10,
    good: () => [0, 10],
    tick: () => 0,
    judge: (val) => (M(val).epsRev90d > 0 ? J.good : J.warn),
  },
  {
    key: 'priceMom1Y',
    label: '1Y騰落',
    group: 3,
    cap: '直近1年の値上がり率。',
    read: (val) => (num(M(val).priceMom1Y) ? M(val).priceMom1Y : null),
    display: (val) => {
      const x = M(val).priceMom1Y;
      const txt = `${x >= 0 ? '+' : ''}${fmt1(x)}%`;
      return `<span class="${x >= 0 ? 'val-mom-up' : 'val-mom-dn'}">${txt}</span>`;
    },
    min: -40,
    max: 40,
    tick: () => 0,
    judge: () => null, // 判定なし（文脈次第）
  },
  {
    key: 'pos52w',
    label: '52週位置',
    group: 3,
    cap: '52週レンジ内の位置。0＝安値・100＝高値。',
    read: (val) => (num(M(val).pos52w) ? M(val).pos52w : null),
    display: (val) => `${fmtRaw(M(val).pos52w)}%`,
    min: 0,
    max: 100,
    tick: () => 50,
    judge: (val) => (M(val).pos52w > 85 ? J.warn : J.neu),
  },
  {
    key: 'rsVsSector',
    label: '対市場',
    group: 3,
    cap: '世界株ACWIとの相対強さ。＋＝市場に勝っている。',
    read: (val) => (num(M(val).rsVsSector) ? M(val).rsVsSector : null),
    display: (val) => `${fmtRaw(M(val).rsVsSector)}%`,
    min: -20,
    max: 20,
    good: () => [0, 20],
    tick: () => 0,
    live: true,
    liveTag: '対ACWI',
    judge: (val) => (M(val).rsVsSector > 0 ? J.good : J.warn),
  },
];

/** 3つの問いの見出し＋1行キャプション。 */
export const VALUE_DETAIL_GROUPS = {
  1: { label: '① 価格は割安か？', cap: '安く買えているか' },
  2: { label: '② ちゃんと稼ぐか・株主に返すか？', cap: '稼ぐ力・還元・利益の質' },
  3: { label: '③ 市場の期待・勢いは？', cap: '期待の高さ・モメンタム・市場対比' },
};

/** clamp 0..100。 */
function clamp01(x) {
  return Math.max(0, Math.min(100, x));
}

/**
 * メタ＋val から gauge 描画値を算出する。データ欠損は null（行を出さない）。
 * @param {MetricMeta} meta
 * @param {any} val
 * @returns {{valueHTML:string, pos:number, zone:[number,number]|null, tick:number|null, peer:number|null, tone:string, judge:{glyph:string,label:string}|null} | null}
 */
export function computeMetric(meta, val) {
  const v = meta.read(val);
  if (!num(v)) return null;
  const min = typeof meta.min === 'function' ? meta.min(val) : meta.min;
  const max = typeof meta.max === 'function' ? meta.max(val) : meta.max;
  if (!num(min) || !num(max) || !(max > min)) return null;
  const axis = (x) => clamp01(((x - min) / (max - min)) * 100);
  const pos = axis(v);
  const g = meta.good ? meta.good(val) : null;
  const zone = g && num(g[0]) && num(g[1]) ? [axis(g[0]), axis(g[1])] : null;
  const tv = meta.tick ? meta.tick(val) : null;
  const tick = num(tv) ? axis(tv) : null;
  const j = meta.judge ? meta.judge(val) : null;
  return { valueHTML: meta.display(val), pos, zone, tick, peer: null, tone: j ? j.tone : 'neu', judge: j };
}
