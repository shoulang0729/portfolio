// @ts-check

// ══════════════════════════════════════════════════════════════
// briefing.js  ―  週次 Briefing タブ
//
// data/briefings/index.json を読み、最新号を iframe で表示する。
// iframe は画面の残り高さにフィットさせ「枠内1スクロール」化（本体HTMLが
// ヘッダ/セクション見出しを sticky 固定）。過去号は下部のプルダウンで切替。
// 「今すぐ生成」リンクは本体HTMLの固定ヘッダ内に移動済み（self-contained）。
// 中身は自己完結のモバイルHTML（MulmoClaude の週次タスクが生成・コミットする）。
// ── リチウム市況モニター（#611）: LIT/ALB プロキシで回復基調を監視 ──
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

      const litPlaceholder = document.createElement('div');
      litPlaceholder.className = 'bf-lit-card';
      litPlaceholder.setAttribute('aria-label', 'リチウム市況モニター');
      litPlaceholder.innerHTML = '<div class="bf-lit-body">リチウム市況を取得中…</div>';
      panel.appendChild(litPlaceholder);

      _buildLithiumCard().then((card) => {
        if (panel.contains(litPlaceholder)) litPlaceholder.replaceWith(card);
        else panel.insertBefore(card, wrap);
      });

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

// ── リチウム市況モニター（#611）────────────────────────────────────────────

/** LIT（Global X Lithium & Battery Tech ETF）をプロキシとして使用 */
const LIT_SYMBOL = 'LIT';

/**
 * historicalCache['1y'][symbol] から 200日移動平均を計算する。
 * データ不足（200本未満）の場合は直近データの平均を返す。
 * @param {string} symbol
 * @returns {number|null}
 */
function _compute200DMA(symbol) {
  const data = state.historicalCache?.['1y']?.[symbol];
  if (!Array.isArray(data) || data.length < 10) return null;
  const slice = data.slice(-200);
  const sum = slice.reduce((s, d) => s + (d.close || 0), 0);
  return sum / slice.length;
}

/**
 * 現在価格と 200DMA から状態を判定する。
 * @param {number} price
 * @param {number|null} dma200
 * @returns {{ status: 'good'|'warn'|'bad', badge: string, desc: string }}
 */
function _litStatus(price, dma200) {
  if (dma200 == null || dma200 <= 0) {
    return { status: 'warn', badge: '🟡 データ取得中', desc: '200日移動平均を算出中（1y 履歴ロード待ち）' };
  }
  const pctVs200 = ((price - dma200) / dma200) * 100;
  if (pctVs200 >= -5) {
    return {
      status: 'good',
      badge: '🟢 回復基調',
      desc: `200日線に対し ${pctVs200 >= 0 ? '+' : ''}${pctVs200.toFixed(1)}%（上方または5%以内）`,
    };
  }
  if (pctVs200 >= -15) {
    return {
      status: 'warn',
      badge: '🟡 中立・要観察',
      desc: `200日線を ${Math.abs(pctVs200).toFixed(1)}% 下回る（軟化・REMX 慎重）`,
    };
  }
  return {
    status: 'bad',
    badge: '🔴 崩れ警戒',
    desc: `200日線を ${Math.abs(pctVs200).toFixed(1)}% 下回る — REMXの前提（リチウム回復）が崩れている可能性。トリム検討を`,
  };
}

/**
 * リチウム市況モニターカード（HTMLElement）を非同期で構築する。
 * @returns {Promise<HTMLElement>}
 */
async function _buildLithiumCard() {
  const card = document.createElement('div');
  card.className = 'bf-lit-card';
  card.setAttribute('aria-label', 'リチウム市況モニター');

  const hdr = document.createElement('div');
  hdr.className = 'bf-lit-hdr';
  hdr.innerHTML =
    '<span class="bf-lit-title">リチウム市況モニター <span class="bf-lit-tag">REMX 保有前提</span></span>';
  card.appendChild(hdr);

  const body = document.createElement('div');
  body.className = 'bf-lit-body';
  body.textContent = 'LIT 価格を取得中…';
  card.appendChild(body);

  const note = document.createElement('div');
  note.className = 'bf-lit-note';
  note.textContent = '※ 現物スポット価格ではなくプロキシ（LIT ETF）連動。200日移動平均との乖離でリチウム市況の方向性を監視。';
  card.appendChild(note);

  try {
    if (!Array.isArray(state.historicalCache?.['1y']?.[LIT_SYMBOL]) ||
        state.historicalCache['1y'][LIT_SYMBOL].length < 10) {
      await fetchSymbolHistory(LIT_SYMBOL, '1y');
    }

    const live = await fetchLivePrice(LIT_SYMBOL);
    if (!live || '_err' in live) throw new Error('price fetch failed');

    const { price, dayPct } = live;
    const dma200 = _compute200DMA(LIT_SYMBOL);
    const { status, badge, desc } = _litStatus(price, dma200);

    const dayStr = dayPct != null
      ? `${dayPct >= 0 ? '+' : ''}${dayPct.toFixed(2)}%`
      : '—';
    const dmaStr = dma200 != null ? `$${dma200.toFixed(2)}` : '—';

    body.innerHTML = `
      <div class="bf-lit-row">
        <div class="bf-lit-proxy">
          <span class="bf-lit-sym">LIT</span>
          <span class="bf-lit-price">$${price.toFixed(2)}</span>
          <span class="bf-lit-day ${dayPct != null && dayPct < 0 ? 'neg' : 'pos'}">${dayStr}</span>
          <span class="bf-lit-dma">200日線: ${dmaStr}</span>
        </div>
        <div class="bf-lit-badge bf-lit-badge--${status}">${badge}</div>
      </div>
      <div class="bf-lit-desc">${desc}</div>
      <div class="bf-lit-context">背景: REMX の約38%を占めるリチウムが 2024 秋〜回復局面。200日線割れが継続する場合は REMX のリスク再評価を推奨。</div>`;
  } catch {
    body.textContent = 'LIT 価格の取得に失敗しました。';
  }

  return card;
}
