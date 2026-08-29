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
import { escapeHTML } from './utils.js';

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

/** リチウム市況プロキシ定義（#611）。LIT が主、ALB が補助。 */
const _LIT_PROXIES = [
  { symbol: 'LIT', name: 'LIT（Global X リチウム&バッテリーETF）' },
  { symbol: 'ALB', name: 'ALB（Albemarle・リチウム最大手）' },
];

/**
 * 200日移動平均に対する現値の乖離率（%）を historicalCache から計算する。
 * データ不足時は null。
 * @param {string} symbol
 * @returns {number|null}
 */
function _calc200DmaDeviation(symbol) {
  const data = state.historicalCache['1y']?.[symbol];
  if (!data || data.length < 5) return null;
  const last200 = data.slice(-200);
  const ma = last200.reduce((s, d) => s + d.close, 0) / last200.length;
  if (!ma) return null;
  const cur = data[data.length - 1].close;
  return ((cur - ma) / ma) * 100;
}

/**
 * 期間騰落率（%）を historicalCache から計算する（portfolio-calc に依存しない独立版）。
 * @param {string} symbol
 * @param {number} days
 * @returns {number|null}
 */
function _calcPeriodPct(symbol, days) {
  const data = state.historicalCache['1y']?.[symbol];
  if (!data || data.length < 2) return null;
  const last = data[data.length - 1];
  const lastMs = last.date instanceof Date ? last.date.getTime() : new Date(last.date).getTime();
  const target = new Date(lastMs - days * 86400000);
  let start = null;
  for (let i = data.length - 2; i >= 0; i--) {
    if (data[i].date <= target) { start = data[i]; break; }
  }
  if (!start) start = data[0];
  return ((last.close - start.close) / start.close) * 100;
}

/**
 * ステータスバッジを返す。200DMA 乖離率に基づく判定。
 * @param {number|null} devPct 200DMA 乖離率（%）
 * @returns {{ cls: string, text: string, desc: string }}
 */
function _lithiumStatus(devPct) {
  if (devPct === null) return { cls: 'neu', text: 'データ取得中', desc: '200日移動平均算出待ち' };
  if (devPct > 0) return { cls: 'good', text: '回復基調', desc: `200DMA を +${devPct.toFixed(1)}% 上回る（リチウム回復局面）` };
  if (devPct > -5) return { cls: 'ok', text: '中立', desc: `200DMA を ${devPct.toFixed(1)}% 下回る（様子見）` };
  return { cls: 'warn', text: '崩れ警戒', desc: `200DMA を ${devPct.toFixed(1)}% 下回る（REMX 逆風リスク）` };
}

/**
 * リチウム市況モニターカード HTML を生成する（#611）。
 * LIT / ALB のライブ価格＋1w・1m騰落率＋200DMA乖離＋状態バッジを表示。
 * プロキシ注記付き（現物スポット非表示）。
 * @returns {Promise<HTMLElement>}
 */
async function _buildLithiumCard() {
  const card = document.createElement('div');
  card.className = 'risk-card bf-lithium-card';
  card.innerHTML = `<div class="risk-card-title">リチウム市況モニター <span class="rtag">REMX 保有前提監視</span></div><div class="bf-lit-loading">取得中…</div>`;

  const ensureHistory = async (sym) => {
    if (!state.historicalCache['1y']?.[sym]) {
      await fetchSymbolHistory(sym, '1y').catch(() => {});
    }
  };

  Promise.all(_LIT_PROXIES.map(async (proxy) => {
    const [live] = await Promise.all([
      fetchLivePrice(proxy.symbol).catch(() => null),
      ensureHistory(proxy.symbol),
    ]);
    const price = live && !('_err' in live) ? live.price : null;
    const dayPct = live && !('_err' in live) ? live.dayPct : null;
    const wkPct = _calcPeriodPct(proxy.symbol, 7);
    const moPct = _calcPeriodPct(proxy.symbol, 30);
    const dev = _calc200DmaDeviation(proxy.symbol);
    return { proxy, price, dayPct, wkPct, moPct, dev };
  })).then((results) => {
    const primaryDev = results[0]?.dev ?? null;
    const status = _lithiumStatus(primaryDev);

    const pctCell = (v) => {
      if (v === null) return '<td class="bf-lit-val">—</td>';
      const cls = v > 0 ? 'pos' : v < 0 ? 'neg' : '';
      return `<td class="bf-lit-val ${cls}">${v > 0 ? '+' : ''}${v.toFixed(1)}%</td>`;
    };

    const rows = results.map(({ proxy, price, dayPct, wkPct, moPct }) => {
      const priceStr = price !== null ? `$${price.toFixed(2)}` : '—';
      return `<tr>
        <td class="bf-lit-name">${escapeHTML(proxy.symbol)}</td>
        <td class="bf-lit-val">${escapeHTML(priceStr)}</td>
        ${pctCell(dayPct)}
        ${pctCell(wkPct)}
        ${pctCell(moPct)}
      </tr>`;
    }).join('');

    card.innerHTML = `
      <div class="risk-card-title">リチウム市況モニター <span class="rtag">REMX 保有前提監視</span></div>
      <div class="bf-lit-status">
        <span class="pill ${escapeHTML(status.cls)}">${escapeHTML(status.text)}</span>
        <span class="bf-lit-desc">${escapeHTML(status.desc)}</span>
      </div>
      <div class="bf-lit-table-wrap">
        <table class="bf-lit-table">
          <thead><tr><th>銘柄</th><th>現値</th><th>1d</th><th>1w</th><th>1m</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="bf-lit-note">※ リチウム現物スポット価格の直接フィードなし。LIT／ALB をプロキシとして代替表示（#611）。REMX 保有の前提＝リチウム回復基調。崩れたら REMX 逆風。</div>`;
  }).catch(() => {
    card.innerHTML = `<div class="risk-card-title">リチウム市況モニター</div><div class="bf-lit-loading">取得失敗</div>`;
  });

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
        panel.innerHTML = '<div class="bf-msg">まだ Briefing がありません。</div>';
        return;
      }
      const latest = issues[0];
      const latestUrl = _briefingUrl(latest.path);
      if (!latestUrl) throw new Error('invalid briefing path');

      panel.textContent = '';

      _buildLithiumCard().then((card) => {
        panel.insertBefore(card, panel.firstChild);
      });

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
