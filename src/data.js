// ══════════════════════════════════════════════════════════════
// data.js  ―  データ取得・CSV インポート
//
// 依存: state.js (state), positions.js (positions)
// 注: renderStats / renderHeatmap は CustomEvent 'hm:prices-updated' で呼び出す（循環依存回避）
// ══════════════════════════════════════════════════════════════

import { state } from './state.js';
import { positions } from './positions.js';

// ══════════════════════════════════════════════
// WORKER / FINNHUB CONFIG
// ══════════════════════════════════════════════
const WORKER_URL = 'https://portfolio-proxy.shoulang.workers.dev';

// ══════════════════════════════════════════════
// FETCH HELPER
// ══════════════════════════════════════════════
/**
 * タイムアウト付き fetch ラッパー
 * @param {string} url
 * @param {number} [ms=7000] タイムアウトミリ秒
 */
function fetchWithTimeout(url, ms = 7000, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal, ...opts }).finally(() => clearTimeout(timer));
}

/** 指定ミリ秒待機する */
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * バッチ処理 + 自動リトライの共通ヘルパー
 * @param {Array} items - 処理対象の配列
 * @param {Function} fn - 各アイテムを処理する非同期関数
 * @param {Object} [opts] - オプション
 * @param {number} [opts.batchSize=5] - バッチサイズ
 * @param {number} [opts.batchDelay=300] - バッチ間の待機ms
 * @param {number} [opts.retryDelay=2000] - リトライ前の待機ms
 * @param {Function} [opts.isFailed] - 失敗判定関数（default: r => !r）
 * @param {Function} [opts.onProgress] - 進捗コールバック (done, total) => void
 * @returns {Promise<Array>} 全結果
 */
async function batchWithRetry(items, fn, opts = {}) {
  const {
    batchSize = 5,
    batchDelay = 300,
    retryDelay = 2000,
    isFailed = r => !r,
    onProgress = null,
  } = opts;

  const results = [];
  let done = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(async item => {
      const result = await fn(item);
      done++;
      if (onProgress) onProgress(done, items.length);
      return result;
    }));
    results.push(...batchResults);
    if (i + batchSize < items.length) await sleep(batchDelay);
  }

  // 失敗したアイテムをリトライ
  const failedIndices = results.map((r, idx) => isFailed(r, idx) ? idx : -1).filter(idx => idx >= 0);
  if (failedIndices.length > 0) {
    await sleep(retryDelay);
    await Promise.all(failedIndices.map(async idx => {
      results[idx] = await fn(items[idx]);
    }));
  }

  return results;
}

/**
 * Yahoo Finance API を CORS プロキシ経由で取得する（4段フォールバック）
 * query1 直接 → query2 直接 → corsproxy.io → allorigins の順に試行
 * @param {string} url - Yahoo Finance API URL（query1.finance.yahoo.com）
 * @param {number} [timeoutMs=7000] 1試行あたりのタイムアウトミリ秒
 * @returns {Promise<Object|null>} パースされた JSON、失敗時は null
 */
async function fetchViaProxy(url, timeoutMs = 7000) {
  const q2url = url.replace('query1.finance.yahoo.com', 'query2.finance.yahoo.com');
  const attempts = [
    // Worker 経由（最優先：CORS 確実・APIキー不要）
    { url: `${WORKER_URL}/yahoo?url=${encodeURIComponent(url)}`,               opts: {} },
    // 以下は Worker が落ちているときのフォールバック
    { url,                                                                      opts: { credentials: 'include' } },
    { url: q2url,                                                               opts: { credentials: 'include' } },
    { url: `https://corsproxy.io/?${encodeURIComponent(url)}`,                 opts: {} },
    { url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,    opts: {} },
  ];
  for (const { url: u, opts } of attempts) {
    try {
      const res = await fetchWithTimeout(u, timeoutMs, opts);
      if (!res.ok) continue;
      const raw = await res.json();
      // allorigins wraps content in { contents: "..." }
      return raw?.contents ? JSON.parse(raw.contents) : raw;
    } catch { /* try next */ }
  }
  return null;
}

/**
 * Yahoo Finance シンボルを Finnhub シンボルに変換
 * 例: '9983.T' → 'TYO:9983' / 'AAPL' → 'AAPL'
 */
function toFinnhubSymbol(ySymbol) {
  if (!ySymbol) return null;
  if (ySymbol.endsWith('.T')) return 'TYO:' + ySymbol.slice(0, -2);
  return ySymbol;
}

