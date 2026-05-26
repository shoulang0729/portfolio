// ══════════════════════════════════════════════════════════════
// app.js  ―  ES Module エントリーポイント
//
// 全モジュールのインポート・初期化・data-action ディスパッチャを担当。
// ══════════════════════════════════════════════════════════════

// ── ES Module imports ──
import { positions, PERIODS, PERIOD_MAP, PERIOD_COLS, PERIOD_IDS } from './positions.js';
import { state, C, CHART_RANGES, SL_DETAIL_COLS } from './state.js';
import { FUND_DEFS, fundSymbolFromName, fundProxyOf, canonicalizeFundPosition } from './funds.js';
import { normalizeStr, parseCsvText, parseNum, detectCsvType, parseJpRow, parseUsRow, parseFundRow } from './csv.js';
import { AUTH_PIN_HASH, AUTH_SESSION_KEY, AUTH_LS_HASH_KEY, AUTH_LOCKOUT_KEY, AUTH_PIN_LEN, AUTH_MAX_FAIL, AUTH_LOCK_SEC, _auth, _getActivePinHash, _hashPin, _isLocked, _lockRemain, _saveLockout, isAuthenticated } from './auth-pin.js';
import { _deriveEncKey, _restoreEncKey, _AUTH_ENC_SS, aiEncrypt, aiDecrypt } from './auth-crypto.js';
import { authenticatePasskey, registerPasskey, setPasskeySuccessCallback } from './auth-passkey.js';
import { authKeyPress, authBackspace, pcKeyPress, pcBackspace, openPinChange, closePinChange, _showChangePinButton } from './auth-ui.js';
import { fmtJPY, fmtJPYFull, fmtPct, fmtPrice, sgn, fmtJPYInt, fmtPctInt, fmtShares, cssVar, getColor, getCellTextColor, getHistoricalChangePct, getDisplayPct, calcPortfolioPeriodPct, makeTh, makePctCell, _tableSort, makePeriodCells, makePeriodHeaderCells } from './utils.js';
import { WORKER_URL, fetchWithTimeout, sleep, fetchViaProxy, fetchFinnhubQuote, fetchFinnhubCandles, loadCacheFromSession, saveCacheToSession, clearCacheSession, fetchAllHistorical, fetchSymbolHistory, fetchLivePrice, refreshPrices, flashPriceChanges, setStatus, applyPricesCache } from './data.js';
import { renderHeatmap, positionTooltip } from './heatmap.js';
import { openChart, loadChart, setRange, closeModal, handleOverlayClick } from './chart.js';
import { renderStockList, slSort, slToggleDetail, applyStockBars, updateSlColStyle } from './stock-list.js';
import { renderWatchlist, wlSort, onWatchlistSearch, addToWatchlist, removeFromWatchlist, wlSelectItem, fetchWatchlistData, saveWatchlist, _loadWatchlistFromWorker } from './watchlist.js';
import { loadPositionsFromKV, savePositionsToKV, mergeDuplicatePositions, computeImportDiff } from './positions-store.js';
import { parseManexFiles, parseMoneyForwardImage } from './import-parse.js';
import { openImportModal, closeImportModal, openManagePositionsModal, handleImportOverlayClick, handleManexFileSelect, handleMoneyForwardImageSelect } from './import-ui.js';

// ── 循環依存解消: data.js が発火するイベントを app.js でリッスン ──
document.addEventListener('hm:prices-updated', () => {
  renderStats();
  renderHeatmap();
});

// ── PIN キーパッドの onclick は例外的に window に登録（auth-ui.js 設計上の既知例外）──
window.authKeyPress        = authKeyPress;
window.authBackspace       = authBackspace;
window.pcKeyPress          = pcKeyPress;
window.pcBackspace         = pcBackspace;
window.authenticatePasskey = authenticatePasskey;
window.closePinChange      = closePinChange;

// ── フォールバックスクリプトから参照できるように renderHeatmap を window に登録 ──
window.renderHeatmap       = renderHeatmap;

