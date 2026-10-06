// Tests for worker/src/order-sheet-calc.js（注文表 PR1・#670）
// すべて合成値・架空ティッカー。為替は計算を追いやすいよう 1 USD = 100 JPY とする。

import { describe, it, expect } from 'vitest';

import { buildOrderSheet } from '../worker/src/order-sheet-calc.js';
import { applyEvent } from '../worker/src/order-plan.js';

const FX = 100;
const NOW = '2026-01-10T00:00:00Z';
const usd = (x) => x * FX; // USD → JPY（mf の value は円）

function stage(over = {}) {
  return {
    id: 's1',
    side: 'buy',
    amountUsd: 30000,
    dropPct: null,
    limit: null,
    qty: null,
    state: 'working',
    placedAt: null,
    orderedQty: null,
    orderedLimit: null,
    qtyAtPlace: null,
    filledQty: 0,
    filledAt: null,
    fillSource: null,
    ...over,
  };
}

function strategy(over = {}) {
  return {
    convictionPct: { high: 3 },
    themeCaps: {
      semiconductor: { cap: 15, members: ['SSS'] },
      megatech: { cap: 20, members: ['AAA', 'BBB'] },
      power: { cap: 10, members: ['PPP'] },
    },
    aiTech: { themes: ['semiconductor', 'megatech'], capPct: 29 },
    stress: {
      tolerancePct: 20,
      nonEquity: ['CSH'],
      scenarios: [
        {
          id: 'ai-crash',
          label: 'AI −40%・他の株 −15%',
          shocks: [
            { group: 'aiTech', pct: -40 },
            { group: 'otherEquity', pct: -15 },
          ],
        },
        { id: 'semi-crash', label: '半導体 −50%', shocks: [{ group: 'theme:semiconductor', pct: -50 }] },
      ],
    },
    orderSheet: { cashFloorPct: 12, rebaseMovePct: 5 },
    ...over,
  };
}

/** 総資産 $1,000,000（= 1 億円）の合成ポートフォリオ */
function baseNetworth({ jpyCashUsd = 350000, usdCashUsd = 0, extra = [] } = {}) {
  const rows = [
    { institution: 'BankY', cat: '現金・預金', name: '普通預金', value: usd(jpyCashUsd), cur: 'JPY' },
    { institution: 'BrokerX', cat: '現金・預金', name: 'USD 預り金', value: usd(usdCashUsd), cur: 'JPY' },
    { institution: 'BrokerX', cat: '米国株・ETF', name: 'AAA', ySymbol: 'AAA', value: usd(60000), cur: 'JPY' },
    { institution: 'BrokerX', cat: '米国株・ETF', name: 'CSH', ySymbol: 'CSH', value: usd(50000), cur: 'JPY' },
    ...extra,
  ];
  const used = rows.reduce((a, r) => a + r.value, 0);
  rows.push({
    institution: 'BrokerX',
    cat: '投資信託',
    name: '合成ファンド',
    value: usd(1_000_000) - used,
    cur: 'JPY',
  });
  return { asOf: '2026-01-09', totals: { imported: usd(1_000_000) }, holdings: rows };
}

function basePlan(symbols, funding = {}) {
  return {
    schemaVersion: 1,
    rev: 7,
    updatedAt: '2026-01-01T00:00:00Z',
    funding: {
      sweepSymbol: 'CSH',
      useUsdCash: true,
      usdCashRows: [{ institution: 'BrokerX', name: 'USD' }],
      ...funding,
    },
    symbols,
  };
}

function aaa(over = {}) {
  return {
    tier: 'thick',
    targetUsd: 100000,
    lot: 1,
    basePrice: 400,
    baseAt: '2026-01-01T00:00:00Z',
    baseEvent: 'manual',
    note: '',
    stages: [
      stage({ id: 's1', amountUsd: 30000, dropPct: 8 }),
      stage({ id: 's2', amountUsd: 40000, dropPct: 20, state: 'waiting' }),
      stage({ id: 's3', amountUsd: 50000, dropPct: 30, state: 'waiting' }),
    ],
    ...over,
  };
}

function build({ plan, nw = baseNetworth(), prices = { AAA: 400, CSH: 50 }, strat = strategy(), ...rest } = {}) {
  return buildOrderSheet({
    plan,
    strategy: strat,
    networth: nw,
    prices,
    fx: { usdJpy: FX, asOf: NOW },
    now: NOW,
    ...rest,
  });
}

const orderOf = (sheet, sym) => sheet.orders.find((o) => o.symbol === sym && o.role !== 'funding');
const fundingRow = (sheet) => sheet.orders.find((o) => o.role === 'funding');
const ladderOf = (sheet, sym) => sheet.ladders.find((l) => l.symbol === sym);

