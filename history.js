// ══════════════════════════════════════════════════════════════
// history.js  ―  資産推移の自動記録とグラフ表示
//
// 依存: state.js (state), utils.js (fmtJPYInt, fmtPctInt, sgn),
//       app.js (positions), D3.js
// ══════════════════════════════════════════════════════════════

const HM_HISTORY_KEY = 'hm-asset-history'; // localStorage キー
const HM_HISTORY_MAX = 1000;               // 最大保存レコード数（約3年分）

// ── YYYYMMDD 形式の今日の日付文字列 ──
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/**
 * 現在の総資産額を localStorage に記録する。
 * 同一日付のレコードは上書き（1日1レコード）。
 * refreshPrices() 成功後に app.js から呼ぶ。
 */
function recordTodayAsset() {
  const totalValue = positions.reduce((s, p) => s + (p.value || 0), 0);
  if (!totalValue || totalValue < 1000) return; // 異常値は記録しない

  const today = todayStr();
  const stored = loadHistoryRecords();

  // 同一日があれば上書き、なければ追加
  const idx = stored.findIndex(r => r.date === today);
  if (idx >= 0) {
    stored[idx].value = totalValue;
  } else {
    stored.push({ date: today, value: totalValue });
    // 古い順にソートしてから最大件数を守る
    stored.sort((a, b) => a.date.localeCompare(b.date));
    if (stored.length > HM_HISTORY_MAX) stored.splice(0, stored.length - HM_HISTORY_MAX);
  }

  try {
    localStorage.setItem(HM_HISTORY_KEY, JSON.stringify(stored));
  } catch (e) {
    console.warn('[history] localStorage 保存失敗:', e);
  }
}