// ── auth-passkey の成功コールバックを接続 ──
setPasskeySuccessCallback(_showChangePinButton);

// ══════════════════════════════════════════════
// STATS BAR
// ══════════════════════════════════════════════
function toggleStats() {
  state.statsVisible = !state.statsVisible;
  document.getElementById('stats').style.display = state.statsVisible ? '' : 'none';
  const eye = document.getElementById('stats-eye');
  eye.classList.toggle('hidden', !state.statsVisible);
  document.getElementById('eye-slash').style.display = state.statsVisible ? 'none' : '';
  // stats-outer の高さ変化に合わせてリスト高さを再計算
  requestAnimationFrame(updateListHeight);
}

function renderStats() {
  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const totalPnl   = positions.reduce((s, p) => s + p.pnl,   0);
  const totalCost  = totalValue - totalPnl;
  const pnlPct     = totalCost > 0 ? totalPnl / totalCost * 100 : 0;

  // 資産総額セル
  let html = `<div class="stat">
    <span class="stat-label">資産総額</span>
    <span class="stat-value neu">${fmtJPYInt(totalValue)}</span>
  </div>`;

  // 含み損益セル
  html += `<div class="stat">
    <span class="stat-label">含み損益</span>
    <span class="stat-value ${sgn(totalPnl)}">${fmtJPYInt(totalPnl)}</span>
    <span class="stat-sub ${sgn(pnlPct)}">${fmtPctInt(pnlPct)}</span>
  </div>`;

  // 期間別パフォーマンス（現在の保有ポジションで加重平均シミュレーション）
  for (const p of PERIODS) {
    const pct = calcPortfolioPeriodPct(p.id);
    const amt = pct !== null ? totalValue * pct / 100 : null;
    const cls = pct !== null ? sgn(pct) : 'neu';
    html += `<div class="stat">
      <span class="stat-label">${p.statsLabel}</span>
      <span class="stat-value ${cls}">${amt !== null ? fmtJPYInt(amt) : '―'}</span>
      <span class="stat-sub ${cls}">${pct !== null ? fmtPctInt(pct) : '―'}</span>
    </div>`;
  }

  document.getElementById('stats').innerHTML = html;
}

// ══════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════
/**
 * themeMode ('auto'|'light'|'dark') を data-theme 属性に適用する。
 * auto の場合は matchMedia でシステム設定を解決し、
 * data-theme="dark" or "light" を明示セット（CSS @media 重複ブロック不要）。
 */
function applyTheme() {
  let resolved = state.themeMode;
  if (resolved === 'auto') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = resolved;
  const icons = { light: '☼', dark: '☾', auto: 'A' };
  const iconEl = document.getElementById('theme-icon');
  if (iconEl) iconEl.textContent = icons[state.themeMode] ?? 'A';
  const el = document.getElementById('theme-btn');
  el && (el.title = { light: 'ライトモード', dark: 'ダークモード', auto: 'システムに合わせる' }[state.themeMode]);
}


function toggleHmMenu() {
  const dropdown = document.getElementById('hm-menu-dropdown');
  const btn = document.getElementById('hm-menu-btn');
  if (!dropdown) return;
  const isOpen = dropdown.classList.toggle('open');
  if (btn) { btn.classList.toggle('open', isOpen); btn.setAttribute('aria-expanded', String(isOpen)); }
}

