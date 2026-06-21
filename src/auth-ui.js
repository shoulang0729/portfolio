// ══════════════════════════════════════════════════════════════
// auth-ui.js  ―  PIN ログイン / PIN 変更ダイアログ UI
//
// 依存: auth-pin.js (_auth, AUTH_*, _hashPin, isAuthenticated, _isLocked, _lockRemain),
//       auth-crypto.js (_deriveEncKey, _restoreEncKey),
//       data.js (WORKER_URL)
// 注: authenticatePasskey は window に登録されるため直接 import しない（循環回避）
// ══════════════════════════════════════════════════════════════

import { _auth, AUTH_PIN_LEN, AUTH_MAX_FAIL, AUTH_LOCK_SEC, AUTH_SESSION_KEY, AUTH_LS_HASH_KEY, AUTH_FAILS_KEY, _getActivePinHash, _hashPin, _isLocked, _lockRemain, _formatLockRemain, _saveLockout, isAuthenticated } from './auth-pin.js';
import { _deriveEncKey, _restoreEncKey } from './auth-crypto.js';
import { WORKER_URL } from './config.js';

// ── フォーカストラップ（PIN オーバーレイがキーボードフォーカスを保持する） ──
function _trapFocus(container) {
  const focusable = container.querySelectorAll('button:not([disabled])');
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  container.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  });
  first.focus();
}

// ── キーパッド制御 ──
function _setKeypadEnabled(on) {
  document.querySelectorAll('#pin-overlay .pin-key').forEach(b => { b.disabled = !on; });
}

// ── ドット更新 ──
function _updateDots() {
  document.querySelectorAll('#pin-overlay .pin-dot').forEach((d, i) =>
    d.classList.toggle('filled', i < _auth.input.length));
}

// ── エラー ──
function _showError(msg) {
  const el = document.getElementById('pin-error');
  if (el) { el.textContent = msg; el.classList.add('visible'); }
}
function _hideError() {
  const el = document.getElementById('pin-error');
  if (el) { el.textContent = ''; el.classList.remove('visible'); }
}
function _lockRemainMessage(seconds = _lockRemain()) {
  return `${_formatLockRemain(seconds)}後に再試行できます`;
}

// ── シェイク / サクセス ──
function _shake(type) {
  const el = document.getElementById('pin-dots');
  if (!el) return;
  el.classList.remove('shake', 'success');
  void el.offsetWidth;
  el.classList.add(type);
  if (type === 'shake') setTimeout(() => el.classList.remove('shake'), 500);
}

// ══════════════════════════════════════════════
// ログイン キーパッド（グローバル関数）
// ══════════════════════════════════════════════
let _authSubmitTimer = null;

function _queueAuthSubmit() {
  if (_authSubmitTimer) return;
  _setKeypadEnabled(false);
  _authSubmitTimer = setTimeout(() => {
    _authSubmitTimer = null;
    _submitPin();
  }, 180);
}

function authKeyPress(n) {
  if (_authSubmitTimer) return;
  if (_isLocked()) { _showError(_lockRemainMessage()); return; }
  if (_auth.input.length >= AUTH_PIN_LEN) return;
  _auth.input += n;
  _updateDots();
  _hideError();
  if (_auth.input.length === AUTH_PIN_LEN) _queueAuthSubmit();
}

function authBackspace() {
  if (_authSubmitTimer) return;
  if (_isLocked()) return;
  if (_auth.input.length > 0) {
    _auth.input = _auth.input.slice(0, -1);
    _updateDots();
    _hideError();
  }
}

