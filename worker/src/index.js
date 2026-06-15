// portfolio-proxy — Cloudflare Worker
//
// ルート一覧:
//   GET  /yahoo?url=<encoded>           Yahoo Finance プロキシ（CORS 回避）
//   GET  /finnhub?path=<path>&<params>  Finnhub プロキシ（APIキー隠蔽）
//   GET  /forex?from=<from>&to=<to>    為替レートプロキシ（Yahoo Finance）
//   POST /ai/openai                     OpenAI (ChatGPT) プロキシ
//   POST /ai/gemini                     Gemini プロキシ
//   POST /ai/grok                       Grok プロキシ
//   POST /ai/deepseek                   DeepSeek プロキシ
//   POST /ai/claude                     Claude (Anthropic) プロキシ
//   GET  /etf/constituents?symbol=<sym> ETF 構成銘柄（look-through・KV キャッシュ）
//   GET  /watchlist                     ウォッチリスト取得（KV）
//   PUT  /watchlist                     ウォッチリスト保存（KV）
//   GET  /positions                     保有銘柄取得（KV・非公開）
//   PUT  /positions                     保有銘柄保存（KV・PIN認証必須）
//   PUT  /auth/pin-hash                 PIN ハッシュ更新/端末復旧（KV）
//   GET  /prices/cache                  Cron キャッシュ価格取得（KV）
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
// Cron: 0 */6 * * *  — 6時間ごとに全保有銘柄の価格を取得してキャッシュ

import {
  CONSTITUENTS_KV_PREFIX,
  CONSTITUENTS_TTL,
  buildConstituentsResponse,
  fetchEtfConstituents,
} from './etf-constituents.js';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

/**
 * Yahoo Finance シンボルを Finnhub シンボルに変換
 * 例: '9983.T' → 'TYO:9983' / '0700.HK' → 'HKG:0700'
 */
function _workerToFinnhubSymbol(ySymbol) {
  if (!ySymbol) return ySymbol;
  if (ySymbol.endsWith('.T')) return 'TYO:' + ySymbol.slice(0, -2);
  if (ySymbol.endsWith('.HK')) return 'HKG:' + ySymbol.slice(0, -3);
  return ySymbol;
}

// ── レート制限（/yahoo・/finnhub プロキシ向け、KV 使用） ──────────
// 同一 CF-Connecting-IP から RATE_LIMIT_WINDOW_MS 内に最大 RATE_LIMIT_MAX リクエストまで。
//
// 設計判断は worker/src/rate-limit.md を参照（案 A: Durable Objects /
// 案 B: shard 分散 / 案 C: Cache API の比較）。本実装は案 B。
//
// KV キー: "rl:<ip>:<bucket>:<shard>"
//   - bucket = floor(now / 60s)  → 1 分単位のタンブリングウィンドウ
//   - shard  = 0..N-1            → 書き込みをランダムに分散してレース窓を 1/N に縮小
// 読込時は全 shard を並列 GET → 合算して上限判定。
// put は await しない（レイテンシ削減・失敗時は次のリクエストで挽回）。
const RATE_LIMIT_MAX = 120;            // リクエスト / バケット
const RATE_LIMIT_WINDOW_MS = 60_000;   // バケット幅（60秒）
const RATE_LIMIT_SHARDS = 4;           // shard 数（増やすほどレース窓が分散）
const RATE_LIMIT_TTL = 120;            // shard キー TTL（バケット境界跨ぎを許容）

async function checkRateLimit(request, env) {
  if (!env.KV) return false; // KV 未設定時はスキップ
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const bucket = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS);

  // 全 shard を並列に読んで合算（書き込みが分散しているので合算は必須）。
  // 旧キー "rl:<ip>"（TTL 60s）も移行期間中は合算する。
  const shardKeys = [];
  for (let i = 0; i < RATE_LIMIT_SHARDS; i++) {
    shardKeys.push(`rl:${ip}:${bucket}:${i}`);
  }
  const legacyKey = `rl:${ip}`;
  const reads = await Promise.all([
    ...shardKeys.map(k => env.KV.get(k)),
    env.KV.get(legacyKey),
  ]);
  const total = reads.reduce((sum, v) => sum + parseInt(v || '0', 10), 0);

  if (total >= RATE_LIMIT_MAX) return true;

  // 書き込み shard をランダム選択 → GET→PUT のレース窓は同一 shard を選んだ場合のみ
  // 発生する（衝突確率 1/N）。put は await しない。
  const writeShard = Math.floor(Math.random() * RATE_LIMIT_SHARDS);
  const writeKey = `rl:${ip}:${bucket}:${writeShard}`;
  const shardCurrent = parseInt(reads[writeShard] || '0', 10);
  env.KV.put(writeKey, String(shardCurrent + 1), { expirationTtl: RATE_LIMIT_TTL })
    .catch(() => {});

  return false;
}

// ── CORS ──────────────────────────────────────────────
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Pin-Hash',
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