function closeHmMenu() {
  const dropdown = document.getElementById('hm-menu-dropdown');
  const btn = document.getElementById('hm-menu-btn');
  if (!dropdown) return;
  dropdown.classList.remove('open');
  if (btn) { btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
}

function cycleTheme() {
  const order = ['auto', 'light', 'dark'];
  state.themeMode = order[(order.indexOf(state.themeMode) + 1) % order.length];
  localStorage.setItem('hm-theme', state.themeMode);
  applyTheme();
  renderHeatmap();
  // チャートモーダルが開いている場合は再描画
  const overlay = document.getElementById('modal-overlay');
  if (overlay && overlay.style.display !== 'none' && state.currentPos?.ySymbol) {
    loadChart(state.currentPos.ySymbol, state.currentRange);
  }
}

// ══════════════════════════════════════════════
// PORTFOLIO SNAPSHOT
//   フロントの state を使ってフルスナップショット（履歴付き）を組み立て、
//   Worker /portfolio/snapshot に POST して GitHub に保存させる。
//   失敗時は Worker 側で自前再生成にフォールバック（payload なし指定）。
// ══════════════════════════════════════════════
async function triggerPortfolioSnapshot() {
  if (!confirm('現在のポートフォリオを GitHub にスナップショット保存します。\n（data/portfolio-snapshot.json が更新されます）')) return;
  try {
    setStatus('スナップショット作成中...', 'yellow');
    const payload = _buildPortfolioSnapshotPayload();
    const res = await fetch(`${WORKER_URL}/portfolio/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    setStatus(`スナップショット保存完了（${data.positions} 銘柄）`, 'green');
    alert(`保存完了:\nhttps://github.com/shoulang0729/portfolio/blob/main/data/portfolio-snapshot.json\n\n反映まで raw.githubusercontent.com 側で最大5分のキャッシュラグあり。`);
  } catch (e) {
    setStatus(`スナップショット保存失敗: ${e.message}`, 'red');
    alert(`スナップショット保存失敗:\n${e.message}`);
  }
}

function _buildPortfolioSnapshotPayload() {
  const perfOf = (ySymbol) => {
    const perf = {};
    for (const period of PERIODS) {
      // 1d は当日騰落率（live price）、他は historical cache から計算
      if (period.id === '1d') {
        const pos = positions.find(p => p.ySymbol === ySymbol);
        perf['1d'] = pos?.dayPct ?? null;
      } else {
        perf[period.id] = getHistoricalChangePct(ySymbol, period.id);
      }
    }
    return perf;
  };

  const positionsWithPerf = positions.map(p => ({
    ...p,
    performance: perfOf(p.ySymbol),
  }));

  const totalValue = positions.reduce((s, p) => s + (p.value || 0), 0);
  const totalPnl   = positions.reduce((s, p) => s + (p.pnl || 0), 0);

  const portPerf = {};
  for (const period of PERIODS) {
    portPerf[period.id] = calcPortfolioPeriodPct(period.id);
  }

  // ウォッチリスト：保有していない注目銘柄。期間パフォーマンスのみ出力
  const watchlistWithPerf = (state.watchlist || []).map(item => {
    const ySymbol = item.ySymbol || item.symbol;
    const perf = {};
    for (const period of PERIODS) {
      if (period.id === '1d') {
        perf['1d'] = state.watchlistPrices?.[item.symbol]?.dayPct ?? null;
      } else {
        perf[period.id] = getHistoricalChangePct(ySymbol, period.id);
      }
    }
    return {
      symbol: item.symbol,
      name:   item.name || item.symbol,
      ySymbol,
      cat:    item.cat || null,
      cur:    item.cur || null,
      performance: perf,
    };
  });

  // historicals（日次価格系列）は重い（5MB超）ので保存しない。
  // 必要な情報は positions[].performance / watchlist[].performance に集約されている。
  return {
    asOf: new Date().toISOString(),
    source: 'frontend-manual',
    summary: {
      totalValue,
      totalPnl,
      totalPnlPct: totalValue > totalPnl ? totalPnl / (totalValue - totalPnl) * 100 : null,
      positionCount: positions.length,
      watchlistCount: watchlistWithPerf.length,
      currencyBase: 'JPY',
      performance: portPerf,
    },
    positions: positionsWithPerf,
    watchlist: watchlistWithPerf,
  };
}

// ══════════════════════════════════════════════
// MODE TOGGLE
// ══════════════════════════════════════════════
function setColorModePnl() {
  if (state.colorMode === 'pnl') {
    // 2回目クリック → 騰落率スイッチに戻る
    setChangePeriod(state.lastChangePeriod || '1d');
    return;
  }
  state.colorMode = 'pnl';
  state.changePeriod = '';
  document.querySelectorAll('.period-btn[data-period]').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-pnl').classList.add('active');
  renderHeatmap();
}

async function setChangePeriod(periodId) {
  if (!periodId) return;
  state.lastChangePeriod = periodId;  // toggle-back 用に記憶
  state.changePeriod = periodId;
  state.colorMode = 'change';
  document.getElementById('btn-pnl').classList.remove('active');
  document.querySelectorAll('.period-btn[data-period]').forEach(b =>
    b.classList.toggle('active', b.dataset.period === periodId));
  renderHeatmap();
  const cfg = PERIOD_MAP[periodId];
  if (cfg && periodId !== '1d') {
    await fetchAllHistorical(cfg.range);
    renderHeatmap();
    renderStats();
  }
}

// ══════════════════════════════════════════════
// REFRESH FREQUENCY
// ══════════════════════════════════════════════
function fmtCountdown(sec) {
  if (sec >= 3600) { const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60); return `次回更新: ${h}時間${m>0?m+'分':''}後`; }
  if (sec >= 60)   { const m = Math.floor(sec/60), s = sec%60; return `次回更新: ${m}分${s>0?s+'秒':''}後`; }
  return `次回更新: ${sec}秒`;
}

async function handleRefreshSelect(val) {
  clearInterval(state.autoInterval);
  clearInterval(state.countdownTimer);
  state.autoInterval = null;
  state.autoSec = 0;
  const cd = document.getElementById('countdown');
  cd.textContent = '';

  document.querySelectorAll('.hm-refresh-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.val === val));

  if (val === '0') return;

  state.autoSec = parseInt(val);
  state.countdownVal = state.autoSec;
  cd.textContent = fmtCountdown(state.countdownVal);

  state.countdownTimer = setInterval(() => {
    if (document.visibilityState === 'hidden') return;
    state.countdownVal--;
    cd.textContent = fmtCountdown(state.countdownVal);
    if (state.countdownVal <= 0) {
      state.countdownVal = state.autoSec;
      refreshPrices();
    }
  }, 1000);
}

document.addEventListener('click', (e) => {
  const wrap = document.getElementById('hm-menu-wrap');
  if (wrap && !wrap.contains(e.target)) closeHmMenu();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.autoSec > 0) state.countdownVal = state.autoSec;
});

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════

// スクロール時にヘッダーに影を付ける
window.addEventListener('scroll', () => {
  const st = document.querySelector('.sticky-top');
  if (st) st.classList.toggle('stuck', window.scrollY > 2);
}, { passive: true });

/**
 * ヘッダー右列コンポーネントを組み立てる
 *
 * ヘッダー（sticky固定）
 *   左列: "Heatmap" タイトル
 *   右列: .mobile-refresh
 *     上段 (.mobile-refresh-top): [更新頻度スイッチ] [☼テーマ] [CSV]
 *     下段 (.mobile-status-row):  [次回更新カウントダウン] [• ステータス]
 *
 * 既存 DOM 要素（refresh-switch, countdown, theme-btn, csv-btn, status-line）を
 * JS で移動し、空になった controls / refresh-ctrl-group は CSS で非表示にする。
 */
function _setupMobileLayout() {
  const stickyTop = document.querySelector('.sticky-top');
  if (!stickyTop) return;
  const parent       = stickyTop.parentNode; // = document.body
  const panelHeatmap = document.getElementById('panel-heatmap');
  const panelList    = document.getElementById('panel-list');
  const heatmapWrap  = document.getElementById('heatmap-wrap');
  const header       = stickyTop.querySelector('.header');

  // ── 2. ヘッダー右列を構成（上段：スイッチ＋テーマ ／ 下段：カウントダウン＋ステータス） ──
  const refreshCtrlGroup = document.getElementById('refresh-switch')
    ? document.getElementById('refresh-switch').closest('.ctrl-group') : null;
  const refreshSwitch = document.getElementById('refresh-switch');
  const countdown     = document.getElementById('countdown');
  const hmMenuWrap    = document.getElementById('hm-menu-wrap');
  const statusLine    = document.getElementById('status-line');

  const mobileRefresh = document.createElement('div');
  mobileRefresh.className = 'mobile-refresh';

  // 上段：更新頻度スイッチ + ハンバーガーメニュー + CSVボタン
  const refreshTop = document.createElement('div');
  refreshTop.className = 'mobile-refresh-top';
  if (refreshSwitch) refreshTop.appendChild(refreshSwitch);
  if (hmMenuWrap)    refreshTop.appendChild(hmMenuWrap);
  const csvInput = document.getElementById('csv-import-input');
  const csvBtn   = document.querySelector('.csv-btn');
  if (csvInput) refreshTop.appendChild(csvInput);
  if (csvBtn)   refreshTop.appendChild(csvBtn);
  mobileRefresh.appendChild(refreshTop);

  // 下段：次回更新カウントダウン + ステータス（右寄せ）
  const statusRow = document.createElement('div');
  statusRow.className = 'mobile-status-row';
  if (countdown)  statusRow.appendChild(countdown);
  if (statusLine) statusRow.appendChild(statusLine);
  mobileRefresh.appendChild(statusRow);

  if (header) header.appendChild(mobileRefresh);

  // 空になった更新頻度 ctrl-group・divider を非表示（footerはパネル内に残す）
  if (refreshCtrlGroup) refreshCtrlGroup.style.display = 'none';
  stickyTop.querySelectorAll('.controls .divider').forEach(d => (d.style.display = 'none'));

  // ── 3. stats-outer は sticky-top 内に残す（タブと一緒に固定ヘッダーに含める） ──

  // ── 4. controls（更新頻度・テーマ・CSV）は既にmobileRefreshへ移動済み ──
  //    空になったcontrolsはsticky-top内に残す（非表示のため高さ0）

  // ── 5. 凡例バーはpanel-heatmap内footerに残す（タブ連動のため移動しない） ──
}

// ── data-action ディスパッチャ用アクションマップ ──
const ACTION_MAP = {
  // app.js
  toggleStats, cycleTheme, toggleHmMenu, closeHmMenu,
  setChangePeriod, setColorModePnl, handleRefreshSelect,
  switchTab, triggerPortfolioSnapshot,
  // auth-ui.js
  openPinChange, closePinChange,
  // auth-passkey.js
  registerPasskey, authenticatePasskey,
  // chart.js
  setRange, closeModal, handleOverlayClick,
  // stock-list.js
  slSort, slToggleDetail,
  // watchlist.js
  wlSort, onWatchlistSearch, removeFromWatchlist, wlSelectItem,
  // import-ui.js
  openImportModal, closeImportModal, openManagePositionsModal,
  handleImportOverlayClick, handleManexFileSelect, handleMoneyForwardImageSelect,
};

/**
 * data-action 属性で宣言されたハンドラの委譲ディスパッチャ。
 *
 * HTML側: <button data-action="fnName" data-arg="value">         → fnName(value, event)
 *         <button data-action="fnA|fnB">                          → fnA(event); fnB(event)
 *         <input  data-event="input" data-action="onSearch">      → onSearch(event.target.value, event)
 *         <div    data-action="handleOverlayClick">               → handleOverlayClick(event, event)
 */
function _dispatchAction(el, event) {
  const actions = (el.dataset.action || '').split('|').filter(Boolean);
  // data-arg があれば最優先、なければ event をそのまま渡す
  // input value が必要な関数は event.target.value を内部で読む。
  const arg = (el.dataset.arg !== undefined) ? el.dataset.arg : event;
  for (const name of actions) {
    const fn = ACTION_MAP[name];
    if (typeof fn !== 'function') {
      console.warn(`[dispatch] unknown action: ${name}`);
      continue;
    }
    try { fn(arg, event); }
    catch (e) { console.error(`[dispatch] ${name} threw:`, e); }
  }
}

function _bindActionDispatcher() {
  const findAndDispatch = (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const wantType = el.dataset.event || 'click';
    if (wantType !== e.type) return;
    _dispatchAction(el, e);
  };
  ['click', 'input', 'change'].forEach(t =>
    document.addEventListener(t, findAndDispatch));
}

/**
 * アプリ初期化
 * テーマ適用 → 初期描画 → バックグラウンドで履歴データを段階的に取得する
 */
function init() {
  _bindActionDispatcher();
  _setupMobileLayout();
  applyTheme();
  document.getElementById('btn-pnl').classList.remove('active');
  document.querySelectorAll('.period-btn[data-period]').forEach(b =>
    b.classList.toggle('active', b.dataset.period === '1d'));

  // 初期タブ状態を適用（ヒートマップのみ表示、他は非表示）
  const panelList      = document.getElementById('panel-list');
  const panelWatchlist = document.getElementById('panel-watchlist');
  const panelAi        = document.getElementById('panel-ai');
  if (panelList)      panelList.hidden      = true;
  if (panelWatchlist) panelWatchlist.hidden = true;
  if (panelAi)        panelAi.hidden        = true;

  renderStats();

  // stats の初期表示状態を DOM に反映（state.statsVisible = false → 非表示）
  document.getElementById('stats').style.display = state.statsVisible ? '' : 'none';
  const _eye = document.getElementById('stats-eye');
  if (_eye) _eye.classList.toggle('hidden', !state.statsVisible);
  const _eyeSlash = document.getElementById('eye-slash');
  if (_eyeSlash) _eyeSlash.style.display = state.statsVisible ? 'none' : '';

  // 銘柄リスト詳細列の初期表示状態を DOM に反映（state.slDetailVisible = false → 非表示）
  updateSlColStyle();
  const _slEye = document.getElementById('sl-eye-btn');
  if (_slEye) _slEye.classList.toggle('hidden', !state.slDetailVisible);
  const _slSlash = document.getElementById('sl-eye-slash');
  if (_slSlash) _slSlash.style.display = state.slDetailVisible ? 'none' : '';

  renderHeatmap();
  setStatus('起動中...', 'yellow');

  // リスト高さを初期設定（DOM確定後）
  requestAnimationFrame(updateListHeight);

  // 前回開いていたタブを復元（heatmap以外なら switchTab で切替）
  // AI タブは無効化中のため復元対象外
  try {
    const lastTab = localStorage.getItem('hm-active-tab');
    if (lastTab && lastTab !== 'heatmap' && ['list','watchlist'].includes(lastTab)) {
      requestAnimationFrame(() => switchTab(lastTab));
    } else if (lastTab === 'ai') {
      localStorage.removeItem('hm-active-tab'); // 古い保存値をクリア
    }
  } catch {}

  // 起動時に KV から保有銘柄を読み込んでから価格取得
  (async () => {
    // 1. KV から保有銘柄を取得（あれば positions.js の内容を上書き）
    const loaded = await loadPositionsFromKV();
    if (loaded) { renderStats(); renderHeatmap(); }
    // 2. Cron キャッシュ価格を即時反映（ライブ取得前の暫定表示）
    applyPricesCache(); // fire-and-forget
    // 3. ライブ価格取得
    await refreshPrices();
    _hideHeatmapSkeleton();
    // recordTodayAsset は history.js（未統合）のため呼ばない
    for (const range of ['1y', '5y', '10y']) {
      await fetchAllHistorical(range);
      renderStats();
      // 各レンジ完了ごとに銘柄リスト・ウォッチリストを再描画して "…" を実値に置換
      renderStockList();
      if (state.activeTab === 'watchlist') renderWatchlist();
      if (state.changePeriod && state.changePeriod !== '1d') renderHeatmap();
    }
  })();
}

/**
 * 初回データ取得完了後にスケルトンを非表示にし SVG を表示する（初回のみ）。
 */
function _hideHeatmapSkeleton() {
  const sk = document.getElementById('heatmap-skeleton');
  const sv = document.getElementById('heatmap');
  if (sk) { sk.style.transition = 'opacity 0.3s ease'; sk.style.opacity = '0'; setTimeout(() => sk.remove(), 320); }
  if (sv) sv.style.display = '';
}

// ── 銘柄リストの高さをビューポートに合わせて動的設定 ──
// sticky-top（stats-outer・tab-bar含む全固定ヘッダー）+ sl-controls を除いた残りの高さを設定
function updateListHeight() {
  const wrap    = document.getElementById('stock-list-wrap');
  if (!wrap) return;
  const sticky  = document.querySelector('.sticky-top');
  const slCtrl  = document.querySelector('.sl-controls');
  const stickyH = sticky ? sticky.offsetHeight : 0;
  const ctrlH   = slCtrl ? slCtrl.offsetHeight : 0;
  // body の padding-bottom 分だけ余白を確保（モバイル10px・PC20px）
  // + 4px の余裕を持たせてページが一切スクロールしないようにする
  const padBot = parseFloat(getComputedStyle(document.body).paddingBottom) || 16;
  const h = Math.max(160, window.innerHeight - stickyH - ctrlH - padBot - 4);
  wrap.style.maxHeight = h + 'px';
}

// ── タブ切替 ──
function switchTab(name) {
  // 'heatmap' | 'list' | 'watchlist' | 'ai'
  if (state.activeTab === name) return;
  state.activeTab = name;
  try { localStorage.setItem('hm-active-tab', name); } catch {}

  const panelHeatmap   = document.getElementById('panel-heatmap');
  const panelList      = document.getElementById('panel-list');
  const panelWatchlist = document.getElementById('panel-watchlist');
  const panelAi        = document.getElementById('panel-ai');
  if (panelHeatmap)   panelHeatmap.hidden   = (name !== 'heatmap');
  if (panelList)      panelList.hidden      = (name !== 'list');
  if (panelWatchlist) panelWatchlist.hidden = (name !== 'watchlist');
  if (panelAi)        panelAi.hidden        = (name !== 'ai');

  // タブボタンの active 状態を更新
  document.querySelectorAll('.tab-btn[data-tab]').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === name));

  // ヒートマップタブに切り替えたとき W=0 で描画されている場合があるので再描画
  if (name === 'heatmap') renderHeatmap();

  // 銘柄リストに切り替えたとき高さを再計算（double RAF でレイアウト確定後に測定）
  if (name === 'list') {
    renderStockList();
    requestAnimationFrame(() => requestAnimationFrame(updateListHeight));
  }

  // ウォッチリストに切り替えたとき KV から同期後に描画
  if (name === 'watchlist') {
    _loadWatchlistFromWorker().then(() => { renderWatchlist(); fetchWatchlistData(); });
  }

  // AI 相談タブは現在無効化中（renderAiTab を呼ばない）
}