// ── PIN 照合 ──
async function _submitPin() {
  _setKeypadEnabled(false);
  const activeHash = _getActivePinHash();
  if (!activeHash) {
    _auth.input = '';
    _updateDots();
    _showError('初回PIN設定を完了してください');
    _setKeypadEnabled(true);
    return;
  }
  const hash = await _hashPin(_auth.input);

  if (hash === activeHash) {
    _auth.fails = 0;
    localStorage.removeItem(AUTH_FAILS_KEY);
    sessionStorage.setItem(AUTH_SESSION_KEY, '1');
    await _deriveEncKey(_auth.input);
    _shake('success');
    document.querySelectorAll('#pin-overlay .pin-dot').forEach(d => d.classList.add('filled'));

    setTimeout(() => {
      _showChangePinButton();
      const ov = document.getElementById('pin-overlay');
      if (ov) {
        ov.style.opacity = '0';
        setTimeout(() => { ov.remove(); document.body.style.overflow = ''; }, 380);
      }
    }, 350);

  } else {
    _auth.fails++;
    localStorage.setItem(AUTH_FAILS_KEY, String(_auth.fails));
    _auth.input = '';
    _updateDots();
    _shake('shake');

    if (_auth.fails >= AUTH_MAX_FAIL) {
      _auth.lockedUntil = Date.now() + AUTH_LOCK_SEC * 1000;
      _saveLockout();
      _showError(`${AUTH_MAX_FAIL}回失敗。${_lockRemainMessage(AUTH_LOCK_SEC)}`);
      const _t = setInterval(() => {
        if (!_isLocked()) {
          clearInterval(_t);
          _auth.fails = 0; _auth.lockedUntil = null;
          _saveLockout();
          _setKeypadEnabled(true); _hideError();
        } else { _showError(_lockRemainMessage()); }
      }, 1000);
    } else {
      _showError(`PINが違います（残り${AUTH_MAX_FAIL - _auth.fails}回）`);
      _setKeypadEnabled(true);
    }
  }
}

// ── キーボード入力（ログイン画面） ──
document.addEventListener('keydown', e => {
  if (document.getElementById('pin-overlay')) {
    if (e.key >= '0' && e.key <= '9') authKeyPress(e.key);
    else if (e.key === 'Backspace') authBackspace();
    e.stopPropagation();
  }
});

// ══════════════════════════════════════════════
// ログイン画面 DOM
// ══════════════════════════════════════════════
function _buildPinScreen() {
  const ov = document.createElement('div');
  ov.id = 'pin-overlay';
  ov.innerHTML = `
    <div class="pin-card">
      <svg class="pin-lock-icon" width="36" height="42" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="19" width="32" height="23" rx="7" stroke="currentColor" stroke-width="2.4" fill="none"/>
        <path d="M9 19V12.5C9 8.36 13.03 5 18 5s9 3.36 9 7.5V19" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/>
        <circle cx="18" cy="30.5" r="3.5" fill="currentColor"/>
        <line x1="18" y1="30.5" x2="18" y2="35" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
      </svg>
      <div class="pin-title">Portfolio Manager</div>
      <button class="pin-passkey-btn" data-action="authenticatePasskey" title="パスキー（指紋/顔認証）でログイン">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px">
          <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/>
          <path d="M14 13.12c0 2.38 0 6.38-1 8.88"/>
          <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/>
          <path d="M2 12a10 10 0 0 1 18-6"/>
          <path d="M2 16h.01"/>
          <path d="M21.8 16c.2-2 .131-5.354 0-6"/>
          <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/>
          <path d="M8.65 22c.21-.66.45-1.32.57-2"/>
          <path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>
        </svg>パスキーでログイン
      </button>
      <div class="pin-subtitle">PINでログイン</div>
      <div class="pin-dots" id="pin-dots">
        <span class="pin-dot"></span><span class="pin-dot"></span>
        <span class="pin-dot"></span><span class="pin-dot"></span>
        <span class="pin-dot"></span><span class="pin-dot"></span>
      </div>
      <div class="pin-error" id="pin-error"></div>
      ${_pinKeypadHTML('authKeyPress', 'authBackspace')}
    </div>`;
  return ov;
}

// ── 共有キーパッド HTML ──
function _pinKeypadHTML(pressAction, backAction) {
  return `<div class="pin-keypad">
    ${'123456789'.split('').map(n =>
      `<button class="pin-key" data-action="${pressAction}" data-arg="${n}">${n}</button>`
    ).join('')}
    <span class="pin-key-empty"></span>
    <button class="pin-key" data-action="${pressAction}" data-arg="0">0</button>
    <button class="pin-key pin-key-back" data-action="${backAction}" aria-label="削除">
      <svg width="22" height="16" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 1H20a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-7-7 7-7z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/>
        <line x1="12" y1="6" x2="17" y2="11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        <line x1="17" y1="6" x2="12" y2="11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      </svg>
    </button>
  </div>`;
}

// ══════════════════════════════════════════════
// PIN 変更ダイアログ
// ══════════════════════════════════════════════

const _pc = {
  step:    0,   // 1=現在PIN確認 2=新PIN入力 3=新PIN確認
  input:   '',
  newPin:  '',
  submitTimer: null,
  mode: 'change', // change | setup | recover
};

