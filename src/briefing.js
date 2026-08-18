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
// #611: リチウム市況モニタカード（REMX保有の前提監視）をタブ上部に表示
// ══════════════════════════════════════════════════════════════

import { fetchLivePrice, fetchSymbolHistory } from './data.js';
import { state } from './state.js';
import { fmtPct } from './fmt.js';

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
// #611: リチウム市況モニタ
// ══════════════════════════════════════════════

const LIT_SYMBOL = 'LIT';
const ALB_SYMBOL = 'ALB';

/**
 * historicalCache の 1y データから N 日移動平均を計算する
 * @param {string} symbol
 * @param {number} days
 * @returns {number|null}
 */
function _computeMA(symbol, days) {
  const data = state.historicalCache['1y']?.[symbol];
  if (!data || data.length < days) return null;
  const slice = data.slice(-days);
  const sum = slice.reduce((acc, d) => acc + d.close, 0);
  return sum / slice.length;
}

/**
 * historicalCache の 1y データから期間騰落率を計算する
 * @param {string} symbol
 * @param {number} daysBack  0 = 1d(前日比)
 * @returns {number|null}
 */
function _computePeriodPct(symbol, daysBack) {
  const data = state.historicalCache['1y']?.[symbol];
  if (!data || data.length < 2) return null;
  const last = data[data.length - 1];
  if (daysBack === 0) {
    const prev = data[data.length - 2];
    if (!prev || prev.close === 0) return null;
    return ((last.close - prev.close) / prev.close) * 100;
  }
  const lastMs = last.date instanceof Date ? last.date.getTime() : new Date(last.date).getTime();
  const targetMs = lastMs - daysBack * 86400000;
  let startPt = null;
  for (let i = data.length - 2; i >= 0; i--) {
    const d = data[i].date instanceof Date ? data[i].date : new Date(data[i].date);
    if (d.getTime() <= targetMs) { startPt = data[i]; break; }
  }
  if (!startPt) startPt = data[0];
  if (startPt.close === 0) return null;
  return ((last.close - startPt.close) / startPt.close) * 100;
}

/**
 * 状態バッジを返す
 * - 🟢 回復基調: price > 200DMA
 * - 🔴 崩れ警戒: price < 200DMA * 0.95（5%下回る）
 * - 🟡 中立: その他
 * @param {number|null} price
 * @param {number|null} ma200
 * @returns {{ icon: string, label: string, cls: string }}
 */
function _lithiumStatus(price, ma200) {
  if (price == null || ma200 == null) return { icon: '⬜', label: '取得中', cls: 'lith-badge-neutral' };
  if (price > ma200) return { icon: '🟢', label: '回復基調', cls: 'lith-badge-up' };
  if (price < ma200 * 0.95) return { icon: '🔴', label: '崩れ警戒', cls: 'lith-badge-down' };
  return { icon: '🟡', label: '中立', cls: 'lith-badge-neutral' };
}

/**
 * 騰落率セルを生成する
 * @param {number|null} pct
 * @returns {HTMLElement}
 */
function _makePctEl(pct) {
  const el = document.createElement('span');
  el.className = 'lith-pct';
  if (pct == null) {
    el.textContent = '–';
    el.classList.add('lith-pct-none');
  } else {
    el.textContent = (pct >= 0 ? '+' : '') + fmtPct(pct);
    el.classList.add(pct >= 0 ? 'lith-pct-pos' : 'lith-pct-neg');
  }
  return el;
}

/**
 * プロキシ行を生成する
 * @param {string} symbol
 * @param {number|null} price
 * @param {string} label
 * @param {number|null} ma200
 * @returns {HTMLElement}
 */
