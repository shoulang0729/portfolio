// holdings-from-mf.test.js — buildPositionsFromMf の単体テスト（Issue #534）
// fixture は data/mf-holdings.json の実データ形状（2026-07-06 時点）を模した合成値（金額・口座名は架空）。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { buildPositionsFromMf, MF_SYMBOL_OVERRIDES } from '../src/holdings-from-mf.js';
import { FUND_DEFS } from '../src/funds.js';

const ASOF = '2026-07-06';

/** 実データ形状の行を生成するヘルパー（値はすべて合成値） */
const row = (cat, name, value, extra = {}) => ({
  institution: 'サンプル証券',
  cat,
  name,
  value,
  cur: 'JPY',
  asOf: ASOF,
  ...extra,
});

/** 実データ形状を模した合成 fixture（要注意データの型を網羅・金額/口座名は架空） */
const mfFixture = () => ({
  asOf: ASOF,
  totals: { mfNetWorth: 100000000, imported: 90000000, excludedAccounts: ['テスト除外口座'] },
  holdings: [
    // 日本株・ETF（ySymbol 完備）
    row('日本株・ETF', 'NEXT FUNDS TOPIX連動型上場投信', 10000000, { ySymbol: '1306.T', avgCost: 400.0, price: 500.0 }),
    // .T 欠落の東証コード（補完対象）
    row('日本株・ETF', 'ファーストリテイリング', 5000000, { ySymbol: '9983', avgCost: 40000.0, price: 50000.0 }),
    // 200A: cat が米国株・ETF だが実体は東証（オーバーライド対象）
    row('米国株・ETF', 'NEXT FUNDS 日経半導体株指数連動型上場投信', 8000000, {
      ySymbol: '200A',
      avgCost: 2000.0,
      price: 4000.0,
    }),
    // 米国株・ETF（円換算 price）
    row('米国株・ETF', 'アップル', 3000000, { ySymbol: 'AAPL', avgCost: 20000.0, price: 30000.0 }),
    row('米国株・ETF', 'ヴァンエック・ウラニウム・アンド原子力ETF', 2000000, {
      ySymbol: 'NLR',
      avgCost: 20000.0,
      price: 20000.0,
    }),
    // SPCX（SpaceX・ライブ検証不可 → isProxy 扱い）
    row('米国株・ETF', 'スペースX(スペース・エクスプロレーション・テクノロジーズ・コーポレーション)', 1000000, {
      ySymbol: 'SPCX',
      avgCost: 30000.0,
      price: 25000.0,
    }),
    // 投資信託（ySymbol なし → FUND_DEFS proxy 化）
    row('投資信託', 'eMAXIS Slim 全世界株式(オール・カントリー)', 20000000, { avgCost: 20000.0, price: 30000.0 }),
    // ひふみ投信 4 行（子ども口座 ×2 ＋ 通常口座 ×2）→ 表示タイルは 1 つに統合
    {
      ...row('投資信託', 'ひふみ投信', 3000000, { avgCost: 2500000.0, price: 3000000.0 }),
      institution: 'テスト子ども口座A',
    },
    {
      ...row('投資信託', 'ひふみ投信', 3000000, { avgCost: 2500000.0, price: 3000000.0 }),
      institution: 'テスト子ども口座B',
    },
    {
      ...row('投資信託', 'ひふみ投信', 10000000, { avgCost: 50000.0, price: 100000.0 }),
      institution: 'サンプル投信会社',
    },
    {
      ...row('投資信託', 'ひふみ投信', 10000000, { avgCost: 50000.0, price: 100000.0 }),
      institution: 'サンプル投信会社',
    },
    // 「合計評価額」集計ゴミ行（FUND_DEFS 不一致 → 除外）
    {
      ...row('投資信託', '合計評価額', 1000000, { avgCost: 0.0, price: 0.0 }),
      institution: 'サンプル信託銀行',
    },
    // 現金・預金／暗号資産（タイルに出さない）
    { ...row('現金・預金', 'お預り金・MRF・保証金', 5000000), institution: 'サンプル証券' },
    {
      ...row('現金・預金', 'テスト外貨普通預金 USD', 1000000, { cur: 'JPY' }),
      institution: 'サンプル信託銀行',
    },
    { ...row('暗号資産', 'ビットコイン残高', 1000000), institution: 'サンプル暗号資産取引所' },
    { ...row('暗号資産', 'イーサリアム残高', 1000000), institution: 'サンプル暗号資産取引所' },
  ],
});

const bySymbol = (list, symbol) => list.find((p) => p.symbol === symbol);