const _pcStepLabel = ['', '現在のPIN', '新しいPIN（6桁）', '新しいPIN（確認）'];
const _pcStepHint  = ['', '認証のため現在のPINを入力', '新しい6桁のPINを入力', '同じPINをもう一度入力'];
const _pcRecoverStepLabel = ['', '現在のPIN', '既存PIN（6桁）', '既存PIN（確認）'];
const _pcRecoverStepHint  = ['', '認証のため現在のPINを入力', 'サーバーに保存済みのPINを入力', '同じPINをもう一度入力'];

function _pcLabelForStep(step) {
  return (_pc.mode === 'recover' ? _pcRecoverStepLabel : _pcStepLabel)[step];
}

function _pcHintForStep(step) {
  return (_pc.mode === 'recover' ? _pcRecoverStepHint : _pcStepHint)[step];
}

function _pcUpdateDots() {
  document.querySelectorAll('#pc-dots .pin-dot').forEach((d, i) =>
    d.classList.toggle('filled', i < _pc.input.length));
}
function _pcSetTitle() {
  const lbl  = document.getElementById('pc-step-label');
  const hint = document.getElementById('pc-step-hint');
  const prog = document.querySelectorAll('#pc-progress .pc-prog-dot');
  if (lbl)  lbl.textContent  = _pcLabelForStep(_pc.step);
  if (hint) hint.textContent = _pcHintForStep(_pc.step);
  prog.forEach((d, i) => d.classList.toggle('active', i < _pc.step));
}
function _pcShowError(msg) {
  const el = document.getElementById('pc-error');
  if (el) { el.textContent = msg; el.classList.add('visible'); }
}
function _pcHideError() {
  const el = document.getElementById('pc-error');
  if (el) { el.textContent = ''; el.classList.remove('visible'); }
}
function _pcShake() {
  const el = document.getElementById('pc-dots');
  if (!el) return;
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}
function _pcSetKeypadEnabled(on) {
  document.querySelectorAll('#pc-overlay .pin-key').forEach(b => { b.disabled = !on; });
}
function _pcQueueSubmit() {
  if (_pc.submitTimer) return;
  _pcSetKeypadEnabled(false);
  _pc.submitTimer = setTimeout(() => {
    _pc.submitTimer = null;
    _pcSubmit();
  }, 180);
}
function _pcSuccess() {
  const el = document.getElementById('pc-dots');
  if (el) { el.classList.add('success'); }
  const lbl  = document.getElementById('pc-step-label');
  const hint = document.getElementById('pc-step-hint');
  if (lbl)  lbl.textContent  = '✅ 変更完了';
  if (hint) hint.textContent = _pc.mode === 'recover' ? '既存PINでログインしました' : '新しいPINが保存されました';
  document.querySelectorAll('#pc-dots .pin-dot').forEach(d => d.classList.add('filled'));
  _pcSetKeypadEnabled(false);
  setTimeout(() => closePinChange(), 1800);
}

async function _pinHashSyncErrorMessage(res) {
  let detail = '';
  try {
    const body = await res.clone().json();
    detail = body?.error || body?.message || '';
  } catch {
    detail = await res.text().catch(() => '');
  }
  if (detail) return detail;
  if (res.status === 401) return '既存のPINと一致しません';
  return `サーバー同期に失敗しました（${res.status}）`;
}

async function _loadServerPinConfigured() {
  const res = await fetch(`${WORKER_URL}/auth/pin-hash`, { method: 'GET', cache: 'no-store' });
  if (!res.ok) throw new Error(`server ${res.status}`);
  const body = await res.json();
  return !!body.configured;
}

async function _initInitialPinMode() {
  const title = document.getElementById('pc-title');
  const hint = document.getElementById('pc-step-hint');
  _pcSetKeypadEnabled(false);
  if (hint) hint.textContent = 'PIN状態を確認中...';
  try {
    const configured = await _loadServerPinConfigured();
    _pc.mode = configured ? 'recover' : 'setup';
    if (title) title.textContent = configured ? 'PIN復旧' : '初回PIN設定';
    _pcSetTitle();
    _pcHideError();
    _pcSetKeypadEnabled(true);
  } catch (e) {
    console.warn('[auth] PIN status check failed:', e);
    _pcShowError('PIN状態の確認に失敗しました。再読み込みしてください。');
  }
}

