import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { guardBlock, writeGuardedBlocks } from '../data/scheduler/lib/null-guard.mjs';
import { writeBlocks } from '../data/scheduler/writeback.mjs';

// 合成データのみ（実在の保有額・資産実額は含まない）。#652 PR6・設計書 §8.4.8 の観点 1〜10。
const FIXTURE = `{
  "updated": "2026-06-21",
  "valuations": {
    "AAA": {
      "perCurrent": 10.5,
      "bandLow": 8,
      "note": "テスト用ノート",
      "verdict": {
        "class": "na",
        "drivers": ["cyclical", "利益-14%YoY"]
      },
      "quality": {
        "roic": 6,
        "intCoverage": 80.2,
        "grossProf": null,
        "qScore": 4
      },
      "value": {
        "perTrail": 12.3,
        "targetGapPct": 4
      }
    },
    "BBB": {
      "perCurrent": 20.1,
      "note": "quality ブロック無し"
    },
    "CCC": {
      "perCurrent": 30,
      "staleFields": {
        "quality.roic": "2026-10-04",
        "value.perTrail": "2026-10-04"
      },
      "quality": {
        "roic": 5.5,
        "qScore": 3
      },
      "value": {
        "perTrail": 15.5,
        "perSource": "fund-trailing"
      }
    }
  }
}`;

const T1 = '2026-10-04';
const T2 = '2026-10-11';

let path;
const read = () => readFileSync(path, 'utf8');
const doc = () => JSON.parse(read());

