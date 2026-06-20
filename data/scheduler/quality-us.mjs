// @ts-check
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { execSync } from 'child_process';
import { writeQualityBlocks } from './writeback.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const VALS_PATH = resolve(ROOT, 'data/valuations.json');

const ETF_SKIP = new Set([
  'ACWI', 'VT', 'VEA', 'VGK', 'XLE', 'XLF', 'XLV', 'XLP',
  'SMH', 'ASHR', 'REMX', 'COPX', 'DTCR', 'SHLD', 'ILF',
]);

// --- CLI args ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const symbolIdx = args.indexOf('--symbol');
const ONLY_SYMBOL = symbolIdx !== -1 ? args[symbolIdx + 1] : null;

// --- API key ---
function getApiKey() {
  if (process.env.FMP_API_KEY) return process.env.FMP_API_KEY;
  try {
    const cfg = JSON.parse(readFileSync(resolve(__dir, 'fmp-config.json'), 'utf8'));
    if (cfg.FMP_API_KEY) return cfg.FMP_API_KEY;
  } catch {
    // ignore
  }
  console.error('Error: FMP_API_KEY not set and fmp-config.json not found or missing key.');
  process.exit(1);
}

// --- Fetch with retry ---
async function fetchWithRetry(url, options = {}, retries = 1, delayMs = 3000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
      return await res.json();
    } catch (err) {
      if (attempt < retries) {
        console.warn(`  Retry in ${delayMs}ms after error: ${err.message}`);
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        throw err;
      }
    }
  }
}

// --- FMP fetch helpers ---
async function fmpFetch(path, key) {
  const url = `https://financialmodelingprep.com${path}${path.includes('?') ? '&' : '?'}apikey=${key}`;
  return fetchWithRetry(url);
}

function fmpToFundamentals(profile, incomes, balances, cashflows, keyMetrics) {
  const cur = incomes[0] || {};
  const priorI = incomes[1] || null;
  const curB = balances[0] || {};
  const priorB = balances[1] || null;
  const curCF = cashflows[0] || {};
  const priorCF = cashflows[1] || null;

  function periodFrom(i, b, cf) {
    if (!i && !b && !cf) return null;
    i = i || {}; b = b || {}; cf = cf || {};
    return {
      netIncome: i.netIncome ?? null,
      operatingCashFlow: cf.netCashProvidedByOperatingActivities ?? null,
      capex: cf.capitalExpenditure ?? null,
      freeCashFlow: cf.freeCashFlow ?? null,
      revenue: i.revenue ?? null,
      grossProfit: i.grossProfit ?? null,
      ebit: i.ebit ?? null,
      interestExpense: i.interestExpense ?? null,
      totalAssets: b.totalAssets ?? null,
      currentAssets: b.totalCurrentAssets ?? null,
      currentLiabilities: b.totalCurrentLiabilities ?? null,
      totalLiabilities: b.totalLiabilities ?? null,
      longTermDebt: b.longTermDebt ?? null,
      totalDebt: b.totalDebt ?? null,
      retainedEarnings: b.retainedEarnings ?? null,
      totalEquity: b.totalStockholdersEquity ?? null,
      sharesOutstanding: i.weightedAverageShsOutDil ?? null,
    };
  }

  const f = periodFrom(cur, curB, curCF);
  f.prior = periodFrom(priorI, priorB, priorCF);
  f.market = 'us';
  f.marketCap = profile && profile[0] ? (profile[0].marketCap ?? null) : null;
  // FMP key-metrics の returnOnInvestedCapital（小数）を % 換算して直接 ROIC に採用。
  // 無料枠外の銘柄では key-metrics が取れず null → quality-calc が NOPAT で代替計算する。
  const km = Array.isArray(keyMetrics) ? keyMetrics[0] : null;
  f.roicDirect =
    km && typeof km.returnOnInvestedCapital === 'number'
      ? +(km.returnOnInvestedCapital * 100).toFixed(1)
      : null;
  f.taxRate =
    cur.incomeTaxExpense != null &&
    cur.incomeBeforeTax != null &&
    cur.incomeBeforeTax !== 0
      ? cur.incomeTaxExpense / cur.incomeBeforeTax
      : null;
  return f;
}

function fmpAllKeyFieldsNull(incomes, balances, cashflows) {
  const inc = incomes[0] || {};
  const bal = balances[0] || {};
  const cf = cashflows[0] || {};
  const checks = [
    inc.revenue, inc.grossProfit, inc.ebit,
    bal.totalAssets, bal.totalEquity,
    cf.netCashProvidedByOperatingActivities, cf.freeCashFlow,
  ];
  return checks.every(v => v == null);
}

// --- SEC EDGAR fallback ---
let edgarTickersCache = null;

