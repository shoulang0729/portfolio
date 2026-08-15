// @ts-check

// ══════════════════════════════════════════════════════════════
// briefing.js  ―  週次 Briefing タブ
//
// data/briefings/index.json を読み、最新号を iframe で表示する。
// iframe は画面の残り高さにフィットさせ「枠内1スクロール」化（本体HTMLが
// ヘッダ/セクション見出しを sticky 固定）。過去号は下部のプルダウンで切替。
// 「今すぐ生成」リンクは本体HTMLの固定ヘッダ内に移動済み（self-contained）。
// 中身は自己完結のモバイルHTML（MulmoClaude の週次タスクが生成・コミットする）。
// ══════════════════════════════════════════════════════════════

import { fetchLivePrice, fetchSymbolHistory } from './data.js';
import { state } from './state.js';
import { fmtPctInt } from './fmt.js';

// ── リチウム監視カード設定 ──
const LIT_SYMBOL = 'LIT';
const ALB_SYMBOL = 'ALB';
// 200DMA を下回る乖離率のしきい値（%）: -10%以上乖離 → 警戒
const LIT_WARN_DMA_PCT = -10;
// 200DMA を上回る乖離率のしきい値（%）: +0%以上 → 回復基調
const LIT_OK_DMA_PCT = 0;

let _loaded = false;
/** @type {HTMLIFrameElement|null} */
let _frame = null;
let _themeObserver = null;
let _resizeFit = false;

/**
 * アプリの現在テーマを iframe 内ドキュメントに伝搬する。
 * 'light'/'dark' は data-theme で明示、'auto' は属性を外して prefers-color-scheme に委ねる。
 */
function _syncFrameTheme() {
  if (!_frame) return;
  try {
    const t = document.documentElement.getAttribute('data-theme');
    const idoc = _frame.contentDocument?.documentElement;
    if (!idoc) return;
    if (t === 'light' || t === 'dark') idoc.setAttribute('data-theme', t);
    else idoc.removeAttribute('data-theme');
  } catch {
    /* cross-origin 等は無視 */
  }
}

/**
 * #538: 生成 HTML のトレンド表（table.mkt）は中列「直近の読み」に長文が入るのに
 * td が white-space:nowrap のため、隣の「バイアス」列バッジと重なって見切れる。
 * CSS は各号に焼き込まれ・将来号もクラウド（MulmoClaude）が生成するため、アプリ側で
 * iframe に補正スタイルを注入して過去号・将来号を一括で救済する。数値のみのマクロ表
 * セルはスペースが無く折り返されない＝無害。
 */
function _injectBriefingFixups() {
  if (!_frame) return;
  try {
    const idoc = _frame.contentDocument;
    const head = idoc?.head;
    if (!head || idoc.getElementById('bf-fixup')) return;
    const style = idoc.createElement('style');
    style.id = 'bf-fixup';
    style.textContent = 'table.mkt td{white-space:normal;vertical-align:top;}';
    head.appendChild(style);
  } catch {
    /* cross-origin 等は無視 */
  }
}

