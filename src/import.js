// ══════════════════════════════════════════════════════════════
// import.js  ―  資産取込（マネックス CSV / マネーフォワード スクショ）
//
// 依存: data.js (WORKER_URL, fetchWithTimeout, parseCsvText, normalizeStr,
//               parseNum, detectCsvType, parseJpRow, parseUsRow, parseFundRow),
//       state.js (state, FUND_SYMBOL_PATTERNS),
//       positions.js (positions)
// ══════════════════════════════════════════════════════════════

// ── マネックス CSV → フル Position オブジェクト ─────────────────────────────

// 投資信託の Yahoo Finance proxy マッピング（symbol → { ySymbol, isProxy, proxyName }）
const FUND_PROXY_MAP = {
  'オルカン':    { ySymbol: 'ACWI',  proxyName: 'iShares MSCI ACWI ETF' },
  'ひふみ':      { ySymbol: '2563.T', proxyName: 'iシェアーズ・コアS&P500' },
  'ひふみXO':    { ySymbol: 'SPY',    proxyName: 'SPDR S&P500 ETF' },
  'マイクロSP':  { ySymbol: '^GSPC',  proxyName: 'S&P 500 Index' },
};

function buildJpPosition(row) {
  const symbol  = row[3]?.trim();
  const name    = normalizeStr(row[2]?.trim() || '');
  if (!symbol || !name) return null;
  const avgCost = parseNum(row[8]);
  const shares  = parseNum(row[9]);
  const price   = parseNum(row[7]);
  const value   = parseNum(row[12]);
  const pnl     = parseNum(row[13]);
  const pnlPct  = (avgCost && shares && avgCost > 0)
    ? (pnl ?? 0) / (avgCost * shares) * 100 : null;
  return {
    symbol, name, cat: '日本株・ETF',
    shares: shares ?? 0, price: price ?? 0,
    avgCost: avgCost ?? 0, value: value ?? 0,
    pnl: pnl ?? 0, pnlPct: pnlPct ?? 0,
    dayPct: null, dayCh: null, cur: 'JPY',
    ySymbol: `${symbol}.T`,
  };
}

function buildUsPosition(row) {
  const name   = normalizeStr(row[0]?.trim() || '');
  const ticker = row[1]?.trim();
  if (!ticker || !name) return null;
  const shares  = parseNum(row[4]);
  const avgCost = parseNum(row[7]);    // 平均取得単価[ドル]
  const price   = parseNum(row[10]);   // 現在値単価[ドル]
  const value   = parseNum(row[16]);   // 現在値評価額[円]
  const pnl     = parseNum(row[18]);   // 現在値損益[円]
  // row[17]=外貨建て評価額[円]=常に0 (当日変動ではない) → dayPct はライブ価格取得で更新
  const pnlPct  = (value != null && pnl != null && value - pnl !== 0)
    ? (pnl / (value - pnl)) * 100 : null;
  return {
    symbol: ticker, name, cat: '米国株・ETF',
    shares: shares ?? 0, price: price ?? 0,
    avgCost: avgCost ?? 0, value: value ?? 0,
    pnl: pnl ?? 0, pnlPct: pnlPct ?? 0,
    dayPct: null, dayCh: null, cur: 'USD',
    ySymbol: ticker,
  };
}

function buildFundPosition(row) {
  const rawName = row[2]?.trim();
  if (!rawName) return null;
  const name   = normalizeStr(rawName);
  const symbol = FUND_SYMBOL_PATTERNS.find(([pat]) => name.includes(pat))?.[1] ?? null;
  if (!symbol) return null;
  // row[7]=保有口数[口]、row[5]=基準価額[円/万口]、row[11]=平均取得単価[円/万口]
  // 口÷10000=万口 に変換して price/avgCost の単位(円/万口)と一致させる
  const sharesRaw = parseNum(row[7]);
  const shares  = sharesRaw != null ? Math.round(sharesRaw / 10000 * 10000) / 10000 : null;
  const avgCost = parseNum(row[11]);   // 円/万口
  const price   = parseNum(row[5]);    // 円/万口 (基準価額)
  const value   = parseNum(row[12]);   // 時価評価額[円]
  const pnl     = parseNum(row[13]);   // 時価損益[円]
  const cost    = (value != null && pnl != null) ? value - pnl : null;
  const pnlPct  = (cost != null && cost !== 0) ? pnl / cost * 100 : null;
  const proxy   = FUND_PROXY_MAP[symbol] ?? { ySymbol: '^N225', proxyName: '日経平均' };
  return {
    symbol, name, cat: '投資信託',
    shares: shares ?? 0, price: price ?? 0,
    avgCost: avgCost ?? 0, value: value ?? 0,
    pnl: pnl ?? 0, pnlPct: pnlPct ?? 0,
    dayPct: null, dayCh: null, cur: 'JPY',
    ySymbol: proxy.ySymbol, isProxy: true, proxyName: proxy.proxyName,
  };
}

