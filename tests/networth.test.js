// networth.test.js — v6（#594 ネットワース数値モデル再定義）対応の単体テスト
// ★AC3 回帰: liabilities / v5/v6 totals が付いても、運用側の集計
// （imported/cash/crypto/securities/cashRatio/getMfManualAssets）が一切変化しないこと。
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { loadMfHoldings, loadMfHistory, getMfTotals, getMfManualAssets, getMfLiabilities } from '../src/networth.js';

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

// v6: realEstateMf あり（P1 パイプライン取得後の形）
const V6_DOC = {
  ...V5_DOC,
  totals: {
    ...V5_DOC.totals,
    realEstateMf: 180_000_000,
  },
};

const MF_HISTORY_DOC = {
  series: [
    { date: '2026-01-31', cash: 50_000_000, equity: 200_000_000, fund: 100_000_000, pension: 30_000_000, insurance: 15_000_000 },
    { date: '2026-07-19', cash: 70_000_000, equity: 250_000_000, fund: 120_000_000, pension: 35_000_000, insurance: 18_000_000 },
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

/** fetch を差し替えて mf-history をロードする */
async function loadHistory(histDoc) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(histDoc)) }))
  );
  await loadMfHistory();
}

describe('networth v5（#577）', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('v4 形（負債なし）では liabilitiesTotal/realAssetsTotal が undefined・getMfLiabilities は null', async () => {
    await loadDoc(V4_DOC);
    const t = getMfTotals();
    expect(t.liabilitiesTotal).toBeUndefined();
    expect(t.realAssetsTotal).toBeUndefined();
    expect(t.netWorthV6).toBeUndefined();
    expect(t.netWorthComputed).toBeUndefined();
    expect(getMfLiabilities()).toBeNull();
  });

  it('v5 形で負債・実物資産・純資産v6 を公開する', async () => {
    await loadDoc(V5_DOC);
    const t = getMfTotals();
    expect(t.liabilitiesTotal).toBe(87_000_000);
    expect(t.realAssetsTotal).toBe(155_000_000);
    // netWorthV6 = mfNetWorth(649_045_899) - 不動産補正(0・realEstateMf未取得) - 負債(87_000_000)
    expect(t.netWorthV6).toBe(649_045_899 - 0 - 87_000_000);
    expect(t.netWorthComputed).toBe(649_045_899 - 0 - 87_000_000);
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

describe('networth v6（#594 派生式）', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('realEstateMf あり: 不動産補正を計算して純資産v6 に反映する', async () => {
    await loadDoc(V6_DOC);
    const t = getMfTotals();
    // 不動産補正 = realEstateMf(180M) - realAssetsTotal(155M) = 25M
    expect(t.realEstateMf).toBe(180_000_000);
    expect(t.realEstateAdjustment).toBe(180_000_000 - 155_000_000);
    // 純資産v6 = mfNetWorth(649_045_899) - 補正(25M) - 負債(87M)
    expect(t.netWorthV6).toBe(649_045_899 - 25_000_000 - 87_000_000);
  });

  it('realEstateMf なし: 不動産補正=0 で degrade', async () => {
    await loadDoc(V5_DOC);
    const t = getMfTotals();
    expect(t.realEstateMf).toBeUndefined();
    expect(t.realEstateAdjustment).toBeUndefined();
    // 不動産補正なし → 純資産 = mfNetWorth - 負債
    expect(t.netWorthV6).toBe(649_045_899 - 87_000_000);
  });

  it('operationalAssets: holdings の金融合計 - 生活資金（年金・保険=0 の場合）', async () => {
    await loadDoc(V5_DOC);
    await loadHistory({ series: [] }); // history リセット
    const t = getMfTotals();
    // cash=70M(60+10), imported=375M, securities=375-70-5=300M
    // operationalAssets = max(0, cash - 20M) + (imported - cash) + pension(0) + insurance(0)
    // = 50M + 305M + 0 + 0 = 355M
    expect(t.operationalAssets).toBe(50_000_000 + (375_000_000 - 70_000_000));
  });

  it('operationalAssets: mf-history から年金・保険を加算する', async () => {
    await loadDoc(V5_DOC);
    await loadHistory(MF_HISTORY_DOC);
    const t = getMfTotals();
    // pension=35M, insurance=18M（最新レコード）
    // operationalAssets = 50M + 305M + 35M + 18M = 408M
    expect(t.operationalAssets).toBe(50_000_000 + (375_000_000 - 70_000_000) + 35_000_000 + 18_000_000);
  });

  it('★AC3 回帰: v6 フィールドは既存運用集計に影響しない', async () => {
    await loadDoc(V6_DOC);
    await loadHistory(MF_HISTORY_DOC);
    const t = getMfTotals();
    // 運用アロケーション入力値は不変（#577 §B 厳守）
    expect(t.imported).toBe(375_000_000);
    expect(t.cash).toBe(70_000_000);
    expect(t.crypto).toBe(5_000_000);
    expect(t.securities).toBe(375_000_000 - 70_000_000 - 5_000_000);
    expect(t.dryPowder).toBe(70_000_000 - 20_000_000);
    expect(t.cashRatio).toBeCloseTo((50_000_000 / 375_000_000) * 100, 5);
  });
});