function _makeProxyRow(symbol, price, label, ma200) {
  const status = _lithiumStatus(price, ma200);
  const pct1d = _computePeriodPct(symbol, 0);
  const pct1w = _computePeriodPct(symbol, 7);
  const pct1m = _computePeriodPct(symbol, 30);

  const row = document.createElement('div');
  row.className = 'lith-proxy-row';

  const nameEl = document.createElement('span');
  nameEl.className = 'lith-proxy-name';
  nameEl.textContent = label;

  const priceEl = document.createElement('span');
  priceEl.className = 'lith-proxy-price';
  priceEl.textContent = price != null ? `$${price.toFixed(2)}` : '–';

  const badge = document.createElement('span');
  badge.className = `lith-badge ${status.cls}`;
  badge.textContent = `${status.icon} ${status.label}`;

  const pcts = document.createElement('span');
  pcts.className = 'lith-pcts';

  const mk1d = document.createElement('span');
  mk1d.className = 'lith-pct-label';
  mk1d.textContent = '1d ';
  const mk1w = document.createElement('span');
  mk1w.className = 'lith-pct-label';
  mk1w.textContent = ' 1w ';
  const mk1m = document.createElement('span');
  mk1m.className = 'lith-pct-label';
  mk1m.textContent = ' 1m ';

  pcts.append(mk1d, _makePctEl(pct1d), mk1w, _makePctEl(pct1w), mk1m, _makePctEl(pct1m));
  row.append(nameEl, priceEl, badge, pcts);
  return row;
}

/**
 * リチウム市況モニタカードを生成して panel に追加する
 * @param {HTMLElement} panel
 * @returns {Promise<HTMLElement>}
 */
async function _renderLithiumCard(panel) {
  const card = document.createElement('div');
  card.className = 'lith-card';
  card.setAttribute('aria-label', 'リチウム市況モニタ');

  const header = document.createElement('div');
  header.className = 'lith-header';

  const title = document.createElement('span');
  title.className = 'lith-title';
  title.textContent = 'リチウム市況モニタ';

  const note = document.createElement('span');
  note.className = 'lith-note';
  note.textContent = 'プロキシ連動（現物スポットではない）';

  header.append(title, note);
  card.appendChild(header);

  const rationale = document.createElement('div');
  rationale.className = 'lith-rationale';
  rationale.textContent = 'REMX保有の前提 = リチウム回復基調。崩れたら REMX 逆風 → trim 検討。';
  card.appendChild(rationale);

  const trigger = document.createElement('div');
  trigger.className = 'lith-trigger';
  trigger.textContent = 'トリガー: LIT が 200日移動平均を 5% 超えて下回ると 🔴 警戒';
  card.appendChild(trigger);

  const body = document.createElement('div');
  body.className = 'lith-body';
  body.textContent = '取得中…';
  card.appendChild(body);

  panel.appendChild(card);

  try {
    await Promise.all([
      fetchSymbolHistory(LIT_SYMBOL, '1y'),
      fetchSymbolHistory(ALB_SYMBOL, '1y'),
    ]);

    const [litLive, albLive] = await Promise.all([
      fetchLivePrice(LIT_SYMBOL),
      fetchLivePrice(ALB_SYMBOL),
    ]);

    const litPrice = litLive && !litLive._err ? litLive.c ?? null : null;
    const albPrice = albLive && !albLive._err ? albLive.c ?? null : null;
    const litMa200 = _computeMA(LIT_SYMBOL, 200);
    const albMa200 = _computeMA(ALB_SYMBOL, 200);

    body.textContent = '';

    const litRow = _makeProxyRow(LIT_SYMBOL, litPrice, 'LIT（Global X Lithium ETF）', litMa200);
    const albRow = _makeProxyRow(ALB_SYMBOL, albPrice, 'ALB（Albemarle）', albMa200);
    body.appendChild(litRow);
    body.appendChild(albRow);

    if (litMa200 != null) {
      const maNote = document.createElement('div');
      maNote.className = 'lith-ma-note';
      maNote.textContent = `LIT 200DMA: $${litMa200.toFixed(2)}`;
      body.appendChild(maNote);
    }
  } catch {
    body.textContent = 'データ取得に失敗しました';
    body.classList.add('lith-err');
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
    .then((idx) => {
      const issues = (idx.issues || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
      if (!issues.length) {
        panel.innerHTML = '';
        const emptyOuter = document.createElement('div');
        emptyOuter.className = 'bf-outer';
        _renderLithiumCard(emptyOuter);
        const msg = document.createElement('div');
        msg.className = 'bf-msg';
        msg.textContent = 'まだ Briefing がありません。';
        emptyOuter.appendChild(msg);
        panel.appendChild(emptyOuter);
        _loaded = true;
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
