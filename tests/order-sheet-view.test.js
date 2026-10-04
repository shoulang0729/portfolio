// Tests for src/order-sheet-view.js（Order タブ・注文表 PR5・#674）
// すべて合成値・架空ティッカー。為替は 1 USD = 100 JPY。

import { describe, it, expect } from 'vitest';

import {
  fmtLimit,
  fmtUsd,
  fmtPct,
  fmtQty,
  maskDollarText,
  buildOrderRows,
  summarizeRows,
  renderOrdersTable,
  renderGuardPills,
  renderFunding,
  renderAiTech,
  renderStress,
  renderLadders,
  renderOrderSheetHTML,
  renderOrderSheetMessage,
  parseStageArg,
  findStage,
  confirmMessage,
  HOLD_CANCEL_NOTE,
} from '../src/order-sheet-view.js';
import { buildOrderSheet } from '../worker/src/order-sheet-calc.js';

const FX = 100;
const NOW = '2026-01-10T00:00:00Z';
const usd = (x) => x * FX;

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

function networth(holdings, extra = {}) {
  return {
    asOf: '2026-01-09',
    totals: { imported: usd(1_000_000) },
    holdings: [
      { cat: '現金・預金', cur: 'JPY', value: usd(300_000) + 20_000_000, institution: 'X', name: 'cash' },
      ...holdings,
    ],
    ...extra,
  };
}

/** 合成の注文表（Worker の計算モジュールの戻り値そのもの） */
function sheetOf(symbols, holdings = []) {
  return buildOrderSheet({
    plan: { schemaVersion: 1, rev: 3, funding: { sweepSymbol: 'JPST', useUsdCash: false }, symbols },
    strategy: {
      convictionPct: { high: 50 },
      themeCaps: { semiconductor: { cap: 15, members: ['SSS'] }, megatech: { cap: 20, members: ['AAA'] } },
    },
    networth: networth(holdings),
    prices: { AAA: 400, BBB: 50, JPST: 50 },
    fx: FX,
    now: NOW,
  });
}

describe('書式', () => {
  it('fmtLimit: $20 以上は整数・未満は小数 2 桁・null は成行', () => {
    expect(fmtLimit(368.4)).toBe('$368');
    expect(fmtLimit(12.345)).toBe('$12.35');
    expect(fmtLimit(null)).toBe('成行');
  });
  it('fmtUsd: 3 桁区切り・マスク時は数字だけ伏字', () => {
    expect(fmtUsd(29808, false)).toBe('$29,808');
    expect(fmtUsd(29808, true)).toBe('$**,***');
    expect(fmtUsd(null, false)).toBe('—');
    expect(fmtUsd(-1200, false)).toBe('−$1,200');
  });
  it('fmtPct / fmtQty', () => {
    expect(fmtPct(2.49)).toBe('2.5%');
    expect(fmtPct(null)).toBe('—');
    expect(fmtQty(1200)).toBe('1,200');
    expect(fmtQty(null)).toBe('?');
  });
  it('maskDollarText: $ の金額だけ伏字にする', () => {
    expect(maskDollarText('約定後 目標超過 $1,234', true)).toBe('約定後 目標超過 $*,***');
    expect(maskDollarText('基準価格から +6% 動いた', true)).toBe('基準価格から +6% 動いた');
    expect(maskDollarText('不足 $500', false)).toBe('不足 $500');
  });
});

describe('buildOrderRows（今出す注文の行）', () => {
  it('working 段（要発注）と資金繰りの JPST 売が並ぶ（JPST は末尾）', () => {
    const sheet = sheetOf(
      {
        AAA: { tier: 'thick', targetUsd: 100_000, lot: 1, basePrice: 400, stages: [stage({ limit: 368 })] },
      },
      [{ cat: '米国株・ETF', cur: 'USD', ySymbol: 'JPST', value: usd(100_000) }]
    );
    const rows = buildOrderRows(sheet);
    expect(rows.map((r) => [r.symbol, r.kind])).toEqual([
      ['AAA', 'order'],
      ['JPST', 'funding'],
    ]);
    expect(rows[0]).toMatchObject({ limit: 368, qty: 81, status: 'toPlace' });
    expect(summarizeRows(rows)).toEqual({ toPlace: 1, placed: 0, holdCancel: 0 });
  });

  it('目標到達（HOLD）で発注中の買い段が残っていれば「目標到達・取消を検討」の行を残す', () => {
    const sheet = sheetOf(
      {
        AAA: {
          tier: 'thick',
          targetUsd: 50_000,
          lot: 1,
          basePrice: 400,
          stages: [
            stage({ limit: 368, placedAt: '2026-01-05T00:00:00Z', orderedQty: 81, orderedLimit: 368 }),
            stage({ id: 's2', limit: 320, state: 'waiting' }),
          ],
        },
      },
      [{ cat: '米国株・ETF', cur: 'USD', ySymbol: 'AAA', value: usd(60_000) }]
    );
    // Worker は目標到達の段を orders から外す
    expect(sheet.orders.filter((o) => o.symbol === 'AAA')).toEqual([]);
    expect(sheet.ladders[0].hold).toBe('targetReached');
    const rows = buildOrderRows(sheet);
    const hold = rows.find((r) => r.symbol === 'AAA');
    expect(hold).toMatchObject({ kind: 'holdCancel', stageId: 's1', status: 'placed', limit: 368, qty: 81 });
    expect(summarizeRows(rows).holdCancel).toBe(1);
    const html = renderOrdersTable(rows, false);
    expect(html).toContain(HOLD_CANCEL_NOTE);
    expect(html).toContain('data-action="orderUnplace"');
    expect(html).toContain('data-action="orderFilled"');
  });

  it('目標到達でも未発注（要発注）の段は行に出さない', () => {
    const sheet = sheetOf(
      { AAA: { tier: 'thick', targetUsd: 50_000, lot: 1, basePrice: 400, stages: [stage({ limit: 368 })] } },
      [{ cat: '米国株・ETF', cur: 'USD', ySymbol: 'AAA', value: usd(60_000) }]
    );
    expect(buildOrderRows(sheet).filter((r) => r.symbol === 'AAA')).toEqual([]);
  });

  it('壊れた入力でも落ちない', () => {
    expect(buildOrderRows(null)).toEqual([]);
    expect(buildOrderRows({ orders: 'x', ladders: [null] })).toEqual([]);
  });
});

