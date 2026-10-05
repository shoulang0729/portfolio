import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import { normValuation, findDrift, mergeValuations } from '../data/scheduler/lib/kv-sync.mjs';
import { isThrottledPath, isRetryableStatus } from '../data/scheduler/lib/worker-client.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));

// すべて合成値（実在の評価・保有とは無関係）
const VALS = {
  AAA: { perCurrent: 12.3, status: 'cheap', asOf: '2026-01-02', percentile: 20, bandLow: 10, bandHigh: 20 },
  BBB: { perCurrent: 30.1, status: 'rich', asOf: '2026-01-02', percentile: 90, bandLow: 15, bandHigh: 25 },
};

const kvSynced = () => [
  { key: 'k1', symbol: 'AAA', name: 'Alpha', exchange: 'X', cur: 'USD', type: 'stock', valuation: { ...VALS.AAA } },
  { key: 'k2', symbol: 'BBB', name: 'Beta', exchange: 'X', cur: 'JPY', type: 'etf', valuation: { ...VALS.BBB } },
  { key: 'k3', symbol: 'ZZZ', name: 'Bond', exchange: 'Y', cur: 'USD', type: 'bond', valuation: { perCurrent: 1 } },
];

describe('normValuation（#647: valuation 全体・キー順非依存）', () => {
  it('null / undefined は "null"', () => {
    expect(normValuation(null)).toBe('null');
    expect(normValuation(undefined)).toBe('null');
  });

  it('キーを再帰的に昇順へ並べた JSON 文字列（配列の順序はそのまま）', () => {
    expect(normValuation({ b: 1, a: { d: [2, 1], c: null } })).toBe('{"a":{"c":null,"d":[2,1]},"b":1}');
  });

  it('入れ子オブジェクトのキー順違いは同じ値になる', () => {
    const a = { perCurrent: 1, meta: { x: 1, y: { p: 1, q: 2 } }, list: [{ m: 1, n: 2 }] };
    const b = { list: [{ n: 2, m: 1 }], meta: { y: { q: 2, p: 1 }, x: 1 }, perCurrent: 1 };
    expect(normValuation(a)).toBe(normValuation(b));
  });

  it('入力を変更しない', () => {
    const v = { b: 1, a: { d: 1, c: 2 } };
    const snapshot = structuredClone(v);
    normValuation(v);
    expect(v).toEqual(snapshot);
    expect(Object.keys(v)).toEqual(['b', 'a']);
  });
});

describe('findDrift', () => {
  it('① 正本と同じなら drift 0', () => {
    expect(findDrift(kvSynced(), VALS)).toEqual([]);
  });

  it.each([
    ['perCurrent', 12.4],
    ['status', 'fair'],
    ['asOf', '2026-01-03'],
    ['percentile', 21],
    ['bandLow', 11],
    ['note', 'x'],
    ['bandConfidence', 'low'],
  ])('② %s が違えば（または KV にだけあれば）drift', (field, value) => {
    const kv = kvSynced();
    kv[0].valuation = { ...kv[0].valuation, [field]: value };
    expect(findDrift(kv, VALS)).toEqual(['AAA']);
  });

  it('② KV に valuation が無い銘柄（正本にはある）は drift', () => {
    const kv = kvSynced();
    delete kv[1].valuation;
    expect(findDrift(kv, VALS)).toEqual(['BBB']);
  });

  it('③ 正本に無い銘柄は drift に入らない', () => {
    const kv = kvSynced();
    kv[2].valuation = { perCurrent: 999, status: 'rich', asOf: '1999-01-01' };
    expect(findDrift(kv, VALS)).toEqual([]);
  });

  it('⑤ valuation 以外のフィールドの違いは drift にしない', () => {
    const kv = kvSynced();
    kv[0].name = 'Renamed';
    kv[0].cur = 'JPY';
    kv[1].exchange = 'Z';
    expect(findDrift(kv, VALS)).toEqual([]);
  });

  it('drift は KV の並び順で返す', () => {
    const kv = kvSynced();
    kv[0].valuation = null;
    kv[1].valuation = null;
    expect(findDrift(kv, VALS)).toEqual(['AAA', 'BBB']);
  });

  // 設計書 docs/handoff/2026-10-05-watchlist-resync-worker.md §13 の表（合成値）
  const BASE = { perCurrent: 12.3, status: 'cheap', asOf: '2026-01-02' };
  it.each([
    ['note だけ違う → ズレ', { ...BASE, note: 'A' }, { ...BASE, note: 'B' }, ['AAA']],
    ['キー順だけ違う → 一致', { asOf: '2026-01-02', status: 'cheap', perCurrent: 12.3 }, { ...BASE }, []],
    ['正本に無いキーが KV に残る → ズレ', { ...BASE, bandLow: 10 }, { ...BASE }, ['AAA']],
    [
      '配列の順序違い → ズレ',
      { ...BASE, sellProposal: [{ a: 1 }, { b: 2 }] },
      { ...BASE, sellProposal: [{ b: 2 }, { a: 1 }] },
      ['AAA'],
    ],
    ['KV に valuation 無し → ズレ', undefined, { ...BASE }, ['AAA']],
  ])('§13: %s', (_label, kvVal, want, expected) => {
    const kv = [{ key: 'k1', symbol: 'AAA', name: 'Alpha', valuation: kvVal }];
    expect(findDrift(kv, { AAA: want })).toEqual(expected);
  });

  it('入れ子オブジェクトのキー順違いは一致', () => {
    const want = { ...VALS.AAA, detail: { q: { y: 2, x: 1 }, p: 1 } };
    const kv = [{ symbol: 'AAA', valuation: { detail: { p: 1, q: { x: 1, y: 2 } }, ...VALS.AAA } }];
    expect(findDrift(kv, { AAA: want })).toEqual([]);
  });
});

