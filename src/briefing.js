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
// LIT / ALB をプロキシとして価格・騰落率・200日移動平均乖離で状態バッジを表示。
// ══════════════════════════════════════════════════════════════

import { fetchLivePrice, fetchSymbolHistory } from './data.js';
import { state } from './state.js';

/** リチウムプロキシ銘柄定義 */
const LI_PROXIES = [
  { symbol: 'LIT',  label: 'LIT（リチウム ETF）' },
  { symbol: 'ALB',  label: 'ALB（Albemarle）' },
];

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
 * 200日移動平均を計算する
 * @param {Array<{close: number}>} data
 * @returns {number|null}
 */
function _calc200DMA(data) {
  if (!data || data.length < 10) return null;
  const slice = data.slice(-200);
  const sum = slice.reduce((s, d) => s + d.close, 0);
  return sum / slice.length;
}

/**
 * 1銘柄の騰落率を historicalCache から計算する（1d / 1w / 1mo）
 * @param {string} symbol
 * @returns {{d1: number|null, w1: number|null, mo1: number|null, dma200: number|null, price: number|null}}
 */
function _liMetrics(symbol) {
  const data1y = state.historicalCache['1y']?.[symbol];
  const price = data1y?.length ? data1y[data1y.length - 1].close : null;

  const _pct = (arr, days) => {
    if (!arr || arr.length < 2) return null;
    const last = arr[arr.length - 1];
    const lastMs = last.date instanceof Date ? last.date.getTime() : new Date(last.date).getTime();
    const target = new Date(lastMs - days * 86400000);
    let ref = arr[0];
    for (let i = arr.length - 2; i >= 0; i--) {
      if (arr[i].date <= target) { ref = arr[i]; break; }
    }
    return last.close > 0 && ref.close > 0 ? ((last.close - ref.close) / ref.close) * 100 : null;
  };

  return {
    price,
    d1:    data1y?.length >= 2 ? ((data1y[data1y.length - 1].close - data1y[data1y.length - 2].close) / data1y[data1y.length - 2].close) * 100 : null,
    w1:    _pct(data1y, 7),
    mo1:   _pct(data1y, 30),
    dma200: _calc200DMA(data1y),
  };
}

/**
 * 全プロキシの dma200 乖離から総合状態バッジを決定する
 * @param {Array<{dma200: number|null, price: number|null}>} metrics
 * @returns {{icon: string, label: string, cls: string}}
 */
function _liStatus(metrics) {
  const valid = metrics.filter(m => m.price != null && m.dma200 != null);
  if (!valid.length) return { icon: '⬜', label: 'データ取得中', cls: 'li-badge-neu' };

  const avgRatio = valid.reduce((s, m) => s + (/** @type {number} */ (m.price) / /** @type {number} */ (m.dma200)), 0) / valid.length;

  if (avgRatio > 1.02) return { icon: '🟢', label: '回復基調', cls: 'li-badge-good' };
  if (avgRatio < 0.95) return { icon: '🔴', label: '崩れ警戒', cls: 'li-badge-warn' };
  return { icon: '🟡', label: '中立', cls: 'li-badge-neu' };
}

/**
 * 数値を符号付き% 文字列に変換する
 * @param {number|null} v
 * @returns {string}
 */
function _fmtPct(v) {
  if (v == null || !isFinite(v)) return '–';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

/**
 * リチウム市況モニタカードを描画して container に追加する（非同期）
 * @param {HTMLElement} container
 */
async function _renderLithiumCard(container) {
  const card = document.createElement('div');
  card.className = 'li-card';
  card.setAttribute('aria-label', 'リチウム市況モニタ');

  const header = document.createElement('div');
  header.className = 'li-card-header';

  const title = document.createElement('span');
  title.className = 'li-card-title';
  title.textContent = 'リチウム市況モニタ';

  const badge = document.createElement('span');
  badge.className = 'li-badge li-badge-neu';
  badge.textContent = '⬜ 読込中';

  header.append(title, badge);
  card.appendChild(header);

  const note = document.createElement('div');
  note.className = 'li-card-note';
  note.textContent = 'REMX保有の前提＝リチウム回復。崩れたら REMX 逆風。（プロキシ連動・現物スポットではない）';
  card.appendChild(note);

  const rows = document.createElement('div');
  rows.className = 'li-rows';
  card.appendChild(rows);

  container.prepend(card);

  await Promise.all(LI_PROXIES.map(async ({ symbol }) => {
    await fetchSymbolHistory(symbol, '1y');
  }));

  const liveResults = await Promise.allSettled(
    LI_PROXIES.map(({ symbol }) => fetchLivePrice(symbol))
  );

  liveResults.forEach((res, i) => {
    const { symbol } = LI_PROXIES[i];
    if (res.status === 'fulfilled' && res.value && !res.value._err) {
      const live = res.value;
      const arr = state.historicalCache['1y']?.[symbol];
      if (arr?.length) {
        arr[arr.length - 1].close = live.price;
      }
    }
  });

  rows.textContent = '';
  const allMetrics = LI_PROXIES.map(({ symbol }) => _liMetrics(symbol));

  LI_PROXIES.forEach(({ label }, i) => {
    const m = allMetrics[i];
    const row = document.createElement('div');
    row.className = 'li-row';

    const sym = document.createElement('span');
    sym.className = 'li-sym';
    sym.textContent = label;

    const price = document.createElement('span');
    price.className = 'li-price';
    price.textContent = m.price != null ? `$${m.price.toFixed(2)}` : '–';

    const d1 = document.createElement('span');
    d1.className = `li-pct ${(m.d1 ?? 0) >= 0 ? 'li-up' : 'li-dn'}`;
    d1.title = '日次';
    d1.textContent = `1d ${_fmtPct(m.d1)}`;

    const w1 = document.createElement('span');
    w1.className = `li-pct ${(m.w1 ?? 0) >= 0 ? 'li-up' : 'li-dn'}`;
    w1.title = '1週間';
    w1.textContent = `1w ${_fmtPct(m.w1)}`;

    const mo1 = document.createElement('span');
    mo1.className = `li-pct ${(m.mo1 ?? 0) >= 0 ? 'li-up' : 'li-dn'}`;
    mo1.title = '1ヶ月';
    mo1.textContent = `1mo ${_fmtPct(m.mo1)}`;

    const dma = document.createElement('span');
    dma.className = 'li-dma';
    if (m.dma200 != null) {
      const ratio = m.price != null ? ((m.price - m.dma200) / m.dma200) * 100 : null;
      dma.textContent = `200DMA乖離: ${_fmtPct(ratio)}`;
    } else {
      dma.textContent = '200DMA: –';
    }

    row.append(sym, price, d1, w1, mo1, dma);
    rows.appendChild(row);
  });

  const status = _liStatus(allMetrics);
  badge.className = `li-badge ${status.cls}`;
  badge.textContent = `${status.icon} ${status.label}`;
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

      _renderLithiumCard(panel).catch(() => {});

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
