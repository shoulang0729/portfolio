// @ts-check

// ══════════════════════════════════════════════════════════════
// edgar-normalize.js ―― SEC EDGAR companyfacts → 正規化 Fundamentals（純関数）
//
// data.sec.gov の companyfacts JSON（CIK 単位で全 XBRL fact）を入力に、
// quality-calc.js が食べられる Fundamentals 形（当期＋前期）へ変換する。
// ネットワークには触れない＝取得はバッチ（workspace）側の責務。
//
// 重要な落とし穴: 各 fact 行の `fy`/`fp` は**その fact を報告した提出書類の会計年度**で
// あり、データ点そのものの年度ではない（10-K は前々期までの比較値も同じ fy=2025/fp=FY で
// 含む）。そのため**期末日 `end`（と期間長）で年度を識別**する。
//   - 瞬間値(instant: 残高項目) … `start` 無し。基準期末日 = 最新の年次 `end`。
//   - 期間値(duration: フロー項目) … `start` 有り。約350〜380日の通期だけを採用。
// ══════════════════════════════════════════════════════════════

/** us-gaap / dei いずれかから concept ノードを取得（複数候補名を順に試す）。 */
function pickNode(facts, names) {
  const ns = ['us-gaap', 'dei', 'ifrs-full'];
  for (const name of names) {
    for (const n of ns) {
      const node = facts && facts[n] && facts[n][name];
      if (node && node.units) return node;
    }
  }
  return null;
}

/** 日付文字列 → ms（不正なら NaN）。 */
function ms(d) {
  return d ? Date.parse(d) : NaN;
}

/** 2つの期末日が約1年差（±45日）か。 */
function aboutOneYearApart(laterMs, earlierMs) {
  const diff = laterMs - earlierMs;
  const yr = 365.25 * 24 * 3600 * 1000;
  return diff > yr - 45 * 864e5 && diff < yr + 45 * 864e5;
}

/**
 * concept から「期末日 → 値」の系列を作る。
 * @param {object|null} node  concept ノード（units を持つ）
 * @param {boolean} instant   true=残高(瞬間値) / false=フロー(通期のみ)
 * @returns {Array<{end:number, val:number, filed:number}>}  end 昇順
 */
function seriesOf(node, instant) {
  if (!node || !node.units) return [];
  /** @type {Map<number,{end:number,val:number,filed:number}>} */
  const byEnd = new Map();
  for (const rows of Object.values(node.units)) {
    if (!Array.isArray(rows)) continue;
    for (const r of rows) {
      if (typeof r.val !== 'number' || !Number.isFinite(r.val)) continue;
      const end = ms(r.end);
      if (Number.isNaN(end)) continue;
      const hasStart = !!r.start;
      if (instant) {
        if (hasStart) continue; // 残高は瞬間値のみ
      } else {
        if (!hasStart) continue;
        const dur = end - ms(r.start);
        if (!(dur > 300 * 864e5 && dur < 400 * 864e5)) continue; // 通期(約1年)のみ
      }
      const filed = ms(r.filed) || 0;
      const prev = byEnd.get(end);
      // 同一期末で重複（改訂）→ より新しい提出(filed)の値を採用
      if (!prev || filed >= prev.filed) byEnd.set(end, { end, val: r.val, filed });
    }
  }
  return [...byEnd.values()].sort((a, b) => a.end - b.end);
}

/** 系列から、指定期末日に最も近い（±45日）値を返す。 */
function valAt(series, targetMs) {
  let best = null;
  let bestGap = Infinity;
  for (const e of series) {
    const gap = Math.abs(e.end - targetMs);
    if (gap < bestGap && gap <= 45 * 864e5) {
      best = e;
      bestGap = gap;
    }
  }
  return best ? best.val : null;
}

