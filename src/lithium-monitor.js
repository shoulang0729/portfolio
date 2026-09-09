// @ts-check

// ══════════════════════════════════════════════════════════════
// lithium-monitor.js  ―  リチウム市況モニタカード（#611）
//
// REMX保有の前提条件（リチウム回復基調）を継続監視する。
// プロキシ: LIT（Global X Lithium & Battery Tech ETF）+ ALB（Albemarle）
// 状態バッジ: 回復基調🟢 / 中立🟡 / 崩れ警戒🔴
// トリガー: LIT が 200日移動平均を明確に下抜け → 🔴
//
// 依存: data-finnhub.js (fetchFinnhubQuote) / historical-cache.js / state.js
// ══════════════════════════════════════════════════════════════

import { fetchFinnhubQuote } from './data-finnhub.js';
import { state } from './state.js';
import { escapeHTML } from './fmt.js';

const PROXIES = [
  { symbol: 'LIT', name: 'LIT ETF', desc: 'Global X Lithium & Battery Tech ETF' },
  { symbol: 'ALB', name: 'ALB',     desc: 'Albemarle（リチウム最大手）' },
];

/**
 * LIT の historicalCache（1y）から 200 日移動平均を計算する。
 * データが足りない場合は null を返す。
 * @param {string} symbol
 * @returns {number|null}
 */
function _calc200DMA(symbol) {
  const data = state.historicalCache['1y']?.[symbol];
  if (!data || data.length < 30) return null;
  const slice = data.slice(-200);
  const sum = slice.reduce((s, d) => s + d.close, 0);
  return sum / slice.length;
}

/**
 * 状態バッジを判定する。
 * LIT の現在価格と 200DMA を比較して判定（ALB は参考値として表示）。
 * - 現在価格 > 200DMA × 1.02 → 🟢 回復基調
 * - 現在価格 < 200DMA × 0.97 → 🔴 崩れ警戒
 * - それ以外 → 🟡 中立
 * @param {number|null} price  LIT の現在価格
 * @param {number|null} dma200 LIT の 200DMA
 * @returns {{ emoji: string, label: string, cls: string, desc: string }}
 */
function _getStatus(price, dma200) {
  if (price == null || dma200 == null) {
    return { emoji: '⬜', label: 'データ取得中', cls: 'lm-status-neutral', desc: 'リチウム市況データを取得中です。' };
  }
  const ratio = price / dma200;
  if (ratio > 1.02) {
    return {
      emoji: '🟢',
      label: '回復基調',
      cls: 'lm-status-ok',
      desc: 'LIT が 200DMA を上回っています。REMX の前提（リチウム回復）は維持されています。',
    };
  }
  if (ratio < 0.97) {
    return {
      emoji: '🔴',
      label: '崩れ警戒',
      cls: 'lm-status-warn',
      desc: '⚠️ LIT が 200DMA を明確に下抜けています。リチウム相場の下振れ兆候＝REMX の逆風化リスク。REMX のトリム検討を。',
    };
  }
  return {
    emoji: '🟡',
    label: '中立',
    cls: 'lm-status-neutral',
    desc: 'LIT は 200DMA 近辺で推移中。方向感を確認中。',
  };
}

/**
 * 騰落率を文字列にフォーマットする。
 * @param {number|null|undefined} pct
 * @returns {string}
 */
function _fmtPct(pct) {
  if (pct == null) return '–';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

/**
 * リチウム監視カード HTML を生成して container に挿入する。
 * @param {HTMLElement} container
 * @returns {Promise<void>}
 */
export async function renderLithiumMonitor(container) {
  const card = document.createElement('div');
  card.className = 'lm-card';
  card.id = 'lithium-monitor-card';

  card.innerHTML = `
    <div class="lm-header">
      <span class="lm-title">⚗️ リチウム市況モニタ</span>
      <span class="lm-badge lm-status-neutral">読み込み中…</span>
    </div>
    <div class="lm-purpose">REMX保有の前提＝リチウム回復基調。崩れたら REMX 逆風のサイン。</div>
    <div class="lm-rows" id="lm-rows">
      <div class="lm-loading">価格取得中…</div>
    </div>
    <div class="lm-desc" id="lm-desc">–</div>
    <div class="lm-proxy-note">※プロキシ連動（現物スポット価格ではなく ETF/株価で代替）</div>
  `;
  container.appendChild(card);

  const badgeEl = card.querySelector('.lm-badge');
  const rowsEl = card.querySelector('#lm-rows');
  const descEl = card.querySelector('#lm-desc');

  const results = await Promise.allSettled(
    PROXIES.map(async (p) => {
      const q = await fetchFinnhubQuote(p.symbol);
      if (!q || '_err' in q) return { ...p, price: null, dayPct: null };
      return { ...p, price: q.price, dayPct: q.dayPct };
    })
  );

  const priceData = results.map((r) => (r.status === 'fulfilled' ? r.value : { ...PROXIES[0], price: null, dayPct: null }));
  const lit = priceData.find((d) => d.symbol === 'LIT') || null;
  const dma200 = _calc200DMA('LIT');
  const status = _getStatus(lit?.price ?? null, dma200);

  if (badgeEl) {
    badgeEl.textContent = `${status.emoji} ${status.label}`;
    badgeEl.className = `lm-badge ${status.cls}`;
  }
  if (descEl) descEl.textContent = status.desc;

  if (rowsEl) {
    rowsEl.innerHTML = priceData.map((d) => {
      const pctCls = d.dayPct == null ? '' : d.dayPct >= 0 ? 'lm-pos' : 'lm-neg';
      const priceStr = d.price != null ? `$${d.price.toFixed(2)}` : '–';
      const pctStr = _fmtPct(d.dayPct);
      const dma = d.symbol === 'LIT' ? dma200 : null;
      const dmaStr = dma != null ? `200DMA: $${dma.toFixed(2)}` : '';
      return `<div class="lm-row">
        <span class="lm-sym">${escapeHTML(d.symbol)}</span>
        <span class="lm-sym-desc">${escapeHTML(d.desc)}</span>
        <span class="lm-price">${escapeHTML(priceStr)}</span>
        <span class="lm-pct ${pctCls}">${escapeHTML(pctStr)}</span>
        ${dmaStr ? `<span class="lm-dma">${escapeHTML(dmaStr)}</span>` : ''}
      </div>`;
    }).join('');
  }
}
