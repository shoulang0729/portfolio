// scripts/order-plan.mjs（注文表 plan の投入スクリプト・#675）と合成サンプルのテスト。
// 値はすべて合成値（docs/order-sheet/plan.example.json・架空ティッカー）。
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { validatePlan } from '../worker/src/order-plan.js';
import { UsageError, assertOutsideRepo, isInsideDir, main, summarizePlan } from '../scripts/order-plan.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const EXAMPLE_PATH = path.join(REPO_ROOT, 'docs', 'order-sheet', 'plan.example.json');
const example = JSON.parse(readFileSync(EXAMPLE_PATH, 'utf8'));

/** 標準出力に出してはいけない値（サンプルの金額・指値・株数・PIN ハッシュ） */
const SECRET_PIN = 'pinhash-synthetic-0000';
const FORBIDDEN = ['29808', '368', '40000', '320', '11500', '230', SECRET_PIN, '米ドル預り金', 'EXAMPLE証券'];

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('plan.example.json（合成サンプル）', () => {
  it('validatePlan を通る', () => {
    const v = validatePlan(example);
    expect(v.errors).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it('架空ティッカーだけを使う', () => {
    for (const sym of Object.keys(example.symbols)) expect(sym).toMatch(/^([A-Z])\1\1$/);
  });

  it('全 tier の例と sell "all" の例を含む', () => {
    const tiers = new Set(Object.values(example.symbols).map((s) => s.tier));
    expect([...tiers].sort()).toEqual(['exit', 'theme', 'thick', 'thin']);
    expect(example.symbols.DDD.stages[0]).toMatchObject({ side: 'sell', qty: 'all' });
  });
});

describe('isInsideDir / assertOutsideRepo', () => {
  it('配下と同一は内側・兄弟や親は外側', () => {
    expect(isInsideDir('/a/b/c.json', '/a/b')).toBe(true);
    expect(isInsideDir('/a/b', '/a/b')).toBe(true);
    expect(isInsideDir('/a/bc/x.json', '/a/b')).toBe(false);
    expect(isInsideDir('/a/x.json', '/a/b')).toBe(false);
  });

  it('リポ内のファイルを拒否する', () => {
    expect(() => assertOutsideRepo(EXAMPLE_PATH, { gitTop: () => null })).toThrow(UsageError);
    expect(() =>
      assertOutsideRepo('private/x.order-plan.json', { repoRoot: process.cwd(), gitTop: () => null })
    ).toThrow(/リポジトリ内/);
  });

  it('別の git 作業ツリー内のファイルを拒否する', () => {
    expect(() =>
      assertOutsideRepo('/somewhere/clone/x.json', { repoRoot: REPO_ROOT, gitTop: () => '/somewhere/clone' })
    ).toThrow(/git の作業ツリー/);
  });

  it('リポ外・作業ツリー外なら実体の絶対パスを返す', () => {
    const p = assertOutsideRepo('/outside/x.order-plan.json', { repoRoot: REPO_ROOT, gitTop: () => null });
    expect(p).toBe(path.resolve('/outside/x.order-plan.json'));
  });
});

describe('summarizePlan', () => {
  it('件数と rev だけを返す', () => {
    expect(summarizePlan({ ...example, rev: 3 })).toEqual({ symbols: 4, stages: 7, working: 4, rev: 3 });
    expect(summarizePlan(null)).toEqual({ symbols: 0, stages: 0, working: 0, rev: null });
  });
});

describe('main（tmp ディレクトリ・fetch はモック）', () => {
  let dir;
  let logs;
  const log = (s) => logs.push(s);
  const env = { MF_PIN_HASH: SECRET_PIN, WORKER_URL: 'https://worker.example.test/' };

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'order-plan-test-'));
    logs = [];
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function expectNoValues() {
    const out = logs.join('\n');
    for (const v of FORBIDDEN) expect(out).not.toContain(v);
  }

  it('引数不足は UsageError', async () => {
    await expect(main([], { log, validatePlan })).rejects.toBeInstanceOf(UsageError);
    await expect(main(['delete', 'x'], { log, validatePlan })).rejects.toBeInstanceOf(UsageError);
  });

  it('validate: 件数だけを出し値を出さない（通信しない）', async () => {
    const file = path.join(dir, 'a.order-plan.json');
    writeFileSync(file, JSON.stringify(example));
    const fetchImpl = vi.fn();
    await main(['validate', file], { env, fetchImpl, log, validatePlan });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(logs.join('\n')).toContain('銘柄 4');
    expectNoValues();
  });

  it('put: 検証を通してから PUT /order-sheet/plan を X-Pin-Hash 付きで呼ぶ', async () => {
    const file = path.join(dir, 'a.order-plan.json');
    writeFileSync(file, JSON.stringify(example));
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true, rev: 1, updatedAt: '2026-01-05T00:00:00Z' }));
    await main(['put', file], { env, fetchImpl, log, validatePlan });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://worker.example.test/order-sheet/plan');
    expect(init.method).toBe('PUT');
    expect(init.headers['X-Pin-Hash']).toBe(SECRET_PIN);
    expect(JSON.parse(init.body)).toEqual(example);
    expect(logs.join('\n')).toContain('rev 1');
    expectNoValues();
  });

  it('put: 不正な plan は送らない', async () => {
    const file = path.join(dir, 'bad.order-plan.json');
    writeFileSync(file, JSON.stringify({ ...example, schemaVersion: 99 }));
    const fetchImpl = vi.fn();
    await expect(main(['put', file], { env, fetchImpl, log, validatePlan })).rejects.toThrow(/plan が不正/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('put: MF_PIN_HASH が無ければ送らない', async () => {
    const file = path.join(dir, 'a.order-plan.json');
    writeFileSync(file, JSON.stringify(example));
    const fetchImpl = vi.fn();
    await expect(main(['put', file], { env: {}, fetchImpl, log, validatePlan })).rejects.toThrow(/MF_PIN_HASH/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('put: 409 は Worker の現在の rev を示す（値は出さない）', async () => {
    const file = path.join(dir, 'a.order-plan.json');
    writeFileSync(file, JSON.stringify({ ...example, rev: 2 }));
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'rev 不一致', rev: 5 }, 409));
    const err = await main(['put', file], { env, fetchImpl, log, validatePlan }).catch((e) => e);
    expect(err.message).toContain('409');
    expect(err.message).toContain('rev=5');
    for (const v of FORBIDDEN) expect(err.message).not.toContain(v);
  });

  it('put: 壊れた JSON はパースエラーの断片を出さない', async () => {
    const file = path.join(dir, 'broken.order-plan.json');
    writeFileSync(file, '{"symbols": {"AAA": 29808');
    const err = await main(['put', file], { env, fetchImpl: vi.fn(), log, validatePlan }).catch((e) => e);
    expect(err).toBeInstanceOf(UsageError);
    expect(err.message).not.toContain('29808');
  });

  it('get: リポ外に保存し件数だけを出す・既存ファイルは上書きしない', async () => {
    const file = path.join(dir, 'got.order-plan.json');
    const fetchImpl = vi.fn(async () => jsonResponse({ ...example, rev: 4 }));
    await main(['get', file], { env, fetchImpl, log });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe('GET');
    expect(init.headers['X-Pin-Hash']).toBe(SECRET_PIN);
    expect(JSON.parse(readFileSync(file, 'utf8')).rev).toBe(4);
    expect(logs.join('\n')).toContain('rev 4');
    expectNoValues();

    await expect(main(['get', file], { env, fetchImpl, log })).rejects.toThrow(/上書きしません/);
  });

  it('get: 未投入（null）ならファイルを作らない', async () => {
    const file = path.join(dir, 'none.order-plan.json');
    await main(['get', file], { env, fetchImpl: vi.fn(async () => jsonResponse(null)), log });
    expect(existsSync(file)).toBe(false);
    expect(logs.join('\n')).toContain('未投入');
  });
});
