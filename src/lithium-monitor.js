// @ts-check

// ══════════════════════════════════════════════════════════════
// lithium-monitor.js  ―  リチウム市況モニタカード（#611）
//
// REMX保有の前提となるリチウム回復基調を、取引可能なプロキシ
// （LIT / ALB）で監視する。炭酸リチウム現物スポットへの直接
// フィードがないため、プロキシで代替（UI に明示）。
//
// 状態バッジ判定（相対指標・絶対値キャリブレーション不要）:
//   回復基調 (good): 直近値 > 200日移動平均
//   中立     (ok)  : 直近値 ±5% 以内で 200DMA 付近
//   崩れ警戒 (warn) : 直近値 < 200DMA × 0.95（5%割れ）
//
// 依存: data-yahoo.js (fetchViaProxy), state.js
// ══════════════════════════════════════════════════════════════

import { fetchViaProxy } from './data-yahoo.js';
import { escapeHTML, fmtPct } from './utils.js';

/** リチウムプロキシ銘柄（LIT: 最代表・ALB: リチウム最大手） */
const LITHIUM_PROXIES = [
  { symbol: 'LIT',  name: 'LIT (Global X リチウム&EV ETF)' },
  { symbol: 'ALB',  name: 'ALB (Albemarle Corp)' },
];

/**
 * @typedef {{
 *   symbol: string,
 *   name: string,
 *   price: number|null,
 *   dayPct: number|null,
 *   weekPct: number|null,
 *   monthPct: number|null,
 *   ma200: number|null,
 *   status: 'good'|'ok'|'warn'|'loading'|'error'
 * }} ProxyResult
 */

/**
 * Yahoo Finance から 1y 日足データを取得し、直近価格・期間騰落・200DMA を計算する。
 * @param {string} symbol
 * @returns {Promise<ProxyResult>}
 */
