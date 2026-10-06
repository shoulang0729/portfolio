// networth.test.js — v5（#577 負債・実物資産）対応の単体テスト
// ★AC3 回帰: liabilities / v5 totals が付いても、運用側の集計
// （imported/cash/crypto/securities/cashRatio/getMfManualAssets）が一切変化しないこと。
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { loadMfHoldings, getMfTotals, getMfManualAssets, getMfLiabilities } from '../src/networth.js';

const HOLDINGS = [
  { institution: 'サンプル証券', cat: '日本株・ETF', name: 'TOPIX連動', value: 300_000_000, cur: 'JPY' },
  { institution: 'テスト銀行', cat: '現金・預金', name: '普通預金', value: 60_000_000, cur: 'JPY' },
  { institution: 'サンプル信託銀行', cat: '現金・預金', name: '外貨預金', value: 10_000_000, cur: 'USD' },
  { institution: 'サンプル暗号資産取引所', cat: '暗号資産', name: 'ビットコイン', value: 5_000_000, cur: 'JPY' },
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
    for (const k of [
      'netWorth',
      'imported',
      'cash',
      'crypto',
      'securities',
      'dryPowder',
      'cashEquivalents',
      'investCash',
      'cashRatio',
    ]) {
      expect(t5[k]).toBe(t4[k]);
    }
    // Exposure look-through 用の非証券資産リストも完全一致
    expect(m5).toEqual(m4);
  });
});

// ── #753: 投資用キャッシュ＝現金・預金−生活防衛資金（0 下止め）＋cashEquivalents の評価額（合成値） ──
// 生活防衛資金はコードの定数（20,000,000）。設計書 §2.1 の例（単位は任意）を 400,000 倍した値。
describe('getMfTotals: cashEquivalents を現金比率に含める（#753）', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  const doc = (cashValue) => ({
    asOf: '2026-10-06',
    totals: { mfNetWorth: 500_000_000, imported: 400_000_000, excludedAccounts: [] },
    holdings: [
      {
        institution: 'サンプル証券',
        cat: '米国株',
        name: 'Synthetic Short Bond ETF',
        ySymbol: 'JPST',
        value: 16_000_000,
        cur: 'USD',
      },
      {
        institution: 'サンプル証券',
        cat: '米国株',
        name: 'Synthetic Gold ETF',
        ySymbol: 'GLDM',
        value: 24_000_000,
        cur: 'USD',
      },
      { institution: 'サンプル証券', cat: '投資信託', name: '合成短期債ファンド', value: 8_000_000, cur: 'JPY' },
      { institution: 'テスト銀行', cat: '現金・預金', name: '普通預金', value: cashValue, cur: 'JPY' },
    ],
  });

  it('例1: 現金・預金 150／生活防衛資金 50／JPST 40／imported 1,000 → 14.0%（GLDM は数えない）', async () => {
    await loadDoc(doc(60_000_000));
    const t = getMfTotals();
    expect(t.dryPowder).toBe(40_000_000);
    expect(t.cashEquivalents).toBe(16_000_000);
    expect(t.investCash).toBe(56_000_000);
    expect(t.cashRatio).toBeCloseTo(14.0, 10);
    expect(t.imported).toBe(400_000_000);
  });

  it('例2: 現金・預金が生活防衛資金を下回ると 0 で下止めしてから足す → 4.0%', async () => {
    await loadDoc(doc(12_000_000));
    const t = getMfTotals();
    expect(t.dryPowder).toBe(0);
    expect(t.investCash).toBe(16_000_000);
    expect(t.cashRatio).toBeCloseTo(4.0, 10);
  });

  it('ySymbol の照合は大文字化・前後空白除去（mf の行の ySymbol だけ）', async () => {
    const d = doc(60_000_000);
    d.holdings[0].ySymbol = ' jpst ';
    await loadDoc(d);
    expect(getMfTotals().cashEquivalents).toBe(16_000_000);
  });
});
