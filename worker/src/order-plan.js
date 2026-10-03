// ══════════════════════════════════════════════════════════════
// order-plan.js  ―  注文表の設定（KV `order:plan`）の検証・状態遷移・約定検知（純関数）
//
// 設計: docs/handoff/2026-10-03-order-sheet.md §3.1・§5（PR1）
//
// - env / fetch / KV / Date.now に依存しない（時刻は ctx.now 等の引数で受け取る）。
//   Worker（PR3）と vitest の両方から import する。
// - 入力の plan は変更しない（常に複製してから書き換える）。
// - 公開リポ: このファイルに実値（銘柄ごとの目標額・指値・株数）を書かない。
// ══════════════════════════════════════════════════════════════

export const PLAN_SCHEMA_VERSION = 1;
export const ORDER_LOG_MAX = 300;

export const TIERS = ['thick', 'thin', 'theme', 'special', 'exit'];
export const SIDES = ['buy', 'sell'];
export const STAGE_STATES = ['waiting', 'working', 'filled', 'cancelled'];
export const FILL_SOURCES = ['mf-qty', 'self', 'mcp'];
export const EVENT_TYPES = ['placed', 'filled', 'cancelled', 'unplace', 'rebase', 'review'];

/** 状態の変更イベントが不正なときに投げる（Worker は 400 に写す） */
export class OrderEventError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'OrderEventError';
  }
}

// ── 基本ヘルパー ─────────────────────────────────────────────

/** @param {unknown} v */
function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/** @param {unknown} v */
function isPosNum(v) {
  return isNum(v) && /** @type {number} */ (v) > 0;
}

/** @param {unknown} v */
function isPosInt(v) {
  return Number.isInteger(v) && /** @type {number} */ (v) > 0;
}

/** @param {unknown} v */
function isObj(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * JSON 互換の深い複製（plan は JSON なのでこれで足りる）
 * @template T
 * @param {T} v
 * @returns {T}
 */
export function clonePlan(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v));
}

/**
 * 時刻引数を ISO 文字列に正規化する（ISO 文字列 / Date / epoch ms を受ける）
 * @param {string|number|Date|undefined|null} t
 * @returns {string|null}
 */
