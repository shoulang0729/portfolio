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
// リチウム監視カード（#611）: LIT（Global X Lithium & Battery Tech ETF）を
// プロキシとして REMX 保有の前提（リチウム回復基調）を監視する。
// ══════════════════════════════════════════════════════════════

import { fetchLivePrice, fetchSymbolHistory } from './data.js';
import { state } from './state.js';
import { setHistoricalEntry } from './historical-cache.js';

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

// ── リチウム監視カード（#611）────────────────────────────────────

/** LIT の 1y 履歴から 200DMA を計算する（足りない場合は全期間平均）。*/
function _compute200DMA(symbol) {
  const data = state.historicalCache['1y']?.[symbol];
  if (!data || data.length < 2) return null;
  const slice = data.slice(-200);
  const avg = slice.reduce((s, d) => s + d.close, 0) / slice.length;
  return avg;
}

/** 騰落率フォーマット（+1.2% 形式）*/
function _fmtPct(v) {
  if (v == null) return '–';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

/**
 * symbol の hist 騰落率を historicalCache から取得する。
 * @param {string} symbol
 * @param {number} days
 * @returns {number|null}
 */
function _histPct(symbol, days) {
  const data = state.historicalCache['1y']?.[symbol];
  if (!data || data.length < 2) return null;
  const last = data[data.length - 1];
  const lastMs = last.date instanceof Date ? last.date.getTime() : new Date(last.date).getTime();
  const target = new Date(lastMs - days * 86400000);
  let start = data[0];
  for (let i = data.length - 2; i >= 0; i--) {
    if (data[i].date <= target) { start = data[i]; break; }
  }
  return ((last.close - start.close) / start.close) * 100;
}

/**
 * リチウム監視カードを panel の先頭に挿入する。
 * LIT の現値・騰落率・200DMA との比較で状態バッジを表示する。
 * @param {HTMLElement} panel
 * @returns {Promise<void>}
 */
async function _renderLithiumCard(panel) {
  const LIT_SYMBOL = 'LIT';

  const card = document.createElement('div');
  card.className = 'bf-lit-card';
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', 'リチウム市況モニタ');

  const header = document.createElement('div');
  header.className = 'bf-lit-header';

  const titleEl = document.createElement('span');
  titleEl.className = 'bf-lit-title';
  titleEl.textContent = 'リチウム市況モニタ';

  const badgeEl = document.createElement('span');
  badgeEl.className = 'bf-lit-badge bf-lit-badge--loading';
  badgeEl.textContent = '読込中';

  header.append(titleEl, badgeEl);
  card.appendChild(header);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'bf-lit-body';
  bodyEl.textContent = '取得中…';
  card.appendChild(bodyEl);

  const noteEl = document.createElement('p');
  noteEl.className = 'bf-lit-note';
  noteEl.textContent = 'プロキシ連動（現物スポットではない）。REMX保有の前提＝リチウム回復。崩れたら REMX 逆風。';
  card.appendChild(noteEl);

  panel.insertAdjacentElement('afterbegin', card);

  try {
    const [live] = await Promise.all([
      fetchLivePrice(LIT_SYMBOL),
      (async () => {
        if (!state.historicalCache['1y']?.[LIT_SYMBOL] || state.historicalCache['1y'][LIT_SYMBOL].length < 10) {
          const hist = await fetchSymbolHistory(LIT_SYMBOL, '1y');
          if (hist && hist.length) await setHistoricalEntry('1y', LIT_SYMBOL, hist);
        }
      })(),
    ]);

    const price = live?.price ?? null;
    const dayPct = live?.dayPct ?? null;
    const w1Pct = _histPct(LIT_SYMBOL, 7);
    const mo1Pct = _histPct(LIT_SYMBOL, 30);
    const dma200 = _compute200DMA(LIT_SYMBOL);

    let badge = '🟡 中立';
    let badgeCls = 'bf-lit-badge--neutral';
    let reason = '200DMA との比較ができません（データ不足）。';

    if (dma200 != null && price != null) {
      const devPct = ((price - dma200) / dma200) * 100;
      if (devPct >= 0) {
        badge = '🟢 回復基調';
        badgeCls = 'bf-lit-badge--ok';
        reason = `LIT が 200日移動平均線を上回っています（+${devPct.toFixed(1)}%）。リチウム回復基調を維持。`;
      } else if (devPct >= -10) {
        badge = '🟡 中立';
        badgeCls = 'bf-lit-badge--neutral';
        reason = `LIT が 200DMA をやや下回っています（${devPct.toFixed(1)}%）。注視が必要。`;
      } else {
        badge = '🔴 崩れ警戒';
        badgeCls = 'bf-lit-badge--warn';
        reason = `LIT が 200DMA を ${Math.abs(devPct).toFixed(1)}% 下回っています。REMX の逆風化に注意。`;
      }
    }

    badgeEl.className = `bf-lit-badge ${badgeCls}`;
    badgeEl.textContent = badge;

    const priceStr = price != null ? `$${price.toFixed(2)}` : '–';
    bodyEl.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'bf-lit-grid';

    const cells = [
      { label: 'LIT 現値', value: priceStr },
      { label: '前日比', value: _fmtPct(dayPct) },
      { label: '1週間', value: _fmtPct(w1Pct) },
      { label: '1ヶ月', value: _fmtPct(mo1Pct) },
    ];

    for (const { label, value } of cells) {
      const cell = document.createElement('div');
      cell.className = 'bf-lit-cell';
      const lbl = document.createElement('span');
      lbl.className = 'bf-lit-cell-label';
      lbl.textContent = label;
      const val = document.createElement('span');
      val.className = 'bf-lit-cell-value';
      val.textContent = value;
      cell.append(lbl, val);
      grid.appendChild(cell);
    }

    bodyEl.appendChild(grid);

    const reasonEl = document.createElement('p');
    reasonEl.className = 'bf-lit-reason';
    reasonEl.textContent = reason;
    bodyEl.appendChild(reasonEl);
  } catch {
    badgeEl.className = 'bf-lit-badge bf-lit-badge--neutral';
    badgeEl.textContent = '🟡 取得失敗';
    bodyEl.textContent = 'データの取得に失敗しました。';
  }
}

// ── Briefing メイン描画 ────────────────────────────────────────────────────

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

      _renderLithiumCard(panel);
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
