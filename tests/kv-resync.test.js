// kv-resync.mjs（#715 PR3）: 通常モードは PUT せず POST /watchlist/resync → read-back。
// fs・Worker への fetch・git・タイマーはモック。値はすべて合成値（実在の評価・保有とは無関係）。
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

const VALS = {
  AAA: { perCurrent: 12.3, status: 'cheap', asOf: '2026-01-02', note: 'A' },
  BBB: { perCurrent: 30.1, status: 'rich', asOf: '2026-01-02' },
};
const VALS_NEWER = { ...VALS, AAA: { ...VALS.AAA, note: 'A2' } };

const HEAD = 'a'.repeat(40);
const NEWER = 'b'.repeat(40);
const OLDER = 'c'.repeat(40);

/** @param {Record<string, any>} vals */
const kvFrom = (vals) => [
  { key: 'k1', symbol: 'AAA', name: 'Alpha', valuation: { ...vals.AAA } },
  { key: 'k2', symbol: 'BBB', name: 'Beta', valuation: { ...vals.BBB } },
  { key: 'k3', symbol: 'ZZZ', name: 'Bond', valuation: { perCurrent: 1 } },
];
const kvDrifted = () => {
  const kv = kvFrom(VALS);
  kv[0].valuation = { ...VALS.AAA, note: 'old' };
  return kv;
};

/** @param {any} body @param {number} [status] */
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

/**
 * @param {object} o
 * @param {string[]} o.args CLI 引数
 * @param {any[][]} o.gets GET /watchlist の応答（配列）を順に。尽きたら最後を繰り返す
 * @param {Array<() => Response>} [o.posts] POST /watchlist/resync の応答を順に。尽きたら最後を繰り返す
 * @param {{head?: string | null, ancestor?: boolean | 'error', show?: Record<string, any>, fetchFails?: boolean}} [o.git]
 */
async function run({
  args,
  gets,
  posts = [() => json({ ok: true, stage: 'resynced', drift: 1, symbols: ['AAA'], sha: HEAD })],
  git = {},
}) {
  vi.resetModules();
  vi.doMock('fs', () => ({ readFileSync: () => JSON.stringify({ valuations: VALS }) }));

  let gi = 0;
  let pi = 0;
  const workerFetch = vi.fn(async (/** @type {string} */ path, /** @type {any} */ init = {}) => {
    if (path === '/watchlist' && !init.method) return json(gets[Math.min(gi++, gets.length - 1)]);
    if (path === '/watchlist/resync' && init.method === 'POST') return posts[Math.min(pi++, posts.length - 1)]();
    throw new Error(`unexpected ${init.method || 'GET'} ${path}`);
  });
  vi.doMock('../data/scheduler/lib/worker-client.mjs', () => ({ workerFetch }));

  const head = 'head' in git ? git.head : HEAD;
  const execFileSync = vi.fn((/** @type {string} */ _cmd, /** @type {string[]} */ a) => {
    if (a[0] === 'rev-parse') {
      if (!head) throw Object.assign(new Error('not a git repo'), { status: 128 });
      return `${head}\n`;
    }
    if (a[0] === 'fetch') {
      if (git.fetchFails) throw Object.assign(new Error('fetch failed'), { status: 128 });
      return '';
    }
    if (a[0] === 'merge-base') {
      if (git.ancestor === 'error') throw Object.assign(new Error('bad object'), { status: 128 });
      if (git.ancestor) return '';
      throw Object.assign(new Error('not ancestor'), { status: 1 });
    }
    if (a[0] === 'show') return JSON.stringify({ valuations: git.show || {} });
    throw new Error(`unexpected git ${a.join(' ')}`);
  });
  vi.doMock('child_process', () => ({ execFileSync }));

  const sleep = vi.fn(async () => {});
  vi.doMock('timers/promises', () => ({ setTimeout: sleep }));

  process.argv = ['node', 'kv-resync.mjs', ...args];
  /** @type {string[]} */
  const out = [];
  vi.spyOn(console, 'log').mockImplementation((s) => out.push(String(s)));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  /** @type {number[]} */
  const codes = [];
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    codes.push(Number(code));
    if (codes.length === 1) throw new Error('__exit__');
    return /** @type {never} */ (undefined);
  });

  await import('../data/scheduler/kv-resync.mjs');
  await vi.waitFor(() => expect(codes.length).toBeGreaterThan(0));
  const calls = workerFetch.mock.calls.map((c) => `${/** @type {any} */ (c)[1]?.method || 'GET'} ${c[0]}`);
  return { code: codes[0], json: JSON.parse(out[0]), calls, workerFetch, execFileSync, sleep };
}

const SHAPE = ['drift', 'msg', 'ok', 'stage', 'symbols'];
const posts = (/** @type {string} */ sha) => [
  () => json({ ok: true, stage: 'resynced', drift: 1, symbols: ['AAA'], sha }),
];

