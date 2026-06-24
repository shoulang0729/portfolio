// ══════════════════════════════════════════════════════════════
// watchlist.js  ―  ウォッチリスト（タブ3）
//
// 依存: state.js (state), utils.js (makeTh, makePctCell, getColor,
//        getCellTextColor, getHistoricalChangePct, fmtPrice, fmtPctInt),
//       positions.js (PERIOD_COLS, PERIOD_IDS, PERIOD_MAP),
//       data.js (fetchViaProxy, fetchLivePrice, fetchAllHistorical, WORKER_URL)
// ══════════════════════════════════════════════════════════════

import { state } from './state.js';
import { escapeHTML, fmtPrice } from './utils.js';
import { renderHeatmapList } from './stock-list.js';
import { fetchViaProxy, fetchLivePrice, fetchAllHistorical, setStatus } from './data.js';
import { WORKER_URL } from './config.js';
import { validateWatchlistItem } from './schema.js';

// ══════════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════════

function saveWatchlist() {
  try {
    localStorage.setItem('hm-watchlist', JSON.stringify(state.watchlist));
  } catch (e) {
    console.warn('[watchlist] localStorage 保存失敗（容量超過の可能性）:', e);
  }
  clearTimeout(_wlKvSyncTimer);
  _wlKvSyncTimer = setTimeout(_syncWatchlistToWorker, 1000);
}

let _wlKvSyncTimer = null;

