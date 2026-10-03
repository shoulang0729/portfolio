// ══════════════════════════════════════════════════════════════
// order-sheet-calc.js  ―  注文表（指値×株数）の計算（純関数）
//
// 設計: docs/handoff/2026-10-03-order-sheet.md §4.2・§6（PR1）
//
// buildOrderSheet({ plan, strategy, networth, prices, fx, etfTop, now, log }) → 注文表
// - fetch / KV / Date.now を中で呼ばない（すべて引数）。Worker（PR3）と vitest から呼ぶ。
// - 自動の売り発議はしない: sell 行は plan に本人が入れた sell 段＋資金繰りの売りだけ（§6.4）。
// - 公開リポ: このファイルに実値（銘柄ごとの目標額・指値・株数）を書かない。
// ══════════════════════════════════════════════════════════════

import {
  buyQty,
  detectFills,
  hasQty,
  isOpenStage,
  isUsdSymbol,
  isValidSymbolKey,
  makeQtyLookup,
  normalizeYSymbol,
  ownGet,
  QTY_EPS,
  stageLimit,
  toIso,
} from './order-plan.js';

/** 生活資金（現金比率の控除額・円）。src/networth.js の EMERGENCY_FUND と同じ値（§6.7） */
export const EMERGENCY_FUND_JPY = 20_000_000;

/** 株として数える mf のカテゴリ（§6.9） */
export const EQUITY_CATS = ['米国株・ETF', '日本株・ETF', '投資信託'];

export const HOLDINGS_LAG_NOTE = 'MF の同期は寄付前のため、直近の取引日の約定は未反映の可能性があります';

/** data/target-allocation.json の新キーが無いときの既定値（§3.2） */
export const DEFAULT_AI_TECH = { themes: ['semiconductor', 'megatech'], capPct: 29 };
export const DEFAULT_STRESS = {
  tolerancePct: 20,
  nonEquity: ['JPST', 'GLDM', 'SLV'],
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
};
export const DEFAULT_ORDER_SHEET = { cashFloorPct: 12, rebaseMovePct: 5 };
export const DEFAULT_CONVICTION_HIGH_PCT = 3;

// ── 丸め・書式 ───────────────────────────────────────────────

/** @param {unknown} v */
function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/** *Pct の丸め（小数 1 桁） */
export function round1(x) {
  return isNum(x) ? Math.round(x * 10) / 10 : null;
}

/** *Usd の丸め（整数ドル） */
export function roundUsd(x) {
  return isNum(x) ? Math.round(x) : null;
}

/** 指値の表示（$20 以上は整数、未満は小数 2 桁） */
function fmtLimit(x) {
  if (!isNum(x)) return '成行';
  return x >= 20 ? `$${Math.round(x)}` : `$${x.toFixed(2)}`;
}

/** 金額の表示（整数ドル・3 桁区切り） */
function fmtUsd(x) {
  return `$${Math.round(x).toLocaleString('en-US')}`;
}

/** @param {Record<string, any>|null|undefined} prices */
function priceOf(prices, sym) {
  const v = ownGet(prices, sym);
  if (isNum(v)) return v;
  if (v && isNum(v.price)) return v.price;
  return null;
}

// ── 戦略設定（公開 target-allocation.json）の解決 ─────────────

/**
 * @param {any} strategy data/target-allocation.json（取得失敗時は null）
 * @param {string[]} warnings
 */