/**
 * Finnhub Quote API でライブ価格・当日騰落率を取得（Worker経由）
 * @returns {Promise<{price, dayPct}|null>}
 */
async function fetchFinnhubQuote(fSymbol) {
  const url = `${WORKER_URL}/finnhub?path=/quote&symbol=${encodeURIComponent(fSymbol)}`;
  try {
    const res = await fetchWithTimeout(url, 7000);
    if (!res.ok) return null;
    const d = await res.json();
    if (!d || !d.c) return null;
    return { price: d.c, dayPct: d.dp ?? null };
  } catch { return null; }
}

/**
 * Finnhub Candles API で日足履歴データを取得（Worker経由）
 * @param {string} fSymbol - Finnhub シンボル
 * @param {number} fromTs  - 開始 UNIX タイムスタンプ（秒）
 * @param {number} toTs    - 終了 UNIX タイムスタンプ（秒）
 * @returns {Promise<Array<{date, close}>|null>}
 */
async function fetchFinnhubCandles(fSymbol, fromTs, toTs) {
  const url = `${WORKER_URL}/finnhub?path=/stock/candle&symbol=${encodeURIComponent(fSymbol)}&resolution=D&from=${fromTs}&to=${toTs}`;
  try {
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) return null;
    const d = await res.json();
    if (d?.s !== 'ok' || !d.t?.length) return null;
    return d.t.map((ts, i) => ({ date: new Date(ts * 1000), close: d.c[i] }))
              .filter(p => p.close != null && isFinite(p.close));
  } catch { return null; }
}

/**
 * Yahoo Finance crumb を取得・キャッシュする（有効期限 55 分）
 * crumb は Yahoo Finance v7 API の認証に必要なトークン
 * @returns {Promise<string|null>}
 */
async function ensureYahooCrumb() {
  const now = Date.now();
  if (state.yahooCrumb && now < state.yahooCrumbExpiry) return state.yahooCrumb;
  try {
    const res = await fetchWithTimeout(
      'https://query1.finance.yahoo.com/v1/test/getcrumb', 5000,
      { credentials: 'include' }
    );
    if (res.ok) {
      const text = await res.text();
      // crumb は短い文字列（HTMLでない）
      if (text && text.length < 50 && !text.startsWith('<')) {
        state.yahooCrumb = text.trim();
        state.yahooCrumbExpiry = now + 55 * 60 * 1000; // 55分
        return state.yahooCrumb;
      }
    }
  } catch { /* crumb なしで継続 */ }
  state.yahooCrumb = null;
  return null;
}

// ══════════════════════════════════════════════
// SESSION STORAGE CACHE  （履歴データの永続化）
// ══════════════════════════════════════════════
const SS_CACHE_KEY = 'hm-hist-cache';
const SS_CACHE_VER = '2';  // キャッシュ構造変更時にインクリメントして自動破棄

/**
 * sessionStorage から historicalCache を復元する。
 * ページリロード時に API を再取得しないようにする。
 * セッション終了（タブを閉じる）時に自動クリアされる。
 */
function loadCacheFromSession() {
  try {
    const raw = sessionStorage.getItem(SS_CACHE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj._v !== SS_CACHE_VER) return; // バージョン不一致は破棄（クリア）
    let total = 0;
    for (const range of ['1y', '5y', '10y']) {
      if (!obj[range]) continue;
      for (const [sym, entries] of Object.entries(obj[range])) {
        // ISO文字列 → Date オブジェクトに復元
        state.historicalCache[range][sym] = entries.map(e => ({
          date:  new Date(e.date),
          close: e.close,
        }));
        total++;
      }
    }
    if (total > 0) console.log(`[cache] sessionStorage から ${total} 銘柄×レンジを復元`);
  } catch (e) {
    console.warn('[cache] sessionStorage 復元失敗:', e);
    sessionStorage.removeItem(SS_CACHE_KEY);
  }
}

/**
 * historicalCache を sessionStorage に保存する。
 * fetchSymbolHistory 完了後に呼ぶ。
 * 容量超過（QuotaExceededError）時は警告のみで続行。
 */