describe('kv-resync.mjs 通常モード（POST /watchlist/resync 経由・#715 PR3）', () => {
  const originalArgv = process.argv;
  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
    for (const m of ['fs', 'child_process', 'timers/promises', '../data/scheduler/lib/worker-client.mjs'])
      vi.doUnmock(m);
    vi.resetModules();
  });

  it('ズレ 0 → 同期要求を送らず noop・exit 0', async () => {
    const r = await run({ args: ['--json'], gets: [kvFrom(VALS)] });
    expect(r.code).toBe(0);
    expect(r.json).toMatchObject({ ok: true, stage: 'noop', drift: 0, symbols: [] });
    expect(r.calls).toEqual(['GET /watchlist']);
  });

  it('ズレあり → POST 1 回（本文なし・PUT なし）・read-back OK で resynced・exit 0', async () => {
    const r = await run({ args: ['--json'], gets: [kvDrifted(), kvFrom(VALS)] });
    expect(r.code).toBe(0);
    expect(r.json).toMatchObject({ ok: true, stage: 'resynced', drift: 1, symbols: ['AAA'] });
    expect(Object.keys(r.json).sort()).toEqual(SHAPE);
    expect(r.calls).toEqual(['GET /watchlist', 'POST /watchlist/resync', 'GET /watchlist']);
    const postInit = /** @type {any} */ (r.workerFetch.mock.calls[1])[1];
    expect(postInit.body).toBeUndefined();
    expect(r.calls.some((c) => c.startsWith('PUT'))).toBe(false);
    // SHA が手元 HEAD と同じなら git fetch しない
    expect(r.execFileSync.mock.calls.map((c) => /** @type {any} */ (c)[1][0])).toEqual(['rev-parse']);
  });

  it('Worker 5xx → 5 回リトライして put・exit 1（read-back しない）', async () => {
    const r = await run({ args: ['--json'], gets: [kvDrifted()], posts: [() => json({ error: 'x' }, 503)] });
    expect(r.code).toBe(1);
    expect(r.json).toMatchObject({ ok: false, stage: 'put', drift: 1, symbols: ['AAA'] });
    expect(r.json.msg).toContain('最終http=503');
    expect(Object.keys(r.json).sort()).toEqual(SHAPE);
    expect(r.calls.filter((c) => c === 'POST /watchlist/resync')).toHaveLength(5);
    expect(r.calls.filter((c) => c === 'GET /watchlist')).toHaveLength(1);
  });

  it('200 でも ok!==true なら失敗扱い（5 回）', async () => {
    const r = await run({ args: ['--json'], gets: [kvDrifted()], posts: [() => json({ ok: false })] });
    expect(r.code).toBe(1);
    expect(r.json.stage).toBe('put');
    expect(r.calls.filter((c) => c === 'POST /watchlist/resync')).toHaveLength(5);
  });

  it('同期後もズレが残る → readback-verify・exit 1', async () => {
    const r = await run({ args: ['--json'], gets: [kvDrifted(), kvDrifted()] });
    expect(r.code).toBe(1);
    expect(r.json).toMatchObject({ ok: false, stage: 'readback-verify', drift: 1, symbols: ['AAA'] });
  });

  it('read-back の GET が失敗 → readback-get・exit 1', async () => {
    const r = await run({ args: ['--json'], gets: [kvDrifted(), /** @type {any} */ ({ not: 'array' })] });
    expect(r.code).toBe(1);
    expect(r.json).toMatchObject({ ok: false, stage: 'readback-get' });
  });

  it('応答 sha が新しい（main が進んだ）→ その sha の正本で read-back を判定', async () => {
    const r = await run({
      args: ['--json'],
      gets: [kvDrifted(), kvFrom(VALS_NEWER)],
      posts: posts(NEWER),
      git: { ancestor: true, show: VALS_NEWER },
    });
    expect(r.code).toBe(0);
    expect(r.json).toMatchObject({ ok: true, stage: 'resynced' });
    const gitCalls = r.execFileSync.mock.calls.map((c) => /** @type {any} */ (c)[1].join(' '));
    expect(gitCalls).toContain('fetch --quiet --depth=50 origin main');
    expect(gitCalls).toContain(`merge-base --is-ancestor ${HEAD} ${NEWER}`);
    expect(gitCalls).toContain(`show ${NEWER}:data/valuations.json`);
  });

  it('応答 sha が古い → 15 秒待って 1 回ずつ再要求・4 回とも古ければ readback-verify・exit 1', async () => {
    const r = await run({
      args: ['--json'],
      gets: [kvDrifted(), kvFrom(VALS)],
      posts: posts(OLDER),
      git: { ancestor: false },
    });
    expect(r.code).toBe(1);
    expect(r.json).toMatchObject({ ok: false, stage: 'readback-verify' });
    expect(r.json.msg).toBe(`Worker が古い main を参照(${OLDER.slice(0, 7)})`);
    expect(r.json.msg).not.toContain(OLDER);
    expect(r.calls.filter((c) => c === 'POST /watchlist/resync')).toHaveLength(5);
    expect(r.sleep.mock.calls.filter((c) => /** @type {any} */ (c)[0] === 15_000)).toHaveLength(4);
    // read-back の GET はしない（比較先が決まらない）
    expect(r.calls.filter((c) => c === 'GET /watchlist')).toHaveLength(1);
  });

  it('応答 sha が古い → 再要求で HEAD に追いつけば手元の正本で判定・exit 0', async () => {
    const r = await run({
      args: ['--json'],
      gets: [kvDrifted(), kvFrom(VALS)],
      posts: [...posts(OLDER), ...posts(HEAD)],
      git: { ancestor: false },
    });
    expect(r.code).toBe(0);
    expect(r.json).toMatchObject({ ok: true, stage: 'resynced' });
    expect(r.calls.filter((c) => c === 'POST /watchlist/resync')).toHaveLength(2);
    expect(r.sleep.mock.calls.filter((c) => /** @type {any} */ (c)[0] === 15_000)).toHaveLength(1);
  });

  it('git fetch / merge-base が失敗 → 手元の正本と比較（ズレれば exit 1）', async () => {
    const ok = await run({
      args: ['--json'],
      gets: [kvDrifted(), kvFrom(VALS)],
      posts: posts(NEWER),
      git: { fetchFails: true },
    });
    expect(ok.code).toBe(0);
    vi.restoreAllMocks();
    const ng = await run({
      args: ['--json'],
      gets: [kvDrifted(), kvFrom(VALS_NEWER)],
      posts: posts(NEWER),
      git: { ancestor: 'error' },
    });
    expect(ng.code).toBe(1);
    expect(ng.json.stage).toBe('readback-verify');
  });

  it('git が無い（HEAD が取れない）→ SHA 判定を省き手元の正本と比較', async () => {
    const r = await run({
      args: ['--json'],
      gets: [kvDrifted(), kvFrom(VALS)],
      posts: posts(NEWER),
      git: { head: null },
    });
    expect(r.code).toBe(0);
    expect(r.execFileSync.mock.calls.map((c) => /** @type {any} */ (c)[1][0])).toEqual(['rev-parse']);
  });
});

