// networth.test.js — v5（#577 負債・実物資産）+ #594（数値モデル再定義）対応の単体テスト
// ★AC3 回帰: liabilities / v5 totals が付いても、運用側の集計
// （imported/cash/crypto/securities/cashRatio/getMfManualAssets）が一切変化しないこと。
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { loadMfHoldings, getMfTotals, getMfManualAssets, getMfLiabilities, setMfHistoryLatest } from '../src/networth.js';

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
  },
  liabilities: [
    { institution: 'テスト銀行A', name: '住宅ローン', tag: '自宅', balance: 32_000_000, asOf: '2026-07-19' },
    { institution: 'テスト銀行B', name: 'アパートローン', tag: '収益', balance: 55_000_000, asOf: '2026-07-19' },
  ],
};

const V6_DOC = {
  ...V5_DOC,
  totals: {
    ...V5_DOC.totals,
    realEstateMf: 200_000_000,
  },
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
    setMfHistoryLatest({ pension: null, insurance: null });
  });

  it('v4 形（負債なし）では v5 フィールドが undefined・getMfLiabilities は null', async () => {
    await loadDoc(V4_DOC);
    const t = getMfTotals();
    expect(t.liabilitiesTotal).toBeUndefined();
    expect(t.realAssetsTotal).toBeUndefined();
    expect(t.netWorthComputed).toBeUndefined();
    expect(getMfLiabilities()).toBeNull();
  });

  it('v5 形で負債・実物資産・計算純資産（#594 新式）を公開する', async () => {
    await loadDoc(V5_DOC);
    const t = getMfTotals();
    expect(t.liabilitiesTotal).toBe(87_000_000);
    expect(t.realAssetsTotal).toBe(155_000_000);
    // #594 新式: 純資産 = mfNetWorth − 不動産補正 − 負債（realEstateMf 未設定のため補正=0）
    expect(t.netWorthComputed).toBe(649_045_899 - 87_000_000);
    expect(t.netWorthV6).toBe(649_045_899 - 87_000_000);
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

describe('networth #594 数値モデル再定義', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    setMfHistoryLatest({ pension: null, insurance: null });
  });

  // HOLDINGS: imported=375M, cash=70M, crypto=5M, securities=300M
  // EMERGENCY_FUND=20M
  // investableAssets = imported − min(cash,20M) = 375M − 20M = 355M
  it('investableAssets: holdings のみ（年金・保険 0）', async () => {
    await loadDoc(V4_DOC);
    const t = getMfTotals();
    expect(t.investableAssets).toBe(375_000_000 - 20_000_000);
  });

  it('investableAssets: 年金・保険を setMfHistoryLatest で注入', async () => {
    await loadDoc(V4_DOC);
    setMfHistoryLatest({ pension: 10_000_000, insurance: 5_000_000 });
    const t = getMfTotals();
    expect(t.investableAssets).toBe(375_000_000 - 20_000_000 + 10_000_000 + 5_000_000);
  });

  it('netWorthV6: realEstateMf なし → 不動産補正=0・純資産=mfNetWorth−負債', async () => {
    await loadDoc(V5_DOC);
    const t = getMfTotals();
    // mfNetWorth=649045899, liabilities=87M, realEstateMf未設定→補正0
    expect(t.netWorthV6).toBe(649_045_899 - 87_000_000);
  });

  it('netWorthV6: realEstateMf あり → 不動産補正を適用', async () => {
    await loadDoc(V6_DOC);
    const t = getMfTotals();
    // mfNetWorth=649045899, realEstateMf=200M, realAssetsTotal=155M → 補正=45M
    // 純資産 = 649045899 - 45000000 - 87000000 = 517045899
    expect(t.realEstateMf).toBe(200_000_000);
    expect(t.netWorthV6).toBe(649_045_899 - (200_000_000 - 155_000_000) - 87_000_000);
  });

  it('v4 形（負債なし）では netWorthV6 が undefined', async () => {
    await loadDoc(V4_DOC);
    const t = getMfTotals();
    expect(t.netWorthV6).toBeUndefined();
    expect(t.netWorthComputed).toBeUndefined();
  });

  it('総資産（netWorth）= mfNetWorth（MFそのまま）', async () => {
    await loadDoc(V4_DOC);
    const t = getMfTotals();
    expect(t.netWorth).toBe(649_045_899);
  });
});
