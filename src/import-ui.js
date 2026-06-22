// ══════════════════════════════════════════════════════════════
// import-ui.js  ―  資産取込モーダルUI
//
// 依存: import-parse.js (parseManexFiles, parseMoneyForwardImage),
//       positions-store.js (savePositionsToKV, computeImportDiff, mergeDuplicatePositions),
//       funds.js (canonicalizeFundPosition),
//       data.js (clearCacheSession, refreshPrices),
//       state.js (state), positions.js (positions)
// ══════════════════════════════════════════════════════════════

import { state } from './state.js';
import { positions } from './positions.js';
import { canonicalizeFundPosition } from './funds.js';
import { savePositionsToKV, computeImportDiff, mergeDuplicatePositions } from './positions-store.js';
import { clearCacheSession, clearHistoricalIDB, refreshPrices } from './data.js';
import { parseManexFiles, parseMoneyForwardImage } from './import-parse.js';
import { renderHeatmapList } from './stock-list.js';
import { _hashPin } from './auth-pin.js';

let _importState = { source: null, parsed: [], current: [], pendingPositions: [] };
// 取込操作の世代番号。open/close のたびに ++ し、進行中の async 処理は
// 開始時に捕捉した世代と現在値を照合して、stale な継続を破棄する（#176）。
let _importGen = 0;

