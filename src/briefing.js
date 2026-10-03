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
// リチウム市況モニタ（#611）: REMX保有前提のLIT/ALB価格監視カードを先頭に表示。
// 200日移動平均との乖離でステータスバッジ（🟢回復基調/🟡中立/🔴崩れ警戒）を判定。
// ══════════════════════════════════════════════════════════════

import { fetchViaProxy } from './data-yahoo.js';
import { fetchFinnhubQuote, toFinnhubSymbol } from './data-finnhub.js';

// リチウム監視対象プロキシ（LIT = Global X Lithium & Battery Tech ETF）
const LI_SYMBOL = 'LIT';

// 200DMA乖離率しきい値（%）
// +5%超 → 🟢回復基調、0〜-5% → 🟡中立、-5%未満 → 🔴崩れ警戒
const LI_BULL_THRESH  =  5;
const LI_BEAR_THRESH  = -5;

/** @type {{price:number, dayPct:number|null, weekPct:number|null, monthPct:number|null, dma200:number|null}|null} */
let _liData = null;
/** @type {number} LI データの最終取得時刻（ms） */
let _liTs = 0;
/** @type {HTMLElement|null} */
let _liCard = null;

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
// リチウム市況モニタ（#611）
// ══════════════════════════════════════════════

/**
 * LIT の履歴データから騰落率と200日移動平均を計算する
 * @param {Array<{date:Date, close:number}>} entries
 * @param {number} currentPrice
 * @returns {{weekPct:number|null, monthPct:number|null, dma200:number|null}}
 */
function _calcLiMetrics(entries, currentPrice) {
  if (!entries.length) return { weekPct: null, monthPct: null, dma200: null };

  const sorted = entries.slice().sort((a, b) => a.date - b.date);
  const last = sorted[sorted.length - 1];
  const now = last.date.getTime();

  const msDay   = 86400000;
  const msWeek  = 7  * msDay;
  const msMonth = 30 * msDay;

  /** @param {number} ms */
  function pctFrom(ms) {
    const target = now - ms;
    let best = null;
    let bestDiff = Infinity;
    for (const e of sorted) {
      const diff = Math.abs(e.date.getTime() - target);
      if (diff < bestDiff) { bestDiff = diff; best = e; }
    }
    if (!best || best.close == null || best.close === 0) return null;
    return ((currentPrice - best.close) / best.close) * 100;
  }

  // 200日移動平均（最新200日分のみ）
  const last200 = sorted.slice(-200);
  const dma200 = last200.length >= 10
    ? last200.reduce((s, e) => s + e.close, 0) / last200.length
    : null;

  return {
    weekPct:  pctFrom(msWeek),
    monthPct: pctFrom(msMonth),
    dma200,
  };
}

/**
 * LIT のライブ価格と履歴を取得してキャッシュする（30分TTL）
 * @returns {Promise<void>}
 */