// ── 為替レートプロキシ ────────────────────────────
async function handleForex(url, env, origin) {
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!from || !to) return errRes('from と to パラメータが必要です', 400, origin);

  const cacheKey = `forex:${from}${to}`;
  const cached = await env.KV.get(cacheKey);
  if (cached) {
    try {
      const data = JSON.parse(cached);
      return jsonRes(data, 200, origin);
    } catch {}
  }

  try {
    const symbol = `${from}${to}=X`;
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
      { cf: { cacheTtl: 300 } }
    );
    if (!res.ok) return errRes('Yahoo Finance API エラー', 502, origin);

    const data = await res.json();
    const price = data?.chart?.result?.[0]?.regularMarketPrice;
    if (!price) return errRes('レート取得失敗', 502, origin);

    const result = { from, to, rate: price, ts: Date.now() };
    await env.KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 3600 });
    return jsonRes(result, 200, origin);
  } catch (e) {
    console.error('[forex]', e);
    return errRes('レート取得エラー', 502, origin);
  }
}

// ── Yahoo Finance crumb キャッシュ ────────────────────────────
async function getYahooCrumb(env) {
  // KV キャッシュ確認（50分以内なら再利用）
  if (env.KV) {
    try {
      const cached = await env.KV.get('yahoo:crumb', 'json');
      if (cached?.crumb && cached?.cookie && (Date.now() - (cached.ts || 0)) < 3000000) {
        return cached;
      }
    } catch {}
  }

  // Yahoo Finance からセッションクッキーを取得
  // 注: 旧 fc.yahoo.com は 2026 時点で HTTP 404 となり crumb 取得が壊れていた（#228）。
  //     finance.yahoo.com からセッション cookie を取得する方式に変更。
  const ua =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  // cookie 取得元の候補（順に試し、最初に取れたものを使う）
  const COOKIE_SOURCES = [
    'https://finance.yahoo.com/',
    'https://query2.finance.yahoo.com/v1/test/getcrumb',
  ];
  try {
    let cookie = '';
    for (const src of COOKIE_SOURCES) {
      try {
        const cookieRes = await fetch(src, {
          redirect: 'follow',
          headers: { 'User-Agent': ua, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
        });
        // 複数の Set-Cookie を全て収集（getSetCookie 優先、無ければ単一 set-cookie）
        const rawList =
          typeof cookieRes.headers.getSetCookie === 'function'
            ? cookieRes.headers.getSetCookie()
            : cookieRes.headers.get('set-cookie')
              ? [cookieRes.headers.get('set-cookie')]
              : [];
        const pairs = rawList.map(c => c.split(';')[0].trim()).filter(Boolean);
        if (pairs.length) {
          cookie = pairs.join('; ');
          break;
        }
      } catch { /* 次の候補へ */ }
    }
    if (!cookie) return null;

    // crumb を取得
    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': ua, Cookie: cookie },
    });
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.length > 50 || crumb.startsWith('<')) return null;

    const result = { crumb, cookie, ts: Date.now() };
    if (env.KV) {
      await env.KV.put('yahoo:crumb', JSON.stringify(result), { expirationTtl: 3000 });
    }
    return result;
  } catch {
    return null;
  }
}

// ── Yahoo Finance プロキシ ────────────────────────────
async function handleYahoo(url, env, origin) {
  const target = url.searchParams.get('url');
  if (!target) return errRes('url パラメータが必要です', 400, origin);

  const decoded = decodeURIComponent(target);
  let parsed;
  try {
    parsed = new URL(decoded);
  } catch {
    return errRes('不正な URL です', 400, origin);
  }

  if (parsed.protocol !== 'https:') {
    return errRes('HTTPS のみ許可されています', 400, origin);
  }

  const allowedHosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  if (!allowedHosts.includes(parsed.hostname)) {
    return errRes('許可されていないホストです', 400, origin);
  }

  try {
    // crumb を取得（失敗しても fetch は続行）
    const crumbData = await getYahooCrumb(env);

    // crumb を URL に付与（既に crumb パラメータがない場合のみ）
    let fetchUrl = decoded;
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    };
    if (crumbData) {
      headers['Cookie'] = crumbData.cookie;
      if (!fetchUrl.includes('crumb=')) {
        fetchUrl += `${fetchUrl.includes('?') ? '&' : '?'}crumb=${encodeURIComponent(crumbData.crumb)}`;
      }
    }

    const res = await fetch(fetchUrl, { headers });
    if (!res.ok) return errRes(`Yahoo Finance エラー: ${res.status}`, res.status, origin);
    const data = await res.json();
    return jsonRes(data, 200, origin);
  } catch (e) {
    return errRes(`取得失敗: ${e.message}`, 502, origin);
  }
}

