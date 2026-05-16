// ══════════════════════════════════════════════════════════════
// chart.js  ―  銘柄チャートモーダル
//
// 依存: state.js (state, CHART_RANGES), utils.js (cssVar, fmtPct, sgn),
//        data.js (fetchViaProxy)
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// CHART HELPERS  ―  renderChart のサブ関数群
// ══════════════════════════════════════════════════════════════

/**
 * 移動平均を計算する（拡張ウィンドウ方式: 先頭からデータが増える）
 * @param {Array<{date:Date,close:number}>} points
 * @param {number} n - 期間
 * @returns {Array<{date:Date,ma:number}>}
 */
function _calcMA(points, n) {
  return points.map((p, i) => {
    const slice = points.slice(Math.max(0, i - n + 1), i + 1);
    return { date: p.date, ma: slice.reduce((a, b) => a + b.close, 0) / slice.length };
  });
}

/**
 * 3本の移動平均（5日・200日・50週）を計算してスタイル設定込みで返す
 * @param {Array<{date:Date,close:number}>} points
 * @returns {Array<{data:Array, color:string, width:number, opacity:number, label:string}>}
 */
function _buildMAStyles(points) {
  const enough = points.length >= 2;
  return [
    { data: enough ? _calcMA(points, 5)   : [], color: '#5ac8fa', width: 1,   opacity: 0.85, label: '5日MA'   },
    { data: enough ? _calcMA(points, 200) : [], color: '#2e90d8', width: 1.4, opacity: 0.90, label: '200日MA' },
    { data: enough ? _calcMA(points, 50)  : [], color: '#1a5fa0', width: 1.8, opacity: 0.90, label: '50週MA'  },
  ];
}

/**
 * チャート SVG に背景・グリッド・グラデーション・コスト線・MA線・価格線・軸を描画する
 * @param {d3.Selection} g - SVG グループ
 * @param {d3.ScaleTime} x
 * @param {d3.ScaleLinear} y
 * @param {number} iW - 描画幅
 * @param {number} iH - 描画高さ
 * @param {Array} points
 * @param {number} avgCost - 平均取得単価
 * @param {string} cur - 通貨（'USD'|'JPY'）
 * @param {string} lineColor - 価格線カラー
 * @param {Object} defs - SVG defs
 * @param {string} dateFmt - D3 timeFormat 文字列
 * @param {Array} maStyles - _buildMAStyles() の戻り値
 */
