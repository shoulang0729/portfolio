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
 * @typedef {{ date: string, symbol: string, call: string, outcome: 'hit'|'miss'|'pending', note: string }} VerdictOutcome
 */

/**
 * @typedef {{ hits: number, misses: number, pending: number, resolved: number, ratePct: number|null }} HitRate
 */

const OUTCOMES_URL = 'data/verdict-outcomes.json';

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
 * hit/miss/pending を集計して的中率を計算する（純粋関数）。
 * resolved = hits + misses。resolved > 0 のとき ratePct = round(hits/resolved*100)。
 * @returns {HitRate}
 */
export function computeHitRate() {
  let hits = 0;
  let misses = 0;
  let pending = 0;
  for (const o of _outcomes) {
    if (o.outcome === 'hit') hits++;
    else if (o.outcome === 'miss') misses++;
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
