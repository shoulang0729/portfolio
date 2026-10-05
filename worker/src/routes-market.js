import {
  CONSTITUENTS_KV_PREFIX,
  CONSTITUENTS_TTL,
  buildConstituentsResponse,
  fetchEtfConstituents,
} from './etf-constituents.js';
import { errRes, jsonRes } from './http.js';

export const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const FMP_BASE = 'https://financialmodelingprep.com';

/**
 * Yahoo Finance シンボルを Finnhub シンボルに変換
 * 例: '9983.T' → 'TYO:9983' / '0700.HK' → 'HKG:0700'
 */
export function _workerToFinnhubSymbol(ySymbol) {
  if (!ySymbol) return ySymbol;
  if (ySymbol.endsWith('.T')) return 'TYO:' + ySymbol.slice(0, -2);
  if (ySymbol.endsWith('.HK')) return 'HKG:' + ySymbol.slice(0, -3);
  return ySymbol;
}

// ── 為替レートプロキシ ────────────────────────────
export async function handleForex(url, env, origin) {
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
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`, {
      cf: { cacheTtl: 300 },
    });
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
      if (cached?.crumb && cached?.cookie && Date.now() - (cached.ts || 0) < 3000000) {
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
  const COOKIE_SOURCES = ['https://finance.yahoo.com/', 'https://query2.finance.yahoo.com/v1/test/getcrumb'];
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
        const pairs = rawList.map((c) => c.split(';')[0].trim()).filter(Boolean);
        if (pairs.length) {
          cookie = pairs.join('; ');
          break;
        }
      } catch {
        /* 次の候補へ */
      }
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
export async function handleYahoo(url, env, origin) {
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
export async function handleFinnhub(url, env, origin) {
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

// ── SEC EDGAR プロキシ（quality 照合/フォールバック用・キー不要だが UA 必須） ──
// data.sec.gov は User-Agent 必須（無いと 403）。path は XBRL 系のみ許可。
export async function handleEdgar(url, env, origin) {
  const path = url.searchParams.get('path') || '';
  if (!/^\/api\/xbrl\/(companyfacts|companyconcept|frames)\/[a-zA-Z0-9/._-]+$/.test(path)) {
    return errRes('不正な path です', 400, origin);
  }
  const ua = env.SEC_USER_AGENT || 'portfolio-quality contact@example.com';
  try {
    const res = await fetch(`https://data.sec.gov${path}`, {
      headers: { 'User-Agent': ua, Accept: 'application/json' },
    });
    const data = await res.json();
    return jsonRes(data, res.status, origin);
  } catch (e) {
    return errRes(`取得失敗: ${e.message}`, 502, origin);
  }
}

// ── EDINET DB プロキシ（日本株 quality 取得用） ──
// edinetdb.jp の /v1/* エンドポイントに X-API-Key を付与してプロキシする。
// path は /v1/companies/{code}/financials 等の読み取り専用エンドポイントのみ許可。
export async function handleEdinetDb(url, env, origin) {
  const apiKey = env.EDINET_DB_API_KEY;
  if (!apiKey) return errRes('EDINET DB APIキーが未設定です', 500, origin);

  const path = url.searchParams.get('path') || '';
  if (!/^\/v1\/(companies|search)(\/[a-zA-Z0-9._-]+)*(\/[a-zA-Z0-9_-]+)?(\?.*)?$/.test(path)) {
    return errRes('不正な path です', 400, origin);
  }

  const params = new URLSearchParams(url.searchParams);
  params.delete('path');
  const qs = params.toString();

  try {
    const fetchUrl = `https://edinetdb.jp${path}${qs ? `?${qs}` : ''}`;
    const res = await fetch(fetchUrl, { headers: { 'X-API-Key': apiKey, Accept: 'application/json' } });
    const data = await res.json();
    return jsonRes(data, res.status, origin);
  } catch (e) {
    return errRes(`取得失敗: ${e.message}`, 502, origin);
  }
}

// ── Financial Modeling Prep プロキシ（quality ファンダ取得用） ──
// 日次/週次バッチが key-metrics / ratios / 財務3表を叩いて quality を算出する。
// path は FMP の /api/v3・/api/v4・/stable のいずれかのみ許可（apikey は Secret 付与）。
export async function handleFmp(url, env, origin) {
  const apiKey = env.FMP_API_KEY;
  if (!apiKey) return errRes('FMP APIキーが未設定です', 500, origin);

  const path = url.searchParams.get('path') || '';
  if (!/^\/(api\/v[34]|stable)\/[a-zA-Z0-9/._-]+$/.test(path)) {
    return errRes('不正な path です', 400, origin);
  }

  const params = new URLSearchParams(url.searchParams);
  params.delete('path');
  params.set('apikey', apiKey);

  try {
    const res = await fetch(`${FMP_BASE}${path}?${params}`);
    const data = await res.json();
    return jsonRes(data, res.status, origin);
  } catch (e) {
    return errRes(`取得失敗: ${e.message}`, 502, origin);
  }
}

// ── ETF 構成銘柄（look-through・KV キャッシュ）─────────────────
// GET /etf/constituents?symbol=<sym>
// 1. KV `constituents:<symbol>` を返す / 2. 無ければアダプタ取得 → 正規化 → KV 保存
export async function handleEtfConstituents(url, env, origin, ctx) {
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
export async function handlePricesCache(env, origin) {
  if (!env.KV) return errRes('KV 未設定', 500, origin);
  const val = await env.KV.get('prices:cache');
  return jsonRes(val ? JSON.parse(val) : {}, 200, origin);
}
