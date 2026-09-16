// @ts-check

// ══════════════════════════════════════════════════════════════
// lithium-monitor.js  ―  リチウム市況モニタ（#611）
//
// REMX 保有の前提となるリチウム相場を LIT（プロキシ ETF）で監視する。
// 200 日移動平均との乖離で状態バッジ（回復🟢 / 中立🟡 / 崩れ警戒🔴）を表示。
// 現物スポットではなくプロキシ連動である旨を注記。
//
// 依存: data.js（fetchLivePrice / fetchSymbolHistory）, state.js（historicalCache）
// ══════════════════════════════════════════════════════════════

import { fetchLivePrice, fetchSymbolHistory } from './data.js';
import { state } from './state.js';
import { fmtPctInt } from './fmt.js';

/** LIT = Global X Lithium & Battery Tech ETF（リチウム相場の代表プロキシ） */
const LIT_SYMBOL = 'LIT';

/**
 * 200DMA を使った状態バッジ判定。
 * - 200DMA を明確に上回る（+5%超）: 回復基調🟢
 * - -10%以上下回る: 崩れ警戒🔴（下振れトリガー相当）
 * - それ以外: 中立🟡
 *
 * @param {number} currentPrice
 * @param {number} dma200
 * @returns {{ emoji: string, label: string, cls: string }}
 */
function _calcStatus(currentPrice, dma200) {
  const deviation = (currentPrice - dma200) / dma200;
  if (deviation > 0.05) return { emoji: '🟢', label: '回復基調', cls: 'lm-badge lm-badge--green' };
  if (deviation < -0.10) return { emoji: '🔴', label: '崩れ警戒', cls: 'lm-badge lm-badge--red' };
  return { emoji: '🟡', label: '中立', cls: 'lm-badge lm-badge--yellow' };
}

/**
 * historicalCache の 1y データから 200DMA を計算する。
 * データが 200 本未満の場合は先頭から平均を取る。
 * @returns {number|null}
 */
function _calc200DMA() {
  const data = state.historicalCache['1y']?.[LIT_SYMBOL];
  if (!data || data.length < 2) return null;
  const slice = data.slice(-200);
  const sum = slice.reduce((/** @type {number} */ acc, /** @type {{close: number}} */ d) => acc + d.close, 0);
  return sum / slice.length;
}

/**
 * historicalCache から期間騰落率を計算する（1d / 1w / 1m）。
 * @param {'1d'|'1w'|'1m'} period
 * @returns {number|null}
 */
function _calcChangePct(period) {
  const data = state.historicalCache['1y']?.[LIT_SYMBOL];
  if (!data || data.length < 2) return null;
  const last = data[data.length - 1];
  let daysBack;
  if (period === '1d') daysBack = 1;
  else if (period === '1w') daysBack = 7;
  else daysBack = 30;
  const targetMs = last.date.getTime() - daysBack * 86400000;
  let start = data[0];
  for (let i = data.length - 2; i >= 0; i--) {
    if (data[i].date.getTime() <= targetMs) { start = data[i]; break; }
  }
  return ((last.close - start.close) / start.close) * 100;
}

/**
 * リチウム監視カード HTML を生成する。
 * @param {{price: number, dayPct: number|null}|null} live
 * @returns {string}
 */
function _renderCard(live) {
  const price = live ? live.price : null;
  const dayPct = live ? live.dayPct : null;

  const dma200 = _calc200DMA();
  const pct1w  = _calcChangePct('1w');
  const pct1m  = _calcChangePct('1m');

  const fmtPrice = price != null ? `$${price.toFixed(2)}` : '–';
  const fmtDay  = dayPct  != null ? fmtPctInt(dayPct)  : '–';
  const fmt1w   = pct1w   != null ? fmtPctInt(pct1w)   : '–';
  const fmt1m   = pct1m   != null ? fmtPctInt(pct1m)   : '–';
  const fmtDma  = dma200  != null ? `$${dma200.toFixed(2)}` : '–';

  const status = (price != null && dma200 != null)
    ? _calcStatus(price, dma200)
    : { emoji: '–', label: '取得中', cls: 'lm-badge lm-badge--neutral' };

  const dmaDevPct = (price != null && dma200 != null)
    ? fmtPctInt(((price - dma200) / dma200) * 100)
    : '–';

  const isAlert = status.cls.includes('--red');

  return `<div class="lm-card${isAlert ? ' lm-card--alert' : ''}">
  <div class="lm-header">
    <span class="lm-title">リチウム市況モニタ</span>
    <span class="${status.cls}">${status.emoji} ${status.label}</span>
  </div>
  <div class="lm-desc">REMX 保有の前提＝リチウム回復。崩れたら REMX 逆風。</div>
  <div class="lm-metrics">
    <div class="lm-metric">
      <span class="lm-metric-label">LIT 現値</span>
      <span class="lm-metric-value">${fmtPrice}</span>
    </div>
    <div class="lm-metric">
      <span class="lm-metric-label">1D</span>
      <span class="lm-metric-value lm-pct${dayPct != null && dayPct >= 0 ? ' pos' : ' neg'}">${fmtDay}</span>
    </div>
    <div class="lm-metric">
      <span class="lm-metric-label">1W</span>
      <span class="lm-metric-value lm-pct${pct1w != null && pct1w >= 0 ? ' pos' : ' neg'}">${fmt1w}</span>
    </div>
    <div class="lm-metric">
      <span class="lm-metric-label">1M</span>
      <span class="lm-metric-value lm-pct${pct1m != null && pct1m >= 0 ? ' pos' : ' neg'}">${fmt1m}</span>
    </div>
    <div class="lm-metric">
      <span class="lm-metric-label">200DMA</span>
      <span class="lm-metric-value">${fmtDma}</span>
    </div>
    <div class="lm-metric">
      <span class="lm-metric-label">vs 200DMA</span>
      <span class="lm-metric-value lm-pct${dmaDevPct !== '–' && !dmaDevPct.startsWith('-') ? ' pos' : ' neg'}">${dmaDevPct}</span>
    </div>
  </div>
  ${isAlert ? `<div class="lm-alert-msg">🔴 200日移動平均を10%超下回っています。REMX 逆風シナリオを要検討。</div>` : ''}
  <div class="lm-note">※ LIT（Global X Lithium ETF）プロキシ連動。現物炭酸リチウムスポット価格ではありません。</div>
</div>`;
}

/**
 * リチウム監視カードを指定コンテナに描画する。
 * データ取得後に再描画する（2段階）。
 * @param {HTMLElement} container
 */
export async function renderLithiumMonitor(container) {
  container.innerHTML = _renderCard(null);

  const [liveResult] = await Promise.allSettled([
    fetchLivePrice(LIT_SYMBOL),
    fetchSymbolHistory(LIT_SYMBOL, '1y'),
  ]);

  const live = liveResult.status === 'fulfilled' && liveResult.value && !('_err' in liveResult.value)
    ? /** @type {{price:number,dayPct:number|null}} */ (liveResult.value)
    : null;

  container.innerHTML = _renderCard(live);
}
