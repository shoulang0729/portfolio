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
import { fmtPctInt, escapeHTML } from './utils.js';

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

// ══════════════════════════════════════════════════════════════
// LITHIUM MONITOR CARD (#611)
// LIT / ALB をプロキシとしてリチウム市況を監視する
// トリガー判定: 200DMA との比較（相対指標）
// ══════════════════════════════════════════════════════════════

const LITHIUM_PROXIES = [
  { symbol: 'LIT', name: 'LIT（リチウムETF）' },
  { symbol: 'ALB', name: 'ALB（Albemarle）' },
];

/**
 * historicalCache の 1y データから 200 日移動平均を計算する
 * @param {string} symbol
 * @returns {number|null}
 */
function _calc200DMA(symbol) {
  const data = state.historicalCache['1y']?.[symbol];
  if (!data || data.length < 2) return null;
  const slice = data.slice(-200);
  if (slice.length < 10) return null;
  const sum = slice.reduce((acc, d) => acc + d.close, 0);
  return sum / slice.length;
}

/**
 * 期間騰落率を historicalCache から計算する（1w / 1m）
 * @param {string} symbol
 * @param {number} days
 * @returns {number|null}
 */
function _calcPeriodPct(symbol, days) {
  const data = state.historicalCache['1y']?.[symbol];
  if (!data || data.length < 2) return null;
  const last = data[data.length - 1];
  const lastMs = last.date instanceof Date ? last.date.getTime() : new Date(last.date).getTime();
  const targetDate = new Date(lastMs - days * 86400000);
  let start = null;
  for (let i = data.length - 2; i >= 0; i--) {
    if (data[i].date <= targetDate) { start = data[i]; break; }
  }
  if (!start) start = data[0];
  return ((last.close - start.close) / start.close) * 100;
}

/**
 * LIT・ALB の状態バッジを判定する
 * 両方 200DMA 以上: 🟢回復基調  両方 200DMA 未満: 🔴崩れ警戒  それ以外: 🟡中立
 * @param {{symbol: string, price: number|null, dma200: number|null}[]} items
 * @returns {{ emoji: string, label: string, cls: string }}
 */
function _calcLitStatus(items) {
  const withData = items.filter(it => it.price != null && it.dma200 != null);
  if (withData.length === 0) return { emoji: '⬜', label: 'データ取得中', cls: 'li-neu' };
  const aboveCount = withData.filter(it => /** @type {number} */ (it.price) >= /** @type {number} */ (it.dma200)).length;
  if (aboveCount === withData.length) return { emoji: '🟢', label: '回復基調', cls: 'li-good' };
  if (aboveCount === 0) return { emoji: '🔴', label: '崩れ警戒', cls: 'li-warn' };
  return { emoji: '🟡', label: '中立', cls: 'li-neu' };
}

/**
 * リチウム監視カードの HTML を組み立てる
 * @param {{ symbol: string, name: string, price: number|null, dayPct: number|null, pct1w: number|null, pct1m: number|null, dma200: number|null }[]} items
 * @returns {string}
 */