beforeEach(() => {
  path = join(tmpdir(), `ng-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(path, FIXTURE, 'utf8');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  try {
    rmSync(path);
  } catch {
    // ignore
  }
});

describe('guardBlock（純関数）', () => {
  it('1. 新 null・既存非 null → 既存値保持＋印＝today', () => {
    const g = guardBlock({ roic: 6, qScore: 4 }, { roic: null, qScore: 5 }, undefined, 'quality', T1);
    expect(g.block).toEqual({ roic: 6, qScore: 5 });
    expect(g.stale).toEqual({ 'quality.roic': T1 });
    expect(g.kept).toEqual(['roic']);
    expect(g.recovered).toEqual([]);
  });

  it('2. 新 null・既存 null／既存ブロック無し → null・印なし', () => {
    const a = guardBlock({ roic: null }, { roic: null }, {}, 'quality', T1);
    expect(a.block).toEqual({ roic: null });
    expect(a.stale).toEqual({});
    const b = guardBlock(undefined, { roic: null, qScore: 2 }, undefined, 'quality', T1);
    expect(b.block).toEqual({ roic: null, qScore: 2 });
    expect(b.stale).toEqual({});
    expect(b.kept).toEqual([]);
  });

  it('3. 新非 null → 新値。既存の印は外す（他フィールド・他ブロックの印は残る）', () => {
    const g = guardBlock(
      { roic: 6, intCoverage: 80 },
      { roic: 7.2, intCoverage: null },
      { 'quality.roic': T1, 'quality.intCoverage': T1, 'value.perTrail': T1 },
      'quality',
      T2
    );
    expect(g.block).toEqual({ roic: 7.2, intCoverage: 80 });
    expect(g.stale).toEqual({ 'quality.intCoverage': T1, 'value.perTrail': T1 });
    expect(g.recovered).toEqual(['roic']);
    expect(g.kept).toEqual(['intCoverage']);
  });

  it('4. 連続 null → 日付は最初の観測日のまま', () => {
    const g = guardBlock({ roic: 6 }, { roic: null }, { 'quality.roic': T1 }, 'quality', T2);
    expect(g.block).toEqual({ roic: 6 });
    expect(g.stale).toEqual({ 'quality.roic': T1 });
  });

  it('5. 新ブロックにキーが無い（丸ごと置換）→ ガードしない（キーは消える）', () => {
    const g = guardBlock(
      { perTrail: 30, perFwd: 25, peg: 1.2 },
      { perTrail: 28, perSource: 'fund-trailing' },
      {},
      'value',
      T1
    );
    expect(g.block).toEqual({ perTrail: 28, perSource: 'fund-trailing' });
    expect(g.stale).toEqual({});
  });

  it('6. 新ブロック自体が null・既存がオブジェクト → 丸ごと保持＋非 null の全フィールドに印', () => {
    const g = guardBlock({ roic: 6, intCoverage: null, qScore: 4 }, null, {}, 'quality', T1);
    expect(g.block).toEqual({ roic: 6, intCoverage: null, qScore: 4 });
    expect(g.stale).toEqual({ 'quality.roic': T1, 'quality.qScore': T1 });
    expect(g.kept).toEqual(['roic', 'qScore']);
    // 既存ブロックも無ければ null をそのまま
    const n = guardBlock(undefined, null, {}, 'quality', T1);
    expect(n.block).toBeNull();
    expect(n.stale).toEqual({});
  });

  it('7. 派生値（qScore）は新値のまま', () => {
    const g = guardBlock(
      { roic: 6, intCoverage: 80.2, qScore: 4 },
      { roic: null, intCoverage: null, qScore: 5 },
      {},
      'quality',
      T1
    );
    expect(g.block.qScore).toBe(5);
  });
});

describe('writeGuardedBlocks（一時ファイル）', () => {
  it('1/7. 新 null は既存値保持・staleFields に today・派生値は新値', () => {
    const n = writeGuardedBlocks(
      path,
      { AAA: { roic: null, intCoverage: null, grossProf: null, qScore: 5 } },
      'quality',
      { today: T1 }
    );
    expect(n).toBe(1);
    const e = doc().valuations.AAA;
    expect(e.quality).toEqual({ roic: 6, intCoverage: 80.2, grossProf: null, qScore: 5 });
    expect(e.staleFields).toEqual({ 'quality.roic': T1, 'quality.intCoverage': T1 });
  });

  it('2. 既存ブロック無し → null を書く・印なし（staleFields を作らない）', () => {
    writeGuardedBlocks(path, { BBB: { roic: null, qScore: 2 } }, 'quality', { today: T1 });
    const e = doc().valuations.BBB;
    expect(e.quality).toEqual({ roic: null, qScore: 2 });
    expect(e.staleFields).toBeUndefined();
  });

  it('3/8. 回復で印を外す。他ブロックの印は残る。全回復で staleFields: {}', () => {
    writeGuardedBlocks(path, { CCC: { roic: 7.2, qScore: 3 } }, 'quality', { today: T2 });
    let e = doc().valuations.CCC;
    expect(e.quality.roic).toBe(7.2);
    expect(e.staleFields).toEqual({ 'value.perTrail': T1 });
    writeGuardedBlocks(path, { CCC: { perTrail: 16, perSource: 'fund-trailing' } }, 'value', { today: T2 });
    e = doc().valuations.CCC;
    expect(e.value.perTrail).toBe(16);
    expect(e.staleFields).toEqual({});
  });

  it('4. 連続 null で日付は最初の観測日のまま（staleFields は書き換えない）', () => {
    writeGuardedBlocks(path, { AAA: { roic: null, qScore: 5 } }, 'quality', { today: T1 });
    writeGuardedBlocks(path, { AAA: { roic: null, qScore: 6 } }, 'quality', { today: T2 });
    const e = doc().valuations.AAA;
    expect(e.quality.roic).toBe(6);
    expect(e.quality.qScore).toBe(6);
    expect(e.staleFields).toEqual({ 'quality.roic': T1 });
  });

  it('5. キーが無い丸ごと置換はガードしない', () => {
    writeGuardedBlocks(path, { AAA: { perTrail: 11, perSource: 'fund-trailing' } }, 'value', { today: T1 });
    const e = doc().valuations.AAA;
    expect(e.value).toEqual({ perTrail: 11, perSource: 'fund-trailing' });
    expect(e.staleFields).toBeUndefined();
  });

  it('6. 新ブロックが null → 既存ブロック丸ごと保持＋非 null の全フィールドに印', () => {
    writeGuardedBlocks(path, { AAA: null }, 'quality', { today: T1 });
    const e = doc().valuations.AAA;
    expect(e.quality).toEqual({ roic: 6, intCoverage: 80.2, grossProf: null, qScore: 4 });
    expect(e.staleFields).toEqual({
      'quality.roic': T1,
      'quality.intCoverage': T1,
      'quality.qScore': T1,
    });
  });

  it('8. 印が変わらない銘柄では staleFields を書かない（該当箇所がバイト一致）', () => {
    const before = read();
    const staleBefore = before.slice(
      before.indexOf('"staleFields"'),
      before.indexOf('"quality"', before.indexOf('"CCC"'))
    );
    // CCC: quality.roic は連続 null（印は既存のまま）、qScore だけ変化
    writeGuardedBlocks(path, { CCC: { roic: null, qScore: 9 } }, 'quality', { today: T2 });
    const after = read();
    const staleAfter = after.slice(after.indexOf('"staleFields"'), after.indexOf('"quality"', after.indexOf('"CCC"')));
    expect(staleAfter).toBe(staleBefore);
    expect(doc().valuations.CCC.quality).toEqual({ roic: 5.5, qScore: 9 });
    // 印の無い銘柄で null が出ない更新 → staleFields を作らない
    writeGuardedBlocks(path, { AAA: { roic: 6.5, intCoverage: 81, grossProf: null, qScore: 4 } }, 'quality', {
      today: T2,
    });
    expect(doc().valuations.AAA.staleFields).toBeUndefined();
  });

  it('9. JSON として妥当・対象外フィールド・インデント・インライン配列を保つ', () => {
    writeGuardedBlocks(path, { AAA: { roic: null, intCoverage: 90, grossProf: null, qScore: 5 } }, 'quality', {
      today: T1,
    });
    const raw = read();
    expect(() => JSON.parse(raw)).not.toThrow();
    const e = JSON.parse(raw).valuations.AAA;
    expect(e.bandLow).toBe(8);
    expect(e.note).toBe('テスト用ノート');
    expect(raw).toContain('"drivers": ["cyclical", "利益-14%YoY"]');
    expect(raw).toContain('\n      "staleFields": {\n        "quality.roic": "2026-10-04"\n      },');
    expect(raw).toContain('\n      "quality": {\n        "roic": 6,\n        "intCoverage": 90,');
    // 末尾改行の有無も保つ（フィクスチャは末尾改行なし）
    expect(raw.endsWith('}')).toBe(true);
  });

  it('10. staleFields がある状態で writeBlocks(..., quality) が "quality.roic" キーに誤ヒットしない', () => {
    // CCC は staleFields（"quality.roic" キー）が quality ブロックより前にある
    writeBlocks(path, { CCC: { roic: 1, qScore: 1 } }, 'quality');
    const e = doc().valuations.CCC;
    expect(e.quality).toEqual({ roic: 1, qScore: 1 });
    expect(e.staleFields).toEqual({ 'quality.roic': T1, 'value.perTrail': T1 });
    // quality ブロックが無いエントリでも staleFields 内のキーに当たらず、新規挿入になる
    writeFileSync(
      path,
      '{\n  "valuations": {\n    "DDD": {\n      "staleFields": {\n        "quality.roic": "2026-10-04"\n      },\n      "perCurrent": 1\n    }\n  }\n}',
      'utf8'
    );
    writeBlocks(path, { DDD: { roic: 2 } }, 'quality');
    const d = doc().valuations.DDD;
    expect(d.quality).toEqual({ roic: 2 });
    expect(d.staleFields).toEqual({ 'quality.roic': T1 });
  });

  it('エントリが無い銘柄は従来どおりスキップ（0 件）', () => {
    expect(writeGuardedBlocks(path, { ZZZ: { roic: null } }, 'quality', { today: T1 })).toBe(0);
  });

  it('null-guard のログはシンボル・フィールド名・日付のみ（値を出さない）', () => {
    writeGuardedBlocks(path, { AAA: { roic: null, qScore: 5 } }, 'quality', { today: T1 });
    const msgs = /** @type {any} */ (console.log).mock.calls.map((c) => String(c[0]));
    expect(msgs).toContain('  [null-guard] AAA quality.roic: null → 既存値を保持（stale since 2026-10-04）');
    const guardMsgs = msgs.filter((m) => m.includes('[null-guard]'));
    expect(guardMsgs).toEqual(['  [null-guard] AAA quality.roic: null → 既存値を保持（stale since 2026-10-04）']);
  });
});

// #665：ガード後のブロックが null のときは書かない（Toshio 決定 (a)）。writeback.mjs は変えない。
describe('writeGuardedBlocks：null ブロックを作らない（#665）', () => {
  // EEE：quality ブロック無し・後続に value ブロックあり（Issue の再現条件）。FFF：既存の null ブロック。
  const REPRO = `{
  "valuations": {
    "EEE": {
      "perCurrent": 12,
      "value": {
        "perTrail": 14.2,
        "targetGapPct": -3
      }
    },
    "FFF": {
      "perCurrent": 9,
      "quality": null,
      "value": {
        "perTrail": 8.8
      }
    }
  }
}
`;

  it('1. 既存ブロック無し＋新ブロック null → "quality": null を書かない（ファイル不変・0 件）', () => {
    const before = read();
    expect(writeGuardedBlocks(path, { BBB: null }, 'quality', { today: T1 })).toBe(0);
    expect(read()).toBe(before);
    const e = doc().valuations.BBB;
    expect('quality' in e).toBe(false);
    expect(e.staleFields).toBeUndefined();
  });

  it('2. 再現：null の次の実行で同じキーにオブジェクトを書いても後続の value ブロックは不変', () => {
    writeFileSync(path, REPRO, 'utf8');
    writeGuardedBlocks(path, { EEE: null }, 'quality', { today: T1 });
    expect('quality' in doc().valuations.EEE).toBe(false);

    const n = writeGuardedBlocks(path, { EEE: { roic: 4.1, qScore: 2 } }, 'quality', { today: T2 });
    expect(n).toBe(1);
    const e = doc().valuations.EEE;
    expect(e.quality).toEqual({ roic: 4.1, qScore: 2 });
    expect(e.value).toEqual({ perTrail: 14.2, targetGapPct: -3 });
    expect(e.perCurrent).toBe(12);
    expect(e.staleFields).toBeUndefined();
    // 隣の銘柄も不変
    expect(doc().valuations.FFF.quality).toBeNull();
    expect(doc().valuations.FFF.value).toEqual({ perTrail: 8.8 });
  });

  it('既存の null ブロック＋新ブロック null → そのまま残す（ファイル不変・後続ブロック不変）', () => {
    writeFileSync(path, REPRO, 'utf8');
    expect(writeGuardedBlocks(path, { FFF: null }, 'quality', { today: T1 })).toBe(0);
    expect(read()).toBe(REPRO);
  });

  it('3. 通常のオブジェクト書き込みは writeBlocks と同じ出力（形は変えない）', () => {
    const blocks = {
      AAA: { roic: 6.5, intCoverage: 81, grossProf: null, qScore: 4 },
      BBB: { roic: 3, qScore: 1 },
    };
    expect(writeGuardedBlocks(path, blocks, 'quality', { today: T1 })).toBe(2);
    const guardedRaw = read();
    writeFileSync(path, FIXTURE, 'utf8');
    writeBlocks(path, blocks, 'quality');
    expect(guardedRaw).toBe(read());
  });

  it('null とオブジェクトが混在 → null の銘柄だけ書かない', () => {
    const n = writeGuardedBlocks(path, { BBB: null, AAA: { roic: 7, qScore: 5 } }, 'quality', { today: T1 });
    expect(n).toBe(1);
    expect('quality' in doc().valuations.BBB).toBe(false);
    expect(doc().valuations.AAA.quality).toEqual({ roic: 7, qScore: 5 });
    expect(doc().valuations.AAA.value).toEqual({ perTrail: 12.3, targetGapPct: 4 });
  });
});
