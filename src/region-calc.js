// @ts-check

// ══════════════════════════════════════════════════════════════
// region-calc.js ―― 真の地域エクスポージャ（ルックスルー）純関数（D-6）
//
// 各保有を「金額」で地域に配賦する。
//   - 直接タグ（個別株・単一国ファンド）＝全額その地域。
//   - ルックスルー対象（ACWI=オルカン / ひふみXO / ひふみ投信）＝
//     region-weights の構成比で按分（案C 限定＝真の地域% の約8割を捕捉）。
//
// 目的＝真の地域配分の可視化（特に日本のホームバイアス確認）。
// 能動的な地域 target 管理（案B）は次フェーズ＝本モジュールは可視化のみ。
// ══════════════════════════════════════════════════════════════

/** 地域タグ → 日本語ラベル。 */
export const REGION_LABELS = {
  japan: '日本',
  north_america: '北米',
  europe: '欧州',
  em_latam: '中南米',
  em_asia: 'アジア新興',
  china_hk: '中国・香港',
  global: 'グローバル/その他',
  commodity_cash: 'コモディティ/現金',
  unknown: '未分類',
};

/** ACWI ベンチの日本比率（%）。ホームバイアス基準。 */
export const ACWI_JAPAN_PCT = 5;

/** 有限数値か。 */
function num(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

/**
 * 保有を金額で地域配賦し、真の地域エクスポージャを返す。
 * @param {Array<{symbol?:string, ySymbol?:string, value?:number|null}>} holdings
 * @param {Record<string,string>} regionMap  symbol → 地域タグ（直接タグ）
 * @param {{ lookThrough: Record<string,string>, weights: Record<string, Record<string,number>> }} regionWeights
 * @returns {{ regions: Record<string,number>, total: number, pct: Record<string,number> }}
 */
export function computeTrueRegionExposure(holdings, regionMap, regionWeights) {
  /** @type {Record<string, number>} 地域→金額 */
  const regions = {};
  const lookThrough = (regionWeights && regionWeights.lookThrough) || {};
  const weights = (regionWeights && regionWeights.weights) || {};
  const map = regionMap || {};

  const add = (region, amt) => {
    if (!num(amt) || amt === 0) return;
    regions[region] = (regions[region] || 0) + amt;
  };

  for (const h of holdings || []) {
    const amt = num(h && h.value) ? h.value : 0;
    if (amt === 0) continue;
    // ルックスルー判定: symbol → ySymbol の順でキー解決
    const sym = h.symbol;
    const ysym = h.ySymbol;
    const profileId =
      (sym != null && lookThrough[sym]) || (ysym != null && lookThrough[ysym]) || null;

    if (profileId && weights[profileId]) {
      // 構成比（%）で按分。合計が 100 でなくても比率で配分する。
      const profile = weights[profileId];
      const sum = Object.values(profile).reduce((s, w) => s + (num(w) ? w : 0), 0);
      if (sum > 0) {
        for (const [region, w] of Object.entries(profile)) {
          if (num(w) && w > 0) add(region, (amt * w) / sum);
        }
        continue;
      }
    }

    // 直接タグ
    const tag = (sym != null && map[sym]) || (ysym != null && map[ysym]) || 'unknown';
    add(tag, amt);
  }

  const total = Object.values(regions).reduce((s, v) => s + v, 0);
  /** @type {Record<string, number>} 地域→% */
  const pct = {};
  if (total > 0) {
    for (const [region, amt] of Object.entries(regions)) {
      pct[region] = (amt / total) * 100;
    }
  }
  return { regions, total, pct };
}

/**
 * 日本のホームバイアス（真% − ACWI ベンチ%）。
 * @param {Record<string, number>} pct  computeTrueRegionExposure().pct
 * @returns {{ japanPct: number, benchPct: number, biasPt: number }}
 */
export function japanHomeBias(pct) {
  const japanPct = num(pct && pct.japan) ? pct.japan : 0;
  return { japanPct, benchPct: ACWI_JAPAN_PCT, biasPt: japanPct - ACWI_JAPAN_PCT };
}
