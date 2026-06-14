// Tests for pure formatter functions in src/fmt.js

import { describe, it, expect } from 'vitest';
import { fmtJPYInt, fmtPctInt, fmtShares, escapeHTML, getColor as getColorFn, fmtYen, maskAmount } from '../src/fmt.js';

// ── fmtYen（1円単位・カンマ区切り・¥前置） ──────────────────────────
describe('fmtYen', () => {
  it('formats whole yen with thousands separators', () => {
    expect(fmtYen(524345245)).toBe('¥524,345,245');
    expect(fmtYen(0)).toBe('¥0');
    expect(fmtYen(1000)).toBe('¥1,000');
  });
  it('rounds and handles null/undefined safely', () => {
    expect(fmtYen(1234.6)).toBe('¥1,235');
    expect(fmtYen(null)).toBe('¥0');
    expect(fmtYen(undefined)).toBe('¥0');
  });
});

// ── maskAmount（数字のみ * 置換） ──────────────────────────────────
describe('maskAmount', () => {
  it('masks digits but keeps separators and symbols', () => {
    expect(maskAmount('¥524,345,245')).toBe('¥***,***,***');
    expect(maskAmount('¥0')).toBe('¥*');
    expect(maskAmount('10.6%')).toBe('**.*%');
  });
});

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
    expect(fmtJPYInt(100000000)).toBe('1.0億');
    expect(fmtJPYInt(120000000)).toBe('1.2億');
    expect(fmtJPYInt(123000000)).toBe('1.23億');
    expect(fmtJPYInt(1234000000)).toBe('12.34億');
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
    expect(getColorFn(null)).toBe('var(--null-cell)');
  });

  it('returns reddish rgb for positive', () => {
    const c = getColorFn(5, 'change');
    expect(c).toMatch(/^rgb\(/);
    const [r, g] = c.match(/\d+/g).map(Number);
    expect(r).toBeGreaterThan(g);
  });

  it('returns greenish rgb for negative', () => {
    const c = getColorFn(-5, 'change');
    expect(c).toMatch(/^rgb\(/);
    const [r, g] = c.match(/\d+/g).map(Number);
    expect(g).toBeGreaterThan(r);
  });

  it('clamps at scale boundary', () => {
    const full = getColorFn(100, 'change', 5);
    const clamped = getColorFn(50, 'change', 5);
    expect(full).toBe(clamped);
  });
});