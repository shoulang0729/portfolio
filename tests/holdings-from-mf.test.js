// holdings-from-mf.test.js — buildPositionsFromMf の単体テスト（Issue #534）
// fixture は data/mf-holdings.json の実データ形状（2026-07-06 時点）を縮約したもの。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { buildPositionsFromMf, MF_SYMBOL_OVERRIDES } from '../src/holdings-from-mf.js';
import { FUND_DEFS } from '../src/funds.js';

const ASOF = '2026-07-06';

/** 実データ形状の行を生成するヘルパー */
const row = (cat, name, value, extra = {}) => ({
  institution: 'マネックス証券',
  cat,
  name,
  value,
  cur: 'JPY',
  asOf: ASOF,
  ...extra,
});

/** 実データを縮約した fixture（要注意データを網羅） */
const mfFixture = () => ({
  asOf: ASOF,
  totals: { mfNetWorth: 576216196, imported: 531555469, excludedAccounts: ['相対契約'] },
  holdings: [
    // 日本株・ETF（ySymbol 完備）
    row('日本株・ETF', 'NEXT FUNDS TOPIX連動型上場投信', 26031510, { ySymbol: '1306.T', avgCost: 416.0, price: 432.0 }),
    // .T 欠落の東証コード（補完対象）
    row('日本株・ETF', 'ファーストリテイリング', 16900000, { ySymbol: '9983', avgCost: 43966.0, price: 84500.0 }),
    // 200A: cat が米国株・ETF だが実体は東証（オーバーライド対象）
    row('米国株・ETF', 'NEXT FUNDS 日経半導体株指数連動型上場投信', 34431300, {
      ySymbol: '200A',
      avgCost: 2645.0,
      price: 5710.0,
    }),
    // 米国株・ETF（円換算 price）
    row('米国株・ETF', 'アップル', 9251419, { ySymbol: 'AAPL', avgCost: 30699.0, price: 49739.0 }),
    row('米国株・ETF', 'ヴァンエック・ウラニウム・アンド原子力ETF', 3333982, {
      ySymbol: 'NLR',
      avgCost: 19037.0,
      price: 18522.0,
    }),
    // SPCX（SpaceX・ライブ検証不可 → isProxy 扱い）
    row('米国株・ETF', 'スペースX(スペース・エクスプロレーション・テクノロジーズ・コーポレーション)', 3132951, {
      ySymbol: 'SPCX',
      avgCost: 28503.0,
      price: 26108.0,
    }),
    // 投資信託（ySymbol なし → FUND_DEFS proxy 化）
    row('投資信託', 'eMAXIS Slim 全世界株式(オール・カントリー)', 63314312, { avgCost: 27955.0, price: 38009.0 }),
    // ひふみ投信 4 行（子どもNISA ×2 ＋ ひふみ投信 ×2）→ 表示タイルは 1 つに統合
    {
      ...row('投資信託', 'ひふみ投信', 5971085, { avgCost: 2933304.0, price: 2960945.0 }),
      institution: '陽太子どもNISA',
    },
    {
      ...row('投資信託', 'ひふみ投信', 5971085, { avgCost: 2933304.0, price: 2960945.0 }),
      institution: '恒太子どもNISA',
    },
    { ...row('投資信託', 'ひふみ投信', 22845870, { avgCost: 72959.0, price: 100914.0 }), institution: 'ひふみ投信' },
    { ...row('投資信託', 'ひふみ投信', 22845870, { avgCost: 72959.0, price: 100914.0 }), institution: 'ひふみ投信' },
    // 「合計評価額」集計ゴミ行（FUND_DEFS 不一致 → 除外）
    {
      ...row('投資信託', '合計評価額', 4046863, { avgCost: 0.0, price: 0.0 }),
      institution: 'SMBC信託銀行プレスティア(旧シティバンク)',
    },
    // 現金・預金／暗号資産（タイルに出さない）
    { ...row('現金・預金', 'お預り金・MRF・保証金', 24740951), institution: 'マネックス証券' },
    {
      ...row('現金・預金', 'プレスティア マルチマネー口座外貨普通預金 USD', 1085138, { cur: 'JPY' }),
      institution: 'SMBC信託銀行',
    },
    { ...row('暗号資産', 'ビットコイン残高', 1515138), institution: 'bitFlyer' },
    { ...row('暗号資産', 'イーサリアム残高', 1400885), institution: 'bitFlyer' },
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
    expect(spcx.price).toBe(26108);
    expect(spcx.value).toBe(3132951);
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
    expect(orukan.value).toBe(63314312);
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
    expect(p.price).toBe(5710); // 東証の生値なのでそのまま（ライブ更新が機能する）
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
    expect(bySymbol(out, '1306').shares).toBe(Math.round(26031510 / 432));
    expect(bySymbol(out, 'AAPL').shares).toBe(Math.round(9251419 / 49739)); // 両方円建て → 実株数近似
  });

  it('USD 銘柄は price=0 で初期化（円換算値の凍結防止）・pnl は円建てで整合', () => {
    const out = buildPositionsFromMf(mfFixture(), FUND_DEFS);
    const aapl = bySymbol(out, 'AAPL');
    expect(aapl.cur).toBe('USD');
    expect(aapl.price).toBe(0); // ライブ取得で USD 実価格が入る
    const shares = Math.round(9251419 / 49739);
    const cost = 30699 * shares;
    expect(aapl.pnl).toBe(9251419 - cost);
    expect(aapl.pnlPct).toBeCloseTo(((9251419 - cost) / cost) * 100, 6);
  });

  it('ひふみ投信 4 行は 1 タイルに統合（value 合算・avgCost 加重平均）', () => {
    const out = buildPositionsFromMf(mfFixture(), FUND_DEFS);
    const hifumi = out.filter((p) => p.symbol === 'ひふみ投信');
    expect(hifumi).toHaveLength(1);
    const p = hifumi[0];
    const totalValue = 5971085 * 2 + 22845870 * 2;
    expect(p.value).toBe(totalValue);
    expect(p.isProxy).toBe(true);
    expect(p.ySymbol).toBe('2516.T'); // FUND_DEFS の proxy
    // shares は行ごとの round(value/price) の合算
    const kidShares = Math.round(5971085 / 2960945);
    const adultShares = Math.round(22845870 / 100914);
    expect(p.shares).toBe(kidShares * 2 + adultShares * 2);
    // avgCost は shares 加重平均・pnl は value − Σ取得原価
    const totalCost = 2933304 * kidShares * 2 + 72959 * adultShares * 2;
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