function resolveStrategy(strategy, warnings) {
  if (!strategy || typeof strategy !== 'object') {
    warnings.push('戦略設定を取得できず既定値で計算');
    strategy = {};
  }
  const ai = strategy.aiTech || {};
  const st = strategy.stress || {};
  const os = strategy.orderSheet || {};
  return {
    themeCaps: strategy.themeCaps && typeof strategy.themeCaps === 'object' ? strategy.themeCaps : {},
    convictionHighPct: isNum(strategy.convictionPct?.high) ? strategy.convictionPct.high : DEFAULT_CONVICTION_HIGH_PCT,
    aiTech: {
      themes: Array.isArray(ai.themes) ? ai.themes : DEFAULT_AI_TECH.themes,
      capPct: isNum(ai.capPct) ? ai.capPct : DEFAULT_AI_TECH.capPct,
    },
    stress: {
      tolerancePct: isNum(st.tolerancePct) ? st.tolerancePct : DEFAULT_STRESS.tolerancePct,
      nonEquity: Array.isArray(st.nonEquity) ? st.nonEquity : DEFAULT_STRESS.nonEquity,
      scenarios: Array.isArray(st.scenarios) ? st.scenarios : DEFAULT_STRESS.scenarios,
    },
    orderSheet: {
      cashFloorPct: isNum(os.cashFloorPct) ? os.cashFloorPct : DEFAULT_ORDER_SHEET.cashFloorPct,
      rebaseMovePct: isNum(os.rebaseMovePct) ? os.rebaseMovePct : DEFAULT_ORDER_SHEET.rebaseMovePct,
    },
  };
}

// ── 保有（mf）の集約 ─────────────────────────────────────────

/**
 * mf の行を照合キーごとに集約する。ySymbol の無い行（投信等）は行ごとに別キー。
 * @param {any[]} rows
 */
function groupHoldings(rows) {
  /** @type {Map<string, {key: string, cat: string, valueJpy: number, priceJpy: number|null}>} */
  const map = new Map();
  rows.forEach((r, i) => {
    if (!r) return;
    const key = r.ySymbol ? normalizeYSymbol(r.ySymbol) : `#row${i}`;
    const g = map.get(key) || { key, cat: r.cat, valueJpy: 0, priceJpy: null };
    g.valueJpy += Number(r.value) || 0;
    if (g.priceJpy == null && isNum(r.price) && r.price > 0) g.priceJpy = r.price;
    map.set(key, g);
  });
  return map;
}

/**
 * 部分一致で米ドル預り金の行か判定する（§3.1 funding.usdCashRows）
 * @param {any} row
 * @param {Array<{institution?: string, name?: string}>} rules
 */
function isUsdCashRow(row, rules) {
  if (row?.cat !== '現金・預金') return false;
  return rules.some((rule) => {
    if (!rule || (!rule.institution && !rule.name)) return false;
    const okInst = !rule.institution || String(row.institution || '').includes(rule.institution);
    const okName = !rule.name || String(row.name || '').includes(rule.name);
    return okInst && okName;
  });
}

// ── 本体 ────────────────────────────────────────────────────

/**
 * 注文表を計算する（§6）。plan が未投入なら null。
 *
 * @param {object} input
 * @param {any} input.plan KV `order:plan`
 * @param {any} [input.strategy] data/target-allocation.json（null＝取得失敗→既定値）
 * @param {any} input.networth KV `networth`（asOf・totals.imported・holdings[]）
 * @param {Record<string, number|{price:number}>} [input.prices] ySymbol → 現在値（USD）。Worker が取得順（§6.1）で解決済み
 * @param {number|{usdJpy:number, asOf?:string}} input.fx USDJPY
 * @param {Record<string, {ticker:string, weight:number}>} [input.etfTop] ETF → 構成上位 1 銘柄（weight は 0..1 か %）
 * @param {string|number|Date} input.now 計算時刻
 * @param {Array<any>} [input.log] KV `order:log`（新しい順。最終見直しの表示に使う）
 */