async function parseManexFiles(files) {
  const results = [];
  for (const file of files) {
    try {
      const buf  = await file.arrayBuffer();
      const text = new TextDecoder('shift-jis').decode(buf);
      const rows = parseCsvText(text);
      if (rows.length < 2) continue;
      const type = detectCsvType(rows[0]);
      if (!type) continue;
      for (let i = 1; i < rows.length; i++) {
        const pos = type === 'jp'   ? buildJpPosition(rows[i])
                  : type === 'us'   ? buildUsPosition(rows[i])
                  : buildFundPosition(rows[i]);
        if (pos) results.push(pos);
      }
    } catch (e) {
      console.error('[import] CSV parse error:', file.name, e);
    }
  }
  return results;
}

// ── マネーフォワード スクショ → Claude Vision ─────────────────────────────

async function parseMoneyForwardImage(file) {
  const buf   = await file.arrayBuffer();
  const uint8 = new Uint8Array(buf);
  // スタックオーバーフロー回避のためチャンク処理
  let binaryStr = '';
  for (let i = 0; i < uint8.length; i += 8192) {
    binaryStr += String.fromCharCode(...uint8.subarray(i, i + 8192));
  }
  const b64  = btoa(binaryStr);
  const mime = file.type || 'image/png';

  const prompt = `このスクリーンショットは資産管理アプリの保有資産一覧です。
画像から保有資産を抽出し、必ず以下のJSON形式のみで回答してください（説明文不要）:
{"assets":[{"symbol":"コードorティッカー","name":"銘柄名","shares":保有数,"avgCost":平均取得単価,"category":"日本株|米国株|投資信託|その他"}]}
取得単価が不明な場合は0、保有数が不明な場合は0にしてください。`;

  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
        { type: 'text', text: prompt },
      ],
    }],
  };

  try {
    const res = await fetchWithTimeout(`${WORKER_URL}/ai/claude`, 30000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    const m    = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('JSON not found in response');
    const parsed = JSON.parse(m[0]);
    return (parsed.assets || []).map(a => _mfAssetToPosition(a)).filter(Boolean);
  } catch (e) {
    console.error('[import] MF image parse error:', e);
    return null;
  }
}

function _mfAssetToPosition(a) {
  if (!a.symbol || !a.name) return null;
  const cat = a.category === '米国株' ? '米国株・ETF'
            : a.category === '投資信託' ? '投資信託'
            : '日本株・ETF';
  const isJP = cat === '日本株・ETF';
  const isFund = cat === '投資信託';
  const sym  = String(a.symbol).trim();
  const proxy = isFund ? (FUND_PROXY_MAP[sym] ?? { ySymbol: '^N225', proxyName: '日経平均' }) : null;
  return {
    symbol: sym, name: String(a.name).trim(), cat,
    shares: Number(a.shares) || 0, price: 0,
    avgCost: Number(a.avgCost) || 0, value: 0,
    pnl: 0, pnlPct: 0, dayPct: null, dayCh: null,
    cur: cat === '米国株・ETF' ? 'USD' : 'JPY',
    ySymbol: isFund ? proxy.ySymbol : (isJP ? `${sym}.T` : sym),
    ...(isFund ? { isProxy: true, proxyName: proxy.proxyName } : {}),
  };
}

// ── KV 保存 / 読込 ────────────────────────────────────────────────────────

async function loadPositionsFromKV() {
  try {
    const res = await fetchWithTimeout(`${WORKER_URL}/positions`, 10000);
    if (!res.ok) return false;
    const kvPositions = await res.json();
    if (!Array.isArray(kvPositions) || kvPositions.length === 0) return false;
    positions.splice(0, positions.length, ...kvPositions);
    console.log(`[import] KVから${kvPositions.length}銘柄を読み込みました`);
    return true;
  } catch (e) {
    console.warn('[import] KV positions 読込失敗:', e);
    return false;
  }
}

async function savePositionsToKV(newPositions) {
  const pinHash = localStorage.getItem('hm-pin-hash')
    || '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
  const res = await fetchWithTimeout(`${WORKER_URL}/positions`, 15000, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Pin-Hash': pinHash },
    body: JSON.stringify(newPositions),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `保存失敗 (HTTP ${res.status})`);
  }
  return (await res.json()).ok === true;
}

