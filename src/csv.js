// ══════════════════════════════════════════════════════════════
// csv.js  ―  CSV パース共通ヘルパー（マネックス証券フォーマット）
//
// 純粋関数のみ。Position オブジェクトの組み立てやUI更新は呼び出し側で行う。
//
// 依存: funds.js (fundSymbolFromName)
// 読込順: funds.js → csv.js → data.js → import.js
// ══════════════════════════════════════════════════════════════

import { fundSymbolFromName } from './funds.js';

/** 全角英数字・記号 → 半角変換 ＋ 全角スペース → 半角 ＋ trim */
function normalizeStr(s) {
  return s.replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
          .replace(/　/g, ' ')
          .trim();
}

/** CSV テキスト → [[cell, ...], ...] （引用符内カンマ・改行対応） */
function parseCsvText(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQ = false;
        else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { row.push(cur); cur = ''; }
        else cur += c;
      }
    }
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

/** 文字列を数値化（カンマ・% 除去。失敗時 null） */
function parseNum(s) {
  if (s == null || s === '') return null;
  const n = parseFloat(String(s).replace(/[,\s%]/g, ''));
  return isFinite(n) ? n : null;
}

/** CSV ヘッダ行からCSV種別を判定する */
function detectCsvType(headerRow) {
  const h = headerRow.map(c => c.trim());
  if (h.includes('銘柄コード'))              return 'jp';
  if (h.some(c => c.includes('保有数[株]'))) return 'us';
  if (h.includes('基準価額'))                return 'fund';
  return null;
}

/**
 * 国内株 CSV の1行 → 部分 Position（merge 用）
 * 列: 日付,時間,銘柄名,銘柄コード,市場,口座区分,預り区分,現在値,平均取得単価,保有数,...,時価評価額,評価損益
 */
function parseJpRow(row) {
  const symbol = row[3]?.trim();
  if (!symbol) return null;
  const avgCost = parseNum(row[8]);
  const shares  = parseNum(row[9]);
  const pnl     = parseNum(row[13]);
  const pnlPct  = (avgCost != null && shares != null && avgCost > 0 && shares > 0 && pnl != null)
    ? pnl / (avgCost * shares) * 100 : null;
  return { symbol, price: parseNum(row[7]), avgCost, shares, value: parseNum(row[12]), pnl, pnlPct };
}

/**
 * 米国株 CSV の1行 → 部分 Position
 * 列: 銘柄名,銘柄(ticker),市場,口座区分,保有数[株],...,取得平均[ドル],...,評価単価[ドル],...,時価評価額[円],...,評価損益額[円],損益率[円]
 */
function parseUsRow(row) {
  const ticker = row[1]?.trim();
  if (!ticker) return null;
  const value  = parseNum(row[16]);
  const pnl    = parseNum(row[18]);
  const pnlPct = (value != null && pnl != null && value - pnl !== 0)
    ? (pnl / (value - pnl)) * 100 : null;
  return { ticker, shares: parseNum(row[4]), avgCost: parseNum(row[7]), price: parseNum(row[10]),
           value, dayCh: null, dayPct: null, pnl, pnlPct };
}

/**
 * 投資信託 CSV の1行 → 部分 Position
 * 列: 日付,時間,銘柄名,口座区分,預り区分,基準価額[円/万口],口数種別,保有口数[口],...,平均取得単価[円/万口],時価評価額,時価損益
 */
function parseFundRow(row) {
  const rawName = row[2]?.trim();
  if (!rawName) return null;
  const name   = normalizeStr(rawName);
  const symbol = fundSymbolFromName(name);
  if (!symbol) return null;
  const value = parseNum(row[12]);
  const pnl   = parseNum(row[13]);
  const cost   = (value != null && pnl != null) ? value - pnl : null;
  const pnlPct = (cost != null && cost !== 0) ? pnl / cost * 100 : null;
  const sharesRaw = parseNum(row[7]);
  const shares = sharesRaw != null ? Math.round(sharesRaw / 10000 * 10000) / 10000 : null;
  return { symbol, price: parseNum(row[5]), shares,
           avgCost: parseNum(row[11]), value, pnl, pnlPct };
}

export { normalizeStr, parseCsvText, parseNum, detectCsvType, parseJpRow, parseUsRow, parseFundRow };
