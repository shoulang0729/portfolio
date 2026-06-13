// ══════════════════════════════════════════════════════════════
// app.js  ―  ES Module エントリーポイント
//
// 全モジュールのインポート・初期化・data-action ディスパッチャを担当。
// ══════════════════════════════════════════════════════════════

// ── ES Module imports ──
import { positions, PERIODS, PERIOD_MAP } from './positions.js';
import { state } from './state.js';
import { authenticatePasskey, registerPasskey, setPasskeySuccessCallback } from './auth-passkey.js';
import { authKeyPress, authBackspace, pcKeyPress, pcBackspace, openPinChange, closePinChange, _showChangePinButton } from './auth-ui.js';
import { getHistoricalChangePct, calcPortfolioPeriodPct } from './utils.js';
import { fetchAllHistorical, refreshPrices, applyPricesCache, migrateFromSessionStorage, restoreFromIDB } from './data.js';
import { setStatus } from './ui-status.js';
import { WORKER_URL } from './config.js';
import { renderHeatmap } from './heatmap.js';
import { loadChart, setRange, closeModal, handleOverlayClick } from './chart.js';
import { switchTab } from './tabs.js';
import { reloadBriefing } from './briefing.js';
import { setupEventListeners } from './init.js';
import { renderStockList, slSort, slToggleDetail, updateSlColStyle } from './stock-list.js';
import { renderWatchlist, wlSort, onWatchlistSearch, removeFromWatchlist, wlSelectItem } from './watchlist.js';
import { loadPositionsFromKV } from './positions-store.js';
import { openImportModal, closeImportModal, openManagePositionsModal, handleImportOverlayClick, handleManexFileSelect, handleMoneyForwardImageSelect, focusImportFileInput, _renderImportStep, _confirmImport, _retryWithPin } from './import-ui.js';
import { showConfirm, showAlert } from './modal.js';
import { renderStats, refreshHistoricalAndRender, setupPriceUpdateListener, hideHeatmapSkeleton, updateActiveTableHeight, updateWatchlistHeight } from './render.js';
import { toggleHmMenu, closeHmMenu } from './menu.js';
import { loadTopHoldings } from './data-topholdings.js';
import { loadStockProfiles } from './data-stock-profile.js';
import { restoreConstituentsFromIDB } from './constituents-cache.js';
import { renderRiskCharts } from './risk-charts.js';

// ── フォールバックスクリプトから参照できるように renderHeatmap を window に登録 ──
window.renderHeatmap       = renderHeatmap;

// ── ステータスバー クリック更新 ──
async function refreshNow() {
  try {
    await refreshPrices();
  } catch (e) {
    console.warn('[refreshNow]', e);
    setStatus('ライブ価格取得エラー（前回データで表示中）', 'yellow');
  }
}
window.refreshNow = refreshNow;

// ── auth-passkey の成功コールバックを接続 ──
setPasskeySuccessCallback(_showChangePinButton);

