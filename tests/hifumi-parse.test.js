import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, cpSync, writeFileSync, existsSync, rmSync, chmodSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

import {
  parseTop10,
  parseTop10Detailed,
  validateTop10,
  compareKnown,
  normalizeName,
  targetMonth,
  isValidMonth,
  isNewerThanAsOf,
  notPublishedAction,
  applyUpdates,
} from '../data/scheduler/lib/hifumi-parse.mjs';
import { KNOWN_MONTH, KNOWN_TOP10 } from '../data/scheduler/lib/hifumi-known.mjs';

// fixture はファンドの公開資料（月次レポートの pdftotext -layout 出力・設計書 §7.0）。
const __dir = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(__dir, 'fixtures/hifumi');
const fx = (f, m) => readFileSync(join(FIX, `hifumi-${f}-report${m}.layout.txt`), 'utf8');
// fund-holdings.json のテスト用コピー（2026-05 時点の形・書式で固定）。実データ data/scheduler/fund-holdings.json は
// 月次ワークフローが自動で書き換えるので、テストからは読まない。
const SAMPLE = join(FIX, 'fund-holdings.sample.json');

/** 合成の正常 10 行（検証違反ケースの土台） */
const good = () =>
  Array.from({ length: 10 }, (_, i) => ({ code: `${1000 + i}.T`, name: `合成銘柄${i + 1}`, weight: 0.05 - i * 0.001 }));

/** 合成テキスト（toushin 形式） */
function toushinText(rows, { heading = '銘柄紹介（基準日時点の組入比率1～10位）', twice = false, end = true } = {}) {
  const body = rows.map(
    ([no, name, code, pct]) =>
      `  ${String(no).padStart(2)} ${name}                 ${code}      大型     プライム市場    卸売業    ${pct}%`
  );
  const block = [heading, '', '  No   銘柄名   銘柄コード  規模  上場市場  業種  組入比率', '', ...body, ''];
  if (end) block.push('  ※「組入比率」はマザーファンドの純資産総額に対する比率です。');
  return [...(twice ? block : []), ...block].join('\n');
}
const toushinRows = () =>
  Array.from({ length: 10 }, (_, i) => [i + 1, `合成${i + 1}`, String(2000 + i), (5 - i * 0.1).toFixed(2)]);

describe('parseTop10：2026-05 fixture は KNOWN_TOP10 と完全一致', () => {
  it('KNOWN_MONTH は 202605', () => {
    expect(KNOWN_MONTH).toBe('202605');
  });

  it('toushin 2026-05 = KNOWN_TOP10.toushin（2026-05 時点の fund-holdings.json と同値）', () => {
    const rows = parseTop10(fx('toushin', '202605'), 'toushin');
    expect(rows).toEqual(KNOWN_TOP10.toushin);
    const cur = JSON.parse(readFileSync(SAMPLE, 'utf8'));
    expect(cur.find((f) => f.fund === 'ひふみ投信').top).toEqual(KNOWN_TOP10.toushin);
  });

  it('microscope 2026-05 = KNOWN_TOP10.microscope（PDF の値。2026-05 時点の JSON の microscope とは一致しないのが正しい）', () => {
    const rows = parseTop10(fx('microscope', '202605'), 'microscope');
    expect(rows).toEqual(KNOWN_TOP10.microscope);
    const cur = JSON.parse(readFileSync(SAMPLE, 'utf8'));
    expect(cur.find((f) => f.fund === 'ひふみマイクロスコープpro').top).not.toEqual(KNOWN_TOP10.microscope);
  });

  it('2026-05 の 2 本は検証 ①〜⑦ を通り、自己検証も OK', () => {
    for (const f of ['toushin', 'microscope']) {
      const rows = parseTop10(fx(f, '202605'), f);
      expect(validateTop10(rows)).toEqual({ ok: true, errors: [] });
      expect(compareKnown(rows, KNOWN_TOP10[f]).ok).toBe(true);
    }
  });
});

