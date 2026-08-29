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

import { state } from './state.js';
import { fetchSymbolHistory } from './data.js';
import { getHistoricalChangePct } from './portfolio-calc.js';
import { fmtPctInt } from './fmt.js';

let _loaded = false;
/** @type {HTMLIFrameElement|null} */
let _frame = null;
let _themeObserver = null;
let _resizeFit = false;

/** リチウム監視対象プロキシ銘柄 */
const LI_PROXIES = [
  { symbol: 'LIT',  label: 'LIT（リチウム ETF）' },
  { symbol: 'ALB',  label: 'ALB（Albemarle）' },
];

/**
 * 200日移動平均を historicalCache['1y'] から計算する。
 * @param {string} symbol
 * @returns {number|null}
 */
function _calc200dma(symbol) {
  const data = state.historicalCache['1y']?.[symbol];
  if (!data || data.length < 10) return null;
  const window200 = data.slice(-200);
  const sum = window200.reduce((s, d) => s + d.close, 0);
  return sum / window200.length;
}

/**
 * 最新終値を historicalCache から取得する。
 * @param {string} symbol
 * @returns {number|null}
 */
function _latestClose(symbol) {
  const data = state.historicalCache['1y']?.[symbol];
  if (!data || data.length === 0) return null;
  return data[data.length - 1].close;
}

/**
 * 状態バッジを決定する。
 * price > 200DMA → 🟢回復基調
 * price >= 200DMA * 0.95 → 🟡中立
 * price < 200DMA * 0.95 → 🔴崩れ警戒
 * @param {number|null} price
 * @param {number|null} dma200
 * @returns {{ icon: string, label: string, cls: string }}
 */
function _statusBadge(price, dma200) {
  if (price == null || dma200 == null) {
    return { icon: '⚪', label: 'データなし', cls: 'li-badge-neu' };
  }
  if (price > dma200) {
    return { icon: '🟢', label: '回復基調', cls: 'li-badge-good' };
  }
  if (price >= dma200 * 0.95) {
    return { icon: '🟡', label: '中立', cls: 'li-badge-ok' };
  }
  return { icon: '🔴', label: '崩れ警戒', cls: 'li-badge-warn' };
}

/**
 * リチウム監視カードの HTML を生成して panel 先頭に挿入/更新する。
 * @param {HTMLElement} panel
 */
function _renderLithiumCard(panel) {
  const existing = panel.querySelector('.li-monitor-card');
  if (!existing) return;

  let rowsHtml = '';
  for (const proxy of LI_PROXIES) {
    const price = _latestClose(proxy.symbol);
    const dma200 = _calc200dma(proxy.symbol);
    const badge = _statusBadge(price, dma200);
    const pct1d  = getHistoricalChangePct(proxy.symbol, '1d');
    const pct1w  = getHistoricalChangePct(proxy.symbol, '1w');
    const pct1m  = getHistoricalChangePct(proxy.symbol, '1m');

    const priceStr = price != null ? `$${price.toFixed(2)}` : '–';
    const dmaStr   = dma200 != null ? `$${dma200.toFixed(2)}` : '–';

    /** @param {number|null} v */
    const pctSpan = (v) => {
      if (v == null) return '<span class="li-pct li-pct-neu">–</span>';
      const cls = v >= 0 ? 'li-pct-pos' : 'li-pct-neg';
      return `<span class="li-pct ${cls}">${fmtPctInt(v)}</span>`;
    };

    rowsHtml += `<div class="li-row">
      <div class="li-row-top">
        <span class="li-symbol">${proxy.symbol}</span>
        <span class="li-badge ${badge.cls}">${badge.icon} ${badge.label}</span>
      </div>
      <div class="li-row-mid">
        <span class="li-label">${proxy.label}</span>
      </div>
      <div class="li-row-bot">
        <span class="li-price">${priceStr}</span>
        <span class="li-dma">200DMA ${dmaStr}</span>
        <span class="li-chgs">1d ${pctSpan(pct1d)} &nbsp; 1w ${pctSpan(pct1w)} &nbsp; 1m ${pctSpan(pct1m)}</span>
      </div>
    </div>`;
  }

  existing.innerHTML = `<div class="li-header">
    <span class="li-title">リチウム市況モニタ</span>
    <span class="li-note">※プロキシ連動（現物スポット価格ではない）</span>
  </div>
  <div class="li-rows">${rowsHtml}</div>
  <div class="li-thesis">REMX保有の前提＝リチウム回復基調。崩れたら REMX 逆風。</div>`;
}

/**
 * リチウム監視カードを panel に追加し、データを非同期取得する。
 * @param {HTMLElement} panel
 */
async function _setupLithiumMonitor(panel) {
  const card = document.createElement('div');
  card.className = 'li-monitor-card';
  card.setAttribute('aria-label', 'リチウム市況モニタ');
  card.innerHTML = '<div class="li-loading">リチウム市況を取得中…</div>';
  panel.insertBefore(card, panel.firstChild);

  await Promise.allSettled(LI_PROXIES.map(p => fetchSymbolHistory(p.symbol, '1y')));

  _renderLithiumCard(panel);

  document.addEventListener('hm:prices-updated', () => {
    _renderLithiumCard(panel);
  }, { passive: true });
}

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
        _setupLithiumMonitor(panel);
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

      _setupLithiumMonitor(panel);

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
  _loaded = false;
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