describe('buildOrderSheet: 基本', () => {
  it('plan 未投入は null', () => {
    expect(buildOrderSheet({ plan: null, networth: baseNetworth(), fx: FX, now: NOW })).toBe(null);
  });

  it('meta: 分母は totals.imported ÷ USDJPY・planRev・同期日・注意文', () => {
    const s = build({ plan: basePlan({ AAA: aaa() }) });
    expect(s.asOf).toBe('2026-01-10T00:00:00.000Z');
    expect(s.meta.denominatorUsd).toBe(1_000_000);
    expect(s.meta.planRev).toBe(7);
    expect(s.meta.holdingsAsOf).toBe('2026-01-09');
    expect(s.meta.holdingsLagNote).toMatch(/未反映の可能性/);
    expect(s.meta.fxUsdJpy).toBe(FX);
    expect(s.meta.qtyAvailable).toBe(false);
  });

  it('入力の plan を変更しない', () => {
    const plan = basePlan({ AAA: aaa() });
    const before = JSON.stringify(plan);
    build({ plan });
    expect(JSON.stringify(plan)).toBe(before);
  });
});

describe('§6.2 指値と株数（前後比較例）', () => {
  it.each([
    [400, 368, 81, 29808],
    [380, 350, 85, 29750],
    [420, 386, 77, 29722],
  ])('基準 $%d → 指値 $%d × %d 株 = $%d（金額を超えない）', (base, limit, qty, amount) => {
    const s = build({ plan: basePlan({ AAA: aaa({ basePrice: base }) }), prices: { AAA: base, CSH: 50 } });
    const o = orderOf(s, 'AAA');
    expect(o).toMatchObject({ limit, qty, amountUsd: amount, status: 'toPlace' });
    expect(o.amountUsd).toBeLessThanOrEqual(30000);
  });

  it('指値を変えても段の金額を保つ（rebase 後に株数が増える）', () => {
    const plan = basePlan({ AAA: aaa() });
    const before = orderOf(build({ plan }), 'AAA');
    const rebased = applyEvent(
      plan,
      { type: 'rebase', symbol: 'AAA', basePrice: 380, event: 'CPI', includeWorking: true },
      { now: NOW }
    ).plan;
    const after = orderOf(build({ plan: rebased, prices: { AAA: 380, CSH: 50 } }), 'AAA');
    expect(before).toMatchObject({ limit: 368, qty: 81 });
    expect(after).toMatchObject({ limit: 350, qty: 85 });
    expect(Math.abs(after.amountUsd - before.amountUsd)).toBeLessThan(350);
  });

  it('発注済みの段は orderedLimit × orderedQty を表示し再計算しない', () => {
    const p = aaa();
    Object.assign(p.stages[0], { placedAt: '2026-01-08T00:00:00Z', orderedQty: 70, orderedLimit: 360 });
    const o = orderOf(build({ plan: basePlan({ AAA: p }) }), 'AAA');
    expect(o).toMatchObject({ status: 'placed', limit: 360, qty: 70, amountUsd: 25200 });
  });

  it('約定後の $ と総資産%・目標%を併記', () => {
    const o = orderOf(build({ plan: basePlan({ AAA: aaa() }) }), 'AAA');
    expect(o).toMatchObject({
      curUsd: 60000,
      curPct: 6,
      afterUsd: 89808,
      afterPct: 9,
      targetUsd: 100000,
      targetPct: 10,
      currentPrice: 400,
      inTheMoney: false,
    });
  });
});

describe('§6.3 1 銘柄 1 段', () => {
  it('orders には working 段だけ・残りは ladders に waiting・next は次の段', () => {
    const s = build({ plan: basePlan({ AAA: aaa() }) });
    expect(s.orders.filter((o) => o.symbol === 'AAA')).toHaveLength(1);
    expect(orderOf(s, 'AAA').stageId).toBe('s1');
    expect(orderOf(s, 'AAA').next).toMatchObject({
      stageId: 's2',
      limit: 320,
      qty: 125,
      dropPct: 20,
      text: '約定したら次は $320×125（基準比 −20%）',
    });
    expect(ladderOf(s, 'AAA').stages.map((x) => x.display)).toEqual(['toPlace', 'waiting', 'waiting']);
  });

  it('約定で次の段が要発注として出る', () => {
    const plan = basePlan({ AAA: aaa() });
    const filled = applyEvent(plan, { type: 'filled', symbol: 'AAA', stageId: 's1' }, { now: NOW }).plan;
    const s = build({ plan: filled });
    expect(orderOf(s, 'AAA')).toMatchObject({ stageId: 's2', status: 'toPlace', limit: 320, qty: 125 });
    expect(ladderOf(s, 'AAA').stages.map((x) => x.display)).toEqual(['filled', 'toPlace', 'waiting']);
  });

  it('最終段の next は「最終段」', () => {
    const p = aaa();
    p.stages[0].state = 'filled';
    p.stages[1].state = 'filled';
    p.stages[2].state = 'working';
    expect(orderOf(build({ plan: basePlan({ AAA: p }) }), 'AAA').next).toMatchObject({ stageId: null, text: '最終段' });
  });

  it('保存値が壊れていても最初の未完了段を working として表示し警告', () => {
    const p = aaa();
    p.stages[0].state = 'waiting';
    p.stages[1].state = 'working';
    const s = build({ plan: basePlan({ AAA: p }) });
    expect(orderOf(s, 'AAA').stageId).toBe('s1');
    expect(s.meta.warnings.join()).toMatch(/不整合/);
  });

  it('一部約定は status=partial で、残りの株数だけ資金計算に入る', () => {
    const p = aaa();
    Object.assign(p.stages[0], { placedAt: '2026-01-08T00:00:00Z', orderedQty: 81, orderedLimit: 368, filledQty: 31 });
    const s = build({ plan: basePlan({ AAA: p }) });
    expect(orderOf(s, 'AAA')).toMatchObject({ status: 'partial', qty: 81, filledQty: 31 });
    expect(s.funding.usd.buyWorking).toBe(50 * 368);
  });
});

