import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeBlocks, writeQualityBlocks } from '../data/scheduler/writeback.mjs';

// 手書きのインライン配列・既存ブロックを含む最小フィクスチャ
const FIXTURE = `{
  "updated": "2026-06-21",
  "valuations": {
    "AAA": {
      "perCurrent": 10.5,
      "bandNote": "テスト用ノート",
      "verdict": {
        "class": "na",
        "drivers": ["cyclical", "利益-14%YoY"]
      },
      "quality": {
        "roic": 1.1,
        "qScore": 5
      }
    },
    "BBB": {
      "perCurrent": 20.1,
      "bandNote": "value ブロック無し"
    }
  }
}
`;

let path;

beforeEach(() => {
  path = join(tmpdir(), `wb-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(path, FIXTURE, 'utf8');
});

afterEach(() => {
  try {
    rmSync(path);
  } catch {
    // ignore
  }
});

describe('writeBlocks – quality 置換', () => {
  it('既存 quality ブロックを置換し、他は不変', () => {
    const n = writeBlocks(path, { AAA: { roic: 9.9, qScore: 8 } }, 'quality');
    expect(n).toBe(1);
    const doc = JSON.parse(readFileSync(path, 'utf8'));
    expect(doc.valuations.AAA.quality).toEqual({ roic: 9.9, qScore: 8 });
    // 他フィールド不変
    expect(doc.valuations.AAA.perCurrent).toBe(10.5);
    expect(doc.valuations.AAA.verdict.drivers).toEqual(['cyclical', '利益-14%YoY']);
  });

  it('writeQualityBlocks ラッパーも同じ挙動', () => {
    const n = writeQualityBlocks(path, { AAA: { roic: 2, qScore: 3 } });
    expect(n).toBe(1);
    expect(JSON.parse(readFileSync(path, 'utf8')).valuations.AAA.quality.qScore).toBe(3);
  });

  it('インライン配列を再整形しない（生テキストで1行のまま）', () => {
    writeBlocks(path, { AAA: { roic: 9.9, qScore: 8 } }, 'quality');
    const raw = readFileSync(path, 'utf8');
    expect(raw).toContain('"drivers": ["cyclical", "利益-14%YoY"]');
  });
});

describe('writeBlocks – value 挿入', () => {
  it('value ブロックが無いエントリに新規挿入する', () => {
    const n = writeBlocks(path, { BBB: { perTrail: 20.1, perSource: 'fund-trailing' } }, 'value');
    expect(n).toBe(1);
    const doc = JSON.parse(readFileSync(path, 'utf8'));
    expect(doc.valuations.BBB.value).toEqual({ perTrail: 20.1, perSource: 'fund-trailing' });
    expect(doc.valuations.BBB.perCurrent).toBe(20.1);
  });

  it('複数シンボルを一括処理（挿入＋別エントリは不変）', () => {
    const n = writeBlocks(path, { BBB: { cyclical: true } }, 'value');
    expect(n).toBe(1);
    const doc = JSON.parse(readFileSync(path, 'utf8'));
    expect(doc.valuations.BBB.value).toEqual({ cyclical: true });
    expect(doc.valuations.AAA.quality).toEqual({ roic: 1.1, qScore: 5 });
  });

  it('存在しないシンボルはスキップ（更新数に数えない）', () => {
    const n = writeBlocks(path, { ZZZ: { perTrail: 1 } }, 'value');
    expect(n).toBe(0);
  });
});
