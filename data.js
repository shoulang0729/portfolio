// ══════════════════════════════════════════════════════════════
// data.js  ―  データ取得・CSV インポート
//
// 依存: state.js (state, FUND_SYMBOL_PATTERNS), utils.js (setStatus,
//        renderStats, renderHeatmap ※ app.js / heatmap.js から), positions.js
// ══════════════════════════════════════════════════════════════

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
 * Yahoo Finance API を CORS プロキシ経由で取得する（4段フォールバック）
 * query1 直接 → query2 直接 → corsproxy.io → allorigins の順に試行
 * @param {string} url - Yahoo Finance API URL（query1.finance.yahoo.com）
 * @param {number} [timeoutMs=7000] 1試行あたりのタイムアウトミリ秒
 * @returns {Promise<Object|null>} パースされた JSON、失敗時は null
 */
async function fetchViaProxy(url, timeoutMs = 7000) {
  const q2url = url.replace('query1.finance.yahoo.com', 'query2.finance.yahoo.com');
  const attempts = [
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

// ══════════════════════════════════════════════
// FINNHUB CONFIG
// ══════════════════════════════════════════════
const FINNHUB_KEY = 'd6vk211r01qiiutc5h60d6vk211r01qiiutc5h6g';

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
 * Finnhub Quote API でライブ価格・当日騰落率を取得
 * @returns {Promise<{price, dayPct}|null>}
 */
async function fetchFinnhubQuote(fSymbol) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(fSymbol)}&token=${FINNHUB_KEY}`;
  try {
    const res = await fetchWithTimeout(url, 7000);
    if (!res.ok) return null;
    const d = await res.json();
    // c=0 はデータなし（週末・未収録銘柄）
    if (!d || !d.c) return null;
    return { price: d.c, dayPct: d.dp ?? null };
  } catch { return null; }
}

/**
 * Finnhub Candles API で日足履歴データを取得
 * @param {string} fSymbol - Finnhub シンボル
 * @param {number} fromTs  - 開始 UNIX タイムスタンプ（秒）
 * @param {number} toTs    - 終了 UNIX タイムスタンプ（秒）
 * @returns {Promise<Array<{date, close}>|null>}
 */
async function fetchFinnhubCandles(fSymbol, fromTs, toTs) {
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(fSymbol)}&resolution=D&from=${fromTs}&to=${toTs}&token=${FINNHUB_KEY}`;
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
// HISTORICAL DATA FETCH
// ══════════════════════════════════════════════
async function fetchAllHistorical(neededRange = '1y') {
  if (state.fetchingRanges.has(neededRange)) return; // 同じレンジが既に取得中なら重複スキップ
  state.fetchingRanges.add(neededRange);
  try {
    if (!state.historicalCache[neededRange]) state.historicalCache[neededRange] = {};
    const symbols = positions.filter(p => p.ySymbol).map(p => p.ySymbol);
    const toFetch = symbols.filter(s => !state.historicalCache[neededRange][s]);
    if (toFetch.length === 0) return;
    setStatus(`履歴データ取得中（${toFetch.length}銘柄 / ${neededRange}）...`, 'yellow');

    // 5銘柄ずつバッチ取得（レートリミット対策）
    const BATCH = 5;
    for (let i = 0; i < toFetch.length; i += BATCH) {
      await Promise.all(toFetch.slice(i, i + BATCH).map(s => fetchSymbolHistory(s, neededRange)));
      if (i + BATCH < toFetch.length) await sleep(300);
    }

    // 失敗した銘柄（キャッシュに入らなかったもの）を2秒後にリトライ
    const failed = toFetch.filter(s => !state.historicalCache[neededRange][s]);
    if (failed.length > 0) {
      await sleep(2000);
      await Promise.all(failed.map(s => fetchSymbolHistory(s, neededRange)));
    }

    // 取得完了後はライブ更新ステータスを復元（あれば緑、なければ "未更新"）
    if (state.lastUpdateText) {
      setStatus(state.lastUpdateText, 'green');
    } else {
      setStatus('未更新', 'yellow');
    }
  } finally {
    state.fetchingRanges.delete(neededRange); // 成功・失敗問わず必ず解放
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
  let done = 0;

  // 5銘柄ずつバッチ取得（レートリミット対策）
  const BATCH = 5;
  const fetched = [];
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async p => {
        const live = await fetchLivePrice(p.ySymbol);
        setStatus(`ライブ価格を取得中（${++done}/${targets.length}）...`, 'yellow');
        return { pos: p, live };
      })
    );
    fetched.push(...results);
    if (i + BATCH < targets.length) await sleep(300); // バッチ間に小休止
  }

  // 失敗した銘柄を2秒後にリトライ
  const failed = fetched.filter(f => !f.live);
  if (failed.length > 0) {
    await sleep(2000);
    await Promise.all(failed.map(async f => {
      f.live = await fetchLivePrice(f.pos.ySymbol);
    }));
  }

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
    renderStats();
    renderHeatmap();
  } else {
    setStatus('取得失敗（市場時間外またはAPIアクセス制限）', 'red');
  }
}