// ── Finnhub プロキシ ──────────────────────────────────
async function handleFinnhub(url, env, origin) {
  const apiKey = env.FINNHUB_API_KEY;
  if (!apiKey) return errRes('Finnhub APIキーが未設定です', 500, origin);

  const path = url.searchParams.get('path') || '/quote';
  if (!/^\/[a-z0-9/_-]+$/i.test(path)) {
    return errRes('不正な path です', 400, origin);
  }

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

// ══════════════════════════════════════════════════════════════
// ポートフォリオ・スナップショット（他AI連携用の完全な分析データ）
//
// POST /portfolio/snapshot
//   body 任意（あれば即push、なければWorker側で生成）
//   レスポンス: { ok, positions, pushedAt }
//
// Cron 6h ごとに自動生成・GitHub push
// 保存先: data/portfolio-snapshot.json
//
// 構造:
//   { asOf, source,
//     summary:   { totalValue, totalPnl, pnlPct, positionCount, watchlistCount, performance },
//     positions: [{...basic, performance:{1d,1w,...,10y}}],
//     watchlist: [{symbol, name, ySymbol, cat, cur, performance:{1d,...,10y}}] }
//   ※ historicals（日次価格系列）は重い（5MB超）ため含めない。
//     必要な情報は positions[].performance / watchlist[].performance に集約済み。
// ══════════════════════════════════════════════════════════════

const _SNAPSHOT_PERIODS = [
  { id: '1d',  days: 1   },
  { id: '1w',  days: 7   },
  { id: '1m',  days: 30  },
  { id: '3m',  days: 91  },
  { id: '6m',  days: 182 },
  { id: '9m',  days: 273 },
  { id: '1y',  days: 365 },
  { id: '3y',  days: 1095 },
  { id: '5y',  days: 1825 },
  { id: '10y', days: 3650 },
];

async function handlePortfolioSnapshot(request, env, origin, ctx) {
  if (request.method !== 'POST') return errRes('POST のみ許可', 405, origin);
  if (!env.KV) return errRes('KV 未設定', 500, origin);

  // body が空でなければ frontend が用意した payload をそのまま使う
  let payload = null;
  try { payload = await request.json(); } catch { /* body 無し可 */ }

  // payload が空 or 'auto-build' フラグ → Worker 側でゼロから組み立て
  const shouldBuild = !payload || payload.autoBuild === true || !payload.positions;
  let snapshot;
  if (shouldBuild) {
    snapshot = await _buildSnapshotFromKV(env);
    snapshot.source = 'worker-manual';
  } else {
    snapshot = { ...payload, asOf: payload.asOf || new Date().toISOString(), source: payload.source || 'frontend-manual' };
  }

  if (!snapshot) return errRes('スナップショット生成失敗', 500, origin);

  if (!snapshot.asOf || typeof snapshot.asOf !== 'string') return errRes('Snapshot.asOf は必須です', 400, origin);
  if (!snapshot.source || typeof snapshot.source !== 'string') return errRes('Snapshot.source は必須です', 400, origin);
  if (!snapshot.summary || typeof snapshot.summary !== 'object') return errRes('Snapshot.summary は必須です', 400, origin);
  if (typeof snapshot.summary.totalValue !== 'number' || !isFinite(snapshot.summary.totalValue)) return errRes('Snapshot.summary.totalValue は有限数値が必要です', 400, origin);
  if (typeof snapshot.summary.totalPnl !== 'number' || !isFinite(snapshot.summary.totalPnl)) return errRes('Snapshot.summary.totalPnl は有限数値が必要です', 400, origin);
  if (typeof snapshot.summary.positionCount !== 'number' || !Number.isInteger(snapshot.summary.positionCount) || snapshot.summary.positionCount < 0) return errRes('Snapshot.summary.positionCount は非負整数が必要です', 400, origin);
  if (typeof snapshot.summary.watchlistCount !== 'number' || !Number.isInteger(snapshot.summary.watchlistCount) || snapshot.summary.watchlistCount < 0) return errRes('Snapshot.summary.watchlistCount は非負整数が必要です', 400, origin);
  if (typeof snapshot.summary.currencyBase !== 'string' || !snapshot.summary.currencyBase.trim()) return errRes('Snapshot.summary.currencyBase は必須です', 400, origin);
  if (!Array.isArray(snapshot.positions)) return errRes('Snapshot.positions は配列が必要です', 400, origin);
  if (!Array.isArray(snapshot.watchlist)) return errRes('Snapshot.watchlist は配列が必要です', 400, origin);

  // GitHub push を waitUntil で保護
  const push = _pushSnapshotToGithub(snapshot, env).catch(e => console.warn('[snapshot push]', e));
  if (ctx?.waitUntil) ctx.waitUntil(push);

  return jsonRes({
    ok: true,
    asOf: snapshot.asOf,
    positions: snapshot.positions?.length || 0,
    source: snapshot.source,
  }, 200, origin);
}

// KV の positions + watchlist を元に Yahoo Finance から historicals を取得してスナップショットを構築
async function _buildSnapshotFromKV(env) {
  const posVal = await env.KV.get('positions');
  if (!posVal) return null;
  const positions = JSON.parse(posVal);
  if (!Array.isArray(positions) || positions.length === 0) return null;

  // Watchlist（保有していない注目銘柄）も同時に取得
  const wlVal = await env.KV.get('watchlist');
  const watchlist = wlVal ? (JSON.parse(wlVal) || []) : [];

  // 全対象銘柄（positions + watchlist、重複除去）
  const allSymbols = [...new Set([
    ...positions.map(p => p.ySymbol),
    ...watchlist.map(w => w.ySymbol || w.symbol),
  ].filter(Boolean))];

  // 1y/5y/10y の historicals を並列フェッチ（範囲ごと・5並列バッチ）
  const RANGES = ['1y', '5y', '10y'];
  const historicals = { '1y': {}, '5y': {}, '10y': {} };
  for (const range of RANGES) {
    const BATCH = 5;
    for (let i = 0; i < allSymbols.length; i += BATCH) {
      const batch = allSymbols.slice(i, i + BATCH);
      await Promise.all(batch.map(async sym => {
        const arr = await _fetchYahooHistory(sym, range).catch(() => null);
        if (arr) historicals[range][sym] = arr;
      }));
      if (i + BATCH < allSymbols.length) await new Promise(r => setTimeout(r, 600));
    }
  }

  const perfOf = (ySymbol) => {
    const perf = {};
    for (const { id, days } of _SNAPSHOT_PERIODS) {
      perf[id] = _computePeriodPctFromHistoricals(ySymbol, days, historicals);
    }
    return perf;
  };

  // positions に performance を付与
  const positionsWithPerf = positions.map(p => ({
    ...p,
    performance: perfOf(p.ySymbol),
  }));

  // watchlist は最小限フィールド + performance のみ
  const watchlistWithPerf = watchlist.map(w => ({
    symbol: w.symbol,
    name:   w.name || w.symbol,
    ySymbol: w.ySymbol || w.symbol,
    cat:    w.cat || null,
    cur:    w.cur || null,
    performance: perfOf(w.ySymbol || w.symbol),
  }));

  // サマリ
  const totalValue = positions.reduce((s, p) => s + (p.value || 0), 0);
  const totalPnl   = positions.reduce((s, p) => s + (p.pnl || 0), 0);
  const summary = {
    totalValue,
    totalPnl,
    totalPnlPct: totalValue > totalPnl ? totalPnl / (totalValue - totalPnl) * 100 : null,
    positionCount: positions.length,
    watchlistCount: watchlistWithPerf.length,
    currencyBase: 'JPY',
    performance: _computePortfolioPerf(positionsWithPerf, totalValue),
  };

  // historicals は performance 算出に内部利用するだけで、出力 JSON には含めない（サイズ削減）
  return {
    asOf: new Date().toISOString(),
    source: 'worker-cron',
    summary,
    positions: positionsWithPerf,
    watchlist: watchlistWithPerf,
  };
}

// Yahoo Finance chart API から [{date, close}] を取得（日次データ）
async function _fetchYahooHistory(ySymbol, range) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?interval=1d&range=${range}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 portfolio-proxy-worker' },
    cf: { cacheTtl: 600 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) return null;
  const timestamps = result.timestamp || [];
  const adjCloses  = result.indicators?.adjclose?.[0]?.adjclose || [];
  const rawCloses  = result.indicators?.quote?.[0]?.close || [];
  const closes = adjCloses.length ? adjCloses : rawCloses;
  return timestamps
    .map((ts, i) => ({ date: new Date(ts * 1000).toISOString().slice(0, 10), close: closes[i] }))
    .filter(p => p.close != null && isFinite(p.close));
}

