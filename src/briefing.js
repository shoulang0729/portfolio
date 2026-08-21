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
// リチウム市況モニタカード（#611）:
//   LIT（Global X Lithium & Battery Tech ETF）を REMX 保有の前提監視に使用。
//   200日移動平均との乖離で回復基調/中立/崩れ警戒を判定する。
// ══════════════════════════════════════════════════════════════

import { fetchLivePrice, fetchSymbolHistory } from './data.js';
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

// ══════════════════════════════════════════════
// LITHIUM MONITOR (#611)
// ══════════════════════════════════════════════

/** LIT の 200DMA を historicalCache から計算。データ不足なら null */
function _calc200DMA(symbol) {
  const entries = state.historicalCache['1y']?.[symbol];
  if (!entries || entries.length < 10) return null;
  const recent200 = entries.slice(-200);
  const sum = recent200.reduce((a, e) => a + e.close, 0);
  return sum / recent200.length;
}

/**
 * 価格と200DMAからリチウム状態バッジを判定する。
 * 判定方法（#611 open論点A: 絶対値キャリブレーション不可のため相対指標を採用）:
 *   - LIT > 200DMA          → 🟢 回復基調
 *   - LIT ≥ 200DMA × 0.95  → 🟡 中立
 *   - LIT < 200DMA × 0.95  → 🔴 崩れ警戒
 * @param {number} price
 * @param {number|null} dma200
 * @returns {{ emoji: string, label: string, cls: string }}
 */
function _lithiumStatus(price, dma200) {
  if (dma200 == null) return { emoji: '⬜', label: 'データ不足', cls: 'lm-badge-load' };
  if (price > dma200) return { emoji: '🟢', label: '回復基調', cls: 'lm-badge-good' };
  if (price >= dma200 * 0.95) return { emoji: '🟡', label: '中立', cls: 'lm-badge-ok' };
  return { emoji: '🔴', label: '崩れ警戒', cls: 'lm-badge-warn' };
}

/** 日次騰落率を色付きスパンとして返す */
function _pctSpan(pct) {
  const span = document.createElement('span');
  span.className = `lm-proxy-pct ${pct == null ? 'lm-proxy-pct-neu' : pct > 0 ? 'lm-proxy-pct-pos' : pct < 0 ? 'lm-proxy-pct-neg' : 'lm-proxy-pct-neu'}`;
  span.textContent = pct == null ? '—' : `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
  return span;
}

/**
 * リチウム市況モニタカードを panel の先頭に追加する（非同期・エラーは無視）。
 * @param {HTMLElement} panel
 */
async function _renderLithiumMonitor(panel) {
  const card = document.createElement('div');
  card.className = 'lm-card';
  card.id = 'lm-card';

  const header = document.createElement('div');
  header.className = 'lm-header';

  const title = document.createElement('span');
  title.className = 'lm-title';
  title.textContent = 'リチウム市況モニタ';

  const badge = document.createElement('span');
  badge.className = 'lm-badge lm-badge-load';
  badge.textContent = '取得中…';

  header.append(title, badge);
  card.appendChild(header);

  const proxies = document.createElement('div');
  proxies.className = 'lm-proxies';
  card.appendChild(proxies);

  const dmaRow = document.createElement('div');
  dmaRow.className = 'lm-dma-row';
  card.appendChild(dmaRow);

  const rationale = document.createElement('p');
  rationale.className = 'lm-rationale';
  rationale.textContent = 'REMX保有の前提＝リチウム回復。崩れたら REMX 逆風。';
  card.appendChild(rationale);

  const note = document.createElement('p');
  note.className = 'lm-note';
  note.textContent = '※ 現物スポット（炭酸リチウム）ではなく LIT/ALB プロキシ連動の参考値です。';
  card.appendChild(note);

  panel.insertBefore(card, panel.firstChild);

  try {
    const [litLive, albLive] = await Promise.allSettled([
      fetchLivePrice('LIT'),
      fetchLivePrice('ALB'),
    ]);
    await fetchSymbolHistory('LIT', '1y');

    const lit = litLive.status === 'fulfilled' && !litLive.value?._err ? litLive.value : null;
    const alb = albLive.status === 'fulfilled' && !albLive.value?._err ? albLive.value : null;
    const dma200 = _calc200DMA('LIT');

    proxies.textContent = '';
    for (const [symbol, data] of [['LIT', lit], ['ALB', alb]]) {
      if (!data?.price) continue;
      const proxy = document.createElement('div');
      proxy.className = 'lm-proxy';
      const sym = document.createElement('span');
      sym.className = 'lm-proxy-symbol';
      sym.textContent = symbol;
      const price = document.createElement('span');
      price.className = 'lm-proxy-price';
      price.textContent = `$${data.price.toFixed(2)}`;
      proxy.append(sym, price, _pctSpan(data.dayPct ?? null));
      proxies.appendChild(proxy);
    }

    if (dma200 != null) {
      dmaRow.textContent = `LIT 200DMA: $${dma200.toFixed(2)}`;
      if (lit?.price) {
        const diff = ((lit.price - dma200) / dma200) * 100;
        const diffSpan = document.createElement('span');
        diffSpan.className = diff >= 0 ? 'lm-proxy-pct-pos' : 'lm-proxy-pct-neg';
        diffSpan.textContent = ` (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%)`;
        dmaRow.appendChild(diffSpan);
      }
    } else {
      dmaRow.textContent = 'LIT 200DMA: データ取得中';
    }

    const litPrice = lit?.price ?? null;
    const status = litPrice != null ? _lithiumStatus(litPrice, dma200) : { emoji: '⬜', label: 'データなし', cls: 'lm-badge-load' };
    badge.className = `lm-badge ${status.cls}`;
    badge.textContent = `${status.emoji} ${status.label}`;
  } catch {
    badge.className = 'lm-badge lm-badge-load';
    badge.textContent = '取得失敗';
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
