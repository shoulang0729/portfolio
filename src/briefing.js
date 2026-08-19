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
// #611: リチウム市況モニタカード（REMX 保有前提監視）
// LIT / ALB をプロキシとして現値・騰落率・状態バッジを表示する。
// ══════════════════════════════════════════════════════════════

import { fetchLivePrice, fetchSymbolHistory } from './data.js';
import { state } from './state.js';
import { getHistoricalChangePct } from './utils.js';

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

// ── リチウム市況モニタ (#611) ──

/** @type {{symbol: string, label: string}[]} */
const _LI_PROXIES = [
  { symbol: 'LIT',  label: 'LIT (Global X Lithium ETF)' },
  { symbol: 'ALB',  label: 'ALB (Albemarle)' },
];

/**
 * LIT の 1y 騰落率からリチウム市況の状態バッジを判定する。
 * 相対指標（1年パフォーマンス）を使用し、絶対値キャリブレーション不要。
 * - 1y > +5%  → 回復基調 🟢
 * - 1y ≥ -15% → 中立 🟡
 * - 1y < -15% → 崩れ警戒 🔴
 * @param {number|null} pct1y  LIT の 1y 騰落率（%）
 * @returns {{ emoji: string, label: string, cls: string }}
 */
function _liStatus(pct1y) {
  if (pct1y == null) return { emoji: '⚪', label: 'データ取得中', cls: 'li-neu' };
  if (pct1y > 5)    return { emoji: '🟢', label: '回復基調',    cls: 'li-good' };
  if (pct1y >= -15) return { emoji: '🟡', label: '中立',        cls: 'li-ok' };
  return                   { emoji: '🔴', label: '崩れ警戒',    cls: 'li-warn' };
}

/**
 * 価格セルの HTML 文字列を生成する（騰落率に色クラスを付ける）
 * @param {number|null} pct
 * @returns {string}
 */
function _pctHtml(pct) {
  if (pct == null) return '<span class="li-na">—</span>';
  const cls = pct >= 0 ? 'li-pos' : 'li-neg';
  const sign = pct >= 0 ? '+' : '';
  return `<span class="${cls}">${sign}${pct.toFixed(1)}%</span>`;
}

/**
 * リチウム市況モニタカードの DOM 要素を生成する（初期状態は「取得中」）。
 * fetch 完了後に内容を更新する。
 * @returns {HTMLElement}
 */
function _buildLithiumCard() {
  const card = document.createElement('div');
  card.className = 'li-card';
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', 'リチウム市況モニタ');

  const hdr = document.createElement('div');
  hdr.className = 'li-card-hdr';

  const title = document.createElement('span');
  title.className = 'li-card-title';
  title.textContent = 'リチウム市況モニタ';

  const badge = document.createElement('span');
  badge.className = 'li-status-badge li-neu';
  badge.id = 'li-status-badge';
  badge.textContent = '⚪ 取得中';

  hdr.append(title, badge);
  card.appendChild(hdr);

  const desc = document.createElement('p');
  desc.className = 'li-card-desc';
  desc.textContent = 'REMX 保有の前提 = リチウム回復。崩れたら REMX 逆風のサイン。';
  card.appendChild(desc);

  const table = document.createElement('table');
  table.className = 'li-table';
  table.id = 'li-proxy-table';
  table.innerHTML = `<thead><tr>
    <th>プロキシ</th><th>現値</th><th>1d</th><th>1w</th><th>1m</th><th>1y</th>
  </tr></thead><tbody id="li-proxy-tbody"><tr><td colspan="6" class="li-loading">取得中…</td></tr></tbody>`;
  card.appendChild(table);

  const note = document.createElement('p');
  note.className = 'li-card-note';
  note.textContent = '※ 現物スポット（炭酸リチウム）ではなく ETF/株プロキシ連動。状態判定は LIT の 1y 騰落率を基準（>+5%🟢 / ≥−15%🟡 / <−15%🔴）。';
  card.appendChild(note);

  _fetchLithiumData(card);

  return card;
}

/**
 * LIT / ALB の価格・騰落率を非同期取得してカードを更新する。
 * @param {HTMLElement} card
 */
async function _fetchLithiumData(card) {
  const results = await Promise.allSettled(
    _LI_PROXIES.map(async ({ symbol, label }) => {
      const [live] = await Promise.all([
        fetchLivePrice(symbol),
        (async () => {
          if (!state.historicalCache['1y']?.[symbol]) {
            await fetchSymbolHistory(symbol, '1y');
          }
        })(),
      ]);
      const price  = live && !live._err ? live.price  : null;
      const dayPct = live && !live._err ? live.dayPct : null;
      const pct1w  = getHistoricalChangePct(symbol, '1w');
      const pct1m  = getHistoricalChangePct(symbol, '1m');
      const pct1y  = getHistoricalChangePct(symbol, '1y');
      return { symbol, label, price, dayPct, pct1w, pct1m, pct1y };
    })
  );

  const rows = results.map(r => r.status === 'fulfilled' ? r.value : null);

  const litRow = rows.find(r => r?.symbol === 'LIT');
  const status = _liStatus(litRow?.pct1y ?? null);

  const badgeEl = card.querySelector('#li-status-badge');
  if (badgeEl) {
    badgeEl.className = `li-status-badge ${status.cls}`;
    badgeEl.textContent = `${status.emoji} ${status.label}`;
  }

  const tbody = card.querySelector('#li-proxy-tbody');
  if (!tbody) return;
  tbody.innerHTML = rows.map(row => {
    if (!row) return '<tr><td colspan="6" class="li-na">取得失敗</td></tr>';
    const priceStr = row.price != null ? `$${row.price.toFixed(2)}` : '—';
    return `<tr>
      <td class="li-sym">${row.label}</td>
      <td class="li-price">${priceStr}</td>
      <td>${_pctHtml(row.dayPct)}</td>
      <td>${_pctHtml(row.pct1w)}</td>
      <td>${_pctHtml(row.pct1m)}</td>
      <td>${_pctHtml(row.pct1y)}</td>
    </tr>`;
  }).join('');
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

      panel.appendChild(_buildLithiumCard());

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