if (typeof d3 === 'undefined') {
  document.getElementById('d3-load-error').style.display = 'flex';
} else {
  window.addEventListener('resize', () => {
    renderHeatmap(); renderStockList(); applyStockBars(); updateListHeight();
  });

  // システムのカラースキーム変化を監視（auto モード時のみ再描画）
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.themeMode !== 'auto') return;
    applyTheme();
    renderHeatmap();
    const overlay = document.getElementById('modal-overlay');
    if (overlay && overlay.style.display !== 'none' && state.currentPos?.ySymbol) {
      loadChart(state.currentPos.ySymbol, state.currentRange);
    }
  });

  init();

  // sticky-top の高さ変化を監視し、リスト高さを自動再計算（stats 折りたたみ等に対応）
  if (typeof ResizeObserver !== 'undefined') {
    const _stickyEl = document.querySelector('.sticky-top');
    if (_stickyEl) {
      new ResizeObserver(() => {
        if (state.activeTab === 'list') updateListHeight();
      }).observe(_stickyEl);
    }
  }
}

// ── Pull-to-refresh（上端で引っ張るとリロード） ──
// iOS Safari PWA モード対応：touchstart 時点で「上端にいるか」を判定し、
// 上端にいなければそのターゲットを一切追跡しない。
(function() {
  if (!('ontouchstart' in window)) return; // デスクトップではスキップ

  const THRESHOLD = 72;
  let startY  = 0;
  let pulling = false;
  let indicator = null;
  let arrow    = null;

  const atTop = () =>
    (window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0) <= 0;

  function getIndicator() {
    if (indicator) return indicator;
    indicator = document.createElement('div');
    indicator.id = 'ptr-indicator';
    indicator.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
      'display:flex', 'align-items:center', 'justify-content:center',
      'height:0', 'overflow:hidden', 'transition:none',
      'background:var(--surface)', 'pointer-events:none',
    ].join(';');

    // 円形リフレッシュアイコン（SVG）
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.style.cssText = 'transition:transform 0.05s linear;color:var(--text2);will-change:transform;';
    svg.innerHTML = `
      <path d="M12 4V1L8 5l4 4V6a6 6 0 1 1-5.66 7.99L4.68 13A8 8 0 1 0 12 4z"
            fill="currentColor"/>`;
    arrow = svg;
    indicator.appendChild(svg);

    // スピンアニメーション用 keyframes（1回だけ注入）
    if (!document.getElementById('ptr-style')) {
      const st = document.createElement('style');
      st.id = 'ptr-style';
      st.textContent = '@keyframes ptr-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
    }

    document.body.prepend(indicator);
    return indicator;
  }

  function collapseIndicator() {
    if (!indicator) return;
    indicator.style.transition = 'height 0.2s ease';
    indicator.style.height = '0';
    if (arrow) {
      arrow.style.transition = 'none';
      arrow.style.animation  = 'none';
      arrow.style.transform  = 'rotate(0deg)';
    }
  }

  document.addEventListener('touchstart', e => {
    pulling = atTop();
    startY  = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!pulling) return;
    const delta = e.touches[0].clientY - startY;
    if (delta <= 0) return;
    const ind = getIndicator();
    ind.style.transition = 'none';
    ind.style.height = Math.min(delta * 0.55, 56) + 'px';
    // 引っ張り量に比例してアイコンを回転（0 → 270deg）
    const progress = Math.min(delta / THRESHOLD, 1);
    if (arrow) {
      arrow.style.transition = 'none';
      arrow.style.animation  = 'none';
      arrow.style.transform  = `rotate(${Math.round(progress * 270)}deg)`;
      arrow.style.opacity    = 0.4 + progress * 0.6;
    }
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!pulling) return;
    const delta = e.changedTouches[0].clientY - startY;
    pulling = false;
    if (delta >= THRESHOLD) {
      // 閾値超え：スピンさせてからリロード
      if (arrow) {
        arrow.style.transition = 'none';
        arrow.style.animation  = 'ptr-spin 0.4s linear';
        arrow.style.opacity    = '1';
      }
      setTimeout(() => location.reload(), 400);
    } else {
      collapseIndicator();
    }
  }, { passive: true });

  document.addEventListener('touchcancel', () => {
    pulling = false;
    collapseIndicator();
  }, { passive: true });
}());

// ── デバッグ：読み込んだファイルのバージョンをタイトル横に表示 ──
(function() {
  const s = document.querySelector('script[src*="app.js"]') || document.querySelector('script[type="module"][src*="app.js"]');
  const ver = s ? (s.src.match(/[?&]v=([^&]+)/) || [,'?'])[1] : '?';
  const title = document.querySelector('.title');
  if (title) {
    const badge = document.createElement('span');
    badge.id = 'debug-ver';
    badge.style.cssText = 'display:block;font-size:9px;font-weight:400;color:var(--text2);opacity:0.6;margin-top:1px;line-height:1.2;';
    badge.textContent = 'v.' + ver;
    title.appendChild(badge);
  }
  // コンソールにも出力
  const css = document.querySelector('link[href*="portfolio.css"]');
  console.log('[Heatmap] app.js:', s ? s.src : 'unknown');
  console.log('[Heatmap] portfolio.css:', css ? css.href : 'unknown');
}());
