// ══════════════════════════════════════════════════════════════
// color.js  ―  色計算関数群（DOM / D3.js 依存）
// getColor は DOM 非依存のため fmt.js に定義し、ここで再エクスポート
// ══════════════════════════════════════════════════════════════

export { getColor } from './fmt.js';

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function _lum(c) {
  const lin = v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

function getCellTextColor(hexColor) {
  const c = d3.color(hexColor);
  if (!c) return cssVar('--text');
  return _lum(c) > 0.35 ? '#1C1C1E' : '#FFFFFF';
}

function getCellTextColorSub(hexColor) {
  const c = d3.color(hexColor);
  if (!c) return cssVar('--text3');
  return _lum(c) > 0.35 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.82)';
}

export { cssVar, getCellTextColor, getCellTextColorSub };
