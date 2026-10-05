import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

import {
  COMMIT_PREFIX,
  dailyPerCommitMessage,
  runMode,
  isPushBlocked,
  findDisallowedChanges,
  deepEqual,
  countWatchlistUpdated,
  hasWatchlistUpdates,
  isAlreadyWritten,
  isOnTimeStart,
  writtenSinceIso,
  alreadyWrittenLogArgs,
  parseCommitLog,
} from '../data/scheduler/lib/per-daily.mjs';
import { score, FUND_SOURCE } from '../data/scheduler/lib/per-calc.mjs';
import { detectFormat, stringifyLike } from '../data/scheduler/lib/json-format.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const WORKFLOW = readFileSync(resolve(__dir, '../.github/workflows/per-daily.yml'), 'utf8');

// すべて合成値（実在の銘柄・評価とは無関係）。
const at = (hhmm) => new Date(`2026-01-10T${hhmm}:00.000Z`);

describe('dailyPerCommitMessage（§6.2 固定形式）', () => {
  it('`data: daily PER <YYYY-MM-DD>` に完全一致する', () => {
    expect(dailyPerCommitMessage('2026-10-03')).toBe('data: daily PER 2026-10-03');
    expect(COMMIT_PREFIX).toBe('data: daily PER ');
  });
  it('日付が YYYY-MM-DD でなければ例外', () => {
    for (const bad of ['2026-10-3', '20261003', '2026/10/03', '', undefined, null, '2026-10-03 ']) {
      expect(() => dailyPerCommitMessage(bad)).toThrow();
    }
  });
});

// #708 PR3（2026-10-05-per-daily-dispatch.md §3.3・§4.3(a)）。夏＝2026-10-05、冬＝2026-11-02・2026-01-10。
describe('runMode（引け前と 21:45〜22:59 UTC は計算のみ・#708 PR3 §3.3）', () => {
  it.each([
    // 夏（引け 20:00）
    ['2026-10-05T19:59:00Z', 'compute-only'],
    ['2026-10-05T20:00:00Z', 'write'],
    ['2026-10-05T20:20:00Z', 'write'],
    ['2026-10-05T20:55:00Z', 'write'],
    ['2026-10-05T21:44:00Z', 'write'],
    ['2026-10-05T21:45:00Z', 'compute-only'],
    ['2026-10-05T21:47:00Z', 'compute-only'],
    ['2026-10-05T22:30:00Z', 'compute-only'],
    ['2026-10-05T22:31:00Z', 'compute-only'],
    ['2026-10-05T22:59:00Z', 'compute-only'],
    ['2026-10-05T23:00:00Z', 'write'],
    ['2026-10-05T23:03:00Z', 'write'],
    ['2026-10-05T23:59:00Z', 'write'],
    ['2026-10-05T00:00:00Z', 'compute-only'],
    ['2026-10-06T09:00:00Z', 'compute-only'],
    // 冬（引け 21:00）
    ['2026-11-02T20:16:00Z', 'compute-only'],
    ['2026-11-02T20:59:00Z', 'compute-only'],
    ['2026-11-02T21:00:00Z', 'write'],
    ['2026-11-02T21:20:00Z', 'write'],
    ['2026-11-02T21:44:00Z', 'write'],
    ['2026-11-02T21:45:00Z', 'compute-only'],
    ['2026-11-02T22:59:00Z', 'compute-only'],
    ['2026-11-02T23:00:00Z', 'write'],
    ['2026-01-10T20:15:00Z', 'compute-only'],
    ['2026-01-10T21:20:00Z', 'write'],
    // DST の切替日の前後
    ['2026-10-31T20:20:00Z', 'write'],
    ['2026-11-01T20:20:00Z', 'compute-only'],
    ['2026-11-01T21:20:00Z', 'write'],
    ['2027-03-13T20:20:00Z', 'compute-only'],
    ['2027-03-14T20:20:00Z', 'write'],
  ])('%s → %s（force なし）', (iso, mode) => {
    expect(runMode(new Date(iso))).toBe(mode);
    expect(runMode(new Date(iso), {})).toBe(mode);
    expect(runMode(new Date(iso), { force: false })).toBe(mode);
  });

  it.each([
    // 引け前は force なら write
    ['2026-10-06T09:00:00Z', 'write'],
    ['2026-10-05T19:59:00Z', 'write'],
    ['2026-11-02T20:59:00Z', 'write'],
    ['2026-10-05T00:00:00Z', 'write'],
    // 引け〜21:44・23:00〜は force でも同じ
    ['2026-10-05T20:20:00Z', 'write'],
    ['2026-11-02T21:44:00Z', 'write'],
    ['2026-10-05T23:00:00Z', 'write'],
    // Mulmo の時間帯は force でも書かない
    ['2026-10-05T21:45:00Z', 'compute-only'],
    ['2026-10-05T22:00:00Z', 'compute-only'],
    ['2026-11-02T22:00:00Z', 'compute-only'],
    ['2026-10-05T22:59:00Z', 'compute-only'],
  ])('%s → %s（force=true）', (iso, mode) => {
    expect(runMode(new Date(iso), { force: true })).toBe(mode);
  });
});