export function buildOrderSheet(input) {
  const { networth, prices, etfTop } = input || {};
  const planIn = input?.plan;
  if (!planIn || typeof planIn !== 'object' || !planIn.symbols) return null;
  const nowIso = toIso(input.now);
  /** @type {string[]} */
  const warnings = [];

  const fxRate = isNum(input.fx) ? input.fx : input.fx?.usdJpy;
  const fxAsOf = isNum(input.fx) ? null : (input.fx?.asOf ?? null);
  const fxOk = isNum(fxRate) && fxRate > 0;
  if (!fxOk) warnings.push('為替レートが無いため円建ての金額を換算できません');
  const toUsd = (jpy) => (fxOk ? jpy / fxRate : 0);

  const cfg = resolveStrategy(input.strategy, warnings);
  const rows = Array.isArray(networth?.holdings) ? networth.holdings : [];
  const imported = Number(networth?.totals?.imported) || rows.reduce((a, r) => a + (Number(r?.value) || 0), 0);
  const D = toUsd(imported);
  if (!(D > 0)) warnings.push('総資産（分母）が 0 のため比率を計算できません');
  const pct = (usd) => (D > 0 && isNum(usd) ? (usd / D) * 100 : null);

  // §5.2: mf の株数による約定検知をメモリ上で適用（KV は書かない）
  const detected = detectFills(planIn, networth, nowIso);
  const plan = detected.plan;
  // シンボル名の形が不正なキー（`__proto__` 等）・オブジェクトでない設定は使わない
  /** @type {Array<[string, any]>} */
  const planEntries = [];
  for (const [sym, sc] of Object.entries(plan.symbols)) {
    if (isValidSymbolKey(sym) && sc && typeof sc === 'object' && !Array.isArray(sc)) planEntries.push([sym, sc]);
    else warnings.push(`${String(sym).slice(0, 20)}: シンボル名または設定の形が不正のため除外`);
  }
  const autoDetected = detected.logs.map((l) => ({ symbol: l.symbol, stageId: l.stageId, partial: !!l.partial }));
  const autoSyms = new Set(autoDetected.map((a) => a.symbol));

  const qtyAvailable = hasQty(networth);
  const qtyOf = makeQtyLookup(networth);
  const groups = groupHoldings(rows);

  /** 現在値（USD）: prices → mf の price(JPY)÷USDJPY（概算） */
  const approxWarned = new Set();
  const currentPrice = (sym) => {
    const p = priceOf(prices, sym);
    if (p != null) return p;
    const g = groups.get(normalizeYSymbol(sym));
    if (g?.priceJpy && fxOk) {
      if (!approxWarned.has(sym)) {
        approxWarned.add(sym);
        warnings.push(`${sym}: 現在値が取れず MF の価格から概算価格を使用`);
      }
      return g.priceJpy / fxRate;
    }
    return null;
  };

  /** 現在額（USD）: USD 建てで qty と現在値があれば qty×price、無ければ Σ mf.value ÷ USDJPY */
  const curUsdOf = (key) => {
    const g = groups.get(key);
    if (isUsdSymbol(key)) {
      const q = qtyOf(key);
      const p = priceOf(prices, key);
      if (isNum(q) && p != null) return q * p;
    }
    return g ? toUsd(g.valueJpy) : 0;
  };

  // §6.7 現金比率（生活資金控除・JPST 含めず・現時点）
  const cashJpy = rows.reduce((a, r) => a + (r?.cat === '現金・預金' ? Number(r.value) || 0 : 0), 0);
  const cashPct = imported > 0 ? (Math.max(0, cashJpy - EMERGENCY_FUND_JPY) / imported) * 100 : 0;
  const guardActive = cashPct < cfg.orderSheet.cashFloorPct;

  // テーマの所属（themeCaps.members は正規化して照合）
  /** @type {Map<string, string[]>} */
  const themesOf = new Map();
  for (const [theme, tc] of Object.entries(cfg.themeCaps)) {
    for (const m of Array.isArray(tc?.members) ? tc.members : []) {
      const k = normalizeYSymbol(m);
      themesOf.set(k, [...(themesOf.get(k) || []), theme]);
    }
  }
  const themeCapOf = (theme) => {
    const tc = typeof theme === 'string' ? ownGet(cfg.themeCaps, theme) : undefined;
    return tc && typeof tc === 'object' ? tc : null;
  };
  const themeMembers = (theme) => {
    const m = themeCapOf(theme)?.members;
    return Array.isArray(m) ? m.map(normalizeYSymbol) : [];
  };
  const aiSet = new Set(cfg.aiTech.themes.flatMap(themeMembers));
  const nonEquitySet = new Set(cfg.stress.nonEquity.map(normalizeYSymbol));

  // 現在の保有額（USD）を全照合キーで持つ（plan にだけある銘柄は 0 で追加）
  /** @type {Map<string, number>} */
  const nowUsd = new Map();
  for (const key of groups.keys()) nowUsd.set(key, curUsdOf(key));
  for (const [sym] of planEntries) {
    const k = normalizeYSymbol(sym);
    if (!nowUsd.has(k)) nowUsd.set(k, curUsdOf(k));
  }
  const themeNowPct = (theme) => {
    let s = 0;
    for (const m of new Set(themeMembers(theme))) s += nowUsd.get(m) || 0;
    return pct(s);
  };

  /** @type {any[]} */
  const orders = [];
  /** @type {any[]} */
  const ladders = [];
  /** 3 時点用の増減（USD） */
  const deltaWorking = new Map();
  const deltaFinal = new Map();
  const addDelta = (map, key, v) => map.set(key, (map.get(key) || 0) + v);

  let buyWorking = 0;
  let sellWorking = 0;
  let buyTotal = 0;
  let sellTotal = 0;

  for (const [sym, sc] of planEntries) {
    const key = normalizeYSymbol(sym);
    if (!isUsdSymbol(sym)) {
      warnings.push(`${sym}: v1 は USD 建てのみのため注文表から除外`);
      continue;
    }
    const stages = Array.isArray(sc.stages) ? sc.stages : [];
    const curUsd = nowUsd.get(key) || 0;
    const price = currentPrice(sym);
    const mfQty = qtyOf(sym);
    const targetUsd = isNum(sc.targetUsd) ? sc.targetUsd : null;
    const ladderFlags = [];
    const ladderNotes = [];

    // §6.3 1 銘柄 1 段: 最初の未完了段を working とみなす
    const openStages = stages.filter(isOpenStage);
    const workingStage = openStages[0] || null;
    const savedWorking = openStages.filter((s) => s.state === 'working');
    if (openStages.length && (savedWorking.length !== 1 || savedWorking[0] !== workingStage)) {
      warnings.push(`${sym}: 保存された段の状態が不整合（最初の未完了段を発注中として表示）`);
    }

    // 段ごとの指値・株数・金額
    const view = new Map();
    for (const st of stages) {
      const placed = !!st.placedAt && st === workingStage;
      const shownLimit = stageLimit(sc, st);
      let limit;
      let qty;
      if (placed || st.state === 'filled') {
        limit = st.orderedLimit != null ? st.orderedLimit : st.placedAt ? null : shownLimit;
        qty = isNum(st.orderedQty) ? st.orderedQty : null;
      } else {
        limit = shownLimit;
        qty = null;
      }
      let qtyUnknown = false;
      if (qty == null) {
        if (st.side === 'buy') {
          qty = buyQty(st.amountUsd, limit, sc.lot);
        } else if (st.qty === 'all') {
          qty = isNum(mfQty) && mfQty > QTY_EPS ? mfQty : null;
          qtyUnknown = qty == null;
        } else {
          qty = isNum(st.qty) ? st.qty : null;
        }
      }
      const unitPrice = st.side === 'buy' ? limit : (limit ?? price);
      const amount = isNum(qty) && isNum(unitPrice) ? qty * unitPrice : null;
      const filledQty = isNum(st.filledQty) ? st.filledQty : 0;
      const remainQty = isNum(qty) ? Math.max(0, qty - (st === workingStage ? filledQty : 0)) : null;
      const remainAmount = isNum(remainQty) && isNum(unitPrice) ? remainQty * unitPrice : null;
      view.set(st, { limit, qty, amount, remainAmount, qtyUnknown, suppressed: null });
    }

    // §6.4 出さない条件（優先順）
    let hold = null;
    if (sc.tier !== 'exit' && targetUsd != null && curUsd >= targetUsd) {
      hold = 'targetReached';
    } else {
      for (const theme of themesOf.get(key) || []) {
        const cap = themeCapOf(theme)?.cap;
        const tp = themeNowPct(theme);
        if (isNum(cap) && isNum(tp) && tp >= cap) {
          hold = 'themeCapReached';
          ladderNotes.push(`テーマ ${theme} が上限 ${cap}% に到達（現在 ${round1(tp)}%）`);
          break;
        }
      }
    }
    if (hold) {
      for (const st of openStages) if (st.side === 'buy') view.get(st).suppressed = hold;
      if (hold === 'targetReached') ladderNotes.push('目標到達・HOLD');
    }
    let cashFloorDeepest = false;
    if (guardActive) {
      const openBuys = openStages.filter((s) => s.side === 'buy');
      const deepest = openBuys[openBuys.length - 1];
      if (deepest && !view.get(deepest).suppressed) {
        if (deepest === workingStage) cashFloorDeepest = true;
        else view.get(deepest).suppressed = 'cashFloor';
      }
    }

    // §6.6 単一銘柄の上限（警告のみ）
    if ((sc.tier === 'thick' || sc.tier === 'thin') && targetUsd != null && D > 0) {
      const capUsd = (D * cfg.convictionHighPct) / 100;
      if (targetUsd > capUsd) {
        ladderFlags.push('targetOverConvictionCap');
        ladderNotes.push(`目標が高確信の上限（総資産の ${cfg.convictionHighPct}%＝${fmtUsd(capUsd)}）を超えています`);
      }
    }

    // §6.10 再計算推奨
    let rebaseSuggested = false;
    if (openStages.length && isNum(price) && isNum(sc.basePrice) && sc.basePrice > 0) {
      const move = (price / sc.basePrice - 1) * 100;
      if (Math.abs(move) >= cfg.orderSheet.rebaseMovePct) {
        rebaseSuggested = true;
        ladderFlags.push('rebaseSuggested');
        const sign = move >= 0 ? '+' : '−';
        ladderNotes.push(`基準価格から ${sign}${Math.abs(round1(move))}% 動いた・基準を取り直して再計算を推奨`);
      }
    }

    // §6.9 ETF の中身の偏り（キャッシュがあるときだけ）
    let etfNote = null;
    const top = sc.tier === 'theme' ? ownGet(etfTop, sym) : null;
    if (top && top.ticker && isNum(top.weight)) {
      const w = top.weight <= 1 ? top.weight * 100 : top.weight;
      etfNote = `上位: ${top.ticker} ${Math.round(w)}%`;
      ladderFlags.push('etfConcentration');
      ladderNotes.push(etfNote);
    }

    // 資金・3 時点の集計（停止段は外す）
    for (const st of openStages) {
      const v = view.get(st);
      if (v.suppressed) continue;
      const amt = v.remainAmount;
      if (!isNum(amt)) {
        warnings.push(`${sym} ${st.id}: 金額を計算できないため資金計算から除外`);
        continue;
      }
      const sign = st.side === 'buy' ? 1 : -1;
      addDelta(deltaFinal, key, sign * amt);
      if (st.side === 'buy') buyTotal += amt;
      else sellTotal += amt;
      if (st === workingStage) {
        addDelta(deltaWorking, key, sign * amt);
        if (st.side === 'buy') buyWorking += amt;
        else sellWorking += amt;
      }
    }

    // 今出す注文（working 段・非停止）
    if (workingStage && !view.get(workingStage).suppressed) {
      const st = workingStage;
      const v = view.get(st);
      const filledQty = isNum(st.filledQty) ? st.filledQty : 0;
      const status = !st.placedAt ? 'toPlace' : filledQty > 0 ? 'partial' : 'placed';
      const sign = st.side === 'buy' ? 1 : -1;
      const afterUsd = Math.max(0, curUsd + sign * (v.remainAmount || 0));
      let inTheMoney = null;
      if (isNum(price)) {
        if (v.limit == null)
          inTheMoney = true; // 成行
        else inTheMoney = st.side === 'buy' ? price <= v.limit : price >= v.limit;
      }
      const flags = [];
      const notes = [];
      if (st.side === 'buy' && targetUsd != null && afterUsd > targetUsd) {
        flags.push('exceedsTargetAfterFill');
        notes.push(`約定後 目標超過 ${fmtUsd(afterUsd - targetUsd)}`);
      }
      if (cashFloorDeepest) {
        flags.push('cashFloorDeepest');
        notes.push('現金ガード対象・取消を検討');
      }
      if (rebaseSuggested) {
        flags.push('rebaseSuggested');
        notes.push(ladderNotes.find((n) => n.startsWith('基準価格から')));
      }
      if (etfNote) {
        flags.push('etfConcentration');
        notes.push(etfNote);
      }
      if (v.qtyUnknown) {
        flags.push('qtyUnknown');
        notes.push('株数未取得のため要入力');
      }
      if (autoSyms.has(sym)) {
        flags.push('autoDetected');
        notes.push('自動検知（MF の株数）');
      }
      orders.push({
        symbol: sym,
        side: st.side,
        tier: sc.tier,
        stageId: st.id,
        status,
        limit: v.limit,
        qty: v.qty,
        filledQty,
        amountUsd: roundUsd(v.amount),
        currentPrice: price,
        inTheMoney,
        curUsd: roundUsd(curUsd),
        curPct: round1(pct(curUsd)),
        afterUsd: roundUsd(afterUsd),
        afterPct: round1(pct(afterUsd)),
        targetUsd,
        targetPct: targetUsd != null ? round1(pct(targetUsd)) : null,
        next: nextStage(sc, stages, st, view),
        flags,
        notes,
      });
    }

    ladders.push({
      symbol: sym,
      tier: sc.tier,
      targetUsd,
      targetPct: targetUsd != null ? round1(pct(targetUsd)) : null,
      curUsd: roundUsd(curUsd),
      curPct: round1(pct(curUsd)),
      basePrice: isNum(sc.basePrice) ? sc.basePrice : null,
      baseAt: sc.baseAt ?? null,
      baseEvent: sc.baseEvent ?? null,
      note: typeof sc.note === 'string' ? sc.note : '',
      hold,
      flags: ladderFlags,
      notes: ladderNotes,
      stages: stages.map((st) => {
        const v = view.get(st);
        const isWorking = st === workingStage;
        let display = st.state;
        if (isWorking) {
          const fq = isNum(st.filledQty) ? st.filledQty : 0;
          display = !st.placedAt ? 'toPlace' : fq > 0 ? 'partial' : 'placed';
        } else if (isOpenStage(st)) {
          display = 'waiting';
        }
        return {
          id: st.id,
          side: st.side,
          state: isWorking ? 'working' : st.state,
          display,
          limit: v.limit,
          qty: v.qty,
          amountUsd: roundUsd(v.amount),
          dropPct: isNum(st.dropPct) ? st.dropPct : null,
          filledQty: isNum(st.filledQty) ? st.filledQty : 0,
          fillSource: st.fillSource ?? null,
          autoDetected: st.fillSource === 'mf-qty',
          suppressed: v.suppressed,
        };
      }),
    });
  }

  // §6.5 資金繰り（USD）
  const funding = plan.funding || {};
  const sweepSym = isValidSymbolKey(funding.sweepSymbol) ? funding.sweepSymbol : 'JPST';
  const sweepKey = normalizeYSymbol(sweepSym);
  const rules = Array.isArray(funding.usdCashRows) ? funding.usdCashRows : [];
  const usdCash =
    funding.useUsdCash === false
      ? 0
      : toUsd(rows.reduce((a, r) => a + (isUsdCashRow(r, rules) ? Number(r.value) || 0 : 0), 0));
  const need = buyWorking - sellWorking - usdCash;
  const sweepPrice = currentPrice(sweepSym);
  const sweepHeldUsd = nowUsd.get(sweepKey) ?? curUsdOf(sweepKey);
  const sweepMfQty = qtyOf(sweepSym);
  const sweepHeldQty = isNum(sweepMfQty)
    ? sweepMfQty
    : isNum(sweepPrice) && sweepPrice > 0
      ? Math.floor(sweepHeldUsd / sweepPrice + 1e-9)
      : null;
  let sweepQty = 0;
  let sweepUsd = 0;
  let sweepCapped = false;
  let sweepShortUsd = 0;
  if (need > 0) {
    if (!isNum(sweepPrice) || sweepPrice <= 0) {
      warnings.push(`${sweepSym}: 現在値が無いため資金繰りの売却株数を計算できません`);
      sweepQty = null;
      sweepUsd = null;
    } else {
      sweepQty = Math.ceil(need / sweepPrice - 1e-9);
      if (isNum(sweepHeldQty) && sweepQty > sweepHeldQty) {
        sweepQty = Math.max(0, sweepHeldQty);
        sweepCapped = true;
      }
      sweepUsd = sweepQty * sweepPrice;
      if (sweepCapped) {
        sweepShortUsd = need - sweepUsd;
        // 保有 0 株で行が出ない場合も含め、充当しきれない額を必ず警告に出す
        warnings.push(`資金繰り: ${sweepSym} の保有が足りず今出す注文に ${fmtUsd(sweepShortUsd)} 不足`);
      }
      if (sweepQty > 0) {
        orders.push({
          symbol: sweepSym,
          side: 'sell',
          role: 'funding',
          limit: null,
          qty: sweepQty,
          amountUsd: roundUsd(sweepUsd),
          currentPrice: sweepPrice,
          text: sweepCapped
            ? `米ドル買いの不足分を充当（保有株数まで・なお ${fmtUsd(sweepShortUsd)} 不足）`
            : '米ドル買いの不足分を充当',
        });
      }
      addDelta(deltaWorking, sweepKey, -sweepUsd);
    }
  }
  const available = sellTotal + usdCash + sweepHeldUsd;
  const shortfallUsd = Math.max(0, buyTotal - available);
  if (shortfallUsd > 0) warnings.push(`全段の合計に対し資金が ${fmtUsd(shortfallUsd)} 不足`);

  // 3 時点の保有額
  const valueAt = (which) => {
    /** @type {Map<string, number>} */
    const m = new Map(nowUsd);
    if (which === 'now') return m;
    const d = which === 'afterWorking' ? deltaWorking : deltaFinal;
    for (const [k, v] of d) m.set(k, Math.max(0, (m.get(k) || 0) + v));
    return m;
  };
  const points = { now: valueAt('now'), afterWorking: valueAt('afterWorking'), final: valueAt('final') };
  const sumOf = (m, keys) => {
    let s = 0;
    for (const k of keys) s += m.get(k) || 0;
    return s;
  };

  // §6.8 AI/テック合計とテーマ使用率
  const aiThemes = cfg.aiTech.themes.map((theme) => {
    const mem = new Set(themeMembers(theme));
    return {
      theme,
      cap: isNum(themeCapOf(theme)?.cap) ? themeCapOf(theme).cap : null,
      now: round1(pct(sumOf(points.now, mem))),
      afterWorking: round1(pct(sumOf(points.afterWorking, mem))),
      final: round1(pct(sumOf(points.final, mem))),
    };
  });
  const aiNow = round1(pct(sumOf(points.now, aiSet)));
  const aiAfter = round1(pct(sumOf(points.afterWorking, aiSet)));
  const aiFinal = round1(pct(sumOf(points.final, aiSet)));
  const aiTech = {
    capPct: cfg.aiTech.capPct,
    now: aiNow,
    afterWorking: aiAfter,
    final: aiFinal,
    over: [aiNow, aiAfter, aiFinal].some((x) => isNum(x) && x > cfg.aiTech.capPct),
    themes: aiThemes,
  };

  // §6.9 ストレス
  const planKeys = new Set(planEntries.map(([sym]) => normalizeYSymbol(sym)));
  const isEquity = (key) => {
    if (nonEquitySet.has(key)) return false;
    const g = groups.get(key);
    if (g) return EQUITY_CATS.includes(g.cat);
    return planKeys.has(key); // plan にだけある銘柄（新規買い）は USD 建ての株とみなす
  };
  const allKeys = new Set([...points.now.keys(), ...points.afterWorking.keys(), ...points.final.keys()]);
  const inGroup = (key, group) => {
    if (group === 'aiTech') return aiSet.has(key);
    if (group === 'otherEquity') return isEquity(key) && !aiSet.has(key);
    if (typeof group === 'string' && group.startsWith('theme:')) return themeMembers(group.slice(6)).includes(key);
    return false;
  };
  const equityPctAt = (m) => {
    let s = 0;
    for (const k of allKeys) if (aiSet.has(k) || (isEquity(k) && !aiSet.has(k))) s += m.get(k) || 0;
    return round1(pct(s));
  };
  const lossPctAt = (m, shocks) => {
    let loss = 0;
    for (const k of allKeys) {
      // 1 銘柄には最初に該当した区分のショックだけを当てる
      const sh = shocks.find((s) => inGroup(k, s?.group));
      if (sh && isNum(sh.pct)) loss += ((m.get(k) || 0) * Math.abs(sh.pct)) / 100;
    }
    return round1(pct(loss));
  };
  const tol = cfg.stress.tolerancePct;
  const stress = {
    tolerancePct: tol,
    equityPct: {
      now: equityPctAt(points.now),
      afterWorking: equityPctAt(points.afterWorking),
      final: equityPctAt(points.final),
    },
    scenarios: cfg.stress.scenarios.map((sc) => {
      const shocks = Array.isArray(sc?.shocks) ? sc.shocks : [];
      const now = lossPctAt(points.now, shocks);
      const afterWorking = lossPctAt(points.afterWorking, shocks);
      const final = lossPctAt(points.final, shocks);
      return {
        id: sc?.id ?? null,
        label: sc?.label ?? '',
        now,
        afterWorking,
        final,
        overNow: isNum(now) && now > tol,
        overAfterWorking: isNum(afterWorking) && afterWorking > tol,
        overFinal: isNum(final) && final > tol,
      };
    }),
  };

  return {
    asOf: nowIso,
    meta: {
      planRev: Number.isInteger(plan.rev) ? plan.rev : 0,
      holdingsAsOf: networth?.asOf ?? null,
      holdingsLagNote: HOLDINGS_LAG_NOTE,
      fxUsdJpy: fxOk ? fxRate : null,
      fxAsOf,
      denominatorUsd: roundUsd(D),
      qtyAvailable,
      autoDetected,
      warnings,
    },
    cash: { pct: round1(cashPct), floorPct: cfg.orderSheet.cashFloorPct, guardActive },
    orders,
    ladders,
    funding: {
      usd: {
        buyWorking: roundUsd(buyWorking),
        sellWorking: roundUsd(sellWorking),
        usdCash: roundUsd(usdCash),
        need: roundUsd(Math.max(0, need)),
        sweepSymbol: sweepSym,
        sweepQty,
        sweepUsd: roundUsd(sweepUsd),
        sweepCapped,
        sweepShortUsd: roundUsd(sweepShortUsd),
      },
      allStages: {
        buyTotal: roundUsd(buyTotal),
        sellTotal: roundUsd(sellTotal),
        available: roundUsd(available),
        shortfallUsd: roundUsd(shortfallUsd),
      },
    },
    aiTech,
    stress,
    review: lastReview(plan, input.log),
  };
}