describe('kv-resync.mjs --check は従来どおり（GET の比較だけ）', () => {
  const originalArgv = process.argv;
  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
    for (const m of ['fs', 'child_process', 'timers/promises', '../data/scheduler/lib/worker-client.mjs'])
      vi.doUnmock(m);
    vi.resetModules();
  });

  it('ズレあり → exit 3・POST も PUT もしない・git も呼ばない', async () => {
    const r = await run({ args: ['--json', '--check'], gets: [kvDrifted()] });
    expect(r.code).toBe(3);
    expect(r.json).toMatchObject({ ok: false, stage: 'check', drift: 1, symbols: ['AAA'] });
    expect(Object.keys(r.json).sort()).toEqual(SHAPE);
    expect(r.calls).toEqual(['GET /watchlist']);
    expect(r.execFileSync).not.toHaveBeenCalled();
  });

  it('完全一致 → exit 0', async () => {
    const r = await run({ args: ['--json', '--check'], gets: [kvFrom(VALS)] });
    expect(r.code).toBe(0);
    expect(r.json).toMatchObject({ ok: true, stage: 'check', drift: 0, symbols: [] });
    expect(r.calls).toEqual(['GET /watchlist']);
  });
});

describe('kv-resync.mjs のソース', () => {
  it("method: 'PUT' が残っていない・同期ルートを POST で呼ぶ", () => {
    const src = readFileSync(resolve(__dir, '../data/scheduler/kv-resync.mjs'), 'utf8');
    expect(src).not.toMatch(/method:\s*['"]PUT['"]/);
    expect(src).toMatch(/'\/watchlist\/resync'/);
    expect(src).toMatch(/method:\s*'POST'/);
  });

  it('stage の値の集合が変わらない', () => {
    const src = readFileSync(resolve(__dir, '../data/scheduler/kv-resync.mjs'), 'utf8');
    const stages = new Set([...src.matchAll(/stage:\s*'([a-z-]+)'/g)].map((m) => m[1]));
    expect([...stages].sort()).toEqual(
      [
        'check',
        'get',
        'noop',
        'put',
        'read-valuations',
        'readback-get',
        'readback-verify',
        'resynced',
        'unexpected',
      ].sort()
    );
  });
});
