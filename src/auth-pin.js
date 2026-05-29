// ══════════════════════════════════════════════════════════════
// auth-pin.js  ―  PIN 認証ロジック（状態・ハッシュ・ロックアウト）
//
// ■ デフォルト PIN: 1234  / リセット: localStorage.removeItem('hm-pin-hash')
// UI（キーパッド・ダイアログ）は src/auth-ui.js に分離。
// 暗号化（AES-GCM 鍵導出）は src/auth-crypto.js に分離。
//
// このファイルは "依存元" ─ 他の auth-*.js より先に読込む。
// ══════════════════════════════════════════════════════════════

// ── ハードコードされたデフォルト PIN ハッシュ（SHA-256 of "123456"）──
const AUTH_PIN_HASH     = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92';
const AUTH_SESSION_KEY  = 'hm-auth-v1';
const AUTH_LS_HASH_KEY  = 'hm-pin-hash';    // localStorage キー
const AUTH_LOCKOUT_KEY  = 'hm-lockout';     // ロックアウト時刻 localStorage キー
const AUTH_PIN_LEN      = 6;
const AUTH_MAX_FAIL     = 5;
const AUTH_LOCK_SEC     = 300;

// ── 有効な PIN ハッシュ（localStorage 優先） ──
function _getActivePinHash() {
  return localStorage.getItem(AUTH_LS_HASH_KEY) || AUTH_PIN_HASH;
}

// ── 共有 internal state（auth-crypto / auth-passkey / auth-ui から参照） ──
const _auth = {
  input:    '',
  fails:    0,
  lockedAt: null,
  encKey:   null,   // AES-GCM key（auth-crypto.js が _deriveEncKey でセット）
};

// ── セッション確認（app.js からも参照） ──
function isAuthenticated() {
  return sessionStorage.getItem(AUTH_SESSION_KEY) === '1';
}

// ── PIN ハッシュ計算 ──
async function _hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── ロックアウト ──
function _isLocked()   { return _auth.lockedAt && (Date.now() - _auth.lockedAt) / 1000 < AUTH_LOCK_SEC; }
function _lockRemain() { return Math.ceil(AUTH_LOCK_SEC - (Date.now() - _auth.lockedAt) / 1000); }
function _formatLockRemain(seconds) {
  const remain = Math.max(0, Math.ceil(seconds));
  if (remain >= 60) {
    const minutes = Math.floor(remain / 60);
    const secs = remain % 60;
    return secs > 0 ? `${minutes}分${secs}秒` : `${minutes}分`;
  }
  return `${remain}秒`;
}

// ロックアウト状態を localStorage に保存（リロード後も持続させる）
function _saveLockout() {
  if (_auth.lockedAt) {
    localStorage.setItem(AUTH_LOCKOUT_KEY, String(_auth.lockedAt));
  } else {
    localStorage.removeItem(AUTH_LOCKOUT_KEY);
  }
}

// 起動時に localStorage からロックアウト状態を復元
(function _loadLockout() {
  const stored = localStorage.getItem(AUTH_LOCKOUT_KEY);
  if (!stored) return;
  const ts = parseInt(stored, 10);
  if (isNaN(ts)) { localStorage.removeItem(AUTH_LOCKOUT_KEY); return; }
  if ((Date.now() - ts) / 1000 < AUTH_LOCK_SEC) {
    _auth.lockedAt = ts;
  } else {
    localStorage.removeItem(AUTH_LOCKOUT_KEY);
  }
}());

export { AUTH_PIN_HASH, AUTH_SESSION_KEY, AUTH_LS_HASH_KEY, AUTH_LOCKOUT_KEY, AUTH_PIN_LEN, AUTH_MAX_FAIL, AUTH_LOCK_SEC, _auth, _getActivePinHash, _hashPin, _isLocked, _lockRemain, _formatLockRemain, _saveLockout, isAuthenticated };
