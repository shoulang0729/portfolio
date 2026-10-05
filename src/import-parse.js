// ══════════════════════════════════════════════════════════════
// import-parse.js  ―  資産パース（マネックスCSV）
//
// 純粋なパース層。UI/KV保存はここに含まない。
//
// 依存: csv.js (parseCsvText, normalizeStr, parseNum, detectCsvType),
//       funds.js (fundSymbolFromName, fundProxyOf)
// ══════════════════════════════════════════════════════════════

import { parseCsvText, normalizeStr, parseNum, detectCsvType } from './csv.js';
import { fundSymbolFromName, fundProxyOf } from './funds.js';

const FUND_FALLBACK_PROXY = { ySymbol: '^N225', proxyName: '日経平均' };

// ── マネックス CSV → フル Position オブジェクト ─────────────────────────────

function buildJpPosition(row) {
  const symbol = row[3]?.trim();
  const name = normalizeStr(row[2]?.trim() || '');
  if (!symbol || !name) return null;
  const avgCost = parseNum(row[8]);
  const shares = parseNum(row[9]);
  const price = parseNum(row[7]);
  const value = parseNum(row[12]);
  const pnl = parseNum(row[13]);
  const pnlPct = avgCost && shares && avgCost > 0 ? ((pnl ?? 0) / (avgCost * shares)) * 100 : null;
  return {
    symbol,
    name,
    cat: '日本株・ETF',
    shares: shares ?? 0,
    price: price ?? 0,
    avgCost: avgCost ?? 0,
    value: value ?? 0,
    pnl: pnl ?? 0,
    pnlPct: pnlPct ?? 0,
    dayPct: null,
    dayCh: null,
    cur: 'JPY',
    ySymbol: `${symbol}.T`,
  };
}

function buildUsPosition(row) {
  const name = normalizeStr(row[0]?.trim() || '');
  const ticker = row[1]?.trim();
  if (!ticker || !name) return null;
  const shares = parseNum(row[4]);
  const avgCost = parseNum(row[7]);
  const price = parseNum(row[10]);
  const value = parseNum(row[16]);
  const pnl = parseNum(row[18]);
  const pnlPct = value != null && pnl != null && value - pnl !== 0 ? (pnl / (value - pnl)) * 100 : null;
  return {
    symbol: ticker,
    name,
    cat: '米国株・ETF',
    shares: shares ?? 0,
    price: price ?? 0,
    avgCost: avgCost ?? 0,
    value: value ?? 0,
    pnl: pnl ?? 0,
    pnlPct: pnlPct ?? 0,
    dayPct: null,
    dayCh: null,
    cur: 'USD',
    ySymbol: ticker,
  };
}

function buildFundPosition(row) {
  const rawName = row[2]?.trim();
  if (!rawName) return null;
  const name = normalizeStr(rawName);
  const symbol = fundSymbolFromName(name);
  if (!symbol) return null;
  // row[7]=保有口数[口] → 万口に変換して price/avgCost (円/万口) と一致させる
  const sharesRaw = parseNum(row[7]);
  const shares = sharesRaw != null ? Math.round((sharesRaw / 10000) * 10000) / 10000 : null;
  const avgCost = parseNum(row[11]);
  const price = parseNum(row[5]);
  const value = parseNum(row[12]);
  const pnl = parseNum(row[13]);
  const cost = value != null && pnl != null ? value - pnl : null;
  const pnlPct = cost != null && cost !== 0 ? (pnl / cost) * 100 : null;
  const proxy = fundProxyOf(symbol) ?? FUND_FALLBACK_PROXY;
  return {
    symbol,
    name,
    cat: '投資信託',
    shares: shares ?? 0,
    price: price ?? 0,
    avgCost: avgCost ?? 0,
    value: value ?? 0,
    pnl: pnl ?? 0,
    pnlPct: pnlPct ?? 0,
    dayPct: null,
    dayCh: null,
    cur: 'JPY',
    ySymbol: proxy.ySymbol,
    isProxy: true,
    proxyName: proxy.proxyName,
  };
}

async function parseManexFiles(files) {
  const results = [];
  for (const file of files) {
    try {
      const buf = await file.arrayBuffer();
      const text = new TextDecoder('shift-jis').decode(buf);
      const rows = parseCsvText(text);
      if (rows.length < 2) continue;
      const type = detectCsvType(rows[0]);
      if (!type) continue;
      for (let i = 1; i < rows.length; i++) {
        const pos =
          type === 'jp'
            ? buildJpPosition(rows[i])
            : type === 'us'
              ? buildUsPosition(rows[i])
              : buildFundPosition(rows[i]);
        if (pos) results.push(pos);
      }
    } catch (e) {
      console.error('[import] CSV parse error:', file.name, e);
    }
  }
  return results;
}

export { parseManexFiles };