// 各指標の XBRL concept 候補（社により名称が異なるためフォールバック列挙）
const C = {
  netIncome: ['NetIncomeLoss', 'ProfitLoss'],
  ocf: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
  revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'],
  grossProfit: ['GrossProfit'],
  costOfRevenue: ['CostOfGoodsAndServicesSold', 'CostOfRevenue'],
  ebit: ['OperatingIncomeLoss'],
  interest: ['InterestExpense', 'InterestExpenseNonoperating', 'InterestAndDebtExpense'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
  assets: ['Assets'],
  curAssets: ['AssetsCurrent'],
  liabilities: ['Liabilities'],
  curLiab: ['LiabilitiesCurrent'],
  ltDebt: ['LongTermDebtNoncurrent', 'LongTermDebt'],
  retained: ['RetainedEarningsAccumulatedDeficit'],
  equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  shares: ['WeightedAverageNumberOfDilutedSharesOutstanding', 'EntityCommonStockSharesOutstanding'],
  taxExpense: ['IncomeTaxExpenseBenefit'],
  pretax: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments'],
};

/**
 * companyfacts JSON を Fundamentals（当期＋前期）に正規化する。
 * @param {object} companyfacts  data.sec.gov /api/xbrl/companyfacts のレスポンス
 * @param {{ market?: string, marketCap?: number|null }} [opts]
 * @returns {(import('./quality-calc.js').Fundamentals & { _fyeEnd?: string })|null}
 */
export function normalizeEdgarFacts(companyfacts, opts = {}) {
  const facts = companyfacts && companyfacts.facts;
  if (!facts) return null;

  /** @type {Record<string, ReturnType<typeof seriesOf>>} */
  const flow = {};
  /** @type {Record<string, ReturnType<typeof seriesOf>>} */
  const inst = {};
  const flowKeys = ['netIncome', 'ocf', 'revenue', 'grossProfit', 'costOfRevenue', 'ebit', 'interest', 'capex', 'shares', 'taxExpense', 'pretax'];
  const instKeys = ['assets', 'curAssets', 'liabilities', 'curLiab', 'ltDebt', 'retained', 'equity'];
  for (const k of flowKeys) flow[k] = seriesOf(pickNode(facts, C[k]), false);
  for (const k of instKeys) inst[k] = seriesOf(pickNode(facts, C[k]), true);
  // shares は EntityCommonStockSharesOutstanding（dei）だと瞬間値なので両構えで拾う
  if (!flow.shares.length) inst.shares = seriesOf(pickNode(facts, C.shares), true);

  // 基準期末日 = netIncome（通期フロー）の最新 end。無ければ assets の最新。
  const niSeries = flow.netIncome;
  const fyeMs = niSeries.length ? niSeries[niSeries.length - 1].end : (inst.assets.length ? inst.assets[inst.assets.length - 1].end : NaN);
  if (Number.isNaN(fyeMs)) return null;
  // 前期末 = 約1年前
  const priorMs = fyeMs - Math.round(365.25 * 864e5);

  const flowAt = (k, t) => valAt(flow[k], t);
  const instAt = (k, t) => valAt(inst[k], t);
  const sharesAt = (t) => (flow.shares.length ? valAt(flow.shares, t) : valAt(inst.shares || [], t));

  // grossProfit が無ければ revenue − costOfRevenue で代用
  const gp = (t) => {
    const direct = flowAt('grossProfit', t);
    if (direct != null) return direct;
    const rev = flowAt('revenue', t);
    const cor = flowAt('costOfRevenue', t);
    return rev != null && cor != null ? rev - cor : null;
  };

  const buildPeriod = (t) => ({
    netIncome: flowAt('netIncome', t),
    operatingCashFlow: flowAt('ocf', t),
    capex: flowAt('capex', t),
    revenue: flowAt('revenue', t),
    grossProfit: gp(t),
    ebit: flowAt('ebit', t),
    interestExpense: flowAt('interest', t),
    totalAssets: instAt('assets', t),
    currentAssets: instAt('curAssets', t),
    currentLiabilities: instAt('curLiab', t),
    totalLiabilities: instAt('liabilities', t),
    longTermDebt: instAt('ltDebt', t),
    retainedEarnings: instAt('retained', t),
    totalEquity: instAt('equity', t),
    sharesOutstanding: sharesAt(t),
  });

  const cur = buildPeriod(fyeMs);
  const prior = buildPeriod(priorMs);
  // 前期がほぼ空（IPO直後等）なら prior=null
  const priorHas = prior.netIncome != null || prior.totalAssets != null;

  // 実効税率（NOPAT 経由 ROIC 用）
  const tax = flowAt('taxExpense', fyeMs);
  const pre = flowAt('pretax', fyeMs);
  const taxRate = tax != null && pre != null && pre !== 0 ? tax / pre : null;

  return {
    ...cur,
    prior: priorHas ? prior : null,
    market: opts.market || 'us',
    marketCap: opts.marketCap != null ? opts.marketCap : null,
    roicDirect: null, // EDGAR は直接 ROIC を持たない → quality-calc が NOPAT/投下資本で計算
    taxRate,
    _fyeEnd: new Date(fyeMs).toISOString().slice(0, 10),
  };
}