// historicals から N 日前との % 変化を計算
function _computePeriodPctFromHistoricals(ySymbol, days, historicals) {
  // 1y / 5y / 10y のうち適切なレンジを選択
  const range = days <= 365 ? '1y' : (days <= 1825 ? '5y' : '10y');
  const arr = historicals[range]?.[ySymbol];
  if (!arr || arr.length < 2) return null;
  const latest = arr[arr.length - 1].close;
  // N 日前のインデックスを近似（営業日ベース）
  const targetIdx = Math.max(0, arr.length - 1 - Math.round(days * 252 / 365));
  const past = arr[targetIdx]?.close;
  if (latest == null || past == null || past === 0) return null;
  return ((latest - past) / past) * 100;
}

// 全銘柄を value 加重平均してポートフォリオ全体のパフォーマンスを算出
function _computePortfolioPerf(positionsWithPerf, totalValue) {
  const perf = {};
  if (!totalValue) return perf;
  for (const { id } of _SNAPSHOT_PERIODS) {
    let weighted = 0;
    let coveredValue = 0;
    for (const p of positionsWithPerf) {
      const pct = p.performance?.[id];
      if (pct == null || !p.value) continue;
      weighted += (pct / 100) * p.value;
      coveredValue += p.value;
    }
    perf[id] = coveredValue > 0 ? (weighted / coveredValue) * 100 : null;
  }
  return perf;
}

// スナップショットを data/portfolio-snapshot.json として GitHub に push
async function _pushSnapshotToGithub(snapshot, env) {
  if (!env.GITHUB_TOKEN) return;
  const owner = 'shoulang0729';
  const repo  = 'portfolio';
  const path  = 'data/portfolio-snapshot.json';
  const branch = 'main';
  const headers = {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'portfolio-proxy-worker',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  let sha;
  try {
    const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers });
    if (getRes.ok) { const meta = await getRes.json(); sha = meta.sha; }
  } catch {}

  const content = btoa(unescape(encodeURIComponent(JSON.stringify(snapshot, null, 2) + '\n')));
  const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `chore(snapshot): ${snapshot.source || 'auto'} @ ${snapshot.asOf || new Date().toISOString()}`,
      content,
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!putRes.ok) {
    const t = await putRes.text().catch(() => '');
    console.warn(`[snapshot push] HTTP ${putRes.status}: ${t.slice(0, 200)}`);
    return;
  }
}

// ── AI モデル一覧（各プロバイダーの /v1/models を集約・1時間KVキャッシュ）─
// レスポンス形式:
//   { openai: ['gpt-5.4-mini', ...], gemini: ['gemini-2.5-flash', ...],
//     grok:   ['grok-4.3', ...],     claude: ['claude-sonnet-4-6', ...],
//     cachedAt: '2026-05-17T...', ttl: 3600 }
//
// 部分的に取得失敗したプロバイダーは null を返す（フロント側でハードコードへフォールバック）
async function handleAIModels(env, origin) {
  const CACHE_KEY = 'ai:models:v1';
  const CACHE_TTL = 3600; // 1時間

  if (env.KV) {
    const cached = await env.KV.get(CACHE_KEY, 'json');
    if (cached && cached.cachedAt && (Date.now() - cached.cachedAt < CACHE_TTL * 1000)) {
      return jsonRes(cached, 200, origin);
    }
  }

  const [openai, gemini, grok, claude] = await Promise.all([
    _fetchOpenAIModels(env.OPENAI_API_KEY).catch(e => { console.warn('openai models:', e); return null; }),
    _fetchGeminiModels(env.GEMINI_API_KEY).catch(e => { console.warn('gemini models:', e); return null; }),
    _fetchGrokModels(env.GROK_API_KEY).catch(e => { console.warn('grok models:', e); return null; }),
    _fetchClaudeModels(env.ANTHROPIC_API_KEY).catch(e => { console.warn('claude models:', e); return null; }),
  ]);

  const result = { openai, gemini, grok, claude, cachedAt: Date.now(), ttl: CACHE_TTL };
  if (env.KV) {
    await env.KV.put(CACHE_KEY, JSON.stringify(result), { expirationTtl: CACHE_TTL });
  }
  return jsonRes(result, 200, origin);
}

