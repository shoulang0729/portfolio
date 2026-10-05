// portfolio-proxy — Cloudflare Worker
//
// ルート一覧:
//   GET  /yahoo?url=<encoded>           Yahoo Finance プロキシ（CORS 回避）
//   GET  /finnhub?path=<path>&<params>  Finnhub プロキシ（APIキー隠蔽）
//   GET  /fmp?path=<path>&<params>      Financial Modeling Prep プロキシ（APIキー隠蔽・quality 用）
//   GET  /edgar?path=<path>             SEC EDGAR プロキシ（キー不要・UA付与・quality 照合用）
//   GET  /edinet-db?path=<path>         EDINET DB プロキシ（APIキー隠蔽・日本株 quality 用）
//   GET  /forex?from=<from>&to=<to>    為替レートプロキシ（Yahoo Finance）
//   GET  /etf/constituents?symbol=<sym> ETF 構成銘柄（look-through・KV キャッシュ）。取得アダプタ未実装のため
//                                       現状はキャッシュが無ければ 404（etf-constituents.js・#305）
//   GET  /watchlist                     ウォッチリスト取得（KV・公開）
//   PUT  /watchlist                     ウォッチリスト保存（KV・X-Pin-Hash 必須＝アプリのみ・#715）
//   POST /watchlist/resync              公開 main の data/valuations.json（SHA 固定）を KV watchlist の valuation に写す
//                                       （認証なし・本文/クエリは読まない・ズレ時のみ書く・RESYNC_LIMITER・#715）
//   GET  /positions                     保有銘柄取得（KV・非公開・PIN認証必須・#714）
//   PUT  /positions                     保有銘柄保存（KV・PIN認証必須）
//   GET  /networth                      ネットワース機微データ取得（KV・非公開・PIN認証必須・#589 Phase2）
//   PUT  /networth                      ネットワース機微データ保存（KV・PIN認証必須・#589 Phase2）
//   GET  /order-sheet                   注文表を計算して返す（KV・PIN認証必須・KV に書かない・#672）
//   GET  /order-sheet/plan              注文表の設定 order:plan 取得（KV・PIN認証必須・#672）
//   PUT  /order-sheet/plan              注文表の設定 order:plan 置換（KV・PIN認証必須・rev 楽観ロック・#672）
//   POST /order-sheet/events            注文表の状態変更（KV・PIN認証必須・rev 楽観ロック・#672）
//   GET  /auth/pin-hash                 PIN 設定状態確認（ハッシュ値は返さない）
//   PUT  /auth/pin-hash                 PIN ハッシュ更新/端末復旧（KV）
//   GET  /prices/cache                  Cron キャッシュ価格取得（KV）
//   GET  /auth/challenge                パスキー認証チャレンジ生成
//   POST /auth/register                 パスキー登録
//   POST /auth/verify                   パスキー検証
//
// 無効化済み（どのメソッドでも 410 Gone・CORS 付き。古いキャッシュのアプリ向けに 404 にしない）:
//   *    /portfolio/snapshot            スナップショット保存の停止（#709）
//   *    /ai/{gemini,grok,deepseek,claude,models,context}, /notion/save
//                                       AI タブ専用ルートの停止（#714）
//   *    /ai/openai                     マネフォ画像取込の削除（#718）
//
// 環境変数（Cloudflare Secrets / vars・名前のみ）:
//   FINNHUB_API_KEY      /finnhub・Cron の価格キャッシュ
//   FMP_API_KEY          /fmp
//   EDINET_DB_API_KEY    /edinet-db
//   SEC_USER_AGENT       /edgar（未設定時は既定の UA）
//   GH_DISPATCH_TOKEN    per-daily.yml の起動（無ければ GITHUB_TOKEN）・/watchlist/resync の main SHA 取得（読むだけ）
//   GITHUB_TOKEN         同上のフォールバック
//   ALLOWED_ORIGIN       CORS の許可 Origin（vars・未設定時は https://shoulang0729.github.io）
//   （GEMINI/GROK/DEEPSEEK/ANTHROPIC/NOTION 系は #714 以降、OPENAI_API_KEY は #718 以降 Worker からは参照しない）
// Binding:
//   KV                   Cloudflare KV namespace
//   RATE_LIMITER         Workers ネイティブ ratelimit（rate-limit.md・未設定時は素通し）
//   RESYNC_LIMITER       /watchlist/resync 専用 ratelimit（10 req/60s・IP 単位・未設定時は RATE_LIMITER・#715）
//
// Cron（wrangler.toml）:
//   0 1,8,15,22 * * *  — 1日4回、全保有銘柄の価格を取得してキャッシュ
//                        ＋注文表の約定（mf の株数の増減）を order:plan に確定（変化時のみ書く・#672）
//                        ＋KV watchlist の valuation を main に同期（ズレ時のみ書く・失敗しても他の処理は続ける・#715）
//   20 20,21 * * *     — per-daily.yml を workflow_dispatch で起動（#708）。
//                        米国東部の夏時間は 20:20 UTC、冬時間は 21:20 UTC の回だけ。他の処理はしない。
//                        トークンは GH_DISPATCH_TOKEN || GITHUB_TOKEN（ログには名前だけ）

