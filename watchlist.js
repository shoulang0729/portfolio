// ══════════════════════════════════════════════════════════════
// watchlist.js  ―  ウォッチリスト（タブ3）
//
// 依存: state.js (state), utils.js (makeTh, makePctCell, getColor,
//        getCellTextColor, getHistoricalChangePct, fmtPrice, fmtPctInt),
//       positions.js (PERIOD_COLS, PERIOD_IDS, PERIOD_MAP),
//       data.js (fetchViaProxy, fetchLivePrice, fetchSymbolHistory)
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════════

function saveWatchlist() {
  localStorage.setItem('hm-watchlist', JSON.stringify(state.watchlist));
}

function addToWatchlist(item) {
  if (state.watchlist.some(w => w.symbol === item.symbol)) return;
  state.watchlist.push(item);
  saveWatchlist();
  renderWatchlist();
  fetchWatchlistData();
}

function removeFromWatchlist(symbol) {
  state.watchlist = state.watchlist.filter(w => w.symbol !== symbol);
  saveWatchlist();
  renderWatchlist();
}

// ══════════════════════════════════════════════
// SEARCH
// ══════════════════════════════════════════════

// ── ティッカー情報取得（チャートAPI + quoteSummary を並列実行）──
async function fetchTickerInfo(symbol) {
  // chart API（価格）と quoteSummary（正式商品名）を並列取得
  const [chartData, qsData] = await Promise.all([
    fetchViaProxy(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`, 7000
    ),
    fetchViaProxy(
      `https://query2.finance.yahoo.com/v11/finance/quoteSummary/${symbol}?modules=price`, 6000
    ),
  ]);

  const result = chartData?.chart?.result?.[0];
  if (!result) return null;
  const meta  = result.meta || {};
  const price = meta.regularMarketPrice ?? null;
  if (price == null) return null;

  const preCalcPct = meta.regularMarketChangePercent ?? null;
  const prevClose  = meta.regularMarketPreviousClose ?? meta.chartPreviousClose ?? null;
  const dayPct = preCalcPct !== null
    ? preCalcPct
    : (prevClose ? ((price - prevClose) / prevClose) * 100 : null);

  // 名前: quoteSummary の longName を最優先（日本ETFの正式商品名が入ることが多い）
  const qsPrice = qsData?.quoteSummary?.result?.[0]?.price || {};
  const candidates = [
    qsPrice.longName,
    qsPrice.shortName,
    meta.longName,
    meta.shortName,
  ].map(s => (s || '').trim()).filter(Boolean);
  // 最も長い名前を採用（商品名は運用会社名より長い傾向がある）
  const name = candidates.length
    ? candidates.reduce((a, b) => b.length > a.length ? b : a)
    : symbol;

  // quoteType 判定: instrumentType → quoteType → 名前内キーワード の優先順
  const rawType = (meta.quoteType || qsPrice.quoteType || '').toUpperCase();
  const instrType = (meta.instrumentType || '').toUpperCase();
  const isEtfByName = name.includes('ETF') || name.includes('上場投信')
                   || name.includes('上場投資信託');
  const type = (instrType === 'ETF' || rawType === 'ETF' || isEtfByName) ? 'ETF'
             : (rawType === 'MUTUALFUND') ? 'MUTUALFUND'
             : (rawType === 'CURRENCY')   ? 'CURRENCY'
             : rawType || 'EQUITY';

  return { price, dayPct, name, type, exchange: meta.exchangeName || '' };
}

// ── 市場ラベル・バッジ変換ヘルパー ──
function wlDetectMarket(symbol, exchangeName) {
  if (symbol.endsWith('.T'))  return '東証';
  if (symbol.endsWith('.HK')) return '香港';
  if (symbol.endsWith('=X'))  return '通貨';
  if (exchangeName) {
    if (/tokyo|tse/i.test(exchangeName))     return '東証';
    if (/hong kong|hkex/i.test(exchangeName)) return '香港';
  }
  return 'US';
}
function wlTypeBadge(quoteType) {
  const t = (quoteType || '').toUpperCase();
  if (t === 'ETF')         return 'ETF';
  if (t === 'MUTUALFUND')  return '投信';
  if (t === 'CURRENCY')    return '通貨';
  return '株';
}