async function _fetchOpenAIModels(apiKey) {
  if (!apiKey) return null;
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  // チャット用モデルのみ抽出（embeddings/dall-e/whisper/tts/moderation を除外）
  return (j.data || [])
    .map(m => m.id)
    .filter(id => /^(gpt-|o\d|chatgpt-)/i.test(id))
    .filter(id => !/embed|dall-e|whisper|tts|moderation|realtime|audio|search-preview|transcribe/i.test(id))
    .sort()
    .reverse(); // 新しいモデルが先頭になりやすい
}

async function _fetchGeminiModels(apiKey) {
  if (!apiKey) return null;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  // generateContent をサポートする gemini モデルのみ
  return (j.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => (m.name || '').replace(/^models\//, ''))
    .filter(id => /^gemini-/i.test(id))
    .filter(id => !/embedding|vision-latest|aqa/i.test(id))
    .sort()
    .reverse();
}

async function _fetchGrokModels(apiKey) {
  if (!apiKey) return null;
  const res = await fetch('https://api.x.ai/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  // 言語モデルのみ（imagine/vision-only を除外）
  return (j.data || [])
    .map(m => m.id)
    .filter(id => /^grok-/i.test(id))
    .filter(id => !/imagine|tts|stt|realtime|vision-only/i.test(id))
    .sort()
    .reverse();
}

async function _fetchClaudeModels(apiKey) {
  if (!apiKey) return null;
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  return (j.data || [])
    .map(m => m.id)
    .filter(id => /^claude-/i.test(id))
    .sort()
    .reverse();
}

// ══════════════════════════════════════════════════════════════
// AI コンテキスト・プリフェッチ
// 質問内容(カテゴリ)に応じて Finnhub から必要なデータだけ取得し、
// LLM の system prompt に注入できる Markdown 文字列を返す。
//
// POST body:
//   { categories: ['news','fundamentals','earnings','recommendation','insider'],
//     targetSymbols: ['AAPL', '9983.T'],
//     question: '...' }
//
// レスポンス:
//   { contextSection: '# 参考データ（プリフェッチ済み）\n...', gathered: 7 }
//
// 各フェッチャは独立 catch。全失敗でも空 contextSection を返す。
// ══════════════════════════════════════════════════════════════
async function handleAIContext(request, env, origin) {
  if (request.method !== 'POST') return errRes('POST のみ許可', 405, origin);
  if (!env.FINNHUB_API_KEY)      return jsonRes({ contextSection: '', gathered: 0 }, 200, origin);

  let body;
  try { body = await request.json(); } catch { return errRes('JSON が不正です', 400, origin); }
  const { categories = [], targetSymbols = [], question = '' } = body;

  const gathered = await _gatherContext({ categories, targetSymbols, question }, env);
  const contextSection = _buildContextSection(gathered);
  return jsonRes({ contextSection, gathered: gathered.length }, 200, origin);
}

// ── 個別フェッチャ ──
async function _fetchFinnhubNews(ySym, env) {
  const fSym = _workerToFinnhubSymbol(ySym);
  if (!fSym) return null;
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = d => d.toISOString().slice(0, 10);
  const url = `https://finnhub.io/api/v1/company-news?symbol=${fSym}&from=${fmt(from)}&to=${fmt(to)}&token=${env.FINNHUB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data)) return null;
  return data.slice(0, 5).map(n => ({
    headline: n.headline, summary: n.summary, source: n.source, url: n.url,
    datetime: n.datetime ? new Date(n.datetime * 1000).toISOString() : '',
  }));
}

async function _fetchFinnhubFundamentals(ySym, env) {
  const fSym = _workerToFinnhubSymbol(ySym);
  if (!fSym) return null;
  const url = `https://finnhub.io/api/v1/stock/metric?symbol=${fSym}&metric=all&token=${env.FINNHUB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const m = data.metric || {};
  return {
    peTTM: m.peTTM, pbAnnual: m.pbAnnual, epsTTM: m.epsTTM, psTTM: m.psTTM,
    roeTTM: m.roeTTM, dividendYield: m.dividendYieldIndicatedAnnual,
    weekHigh52: m['52WeekHigh'], weekLow52: m['52WeekLow'],
  };
}

async function _fetchFinnhubEarnings(ySym, env) {
  const fSym = _workerToFinnhubSymbol(ySym);
  if (!fSym) return null;
  const url = `https://finnhub.io/api/v1/stock/earnings?symbol=${fSym}&token=${env.FINNHUB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) ? data.slice(0, 4) : null;
}

async function _fetchFinnhubRecommendation(ySym, env) {
  const fSym = _workerToFinnhubSymbol(ySym);
  if (!fSym) return null;
  const url = `https://finnhub.io/api/v1/stock/recommendation?symbol=${fSym}&token=${env.FINNHUB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) ? data.slice(0, 3) : null;
}

async function _fetchFinnhubInsider(ySym, env) {
  const fSym = _workerToFinnhubSymbol(ySym);
  if (!fSym) return null;
  const url = `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${fSym}&token=${env.FINNHUB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return (data?.data || []).slice(0, 10);
}

const _FETCHER_MAP = {
  news:           _fetchFinnhubNews,
  fundamentals:   _fetchFinnhubFundamentals,
  earnings:       _fetchFinnhubEarnings,
  recommendation: _fetchFinnhubRecommendation,
  insider:        _fetchFinnhubInsider,
};
const _SYMBOL_BOUND = new Set(Object.keys(_FETCHER_MAP));

async function _gatherContext({ categories, targetSymbols }, env) {
  const tasks = [];
  for (const cat of categories) {
    if (_SYMBOL_BOUND.has(cat)) {
      for (const sym of targetSymbols || []) {
        tasks.push(
          _FETCHER_MAP[cat](sym, env)
            .then(data => ({ cat, sym, data }))
            .catch(() => ({ cat, sym, data: null })),
        );
      }
    }
    // macro 等の銘柄非依存カテゴリは今回未実装（将来 Brave Search を足すならここに分岐追加）
  }
  const results = await Promise.all(tasks);
  return results.filter(r => r.data);
}

function _buildContextSection(gathered) {
  if (!gathered.length) return '';
  // 銘柄×カテゴリでグルーピング
  const bySym = {};
  for (const r of gathered) {
    bySym[r.sym] ||= {};
    bySym[r.sym][r.cat] = r.data;
  }
  let out = '# 参考データ（プリフェッチ済み・出典: Finnhub）\n';
  for (const [sym, cats] of Object.entries(bySym)) {
    out += `\n## ${sym}\n`;
    if (cats.news) {
      out += `### 直近ニュース（過去1週間, 最大5件）\n`;
      cats.news.forEach((n, i) => {
        const date = (n.datetime || '').slice(0, 10);
        out += `${i + 1}. ${n.headline} — ${n.source} (${date})\n   ${n.summary || ''}\n   ${n.url || ''}\n`;
      });
    }
    if (cats.fundamentals) {
      const f = cats.fundamentals;
      const fmt = v => (v != null ? Number(v).toFixed(2) : 'N/A');
      out += `### ファンダメンタル指標\n`
           + `- PER(TTM): ${fmt(f.peTTM)} / PBR: ${fmt(f.pbAnnual)} / PSR: ${fmt(f.psTTM)}\n`
           + `- EPS(TTM): ${fmt(f.epsTTM)} / ROE: ${fmt(f.roeTTM)}%\n`
           + `- 配当利回り: ${fmt(f.dividendYield)}%\n`
           + `- 52週高値/安値: ${fmt(f.weekHigh52)} / ${fmt(f.weekLow52)}\n`;
    }
    if (cats.earnings) {
      out += `### 直近決算（最大4四半期）\n`;
      cats.earnings.forEach(e => {
        out += `- ${e.period ?? '?'}: 実績EPS ${e.actual ?? 'N/A'} / 予想 ${e.estimate ?? 'N/A'} / Surprise ${e.surprisePercent ?? 'N/A'}%\n`;
      });
    }
    if (cats.recommendation) {
      out += `### アナリスト評価（直近3ヶ月）\n`;
      cats.recommendation.forEach(r => {
        out += `- ${r.period}: 強買${r.strongBuy} / 買${r.buy} / 中立${r.hold} / 売${r.sell} / 強売${r.strongSell}\n`;
      });
    }
    if (cats.insider) {
      out += `### インサイダー取引（直近10件）\n`;
      cats.insider.forEach(t => {
        out += `- ${t.transactionDate ?? '?'} ${t.name ?? '?'}: ${t.share ?? '?'}株 (${t.transactionCode ?? '?'})\n`;
      });
    }
  }
  return out;
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
    if (!Array.isArray(body)) return errRes('Array が必要です', 400, origin);

    for (let i = 0; i < body.length; i++) {
      const item = body[i];
      if (!item || typeof item !== 'object') return errRes(`watchlist[${i}]: object が必要です`, 400, origin);
      if (typeof item.symbol !== 'string' || !item.symbol.trim()) return errRes(`watchlist[${i}].symbol は必須です`, 400, origin);
      if (typeof item.name !== 'string' || !item.name.trim()) return errRes(`watchlist[${i}].name は必須です`, 400, origin);
      if (typeof item.exchange !== 'string' || !item.exchange.trim()) return errRes(`watchlist[${i}].exchange は必須です`, 400, origin);
      if (typeof item.type !== 'string' || !item.type.trim()) return errRes(`watchlist[${i}].type は必須です`, 400, origin);
      if (typeof item.cur !== 'string' || !item.cur.trim()) return errRes(`watchlist[${i}].cur は必須です`, 400, origin);
    }

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

// ── 保有銘柄（KV・非公開）────────────────────────────────────
// GET: 許可オリジンからのみ取得可能
// PUT: 許可オリジンかつ X-Pin-Hash ヘッダーによる PIN 認証が必要
// X-Pin-Hash ヘッダーを KV の保存ハッシュと照合する。
// OK なら null、NG なら errRes を返す（呼び出し側でそのまま return する）。
async function verifyPinHash(request, env, origin) {
  const pinHash = request.headers.get('X-Pin-Hash');
  if (!pinHash) return errRes('認証が必要です（X-Pin-Hash）', 401, origin);
  const storedHash = await env.KV.get('auth:pin-hash');
  if (!storedHash) return errRes('PIN初期設定が必要です', 428, origin);
  if (pinHash !== storedHash) return errRes('PIN認証失敗', 401, origin);
  return null;
}

async function handlePositions(request, env, origin, ctx) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);

  if (request.method === 'GET') {
    const val = await env.KV.get('positions');
    return jsonRes(val ? JSON.parse(val) : [], 200, origin);
  }

  if (request.method === 'PUT') {
    const authErr = await verifyPinHash(request, env, origin);
    if (authErr) return authErr;

    let body;
    try { body = await request.json(); } catch { return errRes('JSON 不正', 400, origin); }
    if (!Array.isArray(body)) return errRes('Array が必要です', 400, origin);

    for (let i = 0; i < body.length; i++) {
      const pos = body[i];
      if (!pos || typeof pos !== 'object') return errRes(`positions[${i}]: object が必要です`, 400, origin);
      if (typeof pos.symbol !== 'string' || !pos.symbol.trim()) return errRes(`positions[${i}].symbol は必須です`, 400, origin);
      if (typeof pos.name !== 'string' || !pos.name.trim()) return errRes(`positions[${i}].name は必須です`, 400, origin);
      if (typeof pos.cat !== 'string' || !pos.cat.trim()) return errRes(`positions[${i}].cat は必須です`, 400, origin);
      if (typeof pos.shares !== 'number' || !isFinite(pos.shares)) return errRes(`positions[${i}].shares は有限数値が必要です`, 400, origin);
      if (typeof pos.price !== 'number' || !isFinite(pos.price)) return errRes(`positions[${i}].price は有限数値が必要です`, 400, origin);
      if (typeof pos.avgCost !== 'number' || !isFinite(pos.avgCost)) return errRes(`positions[${i}].avgCost は有限数値が必要です`, 400, origin);
      if (typeof pos.value !== 'number' || !isFinite(pos.value)) return errRes(`positions[${i}].value は有限数値が必要です`, 400, origin);
      if (typeof pos.pnl !== 'number' || !isFinite(pos.pnl)) return errRes(`positions[${i}].pnl は有限数値が必要です`, 400, origin);
      if (typeof pos.pnlPct !== 'number' || !isFinite(pos.pnlPct)) return errRes(`positions[${i}].pnlPct は有限数値が必要です`, 400, origin);
      if (typeof pos.cur !== 'string' || !pos.cur.trim()) return errRes(`positions[${i}].cur は必須です`, 400, origin);
      if (typeof pos.ySymbol !== 'string' || !pos.ySymbol.trim()) return errRes(`positions[${i}].ySymbol は必須です`, 400, origin);
    }

    await env.KV.put('positions', JSON.stringify(body));

    // GitHub にもミラー（response 返却後も処理を継続させるため waitUntil で包む）
    const githubSync = _syncPositionsToGithub(body, env).catch(e => console.warn('[github sync]', e));
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(githubSync);
    }

    return jsonRes({ ok: true }, 200, origin);
  }

  return errRes('GET/PUT のみ許可', 405, origin);
}

