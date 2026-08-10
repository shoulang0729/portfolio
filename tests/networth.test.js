// networth.test.js — v5/v6（#577 #594 負債・実物資産・ネットワース新式）対応の単体テスト
// ★AC3 回帰: liabilities / v5 totals が付いても、運用側の集計
// （imported/cash/crypto/securities/cashRatio/getMfManualAssets）が一切変化しないこと。
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { loadMfHoldings, getMfTotals, getMfManualAssets, getMfLiabilities } from '../src/networth.js';

const HOLDINGS = [
  { institution: 'マネックス証券', cat: '日本株・ETF', name: 'TOPIX連動', value: 300_000_000, cur: 'JPY' },
  { institution: '三井住友銀行', cat: '現金・預金', name: '普通預金', value: 60_000_000, cur: 'JPY' },
  { institution: 'SMBC信託', cat: '現金・預金', name: '外貨預金', value: 10_000_000, cur: 'USD' },
  { institution: 'bitFlyer', cat: '暗号資産', name: 'ビットコイン', value: 5_000_000, cur: 'JPY' },
];

const V4_DOC = {
  asOf: '2026-07-19',
  totals: { mfNetWorth: 649_045_899, imported: 375_000_000, excludedAccounts: [] },
  holdings: HOLDINGS,
};

const V5_DOC = {
  ...V4_DOC,
  totals: {
    ...V4_DOC.totals,
    liabilitiesTotal: 87_000_000,
    realAssetsTotal: 155_000_000,
    netWorthComputed: 375_000_000 + 155_000_000 - 87_000_000,
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

  it('v4 形（負債なし）では v5 フィールドが undefined・getMfLiabilities は null', async () => {
    await loadDoc(V4_DOC);
    const t = getMfTotals();
    expect(t.liabilitiesTotal).toBeUndefined();
    expect(t.realAssetsTotal).toBeUndefined();
    expect(t.netWorthComputed).toBeUndefined();
    expect(getMfLiabilities()).toBeNull();
  });

  it('v5 形で負債・実物資産・計算純資産を公開する', async () => {
    await loadDoc(V5_DOC);
    const t = getMfTotals();
    expect(t.liabilitiesTotal).toBe(87_000_000);
    expect(t.realAssetsTotal).toBe(155_000_000);
    expect(t.netWorthComputed).toBe(375_000_000 + 155_000_000 - 87_000_000);
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

    // 運用アロケーションの入力になる値（Risk Exposure・stats バー・Valuation が読む）
    for (const k of ['netWorth', 'imported', 'cash', 'crypto', 'securities', 'dryPowder', 'cashRatio']) {
      expect(t5[k]).toBe(t4[k]);
    }
    // Exposure look-through 用の非証券資産リストも完全一致
    expect(m5).toEqual(m4);
  });
});

describe('networth v6（#594）ネットワース新式', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('v6: realEstateMf あり → 純資産 = mfNetWorth − (realEstateMf − realAssetsTotal) − 負債', async () => {
    const mfNetWorth = 649_045_899;
    const realEstateMf = 200_000_000;
    const realAssetsTotal = 155_000_000;
    const liabilitiesTotal = 87_000_000;
    const reAdj = realEstateMf - realAssetsTotal;
    const expected = mfNetWorth - reAdj - liabilitiesTotal;
    const doc = {
      asOf: '2026-07-21',
      totals: { mfNetWorth, imported: 375_000_000, liabilitiesTotal, realAssetsTotal, realEstateMf },
      holdings: HOLDINGS,
      liabilities: [{ institution: 'テスト銀行', name: '住宅ローン', tag: '自宅', balance: liabilitiesTotal, asOf: '2026-07-21' }],
    };
    await loadDoc(doc);
    const t = getMfTotals();
    expect(t.realEstateMf).toBe(realEstateMf);
    expect(t.netWorthComputed).toBe(expected);
  });

  it('v6: realEstateMf なし（degrade）→ 純資産 = mfNetWorth − 負債（不動産補正0）', async () => {
    const mfNetWorth = 649_045_899;
    const liabilitiesTotal = 87_000_000;
    const realAssetsTotal = 155_000_000;
    const doc = {
      asOf: '2026-07-21',
      totals: { mfNetWorth, imported: 375_000_000, liabilitiesTotal, realAssetsTotal },
      holdings: HOLDINGS,
      liabilities: [{ institution: 'テスト銀行', name: '住宅ローン', tag: '自宅', balance: liabilitiesTotal, asOf: '2026-07-21' }],
    };
    await loadDoc(doc);
    const t = getMfTotals();
    expect(t.realEstateMf).toBeUndefined();
    expect(t.netWorthComputed).toBe(mfNetWorth - liabilitiesTotal);
  });

  it('v6: 運用資産（investableAssets）= imported − 生活資金¥20M', async () => {
    const imported = 375_000_000;
    const doc = {
      asOf: '2026-07-21',
      totals: { mfNetWorth: 649_045_899, imported, liabilitiesTotal: 87_000_000, realAssetsTotal: 155_000_000 },
      holdings: HOLDINGS,
      liabilities: [{ institution: 'テスト銀行', name: '住宅ローン', tag: '自宅', balance: 87_000_000, asOf: '2026-07-21' }],
    };
    await loadDoc(doc);
    const t = getMfTotals();
    expect(t.investableAssets).toBe(imported - 20_000_000);
  });

  it('v6: 負債なし（v4 形）では investableAssets が undefined', async () => {
    await loadDoc(V4_DOC);
    const t = getMfTotals();
    expect(t.investableAssets).toBeUndefined();
    expect(t.netWorthComputed).toBeUndefined();
  });
});