describe('mergeValuations', () => {
  it('③ 正本に無い銘柄の要素は完全に元のまま（同一参照）', () => {
    const kv = kvSynced();
    const original = structuredClone(kv[2]);
    const merged = mergeValuations(kv, VALS);
    expect(merged[2]).toBe(kv[2]);
    expect(merged[2]).toEqual(original);
  });

  it('④ 配列・要素順・name など他フィールドを保持し valuation だけ差し替える', () => {
    const kv = kvSynced();
    kv[0].valuation = { perCurrent: 1, status: 'fair', asOf: '2025-12-31' };
    kv[1].valuation = undefined;
    const merged = mergeValuations(kv, VALS);
    expect(Array.isArray(merged)).toBe(true);
    expect(merged.map((e) => e.symbol)).toEqual(['AAA', 'BBB', 'ZZZ']);
    for (let i = 0; i < 2; i++) {
      const { valuation: _v, ...rest } = merged[i];
      const { valuation: _o, ...origRest } = kv[i];
      expect(rest).toEqual(origRest);
    }
    expect(merged[0].valuation).toEqual(VALS.AAA);
    expect(merged[1].valuation).toEqual(VALS.BBB);
    expect(findDrift(merged, VALS)).toEqual([]);
  });

  it('入力配列を変更しない', () => {
    const kv = kvSynced();
    kv[0].valuation = null;
    const snapshot = structuredClone(kv);
    mergeValuations(kv, VALS);
    expect(kv).toEqual(snapshot);
  });
});

describe('kv-sync.mjs は Node 専用の import を持たない（Worker からも import する）', () => {
  it('fs / node: / path / url 等を import していない', () => {
    const src = readFileSync(resolve(__dir, '../data/scheduler/lib/kv-sync.mjs'), 'utf8');
    expect(src).not.toMatch(/from\s+['"]node:/);
    expect(src).not.toMatch(/from\s+['"](fs|path|url|child_process|os|crypto)['"]/);
    expect(src).not.toMatch(/\brequire\(/);
    expect(src).not.toMatch(/^\s*import\s/m);
  });
});

// kv-resync.mjs を --json --check で通す（正本の読み込みと Worker への fetch はモック・合成値）
describe('kv-resync.mjs --check（findDrift の全項目比較を経由）', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
    vi.doUnmock('fs');
    vi.doUnmock('../data/scheduler/lib/worker-client.mjs');
    vi.resetModules();
  });

  /**
   * @param {any} valuations 正本（合成値）
   * @param {any[]} kvArray GET /watchlist の応答（合成値）
   */
  async function runCheck(valuations, kvArray) {
    vi.resetModules();
    vi.doMock('fs', () => ({ readFileSync: () => JSON.stringify({ valuations }) }));
    const workerFetch = vi.fn(async () => new Response(JSON.stringify(kvArray), { status: 200 }));
    vi.doMock('../data/scheduler/lib/worker-client.mjs', () => ({ workerFetch }));
    process.argv = ['node', 'kv-resync.mjs', '--json', '--check'];

    /** @type {string[]} */
    const out = [];
    vi.spyOn(console, 'log').mockImplementation((s) => out.push(String(s)));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    /** @type {number[]} */
    const codes = [];
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      codes.push(Number(code));
      // 最初の exit で main を止める（以降の呼び出しは記録のみ）
      if (codes.length === 1) throw new Error('__exit__');
      return /** @type {never} */ (undefined);
    });

    await import('../data/scheduler/kv-resync.mjs');
    await vi.waitFor(() => expect(codes.length).toBeGreaterThan(0));
    return { code: codes[0], json: JSON.parse(out[0]), workerFetch };
  }

  it('note だけ違う銘柄 → drift として exit 3（PUT しない）', async () => {
    const want = { AAA: { ...VALS.AAA, note: 'B' }, BBB: VALS.BBB };
    const kv = kvSynced();
    kv[0].valuation = { ...VALS.AAA, note: 'A' };
    const { code, json, workerFetch } = await runCheck(want, kv);
    expect(code).toBe(3);
    expect(json).toMatchObject({ ok: false, stage: 'check', drift: 1, symbols: ['AAA'] });
    expect(Object.keys(json).sort()).toEqual(['drift', 'msg', 'ok', 'stage', 'symbols']);
    expect(workerFetch).toHaveBeenCalledTimes(1);
    expect(workerFetch.mock.calls.every((c) => !(/** @type {any[]} */ (c)[1]?.method))).toBe(true);
  });

  it('完全一致（キー順だけ違う）→ exit 0', async () => {
    const kv = kvSynced();
    kv[0].valuation = Object.fromEntries(Object.entries(VALS.AAA).reverse());
    const { code, json } = await runCheck(VALS, kv);
    expect(code).toBe(0);
    expect(json).toMatchObject({ ok: true, stage: 'check', drift: 0, symbols: [] });
  });
});

describe('worker-client helpers', () => {
  it('レート制限対象パスだけスロットルする（/watchlist は対象外）', () => {
    expect(isThrottledPath('/yahoo?url=x')).toBe(true);
    expect(isThrottledPath('/finnhub?path=/quote')).toBe(true);
    expect(isThrottledPath('/fmp/ratios')).toBe(true);
    expect(isThrottledPath('/edgar')).toBe(true);
    expect(isThrottledPath('/edinet-db?x=1')).toBe(true);
    expect(isThrottledPath('/watchlist')).toBe(false);
    expect(isThrottledPath('/yahoox')).toBe(false);
  });

  it('429 と 5xx だけリトライ対象', () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(200)).toBe(false);
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });
});