// ══════════════════════════════════════════════════════════════
// GitHub Contents API ミラー: KV に保存した positions を
// shoulang0729/portfolio リポジトリの data/positions.json にも書き出す
//
// 他アプリは https://raw.githubusercontent.com/shoulang0729/portfolio/main/data/positions.json
// から fetch して利用可能。
//
// 必要 Secret: GITHUB_TOKEN（Classic PAT で repo スコープ）
// ══════════════════════════════════════════════════════════════
async function _syncPositionsToGithub(positions, env) {
  if (!env.GITHUB_TOKEN) return;
  const owner  = 'shoulang0729';
  const repo   = 'portfolio';
  const path   = 'data/positions.json';
  const branch = 'main';

  const headers = {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept':        'application/vnd.github+json',
    'User-Agent':    'portfolio-proxy-worker',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // 1. 現在の SHA を取得（無ければ新規作成扱い）
  let sha = undefined;
  try {
    const getRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      { headers },
    );
    if (getRes.ok) {
      const meta = await getRes.json();
      sha = meta.sha;
    }
  } catch (e) { /* 取得失敗時は sha なしで新規 PUT */ }

  // 2. base64 エンコード（Worker は btoa が使える）
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(positions, null, 2) + '\n')));

  // 3. PUT で content を上書き
  const putRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `chore(positions): sync from KV (${positions.length} items)`,
        content,
        branch,
        ...(sha ? { sha } : {}),
      }),
    },
  );

  if (!putRes.ok) {
    const errText = await putRes.text().catch(() => '');
    console.warn(`[github sync] HTTP ${putRes.status}: ${errText.slice(0, 300)}`);
    return;
  }
}

