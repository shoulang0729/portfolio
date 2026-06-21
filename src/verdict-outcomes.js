// @ts-check

// ══════════════════════════════════════════════════════════════
// verdict-outcomes.js  ―  Verdict判定の事後結果台帳（的中率の元データ）
//
// data/verdict-outcomes.json を読み込み、hit/miss/pending を集計して
// 的中率（ratePct）を返す。Phase 5b の学習ループ基盤。
//
// 依存: なし（純粋な fetch + 集計）
// ══════════════════════════════════════════════════════════════

/**
 * @typedef {{
 *   date: string,
 *   symbol: string,
 *   call: string,
 *   outcome: 'hit'|'miss'|'pending',
 *   note: string,
 *   kind?: 'action'|'verdict',
 *   dir?: 'buy'|'sell'|'cheap'|'rich'|'fair',
 *   horizonDays?: number,
 *   benchmark?: string,
 *   proposedOutcome?: 'hit'|'miss'|null,
 *   resolvedAt?: string|null
 * }} VerdictOutcome
 */

/**
 * @typedef {{ hits: number, misses: number, pending: number, resolved: number, ratePct: number|null }} HitRate
 */

const OUTCOMES_URL = 'data/verdict-outcomes.json';

/** kind 別の評価ホライズン（営業日）。発議＝約1ヶ月 / verdict＝約6ヶ月。 */
export const HORIZON_DAYS = { action: 21, verdict: 126 };

/** 相対評価のベンチマーク（世界株）。 */
export const DEFAULT_BENCHMARK = 'ACWI';

/** @type {VerdictOutcome[]} */
let _outcomes = [];
let _loaded = false;

/**
 * data/verdict-outcomes.json を読み込む（失敗時は空配列）。
 * @returns {Promise<VerdictOutcome[]>}
 */
export async function loadVerdictOutcomes() {
  try {
    const r = await fetch(`${OUTCOMES_URL}?_=${Date.now()}`);
    if (!r.ok) throw new Error(`verdict-outcomes ${r.status}`);
    const j = await r.json();
    _outcomes = Array.isArray(j && j.outcomes) ? j.outcomes : [];
    _loaded = true;
  } catch {
    _outcomes = [];
  }
  return _outcomes;
}

/**
 * データが読み込み済みかどうかを返す。
 * @returns {boolean}
 */
export function outcomesLoaded() {
  return _loaded;
}

/**
 * entry の実効 outcome を返す。手動 `outcome`（hit/miss）が最優先、
 * 無ければバッチの `proposedOutcome`、どちらも無ければ pending。
 * @param {VerdictOutcome} o
 * @returns {'hit'|'miss'|'pending'}
 */
function effectiveOutcome(o) {
  if (o.outcome === 'hit' || o.outcome === 'miss') return o.outcome;
  if (o.proposedOutcome === 'hit' || o.proposedOutcome === 'miss') return o.proposedOutcome;
  return 'pending';
}

/**
 * 対ベンチ相対リターンから hit/miss を判定する純関数（D-4）。
 *   action: buy → アウトパフォームで hit / sell → アンダーパフォームで hit
 *   verdict: cheap → アウトパフォーム / rich → アンダーパフォームで hit
 * 方向不明（fair 等）・素材欠損は null（判定不能＝提案しない）。
 * @param {VerdictOutcome} entry
 * @param {number} pfReturn     対象のウィンドウ内リターン（小数 or %、ベンチと同単位）
 * @param {number} benchReturn  ベンチ（ACWI）の同ウィンドウ内リターン
 * @returns {'hit'|'miss'|null}
 */
export function resolveOutcome(entry, pfReturn, benchReturn) {
  if (entry == null) return null;
  if (typeof pfReturn !== 'number' || !isFinite(pfReturn)) return null;
  if (typeof benchReturn !== 'number' || !isFinite(benchReturn)) return null;
  const kind = entry.kind || 'action';
  const dir = entry.dir;
  /** @type {boolean} アウトパフォームで hit か */
  let hitOnOutperform;
  if (kind === 'verdict') {
    if (dir === 'cheap') hitOnOutperform = true;
    else if (dir === 'rich') hitOnOutperform = false;
    else return null; // fair 等は方向が無く判定不能
  } else {
    if (dir === 'buy') hitOnOutperform = true;
    else if (dir === 'sell') hitOnOutperform = false;
    else return null;
  }
  const outperform = pfReturn - benchReturn > 0;
  return outperform === hitOnOutperform ? 'hit' : 'miss';
}

/**
 * 的中率を集計する（純粋関数）。kind を指定すると発議/verdict 別に絞り込む。
 * 実効 outcome（手動優先→提案）を用いる。kind 未指定の entry は 'action' 扱い。
 * resolved = hits + misses。resolved > 0 のとき ratePct = round(hits/resolved*100)。
 * @param {'action'|'verdict'} [kind]  省略時は全 kind 合算（後方互換）
 * @returns {HitRate}
 */
export function computeHitRate(kind) {
  let hits = 0;
  let misses = 0;
  let pending = 0;
  for (const o of _outcomes) {
    if (kind && (o.kind || 'action') !== kind) continue;
    const eff = effectiveOutcome(o);
    if (eff === 'hit') hits++;
    else if (eff === 'miss') misses++;
    else pending++;
  }
  const resolved = hits + misses;
  const ratePct = resolved > 0 ? Math.round((hits / resolved) * 100) : null;
  return { hits, misses, pending, resolved, ratePct };
}

/**
 * テスト用ヘルパー：_outcomes を直接セットする。本番コードから呼ばない。
 * @param {VerdictOutcome[]} arr
 */
export function __setOutcomes(arr) {
  _outcomes = arr;
  _loaded = true;
}