describe('§6.4 出さない条件', () => {
  it('目標到達の銘柄に buy 行を出さない（HOLD）・sell 行も生成しない', () => {
    const s = build({ plan: basePlan({ AAA: aaa({ targetUsd: 50000 }) }) });
    expect(orderOf(s, 'AAA')).toBeUndefined();
    expect(s.orders.filter((o) => o.side === 'sell')).toEqual([]);
    const l = ladderOf(s, 'AAA');
    expect(l.hold).toBe('targetReached');
    expect(l.stages.every((x) => x.suppressed === 'targetReached')).toBe(true);
    expect(s.funding.allStages.buyTotal).toBe(0);
  });

  it('テーマ上限到達で buy 停止（themeCapReached）・テーマ超過でも売りを生成しない', () => {
    // power テーマ（cap 10%）に PPP を 12% 保有
    const nw = baseNetworth({
      extra: [{ cat: '米国株・ETF', name: 'PPP', ySymbol: 'PPP', value: usd(120000), cur: 'JPY' }],
    });
    const ppp = aaa({ tier: 'theme', targetUsd: null, basePrice: 100 });
    const s = build({ plan: basePlan({ PPP: ppp }), nw, prices: { PPP: 100, CSH: 50 } });
    expect(orderOf(s, 'PPP')).toBeUndefined();
    expect(ladderOf(s, 'PPP').hold).toBe('themeCapReached');
    expect(s.orders).toEqual([]);
  });

  it('目標超過・テーマ超過の状態でも、plan に無い売りは出ない（sell は設定された段のみ）', () => {
    const nw = baseNetworth({
      extra: [
        { cat: '米国株・ETF', name: 'PPP', ySymbol: 'PPP', value: usd(150000), cur: 'JPY' },
        { cat: '米国株・ETF', name: 'XXX', ySymbol: 'XXX', value: usd(20000), cur: 'JPY', qty: 400 },
      ],
    });
    const plan = basePlan({
      AAA: aaa({ targetUsd: 10000 }),
      PPP: aaa({ tier: 'theme', targetUsd: 20000, basePrice: 100 }),
      XXX: {
        tier: 'exit',
        targetUsd: null,
        lot: 1,
        basePrice: null,
        stages: [stage({ id: 's1', side: 'sell', amountUsd: null, qty: 'all' })],
      },
    });
    const s = build({ plan, nw, prices: { AAA: 400, PPP: 100, XXX: 50, CSH: 50 } });
    const sells = s.orders.filter((o) => o.side === 'sell');
    expect(sells.map((o) => o.symbol)).toEqual(['XXX']);
    // 全部売る銘柄は保有株数ぴったり
    expect(sells[0]).toMatchObject({ qty: 400, limit: null, amountUsd: 20000, inTheMoney: true });
    expect(s.orders.filter((o) => o.side === 'buy')).toEqual([]);
  });

  it('約定後に目標を超える段は止めずに exceedsTargetAfterFill を付ける', () => {
    const o = orderOf(build({ plan: basePlan({ AAA: aaa({ targetUsd: 80000 }) }) }), 'AAA');
    expect(o.flags).toContain('exceedsTargetAfterFill');
    expect(o.notes.join()).toMatch(/約定後 目標超過 \$9,808/);
  });

  it('現金 12% 割れ: 最深段（waiting）を停止し資金計算から外す', () => {
    // 現金 $310K → (310K − 200K) / 1M = 11% < 12%
    const nw = baseNetworth({ jpyCashUsd: 310000 });
    const s = build({ plan: basePlan({ AAA: aaa() }), nw });
    expect(s.cash).toEqual({ pct: 11, floorPct: 12, guardActive: true });
    const st = ladderOf(s, 'AAA').stages;
    expect(st.map((x) => x.suppressed)).toEqual([null, null, 'cashFloor']);
    expect(orderOf(s, 'AAA').next.stageId).toBe('s2');
    // 全段の買い = s1 + s2 だけ（s3 を外す）
    expect(s.funding.allStages.buyTotal).toBe(29808 + 320 * 125);
  });

  it('現金ガードでも working 段は止めず cashFloorDeepest フラグだけ', () => {
    const nw = baseNetworth({ jpyCashUsd: 310000 });
    const p = aaa({ stages: [stage({ id: 's1', amountUsd: 30000, dropPct: 8 })] });
    const s = build({ plan: basePlan({ AAA: p }), nw });
    const o = orderOf(s, 'AAA');
    expect(o).toBeDefined();
    expect(o.flags).toContain('cashFloorDeepest');
    expect(ladderOf(s, 'AAA').stages[0].suppressed).toBe(null);
  });

  it('現金 12% 以上ならガードしない', () => {
    const s = build({ plan: basePlan({ AAA: aaa() }) });
    expect(s.cash).toEqual({ pct: 15, floorPct: 12, guardActive: false });
    expect(ladderOf(s, 'AAA').stages.every((x) => x.suppressed === null)).toBe(true);
  });
});