async function getEdgarCik(sym) {
  if (!edgarTickersCache) {
    console.log('  Fetching SEC tickers.json...');
    edgarTickersCache = await fetchWithRetry(
      'https://www.sec.gov/files/company_tickers.json',
      { headers: { 'User-Agent': 'portfolio-quality contact@example.com' } }
    );
  }
  const entry = Object.values(edgarTickersCache).find(v => v.ticker === sym);
  return entry ? entry.cik_str : null;
}

async function fetchEdgarFundamentals(sym) {
  const cikStr = await getEdgarCik(sym);
  if (!cikStr) throw new Error(`CIK not found for ${sym}`);
  const cik10 = String(cikStr).padStart(10, '0');
  const facts = await fetchWithRetry(
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik10}.json`,
    { headers: { 'User-Agent': 'portfolio-quality contact@example.com' } }
  );
  const { normalizeEdgarFacts } = await import('../../src/edgar-normalize.js');
  return normalizeEdgarFacts(facts, { market: 'us', marketCap: null });
}

// --- Per-symbol processing ---
async function processFmp(sym, key) {
  console.log(`  [FMP] Fetching ${sym}...`);
  const [profile, incomes, balances, cashflows, keyMetrics] = await Promise.all([
    fmpFetch(`/stable/profile?symbol=${sym}`, key),
    fmpFetch(`/stable/income-statement?symbol=${sym}&limit=2`, key),
    fmpFetch(`/stable/balance-sheet-statement?symbol=${sym}&limit=2`, key),
    fmpFetch(`/stable/cash-flow-statement?symbol=${sym}&limit=2`, key),
    // key-metrics の returnOnInvestedCapital を直接 ROIC に使う。無料枠外なら取得失敗 → null 扱い。
    fmpFetch(`/stable/key-metrics?symbol=${sym}&limit=1`, key).catch(() => null),
  ]);

  const incomesArr = Array.isArray(incomes) ? incomes : [];
  const balancesArr = Array.isArray(balances) ? balances : [];
  const cashflowsArr = Array.isArray(cashflows) ? cashflows : [];

  if (fmpAllKeyFieldsNull(incomesArr, balancesArr, cashflowsArr)) {
    throw new Error(`FMP returned all-null key fields for ${sym}`);
  }

  return fmpToFundamentals(profile, incomesArr, balancesArr, cashflowsArr, keyMetrics);
}

async function getFundamentals(sym, key) {
  try {
    return await processFmp(sym, key);
  } catch (fmpErr) {
    console.warn(`  [FMP] Failed for ${sym}: ${fmpErr.message} — trying EDGAR fallback`);
    return await fetchEdgarFundamentals(sym);
  }
}

// --- Main ---
async function main() {
  const key = getApiKey();

  // valuations.json は { updated, note, asOf, valuations: { "SYM": {entry} } } 構造
  const doc = JSON.parse(readFileSync(VALS_PATH, 'utf8'));
  const valuations = doc.valuations || {};

  // Derive US individual stock symbols dynamically
  let targets = Object.keys(valuations).filter(sym => {
    if (/\.(T|HK)$/i.test(sym)) return false; // not US
    if (ETF_SKIP.has(sym)) return false;
    return true;
  });

  if (ONLY_SYMBOL) {
    if (!targets.includes(ONLY_SYMBOL)) {
      console.error(`Symbol ${ONLY_SYMBOL} not found in valuations.json as a US stock.`);
      process.exit(1);
    }
    targets = [ONLY_SYMBOL];
  }

  console.log(`Processing ${targets.length} US stocks: ${targets.join(', ')}`);
  if (DRY_RUN) console.log('DRY RUN — will not write or commit');

  const { computeQuality } = await import('../../src/quality-calc.js');

  const results = {};

  for (const sym of targets) {
    try {
      console.log(`\n[${sym}]`);
      const fundamentals = await getFundamentals(sym, key);
      const quality = computeQuality(fundamentals);
      results[sym] = quality;
      console.log(`  quality.qScore = ${quality?.qScore ?? 'null'}`);
    } catch (err) {
      console.warn(`  Skipping ${sym}: ${err.message}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n--- DRY RUN results ---');
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // Write back: 元フォーマットを保ったまま quality ブロックだけ差し替え
  const written = writeQualityBlocks(VALS_PATH, results);
  console.log(`\nWrote ${VALS_PATH} (${written} symbols)`);

  // Git commit & push
  execSync('git add data/valuations.json', { cwd: ROOT });
  execSync(
    `git commit -m "chore: quality auto-update US stocks $(date +%F)"`,
    { cwd: ROOT, shell: true }
  );
  execSync('git push', { cwd: ROOT });
  console.log('Committed and pushed.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