describe('renderOrdersTable', () => {
  const rows = [
    {
      kind: 'order',
      symbol: 'AAA',
      side: 'buy',
      stageId: 's1',
      status: 'toPlace',
      limit: 368,
      qty: 81,
      amountUsd: 29808,
      afterUsd: 89808,
      afterPct: 2.5,
      targetUsd: 100000,
      targetPct: 2.8,
      inTheMoney: false,
      next: { text: '約定したら次は $320×125（基準比 −20%）' },
      notes: ['約定後 目標超過 $1,000'],
    },
    {
      kind: 'order',
      symbol: 'BBB',
      side: 'sell',
      stageId: 's1',
      status: 'placed',
      limit: null,
      qty: 200,
      amountUsd: 10000,
      afterUsd: 0,
      afterPct: 0,
      targetUsd: null,
      notes: [],
    },
    {
      kind: 'funding',
      symbol: 'JPST',
      side: 'sell',
      limit: null,
      qty: 120,
      amountUsd: 6000,
      text: '米ドル買いの不足分を充当',
    },
  ];

  it('指値×株数・金額・約定後（$ と %）・目標・次の段・ボタンを出す', () => {
    const html = renderOrdersTable(rows, false);
    expect(html).toContain('$368');
    expect(html).toContain('>81<');
    expect(html).toContain('$29,808');
    expect(html).toContain('$89,808');
    expect(html).toContain('2.5%');
    expect(html).toContain('約定したら次は $320×125');
    expect(html).toContain('data-action="orderPlaced" data-arg="AAA:s1"');
    expect(html).toContain('data-action="orderUnplace" data-arg="BBB:s1"');
    expect(html).toContain('成行');
    expect(html).toContain('資金繰り');
    // 資金繰り行にはボタンを出さない
    expect(html).not.toContain('data-arg="JPST');
    expect(html).toContain('class="os-scroll"');
  });

  it('マスク時は金額だけ伏字・指値・株数・% は常時表示', () => {
    const html = renderOrdersTable(rows, true);
    expect(html).not.toContain('$29,808');
    expect(html).not.toContain('$89,808');
    expect(html).not.toContain('$1,000');
    expect(html).toContain('$**,***');
    expect(html).toContain('$368');
    expect(html).toContain('>81<');
    expect(html).toContain('>120<');
    expect(html).toContain('2.5%');
  });

  it('外部値（銘柄・注記）を escapeHTML する', () => {
    const html = renderOrdersTable(
      [{ kind: 'order', symbol: '<img src=x>', side: 'buy', stageId: '"s1', status: 'toPlace', notes: ['<b>x</b>'] }],
      false
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;img');
  });

  it('注文が無ければ案内', () => {
    expect(renderOrdersTable([], false)).toContain('今出す注文はありません');
  });
});

describe('ガード・資金繰り・AI/テック・ストレス・はしご', () => {
  const sheet = {
    asOf: NOW,
    meta: {
      planRev: 7,
      holdingsAsOf: '2026-01-09',
      holdingsLagNote: 'MF の同期は寄付前',
      warnings: ['全段の合計に対し資金が $5,000 不足'],
    },
    cash: { pct: 10.5, floorPct: 12, guardActive: true },
    orders: [],
    ladders: [
      {
        symbol: 'AAA',
        tier: 'thick',
        targetUsd: 100000,
        targetPct: 2.8,
        curUsd: 60000,
        curPct: 1.7,
        basePrice: 400,
        baseEvent: 'manual',
        hold: null,
        notes: [],
        stages: [
          { id: 's1', side: 'buy', state: 'working', display: 'placed', limit: 368, qty: 81, suppressed: null },
          { id: 's2', side: 'buy', state: 'waiting', display: 'waiting', limit: 320, qty: 93, suppressed: 'cashFloor' },
        ],
      },
    ],
    funding: {
      usd: {
        buyWorking: 29808,
        sellWorking: 0,
        usdCash: 0,
        sweepSymbol: 'JPST',
        sweepQty: 120,
        sweepUsd: 6000,
        sweepCapped: false,
      },
      allStages: { buyTotal: 60000, sellTotal: 0, available: 55000, shortfallUsd: 5000 },
    },
    aiTech: {
      capPct: 29,
      now: 24,
      afterWorking: 24.8,
      final: 30.1,
      over: true,
      themes: [{ theme: 'semiconductor', cap: 15, now: 5, afterWorking: 5, final: 16 }],
    },
    stress: {
      tolerancePct: 20,
      equityPct: { now: 70, afterWorking: 70.8, final: 74 },
      scenarios: [
        {
          id: 'ai-crash',
          label: 'AI −40%・他の株 −15%',
          now: 17.5,
          afterWorking: 17.9,
          final: 21.5,
          overNow: false,
          overAfterWorking: false,
          overFinal: true,
        },
      ],
    },
    review: { lastEvent: 'CPI', lastAt: NOW },
  };

  it('現金ガード中は警告表示・AI/テック上限超過は警告色', () => {
    const html = renderGuardPills(sheet);
    expect(html).toContain('現金 10.5% / 下限 12.0%');
    expect(html).toContain('最深段を停止');
    expect(html).toContain('AI/テック 24.0%→24.8%→30.1% / 上限 29.0%');
    expect(html.match(/os-gpill--warn/g)).toHaveLength(2);
  });

  it('資金繰り: JPST 売却株数は常時表示・不足額はマスク対象', () => {
    const open = renderFunding(sheet, false);
    expect(open).toContain('JPST 売 <b>120 株</b>');
    expect(open).toContain('資金が $5,000 不足');
    const masked = renderFunding(sheet, true);
    expect(masked).toContain('120 株');
    expect(masked).not.toContain('$5,000');
    expect(masked).not.toContain('$6,000');
  });

  it('AI/テック・ストレスは 3 時点を出し、超過セルに os-over', () => {
    const ai = renderAiTech(sheet);
    expect(ai).toContain('30.1%');
    expect(ai).toContain('semiconductor');
    expect(ai.match(/os-over/g)).toHaveLength(2); // 合計 final・半導体 final
    const st = renderStress(sheet);
    expect(st).toContain('許容 20.0%');
    expect(st).toContain('株の比率');
    expect(st.match(/os-over/g)).toHaveLength(1);
  });

  it('はしご: 停止理由・発注中段のボタン（発注を取り消した・取消）', () => {
    const html = renderLadders(sheet, false);
    expect(html).toContain('停止（現金ガード）');
    expect(html).toContain('data-action="orderUnplace" data-arg="AAA:s1"');
    expect(html).toContain('data-action="orderCancelled" data-arg="AAA:s1"');
    expect(html).not.toContain('data-arg="AAA:s2"');
    expect(renderLadders(sheet, true)).not.toContain('$60,000');
  });

  it('全体: asOf・未反映の可能性・警告（マスク）・最終見直し', () => {
    const html = renderOrderSheetHTML(sheet, { masked: true });
    expect(html).toContain('MF 2026-01-09 同期');
    expect(html).toContain('rev 7');
    expect(html).toContain('MF の同期は寄付前');
    expect(html).toContain('注意 1 件');
    expect(html).not.toContain('$5,000');
    expect(html).toContain('最終見直し: CPI');
    expect(html).toContain('data-action="orderReload"');
  });
});

describe('案内・引数・確認文', () => {
  it('未ログイン・未投入・エラーの案内', () => {
    expect(renderOrderSheetMessage('nologin')).toContain('PIN でログイン');
    expect(renderOrderSheetMessage('empty')).toContain('まだ投入されていません');
    const err = renderOrderSheetMessage('error', '<x>');
    expect(err).toContain('&lt;x&gt;');
    expect(err).toContain('orderReload');
  });

  it('parseStageArg', () => {
    expect(parseStageArg('AAA:s1')).toEqual({ symbol: 'AAA', stageId: 's1' });
    expect(parseStageArg('BRK-B:s:2')).toEqual({ symbol: 'BRK-B', stageId: 's:2' });
    expect(parseStageArg('AAA')).toBeNull();
    expect(parseStageArg(':s1')).toBeNull();
    expect(parseStageArg(undefined)).toBeNull();
  });

  it('確認文は「AAA 買 $368×81 を約定にします」の形', () => {
    const sheet = {
      orders: [{ symbol: 'AAA', stageId: 's1', side: 'buy', limit: 368, qty: 81 }],
      ladders: [{ symbol: 'BBB', stages: [{ id: 's2', side: 'sell', limit: null, qty: 10 }] }],
    };
    expect(confirmMessage(sheet, 'filled', 'AAA', 's1')).toBe('AAA 買 $368×81 を約定にします');
    expect(confirmMessage(sheet, 'cancelled', 'BBB', 's2')).toBe('BBB 売 成行×10 を取消（この段をスキップ）にします');
    expect(findStage(sheet, 'ZZZ', 's1')).toBeNull();
  });
});
