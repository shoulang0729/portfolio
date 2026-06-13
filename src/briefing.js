// @ts-check

// ══════════════════════════════════════════════════════════════
// briefing.js  ―  週次 Briefing タブ
//
// data/briefings/index.json を読み、最新号を iframe で表示し、
// その下に過去号のリンクを並べる。中身は自己完結のモバイルHTML
// （MulmoClaude の週次タスクが生成・コミットする）。
// ══════════════════════════════════════════════════════════════

let _loaded = false;

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

      panel.innerHTML = `<div class="bf-wrap"><div class="bf-toolbar"><span class="bf-cur">${_esc(latest.title)}</span><button class="bf-reload" data-action="reloadBriefing" title="再読み込み">↻</button></div><iframe class="bf-frame" src="${latest.path}" title="${_esc(latest.title)}" loading="lazy"></iframe><div class="bf-past"><div class="bf-past-head">過去の Briefing</div>${pastHtml}</div></div>`;

      // 同一オリジンなので iframe を中身の高さにフィットさせる
      const frame = /** @type {HTMLIFrameElement|null} */ (panel.querySelector('.bf-frame'));
      if (frame) {
        frame.addEventListener('load', () => {
          try {
            const h = frame.contentWindow?.document?.body?.scrollHeight;
            if (h) frame.style.height = `${h + 24}px`;
          } catch { /* cross-origin 等は無視 */ }
        });
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