function _buildLitCardHTML(items) {
  const status = _calcLitStatus(items);

  const rows = items.map(it => {
    const priceStr = it.price != null ? `$${it.price.toFixed(2)}` : '—';
    const dmaStr   = it.dma200 != null ? `$${it.dma200.toFixed(2)}` : '—';
    const aboveDMA = it.price != null && it.dma200 != null && it.price >= it.dma200;
    const dmaIcon  = it.price == null || it.dma200 == null ? '' : (aboveDMA ? '↑' : '↓');
    const dmaCls   = it.price == null || it.dma200 == null ? '' : (aboveDMA ? 'li-pos' : 'li-neg');

    const dayStr = it.dayPct != null ? fmtPctInt(it.dayPct) : '—';
    const dayCls = it.dayPct != null ? (it.dayPct >= 0 ? 'li-pos' : 'li-neg') : '';
    const w1Str  = it.pct1w != null ? fmtPctInt(it.pct1w) : '—';
    const w1Cls  = it.pct1w != null ? (it.pct1w >= 0 ? 'li-pos' : 'li-neg') : '';
    const m1Str  = it.pct1m != null ? fmtPctInt(it.pct1m) : '—';
    const m1Cls  = it.pct1m != null ? (it.pct1m >= 0 ? 'li-pos' : 'li-neg') : '';

    return `<tr>
      <td class="li-sym">${escapeHTML(it.symbol)}</td>
      <td class="li-name">${escapeHTML(it.name)}</td>
      <td class="li-val">${escapeHTML(priceStr)}</td>
      <td class="li-val ${dayCls}">${escapeHTML(dayStr)}</td>
      <td class="li-val ${w1Cls}">${escapeHTML(w1Str)}</td>
      <td class="li-val ${m1Cls}">${escapeHTML(m1Str)}</td>
      <td class="li-val ${dmaCls}">${escapeHTML(dmaStr)} ${dmaIcon}</td>
    </tr>`;
  }).join('');

  const warnRow = status.cls === 'li-warn'
    ? `<div class="li-warn-banner">⚠ 下振れ警戒：リチウム需給悪化の可能性 → REMX 再評価を検討</div>`
    : '';

  return `<div class="li-card">
  <div class="li-card-header">
    <span class="li-title">リチウム市況モニタ</span>
    <span class="li-badge ${status.cls}">${status.emoji} ${escapeHTML(status.label)}</span>
  </div>
  <div class="li-desc">REMX 保有の前提 = リチウム回復。崩れたら REMX 逆風。</div>
  ${warnRow}
  <div class="li-table-wrap">
    <table class="li-table">
      <thead><tr>
        <th>ティッカー</th><th>銘柄</th><th>現値</th><th>1d</th><th>1w</th><th>1m</th><th>200DMA</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div class="li-trigger">
    判定基準: 両プロキシが 200DMA 以上 → 🟢、両方割れ → 🔴、混在 → 🟡
  </div>
  <div class="li-note">※ プロキシ連動（現物スポット炭酸リチウム価格ではない）</div>
</div>`;
}

/** @type {HTMLElement|null} */
let _litCardEl = null;

/**
 * リチウム監視カードを非同期で取得・描画する
 * @param {HTMLElement} container
 */
async function _renderLithiumCard(container) {
  const el = document.createElement('div');
  el.className = 'li-card-wrap';
  el.innerHTML = '<div class="li-loading">リチウム市況を取得中…</div>';
  container.prepend(el);
  _litCardEl = el;

  try {
    await Promise.all(LITHIUM_PROXIES.map(p => fetchSymbolHistory(p.symbol, '1y')));

    const liveResults = await Promise.all(
      LITHIUM_PROXIES.map(p => fetchLivePrice(p.symbol).catch(() => null))
    );

    const items = LITHIUM_PROXIES.map((proxy, i) => {
      const live = liveResults[i];
      return {
        symbol: proxy.symbol,
        name: proxy.name,
        price:  live && !live._err ? live.price : null,
        dayPct: live && !live._err ? live.dayPct : null,
        pct1w:  _calcPeriodPct(proxy.symbol, 7),
        pct1m:  _calcPeriodPct(proxy.symbol, 30),
        dma200: _calc200DMA(proxy.symbol),
      };
    });

    el.innerHTML = _buildLitCardHTML(items);
  } catch {
    el.innerHTML = '<div class="li-loading li-err">リチウム市況の取得に失敗しました。</div>';
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
        panel.textContent = '';
        const outer0 = document.createElement('div');
        outer0.className = 'bf-outer';
        panel.appendChild(outer0);
        _renderLithiumCard(outer0);
        outer0.insertAdjacentHTML('beforeend', '<div class="bf-msg">まだ Briefing がありません。</div>');
        return;
      }
      const latest = issues[0];
      const latestUrl = _briefingUrl(latest.path);
      if (!latestUrl) throw new Error('invalid briefing path');

      panel.textContent = '';

      const outer = document.createElement('div');
      outer.className = 'bf-outer';
      panel.appendChild(outer);

      _renderLithiumCard(outer);

      const wrap = document.createElement('div');
      wrap.className = 'bf-wrap';
      outer.appendChild(wrap);

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
