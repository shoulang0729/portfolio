// ══════════════════════════════════════════════════════════════
// data.js  ―  データ取得オーケストレーション
//
// 依存: state.js (state), positions.js (positions)
// 注: renderStats / renderHeatmap は CustomEvent 'hm:prices-updated' で呼び出す（循環依存回避）
// ══════════════════════════════════════════════════════════════

import { state } from './state.js';
import { positions } from './positions.js';
import { WORKER_URL } from './config.js';
import { fetchWithTimeout, batchWithRetry } from './data-helpers.js';
import { fetchForexRate } from './forex.js';
import { setStatus, flashPriceChanges, renderProviderHealth } from './ui-status.js';
import { setHistoricalEntry } from './historical-cache.js';
// eslint-disable-next-line no-unused-vars
import { toFinnhubSymbol, fetchFinnhubQuote, fetchFinnhubCandles } from './data-finnhub.js';
// eslint-disable-next-line no-unused-vars
import { fetchViaProxy, ensureYahooCrumb, applySplitCorrection } from './data-yahoo.js';

// ══════════════════════════════════════════════
// KV CACHE PRICE APPLICATION
// ══════════════════════════════════════════════
async function applyPricesCache() {
  try {
    const res = await fetchWithTimeout(`${WORKER_URL}/prices/cache`, 8000);
    if (!res.ok) return;
    const cache = await res.json();
    if (!cache || typeof cache !== 'object') return;
    const now = Date.now();
    let applied = 0;
    for (const p of positions) {
      const c = cache[p.ySymbol];
      if (!c || !c.price) continue;
      // キャッシュが8時間以内のもののみ適用
      if (c.ts && (now - c.ts) > 8 * 3600 * 1000) continue;
      if (!p.isProxy && p.price > 0 && (c.price / p.price < 0.1 || c.price / p.price > 10)) continue;
      if (p.isProxy) {
        p.dayPct = c.dayPct ?? null;
      } else {
        const oldPrice = p.price;
        p.price = c.price;
        p.dayPct = c.dayPct ?? null;
        if (p.cur === 'JPY') {
          p.value = Math.round(c.price * p.shares);
          const cost = p.avgCost * p.shares;
          p.pnl    = p.value - cost;
          p.pnlPct = cost > 0 ? (p.pnl / cost) * 100 : 0;
        } else {
          // USD建て: 既存 JPY 評価額を価格変化率でスケール。
          // p.value が 0/null の場合は比率計算が無意味なのでスキップ（refreshPrices に委ねる）。
          if (p.value > 0) {
            const costJPY = (p.value != null && p.pnl != null) ? p.value - p.pnl : 0;
            const ratio   = oldPrice > 0 ? c.price / oldPrice : 1;
            p.value  = Math.round(p.value * ratio);
            p.pnl    = p.value - costJPY;
            p.pnlPct = costJPY > 0 ? (p.pnl / costJPY) * 100 : 0;
          }
        }
      }
      applied++;
    }
    if (applied > 0) {
      document.dispatchEvent(new CustomEvent('hm:prices-updated'));
    }
  } catch (e) {
    console.warn('[prices:cache] 読込失敗:', e);
  }
}

