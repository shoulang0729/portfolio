// networth.test.js — v5（#577 負債・実物資産）対応の単体テスト
//               v6（#594 純資産式・運用資産式再定義）
// ★AC3 回帰: liabilities / v5 totals が付いても、運用側の集計
// （imported/cash/crypto/securities/cashRatio/getMfManualAssets）が一切変化しないこと。
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { loadMfHoldings, getMfTotals, getMfManualAssets, getMfLiabilities, loadMfHistory } from '../src/networth.js';

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
    realEstateMf: 60_000_000,
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

/** fetch を差し替えて doc + mf-history をロードする */
async function loadDocWithHistory(doc, historyLatest) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const s = String(url);
      if (s.includes('mf-history')) {
        return { ok: true, json: async () => ({ series: [historyLatest] }) };
      }
      return { ok: true, json: async () => JSON.parse(JSON.stringify(doc)) };
    })
  );
  await loadMfHoldings();
  await loadMfHistory();
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

  it('v5 形で負債・実物資産を公開する', async () => {
    await loadDoc(V5_DOC);
    const t = getMfTotals();
    expect(t.liabilitiesTotal).toBe(87_000_000);
    expect(t.realAssetsTotal).toBe(155_000_000);
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

describe('networth v6（#594 数値モデル再定義）', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('純資産 = mfNetWorth − (realEstateMf − realAssetsTotal) − liabilitiesTotal', async () => {
    await loadDoc(V6_DOC);
    const t = getMfTotals();
    // realEstateMf=60M, realAssetsTotal=155M → 補正=60M-155M=-95M
    // 純資産 = 649_045_899 − (60M − 155M) − 87M = 649_045_899 + 95M − 87M
    const expected = 649_045_899 - (60_000_000 - 155_000_000) - 87_000_000;
    expect(t.netWorthComputed).toBe(expected);
    expect(t.realEstateMf).toBe(60_000_000);
  });

  it('realEstateMf 未設定時は補正ゼロで degrade（純資産 = mfNetWorth − liabilitiesTotal）', async () => {
    await loadDoc(V5_DOC);
    const t = getMfTotals();
    // realEstateMf 未設定 → realEstateCorrection=0 で degrade
    // 純資産 = 649_045_899 − 0 − 87M
    const expected = 649_045_899 - 0 - 87_000_000;
    expect(t.netWorthComputed).toBe(expected);
    expect(t.realEstateMf).toBeUndefined();
  });

  it('運用資産 = imported + pension + insurance − EMERGENCY_FUND（mf-history あり）', async () => {
    const historyRow = { date: '2026-07-19', pension: 30_000_000, insurance: 15_000_000 };
    await loadDocWithHistory(V5_DOC, historyRow);
    const t = getMfTotals();
    // imported=375M, pension=30M, insurance=15M, EMERGENCY_FUND=20M
    // 運用資産 = 375M + 30M + 15M − 20M = 400M
    expect(t.investmentAssets).toBe(375_000_000 + 30_000_000 + 15_000_000 - 20_000_000);
  });

  it('運用資産 = mf-history なし時は pension/insurance を 0 で degrade', async () => {
    await loadDoc(V5_DOC);
    const t = getMfTotals();
    // imported=375M, pension=0, insurance=0, EMERGENCY_FUND=20M
    // 運用資産 = 375M − 20M = 355M
    expect(t.investmentAssets).toBe(375_000_000 - 20_000_000);
  });

  it('★AC3 回帰（v6）: v6 fields 追加で Risk Exposure 用の集計が変化しない', async () => {
    await loadDoc(V5_DOC);
    const t5 = getMfTotals();

    await loadDoc(V6_DOC);
    const t6 = getMfTotals();

    for (const k of ['netWorth', 'imported', 'cash', 'crypto', 'securities', 'dryPowder', 'cashRatio']) {
      expect(t6[k]).toBe(t5[k]);
    }
  });
});
