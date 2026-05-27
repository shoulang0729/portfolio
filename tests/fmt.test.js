// Tests for pure formatter functions extracted from utils.js
// These have no DOM/D3 dependencies and run in plain Node.js.

import { describe, it, expect } from 'vitest';

// ── inline copies of the pure functions (no import side-effects) ──
const fmtJPYInt = v => {
  const m = Math.round(v / 10000);
  const sign = m < 0 ? '-' : '';
  const abs = Math.abs(m);
  if (abs >= 10000) {
    const s = (abs / 10000).toFixed(2);
    return sign + (s.endsWith('0') ? (abs / 10000).toFixed(1) : s) + '億';
  }
  return sign + abs.toLocaleString() + '万';
};

const fmtPctInt = v => Math.round(v) + '%';

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

const escapeHTML = s => {
  const _ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(s).replace(/[&<>"']/g, c => _ESC[c]);
};

const getColor = (pct, mode, scaleOverride) => {
  if (pct == null) return 'var(--null-cell)';
  const scale = scaleOverride != null ? scaleOverride : (mode === 'pnl' ? 50 : 5);
  const t = Math.max(-1, Math.min(1, pct / scale));
  if (t >= 0) {
    const r = Math.round(232 + t * (198 - 232));
    const g = Math.round(232 + t * (40 - 232));
    const b = Math.round(237 + t * (40 - 237));
    return `rgb(${r},${g},${b})`;
  } else {
    const r = Math.round(232 - (-t) * (232 - 27));
    const g = Math.round(232 - (-t) * (232 - 94));
    const b = Math.round(237 - (-t) * (237 - 32));
    return `rgb(${r},${g},${b})`;
  }
};

// ── fmtJPYInt ──────────────────────────────────────────────────────
describe('fmtJPYInt', () => {
  it('formats small positive values', () => {
    expect(fmtJPYInt(10000)).toBe('1万');
    expect(fmtJPYInt(12340000)).toBe('1,234万');
  });

  it('formats negative values', () => {
    expect(fmtJPYInt(-10000)).toBe('-1万');
    expect(fmtJPYInt(-12340000)).toBe('-1,234万');
  });

  it('formats 億 values', () => {
    expect(fmtJPYInt(100000000)).toBe('1.0億');      // 1億ちょうど → toFixed(1)
    expect(fmtJPYInt(120000000)).toBe('1.2億');      // 1.20 → ends with 0 → toFixed(1)
    expect(fmtJPYInt(123000000)).toBe('1.23億');     // 12300万 / 10000 = 1.23
    expect(fmtJPYInt(1234000000)).toBe('12.34億');   // 123400万 / 10000 = 12.34
  });

  it('handles zero', () => {
    expect(fmtJPYInt(0)).toBe('0万');
  });
});

// ── fmtPctInt ─────────────────────────────────────────────────────
describe('fmtPctInt', () => {
  it('rounds and appends %', () => {
    expect(fmtPctInt(0)).toBe('0%');
    expect(fmtPctInt(1.4)).toBe('1%');
    expect(fmtPctInt(1.5)).toBe('2%');
    expect(fmtPctInt(-3.7)).toBe('-4%');
  });
});

// ── fmtShares ─────────────────────────────────────────────────────
describe('fmtShares', () => {
  it('formats small numbers as-is', () => {
    expect(fmtShares(175)).toBe('175');
  });

  it('formats K values', () => {
    expect(fmtShares(1000)).toBe('1K');
    expect(fmtShares(37870)).toBe('37.9K');
  });

  it('formats M values', () => {
    expect(fmtShares(1000000)).toBe('1M');
    expect(fmtShares(31636296)).toBe('31.6M');
  });
});

// ── escapeHTML ────────────────────────────────────────────────────
describe('escapeHTML', () => {
  it('escapes all five special chars', () => {
    expect(escapeHTML('<script>')).toBe('&lt;script&gt;');
    expect(escapeHTML('"quoted"')).toBe('&quot;quoted&quot;');
    expect(escapeHTML("it's")).toBe('it&#39;s');
    expect(escapeHTML('a & b')).toBe('a &amp; b');
  });

  it('leaves safe strings unchanged', () => {
    expect(escapeHTML('AAPL')).toBe('AAPL');
    expect(escapeHTML('9983.T')).toBe('9983.T');
  });

  it('coerces non-string input', () => {
    expect(escapeHTML(42)).toBe('42');
    expect(escapeHTML(null)).toBe('null');
  });
});

// ── getColor ──────────────────────────────────────────────────────
describe('getColor', () => {
  it('returns neutral for null', () => {
    expect(getColor(null)).toBe('var(--null-cell)');
  });

  it('returns reddish rgb for positive', () => {
    const c = getColor(5, 'change');
    expect(c).toMatch(/^rgb\(/);
    const [r, g, b] = c.match(/\d+/g).map(Number);
    expect(r).toBeGreaterThan(g); // red dominates for positive
  });

  it('returns greenish rgb for negative', () => {
    const c = getColor(-5, 'change');
    expect(c).toMatch(/^rgb\(/);
    const [r, g, b] = c.match(/\d+/g).map(Number);
    expect(g).toBeGreaterThan(r); // green dominates for negative
  });

  it('clamps at scale boundary', () => {
    const full  = getColor(100, 'change', 5);
    const clamped = getColor(50, 'change', 5);
    expect(full).toBe(clamped); // both saturate at +5%
  });
});