describe('parseTop10：2026-08 fixture（英数コード・連続空白）', () => {
  it('toushin 2026-08 は検証を通り、1 位 8001.T 0.0618・10 位 4676.T 0.0282', () => {
    const rows = parseTop10(fx('toushin', '202608'), 'toushin');
    expect(validateTop10(rows)).toEqual({ ok: true, errors: [] });
    expect(rows[0]).toMatchObject({ code: '8001.T', weight: 0.0618 });
    expect(rows[9]).toMatchObject({ code: '4676.T', weight: 0.0282 });
  });

  it('microscope 2026-08 は検証を通り、英数コード 4 件・連続空白の圧縮・1 位 7806.T 0.0482', () => {
    const rows = parseTop10(fx('microscope', '202608'), 'microscope');
    expect(validateTop10(rows)).toEqual({ ok: true, errors: [] });
    const codes = rows.map((r) => r.code);
    for (const c of ['141A.T', '215A.T', '278A.T', '456A.T']) expect(codes).toContain(c);
    expect(rows.find((r) => r.code === '278A.T').name).toBe('Ｔｅｒｒａ Ｄｒｏｎｅ');
    expect(rows.find((r) => r.code === '456A.T').name).toBe('ＨＵＭＡＮ ＭＡＤＥ');
    expect(rows[0]).toMatchObject({ code: '7806.T', weight: 0.0482 });
    // ⑦ 同値は可（6492 と 2782 はともに 2.43%）
    expect(rows.find((r) => r.code === '6492.T').weight).toBe(0.0243);
    expect(rows.find((r) => r.code === '2782.T').weight).toBe(0.0243);
  });
});

describe('parseTop10：似た表・説明文を拾わない', () => {
  it('toushin の「組入比率11～30位」の表を読まない（11 位以降のコードが結果に無い）', () => {
    const text = fx('toushin', '202605');
    expect(text).toMatch(/組入比率11～30位/);
    const codes = parseTop10(text, 'toushin').map((r) => r.code);
    for (const c of ['6758.T', '8766.T', '8306.T', '6503.T']) expect(codes).not.toContain(c);
    expect(codes).toHaveLength(10);
  });

  it('microscope の「組み入れ上位10業種 比率」の表と説明文中の %（40%を目安に）を拾わない', () => {
    const text = fx('microscope', '202605');
    expect(text).toMatch(/組み入れ上位10業種/);
    expect(text).toMatch(/40%を目安に/);
    const rows = parseTop10(text, 'microscope');
    const names = rows.map((r) => r.name);
    expect(names).not.toContain('サービス業');
    expect(names).not.toContain('情報・通信業');
    expect(rows.some((r) => r.weight === 0.4)).toBe(false);
    expect(rows).toHaveLength(10);
  });

  it('見出し「組入比率1~10位」が 2 回ある合成テキストは NG（0 行 → 検証 ①）', () => {
    const text = toushinText(toushinRows(), { twice: true });
    const d = parseTop10Detailed(text, 'toushin');
    expect(d.errors.join()).toMatch(/2 回/);
    expect(parseTop10(text, 'toushin')).toEqual([]);
    expect(validateTop10(parseTop10(text, 'toushin')).ok).toBe(false);
  });

  it('見出しなし・終端なしは 0 行', () => {
    expect(parseTop10(toushinText(toushinRows(), { heading: '銘柄紹介' }), 'toushin')).toEqual([]);
    expect(parseTop10(toushinText(toushinRows(), { end: false }), 'toushin')).toEqual([]);
  });

  it('合成テキスト（半角 ~ / 全角 ～ の見出し）で 10 行取れる', () => {
    expect(parseTop10(toushinText(toushinRows()), 'toushin')).toHaveLength(10);
    expect(parseTop10(toushinText(toushinRows(), { heading: '組入比率1~10位' }), 'toushin')).toHaveLength(10);
  });

  it('toushin の行頭順位が 1〜10 の昇順・欠番なしでなければ NG', () => {
    const rows = toushinRows();
    rows[4][0] = 6; // 5 が欠番・6 が重複
    const d = parseTop10Detailed(toushinText(rows), 'toushin');
    expect(d.errors.join()).toMatch(/順位/);
    expect(parseTop10(toushinText(rows), 'toushin')).toEqual([]);
  });
});

describe('normalizeName', () => {
  it('前後の空白を除き、連続空白（半角・全角）を半角 1 つに', () => {
    expect(normalizeName('  Ｔｅｒｒａ   Ｄｒｏｎｅ ')).toBe('Ｔｅｒｒａ Ｄｒｏｎｅ');
    expect(normalizeName('ＨＵＭＡＮ　　ＭＡＤＥ')).toBe('ＨＵＭＡＮ ＭＡＤＥ');
    expect(normalizeName('ＭＴＧ')).toBe('ＭＴＧ');
    expect(normalizeName('ジェイ・エス・ビー')).toBe('ジェイ・エス・ビー');
  });
});