describe('buildPositionsFromMf', () => {
  it('mf が null / holdings 欠落なら空配列（KV フォールバック用）', () => {
    expect(buildPositionsFromMf(null, FUND_DEFS)).toEqual([]);
    expect(buildPositionsFromMf(undefined, FUND_DEFS)).toEqual([]);
    expect(buildPositionsFromMf({}, FUND_DEFS)).toEqual([]);
    expect(buildPositionsFromMf({ holdings: 'x' }, FUND_DEFS)).toEqual([]);
  });

  it('現金・預金／暗号資産はタイルに出ない', () => {
    const out = buildPositionsFromMf(mfFixture(), FUND_DEFS);
    expect(out.some((p) => p.cat === '現金・預金')).toBe(false);
    expect(out.some((p) => p.cat === '暗号資産')).toBe(false);
    expect(out.some((p) => p.name.includes('ビットコイン'))).toBe(false);
  });

  it('SPCX・NLR がタイルに出る（受け入れ条件 #534）', () => {
    const out = buildPositionsFromMf(mfFixture(), FUND_DEFS);
    const nlr = bySymbol(out, 'NLR');
    expect(nlr).toBeTruthy();
    expect(nlr.ySymbol).toBe('NLR');
    expect(nlr.cur).toBe('USD');
    const spcx = bySymbol(out, 'SPCX');
    expect(spcx).toBeTruthy();
    expect(spcx.isProxy).toBe(true);
    // 価格 0 /「…」で固定化させない: MF 実値の price/value を保持する
    expect(spcx.price).toBe(25000);
    expect(spcx.value).toBe(1000000);
    expect(spcx.cur).toBe('JPY');
  });

  it('投信は FUND_DEFS の proxy 経由（isProxy:true / ySymbol=proxy）で出る', () => {
    const out = buildPositionsFromMf(mfFixture(), FUND_DEFS);
    const orukan = bySymbol(out, 'オルカン');
    expect(orukan).toBeTruthy();
    expect(orukan.isProxy).toBe(true);
    expect(orukan.ySymbol).toBe('ACWI');
    expect(orukan.proxyName).toBe('iShares MSCI ACWI ETF');
    expect(orukan.cur).toBe('JPY');
    expect(orukan.value).toBe(20000000);
  });

  it('FUND_DEFS に一致しない投信行（合計評価額の集計ゴミ行）は除外される', () => {
    const out = buildPositionsFromMf(mfFixture(), FUND_DEFS);
    expect(out.some((p) => p.name.includes('合計評価額'))).toBe(false);
    // 除外はタイルのみ（totals は networth.js 側で全行算入のまま＝この関数は totals に触れない）
  });

  it('200A はオーバーライドで 200A.T / 日本株・ETF / JPY に補正される', () => {
    const out = buildPositionsFromMf(mfFixture(), FUND_DEFS);
    const p = bySymbol(out, '200A');
    expect(p).toBeTruthy();
    expect(p.ySymbol).toBe('200A.T');
    expect(p.cat).toBe('日本株・ETF');
    expect(p.cur).toBe('JPY');
    expect(p.price).toBe(4000); // 東証の生値なのでそのまま（ライブ更新が機能する）
  });

  it('東証コードの .T 欠落は補完される', () => {
    const out = buildPositionsFromMf(mfFixture(), FUND_DEFS);
    const p = bySymbol(out, '9983');
    expect(p).toBeTruthy();
    expect(p.ySymbol).toBe('9983.T');
    expect(p.cur).toBe('JPY');
  });

  it('shares は round(value / price) で補完される', () => {
    const out = buildPositionsFromMf(mfFixture(), FUND_DEFS);
    expect(bySymbol(out, '1306').shares).toBe(Math.round(10000000 / 500));
    expect(bySymbol(out, 'AAPL').shares).toBe(Math.round(3000000 / 30000)); // 両方円建て → 実株数近似
  });

  it('USD 銘柄は price=0 で初期化（円換算値の凍結防止）・pnl は円建てで整合', () => {
    const out = buildPositionsFromMf(mfFixture(), FUND_DEFS);
    const aapl = bySymbol(out, 'AAPL');
    expect(aapl.cur).toBe('USD');
    expect(aapl.price).toBe(0); // ライブ取得で USD 実価格が入る
    const shares = Math.round(3000000 / 30000);
    const cost = 20000 * shares;
    expect(aapl.pnl).toBe(3000000 - cost);
    expect(aapl.pnlPct).toBeCloseTo(((3000000 - cost) / cost) * 100, 6);
  });

  it('ひふみ投信 4 行は 1 タイルに統合（value 合算・avgCost 加重平均）', () => {
    const out = buildPositionsFromMf(mfFixture(), FUND_DEFS);
    const hifumi = out.filter((p) => p.symbol === 'ひふみ投信');
    expect(hifumi).toHaveLength(1);
    const p = hifumi[0];
    const totalValue = 3000000 * 2 + 10000000 * 2;
    expect(p.value).toBe(totalValue);
    expect(p.isProxy).toBe(true);
    expect(p.ySymbol).toBe('2516.T'); // FUND_DEFS の proxy
    // shares は行ごとの round(value/price) の合算
    const kidShares = Math.round(3000000 / 3000000);
    const adultShares = Math.round(10000000 / 100000);
    expect(p.shares).toBe(kidShares * 2 + adultShares * 2);
    // avgCost は shares 加重平均・pnl は value − Σ取得原価
    const totalCost = 2500000 * kidShares * 2 + 50000 * adultShares * 2;
    expect(p.avgCost).toBeCloseTo(totalCost / p.shares, 2);
    expect(p.pnl).toBe(totalValue - totalCost);
  });

  it('タイル数: fixture 16 行 → 8 タイル（現金2・暗号2・ゴミ1 除外、ひふみ 4→1）', () => {
    const out = buildPositionsFromMf(mfFixture(), FUND_DEFS);
    // 1306 / 9983 / 200A / AAPL / NLR / SPCX / オルカン / ひふみ投信
    expect(out).toHaveLength(8);
  });

  it('load-bearing フィールド名（positions 形）が不変', () => {
    const out = buildPositionsFromMf(mfFixture(), FUND_DEFS);
    for (const p of out) {
      for (const key of [
        'symbol',
        'name',
        'cat',
        'shares',
        'price',
        'avgCost',
        'value',
        'pnl',
        'pnlPct',
        'dayPct',
        'dayCh',
        'cur',
        'ySymbol',
      ]) {
        expect(p).toHaveProperty(key);
      }
      expect(p.dayPct).toBeNull();
      expect(p.dayCh).toBeNull();
      expect(typeof p.symbol).toBe('string');
      expect(typeof p.ySymbol).toBe('string');
      expect(p.ySymbol.length).toBeGreaterThan(0);
      // 内部作業用フィールドが漏れていない
      expect(p).not.toHaveProperty('_cost');
      expect(p).not.toHaveProperty('institution');
    }
  });

  it('price<=0 で shares を導出できない証券行は isProxy（value 固定）で残す', () => {
    const mf = {
      holdings: [row('日本株・ETF', 'テスト銘柄', 1000000, { ySymbol: '9999.T', avgCost: 0, price: 0 })],
    };
    const out = buildPositionsFromMf(mf, FUND_DEFS);
    expect(out).toHaveLength(1);
    expect(out[0].isProxy).toBe(true); // ライブ再計算 value=price×0 で 0 円化するのを防ぐ
    expect(out[0].value).toBe(1000000);
  });

  it('MF_SYMBOL_OVERRIDES はスキーマを持つ（200A→200A.T）', () => {
    expect(MF_SYMBOL_OVERRIDES['200A'].ySymbol).toBe('200A.T');
  });

  it('qty（#673・任意）の有無で出力は変わらない（後方互換・挙動不変）', () => {
    // 合成値のみ。qty 無しの既存データ（PR4 前）と qty 付きで同一のタイルになること
    const base = {
      asOf: '2026-10-03',
      totals: { mfNetWorth: 3000, imported: 3000, excludedAccounts: [] },
      holdings: [
        row('米国株・ETF', 'テスト米国株', 1000, { ySymbol: 'AAPL', avgCost: 10, price: 20 }),
        row('日本株・ETF', 'テスト日本株', 1000, { ySymbol: '1306.T', avgCost: 10, price: 20 }),
        row('投資信託', 'eMAXIS Slim 全世界株式(オール・カントリー)', 1000, { avgCost: 10, price: 20 }),
      ],
    };
    const withQty = {
      ...base,
      holdings: base.holdings.map((h, i) => (i < 2 ? { ...h, qty: 50 } : { ...h, qty: 12.5 })),
    };
    const outBase = buildPositionsFromMf(base, FUND_DEFS);
    const outQty = buildPositionsFromMf(withQty, FUND_DEFS);
    expect(outBase.length).toBeGreaterThan(0);
    expect(outQty).toEqual(outBase);
  });
});