async function _syncWatchlistToWorker() {
  try {
    const res = await fetch(`${WORKER_URL}/watchlist`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.watchlist),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch {
    setStatus('ウォッチリストの保存に失敗しました（ローカルには保存済み）', 'yellow');
  }
}

async function _loadWatchlistFromWorker() {
  try {
    const res = await fetch(`${WORKER_URL}/watchlist`);
    if (!res.ok) return;
    const remote = await res.json();
    if (Array.isArray(remote) && remote.length > 0) {
      // 通常: KV のデータをローカルへ反映
      state.watchlist = remote;
      try {
        localStorage.setItem('hm-watchlist', JSON.stringify(remote));
      } catch (e) {
        console.warn('[watchlist] localStorage 保存失敗（容量超過の可能性）:', e);
      }
    } else if (state.watchlist.length > 0) {
      // 初期シード: KV が空でローカルにデータがある → ローカルを KV に push
      _syncWatchlistToWorker();
    } else {
      await _restoreWatchlistFromSnapshot();
    }
  } catch {
    /* localStorageをそのまま使用 */
  }
}

async function _restoreWatchlistFromSnapshot() {
  try {
    const res = await fetch('data/portfolio-snapshot.json', { cache: 'no-store' });
    if (!res.ok) return false;
    const snapshot = await res.json();
    if (!Array.isArray(snapshot.watchlist) || snapshot.watchlist.length === 0) return false;
    const restored = [];
    const seen = new Set();
    for (const item of snapshot.watchlist) {
      const symbol = String(item?.symbol || '').trim();
      if (!symbol || seen.has(symbol)) continue;
      const exchange = wlDetectMarket(symbol, '');
      const normalized = {
        symbol,
        name: String(item?.name || symbol),
        exchange,
        type: _snapshotWatchlistType(symbol, item?.name),
        cur: item?.cur || (exchange === '東証' ? 'JPY' : exchange === '香港' ? 'HKD' : 'USD'),
      };
      try {
        restored.push(validateWatchlistItem(normalized));
        seen.add(symbol);
      } catch (e) {
        console.warn('[watchlist] snapshot restore skipped:', symbol, e.message);
      }
    }
    if (restored.length === 0) return false;
    state.watchlist = restored;
    localStorage.setItem('hm-watchlist', JSON.stringify(restored));
    _syncWatchlistToWorker();
    setStatus(`ウォッチリストをスナップショットから復元しました（${restored.length}件）`, 'green');
    return true;
  } catch (e) {
    console.warn('[watchlist] snapshot restore failed:', e);
    return false;
  }
}

function _snapshotWatchlistType(symbol, name) {
  const text = `${symbol} ${name || ''}`.toUpperCase();
  if (text.includes('ETF') || text.includes('上場投信') || text.includes('上場投資信託')) return 'ETF';
  if (text.endsWith('=X')) return 'CURRENCY';
  return '株';
}

function addToWatchlist(item) {
  try {
    validateWatchlistItem(item);
  } catch (e) {
    console.warn('[watchlist] validation failed for item:', item?.symbol, e.message);
    return;
  }
  if (state.watchlist.some((w) => w.symbol === item.symbol)) return;
  state.watchlist.push(item);
  saveWatchlist();
  renderHeatmapList();
  fetchWatchlistData();
}

function removeFromWatchlist(symbol) {
  state.watchlist = state.watchlist.filter((w) => w.symbol !== symbol);
  saveWatchlist();
  renderHeatmapList();
}

// ══════════════════════════════════════════════
// SEARCH
// ══════════════════════════════════════════════

// ── ティッカー情報取得（チャートAPI + quoteSummary を並列実行）──
async function fetchTickerInfo(symbol) {
  // chart API（価格）と quoteSummary（正式商品名）を並列取得
  const [chartData, qsData] = await Promise.all([
    fetchViaProxy(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`, 7000),
    fetchViaProxy(`https://query2.finance.yahoo.com/v11/finance/quoteSummary/${symbol}?modules=price`, 6000),
  ]);

  const result = chartData?.chart?.result?.[0];
  if (!result) return null;
  const meta = result.meta || {};
  const price = meta.regularMarketPrice ?? null;
  if (price == null) return null;

  const preCalcPct = meta.regularMarketChangePercent ?? null;
  const prevClose = meta.regularMarketPreviousClose ?? meta.chartPreviousClose ?? null;
  const dayPct = preCalcPct !== null ? preCalcPct : prevClose ? ((price - prevClose) / prevClose) * 100 : null;

  // 名前: quoteSummary の longName を最優先（日本ETFの正式商品名が入ることが多い）
  const qsPrice = qsData?.quoteSummary?.result?.[0]?.price || {};
  const candidates = [qsPrice.longName, qsPrice.shortName, meta.longName, meta.shortName]
    .map((s) => (s || '').trim())
    .filter(Boolean);
  // 最も長い名前を採用（商品名は運用会社名より長い傾向がある）
  const name = candidates.length ? candidates.reduce((a, b) => (b.length > a.length ? b : a)) : symbol;

  // quoteType 判定: instrumentType → quoteType → 名前内キーワード の優先順
  const rawType = (meta.quoteType || qsPrice.quoteType || '').toUpperCase();
  const instrType = (meta.instrumentType || '').toUpperCase();
  const isEtfByName = name.includes('ETF') || name.includes('上場投信') || name.includes('上場投資信託');
  const type =
    instrType === 'ETF' || rawType === 'ETF' || isEtfByName
      ? 'ETF'
      : rawType === 'MUTUALFUND'
        ? 'MUTUALFUND'
        : rawType === 'CURRENCY'
          ? 'CURRENCY'
          : rawType || 'EQUITY';

  return { price, dayPct, name, type, exchange: meta.exchangeName || '' };
}

// ── 市場ラベル・バッジ変換ヘルパー ──
function wlDetectMarket(symbol, exchangeName) {
  if (symbol.endsWith('.T')) return '東証';
  if (symbol.endsWith('.HK')) return '香港';
  if (symbol.endsWith('=X')) return '通貨';
  if (exchangeName) {
    if (/tokyo|tse/i.test(exchangeName)) return '東証';
    if (/hong kong|hkex/i.test(exchangeName)) return '香港';
  }
  return 'US';
}
function wlTypeBadge(quoteType) {
  const t = (quoteType || '').toUpperCase();
  if (t === 'ETF') return 'ETF';
  if (t === 'MUTUALFUND') return '投信';
  if (t === 'CURRENCY') return '通貨';
  return '株';
}

// ── 検索 ──
let _wlSearchTimer = null;
let _wlSearchSeq = 0;

function onWatchlistSearch(eventOrQuery) {
  // data-action ディスパッチャ経由（input イベント）、または文字列引数の両方を受ける
  const q = typeof eventOrQuery === 'string' ? eventOrQuery : (eventOrQuery?.target?.value ?? '');
  clearTimeout(_wlSearchTimer);
  const dropdown = document.getElementById('wl-search-dropdown');
  if (!dropdown) return; // 統合タブ構成で要素不在の経路がある（#484）
  if (!q.trim()) {
    dropdown.hidden = true;
    return;
  }
  dropdown.innerHTML = '<div class="wl-search-msg">確認中…</div>';
  dropdown.hidden = false;
  _wlSearchTimer = setTimeout(() => searchTicker(q), 500);
}

async function searchTicker(q) {
  const dropdown = document.getElementById('wl-search-dropdown');
  const input = q.trim().toUpperCase();
  // race condition 対策: このリクエストの世代を記録。await 後に最新でなければ破棄する（#246）
  const seq = ++_wlSearchSeq;

  // 入力から試すシンボル一覧を生成
  const candidates = new Set([input]);

  // 数字のみ4〜5桁 → 日本株(.T)・香港株(.HK)も試す
  if (/^\d{4,5}$/.test(input)) {
    candidates.add(`${input}.T`);
    candidates.add(`${input}.HK`);
    // 香港株: 先頭ゼロなし版も試す（例: "09992" → "9992.HK"）
    candidates.add(`${parseInt(input, 10)}.HK`);
  }

  // .HK suffix 付きの場合: ゼロあり/なし両方試す
  // 例: "09992.HK" → "9992.HK" も試す、"9992.HK" → "09992.HK" も試す
  if (input.endsWith('.HK')) {
    const base = input.slice(0, -3);
    const noZero = String(parseInt(base, 10));
    const withZero = noZero.padStart(4, '0');
    candidates.add(`${noZero}.HK`);
    candidates.add(`${withZero}.HK`);
  }

  // 全候補を並列取得（チャートAPIなので必ず動作する）
  const results = await Promise.all(
    [...candidates].map(async (sym) => {
      const info = await fetchTickerInfo(sym);
      return info ? { symbol: sym, ...info } : null;
    })
  );
  // await 完了時に、より新しい検索が始まっていたらこの結果は破棄（#246）
  if (seq !== _wlSearchSeq) return;
  // 重複シンボルを除去して返す
  const seen = new Set();
  const found = results.filter((r) => r && !seen.has(r.symbol) && seen.add(r.symbol));

  if (found.length === 0) {
    dropdown.innerHTML = `<div class="wl-search-msg">
      「${escapeHTML(input)}」は見つかりませんでした
      <br><small style="opacity:0.65;font-size:11px">米国: VWO / AAPL &nbsp;|&nbsp; 日本: 7203.T &nbsp;|&nbsp; 香港: 0700.HK</small>
    </div>`;
    return;
  }

  dropdown.innerHTML = found
    .map((item) => {
      const market = wlDetectMarket(item.symbol, item.exchange);
      const badge = wlTypeBadge(item.type);
      const already = state.watchlist.some((w) => w.symbol === item.symbol);
      const cur = market === '東証' ? 'JPY' : market === '香港' ? 'HKD' : 'USD';
      const priceStr = fmtPrice(item.price, cur);
      const pctStr = item.dayPct != null ? `${item.dayPct >= 0 ? '+' : ''}${item.dayPct.toFixed(2)}%` : '';
      const sym = escapeHTML(item.symbol);
      const name = escapeHTML(item.name || item.symbol);
      const mkt = escapeHTML(market);
      const bdg = escapeHTML(badge);
      return `<div class="wl-search-item${already ? ' wl-already' : ''}"
         data-symbol="${sym}"
         data-name="${name}"
         data-market="${mkt}"
         data-badge="${bdg}"
         data-action="wlSelectItem">
      <span class="wl-sym">${sym}</span>
      <span class="wl-type-badge">${bdg}</span>
      <span class="wl-market-label">${mkt}</span>
      <span class="wl-item-name">${name}</span>
      <span class="wl-item-price">${priceStr}${pctStr ? ` <span class="wl-item-pct ${item.dayPct >= 0 ? 'pos' : 'neg'}">${pctStr}</span>` : ''}</span>
      ${
        already
          ? '<span class="wl-status-tag wl-registered">登録済</span>'
          : '<span class="wl-status-tag wl-add-tag">＋ 追加</span>'
      }
    </div>`;
    })
    .join('');
}

function wlSelectItem(arg, event) {
  const el = event instanceof Event ? event.target.closest('.wl-search-item') : arg;
  if (!el || el.classList.contains('wl-already')) return;
  const symbol = el.dataset.symbol;
  const name = el.dataset.name;
  const exchange = el.dataset.market;
  const type = el.dataset.badge;

  // 通貨を市場から判定
  let cur = 'USD';
  if (exchange === '東証') cur = 'JPY';
  else if (exchange === '香港') cur = 'HKD';

  addToWatchlist({ symbol, name, exchange, type, cur });

  // ドロップダウン内の表示を更新
  el.classList.add('wl-already');
  const tag = el.querySelector('.wl-status-tag');
  if (tag) {
    tag.className = 'wl-status-tag wl-registered';
    tag.textContent = '登録済';
  }

  // 検索欄をクリア
  const input = document.getElementById('wl-search-input');
  if (input) input.value = '';
  const dropdown = document.getElementById('wl-search-dropdown');
  if (dropdown) dropdown.hidden = true;
}

// 検索欄の外をクリックしたらドロップダウンを閉じる
document.addEventListener('click', (e) => {
  if (!e.target.closest('#wl-search-wrap')) {
    const dd = document.getElementById('wl-search-dropdown');
    if (dd) dd.hidden = true;
  }
});

// ══════════════════════════════════════════════
// DATA FETCH
// ══════════════════════════════════════════════

async function fetchWatchlistData() {
  const symbols = state.watchlist.map((w) => w.symbol);
  if (symbols.length === 0) return;

  // ライブ価格を並列取得
  await Promise.all(
    symbols.map(async (sym) => {
      const live = await fetchLivePrice(sym);
      if (live) state.watchlistPrices[sym] = live;
    })
  );

  // 履歴データは Historical Heatmap と共通の fetchAllHistorical 経由で取得する。
  // → state.fetchingRanges / state.historicalAttempted のフラグが正しくセットされ、
  //    "…/-" の loading 表示が銘柄リストと同じ仕様で動く。
  // → 既に取得済みのシンボルは内部 toFetch で除外されるので無駄打ち無し。
  for (const range of ['1y', '5y', '10y']) {
    await fetchAllHistorical(range);
    renderHeatmapList(); // 各レンジ完了ごとに再描画 → "…" が実値 or "-" に置換（統合タブ）
  }
}

// 描画・ソートは統合タブ（stock-list.js renderHeatmapList / heatSort）に集約。
// このモジュールは STORAGE / SEARCH / FETCH のデータ層に専念する。

export {
  saveWatchlist,
  _loadWatchlistFromWorker,
  _restoreWatchlistFromSnapshot,
  addToWatchlist,
  removeFromWatchlist,
  onWatchlistSearch,
  wlSelectItem,
  fetchWatchlistData,
};