// ── 検索 ──
let _wlSearchTimer = null;

function onWatchlistSearch(q) {
  clearTimeout(_wlSearchTimer);
  const dropdown = document.getElementById('wl-search-dropdown');
  if (!q.trim()) { dropdown.hidden = true; return; }
  dropdown.innerHTML = '<div class="wl-search-msg">確認中…</div>';
  dropdown.hidden = false;
  _wlSearchTimer = setTimeout(() => searchTicker(q), 500);
}

async function searchTicker(q) {
  const dropdown = document.getElementById('wl-search-dropdown');
  const input    = q.trim().toUpperCase();

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
    [...candidates].map(async sym => {
      const info = await fetchTickerInfo(sym);
      return info ? { symbol: sym, ...info } : null;
    })
  );
  // 重複シンボルを除去して返す
  const seen = new Set();
  const found = results.filter(r => r && !seen.has(r.symbol) && seen.add(r.symbol));

  if (found.length === 0) {
    dropdown.innerHTML = `<div class="wl-search-msg">
      「${input}」は見つかりませんでした
      <br><small style="opacity:0.65;font-size:11px">米国: VWO / AAPL &nbsp;|&nbsp; 日本: 7203.T &nbsp;|&nbsp; 香港: 0700.HK</small>
    </div>`;
    return;
  }

  dropdown.innerHTML = found.map(item => {
    const market  = wlDetectMarket(item.symbol, item.exchange);
    const badge   = wlTypeBadge(item.type);
    const already = state.watchlist.some(w => w.symbol === item.symbol);
    const cur     = market === '東証' ? 'JPY' : market === '香港' ? 'HKD' : 'USD';
    const priceStr = fmtPrice(item.price, cur);
    const pctStr   = item.dayPct != null
      ? `${item.dayPct >= 0 ? '+' : ''}${item.dayPct.toFixed(2)}%`
      : '';
    return `<div class="wl-search-item${already ? ' wl-already' : ''}"
         data-symbol="${item.symbol}"
         data-name="${(item.name || item.symbol).replace(/"/g, '&quot;')}"
         data-market="${market}"
         data-badge="${badge}"
         onclick="wlSelectItem(this)">
      <span class="wl-sym">${item.symbol}</span>
      <span class="wl-type-badge wl-badge-${badge}">${badge}</span>
      <span class="wl-market-label">${market}</span>
      <span class="wl-item-name">${item.name || ''}</span>
      <span class="wl-item-price">${priceStr}${pctStr ? ` <span class="wl-item-pct ${item.dayPct >= 0 ? 'pos' : 'neg'}">${pctStr}</span>` : ''}</span>
      ${already
        ? '<span class="wl-status-tag wl-registered">登録済</span>'
        : '<span class="wl-status-tag wl-add-tag">＋ 追加</span>'}
    </div>`;
  }).join('');
}

function wlSelectItem(el) {
  if (el.classList.contains('wl-already')) return;
  const symbol   = el.dataset.symbol;
  const name     = el.dataset.name;
  const exchange = el.dataset.market;
  const type     = el.dataset.badge;

  // 通貨を市場から判定
  let cur = 'USD';
  if (exchange === '東証') cur = 'JPY';
  else if (exchange === '香港') cur = 'HKD';

  addToWatchlist({ symbol, name, exchange, type, cur });

  // ドロップダウン内の表示を更新
  el.classList.add('wl-already');
  const tag = el.querySelector('.wl-status-tag');
  if (tag) { tag.className = 'wl-status-tag wl-registered'; tag.textContent = '登録済'; }

  // 検索欄をクリア
  const input = document.getElementById('wl-search-input');
  if (input) input.value = '';
  const dropdown = document.getElementById('wl-search-dropdown');
  if (dropdown) dropdown.hidden = true;
}

// 検索欄の外をクリックしたらドロップダウンを閉じる
document.addEventListener('click', e => {
  if (!e.target.closest('#wl-search-wrap')) {
    const dd = document.getElementById('wl-search-dropdown');
    if (dd) dd.hidden = true;
  }
});

// ══════════════════════════════════════════════
// DATA FETCH
// ══════════════════════════════════════════════