import { handleAuthChallenge, handleAuthPinHash, handleAuthRegister, handleAuthVerify } from './auth.js';
import { scheduled } from './cron.js';
import { corsHeaders, errRes, isAllowedOrigin } from './http.js';
import {
  handleEdgar,
  handleEdinetDb,
  handleEtfConstituents,
  handleFinnhub,
  handleFmp,
  handleForex,
  handlePricesCache,
  handleYahoo,
} from './routes-market.js';
import { handleNetworth, handlePositions, handleWatchlist, handleWatchlistResync } from './routes-kv.js';
import { handleOrderSheet, handleOrderSheetEvents, handleOrderSheetPlan } from './routes-order-sheet.js';
import { DISABLED_PATHS, handleDisabledRoute, handlePortfolioSnapshot } from './routes.js';

// ── レート制限 ────────────────────────────────────────
// KV shard 方式（旧 #62）は 1 リクエストあたり KV 読み 5・書き 1 を消費し、
// 無料枠の書き込み上限 1,000/日が実質ボトルネックになった（2026-09-21 に
// 50% 到達アラート）。#16 対応で KV 実装を撤去し、Workers ネイティブの
// ratelimit binding（wrangler.toml の RATE_LIMITER・KV 不使用・無料）に移行。
// 判定は fetch ルーティング内で実施。経緯は worker/src/rate-limit.md を参照。

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
    if (path === '/') return new Response('portfolio-proxy OK', { status: 200 });
    // 無効化済みルート（#714）: レート制限・外部 fetch・KV より前に 410 を返す
    if (DISABLED_PATHS.has(path)) return handleDisabledRoute(org);
    // レート制限: Workers ネイティブ ratelimit binding（#16・KV 不使用・rate-limit.md 参照）。
    // binding 未設定環境（テスト等）では素通し。判定失敗時も fail-open。
    if (
      path === '/yahoo' ||
      path === '/finnhub' ||
      path === '/fmp' ||
      path === '/edgar' ||
      path === '/edinet-db' ||
      path === '/etf/constituents' ||
      path === '/forex' ||
      path === '/order-sheet' ||
      path.startsWith('/order-sheet/')
    ) {
      if (env.RATE_LIMITER) {
        try {
          const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
          const { success } = await env.RATE_LIMITER.limit({ key: ip });
          if (!success) return errRes('Too Many Requests', 429, org);
        } catch {
          /* fail-open */
        }
      }
    }
    // /watchlist/resync: 専用 binding（RESYNC_LIMITER・10/60s）。無ければ RATE_LIMITER、どちらも無ければ素通し（#715）
    if (path === '/watchlist/resync') {
      const limiter = env.RESYNC_LIMITER || env.RATE_LIMITER;
      if (limiter) {
        try {
          const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
          const { success } = await limiter.limit({ key: ip });
          if (!success) return errRes('Too Many Requests', 429, org);
        } catch {
          /* fail-open */
        }
      }
    }
    if (path === '/yahoo') return handleYahoo(url, env, org);
    if (path === '/finnhub') return handleFinnhub(url, env, org);
    if (path === '/fmp') return handleFmp(url, env, org);
    if (path === '/edgar') return handleEdgar(url, env, org);
    if (path === '/edinet-db') return handleEdinetDb(url, env, org);
    if (path === '/forex') return handleForex(url, env, org);
    if (path === '/etf/constituents') return handleEtfConstituents(url, env, org, ctx);
    if (path === '/watchlist') return handleWatchlist(request, env, org);
    if (path === '/watchlist/resync') return handleWatchlistResync(request, env, org);
    if (path === '/positions') return handlePositions(request, env, org);
    if (path === '/networth') return handleNetworth(request, env, org);
    if (path === '/order-sheet') return handleOrderSheet(request, env, org);
    if (path === '/order-sheet/plan') return handleOrderSheetPlan(request, env, org);
    if (path === '/order-sheet/events') return handleOrderSheetEvents(request, env, org);
    if (path === '/portfolio/snapshot') return handlePortfolioSnapshot(org);
    if (path === '/prices/cache') return handlePricesCache(env, org);
    if (path === '/auth/pin-hash') return handleAuthPinHash(request, env, org);
    if (path === '/auth/challenge') return handleAuthChallenge(env, org);
    if (path === '/auth/register') return handleAuthRegister(request, env, org);
    if (path === '/auth/verify') return handleAuthVerify(request, env, org);

    return errRes('Not Found', 404, org);
  },
  scheduled,
};
