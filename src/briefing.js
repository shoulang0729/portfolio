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

import { fetchFinnhubQuote, toFinnhubSymbol } from './data-finnhub.js';
import { getHistoricalChangePct } from './portfolio-calc.js';
import { state } from './state.js';
import { setHistoricalEntry } from './historical-cache.js';
import { fetchViaProxy, applySplitCorrection } from './data-yahoo.js';

// ── リチウム監視カード ──────────────────────────────────────────
// REMXの保有前提（リチウム回復基調）を常時監視。
// プロキシ: LIT（Global X Lithium & Battery Tech ETF）/ ALB（Albemarle）
const _LIT_PROXIES = [
  { symbol: 'LIT', name: 'LIT', desc: 'Global X Lithium ETF' },
  { symbol: 'ALB', name: 'ALB', desc: 'Albemarle（リチウム最大手）' },
];

/** リチウム監視カードを描画するコンテナ */
let _litCardEl = null;

/**
 * 1銘柄の履歴データを historicalCache に読み込む（未キャッシュ時のみ）
 * @param {string} symbol
 * @param {string} range
 */
async function _ensureHistory(symbol, range) {
  if (state.historicalCache[range]?.[symbol]) return;
  if (!state.historicalCache[range]) state.historicalCache[range] = {};
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`;
  const data = await fetchViaProxy(url, 7000, false);
  if (!data) return;
  const result = data?.chart?.result?.[0];
  if (!result) return;
  const timestamps = result.timestamp || [];
  const adjCloses = result.indicators?.adjclose?.[0]?.adjclose || [];
  const rawCloses = result.indicators?.quote?.[0]?.close || [];
  const closes = adjCloses.length ? adjCloses : rawCloses;
  const entries = timestamps
    .map((ts, i) => ({ date: new Date(ts * 1000), close: closes[i] }))
    .filter(p => p.close != null && isFinite(p.close));
  await setHistoricalEntry(range, symbol, applySplitCorrection(entries));
}

/**
 * 200日移動平均比でリチウム市況の状態を判定する
 * 200DMA比 > +5%: 回復基調🟢 / -5%〜+5%: 中立🟡 / < -5%: 崩れ警戒🔴
 * @param {string} symbol
 * @returns {{ status: 'good'|'ok'|'warn', label: string, detail: string }|null}
 */
function _calcLitStatus(symbol) {
  const data = state.historicalCache['1y']?.[symbol];
  if (!data || data.length < 30) return null;
  const currentPrice = data[data.length - 1].close;
  const ma200len = Math.min(200, data.length);
  const slice = data.slice(-ma200len);
  const dma200 = slice.reduce((s, d) => s + d.close, 0) / slice.length;
  const ratio = (currentPrice - dma200) / dma200 * 100;
  if (ratio > 5) return { status: 'good', label: '回復基調', detail: `200DMA比+${ratio.toFixed(1)}%` };
  if (ratio >= -5) return { status: 'ok',   label: '中立',     detail: `200DMA比${ratio.toFixed(1)}%` };
  return { status: 'warn', label: '崩れ警戒', detail: `200DMA比${ratio.toFixed(1)}%` };
}

/**
 * フォーマット済み騰落率文字列を返す（null時は "—"）
 * @param {number|null} pct
 * @returns {string}
 */
function _fmtPct(pct) {
  if (pct == null || !isFinite(pct)) return '—';
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

/**
 * リチウム監視カードを Briefing パネル上部に描画する
 * @param {HTMLElement} panel
 */
async function _renderLithiumCard(panel) {
  if (_litCardEl && panel.contains(_litCardEl)) {
    _litCardEl.remove();
  }
  const card = document.createElement('div');
  card.className = 'lit-card';
  _litCardEl = card;

  const header = document.createElement('div');
  header.className = 'lit-card-header';
  const titleEl = document.createElement('span');
  titleEl.className = 'lit-card-title';
  titleEl.textContent = 'リチウム市況モニタ';
  const noteEl = document.createElement('span');
  noteEl.className = 'lit-card-note';
  noteEl.textContent = 'プロキシ連動（現物スポットではない）';
  header.append(titleEl, noteEl);
  card.appendChild(header);

  const contextEl = document.createElement('div');
  contextEl.className = 'lit-card-context';
  contextEl.textContent = 'REMX保有の前提＝リチウム回復。崩れたら REMX 逆風（$15/kg割れ相当が警戒水準）';
  card.appendChild(contextEl);

  const rows = document.createElement('div');
  rows.className = 'lit-rows';
  card.appendChild(rows);
  panel.insertBefore(card, panel.firstChild);

  await Promise.all(_LIT_PROXIES.map(async (proxy) => {
    const row = document.createElement('div');
    row.className = 'lit-row';

    const nameEl = document.createElement('span');
    nameEl.className = 'lit-name';
    nameEl.textContent = proxy.name;

    const descEl = document.createElement('span');
    descEl.className = 'lit-desc';
    descEl.textContent = proxy.desc;

    const priceEl = document.createElement('span');
    priceEl.className = 'lit-price';
    priceEl.textContent = '—';

    const dayEl = document.createElement('span');
    dayEl.className = 'lit-pct';
    dayEl.textContent = '1d: —';

    const weekEl = document.createElement('span');
    weekEl.className = 'lit-pct';
    weekEl.textContent = '1w: —';

    const monthEl = document.createElement('span');
    monthEl.className = 'lit-pct';
    monthEl.textContent = '1m: —';

    const badgeEl = document.createElement('span');
    badgeEl.className = 'lit-badge';
    badgeEl.textContent = '…';

    row.append(nameEl, descEl, priceEl, dayEl, weekEl, monthEl, badgeEl);
    rows.appendChild(row);

    try {
      await _ensureHistory(proxy.symbol, '1y');

      const fSym = toFinnhubSymbol(proxy.symbol);
      const quote = await fetchFinnhubQuote(fSym);
      const price = (!quote?._err && quote?.price) ? quote.price : null;
      const dayPct = (!quote?._err && quote?.dayPct != null) ? quote.dayPct : null;

      if (price != null) {
        priceEl.textContent = `$${price.toFixed(2)}`;
      }
      const dayPctVal = dayPct ?? getHistoricalChangePct(proxy.symbol, '1d');
      const weekPct = getHistoricalChangePct(proxy.symbol, '1w');
      const monthPct = getHistoricalChangePct(proxy.symbol, '1m');

      const fmtDayPct = _fmtPct(dayPctVal);
      dayEl.textContent = `1d: ${fmtDayPct}`;
      dayEl.className = `lit-pct${dayPctVal != null && dayPctVal >= 0 ? ' lit-pos' : dayPctVal != null ? ' lit-neg' : ''}`;

      const fmtWeekPct = _fmtPct(weekPct);
      weekEl.textContent = `1w: ${fmtWeekPct}`;
      weekEl.className = `lit-pct${weekPct != null && weekPct >= 0 ? ' lit-pos' : weekPct != null ? ' lit-neg' : ''}`;

      const fmtMonthPct = _fmtPct(monthPct);
      monthEl.textContent = `1m: ${fmtMonthPct}`;
      monthEl.className = `lit-pct${monthPct != null && monthPct >= 0 ? ' lit-pos' : monthPct != null ? ' lit-neg' : ''}`;

      const status = _calcLitStatus(proxy.symbol);
      if (status) {
        badgeEl.textContent = status.label;
        badgeEl.title = status.detail;
        badgeEl.className = `lit-badge lit-badge-${status.status}`;
      } else {
        badgeEl.textContent = '—';
      }
    } catch {
      badgeEl.textContent = 'エラー';
    }
  }));
}

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
      _renderLithiumCard(panel);

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