describe('isPushBlocked（21:50〜22:59 UTC は push しない・#708 PR3 §3.3）', () => {
  it.each([
    ['20:15', false],
    ['21:00', false],
    ['21:21', false],
    ['21:49', false],
    ['21:50', true],
    ['22:00', true],
    ['22:30', true],
    ['22:59', true],
    ['23:00', false],
    ['00:00', false],
  ])('%s UTC → %s（夏・冬とも同じ）', (hhmm, blocked) => {
    expect(isPushBlocked(new Date(`2026-10-05T${hhmm}:00.000Z`))).toBe(blocked);
    expect(isPushBlocked(at(hhmm))).toBe(blocked);
  });
});

describe('deepEqual', () => {
  it('キー順は問わず、値・配列順・型の違いは検出する', () => {
    expect(deepEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(deepEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(deepEqual({ a: null }, { a: 0 })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(deepEqual([], {})).toBe(false);
  });
});

// ── watchlist-per --write / fund-per --write と同じ更新を合成データに適用して検査する ──
const T = '2026-01-10';

function syntheticDoc() {
  return {
    updated: '2026-01-09-briefing',
    asOf: '2026-01-09',
    note: '合成データ',
    valuations: {
      AAA: {
        value: { perTrail: 1 },
        perCurrent: 20,
        bandLow: 10,
        bandHigh: 30,
        bandMedian: 20,
        percentile: 50,
        status: 'fair',
        note: 'Mulmo が書くメモ',
        asOf: '2026-01-09',
        sellProposal: null,
      },
      BBB: { perCurrent: null, bandLow: 12, bandHigh: 18, percentile: null, status: 'hold', asOf: '2026-01-01' },
      ファンドX: {
        perCurrent: 15,
        coverage: 0.4,
        source: FUND_SOURCE,
        asOf: '2025-12',
        components: [{ code: 'C1', name: 'c1', w: 0.4, per: 15 }],
        status: 'na',
        percentile: null,
        note: 'Mulmo のメモ',
        sellProposal: null,
      },
    },
  };
}

/** watchlist-per.mjs --write の更新（原本どおりの spread）を再現 */
function applyWatchlistWrite(store, sym, per) {
  const v = store.valuations[sym];
  const s = score(per, v.bandLow, v.bandHigh);
  store.valuations[sym] = { ...v, perCurrent: per, percentile: s.percentile, status: s.status, asOf: T };
  store.updated = `${T}-auto-per`;
  store.asOf = T;
}

/** fund-per.mjs --write の追加マージ（原本どおり）を再現 */
function applyFundWrite(store, sym, e) {
  const prev = store.valuations[sym] || {};
  store.valuations[sym] = { ...prev, ...e, status: prev.status || 'na' };
}

describe('findDisallowedChanges（§6.3 の許可フィールドのみ）', () => {
  it('watchlist-per / fund-per の書き込みだけなら許可外の変更は 0', () => {
    const before = syntheticDoc();
    const after = structuredClone(before);
    applyWatchlistWrite(after, 'AAA', 25.5);
    applyWatchlistWrite(after, 'BBB', 13);
    applyFundWrite(after, 'ファンドX', {
      perCurrent: 16.2,
      coverage: 0.38,
      source: FUND_SOURCE,
      asOf: '2025-12',
      components: [{ code: 'C1', name: 'c1', w: 0.38, per: 16.2 }],
    });
    expect(findDisallowedChanges(before, after)).toEqual([]);
    // 実際に値が変わっていること（検査が空振りしていない）
    expect(after.valuations.AAA.percentile).toBe(78);
    expect(after.valuations.AAA.status).toBe('rich');
    expect(after.valuations.AAA.note).toBe('Mulmo が書くメモ');
    expect(after.valuations['ファンドX'].status).toBe('na');
  });

  it('無変更なら空', () => {
    expect(findDisallowedChanges(syntheticDoc(), syntheticDoc())).toEqual([]);
  });

  it('銘柄の bandLow / note など Mulmo のフィールドの変更を検出する', () => {
    const before = syntheticDoc();
    const after = structuredClone(before);
    after.valuations.AAA.bandLow = 11;
    after.valuations.AAA.note = '変更';
    after.valuations.AAA.sellProposal = { x: 1 };
    expect(findDisallowedChanges(before, after)).toEqual([
      { entry: 'AAA', field: 'bandLow' },
      { entry: 'AAA', field: 'note' },
      { entry: 'AAA', field: 'sellProposal' },
    ]);
  });

  it('銘柄エントリで coverage / components は許可外（ファンド専用）', () => {
    const before = syntheticDoc();
    const after = structuredClone(before);
    after.valuations.BBB.coverage = 0.1;
    expect(findDisallowedChanges(before, after)).toEqual([{ entry: 'BBB', field: 'coverage' }]);
  });

  it('ファンドエントリで status / percentile / note は許可外', () => {
    const before = syntheticDoc();
    const after = structuredClone(before);
    after.valuations['ファンドX'].status = 'cheap';
    after.valuations['ファンドX'].percentile = 10;
    expect(findDisallowedChanges(before, after)).toEqual([
      { entry: 'ファンドX', field: 'percentile' },
      { entry: 'ファンドX', field: 'status' },
    ]);
  });

  it('トップの note・新しいトップキーを検出（updated / asOf は可）', () => {
    const before = syntheticDoc();
    const after = structuredClone(before);
    after.updated = 'x';
    after.asOf = T;
    after.note = '変更';
    after.extra = 1;
    expect(findDisallowedChanges(before, after)).toEqual([
      { entry: '(top)', field: 'extra' },
      { entry: '(top)', field: 'note' },
    ]);
  });

  it('エントリの追加・削除・新しいフィールドの追加を検出する', () => {
    const before = syntheticDoc();
    const after = structuredClone(before);
    delete after.valuations.BBB;
    after.valuations.CCC = { perCurrent: 1 };
    after.valuations.AAA.forwardPE = 18;
    expect(findDisallowedChanges(before, after)).toEqual([
      { entry: 'AAA', field: 'forwardPE' },
      { entry: 'BBB', field: '(entry removed)' },
      { entry: 'CCC', field: '(entry added)' },
    ]);
  });

  it('結果に値は含まれない（公開ログ向け）', () => {
    const before = syntheticDoc();
    const after = structuredClone(before);
    after.valuations.AAA.bandHigh = 99;
    const out = findDisallowedChanges(before, after);
    expect(JSON.stringify(out)).not.toContain('99');
  });

  it('書式（2 スペース・末尾改行なし／1 スペース・末尾改行あり）は書き込み後も変わらない', () => {
    for (const fmt of [
      { indent: 2, trailingNewline: false },
      { indent: 1, trailingNewline: true },
    ]) {
      const raw = stringifyLike(syntheticDoc(), fmt);
      const store = JSON.parse(raw);
      applyWatchlistWrite(store, 'AAA', 14.2);
      const written = stringifyLike(store, detectFormat(raw));
      expect(detectFormat(written)).toEqual(fmt);
      expect(findDisallowedChanges(JSON.parse(raw), JSON.parse(written))).toEqual([]);
    }
  });
});

describe('countWatchlistUpdated / hasWatchlistUpdates（更新 0 件の日はコミットしない）', () => {
  const upd = (perCurrent) => ({ perCurrent, percentile: 50, status: 'fair', asOf: T });
  const kept = { perCurrent: 20, percentile: 50, status: 'fair', asOf: '2026-01-09', note: '前回維持' };

  it('skipped に無い銘柄だけを数える（投信エントリは skipped なので数えない）', () => {
    const out = {
      results: { AAA: upd(21), BBB: upd(14), CCC: kept, ファンドX: { ...kept, source: FUND_SOURCE } },
      skipped: [
        { sym: 'CCC', reason: 'PE無し' },
        { sym: 'ファンドX', reason: 'fund-monthly-top10（fund-per で計算）' },
      ],
    };
    expect(countWatchlistUpdated(out)).toBe(2);
    expect(hasWatchlistUpdates(out)).toBe(true);
  });

  it('1 件だけ更新できた日はコミットしてよい（skipped 割合の閾値は無い）', () => {
    const results = { AAA: upd(21) };
    const skipped = [];
    for (let i = 0; i < 50; i++) {
      results[`S${i}`] = kept;
      skipped.push({ sym: `S${i}`, reason: 'fetch:timeout' });
    }
    expect(countWatchlistUpdated({ results, skipped })).toBe(1);
    expect(hasWatchlistUpdates({ results, skipped })).toBe(true);
  });

  it('全銘柄 skipped（取得全滅）の日は 0 件＝コミットしない', () => {
    const out = {
      results: { AAA: kept, BBB: kept, ファンドX: { ...kept, source: FUND_SOURCE } },
      skipped: [
        { sym: 'AAA', reason: 'fetch:HTTP 503' },
        { sym: 'BBB', reason: 'fetch:HTTP 503' },
        { sym: 'ファンドX', reason: 'fund-monthly-top10（fund-per で計算）' },
      ],
    };
    expect(countWatchlistUpdated(out)).toBe(0);
    expect(hasWatchlistUpdates(out)).toBe(false);
  });

  it('投信エントリしか無い／結果が空・形が壊れている日も 0 件', () => {
    const fundOnly = {
      results: { ファンドX: { ...kept, source: FUND_SOURCE } },
      skipped: [{ sym: 'ファンドX', reason: 'fund-monthly-top10（fund-per で計算）' }],
    };
    expect(hasWatchlistUpdates(fundOnly)).toBe(false);
    expect(hasWatchlistUpdates({ results: {}, skipped: [] })).toBe(false);
    expect(hasWatchlistUpdates({})).toBe(false);
    expect(hasWatchlistUpdates(null)).toBe(false);
  });
});

describe('per-daily.yml（PR3 の切り替え）', () => {
  it('compare ジョブと 01:30 UTC の schedule が無い', () => {
    expect(WORKFLOW).not.toMatch(/30 1 \* \* \*/);
    expect(WORKFLOW).not.toMatch(/^ {2}compare:/m);
    expect(WORKFLOW).not.toMatch(/per-compare\.mjs/);
  });
  it('20:15 UTC の schedule・--write・固定メッセージ・--allow-empty・kv-resync・push ガードがある', () => {
    expect(WORKFLOW).toMatch(/cron: '15 20 \* \* \*'/);
    expect(WORKFLOW).toMatch(/WRITE="--write"/);
    expect(WORKFLOW).toMatch(/watchlist-per\.mjs \$WRITE/);
    expect(WORKFLOW).toMatch(/fund-per\.mjs \$WRITE/);
    expect(WORKFLOW).toMatch(/per-daily-gate\.mjs message/);
    expect(WORKFLOW).toMatch(/--allow-empty/);
    expect(WORKFLOW).toMatch(/kv-resync\.mjs --json/);
    expect(WORKFLOW).toMatch(/per-daily-gate\.mjs push-ok/);
    expect(WORKFLOW).toMatch(/per-daily-gate\.mjs mode/);
    expect(WORKFLOW).toMatch(/per-daily-gate\.mjs check-diff/);
    expect(WORKFLOW).toMatch(/per-daily-failed/);
    expect(WORKFLOW).toMatch(/kv-resync-failed/);
  });
  it('ウォッチ更新 0 件の日は Compute を失敗させる（gate updated の exit 4）', () => {
    expect(WORKFLOW).toMatch(/per-daily-gate\.mjs updated "\$OUT\/watchlist-per\.json"/);
    expect(WORKFLOW).toMatch(/if \[ "\$UCODE" -eq 4 \]; then[\s\S]*?no_updates=true[\s\S]*?exit 1/);
    expect(WORKFLOW).toMatch(/watch-updated=0/);
  });
  it('push-ok は exit 3 だけを禁止時間帯として扱い、それ以外の非 0 は失敗にする', () => {
    expect(WORKFLOW).not.toMatch(/if ! node data\/scheduler\/per-daily-gate\.mjs push-ok/);
    expect(WORKFLOW).toMatch(/if \[ "\$code" -eq 3 \]; then[\s\S]*?skipped=push-window[\s\S]*?exit 0/);
    expect(WORKFLOW).toMatch(/push 可否の判定に失敗しました[^\n]*\n\s*exit 1/);
  });
  it('Secrets は GITHUB_TOKEN のみ', () => {
    const secrets = [...WORKFLOW.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]);
    expect(new Set(secrets)).toEqual(new Set(['GITHUB_TOKEN']));
  });
});

describe('isAlreadyWritten（米国の引け以降の当日分・#708 §3.1(a) の 7 例・夏時間の日付）', () => {
  const bot = 'github-actions[bot]';
  const c = (subject, committedAt, author = bot) => ({ author, subject, committedAt });
  const now = (iso) => new Date(iso);

  it.each([
    [
      '1. 予備の schedule（23:02）・bot が 20:21 に書き込み済み → スキップ',
      '2026-10-05T23:02:00Z',
      [c('data: daily PER 2026-10-05', '2026-10-05T20:21:00Z')],
      true,
    ],
    ['2. Worker の起動（20:20）・当日コミットなし → 書く', '2026-10-05T20:20:00Z', [], false],
    [
      '3. Worker の起動（20:21）・schedule が 20:16 に定刻で書いた → スキップ',
      '2026-10-05T20:21:00Z',
      [c('data: daily PER 2026-10-05', '2026-10-05T20:16:00Z')],
      true,
    ],
    [
      '4. 20:20・朝 08:30 の手動テストのコミットは数えない → 書く',
      '2026-10-05T20:20:00Z',
      [c('data: daily PER 2026-10-05', '2026-10-05T08:30:00Z')],
      false,
    ],
    [
      '5. 予備の schedule が日付をまたいだ（10-06 00:30）・前日 20:21 のコミット → 書く',
      '2026-10-06T00:30:00Z',
      [c('data: daily PER 2026-10-05', '2026-10-05T20:21:00Z')],
      false,
    ],
    [
      '6. author が人（20:30）→ 書く（bot だけを数える）',
      '2026-10-05T23:02:00Z',
      [c('data: daily PER 2026-10-05', '2026-10-05T20:30:00Z', 'Synthetic Person')],
      false,
    ],
    [
      '7. 件名が完全一致しない（retry）→ 書く',
      '2026-10-05T23:02:00Z',
      [c('data: daily PER 2026-10-05 (retry)', '2026-10-05T20:30:00Z')],
      false,
    ],
  ])('%s', (_label, nowIso, commits, expected) => {
    expect(isAlreadyWritten(commits, now(nowIso))).toBe(expected);
  });

  it('例 5 の翌日 20:20 の Worker 起動はスキップされない（D＝10-06 の 20:00 以降のコミットが無い）', () => {
    const commits = [
      c('data: daily PER 2026-10-05', '2026-10-05T20:21:00Z'),
      c('data: daily PER 2026-10-06', '2026-10-06T00:31:00Z'),
    ];
    expect(isAlreadyWritten(commits, now('2026-10-06T20:20:00Z'))).toBe(false);
  });

  it('境界: 20:00:00 ちょうどと now ちょうどは数える・19:59:59 と now より後は数えない', () => {
    const n = now('2026-10-05T23:00:00Z');
    expect(isAlreadyWritten([c('data: daily PER 2026-10-05', '2026-10-05T20:00:00Z')], n)).toBe(true);
    expect(isAlreadyWritten([c('data: daily PER 2026-10-05', '2026-10-05T19:59:59Z')], n)).toBe(false);
    expect(isAlreadyWritten([c('data: daily PER 2026-10-05', '2026-10-05T23:00:01Z')], n)).toBe(false);
    expect(isAlreadyWritten([c('data: daily PER 2026-10-05', '2026-10-05T23:00:00Z')], n)).toBe(true);
  });

  it('git の %cI 形式（+00:00 オフセット）を受け付け、不正な日時は数えない', () => {
    const n = now('2026-10-05T23:00:00Z');
    expect(isAlreadyWritten([c('data: daily PER 2026-10-05', '2026-10-05T20:21:00+00:00')], n)).toBe(true);
    expect(isAlreadyWritten([c('data: daily PER 2026-10-05', 'not-a-date')], n)).toBe(false);
    expect(isAlreadyWritten([], n)).toBe(false);
    expect(isAlreadyWritten(null, n)).toBe(false);
  });
});

describe('isAlreadyWritten（冬時間は 21:00 UTC 以降だけを数える・#708 §4.1(b)）', () => {
  const bot = 'github-actions[bot]';
  const c = (subject, committedAt) => ({ author: bot, subject, committedAt });
  const now = (iso) => new Date(iso);

  it.each([
    [
      '冬・Worker 21:20・予備の schedule が 20:16 に引け前の値を書いた → 書く（21:00 より前は数えない）',
      '2026-11-02T21:20:00Z',
      [c('data: daily PER 2026-11-02', '2026-11-02T20:16:00Z')],
      false,
    ],
    [
      '冬・予備 23:03・21:21 に書き込み済み → スキップ',
      '2026-11-02T23:03:00Z',
      [c('data: daily PER 2026-11-02', '2026-11-02T21:21:00Z')],
      true,
    ],
    [
      '夏・予備 23:03・20:21 に書き込み済み → スキップ（夏は今と同じ）',
      '2026-10-05T23:03:00Z',
      [c('data: daily PER 2026-10-05', '2026-10-05T20:21:00Z')],
      true,
    ],
  ])('%s', (_label, nowIso, commits, expected) => {
    expect(isAlreadyWritten(commits, now(nowIso))).toBe(expected);
  });

  it('境界（冬）: 21:00:00 ちょうどは数える・20:59:59 は数えない', () => {
    const n = now('2026-11-02T23:00:00Z');
    expect(isAlreadyWritten([c('data: daily PER 2026-11-02', '2026-11-02T21:00:00Z')], n)).toBe(true);
    expect(isAlreadyWritten([c('data: daily PER 2026-11-02', '2026-11-02T20:59:59Z')], n)).toBe(false);
  });

  it('DST の切替日: 2026-11-01（冬）は 21:00・2027-03-14（夏）は 20:00 が下限', () => {
    expect(
      isAlreadyWritten([c('data: daily PER 2026-11-01', '2026-11-01T20:30:00Z')], now('2026-11-01T23:00:00Z'))
    ).toBe(false);
    expect(
      isAlreadyWritten([c('data: daily PER 2026-10-31', '2026-10-31T20:30:00Z')], now('2026-10-31T23:00:00Z'))
    ).toBe(true);
    expect(
      isAlreadyWritten([c('data: daily PER 2027-03-14', '2027-03-14T20:30:00Z')], now('2027-03-14T23:00:00Z'))
    ).toBe(true);
    expect(
      isAlreadyWritten([c('data: daily PER 2027-03-13', '2027-03-13T20:30:00Z')], now('2027-03-13T23:00:00Z'))
    ).toBe(false);
  });
});

describe('writtenSinceIso（gate の git log --since・#708 §4.1(c)）', () => {
  it.each([
    ['2026-10-05T20:20:00Z', '2026-10-05T20:00:00Z'],
    ['2026-10-31T23:00:00Z', '2026-10-31T20:00:00Z'],
    ['2026-11-01T21:20:00Z', '2026-11-01T21:00:00Z'],
    ['2026-11-02T21:20:00Z', '2026-11-02T21:00:00Z'],
    ['2027-03-13T21:20:00Z', '2027-03-13T21:00:00Z'],
    ['2027-03-14T20:20:00Z', '2027-03-14T20:00:00Z'],
  ])('%s → %s', (nowIso, expected) => {
    expect(writtenSinceIso(new Date(nowIso))).toBe(expected);
  });
});

describe('alreadyWrittenLogArgs / parseCommitLog（git log --since-as-filter・#708 レビュー対応）', () => {
  it('--since ではなく --since-as-filter で引けの時刻を渡す', () => {
    const args = alreadyWrittenLogArgs(new Date('2026-11-02T21:20:00Z'));
    expect(args).toContain('--since-as-filter=2026-11-02T21:00:00Z');
    expect(args.some((a) => a.startsWith('--since='))).toBe(false);
  });

  it('parseCommitLog は author・committedAt・subject（タブを含む件名も）を取り出す', () => {
    expect(parseCommitLog('a\t2026-10-05T20:21:00+00:00\tdata: daily PER 2026-10-05\nb\tx\ty\tz\n')).toEqual([
      { author: 'a', committedAt: '2026-10-05T20:21:00+00:00', subject: 'data: daily PER 2026-10-05' },
      { author: 'b', committedAt: 'x', subject: 'y\tz' },
    ]);
    expect(parseCommitLog('')).toEqual([]);
  });

  it('HEAD に古い committer date のコミットがあっても、その奥の当日の bot コミットを見つける（実 git・合成リポ）', () => {
    const dir = mkdtempSync(join(tmpdir(), 'per-daily-git-'));
    const base = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
    const git = (args, env = {}) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...base, ...env } });
    const commit = (subject, author, iso) =>
      git(['commit', '-q', '--allow-empty', '-m', subject], {
        GIT_AUTHOR_NAME: author,
        GIT_AUTHOR_EMAIL: 'synthetic@example.invalid',
        GIT_COMMITTER_NAME: author,
        GIT_COMMITTER_EMAIL: 'synthetic@example.invalid',
        GIT_AUTHOR_DATE: iso,
        GIT_COMMITTER_DATE: iso,
      });
    try {
      git(['init', '-q']);
      commit('base', 'Synthetic Person', '2026-10-01T00:00:00Z');
      commit('data: daily PER 2026-10-05', 'github-actions[bot]', '2026-10-05T20:21:00Z');
      // tip に下限より古い committer date のコミット（例: 古い日付のまま取り込まれたコミット）
      commit('synthetic old-dated tip', 'Synthetic Person', '2026-10-02T00:00:00Z');
      const now = new Date('2026-10-05T23:03:00Z');
      const commits = parseCommitLog(git(alreadyWrittenLogArgs(now)));
      expect(isAlreadyWritten(commits, now)).toBe(true);
      // 旧実装（--since）はここで走査を止めて見落とす（回帰の理由の確認）
      const legacy = parseCommitLog(
        git(['log', 'HEAD', `--since=${writtenSinceIso(now)}`, '--format=%an%x09%cI%x09%s'])
      );
      expect(isAlreadyWritten(legacy, now)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('isOnTimeStart（開始が引け〜21:44 UTC・#708 §4.1(b)）', () => {
  it.each([
    ['2026-10-05T20:20:00Z', true],
    ['2026-10-05T20:55:00Z', true],
    ['2026-11-02T21:20:00Z', true],
    ['2026-11-02T20:30:00Z', false],
    ['2026-11-02T21:45:00Z', false],
  ])('設計書の表: %s → %s', (iso, expected) => {
    expect(isOnTimeStart(new Date(iso))).toBe(expected);
  });

  it.each([
    // 夏（2026-10-05）
    ['2026-10-05T19:59:00Z', false],
    ['2026-10-05T20:00:00Z', true],
    ['2026-10-05T21:44:00Z', true],
    ['2026-10-05T21:45:00Z', false],
    ['2026-10-05T23:02:00Z', false],
    ['2026-10-05T08:30:00Z', false],
    // 冬（2026-11-02・2026-01-10）
    ['2026-11-02T20:59:00Z', false],
    ['2026-11-02T21:00:00Z', true],
    ['2026-11-02T21:44:00Z', true],
    ['2026-11-02T23:03:00Z', false],
    ['2026-01-10T20:20:00Z', false],
    ['2026-01-10T21:20:00Z', true],
    // DST の切替日の前後
    ['2026-10-31T20:20:00Z', true],
    ['2026-11-01T20:20:00Z', false],
    ['2026-11-01T21:20:00Z', true],
    ['2027-03-13T20:20:00Z', false],
    ['2027-03-13T21:20:00Z', true],
    ['2027-03-14T20:20:00Z', true],
  ])('境界: %s → %s', (iso, expected) => {
    expect(isOnTimeStart(new Date(iso))).toBe(expected);
  });
});

describe('per-daily.yml（#708 PR1 書き込み済みチェック・per-daily-late）', () => {
  it('workflow_dispatch に force（boolean・既定 false）がある', () => {
    expect(WORKFLOW).toMatch(/workflow_dispatch:\n\s+inputs:\n\s+force:[\s\S]*?type: boolean[\s\S]*?default: false/);
  });
  it('already ステップが already-written を呼び、exit 6 だけを書き込み済みとして扱う', () => {
    expect(WORKFLOW).toMatch(/id: already/);
    expect(WORKFLOW).toMatch(/per-daily-gate\.mjs already-written --now "\$START"/);
    expect(WORKFLOW).toMatch(/if \[ "\$CODE" -eq 6 \]; then[\s\S]*?already=true/);
    expect(WORKFLOW).toMatch(/書き込み済みの判定に失敗しました[^\n]*\n\s*exit 1/);
  });
  it('Compute・Guard・Commit and push は書き込み済みならスキップする', () => {
    const cond = /if: [^\n]*steps\.already\.outputs\.already != 'true'/g;
    expect([...WORKFLOW.matchAll(cond)]).toHaveLength(3);
    expect(WORKFLOW).toMatch(/if: steps\.mode\.outputs\.mode == 'write' && steps\.already\.outputs\.already != 'true'/);
  });
  it('書き込み済みなら result=skipped を最初に決め、already-check の失敗は failure の理由になる', () => {
    expect(WORKFLOW).toMatch(/if \[ "\$ALREADY" = "true" \]; then[\s\S]*?RESULT=skipped\n\s+else/);
    expect(WORKFLOW).toMatch(/already-check=failure/);
    expect(WORKFLOW).toMatch(/\| already-written \|/);
    expect(WORKFLOW).toMatch(/\| event \|/);
  });
  it('per-daily-late Issue を on-time の判定で開閉する（schedule の定刻外で開く）', () => {
    expect(WORKFLOW).toMatch(/per-daily-late/);
    expect(WORKFLOW).toMatch(/--color FBCA04/);
    expect(WORKFLOW).toMatch(/per-daily-gate\.mjs on-time --now "\$START"/);
    expect(WORKFLOW).toMatch(/elif \[ "\$EVENT" = "schedule" \]; then/);
    expect(WORKFLOW).not.toMatch(/node -e/);
  });
  it('文言は引け（夏 20:00・冬 21:00 UTC）基準・定刻は引け〜21:44 UTC（#708 §4.1(d)）', () => {
    expect(WORKFLOW).toContain('TITLE="⚠ 当日の PER が Mulmo に間に合いませんでした（予備の schedule が書き込み）"');
    expect(WORKFLOW).toContain('Worker 起動（夏 20:20・冬 21:20 UTC');
    expect(WORKFLOW).toContain('定刻（引け〜21:44 UTC）');
    expect(WORKFLOW).toContain(
      '本番は Worker Cron の workflow_dispatch（夏 20:20・冬 21:20 UTC）、schedule 20:15 は予備'
    );
    expect(WORKFLOW).not.toContain('20:00〜20:54');
  });
  it('concurrency group と予備の schedule は変えない', () => {
    expect(WORKFLOW).toMatch(/group: portfolio-data-batch\n\s+cancel-in-progress: false/);
    expect(WORKFLOW).toMatch(/cron: '15 20 \* \* \*'/);
  });
});

describe('per-daily-gate mode / push-ok（CLI・#708 PR3 §4.3(b)）', () => {
  const GATE = resolve(__dir, '../data/scheduler/per-daily-gate.mjs');
  const run = (args) => {
    try {
      return { code: 0, out: execFileSync('node', [GATE, ...args], { encoding: 'utf8' }).trim() };
    } catch (e) {
      return { code: e.status, out: String(e.stdout || '').trim() };
    }
  };
  it.each([
    [['mode', '--now', '2026-10-06T09:00:00Z'], 'compute-only'],
    [['mode', '--now', '2026-10-06T09:00:00Z', '--force'], 'write'],
    [['mode', '--force', '--now', '2026-10-06T09:00:00Z'], 'write'],
    [['mode', '--now', '2026-11-02T21:20:00Z'], 'write'],
    [['mode', '--now', '2026-10-05T22:00:00Z', '--force'], 'compute-only'],
  ])('%j → %s', (args, out) => {
    expect(run(args)).toEqual({ code: 0, out });
  });
  it.each([
    ['2026-10-05T21:49:00Z', 0, 'ok'],
    ['2026-10-05T21:50:00Z', 3, 'blocked'],
    ['2026-10-05T22:59:00Z', 3, 'blocked'],
    ['2026-10-05T23:00:00Z', 0, 'ok'],
  ])('push-ok --now %s → exit %i %s', (iso, code, out) => {
    expect(run(['push-ok', '--now', iso])).toEqual({ code, out });
  });
});

describe('per-daily.yml（#708 PR3 force・時間帯の文言）', () => {
  it('Resolve mode は force=true のとき --force を渡す', () => {
    expect(WORKFLOW).toMatch(/id: mode\n\s+env:\n\s+FORCE: \$\{\{ inputs\.force == true \}\}/);
    expect(WORKFLOW).toMatch(/if \[ "\$FORCE" = "true" \]; then FORCE_ARG="--force"; fi/);
    expect(WORKFLOW).toMatch(/per-daily-gate\.mjs mode --now "\$START" \$FORCE_ARG/);
  });
  it('compute-only の理由を出し分け、push 禁止は 21:50〜22:59 UTC', () => {
    expect(WORKFLOW).toContain('Mulmo の時間帯（21:45〜22:59 UTC）');
    expect(WORKFLOW).toContain('米国の引け前（夏 20:00・冬 21:00 UTC より前）');
    expect(WORKFLOW).toContain('21:50〜22:59 UTC（push 禁止時間帯）');
    expect(WORKFLOW).not.toContain('20:55〜22:30');
    expect(WORKFLOW).not.toContain('21:00〜22:30');
    expect(WORKFLOW).not.toContain('Mulmo の日次バッチ（21:00 UTC）は前日の PER を使っています');
  });
});

describe('weekly-valuations.yml・fund-holdings-monthly.yml（push 禁止 21:00〜22:59 UTC・#708 PR3 §4.3(d)）', () => {
  it.each(['weekly-valuations.yml', 'fund-holdings-monthly.yml'])('%s', (name) => {
    const wf = readFileSync(resolve(__dir, `../.github/workflows/${name}`), 'utf8');
    expect(wf).toMatch(/if \[ "\$HM" -ge 2100 \] && \[ "\$HM" -le 2259 \]; then/);
    expect(wf).toContain('21:00〜22:59 UTC（push 禁止時間帯）');
    expect(wf).not.toMatch(/2230|22:30 UTC（push/);
  });
});