// ══════════════════════════════════════════════
// HISTORICAL DATA FETCH
// ══════════════════════════════════════════════
async function fetchAllHistorical(neededRange = '1y') {
  if (state.fetchingRanges.has(neededRange)) return; // 同じレンジが既に取得中なら重複スキップ
  state.fetchingRanges.add(neededRange);
  try {
    if (!state.historicalCache[neededRange]) state.historicalCache[neededRange] = {};
    // 保有銘柄 + ウォッチリスト銘柄を一括処理（Historical Heatmap と Watchlist Historical Heatmap で
    // 同じ履歴キャッシュ・同じ取得中フラグを共有することで "…/-" 表示の挙動も統一される）
    const posSymbols = positions.filter(p => p.ySymbol).map(p => p.ySymbol);
    const wlSymbols  = (state.watchlist || []).map(w => w.symbol).filter(Boolean);
    const symbols = [...new Set([...posSymbols, ...wlSymbols])];
    const toFetch = symbols.filter(s => !state.historicalCache[neededRange][s]);
    if (toFetch.length === 0) return;
    setStatus(`履歴データ取得中（${toFetch.length}銘柄 / ${neededRange}）...`, 'yellow');

    // batchWithRetry でバッチ取得＋自動リトライ（キャッシュ未投入を失敗と判定）
    await batchWithRetry(toFetch, s => fetchSymbolHistory(s, neededRange), {
      isFailed: (_result, idx) => !state.historicalCache[neededRange][toFetch[idx]],
    });

    // 取得完了後はライブ更新ステータスを復元（あれば緑、なければ "未更新"）
    if (state.lastUpdateText) {
      setStatus(state.lastUpdateText, 'green');
    } else {
      setStatus('未更新', 'yellow');
    }
  } finally {
    state.fetchingRanges.delete(neededRange); // 成功・失敗問わず必ず解放
    state.historicalAttempted[neededRange] = true; // この range は一度試行済み（"…" → "–" に切替えるフラグ）
  }
}


async function fetchSymbolHistory(symbol, range = '1y') {
  if (!state.historicalCache[range]) state.historicalCache[range] = {};
  if (state.historicalCache[range][symbol]) return; // already cached

  // ── Yahoo Finance のみ使用（スプリット調整済みデータのため）──
  // Finnhub はスプリット未調整データを返す場合があり、
  // 株式分割後の銘柄で -100% 等の異常表示が発生するため除外
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`;
  const data = await fetchViaProxy(url, 7000, false);
  if (!data) return;
  const result = data?.chart?.result?.[0];
  if (!result) return;
  const timestamps = result.timestamp || [];
  // adjclose はスプリット・配当調整済み終値。未収録の場合は通常終値にフォールバック
  const adjCloses = result.indicators?.adjclose?.[0]?.adjclose || [];
  const rawCloses = result.indicators?.quote?.[0]?.close || [];
  const closes = adjCloses.length ? adjCloses : rawCloses;
  const entries = timestamps
    .map((ts, i) => ({ date: new Date(ts * 1000), close: closes[i] }))
    .filter(p => p.close != null && isFinite(p.close));
  // adjclose が超直近の分割に未対応の場合に備えてスプリット自動補正
  // IDB・sessionStorage・メモリに並行書き込み
  await setHistoricalEntry(range, symbol, applySplitCorrection(entries));
}

// ══════════════════════════════════════════════
// MARKET HOURS
// ══════════════════════════════════════════════

/**
 * 現在が主要市場（TSE または NYSE）の取引時間内かどうかを返す
 * TSE:  月〜金 UTC 0:00〜6:30（JST 9:00〜15:30）
 * NYSE: 月〜金 UTC 14:30〜21:00（EST 9:30〜16:00）
 * @returns {boolean}
 */
function isMarketHours() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false; // 土日
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  const utcMin = h * 60 + m;
  const tse  = utcMin >= 0   && utcMin < 390;  // 0:00〜6:30 UTC
  const nyse = utcMin >= 870 && utcMin < 1260; // 14:30〜21:00 UTC
  return tse || nyse;
}

// ══════════════════════════════════════════════
// LIVE PRICE UPDATE
// ══════════════════════════════════════════════

/** エラー種別の日本語ラベル */
const ERR_LABELS = {
  rateLimit:    'レート制限429',
  serverError:  'サーバーエラー',
  timeout:      'タイムアウト',
  networkError: '通信エラー',
  noData:       'データなし',
};

/**
 * 1銘柄のライブ価格・当日騰落率を取得する
 * Finnhub を優先し、失敗時は Yahoo Finance にフォールバック
 * @returns {Promise<{price: number, dayPct: number|null}|{_err: string}>}
 */
async function fetchLivePrice(symbol) {
  // ── Finnhub を優先試行 ──
  let finnhubErr = null;
  const fSymbol = toFinnhubSymbol(symbol);
  if (fSymbol) {
    const fh = await fetchFinnhubQuote(fSymbol);
    if (fh && !fh._err) return fh;
    finnhubErr = fh?._err || 'networkError';
  }

  // ── フォールバック: Yahoo Finance ──
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d&_=${Date.now()}`;
  const data = await fetchViaProxy(url, 7000, true);
  const result = data?.chart?.result?.[0];
  if (!result) {
    if (!finnhubErr) {
      state.providerHealth.yahoo.ok = false;
      state.providerHealth.yahoo.errCount++;
      state.providerHealth.yahoo.lastErr = Date.now();
    }
    return { _err: finnhubErr || 'noData' };
  }

  const price = result.meta?.regularMarketPrice ?? null;
  if (price == null) return { _err: finnhubErr || 'noData' };

  // Yahoo Finance が事前計算した騰落率を最優先（サイト表示値と一致する）
  const preCalcPct = result.meta?.regularMarketChangePercent ?? null;
  const prevClose  = result.meta?.regularMarketPreviousClose
                  ?? result.meta?.chartPreviousClose
                  ?? result.meta?.previousClose ?? null;
  const dayPct = preCalcPct !== null
    ? preCalcPct
    : (prevClose ? ((price - prevClose) / prevClose) * 100 : null);
  return { price, dayPct };
}

