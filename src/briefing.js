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
// リチウム市況モニター（#611）:
// LIT（Global X Lithium & Battery Tech ETF）をプロキシとして Finnhub/Yahoo から
// ライブ価格・期間騰落率を取得し、REMX 保有前提（リチウム回復基調）の監視カードを表示する。
// ══════════════════════════════════════════════════════════════

import { toFinnhubSymbol, fetchFinnhubQuote } from './data-finnhub.js';
import { fetchSymbolHistory } from './data.js';
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

// ══════════════════════════════════════════════════════════════
// リチウム市況モニター（#611）
// ══════════════════════════════════════════════════════════════

const LIT_SYMBOL = 'LIT';

/**
 * LIT の historicalCache から期間騰落率を計算する
 * @param {string} range - '1y' | '5y' | '10y'
 * @param {number} days  - 遡る日数
 * @returns {number|null}
 */
function _litChangePct(range, days) {
  const data = state.historicalCache[range]?.[LIT_SYMBOL];
  if (!data || data.length < 2) return null;
  const lastPt = data[data.length - 1];
  const lastMs = lastPt.date instanceof Date ? lastPt.date.getTime() : new Date(lastPt.date).getTime();
  const targetDate = new Date(lastMs - days * 86400000);
  let startPoint = null;
  for (let i = data.length - 2; i >= 0; i--) {
    if (data[i].date <= targetDate) { startPoint = data[i]; break; }
  }
  if (!startPoint) startPoint = data[0];
  const cur = lastPt.close;
  return ((cur - startPoint.close) / startPoint.close) * 100;
}

/**
 * 騰落率からステータスバッジ情報を返す
 * 判定ロジック:
 *   🟢 回復基調: 1m > 0 かつ 3m > 0（両方プラス＝上昇トレンド）
 *   🔴 崩れ警戒: 1m < -5% かつ 3m < -10%（明確な下落トレンド）
 *   🟡 中立: それ以外
 * @param {number|null} pct1m
 * @param {number|null} pct3m
 * @returns {{dot: string, label: string, cls: string, note: string}}
 */
function _litBadge(pct1m, pct3m) {
  if (pct1m != null && pct3m != null && pct1m > 0 && pct3m > 0) {
    return { dot: '🟢', label: '回復基調', cls: 'lit-badge-good', note: 'REMX 保有前提（リチウム回復）が継続中' };
  }
  if (pct1m != null && pct3m != null && pct1m < -5 && pct3m < -10) {
    return { dot: '🔴', label: '崩れ警戒', cls: 'lit-badge-warn', note: 'リチウム下落トレンド — REMX 再評価を検討' };
  }
  return { dot: '🟡', label: '中立', cls: 'lit-badge-neu', note: '方向感が定まらない局面' };
}

/** 騰落率を "+1.23%" 形式の文字列に変換 */
function _fmtPct(v) {
  if (v == null || !isFinite(v)) return '–';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

/**
 * リチウム市況モニターカード DOM を構築して返す（非同期）
 * @returns {Promise<HTMLElement>}
 */
async function _buildLitCard() {
  const card = document.createElement('div');
  card.className = 'lit-card';
  card.innerHTML = '<div class="lit-card-loading">リチウム市況を取得中…</div>';

  (async () => {
    try {
      const fSym = toFinnhubSymbol(LIT_SYMBOL);
      const [quoteResult] = await Promise.allSettled([
        fSym ? fetchFinnhubQuote(fSym) : Promise.resolve(null),
        fetchSymbolHistory(LIT_SYMBOL, '1y'),
      ]);

      const quote = quoteResult.status === 'fulfilled' ? quoteResult.value : null;
      const price = (!quote || quote._err) ? null : quote.price;
      const dayPct = (!quote || quote._err) ? null : quote.dayPct;

      const pct1m = _litChangePct('1y', 30);
      const pct3m = _litChangePct('1y', 90);
      const badge = _litBadge(pct1m, pct3m);

      const priceStr = price != null ? `$${price.toFixed(2)}` : '–';

      card.innerHTML = `
        <div class="lit-card-header">
          <span class="lit-card-title">リチウム市況モニター</span>
          <span class="lit-badge ${badge.cls}">${badge.dot} ${badge.label}</span>
        </div>
        <div class="lit-card-body">
          <div class="lit-proxy-row">
            <span class="lit-proxy-label">LIT（リチウム ETF プロキシ）</span>
            <span class="lit-proxy-price">${priceStr}</span>
          </div>
          <div class="lit-pct-row">
            <span class="lit-pct-item"><span class="lit-pct-lbl">1d</span><span class="lit-pct-val ${dayPct != null && dayPct >= 0 ? 'pos' : 'neg'}">${_fmtPct(dayPct)}</span></span>
            <span class="lit-pct-item"><span class="lit-pct-lbl">1m</span><span class="lit-pct-val ${pct1m != null && pct1m >= 0 ? 'pos' : 'neg'}">${_fmtPct(pct1m)}</span></span>
            <span class="lit-pct-item"><span class="lit-pct-lbl">3m</span><span class="lit-pct-val ${pct3m != null && pct3m >= 0 ? 'pos' : 'neg'}">${_fmtPct(pct3m)}</span></span>
          </div>
          <div class="lit-card-note">${badge.note}</div>
          <div class="lit-card-context">REMX 保有前提 = リチウム回復基調継続。崩れの兆候 = REMX 逆風化。</div>
          <div class="lit-card-disclaimer">※ 現物スポット価格ではなく LIT ETF プロキシ連動。参考値のみ（能動売買はしない）。</div>
        </div>
      `;
    } catch {
      card.innerHTML = '<div class="lit-card-loading">リチウム市況の取得に失敗しました。</div>';
    }
  })();

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
    .then(async (idx) => {
      const issues = (idx.issues || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
      if (!issues.length) {
        panel.innerHTML = '<div class="bf-msg">まだ Briefing がありません。</div>';
        return;
      }
      const latest = issues[0];
      const latestUrl = _briefingUrl(latest.path);
      if (!latestUrl) throw new Error('invalid briefing path');

      panel.textContent = '';

      const litCard = await _buildLitCard();
      panel.appendChild(litCard);

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
    .catch(async () => {
      panel.textContent = '';
      const litCard = await _buildLitCard();
      panel.appendChild(litCard);
      const errMsg = document.createElement('div');
      errMsg.className = 'bf-msg bf-err';
      errMsg.textContent = 'Briefing の読み込みに失敗しました。';
      panel.appendChild(errMsg);
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