describe('validateTop10：①〜⑦ の各違反で NG', () => {
  it('正常系は OK', () => {
    expect(validateTop10(good())).toEqual({ ok: true, errors: [] });
  });
  it('① 10 行でない', () => {
    expect(validateTop10(good().slice(0, 9)).ok).toBe(false);
    expect(validateTop10([...good(), { code: '9999.T', name: 'x', weight: 0.001 }]).ok).toBe(false);
  });
  it('② code の形式', () => {
    for (const code of ['1000', '1000.TT', 'A000.T', '100.T', '1a00.T']) {
      const r = good();
      r[3].code = code;
      expect(validateTop10(r).errors.join()).toMatch(/②/);
    }
  });
  it('③ 0 < weight < 0.2', () => {
    for (const w of [0, -0.01, 0.2, Number.NaN]) {
      const r = good();
      r[9].weight = w;
      expect(validateTop10(r).errors.join()).toMatch(/③/);
    }
  });
  it('④ weight 合計 ≤ 1', () => {
    const r = good().map((x) => ({ ...x, weight: 0.11 }));
    const v = validateTop10(r);
    expect(v.errors.join()).toMatch(/④/);
  });
  it('⑤ name が空', () => {
    const r = good();
    r[2].name = '  ';
    expect(validateTop10(r).errors.join()).toMatch(/⑤/);
  });
  it('⑥ code 重複', () => {
    const r = good();
    r[5].code = r[4].code;
    expect(validateTop10(r).errors.join()).toMatch(/⑥/);
  });
  it('⑦ weight が出現順に非増加でない（同値は可）', () => {
    const r = good();
    r[6].weight = 0.06;
    expect(validateTop10(r).errors.join()).toMatch(/⑦/);
    const eq = good();
    eq[6].weight = eq[5].weight;
    expect(validateTop10(eq).ok).toBe(true);
  });
});

describe('compareKnown：自己検証は 1 銘柄でも違えば NG', () => {
  for (const f of ['toushin', 'microscope']) {
    it(`${f}：code / name / weight の 1 か所違い・行数違いで NG`, () => {
      const base = () => KNOWN_TOP10[f].map((r) => ({ ...r }));
      expect(compareKnown(base(), KNOWN_TOP10[f]).ok).toBe(true);
      const a = base();
      a[7].code = '9999.T';
      expect(compareKnown(a, KNOWN_TOP10[f]).ok).toBe(false);
      const b = base();
      b[0].name += 'x';
      expect(compareKnown(b, KNOWN_TOP10[f]).ok).toBe(false);
      const c = base();
      c[9].weight += 0.0001;
      expect(compareKnown(c, KNOWN_TOP10[f]).ok).toBe(false);
      expect(compareKnown(base().slice(0, 9), KNOWN_TOP10[f]).ok).toBe(false);
    });
  }

  it('合成テキストのパース結果を既知月と比べると NG（1 銘柄だけ比率を変えた toushin 2026-05）', () => {
    const text = fx('toushin', '202605').replace(/(5802\s.*?)5\.13%/, '$15.12%');
    const rows = parseTop10(text, 'toushin');
    expect(validateTop10(rows).ok).toBe(true);
    expect(compareKnown(rows, KNOWN_TOP10.toushin).ok).toBe(false);
  });
});