function setStatus(msg, color) {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  dot.className = 'dot' + (color === 'red' ? ' red' : color === 'yellow' ? ' yellow' : '');
  txt.textContent = msg;
}

// ══════════════════════════════════════════════════════════════
// CSV IMPORT  ―  マネックス証券 CSV インポート
// ══════════════════════════════════════════════════════════════

/** 全角英数字・記号 → 半角変換 ＋ 全角スペース → 半角 ＋ trim */
function normalizeStr(s) {
  return s.replace(/[\uFF01-\uFF5E]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
          .replace(/\u3000/g, ' ')
          .trim();
}

/** CSV テキスト → [[cell, ...], ...] （引用符内カンマ・改行対応） */
function parseCsvText(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQ = false;
        else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { row.push(cur); cur = ''; }
        else cur += c;
      }
    }
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

/** 文字列を数値化（カンマ・% 除去。失敗時 null） */
function parseNum(s) {
  if (s == null || s === '') return null;
  const n = parseFloat(String(s).replace(/[,\s%]/g, ''));
  return isFinite(n) ? n : null;
}

/** CSV ヘッダ行からCSV種別を判定する */
function detectCsvType(headerRow) {
  const h = headerRow.map(c => c.trim());
  if (h.includes('銘柄コード'))              return 'jp';
  if (h.some(c => c.includes('保有数[株]'))) return 'us';
  if (h.includes('基準価額'))                return 'fund';
  return null;
}

/**
 * 国内株 CSV の1行からポジションデータを抽出
 * 列: 日付,時間,銘柄名,銘柄コード,市場,口座区分,預り区分,現在値,平均取得単価,保有数,...,時価評価額,評価損益
 */
function parseJpRow(row) {
  const symbol = row[3]?.trim();
  if (!symbol) return null;
  const avgCost = parseNum(row[8]);
  const shares  = parseNum(row[9]);
  const pnl     = parseNum(row[13]);
  const pnlPct  = (avgCost != null && shares != null && avgCost > 0 && shares > 0 && pnl != null)
    ? pnl / (avgCost * shares) * 100 : null;
  return { symbol, price: parseNum(row[7]), avgCost, shares, value: parseNum(row[12]), pnl, pnlPct };
}

/**
 * 米国株 CSV の1行からポジションデータを抽出
 * 列: 銘柄名,銘柄(ticker),市場,口座区分,保有数[株],...,取得平均[ドル],...,評価単価[ドル],...,時価評価額[円],前日比[円],評価損益額[円],損益率[円]
 */
function parseUsRow(row) {
  const ticker = row[1]?.trim();
  if (!ticker) return null;
  const value  = parseNum(row[16]);
  const dayCh  = parseNum(row[17]);
  const pnl    = parseNum(row[18]);
  // row[19] の損益率は JPY/USD 混在計算のため使用しない。
  // JPY 値同士（評価損益 ÷ 取得原価）で再計算する（parseFundRow と同方式）
  const pnlPct = (value != null && pnl != null && value - pnl !== 0)
    ? (pnl / (value - pnl)) * 100 : null;
  // dayPct = 前日比(円) / (時価評価額 - 前日比) × 100
  const prevVal = (value != null && dayCh != null) ? value - dayCh : null;
  const dayPct  = (prevVal != null && prevVal !== 0) ? (dayCh / prevVal) * 100 : null;
  return { ticker, shares: parseNum(row[4]), avgCost: parseNum(row[7]), price: parseNum(row[10]),
           value, dayCh, dayPct, pnl, pnlPct };
}

/**
 * 投資信託 CSV の1行からポジションデータを抽出
 * 列: 日付,時間,銘柄名,口座区分,預り区分,基準価額,...,保有数,...,平均取得単価,概算評価額,概算評価損益
 */