function saveCacheToSession() {
  try {
    const obj = { _v: SS_CACHE_VER };
    for (const range of ['1y', '5y', '10y']) {
      obj[range] = {};
      for (const [sym, entries] of Object.entries(state.historicalCache[range] || {})) {
        // Date オブジェクト → ISO文字列（JSON シリアライズ可能にする）
        obj[range][sym] = entries.map(e => ({
          date:  e.date instanceof Date ? e.date.toISOString() : e.date,
          close: e.close,
        }));
      }
    }
    sessionStorage.setItem(SS_CACHE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn('[cache] sessionStorage 保存失敗（容量超過の可能性）:', e);
  }
}

/**
 * sessionStorage の履歴キャッシュをクリアする。
 * CSV インポートなどでキャッシュを無効化する際に呼ぶ。
 */
function clearCacheSession() {
  sessionStorage.removeItem(SS_CACHE_KEY);
}

// ── 起動時に即時復元（state.js のロード後、API 取得前） ──
loadCacheFromSession();

// ── KV キャッシュ価格を positions に適用 ──────────────────────
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
          const costJPY = (p.value != null && p.pnl != null) ? p.value - p.pnl : 0;
          const ratio   = oldPrice > 0 ? c.price / oldPrice : 1;
          p.value  = Math.round(p.value * ratio);
          p.pnl    = p.value - costJPY;
          p.pnlPct = costJPY > 0 ? (p.pnl / costJPY) * 100 : 0;
        }
      }
      applied++;
    }
    if (applied > 0) {
      console.log(`[prices:cache] ${applied}銘柄に Cron キャッシュ価格を適用`);
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

/**
 * 日足データの急激な価格変動（株式分割・合併）を検出し、最新価格を基準に補正する。
 * Yahoo Finance adjclose が超直近の分割に未対応の場合に自動正規化する。
 * 1日で ±50% 以上の変動を分割と判断（日本市場の値幅制限は通常 ±30% 以内）。
 * @param {Array<{date: Date, close: number}>} entries
 * @returns {Array<{date: Date, close: number}>}
 */
function applySplitCorrection(entries) {
  if (entries.length < 2) return entries;
  // 最新日を基準に、古い方向へ遡りながら急変点を補正
  for (let i = entries.length - 1; i >= 1; i--) {
    const a = entries[i].close;
    const b = entries[i - 1].close;
    if (!a || !b || a <= 0 || b <= 0) continue;
    const r = b / a;
    // 1日で1.5倍以上（または0.67倍以下）の変動 → 分割・合併と判断
    if (r >= 1.5 || r <= 1 / 1.5) {
      for (let j = 0; j < i; j++) {
        if (entries[j].close > 0) entries[j].close /= r;
      }
    }
  }
  return entries;
}

async function fetchSymbolHistory(symbol, range = '1y') {
  if (!state.historicalCache[range]) state.historicalCache[range] = {};
  if (state.historicalCache[range][symbol]) return; // already cached

  // ── Yahoo Finance のみ使用（スプリット調整済みデータのため）──
  // Finnhub はスプリット未調整データを返す場合があり、
  // 株式分割後の銘柄で -100% 等の異常表示が発生するため除外
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`;
  const data = await fetchViaProxy(url);
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
  state.historicalCache[range][symbol] = applySplitCorrection(entries);
  // sessionStorage に永続化（バックグラウンドで非同期保存）
  saveCacheToSession();
}

// ══════════════════════════════════════════════
// LIVE PRICE UPDATE
// ══════════════════════════════════════════════

/**
 * 1銘柄のライブ価格・当日騰落率を取得する
 * Finnhub を優先し、失敗時は Yahoo Finance にフォールバック
 */
async function fetchLivePrice(symbol) {
  // ── Finnhub を優先試行 ──
  const fSymbol = toFinnhubSymbol(symbol);
  if (fSymbol) {
    const fh = await fetchFinnhubQuote(fSymbol);
    if (fh) return fh;
  }

  // ── フォールバック: Yahoo Finance ──
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d&_=${Date.now()}`;
  const data = await fetchViaProxy(url);
  const result = data?.chart?.result?.[0];
  if (!result) return null;

  const price = result.meta?.regularMarketPrice ?? null;
  if (price == null) return null;

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

  // batchWithRetry でバッチ取得＋自動リトライ
  const fetched = await batchWithRetry(
    targets,
    async p => ({ pos: p, live: await fetchLivePrice(p.ySymbol) }),
    {
      isFailed: r => !r.live,
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

  let n = 0;
  fetched.forEach(({ pos: p, live }) => {
    if (!live) return;

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
      const oldPrice = p.price;
      p.price = live.price;
      if (p.cur === 'JPY') {
        // 円建て: 価格×株数で評価額を直接計算
        p.value = Math.round(live.price * p.shares);
        const costTotal = p.avgCost * p.shares;  // both JPY
        p.pnl    = p.value - costTotal;
        p.pnlPct = costTotal > 0 ? (p.pnl / costTotal) * 100 : 0;
      } else {
        // USD建て: avgCost は USD のため JPY 換算が不明。
        // 代わりに「value - pnl（JPY 取得原価）」を基準に損益を再計算する
        const costJPY = (p.value != null && p.pnl != null) ? p.value - p.pnl : 0;
        const ratio = oldPrice > 0 ? live.price / oldPrice : 1;
        p.value  = Math.round(p.value * ratio);
        p.pnl    = p.value - costJPY;
        p.pnlPct = costJPY > 0 ? (p.pnl / costJPY) * 100 : 0;
      }
      p.dayPct = live.dayPct;
      updateCache(p.ySymbol, live.price);
    }
    n++;
  });

  if (n > 0) {
    const now = new Date();
    const ts2 = now.toLocaleTimeString('ja-JP', { hour:'2-digit', minute:'2-digit' });
    const msg = `${n}銘柄 最終更新: ${ts2}`;
    state.lastUpdateText = msg;  // 履歴データ取得後に復元できるよう保存
    setStatus(msg, 'green');
    document.dispatchEvent(new CustomEvent('hm:prices-updated'));
    // 価格変化をフラッシュアニメーションで表示（前回価格がある場合のみ）
    flashPriceChanges(fetched);
  } else {
    setStatus('取得失敗（市場時間外またはAPIアクセス制限）', 'red');
  }
}

/**
 * 前回価格との差分を検出してヒートマップのセルをフラッシュさせる。
 * 上昇 → flash-up クラス（明るく）、下落 → flash-down クラス（暗く）
 * CSS animation が終了したら自動的にクラスを除去する。
 */
function flashPriceChanges(fetched) {
  const hasPrev = Object.keys(state.prevPrices).length > 0;
  if (!hasPrev) {
    // 初回取得時は次回のために価格を記録するだけ（アニメーションしない）
    fetched.forEach(({ pos: p, live }) => {
      if (live?.price && p.ySymbol) state.prevPrices[p.ySymbol] = live.price;
    });
    return;
  }

  const changes = [];
  fetched.forEach(({ pos: p, live }) => {
    if (!live?.price || !p.ySymbol) return;
    const prev = state.prevPrices[p.ySymbol];
    if (prev != null && prev !== live.price) {
      changes.push({ ySymbol: p.ySymbol, direction: live.price > prev ? 'up' : 'down' });
    }
    state.prevPrices[p.ySymbol] = live.price;
  });

  if (changes.length === 0) return;

  // 描画完了後の次フレームでアニメーションクラスを付与
  requestAnimationFrame(() => {
    const svg = document.getElementById('heatmap');
    if (!svg) return;
    changes.forEach(({ ySymbol, direction }) => {
      const rect = svg.querySelector(`rect[data-ysymbol="${CSS.escape(ySymbol)}"]`);
      if (!rect) return;
      const cls = direction === 'up' ? 'flash-up' : 'flash-down';
      // 既存クラスを除去してリフロー → 再付与（再トリガー）
      rect.classList.remove('flash-up', 'flash-down');
      void rect.getBoundingClientRect(); // reflow
      rect.classList.add(cls);
      rect.addEventListener('animationend', () => rect.classList.remove(cls), { once: true });
    });
  });
}

function setStatus(msg, color) {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  dot.className = 'dot' + (color === 'red' ? ' red' : color === 'yellow' ? ' yellow' : '');
  txt.textContent = msg;
}

// CSV パース系（normalizeStr, parseCsvText, parseNum, detectCsvType, parseJpRow, parseUsRow, parseFundRow）は src/csv.js に移動。
// 旧 importMonexCsvs / handleCsvImport は廃止（取込モーダル import.js に統合済み）。

export { WORKER_URL, fetchWithTimeout, sleep, batchWithRetry, fetchViaProxy, fetchFinnhubQuote, fetchFinnhubCandles, ensureYahooCrumb, loadCacheFromSession, saveCacheToSession, clearCacheSession, fetchAllHistorical, fetchSymbolHistory, fetchLivePrice, refreshPrices, flashPriceChanges, setStatus, applyPricesCache };