describe('§6.7 現金比率に cashEquivalents を含める（#753・設計書 §2.1 の前後比較例）', () => {
  // 合成値。総資産 $1M（= 1 億円）・生活資金 ¥20M（= $200K）・現金・預金 $300K・JPST $80K・GLDM $120K
  // 前（JPST 含めず）: (300K − 200K) / 1M = 10.0% → guardActive=true
  // 後（#753）     : (300K − 200K + 80K) / 1M = 18.0% → guardActive=false
  function cashNetworth({ cashUsd = 300000, jpstUsd = 80000, jpstSym = 'JPST' } = {}) {
    const rows = [
      { institution: 'BankY', cat: '現金・預金', name: '普通預金', value: usd(cashUsd), cur: 'JPY' },
      { institution: 'BrokerX', cat: '米国株・ETF', name: 'GLDM', ySymbol: 'GLDM', value: usd(120000), cur: 'JPY' },
      { institution: 'BrokerX', cat: '米国株・ETF', name: 'AAA', ySymbol: 'AAA', value: usd(60000), cur: 'JPY' },
    ];
    if (jpstUsd) {
      rows.push({
        institution: 'BrokerX',
        cat: '米国株・ETF',
        name: 'JPST',
        ySymbol: jpstSym,
        value: usd(jpstUsd),
        cur: 'JPY',
      });
    }
    const used = rows.reduce((a, r) => a + r.value, 0);
    rows.push({
      institution: 'BrokerX',
      cat: '投資信託',
      name: '合成ファンド',
      value: usd(1_000_000) - used,
      cur: 'JPY',
    });
    return { asOf: '2026-01-09', totals: { imported: usd(1_000_000) }, holdings: rows };
  }
  const prices = { AAA: 400, CSH: 50, JPST: 50, GLDM: 60 };

  it('前: cashEquivalents を数えなければ 10.0% で現金ガード（参照: JPST 無し）', () => {
    const s = build({ plan: basePlan({ AAA: aaa() }), nw: cashNetworth({ jpstUsd: 0 }), prices });
    expect(s.cash).toEqual({ pct: 10, floorPct: 12, guardActive: true });
    expect(ladderOf(s, 'AAA').stages.map((x) => x.suppressed)).toEqual([null, null, 'cashFloor']);
  });

  it('後: JPST の評価額を足すと 18.0% でガードが外れる（true → false）', () => {
    // (max(0, 300K − 200K) + 80K) / 1M = 18%
    const s = build({ plan: basePlan({ AAA: aaa() }), nw: cashNetworth(), prices });
    expect(s.cash).toEqual({ pct: 18, floorPct: 12, guardActive: false });
    expect(ladderOf(s, 'AAA').stages.every((x) => x.suppressed === null)).toBe(true);
  });

  it('境目: JPST $10K なら 11.0%（ガード）・$20K なら 12.0%（ガードしない）', () => {
    const a = build({ plan: basePlan({ AAA: aaa() }), nw: cashNetworth({ jpstUsd: 10000 }), prices });
    expect(a.cash).toEqual({ pct: 11, floorPct: 12, guardActive: true });
    const b = build({ plan: basePlan({ AAA: aaa() }), nw: cashNetworth({ jpstUsd: 20000 }), prices });
    expect(b.cash).toEqual({ pct: 12, floorPct: 12, guardActive: false });
  });

  it('GLDM は現金に数えない', () => {
    const s = build({
      plan: basePlan({ AAA: aaa() }),
      nw: cashNetworth({ jpstUsd: 0 }),
      prices,
      strat: strategy({ cashEquivalents: ['JPST'] }),
    });
    expect(s.cash.pct).toBe(10);
  });

  it('現金・預金が生活防衛資金を下回るときは 0 で下止めしてから足す', () => {
    // max(0, 100K − 200K) + 80K = 80K → 8.0%（下止めしないと −2.0%）
    const s = build({ plan: basePlan({ AAA: aaa() }), nw: cashNetworth({ cashUsd: 100000 }), prices });
    expect(s.cash).toEqual({ pct: 8, floorPct: 12, guardActive: true });
  });

  it('strategy に cashEquivalents が無ければ既定（JPST/SGOV/BIL/SHV）で数える', () => {
    const strat = strategy();
    expect(strat.cashEquivalents).toBeUndefined();
    const s = build({ plan: basePlan({ AAA: aaa() }), nw: cashNetworth({ jpstSym: 'SGOV' }), prices, strat });
    expect(s.cash.pct).toBe(18);
  });

  it('strategy の cashEquivalents を使う（リストに無い銘柄は数えない・小文字/前後空白も照合）', () => {
    const only = build({
      plan: basePlan({ AAA: aaa() }),
      nw: cashNetworth(),
      prices,
      strat: strategy({ cashEquivalents: ['SGOV'] }),
    });
    expect(only.cash.pct).toBe(10);
    const lower = build({
      plan: basePlan({ AAA: aaa() }),
      nw: cashNetworth(),
      prices,
      strat: strategy({ cashEquivalents: [' jpst '] }),
    });
    expect(lower.cash.pct).toBe(18);
  });

  it('ySymbol の無い行（投信・現金）は照合しない', () => {
    const nw = cashNetworth({ jpstUsd: 0 });
    nw.holdings.push({ institution: 'BrokerX', cat: '投資信託', name: 'JPST', value: usd(80000), cur: 'JPY' });
    nw.holdings.find((h) => h.name === '合成ファンド').value -= usd(80000);
    const s = build({ plan: basePlan({ AAA: aaa() }), nw, prices });
    expect(s.cash.pct).toBe(10);
  });
});