/**
 * working 段の次の段（停止中を含めず）。無ければ「最終段」。
 * @param {any} sc
 * @param {any[]} stages
 * @param {any} working
 * @param {Map<any, any>} view
 */
function nextStage(sc, stages, working, view) {
  const idx = stages.indexOf(working);
  const nx = stages.slice(idx + 1).find((s) => isOpenStage(s) && !view.get(s).suppressed);
  if (!nx) return { stageId: null, limit: null, qty: null, dropPct: null, text: '最終段' };
  const v = view.get(nx);
  const dropPct = typeof nx.dropPct === 'number' ? nx.dropPct : null;
  const side = nx.side === 'sell' ? '売 ' : '';
  const qtyText = v.qty != null ? v.qty : '?';
  const dropText = dropPct != null ? `（基準比 ${dropPct >= 0 ? '−' : '+'}${Math.abs(dropPct)}%）` : '';
  return {
    stageId: nx.id,
    limit: v.limit,
    qty: v.qty,
    dropPct,
    text: `約定したら次は ${side}${fmtLimit(v.limit)}×${qtyText}${dropText}`,
  };
}

/**
 * 最終見直し（§8.4）。order:log の最新 review / rebase、無ければ各銘柄の基準取り直しの最新。
 * @param {any} plan
 * @param {any[]|undefined} log
 */
function lastReview(plan, log) {
  if (Array.isArray(log)) {
    const e = log.find((l) => l && (l.type === 'review' || l.type === 'rebase') && l.event);
    if (e) return { lastEvent: e.event, lastAt: e.at ?? null };
  }
  let best = null;
  for (const sc of Object.values(plan.symbols || {})) {
    const at = /** @type {any} */ (sc)?.baseAt;
    if (typeof at === 'string' && (!best || at > best.lastAt)) best = { lastEvent: sc.baseEvent ?? null, lastAt: at };
  }
  return best || { lastEvent: null, lastAt: null };
}
