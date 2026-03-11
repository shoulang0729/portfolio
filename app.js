// ══════════════════════════════════════════════════════════════
// app.js  ―  初期化・テーマ・モード切替・更新頻度・レイアウト
//
// 依存: state.js (state), utils.js (cssVar, calcPortfolioPeriodPct,
//        fmtJPYInt, fmtPctInt, sgn), data.js (fetchAllHistorical,
//        refreshPrices, setStatus), heatmap.js (renderHeatmap),
//        chart.js (loadChart), stock-list.js (renderStockList,
//        applyStockBars), positions.js (positions, PERIODS)
// ══════════════════════════════════════════════════════════════

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
function applyTheme() {
  document.documentElement.dataset.theme = state.themeMode;
  const icons = { light: '☼', dark: '☾', auto: 'A' };
  const el = document.getElementById('theme-btn');
  if (el) el.textContent = icons[state.themeMode] ?? 'A';
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

  // Highlight active refresh button
  if (val !== 'now') {
    document.querySelectorAll('.refresh-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.val === val));
  }

  if (val === '0') return;

  if (val === 'now') {
    await refreshPrices();
    // After live shot, switch to 1分 auto-refresh
    handleRefreshSelect('60');
    return;
  }

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
  const themeBtn      = document.getElementById('theme-btn');
  const statusLine    = document.getElementById('status-line');

  const mobileRefresh = document.createElement('div');
  mobileRefresh.className = 'mobile-refresh';

  // 上段：更新頻度スイッチ + テーマボタン + CSVボタン
  const refreshTop = document.createElement('div');
  refreshTop.className = 'mobile-refresh-top';
  if (refreshSwitch) refreshTop.appendChild(refreshSwitch);
  if (themeBtn)      refreshTop.appendChild(themeBtn);
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

/**
 * アプリ初期化
 * テーマ適用 → 初期描画 → バックグラウンドで履歴データを段階的に取得する
 */
function init() {
  _setupMobileLayout();
  applyTheme();
  document.getElementById('btn-pnl').classList.remove('active');
  document.querySelectorAll('.period-btn[data-period]').forEach(b =>
    b.classList.toggle('active', b.dataset.period === '1d'));

  // 初期タブ状態を適用（ヒートマップを表示、銘柄リストを非表示）
  const panelList = document.getElementById('panel-list');
  if (panelList) panelList.hidden = true;

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

  // 起動時に自動で初回ライブ更新 → その後バックグラウンドで履歴データ取得
  (async () => {
    await refreshPrices();
    for (const range of ['1y', '5y', '10y']) {
      await fetchAllHistorical(range);
      renderStats();
      if (state.changePeriod && state.changePeriod !== '1d') renderHeatmap();
    }
  })();
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
  // 'heatmap' | 'list'
  if (state.activeTab === name) return;
  state.activeTab = name;

  const panelHeatmap = document.getElementById('panel-heatmap');
  const panelList    = document.getElementById('panel-list');
  if (panelHeatmap) panelHeatmap.hidden = (name !== 'heatmap');
  if (panelList)    panelList.hidden    = (name !== 'list');

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

// ── デバッグ：読み込んだファイルのバージョンをタイトル横に表示 ──
(function() {
  const s = document.querySelector('script[src*="app.js"]');
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
