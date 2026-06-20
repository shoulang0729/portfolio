// @ts-check

// ══════════════════════════════════════════════════════════════
// triggers.js  ―  売り/買いトリガー台帳ローダーと評価エンジン
//
// data/triggers.json を読み込み、各銘柄のトリガー定義を返す。
// evaluateTriggers() は純粋関数として ctx を受け取り、
// active（抵触）と watching（thesis/conditional 監視中）に分類する。
//
// 依存: なし
// ══════════════════════════════════════════════════════════════

const TRIGGERS_URL = 'data/triggers.json';

/**
 * @typedef {{
 *   sell?: Array<any>,
 *   buy?:  Array<any>
 * }} TriggerEntry
 */

/** @type {Record<string, TriggerEntry>} */
let _trig = {};

/** @type {boolean} */
let _loaded = false;

/**
 * data/triggers.json を読み込む（失敗時は _trig = {}）。
 * @returns {Promise<Record<string, TriggerEntry>>}
 */
export async function loadTriggers() {
  try {
    const r = await fetch(`${TRIGGERS_URL}?_=${Date.now()}`);
    if (!r.ok) throw new Error(`triggers ${r.status}`);
    const j = await r.json();
    _trig = (j && j.triggers) || {};
    _loaded = true;
  } catch {
    _trig = {};
  }
  return _trig;
}

/**
 * トリガーが読み込まれているか。
 * @returns {boolean}
 */
export function triggersLoaded() {
  return _loaded;
}

/**
 * 銘柄シンボルのトリガー定義を返す。無ければ null。
 * @param {string|undefined|null} symbol
 * @returns {TriggerEntry|null}
 */
export function getTriggers(symbol) {
  if (!symbol) return null;
  return _trig[symbol] || null;
}

/**
 * テスト用: _trig を直接注入する（fetch なしで純関数をテスト可能にする）。
 * @param {Record<string, TriggerEntry>} obj
 */
export function __setTriggers(obj) {
  _trig = obj;
  _loaded = true;
}

/**
 * @typedef {{
 *   percentile?: number|null,
 *   peg?: number|null,
 *   themeUsagePct?: number|null,
 *   price?: number|null
 * }} TriggerCtx
 */

/**
 * @typedef {{
 *   side: 'sell'|'buy',
 *   type: string,
 *   action: string,
 *   reason: string
 * }} ActiveTrigger
 */

/**
 * @typedef {{
 *   side: 'sell'|'buy',
 *   type: string,
 *   action: string,
 *   note: string
 * }} WatchingTrigger
 */

/**
 * 銘柄のトリガーを評価し、抵触中（active）と監視中（watching）に分類する。
 *
 * type 別ルール:
 *   concentration: ctx.themeUsagePct > capPct → active
 *   valuation sell: percentile >= pctGte OR peg >= pegGte → active
 *   valuation buy:  percentile <= pctLte → active
 *   limit: (dir=below && price<=trigPrice) OR (dir=above && price>=trigPrice) → active
 *   thesis / conditional: 常に watching（自動判定しない）
 *
 * @param {string} symbol
 * @param {TriggerCtx} ctx
 * @returns {{ active: ActiveTrigger[], watching: WatchingTrigger[] }}
 */
export function evaluateTriggers(symbol, ctx) {
  const entry = getTriggers(symbol);
  /** @type {ActiveTrigger[]} */
  const active = [];
  /** @type {WatchingTrigger[]} */
  const watching = [];

  if (!entry) return { active, watching };

  /**
   * @param {Array<any>} list
   * @param {'sell'|'buy'} side
   */
  function evalList(list, side) {
    for (const t of list) {
      const type = t.type;
      const action = t.action || '';

      // thesis / conditional → 常に watching
      if (type === 'thesis' || type === 'conditional') {
        watching.push({ side, type, action, note: t.note || '' });
        continue;
      }

      // concentration
      if (type === 'concentration') {
        const capPct = t.capPct;
        const themeUsagePct = ctx.themeUsagePct;
        if (themeUsagePct != null && themeUsagePct > capPct) {
          const reason =
            t.theme === 'semiconductor'
              ? `半導体集中 ${themeUsagePct.toFixed(1)}%>${capPct}%`
              : `集中度 ${themeUsagePct.toFixed(1)}%>${capPct}%`;
          active.push({ side, type, action, reason });
        }
        continue;
      }

      // valuation
      if (type === 'valuation') {
        if (side === 'sell') {
          // pctGte check
          if (t.pctGte != null && ctx.percentile != null && ctx.percentile >= t.pctGte) {
            active.push({ side, type, action, reason: `%タイル${Math.round(ctx.percentile)}≥${t.pctGte}` });
            continue;
          }
          // pegGte check
          if (t.pegGte != null && ctx.peg != null && ctx.peg >= t.pegGte) {
            active.push({ side, type, action, reason: `PEG${ctx.peg.toFixed(1)}≥${t.pegGte}` });
            continue;
          }
        } else {
          // buy: pctLte check
          if (t.pctLte != null && ctx.percentile != null && ctx.percentile <= t.pctLte) {
            active.push({ side, type, action, reason: `%タイル${Math.round(ctx.percentile)}≤${t.pctLte}` });
            continue;
          }
        }
        continue;
      }

      // limit
      if (type === 'limit') {
        const trigPrice = t.price;
        const curPrice = ctx.price;
        if (curPrice != null && trigPrice != null) {
          if (t.dir === 'below' && curPrice <= trigPrice) {
            active.push({ side, type, action, reason: `価格 ${curPrice}≤${trigPrice}` });
            continue;
          }
          if (t.dir === 'above' && curPrice >= trigPrice) {
            active.push({ side, type, action, reason: `価格 ${curPrice}≥${trigPrice}` });
            continue;
          }
        }
        continue;
      }
    }
  }

  if (Array.isArray(entry.sell)) evalList(entry.sell, 'sell');
  if (Array.isArray(entry.buy)) evalList(entry.buy, 'buy');

  return { active, watching };
}