function openImportModal(source) {
  _importGen++;
  _importState = { source, parsed: [], current: [...positions] };
  const overlay = document.getElementById('import-modal-overlay');
  const title   = document.getElementById('import-modal-title');
  if (!overlay) return;
  title.textContent = source === 'manex' ? 'マネックス証券 取込' : 'マネーフォワード 取込';
  _renderImportStep('select');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function openManagePositionsModal() {
  _importGen++;
  // 整理モーダル表示時点で投信名を canonical 化（プレビューでも正しく見える）
  const normalized = positions.map(canonicalizeFundPosition);
  _importState = { source: 'manage', parsed: normalized, current: [...positions] };
  const overlay = document.getElementById('import-modal-overlay');
  const title   = document.getElementById('import-modal-title');
  if (!overlay) return;
  title.textContent = '保有銘柄を整理';
  _renderImportStep('review');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function closeImportModal() {
  _importGen++;
  const overlay = document.getElementById('import-modal-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  setTimeout(() => { overlay.style.display = 'none'; }, 220);
  _importState = { source: null, parsed: [], current: [] };
}

function handleImportOverlayClick(e) {
  if (e.target === document.getElementById('import-modal-overlay')) closeImportModal();
}

function focusImportFileInput() {
  const isManex = _importState.source === 'manex';
  const inputId = isManex ? 'import-manex-input' : 'import-mf-input';
  document.getElementById(inputId)?.click();
}

function _renderImportStep(step, payload) {
  const body = document.getElementById('import-modal-body');
  if (!body) return;

  if (step === 'select') {
    const isManex = _importState.source === 'manex';
    body.innerHTML = `
      <div class="import-select-area" id="import-drop-zone">
        <div class="import-icon">${isManex ? '📄' : '📷'}</div>
        <div class="import-select-title">${isManex ? 'CSVファイルを選択' : 'スクリーンショットを選択'}</div>
        <div class="import-select-hint">${isManex ? '国内株・米国株・投資信託の3ファイルまとめて選択できます' : 'マネーフォワードの資産一覧画面のスクショ'}</div>
        <button class="import-file-btn" data-action="focusImportFileInput">
          ファイルを選択
        </button>
      </div>`;
  }

  if (step === 'loading') {
    body.innerHTML = `
      <div class="import-loading">
        <div class="import-spinner"></div>
        <div class="import-loading-text">${payload || '解析中...'}</div>
      </div>`;
  }

  if (step === 'error') {
    body.innerHTML = `
      <div class="import-error-msg">
        <div>⚠️ ${escapeHTML(payload || '解析に失敗しました')}</div>
        <button class="import-file-btn" style="margin-top:12px" data-action="_renderImportStep" data-arg="select">やり直す</button>
      </div>`;
  }

  if (step === 'review') {
    let html = `<div class="import-review">`;

    if (_importState.source === 'manage') {
      // 管理モード: parsed をそのまま列挙し、インデックスで紐付け（重複symbol対応）
      html += `<div class="import-review-summary">保有銘柄 ${_importState.parsed.length}件 · <span style="color:var(--text2);font-weight:400">チェックを外すと削除されます</span></div>`;
      html += `<div class="import-list">`;
      _importState.parsed.forEach((p, i) => {
        html += _importRow(p, 'same', true, null, i);
      });
      html += `</div>`;
    } else {
      const { added, removed, changed } = computeImportDiff(
        _importState.current, _importState.parsed
      );
      // 重複検出（同 symbol が parsed 内に複数）→ ユーザーへ表示
      const symCount = {};
      _importState.parsed.forEach(p => { symCount[p.symbol] = (symCount[p.symbol] || 0) + 1; });
      const dupSymCount = Object.values(symCount).filter(n => n > 1).length;

      html += `<div class="import-review-summary">${_importState.parsed.length}銘柄を検出`;
      if (added.length)    html += ` · <span class="imp-badge new">${added.length}件新規</span>`;
      if (changed.length)  html += ` · <span class="imp-badge chg">${changed.length}件変更</span>`;
      if (dupSymCount)     html += ` · <span class="imp-badge chg">${dupSymCount}銘柄に重複行あり（保存時に合算）</span>`;
      html += `</div>`;

      // parsed を元の順序のままインデックス付きで描画（重複行も個別に uncheck 可能）
      const addedSyms   = new Set(added.map(p => p.symbol));
      const changedKeys = new Set(changed.map(p => p.symbol));
      html += `<div class="import-list">`;
      _importState.parsed.forEach((p, idx) => {
        let type = 'same';
        let hint = '';
        if (addedSyms.has(p.symbol)) {
          type = 'new';
        } else if (changedKeys.has(p.symbol)) {
          type = 'chg';
          const cur = _importState.current.find(c => c.symbol === p.symbol);
          if (cur) hint = `${cur.shares}→${p.shares}株 / @${cur.avgCost}→@${p.avgCost}`;
        }
        html += _importRow(p, type, true, hint, idx);
      });
      html += `</div>`;

      // 今回のファイルにない既存銘柄（デフォルト保持・チェックで削除）
      if (removed.length > 0) {
        html += `<details class="import-kept-section">
          <summary class="import-kept-title">今回のファイルにない既存銘柄 (${removed.length}件) — デフォルトで保持</summary>
          <div class="import-kept-note">チェックすると削除されます。チェックなし = そのまま残す</div>
          <div class="import-list">`;
        for (const p of removed) html += _importRow(p, 'del', false);
        html += `</div></details>`;
      }
    }

    const confirmLabel = _importState.source === 'manage' ? '保存 →' : '取込確定 →';
    html += `<div class="import-footer">
      <button class="import-cancel-btn" data-action="closeImportModal">キャンセル</button>
      <button class="import-confirm-btn" data-action="_confirmImport">${confirmLabel}</button>
    </div>`;
    html += `</div>`;
    body.innerHTML = html;
  }

  if (step === 'pin-auth') {
    body.innerHTML = `
      <div class="import-pin-auth">
        <div class="import-pin-msg">🔒 PIN認証に失敗しました。PINを入力してください。</div>
        <input type="password" id="import-pin-input" class="import-pin-input"
          inputmode="numeric" maxlength="6" placeholder="••••••">
        <div class="import-footer">
          <button class="import-cancel-btn" data-action="closeImportModal">キャンセル</button>
          <button class="import-confirm-btn" data-action="_retryWithPin">保存する →</button>
        </div>
      </div>`;
    requestAnimationFrame(() => {
      const pinInput = document.getElementById('import-pin-input');
      if (pinInput) {
        pinInput.focus();
        pinInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') _retryWithPin();
        });
      }
    });
  }

  if (step === 'saving') {
    body.innerHTML = `
      <div class="import-loading">
        <div class="import-spinner"></div>
        <div class="import-loading-text">保存中...</div>
      </div>`;
  }

  if (step === 'done') {
    body.innerHTML = `
      <div class="import-done">
        <div class="import-done-icon">✓</div>
        <div class="import-done-text">${escapeHTML(payload || '取込が完了しました')}</div>
        <button class="import-confirm-btn" data-action="closeImportModal">閉じる</button>
      </div>`;
  }
}

function _importRow(p, type, checked, hint, idx) {
  const label = { new: '新規', chg: '変更', same: '', del: '削除予定' }[type];
  const badgeHtml = label
    ? `<span class="imp-badge ${type}">${label}</span>`
    : '';
  const hintHtml = hint
    ? `<span class="imp-row-hint">${escapeHTML(hint)}</span>`
    : '';
  const idxAttr = (idx != null) ? ` data-idx="${idx}"` : '';
  return `<label class="import-row">
    <input type="checkbox" class="import-cb" data-symbol="${escapeHTML(p.symbol)}"
      data-type="${type}"${idxAttr} ${checked ? 'checked' : ''}>
    <span class="imp-sym">${escapeHTML(p.symbol)}</span>
    <span class="imp-name">${escapeHTML(p.name)}</span>
    ${hintHtml}
    ${badgeHtml}
    <span class="imp-meta">${escapeHTML(p.shares)}株 @${escapeHTML(p.avgCost)}</span>

  </label>`;
}

async function _confirmImport() {
  const body = document.getElementById('import-modal-body');
  const cbs  = body?.querySelectorAll('.import-cb');
  if (!cbs) return;

  let finalPositions;
  if (_importState.source === 'manage') {
    // 管理モード: チェックされた行のインデックスで parsed をフィルタ（重複symbol対応）
    const keepIdx = new Set(
      [...cbs]
        .filter(cb => cb.checked && cb.dataset.idx != null)
        .map(cb => Number(cb.dataset.idx))
    );
    finalPositions = _importState.parsed.filter((_, i) => keepIdx.has(i));
  } else {
    // インポートモード（manex / moneyforward）:
    //  - parsed のうちチェック済みインデックスを採用（重複symbol対応で symbol ではなく idx で判定）
    //  - removed (del) のうちチェック済みは current から除外
    const parsedKeepIdx = new Set(
      [...cbs]
        .filter(cb => cb.checked && cb.dataset.type !== 'del' && cb.dataset.idx != null)
        .map(cb => Number(cb.dataset.idx))
    );
    const delSymbols = new Set(
      [...cbs].filter(cb => cb.checked && cb.dataset.type === 'del').map(cb => cb.dataset.symbol)
    );
    const newPositions = _importState.parsed.filter((_, i) => parsedKeepIdx.has(i));
    const incomingSymbols = new Set(newPositions.map(p => p.symbol));
    const oldKept = _importState.current.filter(p =>
      !incomingSymbols.has(p.symbol) && !delSymbols.has(p.symbol)
    );
    finalPositions = [...newPositions, ...oldKept];
  }

  // 投資信託の銘柄名・シンボルを canonical 化（マイクロプラス → ひふみマイクロスコープpro 等）
  finalPositions = finalPositions.map(canonicalizeFundPosition);
  // 同一 symbol を1件にマージ（保有数合算・取得単価加重平均）
  finalPositions = mergeDuplicatePositions(finalPositions);

  const gen = _importGen;
  _importState.pendingPositions = finalPositions;

  _renderImportStep('saving');
  await _doSavePositions(finalPositions, undefined, gen);
}

async function _doSavePositions(finalPositions, pinHashOverride, gen) {
  // モーダルが閉じ/再オープンされた場合はモーダルへの描画のみ抑止する。
  // 保存とグローバル再描画はデータ整合性のため常に実行する（#176）。
  const stale = () => (gen !== undefined && gen !== _importGen);
  try {
    await savePositionsToKV(finalPositions, pinHashOverride);
    positions.splice(0, positions.length, ...finalPositions);
    await clearHistoricalIDB(); // IDB・メモリキャッシュを両方クリア
    clearCacheSession();
    state.lastUpdateText = null;
    if (!stale()) _renderImportStep('done', `${finalPositions.length}銘柄を保存しました`);
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('hm:prices-updated'));
      renderHeatmapList();
      refreshPrices();
    }, 300);
  } catch (e) {
    if (stale()) return;
    if (e.message.includes('PIN認証失敗')) {
      _renderImportStep('pin-auth');
    } else if (e.name === 'AbortError' || e.message.includes('aborted')) {
      _renderImportStep('error', '保存がタイムアウトしました。もう一度お試しください。');
    } else {
      _renderImportStep('error', `保存に失敗しました: ${e.message}`);
    }
  }
}

