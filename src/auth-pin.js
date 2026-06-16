// ══════════════════════════════════════════════════════════════
// auth-pin.js  ―  PIN 認証ロジック（状態・ハッシュ・ロックアウト）
//
// ■ 初回起動時に PIN を設定 / リセット: localStorage.removeItem('hm-pin-hash')
// UI（キーパッド・ダイアログ）は src/auth-ui.js に分離。
// 暗号化（AES-GCM 鍵導出）は src/auth-crypto.js に分離。
//
// このファイルは "依存元" ─ 他の auth-*.js より先に読込む。
// ══════════════════════════════════════════════════════════════

// 旧4桁デフォルトハッシュ（SHA-256 of "1234"）: 6桁移行時に自動クリアするため保持
const _AUTH_PIN_HASH_4DIG = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
const AUTH_SESSION_KEY  = 'hm-auth-v1';
const AUTH_LS_HASH_KEY  = 'hm-pin-hash';    // localStorage キー
const AUTH_LOCKOUT_KEY  = 'hm-lockout';     // ロックアウト時刻 localStorage キー
const AUTH_PIN_LEN      = 6;
const AUTH_MAX_FAIL     = 5;
const AUTH_LOCK_SEC     = 300;

// ── 4桁→6桁マイグレーション: 旧デフォルトハッシュが残っていたら削除 ──
(function _migratePinLen() {
  try {
    const stored = localStorage.getItem(AUTH_LS_HASH_KEY);
    if (stored === _AUTH_PIN_HASH_4DIG) localStorage.removeItem(AUTH_LS_HASH_KEY);
  } catch {}
}());

// ── 有効な PIN ハッシュ（localStorage 優先） ──
function _getActivePinHash() {
  return localStorage.getItem(AUTH_LS_HASH_KEY);
}

// ── 共有 internal state（auth-crypto / auth-passkey / auth-ui から参照） ──
const _auth = {
  input:       '',
  fails:       0,
  lockedUntil: null,  // ロックアウト解除時刻 ms（旧 lockedAt から変更）
  encKey:      null,  // AES-GCM key（auth-crypto.js が _deriveEncKey でセット）
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
function _isLocked()   { return _auth.lockedUntil != null && Date.now() < _auth.lockedUntil; }
function _lockRemain() { return Math.ceil((_auth.lockedUntil - Date.now()) / 1000); }
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
  if (_auth.lockedUntil != null) {
    localStorage.setItem(AUTH_LOCKOUT_KEY, String(_auth.lockedUntil));
  } else {
    localStorage.removeItem(AUTH_LOCKOUT_KEY);
  }
}

// 起動時に localStorage からロックアウト状態を復元
(function _loadLockout() {
  const stored = localStorage.getItem(AUTH_LOCKOUT_KEY);
  if (!stored) return;
  const until = parseInt(stored, 10);
  if (isNaN(until)) { localStorage.removeItem(AUTH_LOCKOUT_KEY); return; }
  if (Date.now() < until) {
    _auth.lockedUntil = until;
  } else {
    localStorage.removeItem(AUTH_LOCKOUT_KEY);
  }
}());

export { AUTH_SESSION_KEY, AUTH_LS_HASH_KEY, AUTH_LOCKOUT_KEY, AUTH_PIN_LEN, AUTH_MAX_FAIL, AUTH_LOCK_SEC, _auth, _getActivePinHash, _hashPin, _isLocked, _lockRemain, _formatLockRemain, _saveLockout, isAuthenticated };
