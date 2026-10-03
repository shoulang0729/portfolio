import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import {
  COMMIT_PREFIX,
  dailyPerCommitMessage,
  runMode,
  isPushBlocked,
  findDisallowedChanges,
  deepEqual,
  countWatchlistUpdated,
  hasWatchlistUpdates,
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

describe('runMode（開始が 20:55〜22:30 UTC なら計算のみ・§2.6）', () => {
  it.each([
    ['20:15', 'write'],
    ['20:54', 'write'],
    ['20:55', 'compute-only'],
    ['21:00', 'compute-only'],
    ['22:30', 'compute-only'],
    ['22:31', 'write'],
    ['23:59', 'write'],
    ['00:00', 'write'],
    ['08:29', 'write'],
  ])('%s UTC → %s', (hhmm, mode) => {
    expect(runMode(at(hhmm))).toBe(mode);
  });
});

describe('isPushBlocked（21:00〜22:30 UTC は push しない・§2.3）', () => {
  it.each([
    ['20:59', false],
    ['21:00', true],
    ['22:00', true],
    ['22:30', true],
    ['22:31', false],
    ['20:15', false],
  ])('%s UTC → %s', (hhmm, blocked) => {
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