describe('月次更新の判定（純関数）', () => {
  it('対象月＝実行日（UTC）の前月', () => {
    expect(targetMonth(new Date('2026-10-03T03:00:00Z'))).toBe('202609');
    expect(targetMonth(new Date('2027-01-05T03:00:00Z'))).toBe('202612');
    expect(targetMonth(new Date('2026-10-01T00:00:00Z'))).toBe('202609');
  });
  it('未公開（404）：1〜19 日は retry、20 日以降は stale', () => {
    for (const d of [1, 2, 10, 19]) {
      expect(notPublishedAction(new Date(`2026-10-${String(d).padStart(2, '0')}T03:00:00Z`))).toBe('retry');
    }
    for (const d of [20, 21, 31]) {
      expect(notPublishedAction(new Date(`2026-10-${String(d).padStart(2, '0')}T03:00:00Z`))).toBe('stale');
    }
  });
  it('month が現在の asOf 以前なら書き込まない（後戻り防止）', () => {
    expect(isNewerThanAsOf('2026-05', '202608')).toBe(true);
    expect(isNewerThanAsOf('2026-08', '202608')).toBe(false);
    expect(isNewerThanAsOf('2026-08', '202605')).toBe(false);
    expect(isNewerThanAsOf('2026-12', '202701')).toBe(true);
  });
  it('isValidMonth', () => {
    expect(isValidMonth('202608')).toBe(true);
    for (const m of ['2026-08', '202613', '202600', '20268', 'abcdef']) expect(isValidMonth(m)).toBe(false);
  });
  it('applyUpdates は top と asOf だけ差し替え、他のキー・順序・他ファンドは保持', () => {
    const holdings = [
      { fund: 'A', fundSymbol: 'A', asOf: '2026-05', source: 's', top: good() },
      { fund: 'B', fundSymbol: 'B', asOf: '2026-05', source: 's', top: good() },
    ];
    const newTop = good().map((r) => ({ ...r, name: `${r.name}新` }));
    const out = applyUpdates(holdings, { A: { asOf: '2026-08', top: newTop } });
    expect(Object.keys(out[0])).toEqual(['fund', 'fundSymbol', 'asOf', 'source', 'top']);
    expect(out[0]).toEqual({ fund: 'A', fundSymbol: 'A', asOf: '2026-08', source: 's', top: newTop });
    expect(out[1]).toBe(holdings[1]);
    expect(holdings[0].asOf).toBe('2026-05'); // 入力は変更しない
  });
});