// ══════════════════════════════════════════════
// STATS BAR
// ══════════════════════════════════════════════
function toggleStats() {
  state.statsVisible = !state.statsVisible;
  const stats = document.getElementById('stats');
  if (stats) stats.style.display = state.statsVisible ? '' : 'none';
  const eye = document.getElementById('stats-eye');
  if (eye) eye.classList.toggle('hidden', !state.statsVisible);
  const eyeSlash = document.getElementById('eye-slash');
  if (eyeSlash) eyeSlash.style.display = state.statsVisible ? 'none' : '';

  // stats-outer の高さ変化に合わせて表示中テーブルの高さを再計算
  requestAnimationFrame(updateActiveTableHeight);
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
  const confirmed = await showConfirm({
    title: 'スナップショット保存',
    message: '現在のポートフォリオを GitHub にスナップショット保存します。\n（data/portfolio-snapshot.json が更新されます）',
    okLabel: '保存',
    cancelLabel: 'キャンセル',
  });
  if (!confirmed) return;
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
    await showAlert({
      title: '保存完了',
      message: `https://github.com/shoulang0729/portfolio/blob/main/data/portfolio-snapshot.json\n\n反映まで raw.githubusercontent.com 側で最大5分のキャッシュラグあり。`,
      okLabel: 'OK',
    });
  } catch (e) {
    setStatus(`スナップショット保存失敗: ${e.message}`, 'red');
    await showAlert({
      title: 'エラー',
      message: `スナップショット保存失敗:\n${e.message}`,
      okLabel: 'OK',
    });
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
  if (sec >= 3600) { const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60); return `次回更新: ${h}時間${m>0?`${m}分`:''}後`; }
  if (sec >= 60)   { const m = Math.floor(sec/60), s = sec%60; return `次回更新: ${m}分${s>0?`${s}秒`:''}後`; }
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
  // briefing.js
  reloadBriefing,
  // auth-ui.js
  authKeyPress, authBackspace, pcKeyPress, pcBackspace,
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
  focusImportFileInput, _renderImportStep, _confirmImport, _retryWithPin,
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
  setupPriceUpdateListener();
  applyTheme();
  document.getElementById('btn-pnl').classList.remove('active');
  document.querySelectorAll('.period-btn[data-period]').forEach(b =>
    b.classList.toggle('active', b.dataset.period === '1d'));

  // 初期タブ状態を適用（ヒートマップのみ表示、他は非表示）
  const panelList      = document.getElementById('panel-list');
  const panelWatchlist = document.getElementById('panel-watchlist');
  const panelRisk      = document.getElementById('panel-risk');
  const panelBriefing  = document.getElementById('panel-briefing');
  const panelAi        = document.getElementById('panel-ai');
  if (panelList)      panelList.hidden      = true;
  if (panelWatchlist) panelWatchlist.hidden = true;
  if (panelRisk)      panelRisk.hidden      = true;
  if (panelBriefing)  panelBriefing.hidden  = true;
  if (panelAi)        panelAi.hidden        = true;

  renderStats();

  // stats の初期表示状態を DOM に反映（state.statsVisible = false → 非表示）
  const _stats = document.getElementById('stats');
  if (_stats) _stats.style.display = state.statsVisible ? '' : 'none';
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
  requestAnimationFrame(updateActiveTableHeight);

  // 前回開いていたタブを復元（heatmap以外なら switchTab で切替）
  // AI タブは無効化中のため復元対象外
  try {
    const lastTab = localStorage.getItem('hm-active-tab');
    if (lastTab && lastTab !== 'heatmap' && ['list','watchlist','risk','briefing'].includes(lastTab)) {
      requestAnimationFrame(() => switchTab(lastTab));
    } else if (lastTab === 'ai') {
      localStorage.removeItem('hm-active-tab'); // 古い保存値をクリア
    }
  } catch {}

  // 起動時に KV から保有銘柄を読み込んでから価格取得
  (async () => {
    try {
      // 0. sessionStorage → IDB マイグレーション（初回のみ有効）、その後 IDB からメモリ復元
      await migrateFromSessionStorage();
      await restoreFromIDB();
      // 1. KV から保有銘柄を取得（あれば positions.js の内容を上書き）
      const loaded = await loadPositionsFromKV();
      if (loaded) { renderStats(); renderHeatmap(); }
      // 1b. 分散ファンドの実セクター比率を Yahoo topHoldings から取得（fire-and-forget）
      loadTopHoldings().then(() => {
        if (state.activeTab === 'risk') renderRiskCharts();
      }).catch(e => console.warn('[topholdings] loadTopHoldings failed:', e));
      // 1c. curated 未登録の個別株を Finnhub profile2 で属性付与（fire-and-forget・#203）
      //     先に IDB 永続キャッシュからメモリへ先読み復元してから、失効分のみ取得（#205）
      restoreConstituentsFromIDB()
        .then(() => { if (state.activeTab === 'risk') renderRiskCharts(); })
        .then(() => loadStockProfiles())
        .then(() => { if (state.activeTab === 'risk') renderRiskCharts(); })
        .catch(e => console.warn('[stock-profile] loadStockProfiles failed:', e));
      // 2. Cron キャッシュ価格を即時反映（ライブ取得前の暫定表示）
      applyPricesCache(); // fire-and-forget
      // 3. ライブ価格取得
      try {
        await refreshPrices();
      } catch (e) {
        console.warn('[init] refreshPrices failed:', e);
        setStatus('ライブ価格取得エラー（前回データで表示中）', 'yellow');
      } finally {
        hideHeatmapSkeleton();
        renderHeatmap();
      }
      // recordTodayAsset は history.js（未統合）のため呼ばない

      // 1y は最優先で取得（UIの初期表示に必要）
      await fetchAllHistorical('1y');
      renderStats();
      renderStockList();
      if (state.activeTab === 'watchlist') {
        renderWatchlist();
        updateWatchlistHeight();
      }
      if (state.changePeriod && state.changePeriod !== '1d') renderHeatmap();

      // 5y / 10y は並列で取得（完了ごとに描画、片方失敗してももう片方は描画する）
      await refreshHistoricalAndRender();
    } catch (e) {
      console.error('[init] startup data flow failed:', e);
      setStatus('初期化に失敗しました（保存済みデータで表示中）', 'yellow');
      hideHeatmapSkeleton();
      renderHeatmap();
    }
  })();
}

setupEventListeners(applyTheme);
if (typeof window.d3 !== 'undefined') {
  init();
}

import './ptr.js';

// ── バージョン表示：タイトル右に inline で表示（display:block にすると header レイアウトが崩れる） ──
(function() {
  const ver = (import.meta.url.match(/[?&]v=([^&]+)/) || [,'?'])[1];
  const title = document.querySelector('.title');
  if (title) {
    const badge = document.createElement('span');
    badge.id = 'debug-ver';
    badge.style.cssText = 'display:inline;font-size:9px;font-weight:400;color:var(--text2);opacity:0.6;margin-left:6px;vertical-align:bottom;';
    badge.textContent = `v.${  ver}`;
    title.appendChild(badge);
  }
}());
