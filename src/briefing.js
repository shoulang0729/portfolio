// @ts-check

// ══════════════════════════════════════════════════════════════
// briefing.js  ―  週次 Briefing タブ
//
// data/briefings/index.json を読み、最新号を iframe で表示し、
// その下に過去号のリンクを並べる。中身は自己完結のモバイルHTML
// （MulmoClaude の週次タスクが生成・コミットする）。
// ══════════════════════════════════════════════════════════════

let _loaded = false;
/** @type {HTMLIFrameElement|null} */
let _frame = null;
let _themeObserver = null;

// オンデマンド生成（ハイブリッド方式）: ボタン→Telegram壁打ちに飛ぶ。生成はMulmoClaude側。
const TG_ONDEMAND_URL = `https://t.me/toshio_claude_bot?text=${encodeURIComponent('Briefingを今すぐ作って')}`;

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
  } catch { /* cross-origin 等は無視 */ }
}

/** 親アプリの data-theme 変化を監視して iframe に伝搬（一度だけ設置） */
function _ensureThemeObserver() {
  if (_themeObserver) return;
  _themeObserver = new MutationObserver(_syncFrameTheme);
  _themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
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
    .then(r => {
      if (!r.ok) throw new Error(`index ${r.status}`);
      return r.json();
    })
    .then(idx => {
      const issues = (idx.issues || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
      if (!issues.length) {
        panel.innerHTML = '<div class="bf-msg">まだ Briefing がありません。</div>';
        return;
      }
      const latest = issues[0];
      const past   = issues.slice(1);
      const pastHtml = past.length
        ? past.map(p => `<a class="bf-past-item" href="${p.path}" target="_blank" rel="noopener"><span class="bf-past-name">${_esc(p.title)}</span><span class="bf-past-date">${_esc(p.date)}</span></a>`).join('')
        : '<div class="bf-none">過去号はまだありません</div>';

      panel.innerHTML = `<div class="bf-wrap"><div class="bf-toolbar"><span class="bf-cur">${_esc(latest.title)}</span><span class="bf-actions"><a class="bf-ondemand" href="${TG_ONDEMAND_URL}" target="_blank" rel="noopener">💬 今すぐ生成</a><button class="bf-reload" data-action="reloadBriefing" title="再読み込み">↻</button></span></div><iframe class="bf-frame" src="${latest.path}?_=${Date.now()}" title="${_esc(latest.title)}" loading="lazy"></iframe><div class="bf-past"><div class="bf-past-head">過去の Briefing</div>${pastHtml}</div></div>`;

      // 同一オリジンなので iframe を中身の高さにフィットさせ、テーマを伝搬
      _frame = /** @type {HTMLIFrameElement|null} */ (panel.querySelector('.bf-frame'));
      if (_frame) {
        _frame.addEventListener('load', () => {
          _syncFrameTheme();
          try {
            const h = _frame?.contentWindow?.document?.body?.scrollHeight;
            if (h) _frame.style.height = `${h + 24}px`;
          } catch { /* cross-origin 等は無視 */ }
        });
        _ensureThemeObserver();
      }
      _loaded = true;
    })
    .catch(() => {
      panel.innerHTML = '<div class="bf-msg bf-err">Briefing の読み込みに失敗しました。</div>';
    });
}

/** 再読み込み（ツールバーの ↻ ボタンから） */
export function reloadBriefing() { renderBriefing(true); }

/**
 * @param {string} s
 * @returns {string}
 */
function _esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}
