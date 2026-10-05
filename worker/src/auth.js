import { errRes, jsonRes } from './http.js';

// X-Pin-Hash ヘッダーを KV の保存ハッシュと照合する。
// OK なら null、NG なら errRes を返す（呼び出し側でそのまま return する）。
export async function verifyPinHash(request, env, origin) {
  const pinHash = request.headers.get('X-Pin-Hash');
  if (!pinHash) return errRes('認証が必要です（X-Pin-Hash）', 401, origin);
  const storedHash = await env.KV.get('auth:pin-hash');
  if (!storedHash) return errRes('PIN初期設定が必要です', 428, origin);
  if (pinHash !== storedHash) return errRes('PIN認証失敗', 401, origin);
  return null;
}

// ── PIN ハッシュ更新 ──────────────────────────────────────────
export async function handleAuthPinHash(request, env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);

  if (request.method === 'GET') {
    const storedHash = await env.KV.get('auth:pin-hash');
    return jsonRes({ ok: true, configured: !!storedHash }, 200, origin);
  }

  if (request.method !== 'PUT') return errRes('GET/PUT のみ許可', 405, origin);

  let body;
  try {
    body = await request.json();
  } catch {
    return errRes('JSON 不正', 400, origin);
  }
  const { oldHash, newHash } = body;
  if (!newHash) return errRes('newHash が必要です', 400, origin);

  const storedHash = await env.KV.get('auth:pin-hash');
  if (storedHash && !oldHash) {
    if (newHash === storedHash) return jsonRes({ ok: true, mode: 'verified' }, 200, origin);
    return errRes('既存のPINと一致しません', 401, origin);
  }
  if (storedHash && oldHash !== storedHash) return errRes('現在のPIN認証失敗', 401, origin);
  if (!storedHash && oldHash) return errRes('初回PIN設定では oldHash は不要です', 400, origin);

  await env.KV.put('auth:pin-hash', newHash);
  return jsonRes({ ok: true, mode: storedHash ? 'updated' : 'created' }, 200, origin);
}

// ── パスキー認証 ──────────────────────────────────────

// チャレンジ生成（60秒TTL）
export async function handleAuthChallenge(env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);
  const challenge = crypto.getRandomValues(new Uint8Array(16));
  const b64 = btoa(String.fromCharCode(...challenge));
  await env.KV.put('auth:challenge', b64, { expirationTtl: 60 });
  return jsonRes({ challenge: b64 }, 200, origin);
}

// 登録（公開鍵を KV に保存）
// セキュリティ: 未認証者がパスキーを登録できないよう PIN 認証を必須にする（#239）
export async function handleAuthRegister(request, env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);
  const authErr = await verifyPinHash(request, env, origin);
  if (authErr) return authErr;
  let body;
  try {
    body = await request.json();
  } catch {
    return errRes('JSON 不正', 400, origin);
  }
  const { id, publicKey, clientDataJSON } = body;
  if (!id || !publicKey) return errRes('id / publicKey が必要です', 400, origin);

  await env.KV.put('auth:credential', JSON.stringify({ id, publicKey, clientDataJSON }));
  return jsonRes({ ok: true }, 200, origin);
}

// 検証（challenge の一致確認）
export async function handleAuthVerify(request, env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);
  let body;
  try {
    body = await request.json();
  } catch {
    return errRes('JSON 不正', 400, origin);
  }

  const stored = await env.KV.get('auth:credential', 'json');
  if (!stored) return errRes('パスキー未登録', 401, origin);

  const challenge = await env.KV.get('auth:challenge');
  if (!challenge) return errRes('チャレンジが期限切れです', 401, origin);

  // clientDataJSON 内の challenge と保存済みチャレンジを照合
  try {
    const clientData = JSON.parse(atob(body.clientDataJSON));
    // base64url → base64 変換して比較
    const expectedB64url = challenge.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    if (clientData.challenge !== expectedB64url) {
      return errRes('チャレンジが一致しません', 401, origin);
    }
  } catch {
    return errRes('clientDataJSON の解析失敗', 400, origin);
  }

  // チャレンジを消費（リプレイ攻撃防止）
  await env.KV.delete('auth:challenge');
  return jsonRes({ ok: true }, 200, origin);
}