// PIN 変更キーパッドのグローバルハンドラ
function pcKeyPress(n) {
  if (_pc.submitTimer) return;
  if (_pc.input.length >= AUTH_PIN_LEN) return;
  _pc.input += n;
  _pcUpdateDots();
  _pcHideError();
  if (_pc.input.length === AUTH_PIN_LEN) _pcQueueSubmit();
}
function pcBackspace() {
  if (_pc.submitTimer) return;
  if (_pc.input.length > 0) {
    _pc.input = _pc.input.slice(0, -1);
    _pcUpdateDots();
    _pcHideError();
  }
}

async function _pcSubmit() {
  _pcSetKeypadEnabled(false);
  const hash = await _hashPin(_pc.input);

  if (_pc.step === 1) {
    if (hash !== _getActivePinHash()) {
      _pc.input = ''; _pcUpdateDots(); _pcShake();
      _pcShowError('PINが違います');
      _pcSetKeypadEnabled(true);
      return;
    }
    _pc.step = 2; _pc.input = '';
    _pcUpdateDots(); _pcSetTitle(); _pcHideError();
    _pcSetKeypadEnabled(true);

  } else if (_pc.step === 2) {
    _pc.newPin = _pc.input;
    _pc.step = 3; _pc.input = '';
    _pcUpdateDots(); _pcSetTitle(); _pcHideError();
    _pcSetKeypadEnabled(true);

  } else if (_pc.step === 3) {
    if (_pc.input !== _pc.newPin) {
      _pc.input = ''; _pcUpdateDots(); _pcShake();
      _pcShowError('PINが一致しません');
      _pcSetKeypadEnabled(true);
      return;
    }
    const prevHash = _getActivePinHash();
    const newHash = await _hashPin(_pc.newPin);
    try {
      const res = await fetch(`${WORKER_URL}/auth/pin-hash`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prevHash ? { oldHash: prevHash, newHash } : { newHash }),
      });
      if (!res.ok) throw new Error(await _pinHashSyncErrorMessage(res));
    } catch (e) {
      console.warn('[auth] PIN hash sync to Worker failed:', e);
      _pcShowError(e?.message || 'サーバー同期に失敗しました。再度お試しください。');
      _pcSetKeypadEnabled(true);
      return;
    }
    localStorage.setItem(AUTH_LS_HASH_KEY, newHash);
    sessionStorage.setItem(AUTH_SESSION_KEY, '1');
    await _deriveEncKey(_pc.newPin);
    _showChangePinButton();
    _pcSuccess();
  }
}

function openInitialPinSetup() {
  if (document.getElementById('pc-overlay')) return;
  if (_pc.submitTimer) { clearTimeout(_pc.submitTimer); _pc.submitTimer = null; }
  _pc.mode = 'setup'; _pc.step = 2; _pc.input = ''; _pc.newPin = '';

  const ov = document.createElement('div');
  ov.id = 'pc-overlay';
  ov.innerHTML = `
    <div class="pin-card pc-card">
      <div class="pc-header">
        <span class="pc-title" id="pc-title">PIN確認中</span>
      </div>

      <div class="pc-progress" id="pc-progress">
        <span class="pc-prog-dot active"></span>
        <span class="pc-prog-line"></span>
        <span class="pc-prog-dot active"></span>
      </div>

      <div class="pin-subtitle" id="pc-step-label">${_pcLabelForStep(2)}</div>
      <div class="pc-hint" id="pc-step-hint">PIN状態を確認中...</div>

      <div class="pin-dots" id="pc-dots">
        <span class="pin-dot"></span><span class="pin-dot"></span>
        <span class="pin-dot"></span><span class="pin-dot"></span>
        <span class="pin-dot"></span><span class="pin-dot"></span>
      </div>
      <div class="pin-error" id="pc-error"></div>

      ${_pinKeypadHTML('pcKeyPress', 'pcBackspace')}
    </div>`;
  document.body.appendChild(ov);

  const ac = new AbortController();
  ov._kbAbort = ac;
  document.addEventListener('keydown', e => {
    if (e.key >= '0' && e.key <= '9') pcKeyPress(e.key);
    else if (e.key === 'Backspace') pcBackspace();
  }, { signal: ac.signal });

  requestAnimationFrame(() => requestAnimationFrame(() => { ov.style.opacity = '1'; _trapFocus(ov); }));
  _initInitialPinMode();
}