describe('#753 ストレス・単一銘柄の上限で cashEquivalents を株に数えない', () => {
  function nwWithJpst() {
    return {
      asOf: '2026-01-09',
      totals: { imported: usd(1_000_000) },
      holdings: [
        { cat: '米国株・ETF', name: 'AAA', ySymbol: 'AAA', value: usd(500000), cur: 'JPY' },
        { cat: '米国株・ETF', name: 'JPST', ySymbol: 'JPST', value: usd(200000), cur: 'JPY' },
        { cat: '米国株・ETF', name: 'CSH', ySymbol: 'CSH', value: usd(100000), cur: 'JPY' },
        { cat: '現金・預金', name: '普通預金', value: usd(200000), cur: 'JPY' },
      ],
    };
  }
  const opts = (strat) => ({
    plan: basePlan({}),
    nw: nwWithJpst(),
    prices: { AAA: 400, JPST: 50, CSH: 50 },
    strat,
  });

  it('stress.nonEquity から JPST を抜いても JPST は株に入らない', () => {
    const s = build(opts(strategy({ stress: { ...strategy().stress, nonEquity: ['CSH'] } })));
    // 株 = AAA $500K のみ（JPST・CSH・現金は除外）
    expect(s.stress.equityPct.now).toBe(50);
  });

  it('cashEquivalents が無い strategy でも既定で JPST を株に数えない', () => {
    const s = build(opts(strategy({ stress: { ...strategy().stress, nonEquity: [] } })));
    // CSH は株（$100K）・JPST は既定の cashEquivalents で除外
    expect(s.stress.equityPct.now).toBe(60);
  });

  it('既定の stress.nonEquity は JPST/SGOV/BIL/SHV/GLDM', () => {
    const s = build({ ...opts(null), nw: nwWithJpst() });
    expect(s.stress.equityPct.now).toBe(60);
  });

  it('cashEquivalents の銘柄は単一銘柄の上限の警告対象外', () => {
    const jpst = aaa({ targetUsd: 200000, basePrice: 50, stages: [stage({ id: 's1', amountUsd: 10000, limit: 50 })] });
    const s = build({ ...opts(strategy()), plan: basePlan({ JPST: jpst }) });
    expect(ladderOf(s, 'JPST').flags).not.toContain('targetOverConvictionCap');
    // 比較: 同じ設定の株は警告される
    const s2 = build({ ...opts(strategy()), plan: basePlan({ AAA: { ...jpst } }) });
    expect(ladderOf(s2, 'AAA').flags).toContain('targetOverConvictionCap');
  });
});

