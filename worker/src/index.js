// portfolio-proxy — Cloudflare Worker
//
// ルート一覧:
//   GET  /yahoo?url=<encoded>           Yahoo Finance プロキシ（CORS 回避）
//   GET  /finnhub?path=<path>&<params>  Finnhub プロキシ（APIキー隠蔽）
//   POST /ai/openai                     OpenAI (ChatGPT) プロキシ
//   POST /ai/gemini                     Gemini プロキシ
//   POST /ai/grok                       Grok プロキシ
//   POST /ai/deepseek                   DeepSeek プロキシ
//   POST /ai/claude                     Claude (Anthropic) プロキシ
//   GET  /watchlist                     ウォッチリスト取得（KV）
//   PUT  /watchlist                     ウォッチリスト保存（KV）
//   POST /notion/save                   AI相談結果をNotion DBに保存
//   GET  /auth/challenge                パスキー認証チャレンジ生成
//   POST /auth/register                 パスキー登録
//   POST /auth/verify                   パスキー検証
//
// 環境変数（Cloudflare Secrets / vars に設定）:
//   FINNHUB_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY,
//   GROK_API_KEY, DEEPSEEK_API_KEY, ANTHROPIC_API_KEY,
//   NOTION_API_KEY, NOTION_DB_ID, ALLOWED_ORIGIN
//   KV: Cloudflare KV namespace binding

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

// ── CORS ──────────────────────────────────────────────
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  const allowed = env.ALLOWED_ORIGIN || 'https://shoulang0729.github.io';
  if (origin === allowed) return true;
  // ローカル開発用
  if (origin.startsWith('http://localhost:')) return true;
  if (origin.startsWith('http://127.0.0.1:')) return true;
  return false;
}

// ── レスポンスヘルパー ─────────────────────────────────
function jsonRes(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function errRes(msg, status, origin) {
  return jsonRes({ error: msg }, status, origin);
}

// ── Yahoo Finance プロキシ ────────────────────────────
async function handleYahoo(url, origin) {
  const target = url.searchParams.get('url');
  if (!target) return errRes('url パラメータが必要です', 400, origin);

  const decoded = decodeURIComponent(target);
  if (!decoded.includes('finance.yahoo.com')) {
    return errRes('Yahoo Finance 以外の URL は許可されていません', 400, origin);
  }

  try {
    const res = await fetch(decoded, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; portfolio-proxy/1.0)' },
    });
    const data = await res.json();
    return jsonRes(data, res.status, origin);
  } catch (e) {
    return errRes(`取得失敗: ${e.message}`, 502, origin);
  }
}

// ── Finnhub プロキシ ──────────────────────────────────
async function handleFinnhub(url, env, origin) {
  const apiKey = env.FINNHUB_API_KEY;
  if (!apiKey) return errRes('Finnhub APIキーが未設定です', 500, origin);

  const path = url.searchParams.get('path') || '/quote';
  const params = new URLSearchParams(url.searchParams);
  params.delete('path');
  params.set('token', apiKey);

  try {
    const res = await fetch(`${FINNHUB_BASE}${path}?${params}`);
    const data = await res.json();
    return jsonRes(data, res.status, origin);
  } catch (e) {
    return errRes(`取得失敗: ${e.message}`, 502, origin);
  }
}

