// @ts-check

// ══════════════════════════════════════════════════════════════
// target-allocation.js  ―  適正サイズ v1 ヘルパー
//
// data/target-allocation.json を読み込み、各銘柄の target% を解決し、
// テーマ使用率と乖離（gapPct = currentPct − targetPct）を計算する。
//
// 解決順:
//   1. override[symbol].targetPct
//   2. tiers.core.targets[symbol] または tiers.defensive.targets[symbol]
//   3. symbol がテーマメンバー → convictionPct[ conviction[symbol] || 'standard' ]
//   4. null
// ══════════════════════════════════════════════════════════════

const TARGET_ALLOC_URL = 'data/target-allocation.json';

/** @type {any|null} */
let _cfg = null;

/**
 * data/target-allocation.json を読み込む（失敗時は null を返す）。
 * @returns {Promise<any|null>}
 */
export async function loadTargetAllocation() {
  try {
    const r = await fetch(`${TARGET_ALLOC_URL}?_=${Date.now()}`);
    if (!r.ok) throw new Error(`target-allocation ${r.status}`);
    _cfg = await r.json();
  } catch {
    _cfg = null;
  }
  return _cfg;
}

/**
 * テスト用: config を直接注入する（fetch を呼ばずに純関数をテスト可能にする）。
 * @param {any} cfg
 */
export function __setConfig(cfg) {
  _cfg = cfg;
}

/**
 * symbol が属するテーマ（themeCaps のキー）を返す。無ければ null。
 * @param {string} symbol
 * @returns {string|null}
 */
export function getThemeOf(symbol) {
  if (!_cfg || !_cfg.themeCaps) return null;
  for (const [theme, def] of Object.entries(_cfg.themeCaps)) {
    if (Array.isArray(def.members) && def.members.includes(symbol)) return theme;
  }
  return null;
}

/**
 * symbol の target% を返す。解決不能なら null。
 * 解決順: override → core/defensive → テーマ+確信度 → null
 * @param {string} symbol
 * @returns {number|null}
 */
export function getTargetPct(symbol) {
  if (!_cfg) return null;

  // 1. override
  if (_cfg.override && _cfg.override[symbol] != null) {
    const ov = _cfg.override[symbol];
    if (ov.targetPct != null) return ov.targetPct;
  }

  // 2. tiers (core / defensive)
  const tiers = _cfg.tiers || {};
  for (const tier of Object.values(tiers)) {
    if (tier.targets && tier.targets[symbol] != null) return tier.targets[symbol];
  }

  // 2.5 テーマ代表ETF → テーマ上限 ÷ そのテーマのETF数
  //     SMH/200A 等「テーマを丸ごと持つETF」は標準$50K単位でなくテーマ枠で測る。
  //     同一テーマに複数ETF（半導体=SMH+200A）があれば上限を均等割り。
  if (_cfg.themeEtfs && _cfg.themeEtfs.includes(symbol)) {
    const etfTheme = getThemeOf(symbol);
    if (etfTheme !== null) {
      const cap = getThemeCap(etfTheme);
      const n = _cfg.themeEtfs.filter((s) => getThemeOf(s) === etfTheme).length || 1;
      return cap != null ? Math.round((cap / n) * 100) / 100 : null;
    }
  }

  // 3. テーマメンバー（単一株）→ convictionPct
  const theme = getThemeOf(symbol);
  if (theme !== null) {
    const conviction = (_cfg.conviction && _cfg.conviction[symbol]) || 'standard';
    const pct = _cfg.convictionPct && _cfg.convictionPct[conviction];
    return pct != null ? pct : null;
  }

  // 4. 解決不能
  return null;
}

/**
 * テーマの cap を返す。無ければ null。
 * @param {string} theme
 * @returns {number|null}
 */
export function getThemeCap(theme) {
  if (!_cfg || !_cfg.themeCaps || !_cfg.themeCaps[theme]) return null;
  const cap = _cfg.themeCaps[theme].cap;
  return cap != null ? cap : null;
}

/**
 * テーマの現在使用率・ヘッドルームを計算する。
 * @param {string} theme
 * @param {Record<string, number>} currentPctBySymbol symbol → 現在%
 * @returns {{ theme: string, cap: number|null, used: number, headroom: number|null }}
 */
export function computeThemeUsage(theme, currentPctBySymbol) {
  const cap = getThemeCap(theme);
  let members = /** @type {string[]} */ ([]);
  if (_cfg && _cfg.themeCaps && _cfg.themeCaps[theme]) {
    members = _cfg.themeCaps[theme].members || [];
  }
  const used = members.reduce((sum, sym) => sum + (currentPctBySymbol[sym] || 0), 0);
  const headroom = cap != null ? cap - used : null;
  return { theme, cap, used, headroom };
}

/**
 * symbol の乖離（gapPct = currentPct − targetPct）を計算する。
 * gapPct > 0: 過大保有, < 0: 過小保有, null targetPct → gapPct も null。
 * @param {string} symbol
 * @param {number} currentPct
 * @returns {{ symbol: string, currentPct: number, targetPct: number|null, gapPct: number|null }}
 */
export function computeGap(symbol, currentPct) {
  const targetPct = getTargetPct(symbol);
  const gapPct = targetPct != null ? currentPct - targetPct : null;
  return { symbol, currentPct, targetPct, gapPct };
}
