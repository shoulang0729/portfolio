// @ts-check
// per-calc.mjs — 毎日の PER 計算の純関数（#652 PR2）。
//
// 原本: docs/handoff/assets/2026-10-03-phase15/watchlist-per.mjs（fetchPE の抽出部・score）と
//       fund-per.mjs（trailingPE の抽出部・加重平均）。
// ★計算は原本から一字一句変えない（投資判断の正本値・設計書 §2.1 / §11）。
//   - score(): バンド内の線形%タイル・Math.round・0〜100 クランプ・≤33 cheap / ≤66 fair / それ以外 rich・
//     バンド不正時 { percentile: null, status: 'hold' }
//   - weightedPer(): PER が取れた銘柄だけの加重平均（小数2桁）と coverage（取れた比率合計・小数4桁）

/** fund-per が valuations.json に書くファンドエントリの source（watchlist-per はこのエントリを Yahoo に問い合わせない）。 */
export const FUND_SOURCE = 'fund-monthly-top10';

/**
 * Yahoo の値を取り出す（`{raw: x}` 形式なら raw、素の値ならそのまま）。原本の `pick` と同じ。
 * @param {any} o
 * @param {string} k
 * @returns {any}
 */
export function pickRaw(o, k) {
  return o?.[k] && typeof o[k] === 'object' ? o[k].raw : o?.[k];
}

/**
 * quoteSummary の JSON から実績PER（trailingPE）を取り出す。
 * summaryDetail 優先 → defaultKeyStatistics。正の有限値のみ・小数2桁。それ以外は null。
 * @param {any} quoteSummaryJson
 * @returns {number | null}
 */
export function pickTrailingPE(quoteSummaryJson) {
  const r = (quoteSummaryJson?.quoteSummary?.result || [])[0] || {};
  const sd = r.summaryDetail || {},
    ks = r.defaultKeyStatistics || {};
  const pe = pickRaw(sd, 'trailingPE') ?? pickRaw(ks, 'trailingPE') ?? null;
  return Number.isFinite(pe) && pe > 0 ? +pe.toFixed(2) : null;
}

/**
 * quoteSummary の JSON から予想PER（forwardPE・summaryDetail のみ）を取り出す。原本の出力項目（判定には使わない）。
 * @param {any} quoteSummaryJson
 * @returns {any}
 */
export function pickForwardPE(quoteSummaryJson) {
  const r = (quoteSummaryJson?.quoteSummary?.result || [])[0] || {};
  const sd = r.summaryDetail || {};
  return pickRaw(sd, 'forwardPE') ?? null;
}

/**
 * バンド内の線形%タイル（bandLow→0%, bandHigh→100%）と status。原本どおり。
 * @param {number} per
 * @param {number} lo
 * @param {number} hi
 * @returns {{percentile: number | null, status: string}}
 */
export function score(per, lo, hi) {
  if (!Number.isFinite(per) || per <= 0 || !Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo)
    return { percentile: null, status: 'hold' };
  const p = Math.max(0, Math.min(1, (per - lo) / (hi - lo)));
  const pct = Math.round(p * 100);
  const status = pct <= 33 ? 'cheap' : pct <= 66 ? 'fair' : 'rich';
  return { percentile: pct, status };
}

/**
 * 上位銘柄の加重実績PER。PER が null の銘柄は分子・分母とも除く。原本どおり。
 * @param {Array<{w: number, per: number | null}>} components
 * @returns {{perCurrent: number | null, coverage: number}}
 */
export function weightedPer(components) {
  let wsum = 0,
    wper = 0;
  for (const c of components) {
    if (c.per != null) {
      wsum += c.w;
      wper += c.per * c.w;
    }
  }
  const perCurrent = wsum > 0 ? +(wper / wsum).toFixed(2) : null;
  return { perCurrent, coverage: +wsum.toFixed(4) };
}
