import { verifyPinHash } from './auth.js';
import { errRes, jsonRes } from './http.js';

// ── ウォッチリスト（KV）────────────────────────────────
// GET: 公開（銘柄のシンボル・名称のみで数量・金額を含まない）
// PUT: 現状は認証なし（kv-resync の Actions が PIN なしで使うため。扱いは別 Issue で検討・#714）
export async function handleWatchlist(request, env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);
  const key = 'watchlist';

  if (request.method === 'GET') {
    const val = await env.KV.get(key);
    return jsonRes(val ? JSON.parse(val) : [], 200, origin);
  }
  if (request.method === 'PUT') {
    let body;
    try {
      body = await request.json();
    } catch {
      return errRes('JSON 不正', 400, origin);
    }
    if (!Array.isArray(body)) return errRes('Array が必要です', 400, origin);

    for (let i = 0; i < body.length; i++) {
      const item = body[i];
      if (!item || typeof item !== 'object') return errRes(`watchlist[${i}]: object が必要です`, 400, origin);
      if (typeof item.symbol !== 'string' || !item.symbol.trim())
        return errRes(`watchlist[${i}].symbol は必須です`, 400, origin);
      if (typeof item.name !== 'string' || !item.name.trim())
        return errRes(`watchlist[${i}].name は必須です`, 400, origin);
      if (typeof item.exchange !== 'string' || !item.exchange.trim())
        return errRes(`watchlist[${i}].exchange は必須です`, 400, origin);
      if (typeof item.type !== 'string' || !item.type.trim())
        return errRes(`watchlist[${i}].type は必須です`, 400, origin);
      if (typeof item.cur !== 'string' || !item.cur.trim())
        return errRes(`watchlist[${i}].cur は必須です`, 400, origin);
    }

    await env.KV.put(key, JSON.stringify(body));
    return jsonRes({ ok: true }, 200, origin);
  }
  return errRes('GET/PUT のみ許可', 405, origin);
}

// ── 保有銘柄（KV・非公開）────────────────────────────────────
// GET/PUT とも X-Pin-Hash ヘッダーによる PIN 認証が必要（GET は #714 で追加）
export async function handlePositions(request, env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);

  if (request.method === 'GET') {
    const authErr = await verifyPinHash(request, env, origin);
    if (authErr) return authErr;
    const val = await env.KV.get('positions');
    return jsonRes(val ? JSON.parse(val) : [], 200, origin);
  }

  if (request.method === 'PUT') {
    const authErr = await verifyPinHash(request, env, origin);
    if (authErr) return authErr;

    let body;
    try {
      body = await request.json();
    } catch {
      return errRes('JSON 不正', 400, origin);
    }
    if (!Array.isArray(body)) return errRes('Array が必要です', 400, origin);

    for (let i = 0; i < body.length; i++) {
      const pos = body[i];
      if (!pos || typeof pos !== 'object') return errRes(`positions[${i}]: object が必要です`, 400, origin);
      if (typeof pos.symbol !== 'string' || !pos.symbol.trim())
        return errRes(`positions[${i}].symbol は必須です`, 400, origin);
      if (typeof pos.name !== 'string' || !pos.name.trim())
        return errRes(`positions[${i}].name は必須です`, 400, origin);
      if (typeof pos.cat !== 'string' || !pos.cat.trim()) return errRes(`positions[${i}].cat は必須です`, 400, origin);
      if (typeof pos.shares !== 'number' || !isFinite(pos.shares))
        return errRes(`positions[${i}].shares は有限数値が必要です`, 400, origin);
      if (typeof pos.price !== 'number' || !isFinite(pos.price))
        return errRes(`positions[${i}].price は有限数値が必要です`, 400, origin);
      if (typeof pos.avgCost !== 'number' || !isFinite(pos.avgCost))
        return errRes(`positions[${i}].avgCost は有限数値が必要です`, 400, origin);
      if (typeof pos.value !== 'number' || !isFinite(pos.value))
        return errRes(`positions[${i}].value は有限数値が必要です`, 400, origin);
      if (typeof pos.pnl !== 'number' || !isFinite(pos.pnl))
        return errRes(`positions[${i}].pnl は有限数値が必要です`, 400, origin);
      if (typeof pos.pnlPct !== 'number' || !isFinite(pos.pnlPct))
        return errRes(`positions[${i}].pnlPct は有限数値が必要です`, 400, origin);
      if (typeof pos.cur !== 'string' || !pos.cur.trim()) return errRes(`positions[${i}].cur は必須です`, 400, origin);
      if (typeof pos.ySymbol !== 'string' || !pos.ySymbol.trim())
        return errRes(`positions[${i}].ySymbol は必須です`, 400, origin);
    }

    await env.KV.put('positions', JSON.stringify(body));

    return jsonRes({ ok: true }, 200, origin);
  }

  return errRes('GET/PUT のみ許可', 405, origin);
}

// ── ネットワース機微データ（KV・非公開・#589 Phase2）────────────────────
// ★GET/PUT とも X-Pin-Hash による PIN 認証必須（handoff AC3「機微データは認証後のみ」）。
//   /positions と異なり GET も PIN 必須にする: オリジンゲートは Origin ヘッダを
//   送らない非ブラウザクライアント（curl 等）を弾けないため、Origin 判定だけでは
//   負債・純資産が公開読み出し可能になってしまう（2026-07-21 実測で確認・#589）。
//   ※/positions の GET も #714 で PIN 必須にした。
// mf-holdings 完全版（liabilities/realAssetsTotal/netWorthComputed 等の機微
// フィールドを含みうる）をそのまま JSON で保存・配信する。公開リポには一切
// 書かない（GitHub ミラーは行わない）。
// スキーマ検証は最小限（object であること）。実体の型は消費側
// （src/networth.js）が吸収する。
export async function handleNetworth(request, env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);

  if (request.method === 'GET') {
    const authErr = await verifyPinHash(request, env, origin);
    if (authErr) return authErr;
    const val = await env.KV.get('networth');
    return jsonRes(val ? JSON.parse(val) : null, 200, origin);
  }

  if (request.method === 'PUT') {
    const authErr = await verifyPinHash(request, env, origin);
    if (authErr) return authErr;

    let body;
    try {
      body = await request.json();
    } catch {
      return errRes('JSON 不正', 400, origin);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return errRes('object が必要です', 400, origin);
    }

    await env.KV.put('networth', JSON.stringify(body));
    return jsonRes({ ok: true }, 200, origin);
  }

  return errRes('GET/PUT のみ許可', 405, origin);
}