// ── PIN ハッシュ更新 ──────────────────────────────────────────
async function handleAuthPinHash(request, env, origin) {
  if (request.method !== 'PUT') return errRes('PUT のみ許可', 405, origin);
  if (!env.KV) return errRes('KV 未設定', 500, origin);

  let body;
  try { body = await request.json(); } catch { return errRes('JSON 不正', 400, origin); }
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

// ── ETF 構成銘柄（look-through・KV キャッシュ）─────────────────
// GET /etf/constituents?symbol=<sym>
// 1. KV `constituents:<symbol>` を返す / 2. 無ければアダプタ取得 → 正規化 → KV 保存
async function handleEtfConstituents(url, env, origin, ctx) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);
  const symbol = (url.searchParams.get('symbol') || '').trim();
  if (!symbol) return errRes('symbol が必要です', 400, origin);

  // 1. KV キャッシュ
  const cached = await env.KV.get(CONSTITUENTS_KV_PREFIX + symbol, 'json');
  if (cached) return jsonRes(cached, 200, origin);

  // 2. 取得アダプタ（B2 公式CSV / B3 Yahoo）— 失敗は 404 として扱う
  let raw = null;
  try {
    raw = await fetchEtfConstituents(symbol, env);
  } catch (e) {
    console.warn('[etf/constituents]', symbol, e);
  }
  if (!raw || !Array.isArray(raw.holdings) || raw.holdings.length === 0) {
    return errRes('構成銘柄が見つかりません', 404, origin);
  }

  // 3. 正規化して KV に保存（書き込みはレスポンスをブロックしない）
  const normalized = buildConstituentsResponse(raw);
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(
      env.KV.put(CONSTITUENTS_KV_PREFIX + symbol, JSON.stringify(normalized), { expirationTtl: CONSTITUENTS_TTL })
    );
  }
  return jsonRes(normalized, 200, origin);
}

