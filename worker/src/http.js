// ── CORS ──────────────────────────────────────────────
export function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Pin-Hash',
    'Access-Control-Max-Age': '86400',
  };
}

export function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  const allowed = env.ALLOWED_ORIGIN || 'https://shoulang0729.github.io';
  if (origin === allowed) return true;
  // ローカル開発用
  if (origin.startsWith('http://localhost:')) return true;
  if (origin.startsWith('http://127.0.0.1:')) return true;
  return false;
}

// ── レスポンスヘルパー ─────────────────────────────────
export function jsonRes(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export function errRes(msg, status, origin) {
  return jsonRes({ error: msg }, status, origin);
}