describe('buildPositionsFromMf × 実データ（data/mf-holdings.json）', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const real = JSON.parse(readFileSync(join(dir, '..', 'data', 'mf-holdings.json'), 'utf8'));

  it('実データでも SPCX・NLR を含む証券タイルのみが生成される', () => {
    const out = buildPositionsFromMf(real, FUND_DEFS);
    expect(out.length).toBeGreaterThan(0);
    expect(bySymbol(out, 'SPCX')).toBeTruthy();
    expect(bySymbol(out, 'NLR')).toBeTruthy();
    expect(out.every((p) => ['日本株・ETF', '米国株・ETF', '投資信託'].includes(p.cat))).toBe(true);
    expect(out.every((p) => p.value > 0 && p.ySymbol)).toBe(true);
    // symbol はユニーク（同一シンボル統合済み）
    const symbols = out.map((p) => p.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it('実データの mf スキーマ（load-bearing キー）が期待どおり', () => {
    expect(real).toHaveProperty('asOf');
    expect(real.totals).toHaveProperty('imported');
    expect(Array.isArray(real.holdings)).toBe(true);
    for (const h of real.holdings) {
      expect(h).toHaveProperty('cat');
      expect(h).toHaveProperty('value');
      expect(h).toHaveProperty('cur');
    }
  });
});