function _drawChartContent(g, x, y, iW, iH, points, avgCost, cur, lineColor, defs, dateFmt, maStyles) {
  // ── Grid ──
  g.append('g')
    .call(d3.axisLeft(y).ticks(5).tickSize(-iW).tickFormat(''))
    .call(g2 => g2.select('.domain').remove())
    .call(g2 => g2.selectAll('.tick line').attr('stroke', cssVar('--chart-grid')));
  g.append('g').attr('transform', `translate(0,${iH})`)
    .call(d3.axisBottom(x).ticks(5).tickSize(-iH).tickFormat(''))
    .call(g2 => g2.select('.domain').remove())
    .call(g2 => g2.selectAll('.tick line').attr('stroke', cssVar('--chart-grid')));

  // ── Gradient fill (iPhone Stocks style) ──
  const areaGrad = defs.append('linearGradient')
    .attr('id', 'area-grad').attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
  areaGrad.append('stop').attr('offset', '0%').attr('stop-color', lineColor).attr('stop-opacity', 0.28);
  areaGrad.append('stop').attr('offset', '100%').attr('stop-color', lineColor).attr('stop-opacity', 0.02);
  g.append('path')
    .datum(points)
    .attr('d', d3.area().x(d => x(d.date)).y0(iH).y1(d => y(d.close)).curve(d3.curveMonotoneX))
    .attr('fill', 'url(#area-grad)');

  // ── Cost basis line ──
  const cy = y(avgCost);
  g.append('line').attr('x1', 0).attr('x2', iW).attr('y1', cy).attr('y2', cy)
    .attr('stroke', cssVar('--cost-line')).attr('stroke-width', 0.7).attr('stroke-dasharray', '4,3');
  g.append('text').attr('x', 2).attr('y', cy - 4)
    .attr('fill', cssVar('--cost-text')).attr('font-size', 10)
    .text('取得単価: ' + (cur === 'USD' ? '$' + avgCost.toFixed(2) : '¥' + Math.round(avgCost).toLocaleString()));

  // ── Moving average lines ──
  const maLineFn = d3.line().x(d => x(d.date)).y(d => y(d.ma)).curve(d3.curveMonotoneX);
  maStyles.forEach(ma => {
    if (!ma.data.length) return;
    g.append('path').datum(ma.data)
      .attr('d', maLineFn).attr('fill', 'none')
      .attr('stroke', ma.color).attr('stroke-width', ma.width).attr('opacity', ma.opacity);
  });

  // ── Price line + last dot ──
  g.append('path')
    .datum(points)
    .attr('d', d3.line().x(d => x(d.date)).y(d => y(d.close)).curve(d3.curveMonotoneX))
    .attr('fill', 'none').attr('stroke', lineColor).attr('stroke-width', 2);
  const lp = points[points.length - 1];
  g.append('circle').attr('cx', x(lp.date)).attr('cy', y(lp.close)).attr('r', 4).attr('fill', lineColor);

  // ── Axes ──
  const tickFmt = cur === 'USD'
    ? d => '$' + (d >= 1000 ? (d / 1000).toFixed(1) + 'k' : d.toFixed(0))
    : d => d >= 100000 ? '¥' + (d / 10000).toFixed(0) + '万' : d >= 10000 ? '¥' + (d / 1000).toFixed(0) + 'k' : '¥' + Math.round(d);
  g.append('g').attr('transform', `translate(0,${iH})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat(dateFmt)))
    .call(g2 => {
      g2.select('.domain').attr('stroke', cssVar('--border'));
      g2.selectAll('.tick text').attr('fill', cssVar('--text2')).attr('font-size', 11);
      g2.selectAll('.tick line').attr('stroke', cssVar('--border'));
    });
  g.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(tickFmt))
    .call(g2 => {
      g2.select('.domain').attr('stroke', cssVar('--border'));
      g2.selectAll('.tick text').attr('fill', cssVar('--text2')).attr('font-size', 11);
      g2.selectAll('.tick line').attr('stroke', cssVar('--border'));
    });
}

/**
 * チャートにインタラクティブなクロスヘアを設置する
 * @param {d3.Selection} g
 * @param {d3.ScaleTime} x
 * @param {d3.ScaleLinear} y
 * @param {Array} points
 * @param {Object} m - マージン {top, right, bottom, left}
 * @param {number} iW
 * @param {number} iH
 * @param {string} interval - Yahoo Finance interval
 * @param {string} cur
 * @param {string} lineColor
 * @param {Array} maStyles
 */
function _initChartCrosshair(g, x, y, points, m, iW, iH, interval, cur, lineColor, maStyles) {
  const bisect = d3.bisector(d => d.date).left;
  const pf2 = v => cur === 'USD' ? '$' + v.toFixed(2) : '¥' + Math.round(v).toLocaleString();

  // ── クロスヘア要素群 ──
  const crosshair = g.append('g').style('display', 'none');
  const chLineV = crosshair.append('line')
    .attr('stroke', cssVar('--text2')).attr('stroke-dasharray', '3,3').attr('stroke-width', 1);
  const chLineH = crosshair.append('line')
    .attr('stroke', cssVar('--text2')).attr('stroke-dasharray', '3,3').attr('stroke-width', 1);
  const chDot = crosshair.append('circle')
    .attr('r', 4.5).attr('fill', lineColor).attr('stroke', cssVar('--surface')).attr('stroke-width', 2);
  const chBg = crosshair.append('rect')
    .attr('rx', 4).attr('fill', cssVar('--surface')).attr('stroke', cssVar('--border')).attr('stroke-width', 1);
  const chLabel = crosshair.append('text')
    .attr('fill', cssVar('--text')).attr('font-size', 12).attr('font-weight', 600);
  const chMABox = crosshair.append('g');

  function updateCrosshair(clientX) {
    const svgEl = document.getElementById('chart-svg');
    const rect = svgEl.getBoundingClientRect();
    const mx = clientX - rect.left - m.left;
    if (mx < 0 || mx > iW) return;
    const date = x.invert(mx);
    const idx = Math.min(bisect(points, date), points.length - 1);
    const p = points[idx];
    const px = x(p.date), py = y(p.close);
    const isRight = px > iW * 0.65;
    const labelX = isRight ? px - 10 : px + 10;

    crosshair.style('display', null);
    chLineV.attr('x1', px).attr('x2', px).attr('y1', 0).attr('y2', iH);
    chLineH.attr('x1', 0).attr('x2', iW).attr('y1', py).attr('y2', py);
    chDot.attr('cx', px).attr('cy', py);

    const dateStr = (interval === '5m' || interval === '1h')
      ? p.date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
      : p.date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
    chLabel
      .attr('x', labelX).attr('y', Math.max(14, py - 14))
      .attr('text-anchor', isRight ? 'end' : 'start')
      .text(`${dateStr}  ${pf2(p.close)}`);

    const bb = chLabel.node().getBBox();
    chBg.attr('x', bb.x - 4).attr('y', bb.y - 4).attr('width', bb.width + 8).attr('height', bb.height + 8);

    // MA 値ボックス（右上固定）
    chMABox.selectAll('*').remove();
    const bxX = isRight ? 6 : iW - 110;
    const getMAAt = maData => {
      const mi = bisect(maData, date, 0, maData.length);
      return maData[Math.min(mi, maData.length - 1)]?.ma ?? null;
    };
    maStyles.filter(ma => ma.data.length > 0).forEach((ma, i) => {
      const val = getMAAt(ma.data);
      if (val === null) return;
      chMABox.append('circle').attr('cx', bxX + 5).attr('cy', 8 + i * 16).attr('r', 3).attr('fill', ma.color);
      chMABox.append('text').attr('x', bxX + 12).attr('y', 12 + i * 16)
        .attr('fill', ma.color).attr('font-size', 11)
        .text(`${ma.label} ${pf2(val)}`);
    });
  }

  const interactRect = g.append('rect')
    .attr('width', iW).attr('height', iH)
    .attr('fill', 'transparent')
    .style('touch-action', 'none');

  interactRect
    .on('mousemove',  e => updateCrosshair(e.clientX))
    .on('mouseleave', () => crosshair.style('display', 'none'))
    .on('touchstart', e => { e.preventDefault(); updateCrosshair(e.touches[0].clientX); })
    .on('touchmove',  e => { e.preventDefault(); updateCrosshair(e.touches[0].clientX); })
    .on('touchend',   () => crosshair.style('display', 'none'));
}

/**
 * チャートモーダル下部の統計バー（現在値・騰落率・MA 凡例）を更新する
 * @param {Array} points
 * @param {number} avgCost
 * @param {string} cur
 * @param {Array} maStyles
 */
function _renderChartStats(points, avgCost, cur, maStyles) {
  const fp = points[0].close;
  const lastPrice = points[points.length - 1].close;
  const chgPct = (lastPrice - fp) / fp * 100;
  const pnlPct = (lastPrice - avgCost) / avgCost * 100;
  const pf = v => cur === 'USD' ? '$' + v.toFixed(2) : '¥' + Math.round(v).toLocaleString();

  const maLegend = maStyles
    .filter(ma => ma.data.length > 0)
    .map(ma => {
      const last = ma.data[ma.data.length - 1].ma;
      return `<span style="display:inline-flex;align-items:center;gap:4px">` +
        `<svg width="8" height="8"><circle cx="4" cy="4" r="3.5" fill="${ma.color}"/></svg>` +
        `<span style="color:${ma.color};font-size:11px">${ma.label}</span> <strong>${pf(last)}</strong></span>`;
    }).join('');

  document.getElementById('chart-stats').innerHTML = `
    <span>現在値: <strong class="neu">${pf(lastPrice)}</strong></span>
    <span>期間変動: <strong class="${sgn(chgPct)}">${fmtPct(chgPct)}</strong></span>
    <span>損益率: <strong class="${sgn(pnlPct)}">${fmtPct(pnlPct)}</strong></span>
    <span>高値: <strong class="neu">${pf(d3.max(points, d => d.close))}</strong></span>
    <span>安値: <strong class="neu">${pf(d3.min(points, d => d.close))}</strong></span>
    ${maLegend}
  `;
}

// ══════════════════════════════════════════════════════════════
// CHART MODAL
// ══════════════════════════════════════════════════════════════

/**
 * 銘柄チャートモーダルを開く
 * @param {Object} pos - positions 配列の要素
 */
function openChart(pos) {
  state.currentPos = pos;
  const proxyNote = pos.isProxy
    ? ' <span class="modal-sym" style="color:#e3b341">※ ' + pos.proxyName + '</span>'
    : ' <span class="modal-sym">' + pos.symbol + '</span>';
  document.getElementById('modal-title').innerHTML = pos.name + proxyNote;
  updateRangeBtns();
  document.getElementById('modal-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  if (pos.ySymbol) {
    loadChart(pos.ySymbol, state.currentRange);
  } else {
    document.getElementById('chart-message').className = 'chart-error';
    document.getElementById('chart-message').textContent = 'この銘柄のチャートデータはYahoo Financeに未対応です';
    document.getElementById('chart-message').style.display = 'block';
    document.getElementById('chart-svg').style.display = 'none';
    document.getElementById('chart-stats').innerHTML = '';
  }
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

function handleOverlayClick(event) {
  if (event.target === document.getElementById('modal-overlay')) closeModal();
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function setRange(range) {
  state.currentRange = range;
  updateRangeBtns();
  if (state.currentPos && state.currentPos.ySymbol) loadChart(state.currentPos.ySymbol, range);
}

function updateRangeBtns() {
  document.querySelectorAll('.range-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.range === state.currentRange);
  });
}

/**
 * Yahoo Finance から指定銘柄・期間の価格データを取得してチャートを描画する
 * @param {string} symbol - Yahoo Finance ティッカー
 * @param {string} rangeId - CHART_RANGES のキー
 */
async function loadChart(symbol, rangeId) {
  const cfg = CHART_RANGES[rangeId] || CHART_RANGES['3mo'];
  const msg = document.getElementById('chart-message');
  const chartSvg = document.getElementById('chart-svg');

  // 既存チャートがあるか（期間切替 vs 初回ロード）
  const hasChart = chartSvg.childElementCount > 0;

  if (hasChart) {
    // 期間切替：チャートをそのまま残す（伸縮チラつき防止）。ローディング表示なし
    msg.style.display = 'none';
  } else {
    // 初回ロード：チャートがないのでローディング表示
    msg.className = 'chart-loading';
    msg.textContent = '読み込み中...';
    msg.style.display = 'block';
    chartSvg.style.display = 'none';
  }
  document.getElementById('chart-stats').innerHTML = '';

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${cfg.interval}&range=${cfg.yRange}`;
  const chartData = await fetchViaProxy(url);
  const chartResult = chartData?.chart?.result?.[0] ?? null;

  if (!chartResult) {
    msg.className = 'chart-error';
    msg.textContent = 'チャートデータの取得に失敗しました。\n（接続確認・地域によるAPIアクセス制限の可能性）';
    msg.style.display = 'block';
    chartSvg.style.display = 'none';
    return;
  }

  const timestamps = chartResult.timestamp || [];
  const closes = chartResult.indicators?.quote?.[0]?.close || [];
  const points = timestamps.map((ts, i) => ({
    date: new Date(ts * 1000),
    close: closes[i]
  })).filter(p => p.close != null && isFinite(p.close));

  if (points.length < 2) {
    msg.className = 'chart-error';
    msg.textContent = '表示できるデータが不足しています';
    msg.style.display = 'block';
    chartSvg.style.display = 'none';
    return;
  }

  msg.style.display = 'none';
  chartSvg.style.display = 'block';
  renderChart(points, cfg.interval, cfg.dateFmt);
}

/**
 * チャートを描画する（メインオーケストレーター）
 * ヘルパー関数: _buildMAStyles / _drawChartContent / _initChartCrosshair / _renderChartStats
 * @param {Array<{date:Date,close:number}>} points - フィルタ済み価格系列
 * @param {string} [interval='1d'] - Yahoo Finance interval
 * @param {string} [dateFmt='%m/%d'] - D3 timeFormat 文字列
 */
function renderChart(points, interval = '1d', dateFmt = '%m/%d') {
  const container = document.getElementById('modal');
  const W = container.clientWidth - 40;
  const H = Math.max(260, Math.min(360, Math.round(W * 0.50)));
  const m = { top: 18, right: 18, bottom: 32, left: 68 };
  const iW = W - m.left - m.right;
  const iH = H - m.top - m.bottom;
  const { avgCost, cur } = state.currentPos;
  const fp = points[0].close;
  const lastPrice = points[points.length - 1].close;
  // iPhone Stocks スタイル: 期間始値との比較でグリーン/レッド
  const lineColor = (lastPrice >= fp) ? '#30D158' : '#FF453A';

  // 移動平均計算
  const maStyles = _buildMAStyles(points);

  // D3 セットアップ
  const svg = d3.select('#chart-svg').attr('width', W).attr('height', H);
  svg.selectAll('*').remove();
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
  const defs = svg.append('defs');

  // スケール
  const x = d3.scaleTime().domain(d3.extent(points, d => d.date)).range([0, iW]);
  const maVals = maStyles.flatMap(ma => ma.data.map(d => d.ma));
  const allVals = points.map(d => d.close).concat([avgCost]).concat(maVals).filter(v => v != null);
  const y = d3.scaleLinear()
    .domain([d3.min(allVals) * 0.97, d3.max(allVals) * 1.02])
    .range([iH, 0]);

  // 描画
  _drawChartContent(g, x, y, iW, iH, points, avgCost, cur, lineColor, defs, dateFmt, maStyles);
  _initChartCrosshair(g, x, y, points, m, iW, iH, interval, cur, lineColor, maStyles);
  _renderChartStats(points, avgCost, cur, maStyles);
}
