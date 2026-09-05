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

let _loaded = false;
/** @type {HTMLIFrameElement|null} */
let _frame = null;
let _themeObserver = null;
let _resizeFit = false;

// ══════════════════════════════════════════════
// LITHIUM MONITOR CARD (#611)
// ══════════════════════════════════════════════

/** リチウム監視プロキシ銘柄定義 */
const LITHIUM_PROXIES = [
  { symbol: 'LIT',  label: 'LIT',  desc: 'Global X Lithium & Battery Tech ETF' },
  { symbol: 'ALB',  label: 'ALB',  desc: 'Albemarle（リチウム最大手）' },
];

/**
 * 1y 履歴データを使って 200 日移動平均を計算する。
 * @param {string} symbol
 * @returns {number|null}
 */
function _calc200DMA(symbol) {
  const data = state.historicalCache?.['1y']?.[symbol];
  if (!data || data.length < 10) return null;
  const last200 = data.slice(-200);
  const sum = last200.reduce((s, d) => s + d.close, 0);
  return sum / last200.length;
}

/**
 * プロキシ価格と 200DMA を比較して状態バッジを返す。
 * - 現値が 200DMA より 5% 超 上: 回復基調🟢
 * - 現値が 200DMA より 5% 超 下: 崩れ警戒🔴
 * - それ以外: 中立🟡
 * @param {number|null} price
 * @param {number|null} dma200
 * @returns {{label: string, cls: string}}
 */
function _statusBadge(price, dma200) {
  if (price == null || dma200 == null || dma200 === 0) {
    return { label: 'データ待ち', cls: 'lm-badge-neu' };
  }
  const diff = (price - dma200) / dma200;
  if (diff > 0.05)  return { label: '回復基調', cls: 'lm-badge-good' };
  if (diff < -0.05) return { label: '崩れ警戒', cls: 'lm-badge-warn' };
  return { label: '中立', cls: 'lm-badge-neu' };
}

/**
 * 期間騰落率を historicalCache から取得する（1d / 1w / 1m）。
 * @param {string} symbol
 * @param {'1d'|'1w'|'1m'} periodId
 * @returns {number|null}
 */
function _getChangePct(symbol, periodId) {
  const rangeMap = { '1d': '1y', '1w': '1y', '1m': '1y' };
  const daysMap  = { '1d': 1, '1w': 7, '1m': 30 };
  const range = rangeMap[periodId];
  const data = state.historicalCache?.[range]?.[symbol];
  if (!data || data.length < 2) return null;
  if (periodId === '1d') {
    const cur  = data[data.length - 1].close;
    const prev = data[data.length - 2].close;
    return ((cur - prev) / prev) * 100;
  }
  const last = data[data.length - 1];
  const lastMs = last.date instanceof Date ? last.date.getTime() : new Date(last.date).getTime();
  const target = new Date(lastMs - daysMap[periodId] * 86400000);
  let start = data[0];
  for (let i = data.length - 2; i >= 0; i--) {
    if (data[i].date <= target) { start = data[i]; break; }
  }
  return ((last.close - start.close) / start.close) * 100;
}

/**
 * 騰落率を色付き span にする。
 * @param {number|null} pct
 * @returns {HTMLElement}
 */
function _pctSpan(pct) {
  const span = document.createElement('span');
  if (pct == null) {
    span.textContent = '–';
    span.className = 'lm-neu';
    return span;
  }
  const sign = pct >= 0 ? '+' : '';
  span.textContent = `${sign}${pct.toFixed(1)}%`;
  span.className = pct >= 0 ? 'lm-pos' : 'lm-neg';
  return span;
}

/**
 * リチウム市況監視カードを構築して返す（非同期）。
 * @returns {Promise<HTMLElement>}
 */