// ── 価格キャッシュ（Cron が書き込み、フロントが読む）──────────
async function handlePricesCache(env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);
  const val = await env.KV.get('prices:cache');
  return jsonRes(val ? JSON.parse(val) : {}, 200, origin);
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
// セキュリティ: 未認証者がパスキーを登録できないよう PIN 認証を必須にする（#239）
async function handleAuthRegister(request, env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);
  const authErr = await verifyPinHash(request, env, origin);
  if (authErr) return authErr;
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
  async fetch(request, env, ctx) {
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
    if (path === '/')                return new Response('portfolio-proxy OK', { status: 200 });
    if (path === '/yahoo' || path === '/finnhub' || path === '/etf/constituents') {
      if (await checkRateLimit(request, env)) return errRes('Too Many Requests', 429, org);
    }
    if (path === '/yahoo')           return handleYahoo(url, env, org);
    if (path === '/finnhub')         return handleFinnhub(url, env, org);
    if (path === '/forex')           return handleForex(url, env, org);
    if (path === '/etf/constituents') return handleEtfConstituents(url, env, org, ctx);
    if (path === '/ai/models')       return handleAIModels(env, org);
    if (path === '/ai/context')      return handleAIContext(request, env, org);
    if (path.startsWith('/ai/'))     return handleAI(request, path, env, org);
    if (path === '/watchlist')       return handleWatchlist(request, env, org);
    if (path === '/positions')       return handlePositions(request, env, org, ctx);
    if (path === '/portfolio/snapshot') return handlePortfolioSnapshot(request, env, org, ctx);
    if (path === '/prices/cache')    return handlePricesCache(env, org);
    if (path === '/auth/pin-hash')   return handleAuthPinHash(request, env, org);
    if (path === '/notion/save')     return handleNotionSave(request, env, org);
    if (path === '/auth/challenge')  return handleAuthChallenge(env, org);
    if (path === '/auth/register')   return handleAuthRegister(request, env, org);
    if (path === '/auth/verify')     return handleAuthVerify(request, env, org);

    return errRes('Not Found', 404, org);
  },

  // ── Cron: 6時間ごとに全保有銘柄の価格をキャッシュ ───────────
  async scheduled(event, env, ctx) {
    if (!env.KV || !env.FINNHUB_API_KEY) return;

    const posVal = await env.KV.get('positions');
    if (!posVal) return;
    const positions = JSON.parse(posVal);
    if (!positions.length) return;

    const cache = {};
    const BATCH = 5;

    for (let i = 0; i < positions.length; i += BATCH) {
      const batch = positions.slice(i, i + BATCH);
      await Promise.all(batch.map(async p => {
        if (!p.ySymbol) return;
        try {
          const fSym = _workerToFinnhubSymbol(p.ySymbol);
          const res = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(fSym)}&token=${env.FINNHUB_API_KEY}`,
            { cf: { cacheTtl: 300 } }
          );
          if (!res.ok) return;
          const d = await res.json();
          if (d?.c && d.c > 0) {
            cache[p.ySymbol] = { price: d.c, dayPct: d.dp ?? null, ts: Date.now() };
          }
        } catch { /* 個別エラーは無視して継続 */ }
      }));
      // バッチ間の待機（Finnhub 60リクエスト/分制限）
      if (i + BATCH < positions.length) {
        await new Promise(r => setTimeout(r, 1200));
      }
    }

    if (Object.keys(cache).length > 0) {
      await env.KV.put('prices:cache', JSON.stringify(cache), { expirationTtl: 25200 }); // 7h TTL
    }

    // ── 6時間ごとのポートフォリオ・スナップショット生成 → GitHub に push ──
    try {
      const snapshot = await _buildSnapshotFromKV(env);
      if (snapshot) {
        snapshot.source = 'worker-cron';
        await _pushSnapshotToGithub(snapshot, env);
      }
    } catch (e) {
      console.warn('[cron snapshot]', e);
    }
  },
};
