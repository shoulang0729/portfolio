// networth.test.js — v5（#577 負債・実物資産）＋ #594（新 netWorthComputed 式）対応の単体テスト
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
    // #594 新式: mfNetWorth − (realEstateMf − realAssetsTotal) − liabilitiesTotal
    // realEstateMf=180_000_000 → 補正=180M-155M=25M → 純資産=649045899-25M-87M=537045899
    realEstateMf: 180_000_000,
    netWorthComputed: 649_045_899 - (180_000_000 - 155_000_000) - 87_000_000,
  },
  liabilities: [
    { institution: 'テスト銀行A', name: '住宅ローン', tag: '自宅', balance: 32_000_000, asOf: '2026-07-19' },
    { institution: 'テスト銀行B', name: 'アパートローン', tag: '収益', balance: 55_000_000, asOf: '2026-07-19' },
  ],
};

// realEstateMf 未取得（nameMap 空等）の degrade ケース: 不動産補正 0 = mfNetWorth − liabilitiesTotal
const V5_NO_RE_DOC = {
  ...V4_DOC,
  totals: {
    ...V4_DOC.totals,
    liabilitiesTotal: 87_000_000,
    realAssetsTotal: 155_000_000,
    netWorthComputed: 649_045_899 - 87_000_000,
  },
  liabilities: V5_DOC.liabilities,
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
    expect(t.realEstateMf).toBeUndefined();
    expect(getMfLiabilities()).toBeNull();
  });

  it('v5 形で負債・実物資産・計算純資産を公開する', async () => {
    await loadDoc(V5_DOC);
    const t = getMfTotals();
    expect(t.liabilitiesTotal).toBe(87_000_000);
    expect(t.realAssetsTotal).toBe(155_000_000);
    expect(t.realEstateMf).toBe(180_000_000);
    expect(t.netWorthComputed).toBe(649_045_899 - (180_000_000 - 155_000_000) - 87_000_000);
    expect(getMfLiabilities()).toHaveLength(2);
    expect(getMfLiabilities()[0].tag).toBe('自宅');
  });

  it('#594 新式: 純資産 = mfNetWorth − (realEstateMf − realAssetsTotal) − liabilitiesTotal', async () => {
    await loadDoc(V5_DOC);
    const t = getMfTotals();
    const reCorrection = t.realEstateMf - t.realAssetsTotal;
    expect(t.netWorthComputed).toBe(t.netWorth - reCorrection - t.liabilitiesTotal);
  });

  it('#594 degrade: realEstateMf 未取得時は不動産補正 0（mfNetWorth − liabilitiesTotal）', async () => {
    await loadDoc(V5_NO_RE_DOC);
    const t = getMfTotals();
    expect(t.realEstateMf).toBeUndefined();
    expect(t.netWorthComputed).toBe(649_045_899 - 87_000_000);
  });

  it('#594: investable は holdings の金融カテゴリ合計 − 生活資金', async () => {
    await loadDoc(V4_DOC);
    const t = getMfTotals();
    // HOLDINGS: 日本株300M + 現金(JPY)60M + 現金(USD)10M + 暗号5M = 375M
    // investableGross = 375M（全カテゴリが INVESTABLE_CATS に該当）
    // investable = 375M - 20M = 355M
    expect(t.investable).toBe(375_000_000 - 20_000_000);
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
