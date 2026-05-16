// ══════════════════════════════════════════════════════════════
// utils.js  ―  フォーマッター・色ユーティリティ
//
// 依存: state.js (state), positions.js (PERIOD_MAP), D3.js
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════
// FORMATTERS
// ══════════════════════════════════════════════
/** 円建て評価額を「+1.2万」「-30.5万」形式にフォーマット */
const fmtJPY = v => {
  const m = v / 10000;
  return m.toFixed(1) + '万';
};
/** 円建て評価額を完全表示（例: +1,234,567円）*/
const fmtJPYFull = v => (v >= 0 ? '+' : '') + Math.round(v).toLocaleString() + '円';
/** 騰落率を「+1.23%」形式にフォーマット */
const fmtPct = v => v.toFixed(1) + '%';
/**
 * 現在値を通貨に応じてフォーマット
 * @param {number} v - 値
 * @param {'USD'|'JPY'} cur - 通貨
 */
const fmtPrice = (v, cur) => {
  if (v == null) return '―';
  return cur === 'USD' ? '$' + v.toFixed(2) : '¥' + Math.round(v).toLocaleString();
};
/** 数値の符号から CSS クラス名（'pos'|'neg'）を返す */
const sgn = v => v >= 0 ? 'pos' : 'neg';
/** 万円整数（カンマあり・符号付き）例: -1,234万 / 1億超は x.xx億形式  ※ stats バー・銘柄リスト共用 */
const fmtJPYInt = v => {
  const m = Math.round(v / 10000);
  const sign = m < 0 ? '-' : '';
  const abs = Math.abs(m);
  if (abs >= 10000) { const s = (abs / 10000).toFixed(2); return sign + (s.endsWith('0') ? (abs / 10000).toFixed(1) : s) + '億'; }
  return sign + abs.toLocaleString() + '万';
};
/** 整数パーセント  例: -12%  ※ stats バー・銘柄リスト共用 */
const fmtPctInt = v => Math.round(v) + '%';
/** 保有数を K/M 単位に変換（K=千=1,000、M=百万=1,000,000、小数第1位に四捨五入）
 *  例: 37870 → '37.9K'、31636296 → '31.6M'、175 → '175' */
const fmtShares = n => {
  if (n >= 1000000) {
    const v = Math.round(n / 100000) / 10;
    return v.toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (n >= 1000) {
    const v = Math.round(n / 100) / 10;
    return v.toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return n.toLocaleString();
};

// ══════════════════════════════════════════════
// CSS 変数読み取り
// ══════════════════════════════════════════════
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ══════════════════════════════════════════════
// COLOR
// ══════════════════════════════════════════════
/**
 * 騰落率または損益率からセルの背景色を返す（赤緑グラデーション）
 * @param {number|null} pct - 騰落率・損益率（%）
 * @param {'change'|'pnl'} mode - 表示モード
 * @returns {string} CSS カラー文字列
 */
function getColor(pct, mode, scaleOverride) {
  if (pct == null) return 'var(--null-cell)';
  const scale = scaleOverride != null ? scaleOverride : (mode === 'pnl' ? 50 : 5);
  const t = Math.max(-1, Math.min(1, pct / scale));
  if (t >= 0) {
    // 赤: #E8E8ED → #C62828（プラス=赤 ／ 日本株市場慣例）
    const r = Math.round(232 + t * (198-232));
    const g = Math.round(232 + t * (40-232));
    const b = Math.round(237 + t * (40-237));
    return `rgb(${r},${g},${b})`;
  } else {
    // 緑: #E8E8ED → #1B5E20（マイナス=緑）
    const r = Math.round(232 - (-t) * (232-27));
    const g = Math.round(232 - (-t) * (232-94));
    const b = Math.round(237 - (-t) * (237-32));
    return `rgb(${r},${g},${b})`;
  }
}

/**
 * 指定銘柄・期間の騰落率を履歴キャッシュから計算する
 */
function getHistoricalChangePct(symbol, periodId) {
  const cfg = PERIOD_MAP[periodId];
  if (!cfg) return null;
  const data = state.historicalCache[cfg.range]?.[symbol];
  if (!data || data.length < 2) return null;

  let startPoint;
  if (periodId === '1d') {
    // 営業日ベース: Yahoo Finance 日足は取引日のみなので末尾から2番目 = 直前取引日終値
    startPoint = data[data.length - 2];
  } else {
    const targetDate = new Date(Date.now() - cfg.days * 86400000);
    startPoint = null;
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].date <= targetDate) { startPoint = data[i]; break; }
    }
    if (!startPoint) startPoint = data[0];
  }

  const currentPrice = data[data.length - 1].close;
  return ((currentPrice - startPoint.close) / startPoint.close) * 100;
}