// ── AI プロキシ ───────────────────────────────────────
async function handleAI(request, path, env, origin) {
  if (request.method !== 'POST') return errRes('POST のみ許可', 405, origin);

  let body;
  try { body = await request.json(); } catch { return errRes('JSON が不正です', 400, origin); }

  const provider = path.split('/')[2]; // /ai/<provider>
  let upstreamUrl, headers;

  switch (provider) {
    case 'openai': {
      if (!env.OPENAI_API_KEY) return errRes('OpenAI キー未設定', 500, origin);
      upstreamUrl = 'https://api.openai.com/v1/chat/completions';
      headers = { 'Authorization': `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' };
      break;
    }
    case 'gemini': {
      if (!env.GEMINI_API_KEY) return errRes('Gemini キー未設定', 500, origin);
      const model = body.model || 'gemini-2.0-flash';
      upstreamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
      headers = { 'Content-Type': 'application/json' };
      // Gemini はボディから model フィールドを除去して送る
      delete body.model;
      break;
    }
    case 'grok': {
      if (!env.GROK_API_KEY) return errRes('Grok キー未設定', 500, origin);
      upstreamUrl = 'https://api.x.ai/v1/chat/completions';
      headers = { 'Authorization': `Bearer ${env.GROK_API_KEY}`, 'Content-Type': 'application/json' };
      break;
    }
    case 'deepseek': {
      if (!env.DEEPSEEK_API_KEY) return errRes('DeepSeek キー未設定', 500, origin);
      upstreamUrl = 'https://api.deepseek.com/v1/chat/completions';
      headers = { 'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' };
      break;
    }
    case 'claude': {
      if (!env.ANTHROPIC_API_KEY) return errRes('Claude キー未設定', 500, origin);
      upstreamUrl = 'https://api.anthropic.com/v1/messages';
      headers = {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      };
      break;
    }
    default:
      return errRes(`未知のプロバイダー: ${provider}`, 400, origin);
  }

  try {
    const res = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return jsonRes(data, res.status, origin);
  } catch (e) {
    return errRes(`AI 呼び出し失敗: ${e.message}`, 502, origin);
  }
}

// ── ウォッチリスト（KV）────────────────────────────────
async function handleWatchlist(request, env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);
  const key = 'watchlist';

  if (request.method === 'GET') {
    const val = await env.KV.get(key);
    return jsonRes(val ? JSON.parse(val) : [], 200, origin);
  }
  if (request.method === 'PUT') {
    let body;
    try { body = await request.json(); } catch { return errRes('JSON 不正', 400, origin); }
    await env.KV.put(key, JSON.stringify(body));
    return jsonRes({ ok: true }, 200, origin);
  }
  return errRes('GET/PUT のみ許可', 405, origin);
}

// ── Notion 保存 ───────────────────────────────────────
async function handleNotionSave(request, env, origin) {
  if (request.method !== 'POST') return errRes('POST のみ許可', 405, origin);
  if (!env.NOTION_API_KEY) return errRes('Notion APIキー未設定', 500, origin);

  let body;
  try { body = await request.json(); } catch { return errRes('JSON 不正', 400, origin); }

  const { title, question, responses } = body;
  const pageTitle = title || `AI相談 ${new Date().toISOString()}`;

  const blocks = [
    { object: 'block', type: 'heading_2', heading_2: { rich_text: [{ text: { content: '質問' } }] } },
    { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ text: { content: (question || '').slice(0, 1900) } }] } },
  ];
  for (const [provider, text] of Object.entries(responses || {})) {
    if (!text) continue;
    blocks.push({
      object: 'block', type: 'heading_3',
      heading_3: { rich_text: [{ text: { content: provider.toUpperCase() } }] },
    });
    // Notion ブロックは rich_text 要素 1 つあたり 2000 文字制限
    for (let i = 0; i < text.length; i += 1900) {
      blocks.push({
        object: 'block', type: 'paragraph',
        paragraph: { rich_text: [{ text: { content: text.slice(i, i + 1900) } }] },
      });
    }
  }

  try {
    const notionRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: env.NOTION_DB_ID },
        properties: { Name: { title: [{ text: { content: pageTitle } }] } },
        children: blocks,
      }),
    });
    const data = await notionRes.json();
    return jsonRes(data, notionRes.status, origin);
  } catch (e) {
    return errRes(`Notion 保存失敗: ${e.message}`, 502, origin);
  }
}

// ── パスキー認証 ──────────────────────────────────────

// チャレンジ生成（60秒TTL）
async function handleAuthChallenge(env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);
  const challenge = crypto.getRandomValues(new Uint8Array(16));
  const b64 = btoa(String.fromCharCode(...challenge));
  await env.KV.put('auth:challenge', b64, { expirationTtl: 60 });
  return jsonRes({ challenge: b64 }, 200, origin);
}

// 登録（公開鍵を KV に保存）
async function handleAuthRegister(request, env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);
  let body;
  try { body = await request.json(); } catch { return errRes('JSON 不正', 400, origin); }
  const { id, publicKey, clientDataJSON } = body;
  if (!id || !publicKey) return errRes('id / publicKey が必要です', 400, origin);

  await env.KV.put('auth:credential', JSON.stringify({ id, publicKey, clientDataJSON }));
  return jsonRes({ ok: true }, 200, origin);
}

// 検証（challenge の一致確認）
async function handleAuthVerify(request, env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);
  let body;
  try { body = await request.json(); } catch { return errRes('JSON 不正', 400, origin); }

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

// ── メインハンドラー ──────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowed = isAllowedOrigin(origin, env);

    // CORS プリフライト
    if (request.method === 'OPTIONS') {
      if (!allowed) return new Response('Forbidden', { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Origin チェック（ブラウザからのリクエストのみ）
    if (origin && !allowed) return new Response('Forbidden', { status: 403 });
    const org = allowed ? origin : '*';

    const path = url.pathname;
    if (path === '/')               return new Response('portfolio-proxy OK', { status: 200 });
    if (path === '/yahoo')          return handleYahoo(url, org);
    if (path === '/finnhub')        return handleFinnhub(url, env, org);
    if (path.startsWith('/ai/'))    return handleAI(request, path, env, org);
    if (path === '/watchlist')      return handleWatchlist(request, env, org);
    if (path === '/notion/save')    return handleNotionSave(request, env, org);
    if (path === '/auth/challenge') return handleAuthChallenge(env, org);
    if (path === '/auth/register')  return handleAuthRegister(request, env, org);
    if (path === '/auth/verify')    return handleAuthVerify(request, env, org);

    return errRes('Not Found', 404, org);
  },
};
