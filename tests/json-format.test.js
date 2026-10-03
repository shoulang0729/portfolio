import { describe, it, expect } from 'vitest';

import { detectFormat, stringifyLike } from '../data/scheduler/lib/json-format.mjs';

// 合成データ（valuations.json と同じ形の最小例）
const DOC = {
  updated: '2026-01-02-auto-per',
  asOf: '2026-01-02',
  note: '合成テスト・日本語を含む',
  valuations: {
    AAA: { perCurrent: 12.3, bandLow: 10, bandHigh: 20, percentile: 23, status: 'cheap', asOf: '2026-01-02' },
    合成ファンド: { perCurrent: null, coverage: 0, components: [], status: 'na' },
  },
};

describe('detectFormat / stringifyLike', () => {
  it('1 スペース＋末尾改行：読み→無変更で書き がバイト一致', () => {
    const raw = `${JSON.stringify(DOC, null, 1)}\n`;
    const fmt = detectFormat(raw);
    expect(fmt).toEqual({ indent: 1, trailingNewline: true });
    expect(stringifyLike(JSON.parse(raw), fmt)).toBe(raw);
  });

  it('2 スペース＋末尾改行なし：読み→無変更で書き がバイト一致', () => {
    const raw = JSON.stringify(DOC, null, 2);
    const fmt = detectFormat(raw);
    expect(fmt).toEqual({ indent: 2, trailingNewline: false });
    expect(stringifyLike(JSON.parse(raw), fmt)).toBe(raw);
  });

  it('値を変えても書式（インデント・末尾改行）は保たれる', () => {
    const raw = `${JSON.stringify(DOC, null, 1)}\n`;
    const obj = JSON.parse(raw);
    obj.valuations.AAA.perCurrent = 13.1;
    const out = stringifyLike(obj, detectFormat(raw));
    expect(out).toBe(`${JSON.stringify(obj, null, 1)}\n`);
    expect(out.split('\n')[1]).toBe(' "updated": "2026-01-02-auto-per",');
  });

  it('タブ字下げ・1 行 JSON も再現する', () => {
    const tab = JSON.stringify(DOC, null, '\t');
    expect(stringifyLike(JSON.parse(tab), detectFormat(tab))).toBe(tab);
    const flat = JSON.stringify(DOC);
    expect(detectFormat(flat)).toEqual({ indent: 0, trailingNewline: false });
    expect(stringifyLike(JSON.parse(flat), detectFormat(flat))).toBe(flat);
  });
});