async function _fetchLiData() {
  const TTL = 30 * 60 * 1000;
  if (_liData && Date.now() - _liTs < TTL) return;

  // ライブ価格（Finnhub優先→Yahooフォールバック）
  let price = null;
  let dayPct = null;

  const fh = await fetchFinnhubQuote(toFinnhubSymbol(LI_SYMBOL) || LI_SYMBOL);
  if (fh && !fh._err) {
    price  = fh.price;
    dayPct = fh.dayPct ?? null;
  } else {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${LI_SYMBOL}?interval=1d&range=2d`;
    const data = await fetchViaProxy(url, 7000, false);
    const result = data?.chart?.result?.[0];
    if (result) {
      price  = result.meta?.regularMarketPrice ?? null;
      const prevClose = result.meta?.chartPreviousClose ?? null;
      if (price != null && prevClose != null && prevClose !== 0) {
        dayPct = ((price - prevClose) / prevClose) * 100;
      }
    }
  }

  if (price == null) return;

  // 1年履歴（週・月騰落率 + 200DMA 計算用）
  const histUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${LI_SYMBOL}?interval=1d&range=1y`;
  const histData = await fetchViaProxy(histUrl, 10000, false);
  const histResult = histData?.chart?.result?.[0];
  let weekPct = null;
  let monthPct = null;
  let dma200 = null;

  if (histResult) {
    const timestamps = histResult.timestamp || [];
    const adjCloses  = histResult.indicators?.adjclose?.[0]?.adjclose || [];
    const rawCloses  = histResult.indicators?.quote?.[0]?.close || [];
    const closes     = adjCloses.length ? adjCloses : rawCloses;
    const entries    = timestamps
      .map((ts, i) => ({ date: new Date(ts * 1000), close: closes[i] }))
      .filter(e => e.close != null && isFinite(e.close));
    const m = _calcLiMetrics(entries, price);
    weekPct  = m.weekPct;
    monthPct = m.monthPct;
    dma200   = m.dma200;
  }

  _liData = { price, dayPct, weekPct, monthPct, dma200 };
  _liTs   = Date.now();
}

/**
 * 200DMA乖離率からステータス情報を返す
 * @param {number|null} dma200
 * @param {number} price
 * @returns {{emoji: string, label: string, cls: string}}
 */
function _liStatus(dma200, price) {
  if (dma200 == null || dma200 === 0) {
    return { emoji: '⬜', label: 'データ取得中', cls: 'li-status-neutral' };
  }
  const devPct = ((price - dma200) / dma200) * 100;
  if (devPct >= LI_BULL_THRESH) {
    return { emoji: '🟢', label: '回復基調', cls: 'li-status-bull' };
  }
  if (devPct <= LI_BEAR_THRESH) {
    return { emoji: '🔴', label: '崩れ警戒', cls: 'li-status-bear' };
  }
  return { emoji: '🟡', label: '中立', cls: 'li-status-neutral' };
}

/**
 * 騰落率セルのテキストを返す
 * @param {number|null} pct
 * @returns {string}
 */
function _fmtPct(pct) {
  if (pct == null) return '—';
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

/**
 * リチウム監視カードの DOM を生成して返す（データ未取得時はスケルトン）
 * @returns {HTMLElement}
 */
function _buildLiCard() {
  const card = document.createElement('div');
  card.className = 'li-card';
  card.id = 'li-monitor-card';

  const header = document.createElement('div');
  header.className = 'li-card-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'li-card-title-wrap';

  const title = document.createElement('span');
  title.className = 'li-card-title';
  title.textContent = 'リチウム市況モニタ';

  const badge = document.createElement('span');
  badge.className = 'li-proxy-badge';
  badge.textContent = 'プロキシ連動（現物スポットではない）';

  titleWrap.append(title, badge);

  const statusBadge = document.createElement('span');
  statusBadge.className = 'li-status-badge li-status-neutral';
  statusBadge.id = 'li-status-badge';
  statusBadge.textContent = '⬜ 読み込み中';

  header.append(titleWrap, statusBadge);
  card.appendChild(header);

  const desc = document.createElement('p');
  desc.className = 'li-card-desc';
  desc.textContent = 'REMX保有の前提＝リチウム回復基調。崩れたら REMX 逆風。（LIT: Global X Lithium & Battery Tech ETF）';
  card.appendChild(desc);

  const metrics = document.createElement('div');
  metrics.className = 'li-metrics';
  metrics.id = 'li-metrics';
  metrics.innerHTML = '<span class="li-metric-loading">価格データ取得中…</span>';
  card.appendChild(metrics);

  const trigger = document.createElement('p');
  trigger.className = 'li-card-trigger';
  trigger.id = 'li-trigger-note';
  trigger.textContent = '判定: LIT が 200日移動平均を 5% 超上回れば回復基調🟢、5% 超下回れば崩れ警戒🔴';
  card.appendChild(trigger);

  return card;
}

/**
 * 取得済みデータでカードの表示を更新する
 */
function _updateLiCard() {
  if (!_liCard || !_liData) return;
  const { price, dayPct, weekPct, monthPct, dma200 } = _liData;

  const status = _liStatus(dma200, price);

  const statusEl = _liCard.querySelector('#li-status-badge');
  if (statusEl) {
    statusEl.className = `li-status-badge ${status.cls}`;
    statusEl.textContent = `${status.emoji} ${status.label}`;
  }

  const metricsEl = _liCard.querySelector('#li-metrics');
  if (metricsEl) {
    const dma200Pct = dma200 != null && dma200 !== 0
      ? ((price - dma200) / dma200 * 100)
      : null;

    /** @param {number|null} pct */
    function pctClass(pct) {
      if (pct == null) return '';
      return pct >= 0 ? 'li-pct-up' : 'li-pct-down';
    }

    metricsEl.innerHTML = `
      <div class="li-metric">
        <span class="li-metric-label">現値</span>
        <span class="li-metric-value">$${price.toFixed(2)}</span>
      </div>
      <div class="li-metric">
        <span class="li-metric-label">日次</span>
        <span class="li-metric-value ${pctClass(dayPct)}">${_fmtPct(dayPct)}</span>
      </div>
      <div class="li-metric">
        <span class="li-metric-label">1週</span>
        <span class="li-metric-value ${pctClass(weekPct)}">${_fmtPct(weekPct)}</span>
      </div>
      <div class="li-metric">
        <span class="li-metric-label">1ヶ月</span>
        <span class="li-metric-value ${pctClass(monthPct)}">${_fmtPct(monthPct)}</span>
      </div>
      <div class="li-metric">
        <span class="li-metric-label">200DMA乖離</span>
        <span class="li-metric-value ${pctClass(dma200Pct)}">${_fmtPct(dma200Pct)}</span>
      </div>
    `;
  }
}

/**
 * リチウム監視カードをパネル先頭に挿入してデータを非同期取得・更新する
 * @param {HTMLElement} panel
 */
function _renderLiMonitor(panel) {
  _liCard = _buildLiCard();
  panel.insertBefore(_liCard, panel.firstChild);

  _fetchLiData().then(() => {
    _updateLiCard();
  }).catch(() => {
    if (_liCard) {
      const metricsEl = _liCard.querySelector('#li-metrics');
      if (metricsEl) metricsEl.innerHTML = '<span class="li-metric-loading">データ取得に失敗しました</span>';
    }
  });
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
  _liCard = null;
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
        _renderLiMonitor(panel);
        const msg = document.createElement('div');
        msg.className = 'bf-msg';
        msg.textContent = 'まだ Briefing がありません。';
        panel.appendChild(msg);
        return;
      }
      const latest = issues[0];
      const latestUrl = _briefingUrl(latest.path);
      if (!latestUrl) throw new Error('invalid briefing path');

      panel.textContent = '';
      _renderLiMonitor(panel);

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