/**
 * ヒートマップセルの表示パーセントを返す（損益モード / 騰落率モード共通エントリ）
 */
function getDisplayPct(p) {
  if (state.colorMode === 'pnl') return p.pnlPct;
  if (!p.ySymbol) return null;
  if (state.changePeriod === '1d' && p.dayPct != null) return p.dayPct;  // != で undefined も除外
  return getHistoricalChangePct(p.ySymbol, state.changePeriod);
}

// ══════════════════════════════════════════════
// PORTFOLIO PERIOD PERFORMANCE
// ══════════════════════════════════════════════
function calcPortfolioPeriodPct(periodId) {
  let weightedSum = 0, totalWeight = 0;
  positions.forEach(p => {
    let pct = null;
    if (periodId === '1d' && p.dayPct !== null) {
      pct = p.dayPct;
    } else if (p.ySymbol) {
      pct = getHistoricalChangePct(p.ySymbol, periodId);
    }
    if (pct === null) return;
    weightedSum += p.value * pct;
    totalWeight  += p.value;
  });
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

// ══════════════════════════════════════════════
// CELL TEXT COLOR (セル明度に応じて自動切替)
// ══════════════════════════════════════════════

/** sRGB 値（0–255）1チャンネルを線形輝度に変換（IEC 61966-2-1） */
function _lum(c) {
  const lin = v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

function getCellTextColor(hexColor) {
  const c = d3.color(hexColor);
  if (!c) return cssVar('--text');
  // テーマに依存せずセルの明度だけで決定（ダークモードでも淡色セルは黒文字）
  return _lum(c) > 0.35 ? '#1C1C1E' : '#FFFFFF';
}
function getCellTextColorSub(hexColor) {
  const c = d3.color(hexColor);
  if (!c) return cssVar('--text3');
  return _lum(c) > 0.35 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.82)';
}

// ══════════════════════════════════════════════
// TABLE HELPERS  ―  stock-list / watchlist 共用
// ══════════════════════════════════════════════

/**
 * ソートヘッダーセル（<th>）を生成する
 * @param {string} label        - ヘッダー表示文字列（HTML可）
 * @param {string} col          - ソートキー（空文字ならクリック不可）
 * @param {string|null} align   - 'center' でセンター揃えクラスを付ける
 * @param {string} activeSortCol - 現在のソート列
 * @param {string} sortDir      - 'asc' | 'desc'
 * @param {string} sortFnName   - クリック時に呼ぶ関数名（例: 'slSort'）
 */
function makeTh(label, col, align, activeSortCol, sortDir, sortFnName) {
  const active   = col && activeSortCol === col;
  const sortCls  = active ? (sortDir === 'desc' ? 'sort-desc' : 'sort-asc') : '';
  const alignCls = align === 'center' ? 'sl-th-center' : '';
  const cls      = [sortCls, alignCls].filter(Boolean).join(' ');
  const dataCol  = col ? `data-col="${col}"` : '';
  const click    = (col && sortFnName) ? `onclick="${sortFnName}('${col}')"` : '';
  return `<th class="${cls}" ${dataCol} ${click}>${label}</th>`;
}

/**
 * 騰落率カラーセル（<td>）を生成する
 * @param {number|null} pct   - 騰落率 (%)
 * @param {number} scale      - 色スケール（PERIOD_MAP[id].scale）
 * @param {string} [dataCol]  - data-col 属性値（省略可）
 */
function makePctCell(pct, scale, dataCol = '') {
  const dataAttr = dataCol ? `data-col="${dataCol}" ` : '';
  if (pct == null) return `<td ${dataAttr}class="sl-pct-cell">–</td>`;
  const bg = getColor(pct, 'change', scale);
  const fg = getCellTextColor(bg);
  return `<td ${dataAttr}class="sl-pct-cell" style="background:${bg};color:${fg}">${fmtPctInt(pct)}</td>`;
}