function parseFundRow(row) {
  const rawName = row[2]?.trim();
  if (!rawName) return null;
  const name   = normalizeStr(rawName);
  const symbol = FUND_SYMBOL_PATTERNS.find(([pat]) => name.includes(pat))?.[1] ?? null;
  if (!symbol) return null;
  const value = parseNum(row[12]);
  const pnl   = parseNum(row[13]);
  // pnlPct = 損益 ÷ 取得原価 × 100。取得原価 = value - pnl
  const cost   = (value != null && pnl != null) ? value - pnl : null;
  const pnlPct = (cost != null && cost !== 0) ? pnl / cost * 100 : null;
  return { symbol, price: parseNum(row[5]), shares: parseNum(row[7]),
           avgCost: parseNum(row[11]), value, pnl, pnlPct };
}

/**
 * マネックス証券 CSV ファイル群（FileList）を読み込んで positions 配列を更新する
 * @param {FileList} files
 */
async function importMonexCsvs(files) {
  if (!files || files.length === 0) return;
  setStatus('CSVを解析中...', 'yellow');

  const updates = { jp: [], us: [], fund: [] };

  for (const file of files) {
    try {
      const buf  = await file.arrayBuffer();
      const text = new TextDecoder('shift-jis').decode(buf);
      const rows = parseCsvText(text);
      if (rows.length < 2) continue;
      const type = detectCsvType(rows[0]);
      if (!type) continue;
      for (let i = 1; i < rows.length; i++) {
        const data = type === 'jp'   ? parseJpRow(rows[i])
                   : type === 'us'   ? parseUsRow(rows[i])
                   : parseFundRow(rows[i]);
        if (data) updates[type].push(data);
      }
    } catch (e) {
      console.error('CSV parse error:', file.name, e);
    }
  }

  let updated = 0, skipped = 0;

  // 国内株: symbol（銘柄コード）で照合
  for (const d of updates.jp) {
    const pos = positions.find(p => p.symbol === d.symbol);
    if (!pos) { skipped++; continue; }
    if (d.price   != null) pos.price   = d.price;
    if (d.avgCost != null) pos.avgCost = d.avgCost;
    if (d.shares  != null) pos.shares  = d.shares;
    if (d.value   != null) pos.value   = d.value;
    if (d.pnl     != null) pos.pnl     = d.pnl;
    if (d.pnlPct  != null) pos.pnlPct  = d.pnlPct;
    updated++;
  }

  // 米国株: ySymbol または symbol でティッカー照合
  for (const d of updates.us) {
    const pos = positions.find(p => p.cur === 'USD' && (p.ySymbol === d.ticker || p.symbol === d.ticker));
    if (!pos) { skipped++; continue; }
    if (d.price   != null) pos.price   = d.price;
    if (d.avgCost != null) pos.avgCost = d.avgCost;
    if (d.shares  != null) pos.shares  = d.shares;
    if (d.value   != null) pos.value   = d.value;
    if (d.pnl     != null) pos.pnl     = d.pnl;
    if (d.pnlPct  != null) pos.pnlPct  = d.pnlPct;
    if (d.dayCh   != null) pos.dayCh   = d.dayCh;
    if (d.dayPct  != null) pos.dayPct  = d.dayPct;
    updated++;
  }

  // 投資信託: symbol（オルカン等）で照合
  for (const d of updates.fund) {
    const pos = positions.find(p => p.symbol === d.symbol);
    if (!pos) { skipped++; continue; }
    if (d.price   != null) pos.price   = d.price;
    if (d.avgCost != null) pos.avgCost = d.avgCost;
    if (d.shares  != null) pos.shares  = d.shares;
    if (d.value   != null) pos.value   = d.value;
    if (d.pnl     != null) pos.pnl     = d.pnl;
    if (d.pnlPct  != null) pos.pnlPct  = d.pnlPct;
    updated++;
  }

  // 履歴キャッシュをリセット（保有数・取得単価が変わり得るため）
  state.historicalCache = { '1y': {}, '5y': {}, '10y': {} };
  state.lastUpdateText = null;  // CSV更新後はライブ取得前なので「最終更新」を無効化

  // ステータス表示更新
  const ts = new Date().toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).replace(/\//g, '/');

  setStatus(`CSVインポート完了（${updated}銘柄更新${skipped > 0 ? '・' + skipped + '件スキップ' : ''}）`, 'green');
  renderStats();
  renderHeatmap();

  // バックグラウンドで履歴データを再取得
  (async () => {
    for (const range of ['1y', '5y', '10y']) {
      await fetchAllHistorical(range);
      renderStats();
      if (state.changePeriod && state.changePeriod !== '1d') renderHeatmap();
    }
  })();
}

/** ファイル選択後に呼ばれるハンドラ */
function handleCsvImport(event) {
  const files = event.target.files;
  event.target.value = ''; // 同じファイルを再選択できるようリセット
  importMonexCsvs(files);
}
