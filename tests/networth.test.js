// networth.test.js — #594 数値モデル再定義（総資産=MF/運用=金融−生活資金/純資産=不動産haircut−負債）
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
    realEstateMf: 180_000_000,
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
    setMfHistoryLatest(null);
  });

  it('v4 形（負債なし）では v5 フィールドが undefined・getMfLiabilities は null', async () => {
    await loadDoc(V4_DOC);
    const t = getMfTotals();
    expect(t.liabilitiesTotal).toBeUndefined();
    expect(t.realAssetsTotal).toBeUndefined();
    expect(t.pureNetWorth).toBeUndefined();
    expect(getMfLiabilities()).toBeNull();
  });

  it('v5 形で負債・実物資産・負債リストを公開する', async () => {
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

    for (const k of ['netWorth', 'imported', 'cash', 'crypto', 'securities', 'dryPowder', 'cashRatio']) {
      expect(t5[k]).toBe(t4[k]);
    }
    expect(m5).toEqual(m4);
  });
});

describe('networth #594: 数値モデル再定義', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    setMfHistoryLatest(null);
  });

  it('総資産 == mfNetWorth（MF そのまま）', async () => {
    await loadDoc(V5_DOC);
    const t = getMfTotals();
    expect(t.netWorth).toBe(649_045_899);
  });

  it('純資産 == mfNetWorth − 不動産補正 − 負債（realEstateMf なし＝補正0）', async () => {
    await loadDoc(V5_DOC);
    const t = getMfTotals();
    // realEstateMf 未取得時: 補正 = 0 − 155M = −155M → netWorth − (−155M) − 87M
    // 実際: realEstateMf=0, realAssetsTotal=155M → 補正 = 0−155M = −155M
    // pureNetWorth = 649_045_899 − (0 − 155_000_000) − 87_000_000
    //              = 649_045_899 + 155_000_000 − 87_000_000 = 717_045_899
    expect(t.pureNetWorth).toBe(649_045_899 - (0 - 155_000_000) - 87_000_000);
  });

  it('純資産 == mfNetWorth − 不動産補正 − 負債（realEstateMf あり）', async () => {
    await loadDoc(V6_DOC);
    const t = getMfTotals();
    // realEstateMf=180M, realAssetsTotal=155M → 補正 = 180M−155M = 25M
    // pureNetWorth = 649_045_899 − 25_000_000 − 87_000_000 = 537_045_899
    expect(t.pureNetWorth).toBe(649_045_899 - (180_000_000 - 155_000_000) - 87_000_000);
    expect(t.realEstateMf).toBe(180_000_000);
  });

  it('運用資産 = 金融(imported) + 年金 + 保険 − 生活資金¥20M', async () => {
    await loadDoc(V5_DOC);
    setMfHistoryLatest({ pension: 30_000_000, insurance: 15_000_000 });
    const t = getMfTotals();
    // imported=375M, pension=30M, insurance=15M, EMERGENCY=20M
    // investableAssets = 375M + 30M + 15M − 20M = 400M
    expect(t.investableAssets).toBe(375_000_000 + 30_000_000 + 15_000_000 - 20_000_000);
  });

  it('運用資産: mf-history 未注入（年金・保険=0）でも計算可能', async () => {
    await loadDoc(V5_DOC);
    const t = getMfTotals();
    // pension=0, insurance=0
    expect(t.investableAssets).toBe(375_000_000 - 20_000_000);
  });

  it('v4 形（負債なし）では investableAssets・pureNetWorth が undefined', async () => {
    await loadDoc(V4_DOC);
    const t = getMfTotals();
    expect(t.investableAssets).toBeUndefined();
    expect(t.pureNetWorth).toBeUndefined();
  });
});
