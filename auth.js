// ══════════════════════════════════════════════════════════════
// auth.js  ―  PIN 認証 + PIN 変更
//
// ■ デフォルト PIN: 1234
//   変更はアプリ内の 🔒 ボタン → 「PINを変更」から行える。
//   変更後の PIN はブラウザの localStorage に保存される。
//   リセットしたい場合: localStorage.removeItem('hm-pin-hash') を console で実行。
// ══════════════════════════════════════════════════════════════

// ── ハードコードされたデフォルト PIN ハッシュ（SHA-256 of "1234"）──
const AUTH_PIN_HASH    = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
const AUTH_SESSION_KEY = 'hm-auth-v1';
const AUTH_LS_HASH_KEY = 'hm-pin-hash'; // localStorage キー
const AUTH_PIN_LEN     = 4;
const AUTH_MAX_FAIL    = 5;
const AUTH_LOCK_SEC    = 30;

// ── 有効な PIN ハッシュ（localStorage 優先） ──
function _getActivePinHash() {
  return localStorage.getItem(AUTH_LS_HASH_KEY) || AUTH_PIN_HASH;
}

// ══════════════════════════════════════════════
// ログイン画面 内部状態
// ══════════════════════════════════════════════
const _auth = {
  input:    '',
  fails:    0,
  lockedAt: null,
  encKey:   null,   // AES-GCM key（PIN から PBKDF2 導出）
};

// ══════════════════════════════════════════════
// AES-GCM 暗号化 / 復号（AI タブの API キー保護）
// ══════════════════════════════════════════════

const _AUTH_ENC_SALT = 'hm-ai-keys-v1';
const _AUTH_ENC_SS   = 'hm-enc-key-v1'; // sessionStorage キー

/** PIN から AES-256-GCM 鍵を PBKDF2 導出して _auth.encKey にセット */
async function _deriveEncKey(pin) {
  const keyMat = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']
  );
  _auth.encKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode(_AUTH_ENC_SALT),
      iterations: 100000, hash: 'SHA-256' },
    keyMat, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  );
  const exported = await crypto.subtle.exportKey('raw', _auth.encKey);
  sessionStorage.setItem(_AUTH_ENC_SS,
    btoa(String.fromCharCode(...new Uint8Array(exported))));
}

/** sessionStorage から鍵を復元（既に認証済みの再読み込み時） */
async function _restoreEncKey() {
  const stored = sessionStorage.getItem(_AUTH_ENC_SS);
  if (!stored) return;
  const bytes = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
  _auth.encKey = await crypto.subtle.importKey(
    'raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
  );
}

/**
 * 平文を AES-GCM で暗号化して Base64 文字列を返す（ai-tab.js から呼ぶ）
 */
async function aiEncrypt(plaintext) {
  if (!_auth.encKey) await _restoreEncKey();
  if (!_auth.encKey) throw new Error('セッションが切れました。ページを再読み込みしてPINを入力してください。');
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, _auth.encKey, new TextEncoder().encode(plaintext)
  );
  const buf = new Uint8Array(12 + enc.byteLength);
  buf.set(iv); buf.set(new Uint8Array(enc), 12);
  return btoa(String.fromCharCode(...buf));
}

/**
 * aiEncrypt で暗号化された Base64 文字列を復号する
 */
async function aiDecrypt(ciphertext) {
  if (!_auth.encKey) await _restoreEncKey();
  if (!_auth.encKey) throw new Error('セッションが切れました。ページを再読み込みしてPINを入力してください。');
  const buf = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const dec = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: buf.slice(0, 12) }, _auth.encKey, buf.slice(12)
  );
  return new TextDecoder().decode(dec);
}

// ── セッション確認（app.js から参照可） ──
function isAuthenticated() {
  return sessionStorage.getItem(AUTH_SESSION_KEY) === '1';
}

// ── PIN ハッシュ計算 ──
async function _hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── ロックアウト ──
function _isLocked()    { return _auth.lockedAt && (Date.now() - _auth.lockedAt) / 1000 < AUTH_LOCK_SEC; }
function _lockRemain()  { return Math.ceil(AUTH_LOCK_SEC - (Date.now() - _auth.lockedAt) / 1000); }

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

