// Tests for worker/src/order-plan.js（注文表 PR1・#670）
// すべて合成値・架空ティッカー（AAA / BBB / CSH 等）。実値を書かない。

import { describe, it, expect } from 'vitest';

import {
  validatePlan,
  sanitizePlan,
  applyEvent,
  detectFills,
  normalizeYSymbol,
  isUsdSymbol,
  roundTick,
  stageLimit,
  buyQty,
  appendLog,
  OrderEventError,
  ORDER_LOG_MAX,
  NOTE_MAX_LEN,
  EVENT_LABEL_MAX_LEN,
  STAGE_ID_MAX_LEN,
} from '../worker/src/order-plan.js';

const NOW = '2026-01-05T10:00:00Z';

function stage(over = {}) {
  return {
    id: 's1',
    side: 'buy',
    amountUsd: 30000,
    dropPct: 8,
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

function makePlan() {
  return {
    schemaVersion: 1,
    rev: 3,
    updatedAt: '2026-01-01T00:00:00Z',
    funding: { sweepSymbol: 'CSH', useUsdCash: true, usdCashRows: [{ institution: 'BrokerX', name: 'USD' }] },
    symbols: {
      AAA: {
        tier: 'thick',
        targetUsd: 100000,
        lot: 1,
        basePrice: 400,
        baseAt: '2026-01-01T00:00:00Z',
        baseEvent: 'manual',
        note: '',
        stages: [
          stage({ id: 's1', dropPct: 8 }),
          stage({ id: 's2', dropPct: 20, amountUsd: 40000, state: 'waiting' }),
          stage({ id: 's3', dropPct: 30, amountUsd: 50000, state: 'waiting' }),
        ],
      },
      XXX: {
        tier: 'exit',
        targetUsd: null,
        lot: 1,
        basePrice: null,
        stages: [stage({ id: 's1', side: 'sell', amountUsd: null, dropPct: null, qty: 'all' })],
      },
    },
  };
}

function networth(asOf, qtyMap = {}) {
  return {
    asOf,
    totals: { imported: 100_000_000 },
    holdings: Object.entries(qtyMap).map(([sym, qty]) => ({
      cat: '米国株・ETF',
      name: sym,
      ySymbol: sym,
      value: 1_000_000,
      cur: 'JPY',
      qty,
    })),
  };
}

describe('helpers', () => {
  it('normalizeYSymbol: 4 桁コードに .T を付ける', () => {
    expect(normalizeYSymbol('200A')).toBe('200A.T');
    expect(normalizeYSymbol('1234')).toBe('1234.T');
    expect(normalizeYSymbol('1234.T')).toBe('1234.T');
    expect(normalizeYSymbol(' AAA ')).toBe('AAA');
  });

  it('isUsdSymbol: サフィックス付きと 4 桁コードは USD 建てでない', () => {
    expect(isUsdSymbol('AAA')).toBe(true);
    expect(isUsdSymbol('1234.T')).toBe(false);
    expect(isUsdSymbol('200A')).toBe(false);
    expect(isUsdSymbol('')).toBe(false);
  });

  it('roundTick: $20 以上は $1、未満は $0.01 で四捨五入', () => {
    expect(roundTick(349.6)).toBe(350);
    expect(roundTick(386.4)).toBe(386);
    expect(roundTick(19.876)).toBe(19.88);
  });

  it('stageLimit: limit 優先、無ければ基準×(1−dropPct/100)', () => {
    expect(stageLimit({ basePrice: 400 }, { limit: 350, dropPct: 8 })).toBe(350);
    expect(stageLimit({ basePrice: 400 }, { limit: null, dropPct: 8 })).toBe(368);
    expect(stageLimit({ basePrice: null }, { limit: null, dropPct: 8 })).toBe(null);
  });

  it('buyQty: floor で金額を超えない・最低 1 lot', () => {
    expect(buyQty(30000, 368)).toBe(81);
    expect(buyQty(29808, 368)).toBe(81); // 浮動小数の誤差で 80 にならない
    expect(buyQty(100, 500)).toBe(1);
    expect(buyQty(1000, 30, 10)).toBe(30);
  });

  it('appendLog: 新しい順・最大件数で古いものを捨てる', () => {
    const old = Array.from({ length: ORDER_LOG_MAX }, (_, i) => ({ n: i }));
    const out = appendLog(old, [{ n: 'a' }, { n: 'b' }]);
    expect(out).toHaveLength(ORDER_LOG_MAX);
    expect(out[0]).toEqual({ n: 'b' });
    expect(out[1]).toEqual({ n: 'a' });
    expect(out[2]).toEqual({ n: 0 });
  });
});

describe('validatePlan', () => {
  it('正しい plan は ok', () => {
    const r = validatePlan(makePlan());
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('オブジェクト以外は不正', () => {
    expect(validatePlan(null).ok).toBe(false);
    expect(validatePlan([]).ok).toBe(false);
  });

  it('working が 2 つあると不正', () => {
    const p = makePlan();
    p.symbols.AAA.stages[1].state = 'working';
    const r = validatePlan(p);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/working はちょうど 1 つ/);
  });

  it('未完了段があるのに working が 0 は不正', () => {
    const p = makePlan();
    p.symbols.AAA.stages[0].state = 'waiting';
    expect(validatePlan(p).ok).toBe(false);
  });

  it('working が最初の未完了段でないと不正', () => {
    const p = makePlan();
    p.symbols.AAA.stages[0].state = 'waiting';
    p.symbols.AAA.stages[1].state = 'working';
    const r = validatePlan(p);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/最初の未完了段/);
  });

  it('全段 filled / cancelled なら working 0 で ok', () => {
    const p = makePlan();
    p.symbols.AAA.stages.forEach((s) => (s.state = 'filled'));
    p.symbols.AAA.stages[2].state = 'cancelled';
    expect(validatePlan(p).ok).toBe(true);
  });

  it('USD 建て以外（.T・4 桁コード）は拒否', () => {
    const p = makePlan();
    p.symbols['1234.T'] = { ...p.symbols.AAA };
    p.symbols['200A'] = { ...p.symbols.AAA };
    const r = validatePlan(p);
    expect(r.ok).toBe(false);
    expect(r.errors.filter((e) => /USD 建て/.test(e))).toHaveLength(2);
  });

  it('buy 段は amountUsd と（limit か dropPct＋basePrice）が必要', () => {
    const p = makePlan();
    p.symbols.AAA.basePrice = null;
    p.symbols.AAA.stages[0].amountUsd = 0;
    const r = validatePlan(p);
    expect(r.errors.join()).toMatch(/amountUsd > 0/);
    expect(r.errors.join()).toMatch(/limit > 0、または dropPct と basePrice/);
  });

  it('buy 段は limit があれば basePrice 無しで ok', () => {
    const p = makePlan();
    p.symbols.AAA.basePrice = null;
    p.symbols.AAA.stages.forEach((s) => (s.limit = 300));
    expect(validatePlan(p).ok).toBe(true);
  });

  it('sell 段は qty（正の整数か "all"）が必要・limit null（成行）可', () => {
    const p = makePlan();
    p.symbols.XXX.stages[0].qty = null;
    expect(validatePlan(p).errors.join()).toMatch(/sell 段は qty/);
    p.symbols.XXX.stages[0].qty = 1.5;
    expect(validatePlan(p).ok).toBe(false);
    p.symbols.XXX.stages[0].qty = 200;
    expect(validatePlan(p).ok).toBe(true);
  });

  it('exit は sell 段のみ・thick の targetUsd null は不可', () => {
    const p = makePlan();
    p.symbols.XXX.stages.push(stage({ id: 's2', state: 'waiting', limit: 10 }));
    p.symbols.AAA.targetUsd = null;
    const r = validatePlan(p);
    expect(r.errors.join()).toMatch(/tier=exit は sell 段のみ/);
    expect(r.errors.join()).toMatch(/targetUsd は正の数/);
  });

  it('theme は targetUsd null 可', () => {
    const p = makePlan();
    p.symbols.AAA.tier = 'theme';
    p.symbols.AAA.targetUsd = null;
    expect(validatePlan(p).ok).toBe(true);
  });

  it('段 id の重複・未知の tier / state は不正', () => {
    const p = makePlan();
    p.symbols.AAA.stages[1].id = 's1';
    p.symbols.AAA.tier = 'huge';
    p.symbols.AAA.stages[2].state = 'done';
    const r = validatePlan(p);
    expect(r.errors.join()).toMatch(/重複/);
    expect(r.errors.join()).toMatch(/tier は/);
    expect(r.errors.join()).toMatch(/state は/);
  });

  it('schemaVersion と funding.sweepSymbol は必須', () => {
    const p = makePlan();
    p.schemaVersion = 2;
    p.funding.sweepSymbol = '';
    const r = validatePlan(p);
    expect(r.errors.join()).toMatch(/schemaVersion/);
    expect(r.errors.join()).toMatch(/sweepSymbol/);
  });
});

describe('applyEvent', () => {
  it('入力 plan を変更しない・rev +1・updatedAt=now', () => {
    const p = makePlan();
    const before = JSON.stringify(p);
    const { plan, log } = applyEvent(p, { type: 'review', event: 'CPI' }, { now: NOW });
    expect(JSON.stringify(p)).toBe(before);
    expect(plan.rev).toBe(4);
    expect(plan.updatedAt).toBe('2026-01-05T10:00:00.000Z');
    expect(log).toMatchObject({ type: 'review', event: 'CPI', rev: 4 });
  });

  it('placed: 表示中の指値×株数と発注時点の mf 株数を記録', () => {
    const { plan, log } = applyEvent(
      makePlan(),
      { type: 'placed', symbol: 'AAA', stageId: 's1' },
      { now: NOW, networth: networth('2026-01-05', { AAA: 100 }) }
    );
    const s1 = plan.symbols.AAA.stages[0];
    expect(s1.placedAt).toBe('2026-01-05T10:00:00.000Z');
    expect(s1.orderedLimit).toBe(368);
    expect(s1.orderedQty).toBe(81);
    expect(s1.qtyAtPlace).toBe(100);
    expect(s1.state).toBe('working');
    expect(log).toMatchObject({ type: 'placed', symbol: 'AAA', stageId: 's1', orderedQty: 81, orderedLimit: 368 });
  });

  it('placed: 指定した orderedQty / orderedLimit を優先・mf qty 無しは qtyAtPlace null', () => {
    const { plan } = applyEvent(
      makePlan(),
      { type: 'placed', symbol: 'AAA', stageId: 's1', orderedQty: 70, orderedLimit: 360 },
      { now: NOW }
    );
    const s1 = plan.symbols.AAA.stages[0];
    expect(s1.orderedQty).toBe(70);
    expect(s1.orderedLimit).toBe(360);
    expect(s1.qtyAtPlace).toBe(null);
  });

  it('placed: sell "all" は mf の株数を発注株数にし、成行は指値 null', () => {
    const { plan } = applyEvent(
      makePlan(),
      { type: 'placed', symbol: 'XXX', stageId: 's1' },
      { now: NOW, networth: networth('2026-01-05', { XXX: 250 }) }
    );
    const s1 = plan.symbols.XXX.stages[0];
    expect(s1.orderedQty).toBe(250);
    expect(s1.orderedLimit).toBe(null);
    expect(s1.qtyAtPlace).toBe(250);
  });

  it('placed: sell "all" で mf 株数が無く orderedQty も無ければエラー', () => {
    expect(() => applyEvent(makePlan(), { type: 'placed', symbol: 'XXX', stageId: 's1' }, { now: NOW })).toThrow(
      OrderEventError
    );
  });

  it('placed: working 以外の段・未知の銘柄はエラー', () => {
    expect(() => applyEvent(makePlan(), { type: 'placed', symbol: 'AAA', stageId: 's2' }, { now: NOW })).toThrow(
      /working/
    );
    expect(() => applyEvent(makePlan(), { type: 'placed', symbol: 'ZZZ', stageId: 's1' }, { now: NOW })).toThrow(
      /symbol/
    );
  });

  it('filled: 段を filled にして次の waiting 段を working（要発注）に進める', () => {
    const placed = applyEvent(makePlan(), { type: 'placed', symbol: 'AAA', stageId: 's1' }, { now: NOW }).plan;
    const { plan, log } = applyEvent(placed, { type: 'filled', symbol: 'AAA', stageId: 's1' }, { now: NOW });
    const [s1, s2, s3] = plan.symbols.AAA.stages;
    expect(s1.state).toBe('filled');
    expect(s1.fillSource).toBe('self');
    expect(s1.filledQty).toBe(81);
    expect(s1.filledAt).toBe('2026-01-05T10:00:00.000Z');
    expect(s2.state).toBe('working');
    expect(s2.placedAt).toBe(null);
    expect(s3.state).toBe('waiting');
    expect(log.nextStageId).toBe('s2');
    expect(validatePlan(plan).ok).toBe(true);
  });

  it('filled: source mcp を受ける・不正な source はエラー', () => {
    const { plan } = applyEvent(
      makePlan(),
      { type: 'filled', symbol: 'AAA', stageId: 's1', source: 'mcp' },
      { now: NOW }
    );
    expect(plan.symbols.AAA.stages[0].fillSource).toBe('mcp');
    expect(() =>
      applyEvent(makePlan(), { type: 'filled', symbol: 'AAA', stageId: 's1', source: 'guess' }, { now: NOW })
    ).toThrow(OrderEventError);
  });

  it('filled: filledQty < orderedQty は一部約定（working のまま加算）', () => {
    const placed = applyEvent(makePlan(), { type: 'placed', symbol: 'AAA', stageId: 's1' }, { now: NOW }).plan;
    const r1 = applyEvent(placed, { type: 'filled', symbol: 'AAA', stageId: 's1', filledQty: 30 }, { now: NOW });
    expect(r1.plan.symbols.AAA.stages[0].state).toBe('working');
    expect(r1.plan.symbols.AAA.stages[0].filledQty).toBe(30);
    expect(r1.log.partial).toBe(true);
    const r2 = applyEvent(r1.plan, { type: 'filled', symbol: 'AAA', stageId: 's1', filledQty: 51 }, { now: NOW });
    expect(r2.plan.symbols.AAA.stages[0].state).toBe('filled');
    expect(r2.plan.symbols.AAA.stages[1].state).toBe('working');
  });

  it('filled: 最終段の約定で working 0（全段完了）', () => {
    const { plan } = applyEvent(makePlan(), { type: 'filled', symbol: 'XXX', stageId: 's1' }, { now: NOW });
    expect(plan.symbols.XXX.stages[0].state).toBe('filled');
    expect(validatePlan(plan).ok).toBe(true);
  });

  it('cancelled: working 段の取消で次の段が working・waiting 段の取消も可', () => {
    const r1 = applyEvent(makePlan(), { type: 'cancelled', symbol: 'AAA', stageId: 's3' }, { now: NOW });
    expect(r1.plan.symbols.AAA.stages[2].state).toBe('cancelled');
    expect(r1.plan.symbols.AAA.stages[0].state).toBe('working');
    const r2 = applyEvent(r1.plan, { type: 'cancelled', symbol: 'AAA', stageId: 's1' }, { now: NOW });
    expect(r2.plan.symbols.AAA.stages[1].state).toBe('working');
    expect(() => applyEvent(r2.plan, { type: 'cancelled', symbol: 'AAA', stageId: 's1' }, { now: NOW })).toThrow(
      /cancelled/
    );
  });

  it('unplace: 発注情報を null に戻し working のまま（要発注）', () => {
    const placed = applyEvent(
      makePlan(),
      { type: 'placed', symbol: 'AAA', stageId: 's1' },
      { now: NOW, networth: networth('2026-01-05', { AAA: 100 }) }
    ).plan;
    const { plan } = applyEvent(placed, { type: 'unplace', symbol: 'AAA', stageId: 's1' }, { now: NOW });
    const s1 = plan.symbols.AAA.stages[0];
    expect(s1).toMatchObject({
      state: 'working',
      placedAt: null,
      orderedQty: null,
      orderedLimit: null,
      qtyAtPlace: null,
    });
  });

  it('rebase: 基準を更新し、dropPct を持つ waiting 段の limit を null に戻す（working は既定で触らない）', () => {
    const p = makePlan();
    p.symbols.AAA.stages[0].limit = 360;
    p.symbols.AAA.stages[1].limit = 310;
    p.symbols.AAA.stages[2].limit = 280;
    p.symbols.AAA.stages[2].dropPct = null; // 指値固定の段は残す
    const { plan, log } = applyEvent(p, { type: 'rebase', symbol: 'AAA', basePrice: 380, event: 'CPI' }, { now: NOW });
    const sc = plan.symbols.AAA;
    expect(sc.basePrice).toBe(380);
    expect(sc.baseEvent).toBe('CPI');
    expect(sc.baseAt).toBe('2026-01-05T10:00:00.000Z');
    expect(sc.stages[0].limit).toBe(360);
    expect(sc.stages[1].limit).toBe(null);
    expect(sc.stages[2].limit).toBe(280);
    expect(log).toMatchObject({ type: 'rebase', basePrice: 380, event: 'CPI', includeWorking: false });
  });

  it('rebase includeWorking: 発注済みの working 段も再計算し要訂正（unplace 扱い）', () => {
    const placed = applyEvent(makePlan(), { type: 'placed', symbol: 'AAA', stageId: 's1' }, { now: NOW }).plan;
    const { plan } = applyEvent(
      placed,
      { type: 'rebase', symbol: 'AAA', basePrice: 380, event: 'FOMC', includeWorking: true },
      { now: NOW }
    );
    const s1 = plan.symbols.AAA.stages[0];
    expect(s1.limit).toBe(null);
    expect(s1.placedAt).toBe(null);
    expect(s1.orderedQty).toBe(null);
    expect(s1.state).toBe('working');
  });

  it('rebase: basePrice / event が無いとエラー', () => {
    expect(() => applyEvent(makePlan(), { type: 'rebase', symbol: 'AAA', event: 'CPI' }, { now: NOW })).toThrow(
      /basePrice/
    );
    expect(() => applyEvent(makePlan(), { type: 'rebase', symbol: 'AAA', basePrice: 1 }, { now: NOW })).toThrow(
      /event/
    );
  });

  it('未知の type・now 無しはエラー', () => {
    expect(() => applyEvent(makePlan(), { type: 'boom' }, { now: NOW })).toThrow(OrderEventError);
    expect(() => applyEvent(makePlan(), { type: 'review', event: 'CPI' }, {})).toThrow(/now/);
  });
});

describe('detectFills（§5.2 の例・合成値）', () => {
  function placedPlan() {
    const p = makePlan();
    Object.assign(p.symbols.AAA.stages[0], {
      placedAt: '2026-10-03T14:00:00Z',
      orderedQty: 81,
      orderedLimit: 368,
      qtyAtPlace: 100,
    });
    return p;
  }

  it('同日の同期（asOf = placedAt の日付）は何もしない', () => {
    const p = placedPlan();
    const r = detectFills(p, networth('2026-10-03', { AAA: 181 }));
    expect(r.logs).toEqual([]);
    expect(r.plan).toBe(p);
  });

  it('翌日 mfQty=181 → s1 filled（mf-qty）・s2 が working（要発注）。rev は変えない', () => {
    const p = placedPlan();
    const r = detectFills(p, networth('2026-10-04', { AAA: 181 }), '2026-10-04T06:00:00Z');
    const [s1, s2] = r.plan.symbols.AAA.stages;
    expect(s1.state).toBe('filled');
    expect(s1.fillSource).toBe('mf-qty');
    expect(s1.filledQty).toBe(81);
    expect(s1.filledAt).toBe('2026-10-04T06:00:00.000Z');
    expect(s2.state).toBe('working');
    expect(s2.placedAt).toBe(null);
    expect(r.plan.rev).toBe(p.rev);
    expect(r.logs).toEqual([
      expect.objectContaining({ type: 'filled', symbol: 'AAA', stageId: 's1', source: 'mf-qty', rev: p.rev + 1 }),
    ]);
    expect(p.symbols.AAA.stages[0].state).toBe('working'); // 入力は不変
  });

  it('mfQty=140 → 一部約定 40/81（working のまま）', () => {
    const r = detectFills(placedPlan(), networth('2026-10-04', { AAA: 140 }));
    const s1 = r.plan.symbols.AAA.stages[0];
    expect(s1.state).toBe('working');
    expect(s1.filledQty).toBe(40);
    expect(r.logs[0]).toMatchObject({ partial: true, filledQty: 40, orderedQty: 81 });
  });

  it('同じ一部約定は 2 回目は変化なし（冪等）', () => {
    const r1 = detectFills(placedPlan(), networth('2026-10-04', { AAA: 140 }));
    const r2 = detectFills(r1.plan, networth('2026-10-04', { AAA: 140 }));
    expect(r2.logs).toEqual([]);
  });

  it('sell: qtyAtPlace − orderedQty 以下で filled、"all" は 0 株で filled', () => {
    const p = makePlan();
    Object.assign(p.symbols.XXX.stages[0], { placedAt: '2026-10-03T14:00:00Z', orderedQty: 50, qtyAtPlace: 50 });
    expect(detectFills(p, networth('2026-10-04', { XXX: 20 })).plan.symbols.XXX.stages[0]).toMatchObject({
      state: 'working',
      filledQty: 30,
    });
    expect(detectFills(p, networth('2026-10-04', { AAA: 1 })).plan.symbols.XXX.stages[0].state).toBe('filled');

    p.symbols.XXX.stages[0].qty = 40;
    p.symbols.XXX.stages[0].orderedQty = 40;
    expect(detectFills(p, networth('2026-10-04', { XXX: 10 })).plan.symbols.XXX.stages[0].state).toBe('filled');
  });

  it('mf に qty が無い（PR4 前）・qtyAtPlace が null の段は自動検知しない', () => {
    const p = placedPlan();
    const nw = networth('2026-10-04', { AAA: 181 });
    nw.holdings.forEach((h) => delete h.qty);
    expect(detectFills(p, nw).logs).toEqual([]);
    p.symbols.AAA.stages[0].qtyAtPlace = null;
    expect(detectFills(p, networth('2026-10-04', { AAA: 181 })).logs).toEqual([]);
  });
});

describe('プロトタイプ汚染の防止（レビュー指摘）', () => {
  const PROTO_KEYS = ['__proto__', 'constructor', 'toString', 'hasOwnProperty'];

  it.each(PROTO_KEYS)('applyEvent: symbol=%s は OrderEventError で、Object.prototype に書き込まない', (sym) => {
    for (const ev of [
      { type: 'rebase', symbol: sym, basePrice: 123, event: 'x' },
      { type: 'placed', symbol: sym, stageId: 's1' },
      { type: 'filled', symbol: sym, stageId: 's1' },
      { type: 'cancelled', symbol: sym, stageId: 's1' },
      { type: 'unplace', symbol: sym, stageId: 's1' },
    ]) {
      expect(() => applyEvent(makePlan(), ev, { now: NOW })).toThrow(OrderEventError);
    }
    expect({}.basePrice).toBeUndefined();
    expect({}.baseEvent).toBeUndefined();
    expect({}.baseAt).toBeUndefined();
    expect(typeof {}.toString).toBe('function');
  });

  it('JSON 由来の own "__proto__" キーを持つ plan: validatePlan が拒否・applyEvent / detectFills も触らない', () => {
    const raw = JSON.stringify(makePlan()).replace(
      '"symbols":{',
      '"symbols":{"__proto__":{"tier":"thick","stages":[]},'
    );
    const p = JSON.parse(raw);
    expect(Object.hasOwn(p.symbols, '__proto__')).toBe(true);
    const r = validatePlan(p);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/シンボル名の形が不正/);
    expect(() =>
      applyEvent(p, { type: 'rebase', symbol: '__proto__', basePrice: 1, event: 'x' }, { now: NOW })
    ).toThrow(OrderEventError);
    detectFills(p, networth('2026-10-04', { AAA: 1 }));
    expect({}.basePrice).toBeUndefined();
    expect({}.tier).toBeUndefined();
  });

  it('validatePlan: シンボル名の形（BRK-B・200A.T 型は形として通る／小文字・記号は不可）', () => {
    const p = makePlan();
    p.symbols['BRK-B'] = p.symbols.AAA;
    expect(validatePlan(p).ok).toBe(true);
    p.symbols['200A.T'] = p.symbols.AAA; // 形は通るが USD 建てでない
    expect(validatePlan(p).errors.join()).toMatch(/USD 建て/);
    expect(validatePlan(p).errors.join()).not.toMatch(/シンボル名の形/);
    const q = makePlan();
    q.symbols.constructor = q.symbols.AAA;
    q.symbols['a$b'] = q.symbols.AAA;
    expect(validatePlan(q).errors.filter((e) => /シンボル名の形/.test(e))).toHaveLength(2);
    const f = makePlan();
    f.funding.sweepSymbol = '__proto__';
    expect(validatePlan(f).errors.join()).toMatch(/sweepSymbol の形/);
  });
});

describe('数量比較の許容誤差（レビュー指摘）', () => {
  it('detectFills: 小数の mf qty が誤差で僅かに足りなくても filled', () => {
    const p = makePlan();
    Object.assign(p.symbols.AAA.stages[0], {
      placedAt: '2026-10-03T14:00:00Z',
      orderedQty: 0.8,
      orderedLimit: 368,
      qtyAtPlace: 0.7,
    });
    // 0.7 + 0.8 = 1.5 に対し、mf 側の値が浮動小数の誤差で 1.4999999999
    const r = detectFills(p, networth('2026-10-04', { AAA: 1.4999999999 }));
    expect(r.plan.symbols.AAA.stages[0].state).toBe('filled');
  });

  it('detectFills: sell "all" は 0 に極めて近い残りでも filled', () => {
    const p = makePlan();
    Object.assign(p.symbols.XXX.stages[0], { placedAt: '2026-10-03T14:00:00Z', orderedQty: 3.3, qtyAtPlace: 3.3 });
    const r = detectFills(p, networth('2026-10-04', { XXX: 1e-9 }));
    expect(r.plan.symbols.XXX.stages[0].state).toBe('filled');
  });

  it('applyEvent filled: 累計が誤差で orderedQty を僅かに下回っても filled（0.7 + 0.1 < 0.8）', () => {
    const placed = applyEvent(
      makePlan(),
      { type: 'placed', symbol: 'AAA', stageId: 's1', orderedQty: 0.8, orderedLimit: 368 },
      { now: NOW }
    ).plan;
    const r1 = applyEvent(placed, { type: 'filled', symbol: 'AAA', stageId: 's1', filledQty: 0.7 }, { now: NOW });
    expect(r1.plan.symbols.AAA.stages[0].state).toBe('working');
    const r2 = applyEvent(r1.plan, { type: 'filled', symbol: 'AAA', stageId: 's1', filledQty: 0.1 }, { now: NOW });
    expect(r2.plan.symbols.AAA.stages[0].state).toBe('filled');
  });
});

describe('不正状態の plan への applyEvent（レビュー指摘）', () => {
  it('working が 2 つの plan: 未発注の余分な working は waiting に戻して 1 段に揃える', () => {
    const p = makePlan();
    p.symbols.AAA.stages[1].state = 'working';
    const { plan } = applyEvent(p, { type: 'placed', symbol: 'AAA', stageId: 's1' }, { now: NOW });
    expect(plan.symbols.AAA.stages.map((s) => s.state)).toEqual(['working', 'waiting', 'waiting']);
    expect(validatePlan(plan).ok).toBe(true);
  });

  it('余分な working が発注済みなら情報を消さずにエラー（不正な plan を書き戻さない）', () => {
    const p = makePlan();
    Object.assign(p.symbols.AAA.stages[1], { state: 'working', placedAt: '2026-01-01T00:00:00Z', orderedQty: 10 });
    expect(() => applyEvent(p, { type: 'placed', symbol: 'AAA', stageId: 's1' }, { now: NOW })).toThrow(
      /適用後の plan が不正/
    );
  });

  it('detectFills: working が 2 つの銘柄は自動確定しない', () => {
    const p = makePlan();
    Object.assign(p.symbols.AAA.stages[0], { placedAt: '2026-10-03T14:00:00Z', orderedQty: 81, qtyAtPlace: 100 });
    p.symbols.AAA.stages[1].state = 'working';
    expect(detectFills(p, networth('2026-10-04', { AAA: 181 })).logs).toEqual([]);
  });
});

describe('入力の上限・未知キーの除去（#686）', () => {
  it('sanitizePlan: §3.1 に無いキーを各階層で取り除き、入力は変えない', () => {
    const p = makePlan();
    p.extra = 1;
    p.funding.extra = 2;
    p.funding.usdCashRows = [{ institution: 'I', name: 'N', extra: 3 }];
    p.symbols.AAA.extra = 4;
    p.symbols.AAA.stages[0].extra = 5;
    const s = sanitizePlan(p);
    expect(s).not.toHaveProperty('extra');
    expect(s.funding).not.toHaveProperty('extra');
    expect(s.funding.usdCashRows[0]).toEqual({ institution: 'I', name: 'N' });
    expect(s.symbols.AAA).not.toHaveProperty('extra');
    expect(s.symbols.AAA.stages[0]).not.toHaveProperty('extra');
    expect(validatePlan(s).ok).toBe(true);
    expect(p.extra).toBe(1);
    expect(p.symbols.AAA.stages[0].extra).toBe(5);
  });

  it('sanitizePlan: 既知キーはそのまま（validatePlan の結果が変わらない）', () => {
    const p = makePlan();
    expect(sanitizePlan(p)).toEqual(p);
  });

  it('sanitizePlan: オブジェクトでない部分は残して検証でエラーにさせる', () => {
    expect(sanitizePlan(null)).toBe(null);
    expect(sanitizePlan([1])).toEqual([1]);
    const p = makePlan();
    p.symbols.AAA.stages = 'x';
    expect(validatePlan(sanitizePlan(p)).ok).toBe(false);
  });

  it('sanitizePlan: __proto__ のシンボル名でプロトタイプを書き換えず、検証で弾く', () => {
    const p = JSON.parse(
      '{"schemaVersion":1,"funding":{"sweepSymbol":"CSH"},"symbols":{"__proto__":{"tier":"thick"}}}'
    );
    const s = sanitizePlan(p);
    expect(Object.getPrototypeOf(s.symbols)).toBe(Object.prototype);
    expect(Object.hasOwn(s.symbols, '__proto__')).toBe(true);
    expect(validatePlan(s).ok).toBe(false);
  });

  it('validatePlan: note・baseEvent・段 id の長さ上限', () => {
    const p = makePlan();
    p.symbols.AAA.note = 'n'.repeat(NOTE_MAX_LEN);
    p.symbols.AAA.baseEvent = 'e'.repeat(EVENT_LABEL_MAX_LEN);
    expect(validatePlan(p).ok).toBe(true);
    p.symbols.AAA.note = 'n'.repeat(NOTE_MAX_LEN + 1);
    expect(validatePlan(p).errors.join()).toMatch(/note/);
    p.symbols.AAA.note = '';
    p.symbols.AAA.baseEvent = 'e'.repeat(EVENT_LABEL_MAX_LEN + 1);
    expect(validatePlan(p).errors.join()).toMatch(/baseEvent/);
    p.symbols.AAA.baseEvent = 'manual';
    p.symbols.AAA.stages[0].id = 'i'.repeat(STAGE_ID_MAX_LEN + 1);
    expect(validatePlan(p).errors.join()).toMatch(/id/);
  });

  it('applyEvent: review / rebase の event が長すぎると OrderEventError', () => {
    const long = 'e'.repeat(EVENT_LABEL_MAX_LEN + 1);
    expect(() => applyEvent(makePlan(), { type: 'review', event: long }, { now: NOW })).toThrow(OrderEventError);
    expect(() =>
      applyEvent(makePlan(), { type: 'rebase', symbol: 'AAA', basePrice: 300, event: long }, { now: NOW })
    ).toThrow(OrderEventError);
    const ok = applyEvent(makePlan(), { type: 'review', event: 'e'.repeat(EVENT_LABEL_MAX_LEN) }, { now: NOW });
    expect(ok.log.event.length).toBe(EVENT_LABEL_MAX_LEN);
  });

  it('applyEvent: review の symbol は形が正しいものだけログに残す（不正は OrderEventError）', () => {
    const ok = applyEvent(makePlan(), { type: 'review', event: 'CPI', symbol: 'AAA' }, { now: NOW });
    expect(ok.log.symbol).toBe('AAA');
    expect(() =>
      applyEvent(makePlan(), { type: 'review', event: 'CPI', symbol: 'x'.repeat(1000) }, { now: NOW })
    ).toThrow(OrderEventError);
  });

  it('applyEvent: 未知のキーはログに入らない', () => {
    const { log } = applyEvent(makePlan(), { type: 'review', event: 'CPI', junk: 'y'.repeat(100) }, { now: NOW });
    expect(log).not.toHaveProperty('junk');
  });
});