async function refreshPrices() {
  const targets = positions.filter(p => p.ySymbol);
  if (targets.length === 0) { setStatus('取得対象銘柄なし', 'yellow'); return; }

  setStatus(`ライブ価格を取得中（0/${targets.length}）...`, 'yellow');

  // USD為替レート取得（USD建て銘柄がある場合）
  const hasUSD = targets.some(p => p.cur === 'USD');
  if (hasUSD) {
    const now = Date.now();
    // 1時間以内のキャッシュがあれば再利用
    if (!state.forexRate.USDJPY || (now - state.forexRate.ts) > 3600000) {
      const rate = await fetchForexRate('USD', 'JPY');
      if (rate) {
        state.forexRate.USDJPY = rate;
        state.forexRate.ts = now;
      }
    }
  }

  // batchWithRetry でバッチ取得＋自動リトライ
  // timeout / serverError は一時障害なのでリトライ、rateLimit / noData / networkError はしない
  const fetched = await batchWithRetry(
    targets,
    async p => ({ pos: p, live: await fetchLivePrice(p.ySymbol) }),
    {
      isFailed: r => !r.live || r.live._err === 'timeout' || r.live._err === 'serverError',
      onProgress: (done, total) => setStatus(`ライブ価格を取得中（${done}/${total}）...`, 'yellow'),
    }
  );

  const updateCache = (sym, price) => {
    if (!price || !isFinite(price) || price <= 0) return;
    for (const r of ['1y', '5y', '10y']) {
      const arr = state.historicalCache[r]?.[sym];
      if (!arr?.length) continue;
      const last = arr[arr.length - 1].close;
      // 前日比が ±70% を超える場合は Finnhub の誤データとみなしスキップ
      if (last > 0 && (price / last < 0.3 || price / last > 3.0)) {
        console.warn(`[updateCache] 異常価格スキップ: ${sym} live=${price} hist=${last}`);
        continue;
      }
      arr[arr.length - 1].close = price;
    }
  };

  // エラー種別ごとに集計
  const errCounts = {};
  fetched.forEach(({ live }) => {
    if (!live || live._err) {
      const key = live?._err || 'networkError';
      errCounts[key] = (errCounts[key] || 0) + 1;
    }
  });

  let n = 0;
  fetched.forEach(({ pos: p, live }) => {
    if (!live || live._err) return;

    // Sanity check: live価格が記録値と10倍以上乖離する場合は Finnhub 誤データとみなす
    // isProxy 銘柄はスキップ（p.price は基準価額、live.price はプロキシ価格で単位が異なる）
    if (!p.isProxy && p.price > 0 && (live.price / p.price < 0.1 || live.price / p.price > 10)) {
      console.warn(`[refreshPrices] 異常価格スキップ: ${p.symbol} live=${live.price} stored=${p.price}`);
      return;
    }

    if (p.isProxy) {
      // 投資信託: 代替インデックスの騰落率のみ反映。NAV・評価額・損益は基準価額ベースを維持
      p.dayPct = live.dayPct ?? null;
      updateCache(p.ySymbol, live.price);
    } else {
      // 通常銘柄: 価格・評価額・損益をリアルタイム更新
      p.price = live.price;
      if (p.cur === 'JPY') {
        // 円建て: 価格×株数で評価額を直接計算
        p.value = Math.round(live.price * p.shares);
        const costTotal = p.avgCost * p.shares;  // both JPY
        p.pnl    = p.value - costTotal;
        p.pnlPct = costTotal > 0 ? (p.pnl / costTotal) * 100 : 0;
      } else {
        // USD建て: 為替レートで JPY 換算。
        // fetchForexRate が失敗した場合は既存評価額から逆算した推定レートを使い
        // USD値そのままで上書きするのを防ぐ（USD値はJPY値の約1/150であり消失の原因になる）。
        const storedFxRate = state.forexRate.USDJPY;
        const estimatedFxRate = (!storedFxRate && p.value > 0 && p.price > 0 && p.shares > 0)
          ? p.value / (p.price * p.shares)
          : 0;
        const fxRate = storedFxRate || estimatedFxRate;
        const costJPY = (p.value != null && p.pnl != null) ? p.value - p.pnl : 0;
        if (fxRate > 0) {
          p.value  = Math.round(live.price * p.shares * fxRate);
          p.pnl    = p.value - costJPY;
          p.pnlPct = costJPY > 0 ? (p.pnl / costJPY) * 100 : 0;
        }
        // fxRate = 0 の場合（為替レート未取得かつ既存評価額もない）: value 更新をスキップ
      }
      p.dayPct = live.dayPct ?? null;
      updateCache(p.ySymbol, live.price);
    }
    n++;
  });

  const total = targets.length;
  const failedCount = total - n;

  /** errCounts を "レート制限429×5・タイムアウト×3" 形式に変換 */
  const fmtErrDetail = () =>
    Object.entries(errCounts)
      .map(([k, c]) => `${ERR_LABELS[k] || k}×${c}`)
      .join('・');

  if (n > 0) {
    const now = new Date();
    const ts2 = now.toLocaleTimeString('ja-JP', { hour:'2-digit', minute:'2-digit' });
    const msg = failedCount > 0
      ? `ライブ価格: ${n}/${total}銘柄 更新（${fmtErrDetail()}） ${ts2}`
      : `${n}銘柄 最終更新: ${ts2}`;
    state.lastUpdateText = msg;  // 履歴データ取得後に復元できるよう保存
    setStatus(msg, failedCount > 0 ? 'yellow' : 'green');
    document.dispatchEvent(new CustomEvent('hm:prices-updated'));
    // 価格変化をフラッシュアニメーションで表示（前回価格がある場合のみ）
    flashPriceChanges(fetched);
    // Provider health を表示
    renderProviderHealth();
  } else if (!isMarketHours()) {
    setStatus('市場時間外（前回データで表示中）', 'yellow');
    renderProviderHealth();
  } else {
    setStatus(`ライブ価格取得失敗: 0/${total}銘柄（${fmtErrDetail()}）`, 'red');
    renderProviderHealth();
  }
}


// CSV パース系（normalizeStr, parseCsvText, parseNum, detectCsvType, parseJpRow, parseUsRow, parseFundRow）は src/csv.js に移動。
// 旧 importMonexCsvs / handleCsvImport は廃止（取込モーダル import.js に統合済み）。

// 後方互換性：ヘルパー・Finnhub/Yahoo 関数を再エクスポート
export { fetchWithTimeout, sleep, batchWithRetry } from './data-helpers.js';
export { toFinnhubSymbol, fetchFinnhubQuote, fetchFinnhubCandles } from './data-finnhub.js';
export { fetchViaProxy, ensureYahooCrumb, applySplitCorrection } from './data-yahoo.js';
export { setStatus, flashPriceChanges } from './ui-status.js';
export { loadCacheFromSession, saveCacheToSession, clearCacheSession } from './cache.js';
export { migrateFromSessionStorage, restoreFromIDB, clearHistoricalIDB } from './historical-cache.js';

export { fetchAllHistorical, fetchSymbolHistory, fetchLivePrice, refreshPrices, applyPricesCache };