/** 親アプリの data-theme 変化を監視して iframe に伝搬（一度だけ設置） */
function _ensureThemeObserver() {
  if (_themeObserver) return;
  _themeObserver = new MutationObserver(_syncFrameTheme);
  _themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

/** iframe を「タブ下〜過去号バー上」の残り高さにフィットさせる（枠内1スクロール化） */
function _fitFrame() {
  if (!_frame) return;
  const top = _frame.getBoundingClientRect().top;
  const bar = _frame.parentElement?.querySelector('.bf-pastbar');
  const barH = bar instanceof HTMLElement ? bar.offsetHeight : 0;
  const h = Math.max(360, Math.round(window.innerHeight - top - barH));
  _frame.style.height = `${h}px`;
}

/** リサイズ時の再フィット（一度だけ設置） */
function _ensureResizeFit() {
  if (_resizeFit) return;
  _resizeFit = true;
  window.addEventListener('resize', _fitFrame);
}

/**
 * historicalCache から直近 N 日間の騰落率を計算する（1y キャッシュを使用）
 * @param {string} symbol
 * @param {number} days
 * @returns {number|null}
 */
function _calcChangePct(symbol, days) {
  const data = state.historicalCache['1y']?.[symbol];
  if (!data || data.length < 2) return null;
  const last = data[data.length - 1];
  if (!last || !last.close) return null;
  const idx = Math.max(0, data.length - 1 - days);
  const base = data[idx];
  if (!base || !base.close || base.close <= 0) return null;
  return ((last.close - base.close) / base.close) * 100;
}

/**
 * 200日移動平均を計算して現在値との乖離率（%）を返す
 * @param {string} symbol
 * @returns {number|null}
 */
function _calc200DmaDeviation(symbol) {
  const data = state.historicalCache['1y']?.[symbol];
  if (!data || data.length < 2) return null;
  const dmaWindow = Math.min(200, data.length);
  const slice = data.slice(data.length - dmaWindow);
  const avg = slice.reduce((s, e) => s + e.close, 0) / slice.length;
  if (avg <= 0) return null;
  const last = data[data.length - 1].close;
  return ((last - avg) / avg) * 100;
}

/**
 * 騰落率を色付き span に変換する
 * @param {number|null} pct
 * @returns {string}
 */
function _pctSpan(pct) {
  if (pct == null) return '<span class="lit-na">–</span>';
  const cls = pct >= 0 ? 'pos' : 'neg';
  const sign = pct >= 0 ? '+' : '';
  return `<span class="${cls}">${sign}${fmtPctInt(pct)}</span>`;
}

/**
 * リチウム監視カードを panel 先頭に挿入する（非同期）
 * @param {HTMLElement} panel
 */
async function _renderLithiumMonitor(panel) {
  const card = document.createElement('div');
  card.className = 'lit-monitor-card';
  card.innerHTML = '<div class="lit-loading">リチウム市況を読込中…</div>';
  panel.prepend(card);

  try {
    await Promise.all([
      fetchSymbolHistory(LIT_SYMBOL, '1y'),
      fetchSymbolHistory(ALB_SYMBOL, '1y'),
    ]);
    const [litLive, albLive] = await Promise.all([
      fetchLivePrice(LIT_SYMBOL),
      fetchLivePrice(ALB_SYMBOL),
    ]);

    const litPrice = litLive && !litLive._err ? litLive.price : null;
    const litDay   = litLive && !litLive._err ? litLive.dayPct : null;
    const albPrice = albLive && !albLive._err ? albLive.price : null;
    const albDay   = albLive && !albLive._err ? albLive.dayPct : null;

    const lit1w  = _calcChangePct(LIT_SYMBOL, 5);
    const lit1m  = _calcChangePct(LIT_SYMBOL, 21);
    const litDev = _calc200DmaDeviation(LIT_SYMBOL);

    let badge, badgeClass, signal;
    if (litDev == null) {
      badge = '🟡 データ不足';
      badgeClass = 'lit-badge-neutral';
      signal = '200日移動平均を算出できません（データ取得中）';
    } else if (litDev >= LIT_OK_DMA_PCT) {
      badge = '🟢 回復基調';
      badgeClass = 'lit-badge-ok';
      signal = 'LIT が 200DMA 上。リチウム回復継続中。REMX 保有継続の前提維持。';
    } else if (litDev >= LIT_WARN_DMA_PCT) {
      badge = '🟡 中立';
      badgeClass = 'lit-badge-neutral';
      signal = 'LIT が 200DMA をやや下回り。様子見。REMX は継続保有可能範囲。';
    } else {
      badge = '🔴 崩れ警戒';
      badgeClass = 'lit-badge-warn';
      signal = 'LIT が 200DMA を大幅下回り。リチウム需給悪化の可能性。REMX トリム検討サイン。';
    }

    const litPriceStr = litPrice != null ? `$${litPrice.toFixed(2)}` : '–';
    const albPriceStr = albPrice != null ? `$${albPrice.toFixed(2)}` : '–';
    const devStr = litDev != null ? `${litDev >= 0 ? '+' : ''}${litDev.toFixed(1)}%` : '–';

    card.innerHTML = `
      <div class="lit-header">
        <span class="lit-title">リチウム市況モニタ</span>
        <span class="lit-badge ${badgeClass}">${badge}</span>
      </div>
      <div class="lit-rationale">REMX保有の前提＝リチウム回復。崩れたら REMX 逆風。</div>
      <div class="lit-rows">
        <div class="lit-row">
          <span class="lit-sym">LIT</span>
          <span class="lit-px">${litPriceStr}</span>
          <span class="lit-pct lit-pct-1d">${_pctSpan(litDay)}</span>
          <span class="lit-pct lit-pct-1w">${_pctSpan(lit1w)}</span>
          <span class="lit-pct lit-pct-1m">${_pctSpan(lit1m)}</span>
          <span class="lit-dma">対200DMA: ${devStr}</span>
        </div>
        <div class="lit-row lit-row-sub">
          <span class="lit-sym">ALB</span>
          <span class="lit-px">${albPriceStr}</span>
          <span class="lit-pct lit-pct-1d">${_pctSpan(albDay)}</span>
          <span class="lit-pct lit-pct-1w">–</span>
          <span class="lit-pct lit-pct-1m">–</span>
          <span class="lit-dma"></span>
        </div>
      </div>
      <div class="lit-signal">${signal}</div>
      <div class="lit-legend">
        <span class="lit-legend-item"><span class="lit-col-label">1d</span></span>
        <span class="lit-legend-item"><span class="lit-col-label">1w</span></span>
        <span class="lit-legend-item"><span class="lit-col-label">1m</span></span>
      </div>
      <div class="lit-note">※現物スポットではなくプロキシ（ETF/株）連動。トリガー: LIT が 200DMA を ${Math.abs(LIT_WARN_DMA_PCT)}%以上下回ると🔴警戒。</div>
    `;
  } catch (e) {
    console.warn('[lithium-monitor] 取得失敗:', e);
    card.innerHTML = '<div class="lit-loading lit-err">リチウム市況の取得に失敗しました。</div>';
  }
}

/**
 * Briefing タブを描画する（初回のみ自動ロード、force で再読込）
 * @param {boolean} [force]
 * @returns {void}
 */
export function renderBriefing(force = false) {
  const panel = document.getElementById('panel-briefing');
  if (!panel) return;
  if (_loaded && !force) return;
  panel.innerHTML = '<div class="bf-msg">読み込み中…</div>';

  fetch(`data/briefings/index.json?_=${Date.now()}`)
    .then((r) => {
      if (!r.ok) throw new Error(`index ${r.status}`);
      return r.json();
    })
    .then((idx) => {
      const issues = (idx.issues || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
      if (!issues.length) {
        panel.innerHTML = '<div class="bf-msg">まだ Briefing がありません。</div>';
        return;
      }
      const latest = issues[0];
      const latestUrl = _briefingUrl(latest.path);
      if (!latestUrl) throw new Error('invalid briefing path');

      panel.textContent = '';
      const wrap = document.createElement('div');
      wrap.className = 'bf-wrap';

      const frame = document.createElement('iframe');
      frame.className = 'bf-frame';
      frame.src = _withCacheBust(latestUrl);
      frame.title = String(latest.title || 'Briefing');
      frame.loading = 'lazy';
      frame.sandbox = 'allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox';
      wrap.appendChild(frame);

      const pastbar = document.createElement('div');
      pastbar.className = 'bf-pastbar';
      const label = document.createElement('label');
      label.className = 'bf-past-label';
      label.htmlFor = 'bf-past-sel';
      label.textContent = '過去号';
      const select = document.createElement('select');
      select.id = 'bf-past-sel';
      select.className = 'bf-past-select';
      select.setAttribute('aria-label', '過去の Briefing を選択');
      for (const [i, issue] of issues.entries()) {
        const url = _briefingUrl(issue.path);
        if (!url) continue;
        const opt = document.createElement('option');
        opt.value = url.pathname.replace(/^\//, '');
        opt.textContent = String(issue.title || issue.date || opt.value);
        opt.selected = i === 0;
        select.appendChild(opt);
      }
      pastbar.append(label, select);
      wrap.appendChild(pastbar);
      panel.appendChild(wrap);

      // リチウム監視カードを先頭に非同期で追加（#611）
      _renderLithiumMonitor(panel);

      // 同一オリジン: iframe を残り高さにフィット（枠内1スクロール）＋テーマ伝搬
      _frame = frame;
      if (_frame) {
        _frame.addEventListener('load', () => {
          _injectBriefingFixups();
          _syncFrameTheme();
          _fitFrame();
        });
        _ensureThemeObserver();
        _ensureResizeFit();
        _fitFrame();
      }
      if (select instanceof HTMLSelectElement) {
        select.addEventListener('change', () => {
          const url = _briefingUrl(select.value);
          if (_frame && url) _frame.src = _withCacheBust(url);
        });
      }
      _loaded = true;
    })
    .catch(() => {
      panel.innerHTML = '<div class="bf-msg bf-err">Briefing の読み込みに失敗しました。</div>';
    });
}

/** 再読み込み（ツールバーの ↻ ボタンから） */
export function reloadBriefing() {
  renderBriefing(true);
}

function _briefingUrl(path) {
  try {
    const url = new URL(String(path || ''), location.origin);
    if (url.origin !== location.origin) return null;
    if (!url.pathname.startsWith('/data/briefings/')) return null;
    if (!url.pathname.endsWith('.html')) return null;
    return url;
  } catch {
    return null;
  }
}

function _withCacheBust(url) {
  const next = new URL(url.href);
  next.searchParams.set('_', String(Date.now()));
  return next.pathname.replace(/^\//, '') + next.search;
}
