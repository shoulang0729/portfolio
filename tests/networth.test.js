// networth.test.js — v5/v6（#577 負債・実物資産・#594 数値モデル再定義）対応の単体テスト
// ★AC3 回帰: liabilities / v5/v6 totals が付いても、運用側の集計
// （imported/cash/crypto/securities/cashRatio/getMfManualAssets）が一切変化しないこと。
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { loadMfHoldings, getMfTotals, getMfManualAssets, getMfLiabilities } from '../src/networth.js';

const HOLDINGS = [
  { institution: 'マネックス証券', cat: '日本株・ETF', name: 'TOPIX連動', value: 300_000_000, cur: 'JPY' },
  { institution: '三井住友銀行', cat: '現金・預金', name: '普通預金', value: 60_000_000, cur: 'JPY' },
  { institution: 'SMBC信託', cat: '現金・預金', name: '外貨預金', value: 10_000_000, cur: 'USD' },
  { institution: 'bitFlyer', cat: '暗号資産', name: 'ビットコイン', value: 5_000_000, cur: 'JPY' },
];

const MF_NET_WORTH = 649_045_899;
const LIABILITIES_TOTAL = 87_000_000;
const REAL_ASSETS_TOTAL = 155_000_000;
const REAL_ESTATE_MF = 180_000_000;

const V4_DOC = {
  asOf: '2026-07-19',
  totals: { mfNetWorth: MF_NET_WORTH, imported: 375_000_000, excludedAccounts: [] },
  holdings: HOLDINGS,
};

const V5_DOC = {
  ...V4_DOC,
  totals: {
    ...V4_DOC.totals,
    liabilitiesTotal: LIABILITIES_TOTAL,
    realAssetsTotal: REAL_ASSETS_TOTAL,
    netWorthComputed: MF_NET_WORTH - (0 - REAL_ASSETS_TOTAL) - LIABILITIES_TOTAL,
  },
  liabilities: [
    { institution: 'テスト銀行A', name: '住宅ローン', tag: '自宅', balance: 32_000_000, asOf: '2026-07-19' },
    { institution: 'テスト銀行B', name: 'アパートローン', tag: '収益', balance: 55_000_000, asOf: '2026-07-19' },
  ],
};

const V6_DOC = {
  ...V4_DOC,
  totals: {
    ...V4_DOC.totals,
    liabilitiesTotal: LIABILITIES_TOTAL,
    realAssetsTotal: REAL_ASSETS_TOTAL,
    realEstateMf: REAL_ESTATE_MF,
    netWorthComputed: MF_NET_WORTH - (REAL_ESTATE_MF - REAL_ASSETS_TOTAL) - LIABILITIES_TOTAL,
  },
  liabilities: [
    { institution: 'テスト銀行A', name: '住宅ローン', tag: '自宅', balance: 32_000_000, asOf: '2026-07-19' },
    { institution: 'テスト銀行B', name: 'アパートローン', tag: '収益', balance: 55_000_000, asOf: '2026-07-19' },
  ],
};

/** fetch を差し替えて指定 doc をロードする */
async function loadDoc(doc) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(doc)) }))
  );
  await loadMfHoldings();
}

describe('networth v5（#577）', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('v4 形（負債なし）では v5/v6 フィールドが undefined・getMfLiabilities は null', async () => {
    await loadDoc(V4_DOC);
    const t = getMfTotals();
    expect(t.liabilitiesTotal).toBeUndefined();
    expect(t.realAssetsTotal).toBeUndefined();
    expect(t.netWorthComputed).toBeUndefined();
    expect(getMfLiabilities()).toBeNull();
  });

  it('v5 形で負債・実物資産・計算純資産を公開する（realEstateMf なし・degrade）', async () => {
    await loadDoc(V5_DOC);
    const t = getMfTotals();
    expect(t.liabilitiesTotal).toBe(LIABILITIES_TOTAL);
    expect(t.realAssetsTotal).toBe(REAL_ASSETS_TOTAL);
    expect(t.realEstateMf).toBeUndefined();
    expect(getMfLiabilities()).toHaveLength(2);
    expect(getMfLiabilities()[0].tag).toBe('自宅');
  });

  it('★AC3 回帰: 負債・実物資産の追加で運用側の集計が 1 円も変化しない', async () => {
    await loadDoc(V4_DOC);
    const t4 = getMfTotals();
    const m4 = getMfManualAssets();

    await loadDoc(V5_DOC);
    const t5 = getMfTotals();
    const m5 = getMfManualAssets();

    for (const k of ['netWorth', 'imported', 'cash', 'crypto', 'securities', 'dryPowder', 'cashRatio']) {
      expect(t5[k]).toBe(t4[k]);
    }
    expect(m5).toEqual(m4);
  });
});

describe('networth v6（#594 数値モデル再定義）', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('純資産 = mfNetWorth − (realEstateMf − realAssetsTotal) − liabilitiesTotal', async () => {
    await loadDoc(V6_DOC);
    const t = getMfTotals();
    const expected = MF_NET_WORTH - (REAL_ESTATE_MF - REAL_ASSETS_TOTAL) - LIABILITIES_TOTAL;
    expect(t.netWorthComputed).toBe(expected);
    expect(t.realEstateMf).toBe(REAL_ESTATE_MF);
    expect(t.realAssetsTotal).toBe(REAL_ASSETS_TOTAL);
  });

  it('realEstateMf 未設定時は不動産補正=0（degrade）', async () => {
    await loadDoc(V5_DOC);
    const t = getMfTotals();
    const expected = MF_NET_WORTH - (0 - REAL_ASSETS_TOTAL) - LIABILITIES_TOTAL;
    expect(t.netWorthComputed).toBe(expected);
    expect(t.realEstateMf).toBeUndefined();
  });

  it('総資産 == mfNetWorth', async () => {
    await loadDoc(V6_DOC);
    const t = getMfTotals();
    expect(t.netWorth).toBe(MF_NET_WORTH);
  });

  it('★AC3 回帰: realEstateMf 追加でも運用側集計は不変', async () => {
    await loadDoc(V5_DOC);
    const t5 = getMfTotals();

    await loadDoc(V6_DOC);
    const t6 = getMfTotals();

    for (const k of ['netWorth', 'imported', 'cash', 'crypto', 'securities', 'dryPowder', 'cashRatio']) {
      expect(t6[k]).toBe(t5[k]);
    }
  });
});