async function _retryWithPin() {
  const gen = _importGen;
  const pinInput = document.getElementById('import-pin-input');
  const pin = pinInput?.value?.trim();
  if (!pin) { if (pinInput) pinInput.focus(); return; }

  const pinHash = await _hashPin(pin);
  if (gen !== _importGen) return; // モーダルが閉じ/再オープンされた

  const finalPositions = _importState.pendingPositions;
  if (!finalPositions?.length) { closeImportModal(); return; }
  _renderImportStep('saving');
  await _doSavePositions(finalPositions, pinHash, gen);
  // 保存成功後にのみ PIN ハッシュをローカルに記録（誤入力で上書きしないため）
  if (gen === _importGen) localStorage.setItem('hm-pin-hash', pinHash);
}

// ── ファイル選択ハンドラ ──────────────────────────────────────────────────

async function handleManexFileSelect(event) {
  const gen = _importGen;
  // Array.from でコピーしてからクリア（FileList はクリアで空になるブラウザがある）
  const files = Array.from(event.target.files || []);
  event.target.value = '';
  if (files.length === 0) return;
  _renderImportStep('loading', 'CSVを解析中...');
  const parsed = await parseManexFiles(files);
  if (gen !== _importGen) return; // モーダルが閉じ/再オープンされた → 破棄
  if (!parsed || parsed.length === 0) {
    _renderImportStep('error', 'CSVを解析できませんでした。マネックス証券のCSVファイルを選択してください。');
    return;
  }
  _importState.parsed = parsed;
  _renderImportStep('review');
}

async function handleMoneyForwardImageSelect(event) {
  const gen = _importGen;
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  _renderImportStep('loading', 'AIで資産情報を読み取り中...');
  try {
    const parsed = await parseMoneyForwardImage(file);
    if (gen !== _importGen) return; // モーダルが閉じ/再オープンされた → 破棄
    if (parsed.length === 0) {
      _renderImportStep('error', 'AIが資産情報を検出できませんでした。資産一覧が写ったスクリーンショットをお試しください。');
      return;
    }
    _importState.parsed = parsed;
    _renderImportStep('review');
  } catch (e) {
    if (gen !== _importGen) return;
    console.error('[import-ui] MF image handler error:', e);
    _renderImportStep('error', e.message);
  }
}

// ── HTML エスケープ（モーダル内のXSS対策）────────────────────────────────
function escapeHTML(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export { openImportModal, closeImportModal, openManagePositionsModal, handleImportOverlayClick, handleManexFileSelect, handleMoneyForwardImageSelect, focusImportFileInput, _renderImportStep, _confirmImport, _retryWithPin };
