// resyncWatchlistFromMain の単体テスト（#715 PR2・docs/handoff/2026-10-05-watchlist-resync-worker.md §4.2・§4.3・§4.7）
// fetch・KV はモック。すべて合成値・架空ティッカー（AAA / BBB / CCC）・架空トークン。

import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { resyncWatchlistFromMain } from '../worker/src/routes-kv.js';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const SHA_URL = 'https://api.github.com/repos/shoulang0729/portfolio/commits/main';
const REF_URL = 'https://api.github.com/repos/shoulang0729/portfolio/git/ref/heads/main';
const RAW_URL = `https://raw.githubusercontent.com/shoulang0729/portfolio/${SHA}/data/valuations.json`;
const TOKEN = 'synthetic-token-not-real';

const VAL_A = { perCurrent: 11.1, status: 'cheap', asOf: '2026-01-02', note: 'synthetic-a', bandConfidence: 0.42 };
const VAL_B = { perCurrent: 22.2, status: 'fair', asOf: '2026-01-02', sellProposal: [{ a: 1 }, { b: 2 }] };

function item(symbol, valuation) {
  const el = { symbol, name: `${symbol} Corp`, exchange: 'NASDAQ', type: 'stock', cur: 'USD' };
  return valuation === undefined ? el : { ...el, valuation };
}

/** get は呼ばれた順に values を返す（足りなければ最後の値を返し続ける） */
function makeKv(values) {
  const seq = Array.isArray(values) ? values : [values];
  let i = 0;
  return {
    get: vi.fn(async () => {
      const v = seq[Math.min(i, seq.length - 1)];
      i++;
      return v == null ? null : typeof v === 'string' ? v : JSON.stringify(v);
    }),
    put: vi.fn(async () => {}),
  };
}

function doc(valuations = { AAA: VAL_A, BBB: VAL_B }) {
  return JSON.stringify({ updatedAt: '2026-01-02', valuations });
}

/**
 * @param {{sha?: Array<Response|Error>, raw?: Array<Response|Error>, ref?: Array<Response|Error>}} plan URL ごとの応答の列
 */