describe('§6.5 資金繰り（USD）', () => {
  it('不足分を sweep 銘柄の売却株数（ceil）で出す', () => {
    // buy $29,808・sell $0・米ドル預り金 $23,808・CSH $50 → need $6,000 → 120 株
    const s = build({ plan: basePlan({ AAA: aaa() }), nw: baseNetworth({ usdCashUsd: 23808 }) });
    expect(s.funding.usd).toMatchObject({
      buyWorking: 29808,
      sellWorking: 0,
      usdCash: 23808,
      need: 6000,
      sweepQty: 120,
      sweepUsd: 6000,
      sweepCapped: false,
    });
    expect(fundingRow(s)).toMatchObject({ symbol: 'CSH', side: 'sell', limit: null, qty: 120, amountUsd: 6000 });
    expect(s.orders[s.orders.length - 1].role).toBe('funding');
  });

  it('同じ通貨の売り代金を先に充てる（足りれば sweep 行なし）', () => {
    const nw = baseNetworth({
      usdCashUsd: 23808,
      extra: [{ cat: '米国株・ETF', name: 'YYY', ySymbol: 'YYY', value: usd(10000), cur: 'JPY' }],
    });
    const plan = basePlan({
      AAA: aaa(),
      YYY: {
        tier: 'exit',
        targetUsd: null,
        lot: 1,
        basePrice: null,
        stages: [stage({ id: 's1', side: 'sell', amountUsd: null, qty: 100, limit: 100 })],
      },
    });
    const s = build({ plan, nw, prices: { AAA: 400, YYY: 100, CSH: 50 } });
    expect(s.funding.usd.sellWorking).toBe(10000);
    expect(s.funding.usd.sweepQty).toBe(0);
    expect(fundingRow(s)).toBeUndefined();
  });

  it('useUsdCash=false なら米ドル預り金を充てない', () => {
    const s = build({ plan: basePlan({ AAA: aaa() }, { useUsdCash: false }), nw: baseNetworth({ usdCashUsd: 23808 }) });
    expect(s.funding.usd.usdCash).toBe(0);
    expect(s.funding.usd.sweepQty).toBe(Math.ceil(29808 / 50));
  });

  it('保有株数を上限に切り詰め sweepCapped と残りの不足額を出す', () => {
    const nw = baseNetworth();
    nw.holdings.find((h) => h.ySymbol === 'CSH').qty = 100; // CSH 100 株（$5,000）しか無い
    nw.holdings.find((h) => h.ySymbol === 'AAA').qty = 150;
    const s = build({ plan: basePlan({ AAA: aaa() }), nw });
    expect(s.funding.usd).toMatchObject({ sweepQty: 100, sweepUsd: 5000, sweepCapped: true, sweepShortUsd: 24808 });
    expect(fundingRow(s).text).toMatch(/\$24,808 不足/);
  });

  it('全段の合計が資金を超えると不足額を出す', () => {
    // 買い全段 = s1 + s2 + s3（$280×178）、資金 = 米ドル預り金 $20,000 + CSH $50,000
    const s = build({ plan: basePlan({ AAA: aaa() }), nw: baseNetworth({ usdCashUsd: 20000 }) });
    const buyTotal = 29808 + 320 * 125 + 280 * 178;
    expect(s.funding.allStages).toEqual({
      buyTotal,
      sellTotal: 0,
      available: 70000,
      shortfallUsd: buyTotal - 70000,
    });
    expect(s.meta.warnings.join()).toMatch(/全段の合計に対し資金が/);
  });

  it('資金が足りれば不足額 0', () => {
    const s = build({ plan: basePlan({ AAA: aaa() }), nw: baseNetworth({ usdCashUsd: 100000 }) });
    expect(s.funding.allStages.shortfallUsd).toBe(0);
    expect(fundingRow(s)).toBeUndefined();
  });
});

describe('§6.6 単一銘柄の上限', () => {
  it('thick/thin の目標が総資産×高確信%を超えると警告（計算は targetUsd のまま）', () => {
    const s = build({ plan: basePlan({ AAA: aaa({ targetUsd: 200000 }) }) });
    const l = ladderOf(s, 'AAA');
    expect(l.flags).toContain('targetOverConvictionCap');
    expect(l.notes.join()).toMatch(/総資産の 3%＝\$30,000/);
    expect(l.targetUsd).toBe(200000);
  });

  it('theme / special は対象外', () => {
    const s = build({ plan: basePlan({ AAA: aaa({ tier: 'special', targetUsd: 200000 }) }) });
    expect(ladderOf(s, 'AAA').flags).not.toContain('targetOverConvictionCap');
  });
});