function authKeyPress(n) {
  if (_isLocked()) { _showError(`${_lockRemain()}秒後に再試行できます`); return; }
  if (_auth.input.length >= AUTH_PIN_LEN) return;
  _auth.input += n;
  _updateDots();
  _hideError();
  if (_auth.input.length === AUTH_PIN_LEN) _submitPin();
}

function authBackspace() {
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
  const hash = await _hashPin(_auth.input);

  if (hash === _getActivePinHash()) {
    _auth.fails = 0;
    sessionStorage.setItem(AUTH_SESSION_KEY, '1');
    await _deriveEncKey(_auth.input); // AES 鍵を導出してセッションに保存
    _shake('success');
    document.querySelectorAll('#pin-overlay .pin-dot').forEach(d => d.classList.add('filled'));

    // 変更ボタンを表示してフェードアウト
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
    _auth.input = '';
    _updateDots();
    _shake('shake');

    if (_auth.fails >= AUTH_MAX_FAIL) {
      _auth.lockedAt = Date.now();
      _showError(`${AUTH_MAX_FAIL}回失敗。${AUTH_LOCK_SEC}秒後に再試行できます`);
      const _t = setInterval(() => {
        if (!_isLocked()) {
          clearInterval(_t);
          _auth.fails = 0; _auth.lockedAt = null;
          _setKeypadEnabled(true); _hideError();
        } else { _showError(`${_lockRemain()}秒後に再試行できます`); }
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
      <div class="pin-title">Heatmap</div>
      <div class="pin-subtitle">PINを入力してください</div>
      <div class="pin-dots" id="pin-dots">
        <span class="pin-dot"></span><span class="pin-dot"></span>
        <span class="pin-dot"></span><span class="pin-dot"></span>
      </div>
      <div class="pin-error" id="pin-error"></div>
      ${_pinKeypadHTML('authKeyPress', 'authBackspace')}
    </div>`;
  return ov;
}

// ── 共有キーパッド HTML ──
function _pinKeypadHTML(onPress, onBack) {
  return `<div class="pin-keypad">
    ${'123456789'.split('').map(n =>
      `<button class="pin-key" onclick="${onPress}('${n}')">${n}</button>`
    ).join('')}
    <span class="pin-key-empty"></span>
    <button class="pin-key" onclick="${onPress}('0')">0</button>
    <button class="pin-key pin-key-back" onclick="${onBack}()" aria-label="削除">
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
};

const _pcStepLabel = ['', '現在のPIN', '新しいPIN（4桁）', '新しいPIN（確認）'];
const _pcStepHint  = ['', '認証のため現在のPINを入力', '新しい4桁のPINを入力', '同じPINをもう一度入力'];

function _pcUpdateDots() {
  document.querySelectorAll('#pc-dots .pin-dot').forEach((d, i) =>
    d.classList.toggle('filled', i < _pc.input.length));
}
function _pcSetTitle() {
  const lbl  = document.getElementById('pc-step-label');
  const hint = document.getElementById('pc-step-hint');
  const prog = document.querySelectorAll('#pc-progress .pc-prog-dot');
  if (lbl)  lbl.textContent  = _pcStepLabel[_pc.step];
  if (hint) hint.textContent = _pcStepHint[_pc.step];
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
function _pcSuccess() {
  const el = document.getElementById('pc-dots');
  if (el) { el.classList.add('success'); }
  const lbl  = document.getElementById('pc-step-label');
  const hint = document.getElementById('pc-step-hint');
  if (lbl)  lbl.textContent  = '✅ 変更完了';
  if (hint) hint.textContent = '新しいPINが保存されました';
  document.querySelectorAll('#pc-dots .pin-dot').forEach(d => d.classList.add('filled'));
  document.querySelectorAll('#pc-overlay .pin-key').forEach(b => { b.disabled = true; });
  setTimeout(() => closePinChange(), 1800);
}

// PIN 変更キーパッドのグローバルハンドラ
function pcKeyPress(n) {
  if (_pc.input.length >= AUTH_PIN_LEN) return;
  _pc.input += n;
  _pcUpdateDots();
  _pcHideError();
  if (_pc.input.length === AUTH_PIN_LEN) _pcSubmit();
}
function pcBackspace() {
  if (_pc.input.length > 0) {
    _pc.input = _pc.input.slice(0, -1);
    _pcUpdateDots();
    _pcHideError();
  }
}

async function _pcSubmit() {
  document.querySelectorAll('#pc-overlay .pin-key').forEach(b => { b.disabled = true; });
  const hash = await _hashPin(_pc.input);

  if (_pc.step === 1) {
    // 現在の PIN 確認
    if (hash !== _getActivePinHash()) {
      _pc.input = ''; _pcUpdateDots(); _pcShake();
      _pcShowError('PINが違います');
      document.querySelectorAll('#pc-overlay .pin-key').forEach(b => { b.disabled = false; });
      return;
    }
    _pc.step = 2; _pc.input = '';
    _pcUpdateDots(); _pcSetTitle(); _pcHideError();
    document.querySelectorAll('#pc-overlay .pin-key').forEach(b => { b.disabled = false; });

  } else if (_pc.step === 2) {
    // 新 PIN を記憶して確認ステップへ
    _pc.newPin = _pc.input;
    _pc.step = 3; _pc.input = '';
    _pcUpdateDots(); _pcSetTitle(); _pcHideError();
    document.querySelectorAll('#pc-overlay .pin-key').forEach(b => { b.disabled = false; });

  } else if (_pc.step === 3) {
    // 新 PIN の一致確認
    if (_pc.input !== _pc.newPin) {
      _pc.input = ''; _pcUpdateDots(); _pcShake();
      _pcShowError('PINが一致しません');
      document.querySelectorAll('#pc-overlay .pin-key').forEach(b => { b.disabled = false; });
      return;
    }
    // 保存
    const newHash = await _hashPin(_pc.newPin);
    localStorage.setItem(AUTH_LS_HASH_KEY, newHash);
    _pcSuccess();
  }
}

// ── PIN 変更ダイアログを開く ──
function openPinChange() {
  if (document.getElementById('pc-overlay')) return;
  _pc.step = 1; _pc.input = ''; _pc.newPin = '';

  const ov = document.createElement('div');
  ov.id = 'pc-overlay';
  ov.innerHTML = `
    <div class="pin-card pc-card">
      <div class="pc-header">
        <span class="pc-title">PINを変更</span>
        <button class="pc-close" onclick="closePinChange()" aria-label="閉じる">✕</button>
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
      </div>
      <div class="pin-error" id="pc-error"></div>

      ${_pinKeypadHTML('pcKeyPress', 'pcBackspace')}
    </div>`;
  document.body.appendChild(ov);

  // キーボード入力
  ov._kbHandler = e => {
    if (e.key >= '0' && e.key <= '9') pcKeyPress(e.key);
    else if (e.key === 'Backspace') pcBackspace();
    else if (e.key === 'Escape') closePinChange();
  };
  document.addEventListener('keydown', ov._kbHandler);

  requestAnimationFrame(() => requestAnimationFrame(() => { ov.style.opacity = '1'; }));
}

function closePinChange() {
  const ov = document.getElementById('pc-overlay');
  if (!ov) return;
  if (ov._kbHandler) document.removeEventListener('keydown', ov._kbHandler);
  ov.style.opacity = '0';
  setTimeout(() => ov.remove(), 350);
}

// ══════════════════════════════════════════════
// PIN 変更ボタンをヘッダーに表示
// ══════════════════════════════════════════════
function _showChangePinButton() {
  const btn = document.getElementById('pin-change-btn');
  if (btn) btn.style.display = '';
}

// ══════════════════════════════════════════════
// 起動時初期化
// ══════════════════════════════════════════════
(function initAuth() {
  if (isAuthenticated()) {
    // 既に認証済み → 鍵を非同期で復元（完了後に変更ボタンを表示）
    _restoreEncKey().then(() => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _showChangePinButton);
      } else {
        _showChangePinButton();
      }
    });
    return;
  }

  document.body.style.overflow = 'hidden';
  const ov = _buildPinScreen();
  document.body.appendChild(ov);
  requestAnimationFrame(() => requestAnimationFrame(() => { ov.style.opacity = '1'; }));
}());