function mockFetch({
  sha = [new Response(SHA)],
  raw = [new Response(doc())],
  ref = [new Response('', { status: 503 })],
} = {}) {
  let si = 0;
  let ri = 0;
  let fi = 0;
  const fn = vi.fn(async (url) => {
    const u = String(url);
    const pick = (arr, k) => arr[Math.min(k, arr.length - 1)];
    let r;
    if (u === SHA_URL) r = pick(sha, si++);
    else if (u === REF_URL) r = pick(ref, fi++);
    else if (u.startsWith('https://raw.githubusercontent.com/')) r = pick(raw, ri++);
    else throw new Error(`unexpected url ${u}`);
    if (r instanceof Error) throw r;
    return r.clone();
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const sleep = vi.fn(async () => {});
let logs;

beforeEach(() => {
  sleep.mockClear();
  logs = [];
  for (const k of ['log', 'warn', 'error', 'info', 'debug']) {
    vi.spyOn(console, k).mockImplementation((...a) => logs.push(a.map(String).join(' ')));
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const run = (env) => resyncWatchlistFromMain(env, { sleep });

describe('SHA の取得', () => {
  it('ヘッダ（sha 形式・UA・API バージョン・トークン）で読む・cache 指定なし', async () => {
    const f = mockFetch();
    await run({ KV: makeKv([null]), GH_DISPATCH_TOKEN: TOKEN, GITHUB_TOKEN: 'other-synthetic' });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(SHA_URL);
    expect(init.headers).toMatchObject({
      Accept: 'application/vnd.github.sha',
      'User-Agent': 'portfolio-proxy-worker',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${TOKEN}`,
    });
    expect(init.cache).toBeUndefined();
    expect(init.cf).toBeUndefined();
  });

  it('GH_DISPATCH_TOKEN が無ければ GITHUB_TOKEN・どちらも無ければ Authorization なし', async () => {
    let f = mockFetch();
    await run({ KV: makeKv([null]), GITHUB_TOKEN: TOKEN });
    expect(f.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    f = mockFetch();
    await run({ KV: makeKv([null]) });
    expect(f.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('5xx・429・ネットワークエラーは計 3 回まで（2s→4s）', async () => {
    const f = mockFetch({ sha: [new Response('', { status: 503 }), new TypeError('net'), new Response(SHA)] });
    const r = await run({ KV: makeKv([[item('AAA')]]) });
    expect(r.ok).toBe(true);
    expect(f.mock.calls.filter(([u]) => u === SHA_URL)).toHaveLength(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([2000, 4000]);
  });

  it('3 回とも 429 なら 502 stage=sha・正本を取りに行かない', async () => {
    const f = mockFetch({ sha: [new Response('', { status: 429 })] });
    const kv = makeKv([[item('AAA')]]);
    const r = await run({ KV: kv });
    expect(r).toMatchObject({ ok: false, status: 502, stage: 'sha', http: 429 });
    expect(f.mock.calls.filter(([u]) => u === SHA_URL)).toHaveLength(3);
    expect(f.mock.calls.filter(([u]) => u === REF_URL)).toHaveLength(1);
    expect(f).toHaveBeenCalledTimes(4);
    expect(kv.get).not.toHaveBeenCalled();
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('404 は再試行しない・40 桁の 16 進でなければ 502 stage=sha', async () => {
    let f = mockFetch({ sha: [new Response('', { status: 404 })] });
    expect(await run({ KV: makeKv([null]) })).toMatchObject({ ok: false, status: 502, stage: 'sha' });
    expect(f.mock.calls.filter(([u]) => u === SHA_URL)).toHaveLength(1);
    f = mockFetch({ sha: [new Response('ABCDEF' + '0'.repeat(34))] });
    expect(await run({ KV: makeKv([null]) })).toMatchObject({ ok: false, status: 502, stage: 'sha' });
  });
});

describe('SHA の取得: トークン拒否と予備経路（#748 の本番 502 の対策）', () => {
  it.each([401, 403])('トークン付きで %i → トークンなしで読み直して成功', async (code) => {
    const f = mockFetch({ sha: [new Response('', { status: code }), new Response(SHA)] });
    const r = await run({ KV: makeKv([[item('AAA')]]), GH_DISPATCH_TOKEN: TOKEN });
    expect(r).toMatchObject({ ok: true, stage: 'resynced', sha: SHA });
    const shaCalls = f.mock.calls.filter(([u]) => u === SHA_URL);
    expect(shaCalls).toHaveLength(2);
    expect(shaCalls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(shaCalls[1][1].headers.Authorization).toBeUndefined();
    expect(f.mock.calls.some(([u]) => u === REF_URL)).toBe(false);
    expect(logs).toContain(`[watchlist-resync] sha auth fallback http=${code}`);
    expect(logs.join('\n')).not.toContain(TOKEN);
  });

  it('トークンなしで 401 → 読み直さず 502 stage=sha http=401', async () => {
    const f = mockFetch({ sha: [new Response('', { status: 401 })] });
    const r = await run({ KV: makeKv([[item('AAA')]]) });
    expect(r).toMatchObject({ ok: false, status: 502, stage: 'sha', http: 401 });
    expect(f.mock.calls.filter(([u]) => u === SHA_URL)).toHaveLength(1);
    expect(logs.some((l) => l.includes('auth fallback'))).toBe(false);
  });

  it('トークンなしの読み直しも 401 なら 502 http=401（最後の上流ステータス）', async () => {
    const f = mockFetch({ sha: [new Response('', { status: 401 })] });
    const r = await run({ KV: makeKv([[item('AAA')]]), GH_DISPATCH_TOKEN: TOKEN });
    expect(r).toMatchObject({ ok: false, status: 502, stage: 'sha', http: 401 });
    expect(f.mock.calls.filter(([u]) => u === SHA_URL)).toHaveLength(2);
  });

  it('commits/main が取れなければ git/ref/heads/main（object.sha）をトークンなしで 1 回だけ使う', async () => {
    const f = mockFetch({
      sha: [new Response('', { status: 404 })],
      ref: [new Response(JSON.stringify({ ref: 'refs/heads/main', object: { sha: SHA, type: 'commit' } }))],
    });
    const r = await run({ KV: makeKv([[item('AAA')]]), GH_DISPATCH_TOKEN: TOKEN });
    expect(r).toMatchObject({ ok: true, stage: 'resynced', sha: SHA });
    const refCalls = f.mock.calls.filter(([u]) => u === REF_URL);
    expect(refCalls).toHaveLength(1);
    expect(refCalls[0][1].headers.Authorization).toBeUndefined();
    expect(f.mock.calls.map(([u]) => u)).toContain(RAW_URL);
  });

  it('予備経路も失敗（再試行しない）なら 502 stage=sha・http は commits/main のステータス', async () => {
    const f = mockFetch({ sha: [new Response('', { status: 404 })], ref: [new Response('', { status: 503 })] });
    const r = await run({ KV: makeKv([[item('AAA')]]) });
    expect(r).toMatchObject({ ok: false, status: 502, stage: 'sha', http: 404 });
    expect(f.mock.calls.filter(([u]) => u === REF_URL)).toHaveLength(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('予備経路の object.sha が不正なら使わない', async () => {
    mockFetch({ sha: [new Response('', { status: 404 })], ref: [new Response('{"object":{"sha":"xyz"}}')] });
    const r = await run({ KV: makeKv([[item('AAA')]]) });
    expect(r).toMatchObject({ ok: false, status: 502, stage: 'sha', http: 404 });
  });

  it('ネットワークエラーで終われば http=0', async () => {
    mockFetch({ sha: [new TypeError('net')], ref: [new TypeError('net')] });
    const r = await run({ KV: makeKv([[item('AAA')]]) });
    expect(r).toMatchObject({ ok: false, status: 502, stage: 'sha', http: 0 });
  });

  it('ルートの 502 応答に http（数値）が入り、トークンは出ない', async () => {
    const { default: worker } = await import('../worker/src/index.js');
    mockFetch({ sha: [new Response('', { status: 401 })] });
    const res = await worker.fetch(
      new Request('https://worker.example/watchlist/resync', { method: 'POST' }),
      { KV: makeKv([[item('AAA')]]), GH_DISPATCH_TOKEN: TOKEN },
      { waitUntil() {} }
    );
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: expect.any(String), stage: 'sha', http: 401 });
    expect([text, ...logs].join('\n')).not.toContain(TOKEN);
    expect(logs).toContain('[watchlist-resync] fail stage=sha http=401');
  });
});

describe('正本の取得（SHA 固定）', () => {
  it('raw の URL は SHA 固定で /main/ を含まない', async () => {
    const f = mockFetch();
    await run({ KV: makeKv([[item('AAA')]]) });
    const urls = f.mock.calls.map(([u]) => String(u));
    expect(urls).toEqual([SHA_URL, RAW_URL]);
    expect(urls.some((u) => u.includes('/main/'))).toBe(false);
  });

  it('404 → 502 stage=fetch・main へフォールバックしない・KV に触れない', async () => {
    const f = mockFetch({ raw: [new Response('nope', { status: 404 })] });
    const kv = makeKv([[item('AAA')]]);
    expect(await run({ KV: kv })).toMatchObject({ ok: false, status: 502, stage: 'fetch', http: 404 });
    expect(f).toHaveBeenCalledTimes(2);
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('5xx は計 3 回まで再試行し、成功すれば続ける', async () => {
    const f = mockFetch({ raw: [new Response('', { status: 500 }), new Response(doc())] });
    const r = await run({ KV: makeKv([[item('AAA')]]) });
    expect(r).toMatchObject({ ok: true, stage: 'resynced' });
    expect(f.mock.calls.filter(([u]) => u === RAW_URL)).toHaveLength(2);
  });

  it('2 MB 超 → 502 stage=fetch', async () => {
    const big = JSON.stringify({ valuations: { AAA: { note: 'x'.repeat(2 * 1024 * 1024) } } });
    mockFetch({ raw: [new Response(big)] });
    const kv = makeKv([[item('AAA')]]);
    expect(await run({ KV: kv })).toMatchObject({ ok: false, status: 502, stage: 'fetch' });
    expect(kv.put).not.toHaveBeenCalled();
  });

  it.each([
    ['JSON でない', '{oops', 'parse'],
    ['最上位が配列', '[]', 'validate'],
    ['valuations が無い', JSON.stringify({}), 'validate'],
    ['valuations が配列', JSON.stringify({ valuations: [VAL_A] }), 'validate'],
    ['valuations が空', JSON.stringify({ valuations: {} }), 'validate'],
    ['エントリが null', JSON.stringify({ valuations: { AAA: null } }), 'validate'],
    ['エントリが配列', JSON.stringify({ valuations: { AAA: [1] } }), 'validate'],
  ])('%s → 502 stage=%s・KV に書かない', async (_l, body, stage) => {
    mockFetch({ raw: [new Response(body)] });
    const kv = makeKv([[item('AAA')]]);
    expect(await run({ KV: kv })).toMatchObject({ ok: false, status: 502, stage });
    expect(kv.put).not.toHaveBeenCalled();
  });
});

describe('KV へのマージ', () => {
  it('ズレ 0 なら noop・KV に書かない', async () => {
    mockFetch();
    const kv = makeKv([[item('AAA', { ...VAL_A }), item('BBB', VAL_B)]]);
    // キー順が違っても一致（PR1 の全項目比較）
    const reordered = [item('AAA', Object.fromEntries(Object.entries(VAL_A).reverse())), item('BBB', VAL_B)];
    const kv2 = makeKv([reordered]);
    expect(await run({ KV: kv })).toEqual({ ok: true, stage: 'noop', drift: 0, symbols: [], sha: SHA });
    expect(await run({ KV: kv2 })).toEqual({ ok: true, stage: 'noop', drift: 0, symbols: [], sha: SHA });
    expect(kv.put).not.toHaveBeenCalled();
    expect(kv2.put).not.toHaveBeenCalled();
  });

  it('KV が無い・空なら noop（銘柄を足さない）', async () => {
    mockFetch();
    for (const v of [null, '', '[]']) {
      const kv = makeKv([v]);
      expect(await run({ KV: kv })).toMatchObject({ ok: true, stage: 'noop', drift: 0 });
      expect(kv.put).not.toHaveBeenCalled();
    }
  });

  it('ズレがあれば正本の銘柄だけ valuation を差し替える（他フィールド・並び・正本に無い銘柄は据え置き）', async () => {
    mockFetch();
    const before = [
      { ...item('CCC', { perCurrent: 1 }), extra: 'keep-c' },
      { ...item('AAA', { ...VAL_A, note: 'old' }), extra: 'keep-a' },
      item('BBB', VAL_B),
      item('DDD'),
    ];
    const kv = makeKv([before]);
    const r = await run({ KV: kv });
    expect(r).toEqual({ ok: true, stage: 'resynced', drift: 1, symbols: ['AAA'], sha: SHA });
    expect(kv.put).toHaveBeenCalledTimes(1);
    const [key, val] = kv.put.mock.calls[0];
    expect(key).toBe('watchlist');
    const after = JSON.parse(val);
    expect(after.map((e) => e.symbol)).toEqual(['CCC', 'AAA', 'BBB', 'DDD']);
    expect(after[0]).toEqual(before[0]);
    expect(after[1]).toEqual({ ...before[1], valuation: VAL_A });
    expect(after[2]).toEqual(before[2]);
    expect(after[3]).toEqual(before[3]);
  });

  it('valuation が無い銘柄も正本にあれば追加される', async () => {
    mockFetch();
    const kv = makeKv([[item('AAA'), item('BBB', VAL_B)]]);
    const r = await run({ KV: kv });
    expect(r).toMatchObject({ stage: 'resynced', symbols: ['AAA'] });
    expect(JSON.parse(kv.put.mock.calls[0][1])[0].valuation).toEqual(VAL_A);
  });

  it('書く直前の読み直しで KV が変わっていたら、読み直した内容でマージする', async () => {
    mockFetch();
    const first = [item('AAA')];
    const second = [item('BBB'), item('AAA', VAL_A), item('ZZZ')];
    const kv = makeKv([first, second, second]);
    const r = await run({ KV: kv });
    expect(r).toEqual({ ok: true, stage: 'resynced', drift: 1, symbols: ['BBB'], sha: SHA });
    expect(kv.get).toHaveBeenCalledTimes(3);
    const after = JSON.parse(kv.put.mock.calls[0][1]);
    expect(after.map((e) => e.symbol)).toEqual(['BBB', 'AAA', 'ZZZ']);
    expect(after[0].valuation).toEqual(VAL_B);
  });

  it('読み直しが 2 回とも違えば、その時点の内容でマージして書く', async () => {
    mockFetch();
    const third = [item('BBB'), item('CCC')];
    const kv = makeKv([[item('AAA')], [item('AAA'), item('CCC')], third]);
    const r = await run({ KV: kv });
    expect(r).toMatchObject({ ok: true, stage: 'resynced', symbols: ['BBB'] });
    expect(kv.get).toHaveBeenCalledTimes(3);
    expect(kv.put).toHaveBeenCalledTimes(1);
    expect(JSON.parse(kv.put.mock.calls[0][1]).map((e) => e.symbol)).toEqual(['BBB', 'CCC']);
  });

  it('読み直した内容にズレが無ければ noop', async () => {
    mockFetch();
    const kv = makeKv([[item('AAA')], [item('AAA', VAL_A)]]);
    expect(await run({ KV: kv })).toMatchObject({ ok: true, stage: 'noop', drift: 0 });
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('KV の watchlist が配列でなければ 500 stage=kv・書かない', async () => {
    mockFetch();
    for (const v of [{ AAA: 1 }, '{broken']) {
      const kv = makeKv([v]);
      expect(await run({ KV: kv })).toMatchObject({ ok: false, status: 500, stage: 'kv' });
      expect(kv.put).not.toHaveBeenCalled();
    }
  });

  it('KV 未設定なら 500・GitHub に問い合わせない', async () => {
    const f = mockFetch();
    expect(await run({})).toMatchObject({ ok: false, status: 500, stage: 'kv' });
    expect(f).not.toHaveBeenCalled();
  });

  it('watchlist 以外の KV キーに書かない', async () => {
    mockFetch();
    const kv = makeKv([[item('AAA')]]);
    await run({ KV: kv });
    expect(kv.put.mock.calls.map(([k]) => k)).toEqual(['watchlist']);
  });
});

describe('応答・ログに値・トークンを出さない', () => {
  it('ルートとしての成功・失敗で console と応答に KV の本文・正本の値・トークンが出ない', async () => {
    const { default: worker } = await import('../worker/src/index.js');
    const call = (env) =>
      worker.fetch(new Request('https://worker.example/watchlist/resync', { method: 'POST' }), env, { waitUntil() {} });
    const secrets = [TOKEN, 'synthetic-a', '11.1', '22.2', 'old-note-synthetic'];

    mockFetch();
    const ok = await call({ KV: makeKv([[item('AAA', { note: 'old-note-synthetic' })]]), GH_DISPATCH_TOKEN: TOKEN });
    const okText = await ok.text();

    mockFetch({ raw: [new Response(JSON.stringify({ valuations: [VAL_A] }))] });
    const ng = await call({ KV: makeKv([[item('AAA')]]), GH_DISPATCH_TOKEN: TOKEN });
    const ngText = await ng.text();

    mockFetch({ sha: [new Response('upstream says synthetic-a 11.1', { status: 404 })] });
    const ng2 = await call({ KV: makeKv([[item('AAA')]]), GH_DISPATCH_TOKEN: TOKEN });
    const ng2Text = await ng2.text();

    expect(ok.status).toBe(200);
    expect(ng.status).toBe(502);
    expect(ng2.status).toBe(502);
    const all = [okText, ngText, ng2Text, ...logs].join('\n');
    for (const s of secrets) expect(all).not.toContain(s);
    expect(logs.length).toBeGreaterThan(0);
  });
});

describe('kv-sync.mjs の共有（§4.3）', () => {
  it('Worker から import するため Node 専用の import が無い', () => {
    const src = readFileSync(new URL('../data/scheduler/lib/kv-sync.mjs', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from\s+['"]node:/);
    expect(src).not.toMatch(/from\s+['"](fs|path|child_process|os|url)['"]/);
    expect(src).not.toMatch(/require\(/);
  });

  it('routes-kv.js は kv-sync.mjs の findDrift・mergeValuations を import する（二重実装しない）', () => {
    const src = readFileSync(new URL('../worker/src/routes-kv.js', import.meta.url), 'utf8');
    expect(src).toMatch(
      /import\s*\{\s*findDrift,\s*mergeValuations\s*\}\s*from\s*'\.\.\/\.\.\/data\/scheduler\/lib\/kv-sync\.mjs'/
    );
  });
});
