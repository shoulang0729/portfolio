// ══════════════════════════════════════════════════════════════
// heatmap.js  ―  D3 ツリーマップ描画
//
// 依存: state.js (state, C), utils.js (cssVar, getColor, getDisplayPct,
//        getCellTextColor, getCellTextColorSub, fmtPct, fmtPrice, fmtJPY,
//        fmtJPYFull, sgn), positions.js (positions, PERIOD_MAP)
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════
// HEATMAP
// ══════════════════════════════════════════════
function renderHeatmap() {
  const wrap = document.getElementById('heatmap-wrap');
  const W = wrap.clientWidth;
  // W=0 は DOM 再配置直後のレイアウト未計算を示す → 次フレームで再試行
  if (W === 0) { requestAnimationFrame(renderHeatmap); return; }
  // モバイル（幅600px未満）は縦長比率を高く（画面を有効活用）
  const aspectRatio = W < C.MOBILE_BREAKPOINT ? C.HEATMAP_ASPECT_MOB : C.HEATMAP_ASPECT_DSK;
  const minH = W < C.MOBILE_BREAKPOINT ? C.HEATMAP_MINH_MOB : C.HEATMAP_MINH_DSK;
  // ビューポートベースの高さ計算：sticky-top + sim-bar + footer + body padding を差し引く
  const stickyEl = document.querySelector('.sticky-top');
  const simBarEl = document.querySelector('.sim-bar');
  const footerEl = wrap.closest('#panel-heatmap')?.querySelector('.footer');
  const stickyH  = stickyEl ? stickyEl.offsetHeight : 0;
  const simBarH  = simBarEl ? simBarEl.offsetHeight : 0;
  const footerH  = footerEl ? footerEl.offsetHeight : 0;
  const padBot   = parseFloat(getComputedStyle(document.body).paddingBottom) || 16;
  const viewH    = window.innerHeight - stickyH - simBarH - footerH - padBot - 4;
  const H = Math.max(minH, viewH > 100 ? viewH : Math.round(W * aspectRatio));

  const svg = d3.select('#heatmap').attr('width', W).attr('height', H);
  svg.selectAll('*').remove();

  // 2グループに統合：米国株・ETF / 日本株・ETF・投資信託
  const GROUP_DEFS = [
    { name: '米国株・ETF',           cats: ['米国株・ETF'] },
    { name: '日本株・ETF・投資信託', cats: ['日本株・ETF', '投資信託'] },
  ];
  const groups = GROUP_DEFS.map(g => ({
    name: g.name,
    children: positions.filter(p => g.cats.includes(p.cat))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))  // グループ内：円換算時価降順
      .map(p => ({ ...p, size: p.value ?? 0 }))
  })).filter(g => g.children.length > 0);
  // グループ自体も円換算合計の高い順に並べる
  groups.sort((a, b) =>
    b.children.reduce((s, c) => s + (c.size ?? 0), 0) -
    a.children.reduce((s, c) => s + (c.size ?? 0), 0)
  );
  const hierData = { name: 'root', children: groups };

  const root = d3.hierarchy(hierData).sum(d => d.size || 0);
  // モバイルは paddingOuter を 0 にして body の左右余白（10px）だけで統一
  d3.treemap().size([W, H]).paddingOuter(W < C.MOBILE_BREAKPOINT ? 0 : 6).paddingTop(20).paddingInner(4).tile(d3.treemapSquarify)(root);

  // Category backgrounds + labels
  root.children.forEach(catNode => {
    svg.append('rect')
      .attr('x', catNode.x0).attr('y', catNode.y0)
      .attr('width', catNode.x1 - catNode.x0).attr('height', catNode.y1 - catNode.y0)
      .attr('fill', cssVar('--cat-bg')).attr('rx', 8);
    svg.append('text').attr('class', 'cat-label')
      .attr('x', catNode.x0 + 6).attr('y', catNode.y0 + 5)
      .text(catNode.data.name);
  });

  // Leaf cells
  const cells = svg.selectAll('.cell-g').data(root.leaves()).enter().append('g').attr('class', 'cell-g');

  cells.append('rect')
    .attr('x', d => d.x0).attr('y', d => d.y0)
    .attr('width', d => Math.max(0, d.x1 - d.x0)).attr('height', d => Math.max(0, d.y1 - d.y0))
    .attr('rx', 7)
    .attr('data-ysymbol', d => d.data.ySymbol || '')   // フラッシュアニメーション用
    .attr('fill', d => getColor(getDisplayPct(d.data), state.colorMode === 'change' ? 'change' : 'pnl',
      state.colorMode === 'change' ? (PERIOD_MAP[state.changePeriod]?.scale ?? 25) : null));

  // Adaptive text labels  (保有金額はツールチップのみ・セルには非表示)
  cells.each(function(d) {
    const g = d3.select(this);
    const w = d.x1 - d.x0, h = d.y1 - d.y0;
    const cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2;
    const pct = getDisplayPct(d.data);
    const pctStr = pct !== null ? fmtPct(pct) : '―';
    if (w < 24 || h < 14) return;

    // セル背景色からテキスト色を決定（明るいセル→暗色、暗いセル→白）
    const cellBg = getColor(pct, state.colorMode === 'change' ? 'change' : 'pnl',
      state.colorMode === 'change' ? (PERIOD_MAP[state.changePeriod]?.scale ?? 25) : null);
    const symFill = getCellTextColor(cellBg);
    const pctFill = getCellTextColorSub(cellBg);

    // セル面積（sqrtスケール）でフォントサイズを滑らかに決定
    // セル幅でも上限を設ける（日本語など幅広文字がはみ出すのを防ぐ）
    const sqr  = Math.sqrt(w * h);
    const symSz = Math.min(C.SYM_FONT_MAX, Math.max(C.SYM_FONT_MIN, sqr * C.SYM_FONT_COEFF), Math.floor(w * 0.25));
    const pctSz = Math.min(C.PCT_FONT_MAX, Math.max(C.PCT_FONT_MIN, symSz * C.PCT_FONT_RATIO));
    const gap   = symSz * C.GAP_RATIO;

    if ((h >= 55 && w >= 44) || (h >= 30 && w >= 32)) {
      // 大・中セル: 銘柄名 + 変化率 縦2段
      g.append('text').attr('class','lbl-sym').attr('fill', symFill).attr('x',cx).attr('y',cy - gap * C.GAP_SYM_OFFSET)
        .attr('font-size', symSz).text(d.data.symbol);
      g.append('text').attr('class','lbl-pct').attr('fill', pctFill).attr('x',cx).attr('y',cy + gap * C.GAP_PCT_OFFSET)
        .attr('font-size', pctSz).text(pctStr);
    } else if (w >= 26 && h >= 16) {
      // 小セル: 銘柄名のみ
      g.append('text').attr('class','lbl-sym').attr('fill', symFill).attr('x',cx).attr('y',cy)
        .attr('font-size', symSz).text(d.data.symbol);
    }
  });

  renderStockList();

  // Interactions
  const tt = document.getElementById('tooltip');
  cells
    .on('mousemove', function(event, d) {
      const p = d.data;
      let html = `<div class="tt-hdr">${p.name} <span class="tt-sym">${p.symbol}</span></div>
        <div class="tt-row"><span class="tt-label">現在値</span><span class="tt-val">${fmtPrice(p.price, p.cur)}</span></div>
        <div class="tt-row"><span class="tt-label">平均取得単価</span><span class="tt-val">${fmtPrice(p.avgCost, p.cur)}</span></div>
        <div class="tt-row"><span class="tt-label">保有数</span><span class="tt-val">${p.shares.toLocaleString()}${p.cat==='投資信託'?' 口':' 株'}</span></div>
        <div class="tt-sep"></div>
        <div class="tt-row"><span class="tt-label">時価評価額</span><span class="tt-val">${fmtJPY(p.value)}</span></div>
        <div class="tt-row"><span class="tt-label">含み損益（円）</span><span class="tt-val ${sgn(p.pnl)}">${fmtJPYFull(p.pnl)}</span></div>
        <div class="tt-row"><span class="tt-label">損益率</span><span class="tt-val ${sgn(p.pnlPct)}">${fmtPct(p.pnlPct)}</span></div>`;
      if (p.dayPct !== null) html += `<div class="tt-sep"></div>
        <div class="tt-row"><span class="tt-label">前日比（円）</span><span class="tt-val ${sgn(p.dayCh)}">${fmtJPYFull(p.dayCh)}</span></div>
        <div class="tt-row"><span class="tt-label">前日比（%）</span><span class="tt-val ${sgn(p.dayPct)}">${fmtPct(p.dayPct)}</span></div>`;
      if (p.isProxy) html += `<div class="tt-hint" style="color:var(--text2)">📊 騰落率は代替インデックスで近似<br>${p.proxyName}</div>`;
      html += `<div class="tt-hint">クリックでチャートを表示</div>`;
      tt.innerHTML = html;
      tt.style.display = 'block';
      positionTooltip(event, tt);
    })
    .on('mouseleave', () => { tt.style.display = 'none'; })
    .on('click', (event, d) => {
      event.stopPropagation();
      tt.style.display = 'none';
      openChart(d.data);
    });
}

function positionTooltip(event, el) {
  const tx = event.clientX + 16, ty = event.clientY - 10;
  const w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = (tx + w > window.innerWidth - 10 ? event.clientX - w - 10 : tx) + 'px';
  el.style.top = (ty + h > window.innerHeight - 10 ? event.clientY - h - 10 : ty) + 'px';
}