describe('§6.8 AI/テック合計・§6.9 ストレス（設計書の前後比較例）', () => {
  // D=$1M、aiTech $250K（半導体 SSS $120K＋AAA $130K）、他の株 $500K、現金等 $250K（CSH $200K＋現金 $50K）
  function stressNetworth() {
    return {
      asOf: '2026-01-09',
      totals: { imported: usd(1_000_000) },
      holdings: [
        { cat: '米国株・ETF', name: 'SSS', ySymbol: 'SSS', value: usd(120000), cur: 'JPY' },
        { cat: '米国株・ETF', name: 'AAA', ySymbol: 'AAA', value: usd(130000), cur: 'JPY' },
        { cat: '米国株・ETF', name: 'OOO', ySymbol: 'OOO', value: usd(300000), cur: 'JPY' },
        { cat: '投資信託', name: '合成ファンド', value: usd(200000), cur: 'JPY' },
        { cat: '米国株・ETF', name: 'CSH', ySymbol: 'CSH', value: usd(200000), cur: 'JPY' },
        { cat: '現金・預金', name: '普通預金', value: usd(50000), cur: 'JPY' },
      ],
    };
  }
  // AAA: 今の注文 $20K＋待機 $20K、SSS: 今の注文 $30K＋待機 $30K → 全段で aiTech +$100K・半導体 +$60K
  function stressPlan() {
    const ladder = (amt) => ({
      tier: 'thick',
      targetUsd: 1_000_000,
      lot: 1,
      basePrice: 100,
      stages: [
        stage({ id: 's1', amountUsd: amt, limit: 100 }),
        stage({ id: 's2', amountUsd: amt, limit: 100, state: 'waiting' }),
      ],
    });
    const sss = ladder(30000);
    sss.tier = 'theme';
    return basePlan({ AAA: ladder(20000), SSS: sss });
  }
  const run = () =>
    build({
      plan: stressPlan(),
      nw: stressNetworth(),
      prices: { AAA: 100, SSS: 100, CSH: 50 },
      strat: strategy({ orderSheet: { cashFloorPct: 0, rebaseMovePct: 5 } }),
    });

  it('シナリオ①: 現在 17.5%（許容内）→ 全段約定後 21.5%（許容超過）', () => {
    const sc = run().stress.scenarios.find((x) => x.id === 'ai-crash');
    expect(sc).toMatchObject({ now: 17.5, afterWorking: 19.5, final: 21.5, overNow: false, overFinal: true });
  });

  it('シナリオ②（半導体 −50%）: 現在 6.0% → 全段約定後 9.0%', () => {
    const sc = run().stress.scenarios.find((x) => x.id === 'semi-crash');
    expect(sc).toMatchObject({ now: 6, afterWorking: 7.5, final: 9, overFinal: false });
  });

  it('株の比率（現金で買うと上がる）: 75.0% → 85.0%', () => {
    expect(run().stress.equityPct).toEqual({ now: 75, afterWorking: 80, final: 85 });
    expect(run().stress.tolerancePct).toBe(20);
  });

  it('AI/テック合計とテーマ別（3 時点）', () => {
    const ai = run().aiTech;
    expect(ai).toMatchObject({ capPct: 29, now: 25, afterWorking: 30, final: 35, over: true });
    expect(ai.themes).toEqual([
      { theme: 'semiconductor', cap: 15, now: 12, afterWorking: 15, final: 18 },
      { theme: 'megatech', cap: 20, now: 13, afterWorking: 15, final: 17 },
    ]);
  });

  it('上限内なら over=false', () => {
    const s = build({
      plan: basePlan({}),
      nw: stressNetworth(),
      prices: { CSH: 50 },
      strat: strategy({ orderSheet: { cashFloorPct: 0, rebaseMovePct: 5 } }),
    });
    expect(s.aiTech).toMatchObject({ now: 25, afterWorking: 25, final: 25, over: false });
  });
});

describe('フラグ・その他', () => {
  it('基準価格から ±5% 以上動いたら rebaseSuggested（自動では基準を変えない）', () => {
    const s = build({ plan: basePlan({ AAA: aaa() }), prices: { AAA: 378, CSH: 50 } });
    expect(orderOf(s, 'AAA').flags).toContain('rebaseSuggested');
    expect(ladderOf(s, 'AAA').basePrice).toBe(400);
    const s2 = build({ plan: basePlan({ AAA: aaa() }), prices: { AAA: 390, CSH: 50 } });
    expect(orderOf(s2, 'AAA').flags).not.toContain('rebaseSuggested');
  });

  it('現在値 ≤ 指値（buy）で inTheMoney', () => {
    expect(orderOf(build({ plan: basePlan({ AAA: aaa() }), prices: { AAA: 360, CSH: 50 } }), 'AAA').inTheMoney).toBe(
      true
    );
  });

  it('tier=theme で ETF 構成のキャッシュがあれば etfConcentration を添える', () => {
    const s = build({
      plan: basePlan({ AAA: aaa({ tier: 'theme' }) }),
      etfTop: { AAA: { ticker: 'ZZZ', weight: 0.2 } },
    });
    expect(orderOf(s, 'AAA').flags).toContain('etfConcentration');
    expect(orderOf(s, 'AAA').notes).toContain('上位: ZZZ 20%');
  });

  it('mf の株数による約定をメモリ上で反映して表示（自動検知）', () => {
    const p = aaa();
    Object.assign(p.stages[0], {
      placedAt: '2026-01-08T14:00:00Z',
      orderedQty: 81,
      orderedLimit: 368,
      qtyAtPlace: 150,
    });
    const plan = basePlan({ AAA: p });
    const nw = baseNetworth();
    nw.holdings.find((h) => h.ySymbol === 'AAA').qty = 231;
    nw.holdings.find((h) => h.ySymbol === 'CSH').qty = 1000;
    const s = build({ plan, nw });
    expect(s.meta.qtyAvailable).toBe(true);
    expect(s.meta.autoDetected).toEqual([{ symbol: 'AAA', stageId: 's1', partial: false }]);
    expect(orderOf(s, 'AAA')).toMatchObject({ stageId: 's2', status: 'toPlace' });
    expect(orderOf(s, 'AAA').flags).toContain('autoDetected');
    expect(ladderOf(s, 'AAA').stages[0]).toMatchObject({ display: 'filled', fillSource: 'mf-qty', autoDetected: true });
    // KV 側の plan（入力）は変わらない・planRev も同じ
    expect(plan.symbols.AAA.stages[0].state).toBe('working');
    expect(s.meta.planRev).toBe(7);
  });

  it('mf に qty と現在値があれば現在額は qty × price', () => {
    const nw = baseNetworth();
    nw.holdings.find((h) => h.ySymbol === 'AAA').qty = 100;
    const s = build({ plan: basePlan({ AAA: aaa() }), nw, prices: { AAA: 410, CSH: 50 } });
    expect(ladderOf(s, 'AAA').curUsd).toBe(41000);
  });

  it('現在値が無ければ mf の価格から概算し警告', () => {
    const nw = baseNetworth();
    nw.holdings.find((h) => h.ySymbol === 'AAA').price = usd(395);
    const s = build({ plan: basePlan({ AAA: aaa() }), nw, prices: { CSH: 50 } });
    expect(orderOf(s, 'AAA').currentPrice).toBe(395);
    expect(s.meta.warnings.join()).toMatch(/概算価格/);
  });

  it('戦略設定が取れなければ既定値で計算し警告', () => {
    const s = build({ plan: basePlan({ AAA: aaa() }), strat: null });
    expect(s.meta.warnings).toContain('戦略設定を取得できず既定値で計算');
    expect(s.cash.floorPct).toBe(12);
    expect(s.aiTech.capPct).toBe(29);
    expect(s.stress.tolerancePct).toBe(20);
    expect(s.stress.scenarios.map((x) => x.id)).toEqual(['ai-crash', 'semi-crash']);
  });

  it('最終見直し: order:log の最新 review、無ければ基準の取り直し', () => {
    const plan = basePlan({ AAA: aaa() });
    expect(build({ plan }).review).toEqual({ lastEvent: 'manual', lastAt: '2026-01-01T00:00:00Z' });
    const log = [
      { at: '2026-01-09T00:00:00Z', type: 'placed', symbol: 'AAA', stageId: 's1', rev: 9 },
      { at: '2026-01-08T00:00:00Z', type: 'review', event: 'CPI', rev: 8 },
    ];
    expect(build({ plan, log }).review).toEqual({ lastEvent: 'CPI', lastAt: '2026-01-08T00:00:00Z' });
  });

  it('USD 建て以外の銘柄は除外して警告', () => {
    const s = build({ plan: basePlan({ AAA: aaa(), '1234.T': aaa() }) });
    expect(s.ladders.map((l) => l.symbol)).toEqual(['AAA']);
    expect(s.meta.warnings.join()).toMatch(/1234\.T/);
  });
});