// ── PIN 変更ダイアログを開く ──
function openPinChange() {
  if (document.getElementById('pc-overlay')) return;
  if (_pc.submitTimer) { clearTimeout(_pc.submitTimer); _pc.submitTimer = null; }
  _pc.mode = 'change'; _pc.step = 1; _pc.input = ''; _pc.newPin = '';

  const ov = document.createElement('div');
  ov.id = 'pc-overlay';
  ov.innerHTML = `
    <div class="pin-card pc-card">
      <div class="pc-header">
        <span class="pc-title">PINを変更</span>
        <button class="pc-close" data-action="closePinChange" aria-label="閉じる">✕</button>
      </div>

      <div class="pc-progress" id="pc-progress">
        <span class="pc-prog-dot active"></span>
        <span class="pc-prog-line"></span>
        <span class="pc-prog-dot"></span>
        <span class="pc-prog-line"></span>
        <span class="pc-prog-dot"></span>
      </div>

      <div class="pin-subtitle" id="pc-step-label">${_pcStepLabel[1]}</div>
      <div class="pc-hint" id="pc-step-hint">${_pcStepHint[1]}</div>

      <div class="pin-dots" id="pc-dots">
        <span class="pin-dot"></span><span class="pin-dot"></span>
        <span class="pin-dot"></span><span class="pin-dot"></span>
        <span class="pin-dot"></span><span class="pin-dot"></span>
      </div>
      <div class="pin-error" id="pc-error"></div>

      ${_pinKeypadHTML('pcKeyPress', 'pcBackspace')}
    </div>`;
  document.body.appendChild(ov);

  const ac = new AbortController();
  ov._kbAbort = ac;
  document.addEventListener('keydown', e => {
    if (e.key >= '0' && e.key <= '9') pcKeyPress(e.key);
    else if (e.key === 'Backspace') pcBackspace();
    else if (e.key === 'Escape') closePinChange();
  }, { signal: ac.signal });

  requestAnimationFrame(() => requestAnimationFrame(() => { ov.style.opacity = '1'; }));
}

function closePinChange() {
  const ov = document.getElementById('pc-overlay');
  if (!ov) return;
  if (_pc.submitTimer) { clearTimeout(_pc.submitTimer); _pc.submitTimer = null; }
  if (ov._kbAbort) ov._kbAbort.abort();
  ov.style.opacity = '0';
  setTimeout(() => ov.remove(), 350);
}

// ══════════════════════════════════════════════
// 認証後にメニューボタンを表示
// ══════════════════════════════════════════════
function _showChangePinButton() {
  for (const id of ['pin-change-btn', 'passkey-register-btn',
                    'import-manex-btn', 'import-mf-btn',
                    'manage-positions-btn', 'snapshot-btn']) {
    const btn = document.getElementById(id);
    if (btn) btn.style.display = '';
  }
}

// ══════════════════════════════════════════════
// 起動時初期化（ログイン画面を出すか、自動でスキップするか）
// ══════════════════════════════════════════════
(function initAuth() {
  if (isAuthenticated()) {
    _restoreEncKey();
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    return; // 認証済みセッション(enc鍵復元済み)は PIN/設定オーバーレイを出さずスキップ。#356 の refactor で消えた早期returnの復活（毎リロード再ログインのリグレッション修正＋E2Eバイパスの復旧）。
  }

  if (!_getActivePinHash()) {
    document.body.style.overflow = 'hidden';
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', openInitialPinSetup);
    } else {
      openInitialPinSetup();
    }
    return;
  }

  document.body.style.overflow = 'hidden';
  const ov = _buildPinScreen();
  document.body.appendChild(ov);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    ov.style.opacity = '1';
    _trapFocus(ov);
  }));

  // ── パスキー画面を自動起動（WebAuthn 対応端末・ローカルにフラグありの場合のみ）
  //    PIN を打ち始める前に Face ID/Touch ID シートを開いてユーザーを混乱させない。
  //    一度パスキーログインに成功するとフラグ ON、初回登録前は自動起動しない。
  if (window.PublicKeyCredential && localStorage.getItem('hm-passkey-seen') === '1') {
    setTimeout(() => {
      if (typeof window.authenticatePasskey === 'function') window.authenticatePasskey();
    }, 250);
  }
}());

export { authKeyPress, authBackspace, pcKeyPress, pcBackspace, openPinChange, closePinChange, _showChangePinButton };
