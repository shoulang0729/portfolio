// @ts-check
// ══════════════════════════════════════════════════════════════
// lithium-monitor.js  ―  リチウム市況モニタカード（#611）
//
// REMX保有の前提条件として「リチウム回復基調の継続」を監視する。
// 直接の炭酸リチウム現物スポットは取得不可のため、ETFプロキシで代替:
//   LIT (Global X Lithium & Battery Tech ETF) ＝主プロキシ
//   ALB (Albemarle) ＝副プロキシ
//
// 状態バッジ:
//   🟢 回復基調 … 現値 > 200DMA（10%以上）
//   🟡 中立     … 現値 ≒ 200DMA（±10%以内）
//   🔴 崩れ警戒 … 現値 < 200DMA（10%以上下回る）
//
// 依存: state.js / data-finnhub.js / portfolio-calc.js
// ══════════════════════════════════════════════════════════════

import { state } from './state.js';
import { fetchFinnhubQuote } from './data-finnhub.js';
import { getHistoricalChangePct } from './portfolio-calc.js';

/** 監視プロキシ定義 */
const PROXIES = [
  { symbol: 'LIT', label: 'LIT (Global X Lithium ETF)', primary: true },
  { symbol: 'ALB', label: 'ALB (Albemarle)', primary: false },
];

/** ライブ価格キャッシュ（取得済みデータを再利用） */
const _priceCache = {};

/**
 * 200日移動平均を historicalCache から算出する
 * @param {string} symbol
 * @returns {number|null}
 */
function _calc200DMA(symbol) {
  const data = state.historicalCache['1y']?.[symbol];
  if (!data || data.length < 40) return null;
  const recent = data.slice(-200);
  const sum = recent.reduce((a, e) => a + e.close, 0);
  return sum / recent.length;
}

/**
 * 200DMA との乖離率から状態バッジを返す
 * @param {number} price
 * @param {number|null} dma200
 * @returns {{ emoji: string, label: string, cls: string }}
 */
function _getStatus(price, dma200) {
  if (dma200 == null || price <= 0) {
    return { emoji: '⚪', label: 'データ不足', cls: 'lm-badge-neu' };
  }
  const pct = ((price - dma200) / dma200) * 100;
  if (pct >= 10) return { emoji: '🟢', label: '回復基調', cls: 'lm-badge-good' };
  if (pct <= -10) return { emoji: '🔴', label: '崩れ警戒', cls: 'lm-badge-warn' };
  return { emoji: '🟡', label: '中立', cls: 'lm-badge-neu' };
}

/**
 * 騰落率セル HTML を生成する
 * @param {number|null} pct
 * @returns {string}
 */
function _pctHtml(pct) {
  if (pct == null) return '<span class="lm-na">—</span>';
  const sign = pct >= 0 ? '+' : '';
  const cls = pct >= 0 ? 'lm-pos' : 'lm-neg';
  return `<span class="${cls}">${sign}${pct.toFixed(1)}%</span>`;
}

/**
 * リチウムモニタカード HTML を生成する
 * @param {Array<{symbol: string, label: string, primary: boolean, price: number|null, dayPct: number|null, wkPct: number|null, moPct: number|null, dma200: number|null}>} rows
 * @returns {string}
 */
function _buildCardHtml(rows) {
  const primaryRow = rows.find(r => r.primary);
  const status = primaryRow
    ? _getStatus(primaryRow.price ?? 0, primaryRow.dma200)
    : { emoji: '⚪', label: 'データ不足', cls: 'lm-badge-neu' };

  const dma200txt = primaryRow?.dma200 != null
    ? `(200DMA: $${primaryRow.dma200.toFixed(2)})`
    : '';

  const rowsHtml = rows.map(r => {
    const priceStr = r.price != null ? `$${r.price.toFixed(2)}` : '—';
    return `<tr>
      <td class="lm-name">${r.label}</td>
      <td class="lm-val">${priceStr}</td>
      <td class="lm-val">${_pctHtml(r.dayPct)}</td>
      <td class="lm-val">${_pctHtml(r.wkPct)}</td>
      <td class="lm-val">${_pctHtml(r.moPct)}</td>
    </tr>`;
  }).join('');

  return `<div class="lm-card">
  <div class="lm-header">
    <span class="lm-title">リチウム市況モニタ</span>
    <span class="lm-badge ${status.cls}">${status.emoji} ${status.label} ${dma200txt}</span>
  </div>
  <div class="lm-note">REMX保有の前提＝リチウム回復。崩れたら REMX 逆風。</div>
  <table class="lm-table">
    <thead><tr>
      <th class="lm-th-name">プロキシ</th>
      <th class="lm-th-val">現値</th>
      <th class="lm-th-val">1d</th>
      <th class="lm-th-val">1w</th>
      <th class="lm-th-val">1m</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="lm-proxy-note">※ 現物炭酸リチウムスポットではなく取引所ETF/株のプロキシ連動</div>
</div>`;
}

/**
 * リチウムモニタカードを描画する
 * @param {HTMLElement} container - カードを挿入するコンテナ要素
 * @returns {Promise<void>}
 */
export async function renderLithiumMonitor(container) {
  const placeholder = document.createElement('div');
  placeholder.className = 'lm-loading';
  placeholder.textContent = 'リチウム市況を取得中…';
  container.prepend(placeholder);

  try {
    const rows = await Promise.all(
      PROXIES.map(async proxy => {
        let price = null;
        let dayPct = null;

        if (_priceCache[proxy.symbol]) {
          price = _priceCache[proxy.symbol].price;
          dayPct = _priceCache[proxy.symbol].dayPct;
        } else {
          const q = await fetchFinnhubQuote(proxy.symbol);
          if (q && !q._err) {
            price = q.price;
            dayPct = q.dayPct;
            _priceCache[proxy.symbol] = { price, dayPct };
          }
        }

        const wkPct = getHistoricalChangePct(proxy.symbol, '1w');
        const moPct = getHistoricalChangePct(proxy.symbol, '1m');
        const dma200 = _calc200DMA(proxy.symbol);

        return { ...proxy, price, dayPct, wkPct, moPct, dma200 };
      })
    );

    placeholder.outerHTML = _buildCardHtml(rows);
  } catch {
    placeholder.className = 'lm-loading lm-err';
    placeholder.textContent = 'リチウム市況の取得に失敗しました。';
  }
}

/**
 * リチウムモニタカードを強制再描画する（refreshボタン用）
 * @param {HTMLElement} container
 * @returns {Promise<void>}
 */
export async function reloadLithiumMonitor(container) {
  Object.keys(_priceCache).forEach(k => delete _priceCache[k]);
  const existing = container.querySelector('.lm-card, .lm-loading');
  if (existing) existing.remove();
  await renderLithiumMonitor(container);
}