// ── スクリプト全体（fund-holdings-update.mjs）を一時ディレクトリで実行 ──────────────
// fetch は fixture を返すスタブ、pdftotext は入力をそのまま出す偽コマンド（fixture は既にテキスト）。
// 日付は FAKE_NOW で固定する。入力は SAMPLE（asOf 2026-05 固定）で、リポの data/scheduler/fund-holdings.json は読まない・触らない。
describe('fund-holdings-update.mjs（スタブで通し実行）', () => {
  const SCHED = resolve(__dir, '../data/scheduler');
  const canRun = process.platform !== 'win32';

  function setup() {
    const dir = mkdtempSync(join(tmpdir(), 'hifumi-test-'));
    mkdirSync(join(dir, 'sched'));
    mkdirSync(join(dir, 'bin'));
    cpSync(join(SCHED, 'lib'), join(dir, 'sched/lib'), { recursive: true });
    cpSync(join(SCHED, 'fund-holdings-update.mjs'), join(dir, 'sched/fund-holdings-update.mjs'));
    cpSync(SAMPLE, join(dir, 'sched/fund-holdings.json'));
    writeFileSync(join(dir, 'bin/pdftotext'), '#!/bin/sh\ncat "$2"\n');
    chmodSync(join(dir, 'bin/pdftotext'), 0o755);
    writeFileSync(
      join(dir, 'stub.mjs'),
      [
        "import { readFileSync } from 'fs';",
        `const FIX = ${JSON.stringify(FIX)};`,
        "const avail = (process.env.AVAIL || '').split(',');",
        'globalThis.fetch = async (url) => {',
        '  const m = /fund\\/(\\w+)\\/pdf\\/report(\\d{6})\\.pdf$/.exec(url);',
        "  if (!m || !avail.includes(`${m[1]}-${m[2]}`)) return new Response('', { status: 404 });",
        '  return new Response(readFileSync(`${FIX}/hifumi-${m[1]}-report${m[2]}.layout.txt`));',
        '};',
        'const RealDate = Date;',
        'const fixed = new RealDate(process.env.FAKE_NOW).getTime();',
        'globalThis.Date = class extends RealDate {',
        '  constructor(...a) { if (a.length) super(...a); else super(fixed); }',
        '  static now() { return fixed; }',
        '};',
      ].join('\n')
    );
    return dir;
  }

  function run(dir, { avail, now, extra = [] }) {
    const r = spawnSync(
      process.execPath,
      [
        '--import',
        join(dir, 'stub.mjs'),
        join(dir, 'sched/fund-holdings-update.mjs'),
        '--out',
        join(dir, 'out.json'),
        '--issue-body',
        join(dir, 'issue.md'),
        ...extra,
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
          AVAIL: avail.join(','),
          FAKE_NOW: now,
          GITHUB_STEP_SUMMARY: '',
        },
      }
    );
    return {
      code: r.status,
      out: JSON.parse(readFileSync(join(dir, 'out.json'), 'utf8')),
      hold: readFileSync(join(dir, 'sched/fund-holdings.json'), 'utf8'),
    };
  }

  const ALL_05 = ['toushin-202605', 'microscope-202605'];
  const orig = readFileSync(SAMPLE, 'utf8');

  it.runIf(canRun)('対象月 404・実行日 1〜19 日：成功終了・書き込みなし・Issue なし', () => {
    const dir = setup();
    try {
      const r = run(dir, { avail: ALL_05, now: '2026-10-19T03:00:00Z' });
      expect(r.code).toBe(0);
      expect(r.out.month).toBe('202609');
      expect(r.out.results.map((x) => x.status)).toEqual(['not-published-retry', 'not-published-retry']);
      expect(r.out.changed).toBe(false);
      expect(r.hold).toBe(orig);
      expect(existsSync(join(dir, 'issue.md'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.runIf(canRun)('対象月 404・実行日 20 日以降：失敗＋Issue 本文', () => {
    const dir = setup();
    try {
      const r = run(dir, { avail: ALL_05, now: '2026-10-20T03:00:00Z' });
      expect(r.code).toBe(1);
      expect(r.out.failed).toBe(true);
      expect(r.out.results.map((x) => x.status)).toEqual(['not-published-stale', 'not-published-stale']);
      expect(r.hold).toBe(orig);
      expect(readFileSync(join(dir, 'issue.md'), 'utf8')).toMatch(/2026-09/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.runIf(canRun)('片方だけ公開なら公開側だけ更新（top/asOf のみ・書式保持）', () => {
    const dir = setup();
    try {
      const r = run(dir, { avail: [...ALL_05, 'toushin-202608'], now: '2026-09-05T03:00:00Z' });
      expect(r.code).toBe(0);
      expect(r.out.results.map((x) => x.status)).toEqual(['updated', 'not-published-retry']);
      const before = JSON.parse(orig);
      const after = JSON.parse(r.hold);
      expect(after[1]).toEqual(before[1]);
      expect({ ...after[0], top: null, asOf: null }).toEqual({ ...before[0], top: null, asOf: null });
      expect(after[0].asOf).toBe('2026-08');
      expect(after[0].top).toEqual(parseTop10(fx('toushin', '202608'), 'toushin'));
      // 書式（1 スペース・末尾改行の有無）は元のまま
      expect(r.hold.endsWith('\n')).toBe(orig.endsWith('\n'));
      expect(r.hold.split('\n')[1]).toBe(orig.split('\n')[1]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.runIf(canRun)('--month が現在の asOf 以前なら書き込まない／--dry-run は書き込まない', () => {
    const dir = setup();
    const all = [...ALL_05, 'toushin-202608', 'microscope-202608'];
    try {
      const dry = run(dir, { avail: all, now: '2026-10-03T03:00:00Z', extra: ['--month', '202608', '--dry-run'] });
      expect(dry.code).toBe(0);
      expect(dry.out.results.map((x) => x.status)).toEqual(['would-update', 'would-update']);
      expect(dry.hold).toBe(orig);
      const same = run(dir, { avail: all, now: '2026-10-03T03:00:00Z', extra: ['--month', '202605'] });
      expect(same.out.results.map((x) => x.status)).toEqual(['up-to-date', 'up-to-date']);
      expect(same.hold).toBe(orig);
      const w = run(dir, { avail: all, now: '2026-10-03T03:00:00Z', extra: ['--month', '202608'] });
      expect(w.out.changed).toBe(true);
      const back = run(dir, { avail: all, now: '2026-10-03T03:00:00Z', extra: ['--month', '202606'] });
      expect(back.out.changed).toBe(false);
      expect(back.hold).toBe(w.hold);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.runIf(canRun)('既知月（2026-05）の PDF が取れなければ自己検証できず書き込まない（失敗）', () => {
    const dir = setup();
    try {
      const r = run(dir, { avail: ['toushin-202608', 'microscope-202608'], now: '2026-09-05T03:00:00Z' });
      expect(r.code).toBe(1);
      expect(r.out.results.map((x) => x.status)).toEqual(['error', 'error']);
      expect(r.hold).toBe(orig);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
