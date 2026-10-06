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
// cashEquivalents（JPST 等・#753）は先頭で null（銘柄ごとの目標%・確信度を持たない）。
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

// ── 現金同等 ETF（#753・設計書 2026-10-06-defensive-tier-cash-equivalents §2.3 / §4.2） ──

/**
 * cashEquivalents の既定値（data/target-allocation.json と同じ値）。
 * config 未読込・キー欠落・型不正のときだけ使う（ORDER_STRATEGY_DEFAULTS と同じ考え方）。
 */
export const CASH_EQUIVALENTS_DEFAULT = Object.freeze(['JPST', 'SGOV', 'BIL', 'SHV']);

/**
 * 現金同等 ETF の一覧（大文字化したコピー）を返す。
 * @returns {string[]}
 */
export function getCashEquivalents() {
  const v = _cfg && _cfg.cashEquivalents;
  const list = Array.isArray(v) ? v : CASH_EQUIVALENTS_DEFAULT;
  return list
    .filter((s) => typeof s === 'string')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * sym が現金同等 ETF か（null/空は false・前後空白除去＋大文字化して照合）。
 * @param {unknown} sym
 * @returns {boolean}
 */
export function isCashEquivalent(sym) {
  if (sym == null) return false;
  const k = String(sym).trim().toUpperCase();
  if (!k) return false;
  return getCashEquivalents().includes(k);
}

/**
 * 守り枠の目標（tiers.defensive.targets）。`cash` は現金枠の目標%、それ以外のキーは銘柄の目標%。
 * config 未読込なら { cashPct: null, items: [] }。
 * @returns {{ cashPct: number|null, items: Array<{ symbol: string, targetPct: number }> }}
 */
export function getDefensiveTargets() {
  const t = _cfg && _cfg.tiers && _cfg.tiers.defensive && _cfg.tiers.defensive.targets;
  if (!t || typeof t !== 'object') return { cashPct: null, items: [] };
  /** @type {Array<{ symbol: string, targetPct: number }>} */
  const items = [];
  for (const [symbol, pct] of Object.entries(t)) {
    if (symbol === 'cash') continue;
    if (typeof pct === 'number' && Number.isFinite(pct)) items.push({ symbol, targetPct: pct });
  }
  const cashPct = typeof t.cash === 'number' && Number.isFinite(t.cash) ? t.cash : null;
  return { cashPct, items };
}

/**
 * 守り枠の表示用の数値（純関数・#753 §2.2）。判定はしない。
 * 守り枠の現在% ＝ 現金枠（cashRatio）＋ 銘柄の現在% の合計。
 * 守り枠の目標% ＝ 現金枠の目標 ＋ 銘柄の目標の合計（どれかが欠けたら null）。
 * @param {{ cashRatio: number|null, cashTargetPct: number|null, defensiveItems: Array<{ symbol: string, curPct: number, targetPct: number|null }> }} args
 * @returns {{ cash: { curPct: number|null, targetPct: number|null }, items: Array<{ symbol: string, curPct: number, targetPct: number|null }>, total: { curPct: number|null, targetPct: number|null } }}
 */
export function computeDefensiveTier({ cashRatio, cashTargetPct, defensiveItems }) {
  const cashCur = typeof cashRatio === 'number' && Number.isFinite(cashRatio) ? cashRatio : null;
  const items = (defensiveItems || []).map((d) => ({
    symbol: d.symbol,
    curPct: Number(d.curPct) || 0,
    targetPct: d.targetPct != null && Number.isFinite(d.targetPct) ? d.targetPct : null,
  }));
  const itemsCur = items.reduce((s, d) => s + d.curPct, 0);
  const totalCur = cashCur != null ? cashCur + itemsCur : null;
  const allTargets = cashTargetPct != null && items.every((d) => d.targetPct != null);
  const totalTarget = allTargets
    ? items.reduce((s, d) => s + /** @type {number} */ (d.targetPct), /** @type {number} */ (cashTargetPct))
    : null;
  return {
    cash: { curPct: cashCur, targetPct: cashTargetPct != null ? cashTargetPct : null },
    items,
    total: { curPct: totalCur, targetPct: totalTarget },
  };
}

/**
 * 単一銘柄の最大（Risk ②・純関数）。現金同等 ETF（投信の proxy 行を除く）は飛ばす（#753 §2.3）。
 * @param {Array<{ symbol?: string, ySymbol?: string, isProxy?: boolean, value?: number }>} list
 * @param {number} denom
 * @returns {{ symbol: string, pct: number }|null}
 */
export function findMaxSinglePosition(list, denom) {
  if (!(denom > 0)) return null;
  /** @type {{ symbol: string, pct: number }|null} */
  let best = null;
  for (const p of list) {
    if (!p.isProxy && isCashEquivalent(p.ySymbol || p.symbol)) continue;
    const pct = ((p.value || 0) / denom) * 100;
    if (!best || pct > best.pct) best = { symbol: p.symbol || '', pct };
  }
  return best;
}

/**
 * テーマキー → 自然言語ラベル（#502 B・生キー露出を撲滅）。
 * 未登録キーはそのまま返す（themeLabel）。
 * @type {Record<string,string>}
 */
export const THEME_LABELS = {
  semiconductor: '半導体',
  ai_power: 'AI電力',
  megatech: 'メガテック',
  japan_theme: '日本フォーカス',
  commodity_miner: '資源・鉱山',
  silver: '銀',
  space: '宇宙',
  europe: '欧州',
  energy: 'エネルギー',
};

/** テーマキーを自然言語ラベルに（未登録はキーのまま）。 */
export function themeLabel(k) {
  return THEME_LABELS[k] || k;
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

  // 0. 現金同等 ETF は目標%を持たない（#753・override/tiers より先）
  if (isCashEquivalent(symbol)) return null;

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
 * symbol の確信度（ユーザーの主観的な自信＝サイズ入力）を返す。
 * テーマ構成銘柄（単一株）のみ対象。コア/守り/テーマETF/override は固定枠のため null。
 * @param {string} symbol
 * @returns {'probe'|'standard'|'high'|null}
 */
export function getConviction(symbol) {
  if (!_cfg) return null;
  // 現金同等 ETF は確信度を持たない（#753）
  if (isCashEquivalent(symbol)) return null;
  // 固定枠（override / core / defensive / テーマETF）は確信度の概念なし
  if (_cfg.override && _cfg.override[symbol] && _cfg.override[symbol].targetPct != null) return null;
  const tiers = _cfg.tiers || {};
  for (const tier of Object.values(tiers)) {
    if (tier.targets && tier.targets[symbol] != null) return null;
  }
  if (_cfg.themeEtfs && _cfg.themeEtfs.includes(symbol)) return null;
  // テーマ構成銘柄 → conviction（未指定は standard）
  if (getThemeOf(symbol) === null) return null;
  const conv = (_cfg.conviction && _cfg.conviction[symbol]) || 'standard';
  return conv === 'probe' || conv === 'standard' || conv === 'high' ? conv : 'standard';
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

// ══════════════════════════════════════════════════════════════
// 注文表の戦略設定（aiTech / stress / orderSheet・設計書 2026-10-03-order-sheet §3.2）
//
// 既定値はここ 1 か所にまとめる（要 Toshio 判断 #2/#5/#6 の既定案・§12）。
// data/target-allocation.json に値があればそれを優先し、未設定・型不正の項目だけ既定値で補う。
// アプリ側では v1 で表示に使わない（計算は Worker）。Value/Risk タブで将来使えるよう用意する。
// ══════════════════════════════════════════════════════════════

/**
 * 戦略設定の既定値（§3.2 / §12 の既定案）。値を変えるときはここだけ。
 */
export const ORDER_STRATEGY_DEFAULTS = Object.freeze({
  aiTech: Object.freeze({
    themes: Object.freeze(['semiconductor', 'megatech']),
    capPct: 29,
  }),
  stress: Object.freeze({
    tolerancePct: 20,
    nonEquity: Object.freeze(['JPST', 'SGOV', 'BIL', 'SHV', 'GLDM']),
    scenarios: Object.freeze([
      Object.freeze({
        id: 'ai-crash',
        label: 'AI −40%・他の株 −15%',
        shocks: Object.freeze([
          Object.freeze({ group: 'aiTech', pct: -40 }),
          Object.freeze({ group: 'otherEquity', pct: -15 }),
        ]),
      }),
      Object.freeze({
        id: 'semi-crash',
        label: '半導体 −50%',
        shocks: Object.freeze([Object.freeze({ group: 'theme:semiconductor', pct: -50 })]),
      }),
    ]),
  }),
  orderSheet: Object.freeze({
    cashFloorPct: 12,
    rebaseMovePct: 5,
  }),
});

/** @param {unknown} v */
function _isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * 既定値の配列をディープコピーする（呼び出し側の変更が既定値に波及しないように）。
 * @param {readonly any[]} arr
 * @returns {any[]}
 */
function _cloneArr(arr) {
  return JSON.parse(JSON.stringify(arr));
}

/**
 * config の section を取り出す（無ければ空オブジェクト）。
 * @param {string} key
 * @returns {any}
 */
function _section(key) {
  const sec = _cfg && _cfg[key];
  return sec && typeof sec === 'object' && !Array.isArray(sec) ? sec : {};
}

/**
 * AI/テック合計の設定を返す（未設定項目は既定値）。
 * @returns {{ themes: string[], capPct: number }}
 */
export function getAiTechConfig() {
  const d = ORDER_STRATEGY_DEFAULTS.aiTech;
  const s = _section('aiTech');
  return {
    themes: Array.isArray(s.themes) ? [...s.themes] : _cloneArr(d.themes),
    capPct: _isNum(s.capPct) ? s.capPct : d.capPct,
  };
}

/**
 * ストレスの設定を返す（未設定項目は既定値）。
 * @returns {{ tolerancePct: number, nonEquity: string[], scenarios: Array<{ id: string, label: string, shocks: Array<{ group: string, pct: number }> }> }}
 */
export function getStressConfig() {
  const d = ORDER_STRATEGY_DEFAULTS.stress;
  const s = _section('stress');
  return {
    tolerancePct: _isNum(s.tolerancePct) ? s.tolerancePct : d.tolerancePct,
    nonEquity: Array.isArray(s.nonEquity) ? [...s.nonEquity] : _cloneArr(d.nonEquity),
    scenarios: Array.isArray(s.scenarios) ? _cloneArr(s.scenarios) : _cloneArr(d.scenarios),
  };
}

/**
 * 注文表の設定を返す（未設定項目は既定値）。
 * @returns {{ cashFloorPct: number, rebaseMovePct: number }}
 */
export function getOrderSheetConfig() {
  const d = ORDER_STRATEGY_DEFAULTS.orderSheet;
  const s = _section('orderSheet');
  return {
    cashFloorPct: _isNum(s.cashFloorPct) ? s.cashFloorPct : d.cashFloorPct,
    rebaseMovePct: _isNum(s.rebaseMovePct) ? s.rebaseMovePct : d.rebaseMovePct,
  };
}
