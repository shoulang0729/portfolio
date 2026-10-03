import { describe, it, expect } from 'vitest';

import {
  diffValuations,
  diffOutcomes,
  renderMarkdown,
  fmtCell,
  VALUATION_BLOCKS,
} from '../data/scheduler/diff-report.mjs';

// 合成データのみ（実在の保有額・資産実額は含まない）
const OLD_VALS = {
  updated: '2026-06-21',
  valuations: {
    AAA: {
      perCurrent: 10,
      status: 'fair',
      quality: { roic: 10.5, qScore: 5, altmanZ: 2.1 },
      value: { perTrail: 12.3, targetGapPct: 4 },
    },
    BBB: {
      perCurrent: 20,
      sectorMedian: { per: 18.2, n: 5, source: 'finnhub-peers', asOf: '2026-06-24' },
    },
    CCC: { perCurrent: 30 },
  },
};

const NEW_VALS = {
  updated: '2026-06-21',
  valuations: {
    AAA: {
      perCurrent: 11, // ブロック外の変化は対象外
      status: 'rich',
      quality: { roic: 11.0, qScore: 5, altmanZ: null },
      value: { perTrail: 12.3, targetGapPct: -2 },
    },
    BBB: {
      perCurrent: 20,
      sectorMedian: { per: 19.0, n: 6, source: 'finnhub-peers', asOf: '2026-10-04' },
    },
    CCC: { perCurrent: 30, value: { perTrail: 15.5, perSource: 'fund-trailing' } },
  },
};

describe('diffValuations', () => {
  it('対象ブロック（quality/value/sectorMedian）のフィールド単位の差分だけを返す', () => {
    const d = diffValuations(OLD_VALS, NEW_VALS);
    const key = (c) => `${c.symbol}.${c.block}.${c.field}`;
    expect(d.map(key)).toEqual([
      'AAA.quality.roic',
      'AAA.quality.altmanZ',
      'AAA.value.targetGapPct',
      'BBB.sectorMedian.per',
      'BBB.sectorMedian.n',
      'BBB.sectorMedian.asOf',
      'CCC.value.perTrail',
      'CCC.value.perSource',
    ]);
    const roic = d.find((c) => key(c) === 'AAA.quality.roic');
    expect(roic.old).toBe(10.5);
    expect(roic.new).toBe(11);
    const added = d.find((c) => key(c) === 'CCC.value.perTrail');
    expect(added.old).toBeUndefined();
    expect(added.new).toBe(15.5);
  });

  it('perCurrent/status などブロック外の変化は拾わない', () => {
    const d = diffValuations(OLD_VALS, NEW_VALS);
    expect(d.some((c) => c.field === 'perCurrent' || c.field === 'status')).toBe(false);
  });

  it('同一なら空配列', () => {
    expect(diffValuations(OLD_VALS, structuredClone(OLD_VALS))).toEqual([]);
  });

  it('HEAD に無い（old=null）場合は全件を追加として扱う', () => {
    const d = diffValuations(null, NEW_VALS);
    expect(d.length).toBeGreaterThan(0);
    expect(d.every((c) => c.old === undefined)).toBe(true);
  });

  it('ブロックがオブジェクトでない場合はブロック全体を 1 行で比べる', () => {
    const o = { valuations: { X: { quality: null } } };
    const n = { valuations: { X: { quality: { qScore: 3 } } } };
    expect(diffValuations(o, n)).toEqual([
      { symbol: 'X', block: 'quality', field: '(block)', old: null, new: { qScore: 3 } },
    ]);
  });

  it('ブロック定義は quality / value / sectorMedian', () => {
    expect(VALUATION_BLOCKS).toEqual(['quality', 'value', 'sectorMedian']);
  });
});

