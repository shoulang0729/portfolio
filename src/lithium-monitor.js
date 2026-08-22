// @ts-check

// ══════════════════════════════════════════════════════════════
// lithium-monitor.js  ―  リチウム市況モニターカード（#611）
//
// REMX保有の前提監視：リチウム市況の回復基調を追跡する。
// 現物スポット（炭酸リチウム）の直接フィードは無いため、
// LIT（Global X Lithium & Battery Tech ETF）と
// ALB（Albemarle・リチウム最大手）をプロキシとして使用する。
//
// 状態バッジ判定（LIT の1ヶ月騰落率を使用）:
//   🟢 回復基調：1m >= -5%（安定・上昇）
//   🟡 中立：    1m >= -15% かつ < -5%（様子見）
//   🔴 崩れ警戒：1m <  -15%（下振れトリガー相当・REMX逆風の兆候）
//
// 既存の fetchLivePrice / fetchSymbolHistory / getHistoricalChangePct を流用する。
// 保有銘柄・ウォッチリストのデータ経路には触れない。
// ══════════════════════════════════════════════════════════════

import { fetchLivePrice, fetchSymbolHistory } from './data.js';
import { getHistoricalChangePct, escapeHTML } from './utils.js';

const PROXIES = [
  { symbol: 'LIT', label: 'LIT', name: 'Global X Lithium & Battery Tech ETF' },
  { symbol: 'ALB', label: 'ALB', name: 'Albemarle（リチウム最大手）' },
];

/** @type {Record<string, {price: number|null, dayPct: number|null}>} */
let _prices = {};
let _fetched = false;

/**
 * LIT/ALB の価格と1年履歴を取得する。
 * 初回のみ取得し、以降はキャッシュを返す。
 * @returns {Promise<void>}
 */
export async function fetchLithiumData() {
  if (_fetched) return;
  _fetched = true;

  await Promise.allSettled(
    PROXIES.map(async (p) => {
      try {
        const live = await fetchLivePrice(p.symbol);
        _prices[p.symbol] = {
          price: live?.price ?? null,
          dayPct: live?.dayPct ?? null,
        };
      } catch {
        _prices[p.symbol] = { price: null, dayPct: null };
      }
      try {
        await fetchSymbolHistory(p.symbol, '1y');
      } catch {}
    })
  );
}

/**
 * 状態バッジの判定（LIT の1ヶ月騰落率を優先。未取得時は中立）
 * @returns {{ cls: string, label: string, desc: string }}
 */
function _badge() {
  const pct1m = getHistoricalChangePct('LIT', '1m');
  if (pct1m == null) {
    return { cls: 'neu', label: '取得中…', desc: '市況データ取得中' };
  }
  if (pct1m >= -5) {
    return { cls: 'good', label: '回復基調', desc: 'リチウム回復継続。REMX保有の前提が維持されています。' };
  }
  if (pct1m >= -15) {
    return { cls: 'ok', label: '中立', desc: '下落傾向。REMX の前提条件を引き続き監視してください。' };
  }
  return { cls: 'warn', label: '崩れ警戒', desc: '下振れトリガー抵触。リチウム供給規律崩れ/需要失速の兆候。REMX のトリム再検討を推奨します。' };
}

/**
 * 騰落率を %表示の文字列にフォーマット
 * @param {number|null} v
 * @returns {string}
 */
function _fmtPct(v) {
  if (v == null || !isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

/**
 * 価格を USD 文字列にフォーマット
 * @param {number|null} v
 * @returns {string}
 */
function _fmtPrice(v) {
  if (v == null || !isFinite(v)) return '—';
  return `$${v.toFixed(2)}`;
}

/**
 * 騰落率の CSS クラス名を返す（pos/neg/neu）
 * @param {number|null} v
 * @returns {string}
 */
function _pctCls(v) {
  if (v == null) return '';
  if (v > 0) return 'lm-pos';
  if (v < 0) return 'lm-neg';
  return '';
}

/**
 * プロキシ1件分の行 HTML を返す
 * @param {{ symbol: string, label: string, name: string }} proxy
 * @returns {string}
 */
function _rowHTML(proxy) {
  const d = _prices[proxy.symbol] || { price: null, dayPct: null };
  const pct1m = getHistoricalChangePct(proxy.symbol, '1m');
  const pct1w = getHistoricalChangePct(proxy.symbol, '1w');
  const dayPct = d.dayPct;
  return `
    <tr>
      <td class="lm-sym">${escapeHTML(proxy.label)}</td>
      <td class="lm-name">${escapeHTML(proxy.name)}</td>
      <td class="lm-val">${escapeHTML(_fmtPrice(d.price))}</td>
      <td class="lm-val ${_pctCls(dayPct)}">${escapeHTML(_fmtPct(dayPct))}</td>
      <td class="lm-val ${_pctCls(pct1w)}">${escapeHTML(_fmtPct(pct1w))}</td>
      <td class="lm-val ${_pctCls(pct1m)}">${escapeHTML(_fmtPct(pct1m))}</td>
    </tr>`;
}

/**
 * リチウム監視カードの HTML を返す
 * @returns {string}
 */
export function lithiumMonitorHTML() {
  const badge = _badge();
  return `
    <div class="lm-card risk-card">
      <div class="card-ttl">
        <span class="tic">
          <svg class="ric" viewBox="0 0 24 24"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 3.9 2.4-7.4L2 9.4h7.6L12 2z"/></svg>
        </span>
        リチウム市況モニター
        <span class="pill ${badge.cls} lm-badge">${escapeHTML(badge.label)}</span>
      </div>
      <p class="lm-rationale">REMX保有の前提＝リチウム回復基調。崩れたら REMX 逆風。</p>
      <p class="lm-alert ${badge.cls === 'warn' ? '' : 'lm-hidden'}">${escapeHTML(badge.desc)}</p>
      <table class="lm-table">
        <thead>
          <tr>
            <th>銘柄</th><th>名称</th><th>価格</th><th>1d</th><th>1w</th><th>1m</th>
          </tr>
        </thead>
        <tbody>
          ${PROXIES.map(_rowHTML).join('')}
        </tbody>
      </table>
      <p class="lm-note">※ 現物スポット（炭酸リチウム）ではなくプロキシ連動。状態はLIT 1ヶ月騰落率で判定（-5%以内=回復、-15%以内=中立、それ以下=崩れ警戒）。</p>
    </div>`;
}