/** localStorage から資産推移レコードを読み込む */
function loadHistoryRecords() {
  try {
    const raw = localStorage.getItem(HM_HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

/**
 * 手動でレコードを追加・編集するための管理関数（デバッグ用）
 * 例: addHistoryRecord('2026-01-01', 450000000)
 */
function addHistoryRecord(dateStr, value) {
  const stored = loadHistoryRecords();
  const idx = stored.findIndex(r => r.date === dateStr);
  if (idx >= 0) stored[idx].value = value;
  else stored.push({ date: dateStr, value });
  stored.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(HM_HISTORY_KEY, JSON.stringify(stored));
  if (state.activeTab === 'history') renderHistoryTab();
}

// ══════════════════════════════════════════════
// グラフ描画
// ══════════════════════════════════════════════

/**
 * 資産推移タブを描画する。
 * switchTab('history') から呼ばれる。
 */
function renderHistoryTab() {
  const panel = document.getElementById('panel-history');
  if (!panel) return;

  const records = loadHistoryRecords();
  if (records.length === 0) {
    panel.innerHTML = `
      <div class="hist-empty">
        <p>まだ記録がありません。</p>
        <p>ライブ価格を取得すると自動的に記録が始まります。</p>
        <button class="hist-refresh-btn" onclick="refreshPrices()">今すぐ取得</button>
      </div>`;
    return;
  }

  // データ前処理
  const data = records.map(r => ({ date: new Date(r.date + 'T00:00:00'), value: r.value }));

  // サマリー計算
  const first   = data[0];
  const last    = data[data.length - 1];
  const maxRec  = data.reduce((m, d) => d.value > m.value ? d : m, data[0]);
  const minRec  = data.reduce((m, d) => d.value < m.value ? d : m, data[0]);
  const chgAmt  = last.value - first.value;
  const chgPct  = first.value > 0 ? (chgAmt / first.value) * 100 : 0;
  const chgCls  = chgPct >= 0 ? 'pos' : 'neg';

  // グラフ領域
  const isMobile = window.innerWidth < 600;
  const margin   = isMobile
    ? { top: 16, right: 12, bottom: 40, left: 56 }
    : { top: 20, right: 24, bottom: 48, left: 72 };
  const W = (panel.clientWidth || 360) - margin.left - margin.right;
  const H = isMobile ? 220 : 280;

  // HTML を組み立て
  panel.innerHTML = `
    <div class="hist-summary">
      <div class="hist-stat">
        <span class="hist-label">現在の総資産</span>
        <span class="hist-val neu">${fmtJPYInt(last.value)}</span>
      </div>
      <div class="hist-stat">
        <span class="hist-label">通算損益（記録開始比）</span>
        <span class="hist-val ${chgCls}">${chgAmt >= 0 ? '+' : ''}${fmtJPYInt(chgAmt)}</span>
        <span class="hist-sub ${chgCls}">${fmtPctInt(chgPct)}</span>
      </div>
      <div class="hist-stat">
        <span class="hist-label">最高値</span>
        <span class="hist-val pos">${fmtJPYInt(maxRec.value)}</span>
        <span class="hist-sub neu">${maxRec.date.toLocaleDateString('ja-JP',{month:'2-digit',day:'2-digit'})}</span>
      </div>
      <div class="hist-stat">
        <span class="hist-label">最安値</span>
        <span class="hist-val neg">${fmtJPYInt(minRec.value)}</span>
        <span class="hist-sub neu">${minRec.date.toLocaleDateString('ja-JP',{month:'2-digit',day:'2-digit'})}</span>
      </div>
    </div>
    <div class="hist-range-bar" id="hist-range-bar">
      <button class="hist-range-btn active" data-range="all" onclick="setHistoryRange('all',this)">全期間</button>
      <button class="hist-range-btn" data-range="1m"  onclick="setHistoryRange('1m',this)">1ヶ月</button>
      <button class="hist-range-btn" data-range="3m"  onclick="setHistoryRange('3m',this)">3ヶ月</button>
      <button class="hist-range-btn" data-range="6m"  onclick="setHistoryRange('6m',this)">6ヶ月</button>
      <button class="hist-range-btn" data-range="1y"  onclick="setHistoryRange('1y',this)">1年</button>
    </div>
    <div id="hist-chart-wrap" class="hist-chart-wrap">
      <svg id="hist-svg"></svg>
    </div>
    <div class="hist-footer">
      <span class="hist-count">${data.length}日分のデータ（記録開始: ${first.date.toLocaleDateString('ja-JP')}）</span>
      <button class="hist-export-btn" onclick="exportHistoryCsv()" title="CSVエクスポート">CSV</button>
    </div>`;

  _drawHistoryChart(data, 'all');
}

/** レンジボタン切替 */
function setHistoryRange(range, btn) {
  document.querySelectorAll('.hist-range-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const allData = loadHistoryRecords().map(r => ({ date: new Date(r.date + 'T00:00:00'), value: r.value }));
  _drawHistoryChart(allData, range);
}

/** レンジに応じてデータをフィルタリングして D3 チャートを描画 */
function _drawHistoryChart(allData, range) {
  const now  = new Date();
  const from = new Date(now);
  if      (range === '1m')  from.setMonth(now.getMonth() - 1);
  else if (range === '3m')  from.setMonth(now.getMonth() - 3);
  else if (range === '6m')  from.setMonth(now.getMonth() - 6);
  else if (range === '1y')  from.setFullYear(now.getFullYear() - 1);
  else                      from.setFullYear(2000); // 全期間

  const data = allData.filter(d => d.date >= from);
  if (data.length < 2) return;

  const wrap   = document.getElementById('hist-chart-wrap');
  if (!wrap) return;
  const isMobile = window.innerWidth < 600;
  const margin = isMobile
    ? { top: 12, right: 12, bottom: 36, left: 60 }
    : { top: 16, right: 24, bottom: 44, left: 72 };
  const W = wrap.clientWidth - margin.left - margin.right;
  const H = isMobile ? 200 : 260;

  const svg = d3.select('#hist-svg')
    .attr('width',  W + margin.left + margin.right)
    .attr('height', H + margin.top  + margin.bottom);
  svg.selectAll('*').remove();
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // スケール
  const xScale = d3.scaleTime()
    .domain(d3.extent(data, d => d.date))
    .range([0, W]);
  const yMin = d3.min(data, d => d.value) * 0.99;
  const yMax = d3.max(data, d => d.value) * 1.01;
  const yScale = d3.scaleLinear().domain([yMin, yMax]).range([H, 0]).nice();

  // グリッド
  const isDark = document.documentElement.dataset.theme === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  g.append('g').attr('class','hist-grid')
    .call(d3.axisLeft(yScale).ticks(4).tickSize(-W).tickFormat(''))
    .select('.domain').remove();
  g.selectAll('.hist-grid line').attr('stroke', gridColor).attr('stroke-dasharray','3,3');

  // 軸
  const textColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
  const xTicks = Math.min(data.length, isMobile ? 4 : 6);
  g.append('g')
    .attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(xScale).ticks(xTicks).tickFormat(d => {
      const span = xScale.domain()[1] - xScale.domain()[0];
      const days = span / 86400000;
      if (days <= 40)  return d3.timeFormat('%m/%d')(d);
      if (days <= 400) return d3.timeFormat('%m月')(d);
      return d3.timeFormat('%Y')(d);
    }))
    .selectAll('text').attr('fill', textColor).attr('font-size', isMobile ? 10 : 11);
  g.selectAll('.domain, .tick line').attr('stroke', gridColor);

  // 億円単位でY軸
  g.append('g')
    .call(d3.axisLeft(yScale).ticks(4).tickFormat(v => {
      const oku = v / 1e8;
      return oku >= 1 ? `${oku.toFixed(1)}億` : `${(v/1e6).toFixed(0)}百万`;
    }))
    .selectAll('text').attr('fill', textColor).attr('font-size', isMobile ? 10 : 11);
  g.selectAll('.domain').attr('stroke', gridColor);

  // グラデーション塗り
  const gradId = 'hist-grad-' + Date.now();
  const defs = svg.append('defs');
  const grad = defs.append('linearGradient').attr('id', gradId).attr('x1','0').attr('x2','0').attr('y1','0').attr('y2','1');
  grad.append('stop').attr('offset','0%').attr('stop-color','#3B82F6').attr('stop-opacity', isDark ? 0.35 : 0.25);
  grad.append('stop').attr('offset','100%').attr('stop-color','#3B82F6').attr('stop-opacity', 0);

  const area = d3.area().x(d => xScale(d.date)).y0(H).y1(d => yScale(d.value)).curve(d3.curveMonotoneX);
  g.append('path').datum(data).attr('fill', `url(#${gradId})`).attr('d', area);

  // ライン
  const line = d3.line().x(d => xScale(d.date)).y(d => yScale(d.value)).curve(d3.curveMonotoneX);
  g.append('path').datum(data).attr('fill','none').attr('stroke','#3B82F6').attr('stroke-width', isMobile ? 1.8 : 2).attr('d', line);

  // 最新ドット
  const last = data[data.length - 1];
  g.append('circle')
    .attr('cx', xScale(last.date)).attr('cy', yScale(last.value))
    .attr('r', 4).attr('fill','#3B82F6').attr('stroke', isDark ? '#000' : '#fff').attr('stroke-width', 2);

  // ホバー crosshair
  const bisect = d3.bisector(d => d.date).left;
  const tooltip = g.append('g').attr('class','hist-tooltip').style('display','none');
  const tooltipLine = tooltip.append('line').attr('y1',0).attr('y2',H).attr('stroke',gridColor).attr('stroke-dasharray','4,3');
  const tooltipDot  = tooltip.append('circle').attr('r', 4).attr('fill','#3B82F6').attr('stroke','#fff').attr('stroke-width',2);
  const tooltipBox  = tooltip.append('g');
  const tooltipRect = tooltipBox.append('rect').attr('rx',6).attr('ry',6).attr('fill', isDark ? '#2C2C2E' : '#fff')
    .attr('stroke', isDark ? '#3A3A3C' : '#C6C6CB').attr('stroke-width',1);
  const tooltipDate = tooltipBox.append('text').attr('font-size', isMobile ? 10 : 11).attr('fill', textColor);
  const tooltipVal  = tooltipBox.append('text').attr('font-size', isMobile ? 11 : 12).attr('fill', isDark ? '#fff' : '#1C1C1E').attr('font-weight','600');

  svg.append('rect')
    .attr('fill','transparent')
    .attr('x', margin.left).attr('y', margin.top)
    .attr('width', W).attr('height', H)
    .on('mousemove touchmove', function(event) {
      const [mx] = d3.pointer(event, g.node());
      const x0  = xScale.invert(mx);
      const i   = bisect(data, x0, 1);
      const d0  = data[i - 1], d1 = data[i];
      const d   = (!d1 || (x0 - d0.date) < (d1.date - x0)) ? d0 : d1;
      const cx  = xScale(d.date), cy = yScale(d.value);

      tooltip.style('display', null);
      tooltipLine.attr('x1', cx).attr('x2', cx);
      tooltipDot.attr('cx', cx).attr('cy', cy);

      const dateStr = d.date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const valStr  = fmtJPYInt(d.value);
      tooltipDate.text(dateStr);
      tooltipVal.text(valStr);

      const pad   = 8, lineH = isMobile ? 14 : 16;
      const bw    = Math.max(tooltipDate.node().getBBox().width, tooltipVal.node().getBBox().width) + pad * 2;
      const bh    = lineH * 2 + pad * 2;
      const bx    = cx + 8 + bw > W ? cx - bw - 8 : cx + 8;
      const by    = Math.max(0, Math.min(cy - bh / 2, H - bh));

      tooltipRect.attr('x', bx).attr('y', by).attr('width', bw).attr('height', bh);
      tooltipDate.attr('x', bx + pad).attr('y', by + pad + lineH * 0.75);
      tooltipVal.attr('x',  bx + pad).attr('y', by + pad + lineH * 1.8);
    })
    .on('mouseleave touchend', () => tooltip.style('display','none'));
}

/** 資産推移レコードを CSV としてダウンロードする */
function exportHistoryCsv() {
  const records = loadHistoryRecords();
  if (!records.length) return;
  const rows = ['日付,総資産額（円）', ...records.map(r => `${r.date},${r.value}`)];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `asset-history-${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
