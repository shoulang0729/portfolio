// @ts-check

// ══════════════════════════════════════════════════════════════
// briefing.js  ―  週次 Briefing タブ
//
// data/briefings/index.json を読み、最新号を iframe で表示する。
// iframe は画面の残り高さにフィットさせ「枠内1スクロール」化（本体HTMLが
// ヘッダ/セクション見出しを sticky 固定）。過去号は下部のプルダウンで切替。
// 「今すぐ生成」リンクは本体HTMLの固定ヘッダ内に移動済み（self-contained）。
// 中身は自己完結のモバイルHTML（MulmoClaude の週次タスクが生成・コミットする）。
//
// #611: リチウム市況モニタカードを Briefing タブ上部に追加。
//       LIT / ALB を代替プロキシとして使用し、200DMA との比較で状態バッジを表示。
// ══════════════════════════════════════════════════════════════

import { fetchLivePrice, fetchSymbolHistory } from './data.js';
import { state } from './state.js';
import { fmtPctInt } from './utils.js';

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

// ══════════════════════════════════════════════
// #611 リチウム市況モニタ
// ══════════════════════════════════════════════

const LIT_PROXIES = [
  { symbol: 'LIT', name: 'LIT（グローバル X リチウム ETF）' },
  { symbol: 'ALB', name: 'ALB（Albemarle）' },
];

/**
 * LIT の過去1年データから200日移動平均を計算する。
 * state.historicalCache['1y']['LIT'] を参照（なければ fetch してからキャッシュ）。
 * @returns {Promise<number|null>}
 */
async function _calcLit200DMA() {
  if (!state.historicalCache['1y']?.['LIT']) {
    await fetchSymbolHistory('LIT', '1y');
  }
  const data = state.historicalCache['1y']?.['LIT'];
  if (!data || data.length < 10) return null;
  const window200 = data.slice(-200);
  const sum = window200.reduce((acc, e) => acc + e.close, 0);
  return sum / window200.length;
}

/**
 * 騰落率に応じた色クラスを返す
 * @param {number|null} pct
 * @returns {string}
 */
function _pctClass(pct) {
  if (pct == null) return '';
  return pct >= 0 ? 'lit-pos' : 'lit-neg';
}

/**
 * LIT の現値と200DMAを比較して状態バッジを返す。
 * 200DMA 比 +5% 超 → 🟢回復基調
 * 200DMA 比 −5% 以下 → 🔴崩れ警戒
 * それ以外 → 🟡中立
 * @param {number|null} price
 * @param {number|null} dma200
 * @returns {{ emoji: string, label: string, cls: string }}
 */
function _litStatus(price, dma200) {
  if (price == null || dma200 == null) {
    return { emoji: '⬜', label: 'データ取得中', cls: 'lit-status-neu' };
  }
  const ratio = (price - dma200) / dma200;
  if (ratio >= 0.05) return { emoji: '🟢', label: '回復基調', cls: 'lit-status-good' };
  if (ratio <= -0.05) return { emoji: '🔴', label: '崩れ警戒', cls: 'lit-status-warn' };
  return { emoji: '🟡', label: '中立', cls: 'lit-status-neu' };
}

/**
 * リチウム市況モニタカード要素を生成して返す（データ取得前のスケルトン）。
 * @returns {HTMLElement}
 */
function _buildLithiumCard() {
  const card = document.createElement('div');
  card.className = 'lit-card';
  card.id = 'lit-monitor-card';

  const header = document.createElement('div');
  header.className = 'lit-header';

  const title = document.createElement('span');
  title.className = 'lit-title';
  title.textContent = 'リチウム市況モニタ';

  const badge = document.createElement('span');
  badge.className = 'lit-status-badge lit-status-neu';
  badge.id = 'lit-status-badge';
  badge.textContent = '⬜ データ取得中';

  header.append(title, badge);
  card.appendChild(header);

  const desc = document.createElement('p');
  desc.className = 'lit-desc';
  desc.textContent = 'REMX保有の前提＝リチウム回復。崩れたら REMX 逆風。';
  card.appendChild(desc);

  const proxies = document.createElement('div');
  proxies.className = 'lit-proxies';
  proxies.id = 'lit-proxies';
  proxies.textContent = '価格取得中…';
  card.appendChild(proxies);

  const trigger = document.createElement('div');
  trigger.className = 'lit-trigger';
  trigger.id = 'lit-trigger';
  card.appendChild(trigger);

  const note = document.createElement('p');
  note.className = 'lit-note';
  note.textContent = '※ 現物炭酸リチウムスポット価格ではなく、プロキシ連動の表示です。';
  card.appendChild(note);

  return card;
}

