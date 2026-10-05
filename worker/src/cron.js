import { appendLog, detectFills, validatePlan } from './order-plan.js';
import { _workerToFinnhubSymbol } from './routes-market.js';
import { ORDER_LOG_KEY, ORDER_PLAN_KEY, _kvJson } from './routes-order-sheet.js';
import { isUsEasternDst } from './us-dst.js';

const PER_DAILY_CRON = '20 20,21 * * *';
const PER_DAILY_DISPATCH_URL =
  'https://api.github.com/repos/shoulang0729/portfolio/actions/workflows/per-daily.yml/dispatches';

/**
 * Cron: mf の株数による約定を KV に確定する（§5.2）。変化があるときだけ order:plan・order:log を書く。
 * 書く直前に読み直し、rev が変わっていれば今回は書かない（次回に回す・§5.3）。
 * @returns {Promise<{written: boolean, fills: number}>}
 */
// ── per-daily.yml の workflow_dispatch（#708・docs/handoff/2026-10-05-per-daily-dispatch.md §4.2(c)） ──
const PER_DAILY_MAX_ATTEMPTS = 3;
const PER_DAILY_TIMEOUT_MS = 15000;
const PER_DAILY_BACKOFF_MS = [2000, 4000];

/**
 * per-daily.yml を workflow_dispatch で起動する。204 で成功。
 * 429・5xx・ネットワークエラー・タイムアウトは計 3 回まで試す。401/403/404/422 などは再試行しない。
 * 最終的に失敗したら throw（Cloudflare の Cron 履歴に失敗として残す）。ログにはトークンの名前だけ出す。
 */
async function _dispatchPerDaily(env) {
  const token = env.GH_DISPATCH_TOKEN || env.GITHUB_TOKEN;
  const tokenName = env.GH_DISPATCH_TOKEN ? 'GH_DISPATCH_TOKEN' : 'GITHUB_TOKEN';
  if (!token) {
    console.error('[cron per-daily] no token');
    throw new Error('per-daily dispatch: no token');
  }

  let status = 0;
  let msg = '';
  for (let attempt = 1; attempt <= PER_DAILY_MAX_ATTEMPTS; attempt++) {
    let retryable = false;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), PER_DAILY_TIMEOUT_MS);
    try {
      const res = await fetch(PER_DAILY_DISPATCH_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'portfolio-proxy-worker',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'main' }),
        signal: ac.signal,
      });
      status = res.status;
      if (status === 204) {
        console.log(`[cron per-daily] dispatched 204 token=${tokenName}`);
        return;
      }
      msg = '';
      try {
        const j = await res.json();
        if (j && typeof j.message === 'string') msg = j.message.slice(0, 200);
      } catch {
        /* 本文が JSON でなければ message なし */
      }
      retryable = status === 429 || status >= 500;
    } catch (e) {
      status = 0;
      msg = e?.name === 'AbortError' ? 'timeout' : String(e?.name || 'network error').slice(0, 200);
      retryable = true;
    } finally {
      clearTimeout(timer);
    }
    if (!retryable || attempt === PER_DAILY_MAX_ATTEMPTS) break;
    console.warn('[cron per-daily] retry', attempt, status);
    await new Promise((r) => setTimeout(r, PER_DAILY_BACKOFF_MS[attempt - 1]));
  }

  console.error('[cron per-daily] dispatch failed', status, `token=${tokenName}`, msg);
  throw new Error(`per-daily dispatch failed: HTTP ${status}`);
}

async function _cronConfirmOrderFills(env) {
  if (!env.KV) return { written: false, fills: 0 };
  const [plan, networth] = await Promise.all([_kvJson(env, ORDER_PLAN_KEY), _kvJson(env, 'networth')]);
  if (!plan || !networth) return { written: false, fills: 0 };
  const now = new Date().toISOString();
  const { plan: detected, logs } = detectFills(plan, networth, now);
  if (!logs.length) return { written: false, fills: 0 };

  const latest = await _kvJson(env, ORDER_PLAN_KEY);
  const baseRev = Number.isInteger(plan.rev) ? plan.rev : 0;
  if (!latest || (Number.isInteger(latest.rev) ? latest.rev : 0) !== baseRev) {
    console.warn('[cron order-fills] rev が変わったため次回に回す');
    return { written: false, fills: 0 };
  }
  const next = { ...detected, rev: baseRev + 1, updatedAt: now };
  const v = validatePlan(next);
  if (!v.ok) {
    console.warn('[cron order-fills] 適用後の plan が不正のため書かない');
    return { written: false, fills: 0 };
  }
  const log = await _kvJson(env, ORDER_LOG_KEY);
  await env.KV.put(ORDER_PLAN_KEY, JSON.stringify(next));
  await env.KV.put(ORDER_LOG_KEY, JSON.stringify(appendLog(log, logs)));
  for (const l of logs) console.warn('[cron order-fills]', l.partial ? 'partial' : 'filled', l.symbol);
  return { written: true, fills: logs.length };
}

// ── Cron: 1日4回（0 1,8,15,22 * * *）全保有銘柄の価格をキャッシュ ───────────
export async function scheduled(event, env, _ctx) {
  // per-daily.yml の起動（#708）。この Cron では価格キャッシュ・注文表の約定を動かさない
  if (event?.cron === PER_DAILY_CRON) {
    const t = new Date(event.scheduledTime ?? Date.now());
    const want = isUsEasternDst(t) ? 20 : 21;
    if (t.getUTCHours() !== want) {
      console.log('[cron per-daily] skip (season)', t.getUTCHours());
      return;
    }
    await _dispatchPerDaily(env);
    return;
  }

  // 注文表の約定確定（#672）。価格キャッシュの有無と独立に先に実行し、失敗しても既存処理は続ける
  try {
    await _cronConfirmOrderFills(env);
  } catch (e) {
    console.warn('[cron order-fills]', e?.name);
  }

  if (!env.KV || !env.FINNHUB_API_KEY) return;

  const posVal = await env.KV.get('positions');
  if (!posVal) return;
  const positions = JSON.parse(posVal);
  if (!positions.length) return;

  const cache = {};
  const BATCH = 5;

  for (let i = 0; i < positions.length; i += BATCH) {
    const batch = positions.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (p) => {
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
        } catch {
          /* 個別エラーは無視して継続 */
        }
      })
    );
    // バッチ間の待機（Finnhub 60リクエスト/分制限）
    if (i + BATCH < positions.length) {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  if (Object.keys(cache).length > 0) {
    await env.KV.put('prices:cache', JSON.stringify(cache), { expirationTtl: 25200 }); // 7h TTL
  }
}