async function _buildLithiumCard() {
  const card = document.createElement('div');
  card.className = 'lm-card';

  const header = document.createElement('div');
  header.className = 'lm-header';

  const title = document.createElement('span');
  title.className = 'lm-title';
  title.textContent = 'リチウム市況モニタ';
  header.appendChild(title);

  const note = document.createElement('span');
  note.className = 'lm-note';
  note.textContent = 'プロキシ連動（現物スポットではない）';
  header.appendChild(note);

  card.appendChild(header);

  const desc = document.createElement('p');
  desc.className = 'lm-desc';
  desc.textContent = 'REMX保有の前提＝リチウム回復。崩れたら REMX 逆風。';
  card.appendChild(desc);

  await Promise.all(LITHIUM_PROXIES.map(p => fetchSymbolHistory(p.symbol, '1y').catch(() => {})));

  const livePrices = await Promise.allSettled(
    LITHIUM_PROXIES.map(p => fetchLivePrice(p.symbol))
  );

  const rows = document.createElement('div');
  rows.className = 'lm-rows';

  for (const [i, proxy] of LITHIUM_PROXIES.entries()) {
    const live = livePrices[i].status === 'fulfilled' ? livePrices[i].value : null;
    const price  = live?.price ?? null;
    const dayPct = live?.dayPct ?? _getChangePct(proxy.symbol, '1d');
    const wkPct  = _getChangePct(proxy.symbol, '1w');
    const moPct  = _getChangePct(proxy.symbol, '1m');
    const dma200 = _calc200DMA(proxy.symbol);
    const badge  = _statusBadge(price, dma200);

    const row = document.createElement('div');
    row.className = 'lm-row';

    const left = document.createElement('div');
    left.className = 'lm-left';

    const sym = document.createElement('span');
    sym.className = 'lm-sym';
    sym.textContent = proxy.label;
    left.appendChild(sym);

    const bdg = document.createElement('span');
    bdg.className = `lm-badge ${badge.cls}`;
    bdg.textContent = badge.label;
    left.appendChild(bdg);

    const priceEl = document.createElement('span');
    priceEl.className = 'lm-price';
    priceEl.textContent = price != null ? `$${price.toFixed(2)}` : '–';
    left.appendChild(priceEl);

    row.appendChild(left);

    const right = document.createElement('div');
    right.className = 'lm-right';

    const periods = [
      { id: '1d', label: '1d', val: dayPct },
      { id: '1w', label: '1w', val: wkPct },
      { id: '1m', label: '1m', val: moPct },
    ];
    for (const period of periods) {
      const cell = document.createElement('div');
      cell.className = 'lm-cell';
      const lbl = document.createElement('span');
      lbl.className = 'lm-period';
      lbl.textContent = period.label;
      cell.appendChild(lbl);
      cell.appendChild(_pctSpan(period.val));
      right.appendChild(cell);
    }

    if (dma200 != null) {
      const dmaCell = document.createElement('div');
      dmaCell.className = 'lm-cell';
      const dmaLbl = document.createElement('span');
      dmaLbl.className = 'lm-period';
      dmaLbl.textContent = '200DMA';
      dmaCell.appendChild(dmaLbl);
      const dmaVal = document.createElement('span');
      dmaVal.className = 'lm-neu';
      dmaVal.textContent = `$${dma200.toFixed(2)}`;
      dmaCell.appendChild(dmaVal);
      right.appendChild(dmaCell);
    }

    row.appendChild(right);
    rows.appendChild(row);
  }

  card.appendChild(rows);

  const trigger = document.createElement('p');
  trigger.className = 'lm-trigger';
  trigger.textContent = '下振れトリガー: LIT/ALB が 200DMA を 5%超下回る → 🔴崩れ警戒（REMX 逆風化のサイン。$15/kg 相当）';
  card.appendChild(trigger);

  return card;
}

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

  Promise.all([
    fetch(`data/briefings/index.json?_=${Date.now()}`).then(r => {
      if (!r.ok) throw new Error(`index ${r.status}`);
      return r.json();
    }),
    _buildLithiumCard().catch(() => null),
  ])
    .then(([idx, lithiumCard]) => {
      const issues = (idx.issues || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));

      panel.textContent = '';

      if (lithiumCard) {
        panel.appendChild(lithiumCard);
      }

      if (!issues.length) {
        const msg = document.createElement('div');
        msg.className = 'bf-msg';
        msg.textContent = 'まだ Briefing がありません。';
        panel.appendChild(msg);
        return;
      }

      const latest = issues[0];
      const latestUrl = _briefingUrl(latest.path);
      if (!latestUrl) throw new Error('invalid briefing path');

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
  _loaded = false;
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