// ── 差分計算 ─────────────────────────────────────────────────────────────

function computeImportDiff(current, incoming) {
  const keyOf = p => p.symbol;
  const curMap = new Map(current.map(p => [keyOf(p), p]));
  const newMap = new Map(incoming.map(p => [keyOf(p), p]));

  const added    = incoming.filter(p => !curMap.has(keyOf(p)));
  const removed  = current.filter(p => !newMap.has(keyOf(p)));
  const changed  = incoming.filter(p => {
    const c = curMap.get(keyOf(p));
    return c && (c.shares !== p.shares || c.avgCost !== p.avgCost);
  });
  const unchanged = incoming.filter(p => {
    const c = curMap.get(keyOf(p));
    return c && c.shares === p.shares && c.avgCost === p.avgCost;
  });

  return { added, removed, changed, unchanged };
}

// ── Import Modal UI ───────────────────────────────────────────────────────

let _importState = { source: null, parsed: [], current: [] };

function openImportModal(source) {
  _importState = { source, parsed: [], current: [...positions] };
  const overlay = document.getElementById('import-modal-overlay');
  const title   = document.getElementById('import-modal-title');
  if (!overlay) return;
  title.textContent = source === 'manex' ? 'マネックス証券 取込' : 'マネーフォワード 取込';
  _renderImportStep('select');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function closeImportModal() {
  const overlay = document.getElementById('import-modal-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  setTimeout(() => { overlay.style.display = 'none'; }, 220);
  _importState = { source: null, parsed: [], current: [] };
}

function handleImportOverlayClick(e) {
  if (e.target === document.getElementById('import-modal-overlay')) closeImportModal();
}

function _renderImportStep(step, payload) {
  const body = document.getElementById('import-modal-body');
  if (!body) return;

  if (step === 'select') {
    const isManex = _importState.source === 'manex';
    body.innerHTML = `
      <div class="import-select-area" id="import-drop-zone">
        <div class="import-icon">${isManex ? '📄' : '📷'}</div>
        <div class="import-select-title">${isManex ? 'CSVファイルを選択' : 'スクリーンショットを選択'}</div>
        <div class="import-select-hint">${isManex ? '国内株・米国株・投資信託の3ファイルまとめて選択できます' : 'マネーフォワードの資産一覧画面のスクショ'}</div>
        <button class="import-file-btn" onclick="${isManex ? 'document.getElementById(\'import-manex-input\').click()' : 'document.getElementById(\'import-mf-input\').click()'}">
          ファイルを選択
        </button>
      </div>`;
  }

  if (step === 'loading') {
    body.innerHTML = `
      <div class="import-loading">
        <div class="import-spinner"></div>
        <div class="import-loading-text">${payload || '解析中...'}</div>
      </div>`;
  }

  if (step === 'error') {
    body.innerHTML = `
      <div class="import-error-msg">
        <div>⚠️ ${escapeHTML(payload || '解析に失敗しました')}</div>
        <button class="import-file-btn" style="margin-top:12px" onclick="_renderImportStep('select')">やり直す</button>
      </div>`;
  }

  if (step === 'review') {
    const { added, removed, changed, unchanged } = computeImportDiff(
      _importState.current, _importState.parsed
    );
    let html = `<div class="import-review">`;

    const total = _importState.parsed.length + removed.length;
    html += `<div class="import-review-summary">${_importState.parsed.length}銘柄を検出`;
    if (added.length)    html += ` · <span class="imp-badge new">${added.length}件新規</span>`;
    if (removed.length)  html += ` · <span class="imp-badge del">${removed.length}件削除予定</span>`;
    if (changed.length)  html += ` · <span class="imp-badge chg">${changed.length}件変更</span>`;
    html += `</div>`;

    html += `<div class="import-list">`;

    // 新規
    for (const p of added) {
      html += _importRow(p, 'new', true);
    }
    // 変更
    for (const p of changed) {
      const cur = _importState.current.find(c => c.symbol === p.symbol);
      const hint = cur ? `${cur.shares}→${p.shares}株 / @${cur.avgCost}→@${p.avgCost}` : '';
      html += _importRow(p, 'chg', true, hint);
    }
    // 変更なし
    for (const p of unchanged) {
      html += _importRow(p, 'same', true);
    }
    // 削除予定（現在あるが今回のCSVにない）
    for (const p of removed) {
      html += _importRow(p, 'del', false);
    }

    html += `</div>`;
    html += `<div class="import-footer">
      <button class="import-cancel-btn" onclick="closeImportModal()">キャンセル</button>
      <button class="import-confirm-btn" onclick="_confirmImport()">取込確定 →</button>
    </div>`;
    html += `</div>`;
    body.innerHTML = html;
  }

  if (step === 'saving') {
    body.innerHTML = `
      <div class="import-loading">
        <div class="import-spinner"></div>
        <div class="import-loading-text">保存中...</div>
      </div>`;
  }

  if (step === 'done') {
    body.innerHTML = `
      <div class="import-done">
        <div class="import-done-icon">✓</div>
        <div class="import-done-text">${escapeHTML(payload || '取込が完了しました')}</div>
        <button class="import-confirm-btn" onclick="closeImportModal()">閉じる</button>
      </div>`;
  }
}

function _importRow(p, type, checked, hint) {
  const label = { new: '新規', chg: '変更', same: '', del: '削除予定' }[type];
  const badgeHtml = label
    ? `<span class="imp-badge ${type}">${label}</span>`
    : '';
  const hintHtml = hint
    ? `<span class="imp-row-hint">${escapeHTML(hint)}</span>`
    : '';
  return `<label class="import-row">
    <input type="checkbox" class="import-cb" data-symbol="${escapeHTML(p.symbol)}"
      data-type="${type}" ${checked ? 'checked' : ''}>
    <span class="imp-sym">${escapeHTML(p.symbol)}</span>
    <span class="imp-name">${escapeHTML(p.name)}</span>
    ${hintHtml}
    ${badgeHtml}
    <span class="imp-meta">${p.shares}株 @${p.avgCost}</span>
  </label>`;
}

async function _confirmImport() {
  const body = document.getElementById('import-modal-body');
  const cbs  = body?.querySelectorAll('.import-cb');
  if (!cbs) return;

  // チェックされたシンボルセット
  const selectedSymbols = new Set(
    [...cbs].filter(cb => cb.checked && cb.dataset.type !== 'del').map(cb => cb.dataset.symbol)
  );
  const delSymbols = new Set(
    [...cbs].filter(cb => cb.checked && cb.dataset.type === 'del').map(cb => cb.dataset.symbol)
  );

  // 新ポジション = 今回の取込データのうち選択済み
  const newPositions = _importState.parsed.filter(p => selectedSymbols.has(p.symbol));
  // 現在のポジションのうち「削除予定」として選択されたもの以外、かつ新規でない古い銘柄をマージ
  const oldKept = _importState.current.filter(p =>
    !selectedSymbols.has(p.symbol) && !delSymbols.has(p.symbol)
  );
  const finalPositions = [...newPositions, ...oldKept];

  _renderImportStep('saving');
  try {
    await savePositionsToKV(finalPositions);
    // メモリ上の positions 配列を更新
    positions.splice(0, positions.length, ...finalPositions);
    // キャッシュリセット
    state.historicalCache = { '1y': {}, '5y': {}, '10y': {} };
    if (typeof clearCacheSession === 'function') clearCacheSession();
    state.lastUpdateText = null;

    _renderImportStep('done', `${finalPositions.length}銘柄を保存しました`);

    // バックグラウンドで再描画・価格取得
    setTimeout(() => {
      if (typeof renderStats === 'function') renderStats();
      if (typeof renderHeatmap === 'function') renderHeatmap();
      if (typeof refreshPrices === 'function') refreshPrices();
    }, 300);
  } catch (e) {
    _renderImportStep('error', `保存に失敗しました: ${e.message}`);
  }
}

// ── ファイル選択ハンドラ ──────────────────────────────────────────────────

async function handleManexFileSelect(event) {
  const files = event.target.files;
  event.target.value = '';
  if (!files || files.length === 0) return;
  _renderImportStep('loading', 'CSVを解析中...');
  const parsed = await parseManexFiles(files);
  if (!parsed || parsed.length === 0) {
    _renderImportStep('error', 'CSVを解析できませんでした。マネックス証券のCSVファイルを選択してください。');
    return;
  }
  _importState.parsed = parsed;
  _renderImportStep('review');
}

async function handleMoneyForwardImageSelect(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  _renderImportStep('loading', 'AIで資産情報を読み取り中...');
  try {
    const parsed = await parseMoneyForwardImage(file);
    if (!parsed || parsed.length === 0) {
      _renderImportStep('error', '画像から資産情報を読み取れませんでした。資産一覧が写ったスクリーンショットをお試しください。');
      return;
    }
    _importState.parsed = parsed;
    _renderImportStep('review');
  } catch (e) {
    console.error('[import] MF image handler error:', e);
    _renderImportStep('error', `読み取りエラー: ${e.message}`);
  }
}

// ── HTML エスケープ ───────────────────────────────────────────────────────
function escapeHTML(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
