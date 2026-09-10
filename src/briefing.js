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

import { fetchFinnhubQuote } from './data-finnhub.js';
import { fetchViaProxy } from './data-yahoo.js';
import { escapeHTML } from './fmt.js';

// ── リチウム監視カード（#611）定数 ──
const LIT_SYMBOL = 'LIT';
const LIT_NAME   = 'Global X Lithium ETF (LIT)';
// 200DMA との乖離で状態判定: +5%超=回復、-5%未満=警戒、その間=中立
const LIT_DMA_GOOD_THRESHOLD = 0.05;
const LIT_DMA_WARN_THRESHOLD = -0.05;

/**
 * @typedef {{price: number, dayPct: number|null, pct1w: number|null, pct1m: number|null, dma200: number|null}} LitData
 */

/**
 * LIT の現値・騰落率・200DMA を取得する
 * @returns {Promise<LitData|null>}
 */
async function _fetchLitData() {
  const quote = await fetchFinnhubQuote(LIT_SYMBOL).catch(() => null);
  if (!quote || /** @type {any} */ (quote)._err) return null;
  const price = /** @type {any} */ (quote).price;
  const dayPct = /** @type {any} */ (quote).dayPct ?? null;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(LIT_SYMBOL)}?range=1y&interval=1d&includePrePost=false`;
  let pct1w = null, pct1m = null, dma200 = null;
  try {
    const data = await fetchViaProxy(url, 10000);
    const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (Array.isArray(closes) && closes.length >= 2) {
      const validCloses = /** @type {number[]} */ (closes.filter((c) => c != null && isFinite(c)));
      if (validCloses.length >= 2) {
        const last = validCloses[validCloses.length - 1];
        const len = validCloses.length;

        const idx1w = Math.max(0, len - 6);
        const idx1m = Math.max(0, len - 22);
        pct1w = ((last - validCloses[idx1w]) / validCloses[idx1w]) * 100;
        pct1m = ((last - validCloses[idx1m]) / validCloses[idx1m]) * 100;

        if (len >= 200) {
          const dmaSlice = validCloses.slice(len - 200);
          dma200 = dmaSlice.reduce((s, v) => s + v, 0) / dmaSlice.length;
        } else if (len >= 20) {
          dma200 = validCloses.reduce((s, v) => s + v, 0) / validCloses.length;
        }
      }
    }
  } catch { /* ヒストリカル取得失敗は無視 */ }

  return { price, dayPct, pct1w, pct1m, dma200 };
}

/**
 * @param {number|null} pct
 * @returns {string}
 */
function _fmtPct(pct) {
  if (pct == null || !isFinite(pct)) return '–';
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

/**
 * LIT の状態バッジを返す
 * @param {number} price
 * @param {number|null} dma200
 * @returns {{icon: string, label: string, cls: string}}
 */
function _litStatus(price, dma200) {
  if (dma200 == null) return { icon: '⚪', label: 'データ不足', cls: 'lm-badge-neu' };
  const ratio = (price - dma200) / dma200;
  if (ratio > LIT_DMA_GOOD_THRESHOLD) return { icon: '🟢', label: '回復基調', cls: 'lm-badge-good' };
  if (ratio < LIT_DMA_WARN_THRESHOLD) return { icon: '🔴', label: '崩れ警戒', cls: 'lm-badge-warn' };
  return { icon: '🟡', label: '中立', cls: 'lm-badge-neu' };
}

/**
 * リチウム監視カードを描画し、DOM 要素を返す
 * @returns {HTMLElement}
 */
function _buildLithiumCard() {
  const card = document.createElement('div');
  card.className = 'lm-card';
  card.setAttribute('aria-label', 'リチウム市況モニタ');
  card.innerHTML = `<div class="lm-header">
    <span class="lm-title">リチウム市況モニタ</span>
    <span class="lm-badge lm-badge-neu" id="lm-badge">読込中…</span>
  </div>
  <div class="lm-body">
    <div class="lm-price-row">
      <span class="lm-proxy-name">${escapeHTML(LIT_NAME)}</span>
      <span class="lm-price" id="lm-price">–</span>
    </div>
    <div class="lm-pct-row">
      <span class="lm-pct-item"><span class="lm-pct-label">当日</span><span class="lm-pct-val" id="lm-day">–</span></span>
      <span class="lm-pct-item"><span class="lm-pct-label">1週</span><span class="lm-pct-val" id="lm-1w">–</span></span>
      <span class="lm-pct-item"><span class="lm-pct-label">1ヶ月</span><span class="lm-pct-val" id="lm-1m">–</span></span>
      <span class="lm-pct-item"><span class="lm-pct-label">200DMA</span><span class="lm-pct-val" id="lm-dma">–</span></span>
    </div>
    <div class="lm-note">REMX保有の前提＝リチウム回復。崩れたら REMX 逆風（200DMA 下抜け＝🔴警戒）</div>
    <div class="lm-disclaimer">※プロキシ連動（現物スポット価格ではありません）</div>
  </div>`;
  return card;
}

/**
 * リチウム監視カードにデータを反映する
 * @param {HTMLElement} card
 * @param {LitData|null} d
 */
function _populateLithiumCard(card, d) {
  const badge   = card.querySelector('#lm-badge');
  const priceEl = card.querySelector('#lm-price');
  const dayEl   = card.querySelector('#lm-day');
  const w1El    = card.querySelector('#lm-1w');
  const m1El    = card.querySelector('#lm-1m');
  const dmaEl   = card.querySelector('#lm-dma');

  if (!d) {
    if (badge) badge.textContent = 'データ取得失敗';
    return;
  }

  const { price, dayPct, pct1w, pct1m, dma200 } = d;
  const status = _litStatus(price, dma200);
  const dmaRatio = dma200 != null ? ((price - dma200) / dma200) * 100 : null;

  if (badge) {
    badge.textContent = `${status.icon} ${status.label}`;
    badge.className = `lm-badge ${status.cls}`;
  }
  if (priceEl) priceEl.textContent = `$${price.toFixed(2)}`;

  /** @param {HTMLElement|null} el @param {number|null} pct */
  const fill = (el, pct) => {
    if (!el) return;
    el.textContent = _fmtPct(pct);
    if (pct != null) el.className = `lm-pct-val ${pct >= 0 ? 'lm-pos' : 'lm-neg'}`;
  };
  fill(/** @type {HTMLElement|null} */ (dayEl), dayPct);
  fill(/** @type {HTMLElement|null} */ (w1El),  pct1w);
  fill(/** @type {HTMLElement|null} */ (m1El),  pct1m);
  fill(/** @type {HTMLElement|null} */ (dmaEl), dmaRatio);
}

/**
 * Briefing パネルにリチウム監視カードを追加してデータを非同期取得する
 * @param {HTMLElement} panel
 */
function _renderLithiumMonitor(panel) {
  let card = /** @type {HTMLElement|null} */ (panel.querySelector('.lm-card'));
  if (!card) {
    card = _buildLithiumCard();
    panel.prepend(card);
  }
  _fetchLitData().then((d) => _populateLithiumCard(/** @type {HTMLElement} */ (card), d));
}

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
 * Briefing タブを描画する（初回のみ自動ロード、force で再読込）
 * @param {boolean} [force]
 * @returns {void}
 */
export function renderBriefing(force = false) {
  const panel = document.getElementById('panel-briefing');
  if (!panel) return;
  if (_loaded && !force) return;

  panel.textContent = '';
  _renderLithiumMonitor(panel);
  const loadingMsg = document.createElement('div');
  loadingMsg.className = 'bf-msg';
  loadingMsg.textContent = '読み込み中…';
  panel.appendChild(loadingMsg);

  fetch(`data/briefings/index.json?_=${Date.now()}`)
    .then((r) => {
      if (!r.ok) throw new Error(`index ${r.status}`);
      return r.json();
    })
    .then((idx) => {
      const issues = (idx.issues || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
      loadingMsg.remove();
      if (!issues.length) {
        const noMsg = document.createElement('div');
        noMsg.className = 'bf-msg';
        noMsg.textContent = 'まだ Briefing がありません。';
        panel.appendChild(noMsg);
        return;
      }
      const latest = issues[0];
      const latestUrl = _briefingUrl(latest.path);
      if (!latestUrl) throw new Error('invalid briefing path');

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
      loadingMsg.remove();
      const errMsg = document.createElement('div');
      errMsg.className = 'bf-msg bf-err';
      errMsg.textContent = 'Briefing の読み込みに失敗しました。';
      panel.appendChild(errMsg);
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