export function toIso(t) {
  if (t == null) return null;
  const d = t instanceof Date ? t : new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * mf の ySymbol を照合用に正規化する。4 桁コード（例 `200A`・`1306`）は `.T` を付ける（§6.1）。
 * @param {unknown} s
 * @returns {string}
 */
export function normalizeYSymbol(s) {
  const t = String(s ?? '').trim();
  if (/^\d{3}[0-9A-Z]$/.test(t)) return `${t}.T`;
  return t;
}

/**
 * v1 で扱える USD 建ての銘柄か（`.T` 等の取引所サフィックス付き・4 桁コードは不可）
 * @param {string} sym
 */
export function isUsdSymbol(sym) {
  const n = normalizeYSymbol(sym);
  return n.length > 0 && !n.includes('.');
}

/** 未完了（filled / cancelled 以外）の段か */
export function isOpenStage(st) {
  return !!st && st.state !== 'filled' && st.state !== 'cancelled';
}

/**
 * 指値の刻み（§6.2）: 価格 ≥ $20 は $1、未満は $0.01（四捨五入）
 * @param {number} x
 * @returns {number}
 */
export function roundTick(x) {
  if (!isNum(x)) return null;
  if (x >= 20) return Math.round(x);
  return Math.round(x * 100) / 100;
}

/**
 * 段の指値（発注前の表示値）。`limit` があればそれ、無ければ基準価格×(1−dropPct/100) を刻みで丸める。
 * どちらも無ければ null（sell の成行）。
 * @param {{basePrice?: number|null}} symCfg
 * @param {{limit?: number|null, dropPct?: number|null}} stage
 * @returns {number|null}
 */
export function stageLimit(symCfg, stage) {
  if (isPosNum(stage.limit)) return stage.limit;
  if (isNum(stage.dropPct) && isPosNum(symCfg?.basePrice)) {
    return roundTick(symCfg.basePrice * (1 - stage.dropPct / 100));
  }
  return null;
}

/**
 * buy 段の株数（§6.2）: floor(amountUsd ÷ limit ÷ lot) × lot、最低 1 lot。
 * floor のため金額は amountUsd を超えない（1 lot 未満になる場合を除く）。
 * @param {number} amountUsd
 * @param {number} limit
 * @param {number} [lot]
 * @returns {number|null}
 */
export function buyQty(amountUsd, limit, lot = 1) {
  if (!isPosNum(amountUsd) || !isPosNum(limit)) return null;
  const l = isPosInt(lot) ? lot : 1;
  // 浮動小数の誤差（例 29808/368 が 80.999…）で 1 株減らないよう微小値を足す
  const lots = Math.floor(amountUsd / limit / l + 1e-9);
  return Math.max(1, lots) * l;
}

/**
 * mf（networth）の保有から銘柄ごとの株数を引く関数を作る。
 * - どの行にも数値の `qty` が無い（PR4 前）→ 常に null（＝株数不明）
 * - 該当行が無い → 0（売り切った・未保有）
 * - 該当行の一部でも `qty` が無い → null
 * @param {{holdings?: Array<{ySymbol?: string, qty?: number}>}|null|undefined} networth
 * @returns {(sym: string) => number|null}
 */
export function makeQtyLookup(networth) {
  const rows = Array.isArray(networth?.holdings) ? networth.holdings : [];
  const available = rows.some((r) => isNum(r?.qty));
  return (sym) => {
    if (!available) return null;
    const key = normalizeYSymbol(sym);
    const hit = rows.filter((r) => r && r.ySymbol != null && normalizeYSymbol(r.ySymbol) === key);
    if (hit.some((r) => !isNum(r.qty))) return null;
    return hit.reduce((a, r) => a + r.qty, 0);
  };
}

/** mf に株数（qty）があるか（PR4 前は false） */
export function hasQty(networth) {
  const rows = Array.isArray(networth?.holdings) ? networth.holdings : [];
  return rows.some((r) => isNum(r?.qty));
}

// ── 検証（§3.1・§5.3） ──────────────────────────────────────

/**
 * plan の形と不変条件を検証する。
 * @param {unknown} plan
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validatePlan(plan) {
  /** @type {string[]} */
  const errors = [];
  if (!isObj(plan)) return { ok: false, errors: ['plan はオブジェクトであること'] };
  const p = /** @type {any} */ (plan);

  if (p.schemaVersion !== PLAN_SCHEMA_VERSION) errors.push(`schemaVersion は ${PLAN_SCHEMA_VERSION} であること`);
  if (p.rev != null && !(Number.isInteger(p.rev) && p.rev >= 0)) errors.push('rev は 0 以上の整数であること');

  // funding
  if (!isObj(p.funding)) {
    errors.push('funding はオブジェクトであること');
  } else {
    const f = p.funding;
    if (typeof f.sweepSymbol !== 'string' || !f.sweepSymbol.trim()) {
      errors.push('funding.sweepSymbol は空でない文字列であること');
    } else if (!isUsdSymbol(f.sweepSymbol)) {
      errors.push('funding.sweepSymbol は USD 建ての銘柄であること');
    }
    if (f.useUsdCash != null && typeof f.useUsdCash !== 'boolean') errors.push('funding.useUsdCash は真偽値であること');
    if (f.usdCashRows != null) {
      if (!Array.isArray(f.usdCashRows)) {
        errors.push('funding.usdCashRows は配列であること');
      } else {
        f.usdCashRows.forEach((r, i) => {
          if (!isObj(r)) {
            errors.push(`funding.usdCashRows[${i}] はオブジェクトであること`);
            return;
          }
          const okInst = r.institution == null || typeof r.institution === 'string';
          const okName = r.name == null || typeof r.name === 'string';
          if (!okInst || !okName) errors.push(`funding.usdCashRows[${i}] の institution / name は文字列であること`);
          if (!r.institution && !r.name)
            errors.push(`funding.usdCashRows[${i}] は institution か name のどちらかが必要`);
        });
      }
    }
  }

  // symbols
  if (!isObj(p.symbols)) {
    errors.push('symbols はオブジェクトであること');
    return { ok: errors.length === 0, errors };
  }
  for (const [sym, cfg] of Object.entries(p.symbols)) {
    const at = `symbols.${sym}`;
    if (!isUsdSymbol(sym)) errors.push(`${at}: v1 は USD 建ての銘柄のみ（取引所サフィックス付き・4 桁コードは不可）`);
    if (!isObj(cfg)) {
      errors.push(`${at} はオブジェクトであること`);
      continue;
    }
    if (!TIERS.includes(cfg.tier)) errors.push(`${at}.tier は ${TIERS.join(' | ')} のいずれか`);
    const targetNullable = cfg.tier === 'theme' || cfg.tier === 'exit';
    if (cfg.targetUsd == null) {
      if (!targetNullable) errors.push(`${at}.targetUsd は正の数であること（null 可は tier=theme / exit のみ）`);
    } else if (!isPosNum(cfg.targetUsd)) {
      errors.push(`${at}.targetUsd は正の数か null であること`);
    }
    if (cfg.lot != null && !isPosInt(cfg.lot)) errors.push(`${at}.lot は正の整数であること`);
    if (cfg.basePrice != null && !isPosNum(cfg.basePrice)) errors.push(`${at}.basePrice は正の数か null であること`);
    if (cfg.note != null && typeof cfg.note !== 'string') errors.push(`${at}.note は文字列であること`);
    if (!Array.isArray(cfg.stages)) {
      errors.push(`${at}.stages は配列であること`);
      continue;
    }

    const ids = new Set();
    cfg.stages.forEach((st, i) => {
      const sat = `${at}.stages[${i}]`;
      if (!isObj(st)) {
        errors.push(`${sat} はオブジェクトであること`);
        return;
      }
      if (typeof st.id !== 'string' || !st.id) errors.push(`${sat}.id は空でない文字列であること`);
      else if (ids.has(st.id)) errors.push(`${sat}.id が重複（${st.id}）`);
      else ids.add(st.id);
      if (!SIDES.includes(st.side)) errors.push(`${sat}.side は buy | sell`);
      if (!STAGE_STATES.includes(st.state)) errors.push(`${sat}.state は ${STAGE_STATES.join(' | ')} のいずれか`);
      if (st.dropPct != null && !(isNum(st.dropPct) && st.dropPct < 100)) {
        errors.push(`${sat}.dropPct は 100 未満の数か null であること`);
      }
      if (st.limit != null && !isPosNum(st.limit)) errors.push(`${sat}.limit は正の数か null であること`);
      if (st.side === 'buy') {
        if (!isPosNum(st.amountUsd)) errors.push(`${sat}: buy 段は amountUsd > 0 が必要`);
        const derivable = isNum(st.dropPct) && isPosNum(cfg.basePrice);
        if (!isPosNum(st.limit) && !derivable) {
          errors.push(`${sat}: buy 段は limit > 0、または dropPct と basePrice の両方が必要`);
        }
        if (st.qty != null) errors.push(`${sat}: buy 段の qty は null（株数は金額から導出）`);
        if (cfg.tier === 'exit') errors.push(`${sat}: tier=exit は sell 段のみ`);
      } else if (st.side === 'sell') {
        if (!(isPosInt(st.qty) || st.qty === 'all')) errors.push(`${sat}: sell 段は qty（正の整数か "all"）が必要`);
      }
      if (st.filledQty != null && !(isNum(st.filledQty) && st.filledQty >= 0)) {
        errors.push(`${sat}.filledQty は 0 以上の数であること`);
      }
      if (st.orderedQty != null && !isPosNum(st.orderedQty))
        errors.push(`${sat}.orderedQty は正の数か null であること`);
      if (st.orderedLimit != null && !isPosNum(st.orderedLimit)) {
        errors.push(`${sat}.orderedLimit は正の数か null であること`);
      }
      if (st.qtyAtPlace != null && !(isNum(st.qtyAtPlace) && st.qtyAtPlace >= 0)) {
        errors.push(`${sat}.qtyAtPlace は 0 以上の数か null であること`);
      }
      if (st.fillSource != null && !FILL_SOURCES.includes(st.fillSource)) {
        errors.push(`${sat}.fillSource は ${FILL_SOURCES.join(' | ')} のいずれか`);
      }
      if (st.placedAt != null && st.state !== 'working' && st.state !== 'filled' && st.state !== 'cancelled') {
        errors.push(`${sat}: placedAt があるのに state=${st.state}`);
      }
    });

    // 1 銘柄 1 段: 未完了段のうち working はちょうど 1 つ、かつ並び順で最初の未完了段
    const open = cfg.stages.filter((st) => isObj(st) && isOpenStage(st));
    const working = open.filter((st) => st.state === 'working');
    if (open.length > 0) {
      if (working.length !== 1) {
        errors.push(`${at}: 未完了段のうち working はちょうど 1 つであること（現在 ${working.length}）`);
      } else if (open[0] !== working[0]) {
        errors.push(`${at}: working は並び順で最初の未完了段であること`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

// ── 状態遷移（§5.1） ───────────────────────────────────────

/** 発注関連のフィールドを未発注に戻す */
function resetPlacement(st) {
  st.placedAt = null;
  st.orderedQty = null;
  st.orderedLimit = null;
  st.qtyAtPlace = null;
}

/**
 * 未完了段のうち並び順で最初の段を working（要発注）にする。
 * 既に working ならそのまま。
 * @param {Array<any>} stages
 * @returns {any|null} working になった段（未完了段が無ければ null）
 */
function promoteNext(stages) {
  const first = stages.find(isOpenStage);
  if (!first) return null;
  if (first.state !== 'working') {
    first.state = 'working';
    resetPlacement(first);
    if (!isNum(first.filledQty)) first.filledQty = 0;
  }
  return first;
}

/**
 * 段が「表示中」に出している指値と株数（発注前の値）。sell の "all" は mf の株数を使う。
 * @param {any} symCfg
 * @param {any} st
 * @param {number|null} mfQty
 * @returns {{limit: number|null, qty: number|null}}
 */
export function displayedOrder(symCfg, st, mfQty) {
  const limit = stageLimit(symCfg, st);
  if (st.side === 'buy') return { limit, qty: buyQty(st.amountUsd, limit, symCfg.lot) };
  if (st.qty === 'all') return { limit, qty: isNum(mfQty) && mfQty > 0 ? mfQty : null };
  return { limit, qty: isPosInt(st.qty) ? st.qty : null };
}

/**
 * 状態の変更イベントを適用する（§5.1）。rev の一致確認（409）は呼び出し側（Worker）の責務。
 * 成功時は rev を +1・updatedAt を now にした新しい plan と、order:log に積む 1 件を返す。
 *
 * @param {any} plan 現在の plan（変更しない）
 * @param {{type: string, symbol?: string, stageId?: string, [k: string]: any}} event
 * @param {{now: string|number|Date, networth?: any}} ctx now は必須。networth は mf の株数（qtyAtPlace・sell "all"）に使う
 * @returns {{plan: any, log: object}}
 * @throws {OrderEventError} イベントが不正なとき
 */
export function applyEvent(plan, event, ctx) {
  const now = toIso(ctx?.now);
  if (!now) throw new OrderEventError('ctx.now が必要');
  if (!isObj(plan) || !isObj(plan.symbols)) throw new OrderEventError('plan が未投入');
  if (!isObj(event) || !EVENT_TYPES.includes(event.type)) {
    throw new OrderEventError(`type は ${EVENT_TYPES.join(' | ')} のいずれか`);
  }
  const next = clonePlan(plan);
  const qtyOf = makeQtyLookup(ctx?.networth);
  /** @type {any} */
  const log = { at: now, type: event.type };

  const needSymbol = () => {
    const sym = typeof event.symbol === 'string' ? event.symbol : '';
    const cfg = next.symbols[sym];
    if (!cfg) throw new OrderEventError(`symbol が plan に無い: ${sym || '(空)'}`);
    log.symbol = sym;
    return { sym, cfg };
  };
  const needStage = (cfg) => {
    const st = Array.isArray(cfg.stages) ? cfg.stages.find((s) => s.id === event.stageId) : null;
    if (!st) throw new OrderEventError(`stageId が無い: ${event.stageId ?? '(空)'}`);
    log.stageId = st.id;
    return st;
  };
  const needWorking = (cfg, st) => {
    const first = cfg.stages.find(isOpenStage);
    if (first !== st) throw new OrderEventError('working 段（最初の未完了段）ではない');
    // 保存値が壊れていても最初の未完了段を working とみなす（§6.3）
    st.state = 'working';
  };

  switch (event.type) {
    case 'placed': {
      const { sym, cfg } = needSymbol();
      const st = needStage(cfg);
      needWorking(cfg, st);
      const mfQty = qtyOf(sym);
      const shown = displayedOrder(cfg, st, mfQty);
      const orderedQty = event.orderedQty != null ? event.orderedQty : shown.qty;
      const orderedLimit = event.orderedLimit !== undefined ? event.orderedLimit : shown.limit;
      if (!isPosNum(orderedQty)) throw new OrderEventError('orderedQty を決められない（指定するか mf の株数が必要）');
      if (orderedLimit != null && !isPosNum(orderedLimit)) throw new OrderEventError('orderedLimit は正の数か null');
      if (st.side === 'buy' && orderedLimit == null) throw new OrderEventError('buy 段は指値が必要');
      st.placedAt = now;
      st.orderedQty = orderedQty;
      st.orderedLimit = orderedLimit;
      st.qtyAtPlace = isNum(mfQty) ? mfQty : null;
      if (!isNum(st.filledQty)) st.filledQty = 0;
      Object.assign(log, { orderedQty, orderedLimit, qtyAtPlace: st.qtyAtPlace });
      break;
    }
    case 'filled': {
      const { cfg } = needSymbol();
      const st = needStage(cfg);
      needWorking(cfg, st);
      const source = event.source == null ? 'self' : event.source;
      if (!FILL_SOURCES.includes(source)) throw new OrderEventError(`source は ${FILL_SOURCES.join(' | ')} のいずれか`);
      log.source = source;
      const prev = isNum(st.filledQty) ? st.filledQty : 0;
      if (event.filledQty != null) {
        if (!isPosNum(event.filledQty)) throw new OrderEventError('filledQty は正の数');
        const cum = prev + event.filledQty;
        if (isPosNum(st.orderedQty) && cum < st.orderedQty) {
          // 一部約定: working のまま累計を加算
          st.filledQty = cum;
          Object.assign(log, { partial: true, filledQty: cum, orderedQty: st.orderedQty });
          break;
        }
        st.filledQty = cum;
      } else if (isPosNum(st.orderedQty)) {
        st.filledQty = st.orderedQty;
      }
      st.state = 'filled';
      st.filledAt = now;
      st.fillSource = source;
      log.filledQty = st.filledQty;
      const w = promoteNext(cfg.stages);
      if (w) log.nextStageId = w.id;
      break;
    }
    case 'cancelled': {
      const { cfg } = needSymbol();
      const st = needStage(cfg);
      if (!isOpenStage(st)) throw new OrderEventError(`既に ${st.state} の段`);
      st.state = 'cancelled';
      const w = promoteNext(cfg.stages);
      if (w) log.nextStageId = w.id;
      break;
    }
    case 'unplace': {
      const { cfg } = needSymbol();
      const st = needStage(cfg);
      needWorking(cfg, st);
      resetPlacement(st);
      break;
    }
    case 'rebase': {
      const { cfg } = needSymbol();
      if (!isPosNum(event.basePrice)) throw new OrderEventError('basePrice は正の数');
      if (typeof event.event !== 'string' || !event.event) throw new OrderEventError('event（見直しの契機）が必要');
      cfg.basePrice = event.basePrice;
      cfg.baseAt = now;
      cfg.baseEvent = event.event;
      const includeWorking = event.includeWorking === true;
      for (const st of cfg.stages || []) {
        if (!isNum(st.dropPct)) continue;
        if (st.state === 'waiting') {
          st.limit = null;
        } else if (st.state === 'working' && includeWorking) {
          st.limit = null;
          if (st.placedAt) {
            resetPlacement(st); // 発注済みなら要訂正（unplace と同じ扱い）
            log.unplacedStageId = st.id;
          }
        }
      }
      Object.assign(log, { basePrice: event.basePrice, event: event.event, includeWorking });
      break;
    }
    case 'review': {
      if (typeof event.event !== 'string' || !event.event) throw new OrderEventError('event（見直しの契機）が必要');
      log.event = event.event;
      if (typeof event.symbol === 'string' && event.symbol) log.symbol = event.symbol;
      break;
    }
    default:
      throw new OrderEventError('未知の type');
  }

  next.rev = (Number.isInteger(next.rev) ? next.rev : 0) + 1;
  next.updatedAt = now;
  log.rev = next.rev;
  return { plan: next, log };
}

/**
 * order:log の先頭に積み、最大件数で古いものを捨てる（新しい順）
 * @param {Array<object>|null|undefined} logArr
 * @param {Array<object>} entries 新しい順でなくてよい（渡した順に先頭へ積む＝最後の要素が最新）
 */
export function appendLog(logArr, entries) {
  const base = Array.isArray(logArr) ? logArr : [];
  const add = [...entries].reverse();
  return [...add, ...base].slice(0, ORDER_LOG_MAX);
}

// ── 約定の自動検知（§5.2） ─────────────────────────────────

/** ISO 時刻の UTC 日付（YYYY-MM-DD） */
function utcDate(t) {
  const iso = toIso(t);
  return iso ? iso.slice(0, 10) : null;
}

/**
 * mf の株数の増減から約定を検知する。rev は変えない（GET の表示用にメモリで適用でき、
 * Cron が書くときに rev を +1 する）。logs[].rev は書き込み時の rev（plan.rev+1）を入れる。
 *
 * 条件: working・placedAt/qtyAtPlace/orderedQty あり・holdings.asOf の日付 > placedAt の UTC 日付。
 * @param {any} plan
 * @param {{asOf?: string, holdings?: Array<any>}} holdings networth（mf 完全版）
 * @param {string|number|Date} [now] filledAt に使う時刻（省略時は holdings.asOf）
 * @returns {{plan: any, logs: Array<object>}}
 */
export function detectFills(plan, holdings, now) {
  if (!isObj(plan) || !isObj(plan.symbols)) return { plan, logs: [] };
  const asOfDate = typeof holdings?.asOf === 'string' ? holdings.asOf.slice(0, 10) : null;
  const qtyOf = makeQtyLookup(holdings);
  if (!asOfDate || !hasQty(holdings)) return { plan, logs: [] };

  const next = clonePlan(plan);
  const at = toIso(now) || toIso(asOfDate);
  const rev = (Number.isInteger(next.rev) ? next.rev : 0) + 1;
  /** @type {Array<any>} */
  const logs = [];

  for (const [sym, cfg] of Object.entries(next.symbols)) {
    const stages = Array.isArray(cfg?.stages) ? cfg.stages : [];
    const st = stages.find(isOpenStage);
    if (!st || st.state !== 'working') continue;
    if (!st.placedAt || !isNum(st.qtyAtPlace) || !isPosNum(st.orderedQty)) continue;
    const placedDate = utcDate(st.placedAt);
    if (!placedDate || !(asOfDate > placedDate)) continue; // 同日の同期は寄付前で約定を含まない
    const mfQty = qtyOf(sym);
    if (!isNum(mfQty)) continue;

    let filled = false;
    let partialQty = null;
    if (st.side === 'buy') {
      if (mfQty >= st.qtyAtPlace + st.orderedQty) filled = true;
      else if (mfQty > st.qtyAtPlace) partialQty = mfQty - st.qtyAtPlace;
    } else if (st.qty === 'all') {
      if (mfQty === 0) filled = true;
      else if (mfQty < st.qtyAtPlace) partialQty = st.qtyAtPlace - mfQty;
    } else {
      if (mfQty <= st.qtyAtPlace - st.orderedQty) filled = true;
      else if (mfQty < st.qtyAtPlace) partialQty = st.qtyAtPlace - mfQty;
    }

    if (filled) {
      st.state = 'filled';
      st.filledQty = st.orderedQty;
      st.filledAt = at;
      st.fillSource = 'mf-qty';
      const w = promoteNext(stages);
      const log = { at, type: 'filled', symbol: sym, stageId: st.id, source: 'mf-qty', rev, filledQty: st.orderedQty };
      if (w) log.nextStageId = w.id;
      logs.push(log);
    } else if (partialQty != null && partialQty !== st.filledQty) {
      st.filledQty = partialQty;
      st.fillSource = 'mf-qty';
      logs.push({
        at,
        type: 'filled',
        partial: true,
        symbol: sym,
        stageId: st.id,
        source: 'mf-qty',
        rev,
        filledQty: partialQty,
        orderedQty: st.orderedQty,
      });
    }
  }
  return { plan: logs.length ? next : plan, logs };
}
