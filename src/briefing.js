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
// #611: リチウム市況モニタカードを Briefing タブ上部に追加
//   - プロキシ: LIT（Global X Lithium & Battery Tech ETF）
//   - 状態バッジ: 現値 vs 200DMA（相対指標）で 🟢/🟡/🔴 判定
//   - 「現物スポットではなくプロキシ連動」注記を常時表示
// ══════════════════════════════════════════════════════════════

import { fetchViaProxy } from './data-yahoo.js';

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
// LITHIUM MONITOR (#611)
// ══════════════════════════════════════════════════════════════

/** LIT の価格データキャッシュ（タブを閉じるまで再フェッチしない） */
let _litData = null;
let _litFetching = false;

/**
 * LIT（Global X Lithium & Battery Tech ETF）の価格データを Yahoo Finance から取得し
 * リチウム市況モニタカードを描画する。
 * 状態バッジは「現値 vs 200DMA」の相対指標で判定（絶対値キャリブレーション不要）:
 *   🟢 回復基調: 現値 > 200DMA * 1.02
 *   🟡 中立: 現値が 200DMA ±2% の範囲内
 *   🔴 崩れ警戒: 現値 < 200DMA * 0.98
 * @param {HTMLElement} container - カードを挿入する DOM 要素
 */
async function _renderLithiumMonitor(container) {
  const card = document.createElement('div');
  card.className = 'bf-lithium-card';
  card.innerHTML = '<div class="bf-lithium-loading">リチウム市況データ取得中…</div>';
  container.insertBefore(card, container.firstChild);

  if (!_litData && !_litFetching) {
    _litFetching = true;
    try {
      const url = 'https://query1.finance.yahoo.com/v8/finance/chart/LIT?interval=1d&range=1y';
      _litData = await fetchViaProxy(url, 10000, false);
    } catch {
      _litData = null;
    } finally {
      _litFetching = false;
    }
  }

  const result = _litData?.chart?.result?.[0];
  if (!result) {
    card.innerHTML = '<div class="bf-lithium-loading bf-lithium-err">リチウムプロキシデータ取得失敗</div>';
    return;
  }

  const closes = (result.indicators?.adjclose?.[0]?.adjclose || result.indicators?.quote?.[0]?.close || []).filter(
    /** @param {any} v */ (v) => typeof v === 'number' && isFinite(v)
  );
  if (closes.length < 5) {
    card.innerHTML = '<div class="bf-lithium-loading bf-lithium-err">データ不足</div>';
    return;
  }

  const current = closes[closes.length - 1];
  const prev1d = closes[closes.length - 2] || current;
  const prev1w = closes[Math.max(0, closes.length - 6)] || current;
  const prev1m = closes[Math.max(0, closes.length - 22)] || current;

  const pct1d = ((current - prev1d) / prev1d) * 100;
  const pct1w = ((current - prev1w) / prev1w) * 100;
  const pct1m = ((current - prev1m) / prev1m) * 100;

  const dma200 = closes.length >= 200
    ? closes.slice(-200).reduce((s, v) => s + v, 0) / 200
    : closes.reduce((s, v) => s + v, 0) / closes.length;

  const ratio = current / dma200;
  let badge, badgeClass, statusText;
  if (ratio >= 1.02) {
    badge = '🟢';
    badgeClass = 'bf-li-good';
    statusText = '回復基調';
  } else if (ratio < 0.98) {
    badge = '🔴';
    badgeClass = 'bf-li-warn';
    statusText = '崩れ警戒';
  } else {
    badge = '🟡';
    badgeClass = 'bf-li-neu';
    statusText = '中立';
  }

  /**
   * @param {number} pct
   * @returns {string}
   */
  function fmtPct(pct) {
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  }

  /**
   * @param {number} pct
   * @returns {string}
   */
  function pctClass(pct) {
    return pct >= 0 ? 'bf-li-pos' : 'bf-li-neg';
  }

  card.innerHTML = `
    <div class="bf-lithium-header">
      <span class="bf-lithium-title">リチウム市況モニタ</span>
      <span class="bf-lithium-badge ${badgeClass}">${badge} ${statusText}</span>
    </div>
    <div class="bf-lithium-proxy-note">プロキシ連動（現物スポットではない）: LIT（Global X Lithium &amp; Battery Tech ETF）</div>
    <div class="bf-lithium-body">
      <div class="bf-lithium-price">
        <span class="bf-li-label">現値</span>
        <span class="bf-li-val">$${current.toFixed(2)}</span>
      </div>
      <div class="bf-lithium-changes">
        <span class="bf-li-change-item">
          <span class="bf-li-label">1d</span>
          <span class="bf-li-chg ${pctClass(pct1d)}">${fmtPct(pct1d)}</span>
        </span>
        <span class="bf-li-change-item">
          <span class="bf-li-label">1w</span>
          <span class="bf-li-chg ${pctClass(pct1w)}">${fmtPct(pct1w)}</span>
        </span>
        <span class="bf-li-change-item">
          <span class="bf-li-label">1m</span>
          <span class="bf-li-chg ${pctClass(pct1m)}">${fmtPct(pct1m)}</span>
        </span>
        <span class="bf-li-change-item">
          <span class="bf-li-label">vs 200DMA</span>
          <span class="bf-li-chg ${pctClass(ratio - 1)}">${fmtPct((ratio - 1) * 100)}</span>
        </span>
      </div>
    </div>
    <div class="bf-lithium-context">REMX保有の前提＝リチウム回復。崩れたら REMX 逆風（判断基準: 現値 vs 200DMA）</div>
  `;
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

      _renderLithiumMonitor(wrap);

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
  _litData = null;
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