async function _fetchProxyData(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`;
  try {
    const data = await fetchViaProxy(url, 10000, false);
    const result = data?.chart?.result?.[0];
    if (!result) return _errResult(symbol);

    const adjCloses  = result.indicators?.adjclose?.[0]?.adjclose || [];
    const rawCloses  = result.indicators?.quote?.[0]?.close || [];
    const closes     = (adjCloses.length ? adjCloses : rawCloses).map(Number);

    const valid = closes.filter(v => isFinite(v) && v > 0);
    if (valid.length < 2) return _errResult(symbol);

    const price = valid[valid.length - 1];
    const prev1d = valid[valid.length - 2];
    const dayPct = ((price - prev1d) / prev1d) * 100;

    // 1週間 ≈ 5営業日前
    const weekAgo  = valid.length > 5  ? valid[valid.length - 6]  : valid[0];
    const weekPct  = ((price - weekAgo)  / weekAgo)  * 100;

    // 1か月 ≈ 21営業日前
    const monthAgo = valid.length > 21 ? valid[valid.length - 22] : valid[0];
    const monthPct = ((price - monthAgo) / monthAgo) * 100;

    // 200日移動平均（データが足りない場合は直近 n 本平均）
    const n200 = Math.min(200, valid.length);
    const slice = valid.slice(valid.length - n200);
    const ma200 = slice.reduce((s, v) => s + v, 0) / slice.length;

    const status = _calcStatus(price, ma200);

    return { symbol, name: _nameOf(symbol), price, dayPct, weekPct, monthPct, ma200, status };
  } catch {
    return _errResult(symbol);
  }
}

/**
 * 200DMA との乖離で状態を判定する。
 * @param {number} price
 * @param {number} ma200
 * @returns {'good'|'ok'|'warn'}
 */
function _calcStatus(price, ma200) {
  if (!ma200 || ma200 <= 0) return 'ok';
  const ratio = price / ma200;
  if (ratio < 0.95) return 'warn';
  if (ratio > 1.00) return 'good';
  return 'ok';
}

/** @param {string} symbol @returns {ProxyResult} */
function _errResult(symbol) {
  return { symbol, name: _nameOf(symbol), price: null, dayPct: null, weekPct: null, monthPct: null, ma200: null, status: 'error' };
}

/** @param {string} symbol @returns {string} */
function _nameOf(symbol) {
  return LITHIUM_PROXIES.find(p => p.symbol === symbol)?.name ?? symbol;
}

/**
 * 状態バッジの HTML 文字列を返す。
 * @param {'good'|'ok'|'warn'|'loading'|'error'} status
 * @returns {string}
 */
function _badgeHtml(status) {
  if (status === 'good')    return '<span class="pill good lm-badge">回復基調</span>';
  if (status === 'warn')    return '<span class="pill warn lm-badge">崩れ警戒</span>';
  if (status === 'ok')      return '<span class="pill ok   lm-badge">中立</span>';
  if (status === 'loading') return '<span class="pill neu  lm-badge">取得中…</span>';
  return '<span class="pill neu lm-badge">取得失敗</span>';
}

/**
 * 騰落率セルの HTML 文字列。
 * @param {number|null} pct
 * @returns {string}
 */
function _pctHtml(pct) {
  if (pct == null || !isFinite(pct)) return '<span class="lm-pct neu">\u2013</span>';
  const cls = pct > 0 ? 'up' : pct < 0 ? 'down' : 'neu';
  const sign = pct > 0 ? '+' : '';
  return `<span class="lm-pct ${escapeHTML(cls)}">${escapeHTML(`${sign}${fmtPct(pct)}`)}</span>`;
}

/**
 * 総合ステータス（複数プロキシの最悪値）。
 * @param {ProxyResult[]} results
 * @returns {'good'|'ok'|'warn'|'error'}
 */
function _aggregateStatus(results) {
  const statuses = results.map(r => r.status);
  if (statuses.some(s => s === 'loading')) return 'ok';
  if (statuses.every(s => s === 'error')) return 'error';
  if (statuses.some(s => s === 'warn'))  return 'warn';
  if (statuses.some(s => s === 'ok'))    return 'ok';
  return 'good';
}

/**
 * リチウム監視カード DOM 要素を生成して返す（データ非同期取得後に更新）。
 * @returns {HTMLElement}
 */
export function buildLithiumCard() {
  const card = document.createElement('div');
  card.className = 'risk-card lm-card';
  card.setAttribute('aria-label', 'リチウム市況モニタ');
  card.innerHTML = _cardHtml(LITHIUM_PROXIES.map(p => ({
    symbol: p.symbol, name: p.name,
    price: null, dayPct: null, weekPct: null, monthPct: null, ma200: null, status: 'loading',
  })));

  Promise.all(LITHIUM_PROXIES.map(p => _fetchProxyData(p.symbol)))
    .then(results => {
      card.innerHTML = _cardHtml(results);
    })
    .catch(() => {
      const body = card.querySelector('.lm-body');
      if (body) body.innerHTML = '<p class="lm-fetch-err">データ取得に失敗しました。</p>';
    });

  return card;
}

/**
 * カード全体の HTML を生成する。
 * @param {ProxyResult[]} results
 * @returns {string}
 */
function _cardHtml(results) {
  const overall = _aggregateStatus(results);

  let rowsHtml = '';
  for (const r of results) {
    const priceStr = r.price != null ? `$${r.price.toFixed(2)}` : '–';
    const ma200Str = r.ma200 != null ? `$${r.ma200.toFixed(2)}` : '–';
    rowsHtml += `
<tr class="lm-row">
  <td class="lm-sym">${escapeHTML(r.symbol)}</td>
  <td class="lm-price">${escapeHTML(priceStr)}</td>
  <td class="lm-change">${_pctHtml(r.dayPct)}</td>
  <td class="lm-change">${_pctHtml(r.weekPct)}</td>
  <td class="lm-change">${_pctHtml(r.monthPct)}</td>
  <td class="lm-ma">${escapeHTML(ma200Str)}</td>
  <td class="lm-st">${_badgeHtml(r.status)}</td>
</tr>`;
  }

  const warnNote = overall === 'warn'
    ? `<div class="lm-warn-note">
        <svg class="ric ric-sm" aria-hidden="true"><use href="#i-warn"/></svg>
        200日移動平均を5%以上下回っています。REMX の前提（リチウム回復基調）が崩れているサインです。REMX のポジションを再検討してください。
      </div>`
    : '';

  return `
<div class="risk-card-title">
  <svg class="ric" aria-hidden="true"><use href="#i-pulse"/></svg>
  リチウム市況モニタ
  <span class="rtag">${_badgeHtml(overall)}</span>
</div>
<div class="lm-body">
  <p class="lm-purpose">REMX保有の前提＝リチウム回復基調。崩れたら REMX 逆風。</p>
  <div class="lm-table-wrap">
    <table class="lm-table" aria-label="リチウムプロキシ価格テーブル">
      <thead>
        <tr>
          <th>銘柄</th>
          <th>現値</th>
          <th>1日</th>
          <th>1週</th>
          <th>1月</th>
          <th>200DMA</th>
          <th>状態</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
  ${warnNote}
  <p class="lm-proxy-note">※ 炭酸リチウム現物スポット価格ではなく、取引可能なプロキシ連動です（LIT/ALB）。状態判定は 200 日移動平均との乖離率に基づきます。</p>
</div>`;
}