async function fetchWatchlistData() {
  const symbols = state.watchlist.map(w => w.symbol);
  if (symbols.length === 0) return;

  // ライブ価格を並列取得
  await Promise.all(symbols.map(async sym => {
    const live = await fetchLivePrice(sym);
    if (live) state.watchlistPrices[sym] = live;
  }));

  // 履歴データ（1y / 5y / 10y）をキャッシュへ格納（既存データは再取得しない）
  await Promise.all(symbols.flatMap(sym => [
    fetchSymbolHistory(sym, '1y'),
    fetchSymbolHistory(sym, '5y'),
    fetchSymbolHistory(sym, '10y'),
  ]));

  renderWatchlist();
}

// ══════════════════════════════════════════════
// SORT
// ══════════════════════════════════════════════

function wlSort(col) {
  if (state.wlSortCol === col) {
    state.wlSortDir = state.wlSortDir === 'desc' ? 'asc' : 'desc';
  } else {
    state.wlSortCol = col;
    state.wlSortDir = col === 'symbol' ? 'asc' : 'desc';
  }
  renderWatchlist();
}

// ══════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════

/** ウォッチリスト用の期間騰落率取得（1d はライブ価格キャッシュから） */
function wlGetPct(item, periodId) {
  if (periodId === '1d') return state.watchlistPrices[item.symbol]?.dayPct ?? null;
  return getHistoricalChangePct(item.symbol, periodId);
}

function renderWatchlist() {
  const wrap = document.getElementById('watchlist-table-wrap');
  if (!wrap) return;

  if (state.watchlist.length === 0) {
    wrap.innerHTML = '<div class="wl-empty-msg">上の検索欄から銘柄を追加してください</div>';
    return;
  }

  // ── ソート ──
  const sorted = [...state.watchlist].sort((a, b) => {
    const col = state.wlSortCol;
    const dir = state.wlSortDir === 'desc' ? -1 : 1;
    let va, vb;
    if (col === 'symbol') {
      va = a.symbol; vb = b.symbol;
      return dir * va.localeCompare(vb);
    }
    if (col === 'market') {
      va = a.exchange ?? ''; vb = b.exchange ?? '';
      return dir * va.localeCompare(vb);
    }
    if (col === 'price') {
      va = state.watchlistPrices[a.symbol]?.price ?? -Infinity;
      vb = state.watchlistPrices[b.symbol]?.price ?? -Infinity;
    } else {
      // 1d + 全履歴期間 → wlGetPct で統一
      va = wlGetPct(a, col) ?? -Infinity;
      vb = wlGetPct(b, col) ?? -Infinity;
    }
    return dir * (va > vb ? 1 : va < vb ? -1 : 0);
  });

  // makeTh のカリー版（sortFn・ソート状態をクロージャでキャプチャ）
  const th = (label, col, align) =>
    makeTh(label, col, align, state.wlSortCol, state.wlSortDir, 'wlSort');

  // ── 行生成 ──
  const rows = sorted.map(item => {
    const live     = state.watchlistPrices[item.symbol];
    const price    = live?.price;
    const priceStr = price != null ? fmtPrice(price, item.cur) : '–';

    // 全期間セル（1d〜10y）を wlGetPct + makePctCell で統一
    const periodCells = PERIOD_COLS.map(pc =>
      makePctCell(wlGetPct(item, pc.id), PERIOD_MAP[pc.id].scale)
    ).join('');

    return `<tr>
      <td class="sl-sym">${item.symbol}<span class="sl-inline-name">${item.name}</span></td>
      <td class="wl-market-cell"><span class="wl-type-badge">${item.exchange}</span></td>
      <td class="wl-price-cell">${priceStr}</td>
      ${periodCells}
      <td class="wl-del-cell">
        <button class="wl-del-btn" onclick="removeFromWatchlist('${item.symbol}')" title="ウォッチリストから削除">×</button>
      </td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `<table class="sl-table wl-table">
    <thead><tr>
      ${th('ティッカー<br><span class="sl-th-sub">銘柄名</span>', 'symbol')}
      ${th('市場', 'market', 'center')}
      ${th('現在値', 'price')}
      ${PERIOD_COLS.map(pc => th(pc.label, pc.id, 'center')).join('')}
      <th></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}
