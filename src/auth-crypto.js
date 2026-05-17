// ══════════════════════════════════════════════════════════════
// auth-crypto.js  ―  AES-GCM 暗号化（AI タブの API キー保護）
//
// 依存: auth-pin.js (_auth state)
// PIN から PBKDF2 で AES-256-GCM 鍵を導出し、sessionStorage に保存する。
// ai-tab.js が aiEncrypt / aiDecrypt を直接呼ぶ。
// ══════════════════════════════════════════════════════════════

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

/** 平文を AES-GCM で暗号化して Base64 文字列を返す */
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

/** aiEncrypt で暗号化された Base64 文字列を復号する */
async function aiDecrypt(ciphertext) {
  if (!_auth.encKey) await _restoreEncKey();
  if (!_auth.encKey) throw new Error('セッションが切れました。ページを再読み込みしてPINを入力してください。');
  const buf = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const dec = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: buf.slice(0, 12) }, _auth.encKey, buf.slice(12)
  );
  return new TextDecoder().decode(dec);
}
