// ══════════════════════════════════════════════════════════════
// heatmap.js  ―  D3 ツリーマップ描画
//
// 依存: state.js (state, C), utils.js (cssVar, getColor, getDisplayPct,
//        getCellTextColor, getCellTextColorSub, fmtPct, fmtPrice, fmtJPY,
//        fmtJPYFull, sgn), positions.js (positions, PERIOD_MAP)
// ══════════════════════════════════════════════════════════════

import { state, C } from './state.js';
import { positions, PERIOD_MAP } from './positions.js';
import { cssVar, getColor, getDisplayPct, getCellTextColor, getCellTextColorSub, fmtPct, fmtPctInt, fmtPrice, fmtJPY, fmtJPYFull, sgn, escapeHTML } from './utils.js';
import { renderHeatmapList } from './stock-list.js';
import { openChart } from './chart.js';

// ══════════════════════════════════════════════
// HEATMAP
// ══════════════════════════════════════════════
let _heatmapRetryCount = 0;
const HEATMAP_MAX_RETRY = 30;

function renderHeatmap() {
  if (typeof d3 === 'undefined') {
    console.warn('[heatmap] D3 not loaded');
    return;
  }
  // ヒートマップタブが非表示なら描画スキップ
  const panel = document.getElementById('panel-heatmap');
  if (panel?.hidden) return;

  const wrap = document.getElementById('heatmap-wrap');
  if (!wrap) return;
  const W = wrap.clientWidth;
  if (W === 0) {
    if (_heatmapRetryCount++ < HEATMAP_MAX_RETRY) {
      requestAnimationFrame(renderHeatmap);
    } else {
      console.warn('[heatmap] clientWidth=0 が継続 → 描画中止');
      _heatmapRetryCount = 0;
      if (wrap && typeof IntersectionObserver !== 'undefined') {
        const obs = new IntersectionObserver(entries => {
          if (entries[0]?.isIntersecting) {
            obs.disconnect();
            renderHeatmap();
          }
        });
        obs.observe(wrap);
      }
      if (!document.getElementById('heatmap-retry-msg')) {
        const el = document.createElement('p');
        el.id = 'heatmap-retry-msg';
        el.style.cssText = 'text-align:center;padding:16px;color:var(--text2);font-size:13px;';
        el.textContent = 'ヒートマップを表示できませんでした。再読み込みしてください。';
        wrap.appendChild(el);
      }
    }
    return;
  }
  _heatmapRetryCount = 0;
  const retryMsg = document.getElementById('heatmap-retry-msg');
  if (retryMsg) retryMsg.remove();
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

  const svg = d3.select('#heatmap')
    .style('display', 'block')
    .attr('width', W)
    .attr('height', H);
  svg.selectAll('*').remove();

  // 2グループに統合：米国株・ETF / 日本株・ETF・投資信託
  const GROUP_DEFS = [
    { key: 'us', name: '米国株・ETF' },
    { key: 'jp', name: '日本株・ETF・投資信託' },
  ];
  const groupKeyOf = p => {
    if (p.cat === '米国株・ETF') return 'us';
    if (p.cat === '日本株・ETF' || p.cat === '投資信託') return 'jp';
    // Imported/future data may have slightly different category labels.
    // Use stable market hints so a category mismatch cannot blank the heatmap.
    if (p.cur === 'USD' && !String(p.ySymbol || '').endsWith('.T')) return 'us';
    return 'jp';
  };
  const groups = GROUP_DEFS.map(g => ({
    name: g.name,
    children: positions.filter(p => groupKeyOf(p) === g.key)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))  // グループ内：円換算時価降順
      .map(p => ({ ...p, size: p.value ?? 0 }))
  })).filter(g => g.children.length > 0);
  if (groups.length === 0) {
    svg.append('text')
      .attr('x', W / 2)
      .attr('y', 32)
      .attr('fill', cssVar('--text2'))
      .attr('text-anchor', 'middle')
      .attr('font-size', 13)
      .text('表示できる保有銘柄がありません');
    renderHeatmapList();
    return;
  }
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
  (root.children || []).forEach(catNode => {
    svg.append('rect')
      .attr('x', catNode.x0).attr('y', catNode.y0)
      .attr('width', catNode.x1 - catNode.x0).attr('height', catNode.y1 - catNode.y0)
      .attr('fill', cssVar('--cat-bg')).attr('rx', 8);
    svg.append('text').attr('class', 'cat-label')
      .attr('x', catNode.x0 + 6).attr('y', catNode.y0 + 5)
      .text(catNode.data.name);
  });

  // Leaf cells
  const cells = svg.selectAll('.cell-g').data(root.leaves()).enter().append('g').attr('class', 'cell-g')
    .attr('role', 'img')
    .attr('aria-label', d => {
      const pct = getDisplayPct(d.data);
      return `${d.data.name} ${pct !== null ? fmtPctInt(pct) : 'データなし'}`;
    });

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

    // セル面積（sqrtスケール）でフォントサイズの「理想値」を決め、
    // 実描画後に getComputedTextLength() で計測 → はみ出すなら縮める。
    // → 文字数・字体・端末DPI差を heuristic 無しで吸収できる。
    const sqr = Math.sqrt(w * h);
    const idealSym = Math.min(C.SYM_FONT_MAX, Math.max(C.SYM_FONT_MIN, sqr * C.SYM_FONT_COEFF));
    const idealPct = Math.min(C.PCT_FONT_MAX, Math.max(C.PCT_FONT_MIN, idealSym * C.PCT_FONT_RATIO));
    const gap      = idealSym * C.GAP_RATIO;
    const innerW   = Math.max(w - 8, 12);   // 左右に 4px の余白

    // 描画してから実測幅を見て font-size を縮める。
    // SVG text の getComputedTextLength は同期的に取れる（attach 済みであれば）。
    const fitText = (textEl, idealSize) => {
      const node = textEl.node();
      if (!node) return;
      let measured = 0;
      try { measured = node.getComputedTextLength(); } catch { return; }
      if (measured <= innerW || measured === 0) return;
      const shrunk = Math.max(C.SYM_FONT_MIN, Math.floor(idealSize * innerW / measured));
      textEl.attr('font-size', shrunk);
    };

    if ((h >= 55 && w >= 44) || (h >= 30 && w >= 32)) {
      // 大・中セル: 銘柄名 + 変化率 縦2段
      const symEl = g.append('text').attr('class','lbl-sym').attr('fill', symFill)
        .attr('x',cx).attr('y',cy - gap * C.GAP_SYM_OFFSET)
        .attr('font-size', idealSym).text(d.data.symbol);
      fitText(symEl, idealSym);
      const pctEl = g.append('text').attr('class','lbl-pct').attr('fill', pctFill)
        .attr('x',cx).attr('y',cy + gap * C.GAP_PCT_OFFSET)
        .attr('font-size', idealPct).text(pctStr);
      fitText(pctEl, idealPct);
    } else if (w >= 26 && h >= 16) {
      // 小セル: 銘柄名のみ
      const symEl = g.append('text').attr('class','lbl-sym').attr('fill', symFill)
        .attr('x',cx).attr('y',cy)
        .attr('font-size', idealSym).text(d.data.symbol);
      fitText(symEl, idealSym);
    }
  });

  renderHeatmapList();

  // Interactions
  const tt = document.getElementById('tooltip');
  cells
    .on('mousemove', function(event, d) {
      const p = d.data;
      let html = `<div class="tt-hdr">${escapeHTML(p.name)} <span class="tt-sym">${escapeHTML(p.symbol)}</span></div>

        <div class="tt-row"><span class="tt-label">現在値</span><span class="tt-val">${fmtPrice(p.price, p.cur)}</span></div>
        <div class="tt-row"><span class="tt-label">平均取得単価</span><span class="tt-val">${fmtPrice(p.avgCost, p.cur)}</span></div>
        <div class="tt-row"><span class="tt-label">保有数</span><span class="tt-val">${p.shares.toLocaleString()}${p.cat==='投資信託'?' 口':' 株'}</span></div>
        <div class="tt-sep"></div>
        <div class="tt-row"><span class="tt-label">時価評価額</span><span class="tt-val">${fmtJPY(p.value)}</span></div>
        <div class="tt-row"><span class="tt-label">含み損益（円）</span><span class="tt-val ${sgn(p.pnl)}">${fmtJPYFull(p.pnl)}</span></div>
        <div class="tt-row"><span class="tt-label">損益率</span><span class="tt-val ${sgn(p.pnlPct)}">${fmtPct(p.pnlPct)}</span></div>`;
      if (p.dayPct !== null && p.dayCh != null) html += `<div class="tt-sep"></div>
        <div class="tt-row"><span class="tt-label">前日比（円）</span><span class="tt-val ${sgn(p.dayCh)}">${fmtJPYFull(p.dayCh)}</span></div>
        <div class="tt-row"><span class="tt-label">前日比（%）</span><span class="tt-val ${sgn(p.dayPct)}">${fmtPct(p.dayPct)}</span></div>`;
      if (p.isProxy) html += `<div class="tt-hint" style="color:var(--text2)">📊 騰落率は代替インデックスで近似<br>${escapeHTML(p.proxyName)}</div>`;

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
  el.style.left = `${tx + w > window.innerWidth - 10 ? event.clientX - w - 10 : tx  }px`;
  el.style.top = `${ty + h > window.innerHeight - 10 ? event.clientY - h - 10 : ty  }px`;
}

export { renderHeatmap, positionTooltip };