/**
 * リチウム市況モニタカードのデータを非同期で更新する。
 */
async function _updateLithiumCard() {
  const badge = document.getElementById('lit-status-badge');
  const proxiesEl = document.getElementById('lit-proxies');
  const triggerEl = document.getElementById('lit-trigger');
  if (!badge || !proxiesEl || !triggerEl) return;

  const [dma200, ...livePrices] = await Promise.allSettled([
    _calcLit200DMA(),
    ...LIT_PROXIES.map(p => fetchLivePrice(p.symbol)),
  ]);

  const dmaVal = dma200.status === 'fulfilled' ? dma200.value : null;
  const litLive = livePrices[0]?.status === 'fulfilled' ? livePrices[0].value : null;
  const litPrice = litLive && !litLive._err ? litLive.price : null;

  const status = _litStatus(litPrice, dmaVal);
  badge.textContent = `${status.emoji} ${status.label}`;
  badge.className = `lit-status-badge ${status.cls}`;

  proxiesEl.textContent = '';
  for (let i = 0; i < LIT_PROXIES.length; i++) {
    const proxy = LIT_PROXIES[i];
    const live = livePrices[i]?.status === 'fulfilled' ? livePrices[i].value : null;
    const price = live && !live._err ? live.price : null;
    const dayPct = live && !live._err ? live.dayPct : null;

    const row = document.createElement('div');
    row.className = 'lit-proxy-row';

    const sym = document.createElement('span');
    sym.className = 'lit-proxy-sym';
    sym.textContent = proxy.symbol;

    const nm = document.createElement('span');
    nm.className = 'lit-proxy-name';
    nm.textContent = proxy.name;

    const priceEl = document.createElement('span');
    priceEl.className = 'lit-proxy-price';
    priceEl.textContent = price != null ? `$${price.toFixed(2)}` : '–';

    const pctEl = document.createElement('span');
    const pctText = dayPct != null ? (dayPct >= 0 ? `+${fmtPctInt(dayPct)}` : fmtPctInt(dayPct)) : '–';
    pctEl.className = `lit-proxy-pct ${_pctClass(dayPct)}`;
    pctEl.textContent = pctText;

    row.append(sym, nm, priceEl, pctEl);
    proxiesEl.appendChild(row);
  }

  if (dmaVal != null && litPrice != null) {
    const ratio = ((litPrice - dmaVal) / dmaVal) * 100;
    const dmaText = `LIT 200日移動平均: $${dmaVal.toFixed(2)}（現値比 ${ratio >= 0 ? '+' : ''}${ratio.toFixed(1)}%）`;
    triggerEl.textContent = dmaText;
    triggerEl.className = `lit-trigger ${status.cls}`;
  } else {
    triggerEl.textContent = '';
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

  panel.textContent = '';

  const litCard = _buildLithiumCard();
  panel.appendChild(litCard);
  _updateLithiumCard().catch(() => {});

  const bfContainer = document.createElement('div');
  bfContainer.className = 'bf-container';
  bfContainer.innerHTML = '<div class="bf-msg">読み込み中…</div>';
  panel.appendChild(bfContainer);

  fetch(`data/briefings/index.json?_=${Date.now()}`)
    .then((r) => {
      if (!r.ok) throw new Error(`index ${r.status}`);
      return r.json();
    })
    .then((idx) => {
      const issues = (idx.issues || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
      if (!issues.length) {
        bfContainer.innerHTML = '<div class="bf-msg">まだ Briefing がありません。</div>';
        _loaded = true;
        return;
      }
      const latest = issues[0];
      const latestUrl = _briefingUrl(latest.path);
      if (!latestUrl) throw new Error('invalid briefing path');

      bfContainer.textContent = '';
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
      bfContainer.appendChild(wrap);

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
      bfContainer.innerHTML = '<div class="bf-msg bf-err">Briefing の読み込みに失敗しました。</div>';
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