const OLD_OUTS = {
  outcomes: [
    {
      date: '2026-06-04',
      symbol: 'AAA',
      kind: 'action',
      dir: 'sell',
      outcome: 'hit',
      proposedOutcome: null,
      resolvedAt: null,
    },
    { date: '2026-06-19', symbol: 'BBB', kind: 'verdict', dir: 'cheap', proposedOutcome: null, resolvedAt: null },
    { date: '2026-06-20', symbol: '1234', dir: 'buy', proposedOutcome: null, resolvedAt: null, note: 'x' },
  ],
};
const NEW_OUTS = structuredClone(OLD_OUTS);
NEW_OUTS.outcomes[1].proposedOutcome = 'miss';
NEW_OUTS.outcomes[1].resolvedAt = '2026-10-04';
NEW_OUTS.outcomes[2].note = 'changed'; // 対象外フィールド

describe('diffOutcomes', () => {
  it('proposedOutcome / resolvedAt の変化だけを返す', () => {
    const d = diffOutcomes(OLD_OUTS, NEW_OUTS);
    expect(d).toEqual([
      {
        index: 1,
        symbol: 'BBB',
        date: '2026-06-19',
        kind: 'verdict',
        field: 'proposedOutcome',
        old: null,
        new: 'miss',
      },
      {
        index: 1,
        symbol: 'BBB',
        date: '2026-06-19',
        kind: 'verdict',
        field: 'resolvedAt',
        old: null,
        new: '2026-10-04',
      },
    ]);
  });

  it('kind 省略は action として表示', () => {
    const n = structuredClone(OLD_OUTS);
    n.outcomes[2].proposedOutcome = 'hit';
    expect(diffOutcomes(OLD_OUTS, n)[0].kind).toBe('action');
  });

  it('同一なら空・outcomes が無くても落ちない', () => {
    expect(diffOutcomes(OLD_OUTS, structuredClone(OLD_OUTS))).toEqual([]);
    expect(diffOutcomes(null, null)).toEqual([]);
  });
});

describe('fmtCell', () => {
  it('undefined は —、文字列はそのまま、その他は JSON', () => {
    expect(fmtCell(undefined)).toBe('—');
    expect(fmtCell(null)).toBe('null');
    expect(fmtCell('abc')).toBe('abc');
    expect(fmtCell(1.5)).toBe('1.5');
    expect(fmtCell({ a: 1 })).toBe('{"a":1}');
  });

  it('表を壊す | と改行をエスケープする', () => {
    expect(fmtCell('a|b\nc')).toBe('a\\|b c');
  });
});

describe('renderMarkdown', () => {
  it('サマリ（null 化の件数を含む）と銘柄×ブロックの表を出す', () => {
    const md = renderMarkdown({
      valuations: diffValuations(OLD_VALS, NEW_VALS),
      outcomes: diffOutcomes(OLD_OUTS, NEW_OUTS),
      date: '2026-10-04',
    });
    expect(md).toContain('# 週次バッチ 差分レポート（2026-10-04）');
    expect(md).toContain('| valuations.quality | 1 | 2 | 1 |');
    expect(md).toContain('| valuations.value | 2 | 3 | 0 |');
    expect(md).toContain('| valuations.sectorMedian | 1 | 3 | 0 |');
    expect(md).toContain('| verdict-outcomes | 1 | 2 | 0 |');
    expect(md).toContain('### quality');
    expect(md).toContain('| AAA | altmanZ | 2.1 | null |');
    expect(md).toContain('| CCC | perTrail | — | 15.5 |');
    expect(md).toContain('| 1 | BBB | 2026-06-19 | verdict | proposedOutcome | null | miss |');
  });

  it('差分が無ければ「変化なし」', () => {
    const md = renderMarkdown({ valuations: [], outcomes: [] });
    expect(md.match(/変化なし。/g)).toHaveLength(2);
  });

  it('notes を引用で出す', () => {
    const md = renderMarkdown({ valuations: [], outcomes: [], notes: ['HEAD に無い'] });
    expect(md).toContain('> HEAD に無い');
  });
});
