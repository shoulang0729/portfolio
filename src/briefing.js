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
import { escapeHTML } from './utils.js';
import { state } from './state.js';

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

// ──────────────────────────────────────────────────────
// #611: リチウム市況モニタ（REMX保有の前提監視）
// プロキシ: LIT（Global X Lithium & Battery Tech ETF）
// ──────────────────────────────────────────────────────

/** LIT の 200日移動平均を historicalCache から計算する。未取得なら null */
function _lit200dma() {
  const data = state.historicalCache['1y']?.['LIT'];
  if (!data || data.length < 2) return null;
  const last200 = data.slice(-200);
  const sum = last200.reduce((s, d) => s + (d.close || 0), 0);
  return sum / last200.length;
}

/**
 * LIT の価格と 200DMA からリチウム市況の状態を判定する。
 * @param {number} price  現在価格
 * @param {number|null} dma200  200日移動平均（null = データ不足）
 * @returns {{ badge: string, label: string, cls: string }}
 */
function _lithiumStatus(price, dma200) {
  if (dma200 == null) return { badge: '—', label: 'データ取得中', cls: '' };
  const pctFromDma = ((price - dma200) / dma200) * 100;
  if (pctFromDma <= -15) {
    return { badge: '🔴', label: `崩れ警戒（200DMAを${Math.abs(pctFromDma).toFixed(0)}%下回る）`, cls: 'lit-warn' };
  }
  if (pctFromDma >= 0) {
    return { badge: '🟢', label: `回復基調（200DMAを${pctFromDma.toFixed(0)}%上回る）`, cls: 'lit-ok' };
  }
  return { badge: '🟡', label: `中立（200DMAを${Math.abs(pctFromDma).toFixed(0)}%下回る）`, cls: 'lit-neutral' };
}

/**
 * リチウム市況モニタカードを生成して返す（非同期）。
 * 価格取得失敗時はエラーカードを返す。
 * @returns {Promise<HTMLElement>}
 */
async function _buildLithiumCard() {
  const card = document.createElement('div');
  card.className = 'risk-card bf-lit-card';
  card.setAttribute('aria-label', 'リチウム市況モニタ');

  const titleEl = document.createElement('div');
  titleEl.className = 'risk-card-title';
  titleEl.textContent = 'リチウム市況モニタ（REMX保有前提）';
  card.appendChild(titleEl);

  const noteEl = document.createElement('p');
  noteEl.className = 'bf-lit-note';
  noteEl.textContent = 'プロキシ連動（現物スポットではない）: LIT = Global X Lithium & Battery Tech ETF';
  card.appendChild(noteEl);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'bf-lit-body';
  bodyEl.textContent = '読み込み中…';
  card.appendChild(bodyEl);

  try {
    await fetchSymbolHistory('LIT', '1y');

    const live = await fetchLivePrice('LIT');
    if (!live || live._err) throw new Error(live?._err || 'noData');

    const price = live.price ?? null;
    const dayPct = live.dayPct ?? null;
    if (price == null) throw new Error('price null');

    const dma200 = _lit200dma();
    const status = _lithiumStatus(price, dma200);

    const fmt1d = dayPct != null ? `${dayPct >= 0 ? '+' : ''}${dayPct.toFixed(2)}%` : '—';
    const dmaStr = dma200 != null ? `$${dma200.toFixed(2)}` : '—';

    bodyEl.innerHTML = `
      <div class="bf-lit-row">
        <span class="bf-lit-price">$${escapeHTML(price.toFixed(2))}</span>
        <span class="bf-lit-day ${dayPct != null && dayPct >= 0 ? 'up' : 'down'}">${escapeHTML(fmt1d)}</span>
        <span class="bf-lit-badge ${escapeHTML(status.cls)}">${status.badge}</span>
      </div>
      <div class="bf-lit-status">${escapeHTML(status.label)}</div>
      <div class="bf-lit-meta">200DMA: ${escapeHTML(dmaStr)}</div>
      <div class="bf-lit-context">REMX保有の前提＝リチウム回復基調。🔴崩れ警戒（200DMAを15%超下回る）時はREMXの逆風化を示唆。</div>
    `;
  } catch {
    bodyEl.innerHTML = '<span class="bf-lit-err">LIT 価格取得失敗（後ほど再試行してください）</span>';
  }

  return card;
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
    .then(async (idx) => {
      const issues = (idx.issues || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
      if (!issues.length) {
        panel.innerHTML = '<div class="bf-msg">まだ Briefing がありません。</div>';
        return;
      }
      const latest = issues[0];
      const latestUrl = _briefingUrl(latest.path);
      if (!latestUrl) throw new Error('invalid briefing path');

      panel.textContent = '';

      const litCard = await _buildLithiumCard();
      panel.appendChild(litCard);

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
