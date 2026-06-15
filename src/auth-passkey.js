// ══════════════════════════════════════════════════════════════
// auth-passkey.js  ―  WebAuthn パスキー登録 / 認証
//
// RP ID = location.hostname（shoulang0729.github.io / localhost）
// 依存: auth-pin.js (_auth, AUTH_SESSION_KEY),
//       auth-crypto.js (セッション鍵),
//       auth-ui.js (_showChangePinButton) ← コールバックで解消
// ══════════════════════════════════════════════════════════════

import { _auth, AUTH_SESSION_KEY, _getActivePinHash } from './auth-pin.js';
import { WORKER_URL } from './config.js';
import { showAlert } from './modal.js';

// ── 循環依存解消: auth-ui._showChangePinButton をコールバックで受け取る ──
let _onPasskeySuccess = null;
export function setPasskeySuccessCallback(fn) { _onPasskeySuccess = fn; }

const _PASSKEY_RP_ID   = location.hostname;
const _PASSKEY_RP_NAME = 'Portfolio Heatmap';
const _PASSKEY_USER_ID = new TextEncoder().encode('portfolio-owner');

function _b64ToU8(b64) {
  return Uint8Array.from(atob(b64.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
}
function _u8ToB64url(u8) {
  return btoa(String.fromCharCode(...u8)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

export async function registerPasskey() {
  if (!navigator.credentials || !window.PublicKeyCredential) {
    await showAlert({ title: 'ブラウザ対応', message: 'このブラウザはパスキーに対応していません。' });
    return;
  }
  try {
    const challengeRes = await fetch(`${WORKER_URL}/auth/challenge`);
    const { challenge } = await challengeRes.json();

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: _b64ToU8(challenge),
        rp: { id: _PASSKEY_RP_ID, name: _PASSKEY_RP_NAME },
        user: { id: _PASSKEY_USER_ID, name: 'Portfolio Manager', displayName: 'Portfolio Manager' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7  },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { userVerification: 'preferred', residentKey: 'preferred' },
        timeout: 60000,
      },
    });

    const response = credential.response;
    const publicKey = response.getPublicKey ? new Uint8Array(response.getPublicKey()) : new Uint8Array(0);

    const regRes = await fetch(`${WORKER_URL}/auth/register`, {
      method: 'POST',
      // PIN 認証ヘッダーを付与（Worker 側で検証。未認証者の登録を防ぐ #239）
      headers: { 'Content-Type': 'application/json', 'X-Pin-Hash': _getActivePinHash() },
      body: JSON.stringify({
        id: credential.id,
        publicKey: _u8ToB64url(publicKey),
        clientDataJSON: _u8ToB64url(new Uint8Array(response.clientDataJSON)),
      }),
    });
    if (!(await regRes.json()).ok) throw new Error('登録失敗');
    await showAlert({ title: 'パスキー登録', message: 'パスキーを登録しました。次回からパスキーでログインできます。' });
  } catch (e) {
    if (e.name !== 'NotAllowedError') await showAlert({ title: 'エラー', message: `パスキー登録エラー: ${e.message}` });
  }
}

export async function authenticatePasskey() {
  if (!navigator.credentials || !window.PublicKeyCredential) return;
  try {
    const challengeRes = await fetch(`${WORKER_URL}/auth/challenge`);
    if (!challengeRes.ok) return;
    const { challenge } = await challengeRes.json();

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: _b64ToU8(challenge),
        rpId: _PASSKEY_RP_ID,
        allowCredentials: [],
        userVerification: 'preferred',
        timeout: 60000,
      },
    });

    const response = assertion.response;
    const verifyRes = await fetch(`${WORKER_URL}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: assertion.id,
        clientDataJSON: _u8ToB64url(new Uint8Array(response.clientDataJSON)),
        authenticatorData: _u8ToB64url(new Uint8Array(response.authenticatorData)),
        signature: _u8ToB64url(new Uint8Array(response.signature)),
      }),
    });

    if ((await verifyRes.json()).ok) {
      sessionStorage.setItem(AUTH_SESSION_KEY, '1');
      // 次回起動時に自動でパスキー画面を出すためのフラグ
      try { localStorage.setItem('hm-passkey-seen', '1'); } catch {}
      // パスキー認証時はランダムなセッション鍵を生成（PIN を経由しないため）
      const rawKey = crypto.getRandomValues(new Uint8Array(32));
      _auth.encKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
      _auth.fails = 0;
      const ov = document.getElementById('pin-overlay');
      if (ov) { ov.style.opacity = '0'; setTimeout(() => { ov.remove(); document.body.style.overflow = ''; }, 380); }
      if (_onPasskeySuccess) _onPasskeySuccess();
    } else {
      const errEl = document.getElementById('pin-error');
      if (errEl) { errEl.textContent = 'パスキー認証失敗'; errEl.classList.add('visible'); }
    }
  } catch (e) {
    if (e.name !== 'NotAllowedError') {
      const errEl = document.getElementById('pin-error');
      if (errEl) { errEl.textContent = `パスキーエラー: ${e.message}`; errEl.classList.add('visible'); }
    }
  }
}