describe('プロトタイプ汚染の防止・入力の動的キー（レビュー指摘）', () => {
  it('own "__proto__" / constructor キーの plan は除外して警告・Object.prototype を汚さない', () => {
    const raw = JSON.stringify(basePlan({ AAA: aaa() })).replace(
      '"symbols":{',
      '"symbols":{"__proto__":{"tier":"thick","targetUsd":1,"stages":[]},"constructor":{"tier":"thick","stages":[]},'
    );
    const s = build({ plan: JSON.parse(raw) });
    expect(s.ladders.map((l) => l.symbol)).toEqual(['AAA']);
    expect(s.meta.warnings.join()).toMatch(/シンボル名または設定の形が不正/);
    expect({}.tier).toBeUndefined();
    expect({}.targetUsd).toBeUndefined();
  });

  it('prices / etfTop はプロトタイプ連鎖の値を使わない', () => {
    const nw = baseNetworth();
    nw.holdings.find((h) => h.ySymbol === 'AAA').price = usd(395);
    const prices = Object.create({ AAA: 999 });
    prices.CSH = 50;
    const etfTop = Object.create({ AAA: { ticker: 'ZZZ', weight: 0.5 } });
    const s = build({ plan: basePlan({ AAA: aaa({ tier: 'theme' }) }), nw, prices, etfTop });
    expect(orderOf(s, 'AAA').currentPrice).toBe(395); // mf 概算に落ちる（999 を使わない）
    expect(orderOf(s, 'AAA').flags).not.toContain('etfConcentration');
  });

  it('aiTech.themes にプロトタイプ名があっても落ちない（メンバー 0 扱い）', () => {
    const s = build({
      plan: basePlan({ AAA: aaa() }),
      strat: strategy({ aiTech: { themes: ['constructor', '__proto__', 'toString'], capPct: 29 } }),
    });
    expect(s.aiTech.now).toBe(0);
    expect(s.aiTech.themes.map((t) => t.cap)).toEqual([null, null, null]);
  });
});

describe('資金繰り: スイープ銘柄の保有 0（レビュー指摘）', () => {
  it('保有 0 株で行が出なくても不足を警告に出す', () => {
    const nw = baseNetworth();
    nw.holdings.find((h) => h.ySymbol === 'CSH').qty = 0;
    const s = build({ plan: basePlan({ AAA: aaa() }), nw });
    expect(s.funding.usd).toMatchObject({ sweepQty: 0, sweepCapped: true, sweepShortUsd: 29808 });
    expect(fundingRow(s)).toBeUndefined();
    expect(s.meta.warnings.join()).toMatch(/CSH の保有が足りず今出す注文に \$29,808 不足/);
  });
});
