// @ts-check
// hifumi-parse.mjs — ひふみ月次レポート（pdftotext -layout の出力）から上位10銘柄を読む純関数群（#656・#652 PR4）。
// 設計書: docs/handoff/2026-10-03-phase15-data-migration.md §7.2.1〜7.2.3
//
// - parseTop10(text, fund)  … 見出し「組入比率1~10位」から最初の「※「組入比率」は」までの銘柄行を読む
// - validateTop10(rows)     … 検証 ①〜⑦（すべて満たさなければ書き込まない）
// - compareKnown(rows, known) … 既知月（2026-05）の自己検証（code・name・weight の完全一致）
// - 月次更新の判定（対象月・404 の扱い・後戻り防止・差し替え・差分）も日付を注入できる純関数としてここに置く。

/** @typedef {'toushin' | 'microscope'} HifumiFund */
/** @typedef {{code: string, name: string, weight: number}} TopRow */

/** 見出し：`組入比率` の直後が `1` 1 文字＋波線（半角 `~` / 全角 `～`）＋`10位`。「11～30位」には一致しない。 */
export const HEADING_RE = /組入比率1[~～]10位/;
/** 範囲の終端（この行の直前まで）。 */
export const END_MARK = '※「組入比率」は';

/** 銘柄行の正規表現（§7.2.1 の 2）。 */
export const ROW_RE = {
  // No・銘柄名・コード・規模・上場市場・業種・比率（順位は行頭）
  toushin: /^\s*(\d{1,2})\s+(.+?)\s{2,}([0-9][0-9A-Z]{3})\s+\S+\s+\S+\s+\S+\s+(\d+(?:\.\d+)?)%\s*$/,
  // 銘柄名・コード・業種・比率（順位の数字は別の行に単独で出るので読まない＝出現順を順位とする）
  microscope: /^\s*(.+?)\s{2,}([0-9][0-9A-Z]{3})\s+\S+\s+(\d+(?:\.\d+)?)%\s*$/,
};

/**
 * 銘柄名の正規化：前後の空白を除き、連続する空白（半角・全角 U+3000 を問わない）を半角スペース 1 つにまとめる。
 * それ以外（全角英字・中黒など）は PDF 表記のまま。
 * @param {string} s
 * @returns {string}
 */
export function normalizeName(s) {
  return String(s)
    .replace(/[\s　]+/g, ' ')
    .trim();
}

/**
 * % → 小数 4 桁（例 5.28 → 0.0528、3.80 → 0.038）。
 * @param {number} pct
 */
export function pctToWeight(pct) {
  return Math.round(pct * 100) / 10000;
}

/**
 * parseTop10 の詳細版。範囲・行頭順位などパース段階の異常を errors に返す。
 * @param {string} text pdftotext -layout の出力
 * @param {HifumiFund} fund
 * @returns {{rows: TopRow[], errors: string[]}}
 */
export function parseTop10Detailed(text, fund) {
  const re = ROW_RE[fund];
  if (!re) return { rows: [], errors: [`未知のファンド種別: ${fund}`] };
  const lines = String(text).split(/\r?\n/);

  const headingIdx = [];
  lines.forEach((l, i) => {
    if (HEADING_RE.test(l)) headingIdx.push(i);
  });
  if (headingIdx.length === 0) return { rows: [], errors: ['見出し「組入比率1~10位」が見つからない'] };
  if (headingIdx.length > 1) {
    return { rows: [], errors: [`見出し「組入比率1~10位」が ${headingIdx.length} 回ある（レイアウト変更の疑い）`] };
  }
  const start = headingIdx[0] + 1;
  let end = -1;
  for (let i = start; i < lines.length; i++) {
    if (lines[i].includes(END_MARK)) {
      end = i;
      break;
    }
  }
  if (end === -1) return { rows: [], errors: ['終端「※「組入比率」は」が見つからない'] };

  /** @type {TopRow[]} */
  const rows = [];
  /** @type {number[]} */
  const ranks = [];
  for (const line of lines.slice(start, end)) {
    const m = re.exec(line);
    if (!m) continue;
    if (fund === 'toushin') {
      ranks.push(Number(m[1]));
      rows.push({ code: `${m[3]}.T`, name: normalizeName(m[2]), weight: pctToWeight(Number(m[4])) });
    } else {
      rows.push({ code: `${m[2]}.T`, name: normalizeName(m[1]), weight: pctToWeight(Number(m[3])) });
    }
  }

  /** @type {string[]} */
  const errors = [];
  if (fund === 'toushin') {
    const okRanks = ranks.length === 10 && ranks.every((r, i) => r === i + 1);
    if (!okRanks) errors.push(`行頭の順位が 1〜10 の昇順・欠番なしでない（${ranks.join(',')}）`);
  }
  return { rows, errors };
}

/**
 * 上位10を読む（§7.2.1）。パース段階の異常（見出しなし・見出し 2 回・終端なし・toushin の順位異常）は
 * 0 行を返す（→ validateTop10 の ① で NG）。
 * @param {string} text
 * @param {HifumiFund} fund
 * @returns {TopRow[]}
 */
export function parseTop10(text, fund) {
  const { rows, errors } = parseTop10Detailed(text, fund);
  return errors.length ? [] : rows;
}

/**
 * 検証 ①〜⑦（§7.2.2）。
 * @param {TopRow[]} rows
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateTop10(rows) {
  /** @type {string[]} */
  const errors = [];
  const list = Array.isArray(rows) ? rows : [];
  if (list.length !== 10) errors.push(`① 行数が 10 でない（${list.length}）`);
  const seen = new Set();
  let sum = 0;
  list.forEach((r, i) => {
    const n = i + 1;
    if (typeof r?.code !== 'string' || !/^[0-9][0-9A-Z]{3}\.T$/.test(r.code)) errors.push(`② ${n} 行目の code が不正`);
    if (typeof r?.weight !== 'number' || !Number.isFinite(r.weight) || !(r.weight > 0 && r.weight < 0.2)) {
      errors.push(`③ ${n} 行目の weight が 0〜0.2 の範囲外`);
    } else {
      sum += r.weight;
    }
    if (typeof r?.name !== 'string' || r.name.trim() === '') errors.push(`⑤ ${n} 行目の name が空`);
    if (seen.has(r?.code)) errors.push(`⑥ code が重複（${r?.code}）`);
    seen.add(r?.code);
    if (i > 0 && typeof r?.weight === 'number' && typeof list[i - 1]?.weight === 'number') {
      if (r.weight > list[i - 1].weight) errors.push(`⑦ ${n} 行目の weight が前の行より大きい`);
    }
  });
  // 浮動小数の誤差を避けるため 1e-9 の余裕を持たせる
  if (sum > 1 + 1e-9) errors.push(`④ weight 合計が 1 を超える（${sum}）`);
  return { ok: errors.length === 0, errors };
}

/**
 * 既知月の自己検証（§7.2.3）：code・name・weight が出現順に完全一致するか。
 * @param {TopRow[]} rows
 * @param {TopRow[]} known
 * @returns {{ok: boolean, errors: string[]}}
 */
export function compareKnown(rows, known) {
  /** @type {string[]} */
  const errors = [];
  if (!Array.isArray(rows) || rows.length !== known.length) {
    errors.push(`行数が既知月と違う（${Array.isArray(rows) ? rows.length : 0} / ${known.length}）`);
    return { ok: false, errors };
  }
  known.forEach((k, i) => {
    const r = rows[i];
    if (r.code !== k.code || r.name !== k.name || r.weight !== k.weight) {
      errors.push(`${i + 1} 位が既知月と違う（${r.code} / 期待 ${k.code}）`);
    }
  });
  return { ok: errors.length === 0, errors };
}

// ── 月次更新の判定（日付を注入できる純関数）────────────────────────

/**
 * 対象月＝実行日（UTC）の前月（YYYYMM）。
 * @param {Date} now
 */
export function targetMonth(now) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-11（＝前月の 1-12）
  return m === 0 ? `${y - 1}12` : `${y}${String(m).padStart(2, '0')}`;
}

/** @param {string} month YYYYMM */
export function isValidMonth(month) {
  return /^\d{4}(0[1-9]|1[0-2])$/.test(String(month));
}

/** 'YYYYMM' → 'YYYY-MM' @param {string} month */
export function monthToAsOf(month) {
  return `${month.slice(0, 4)}-${month.slice(4, 6)}`;
}

/** 'YYYY-MM' → 'YYYYMM'（形式外は null） @param {unknown} asOf */
export function asOfToMonth(asOf) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(asOf ?? ''));
  return m ? `${m[1]}${m[2]}` : null;
}

/**
 * 書き込み対象か：月が現在の asOf より新しいときだけ true（同じ・古いなら false＝後戻り防止）。
 * asOf が読めない場合は更新対象とする。
 * @param {unknown} currentAsOf 'YYYY-MM'
 * @param {string} month 'YYYYMM'
 */
export function isNewerThanAsOf(currentAsOf, month) {
  const cur = asOfToMonth(currentAsOf);
  return cur == null || month > cur;
}

/**
 * 対象月が未公開（404）のときの扱い（§7.2）。
 * 実行日（UTC）1〜19 日は 'retry'（成功終了・翌日再試行）、20 日以降は 'stale'（失敗＋Issue）。
 * @param {Date} now
 * @returns {'retry' | 'stale'}
 */
export function notPublishedAction(now) {
  return now.getUTCDate() >= 20 ? 'stale' : 'retry';
}

/**
 * fund-holdings.json の配列で、指定ファンドの top と asOf だけを差し替えた新しい配列を返す（他のキー・順序は保持）。
 * @param {any[]} holdings
 * @param {Record<string, {asOf: string, top: TopRow[]}>} updates fund 名 → 新しい asOf/top
 */
export function applyUpdates(holdings, updates) {
  return holdings.map((f) => {
    const u = updates[f?.fund];
    if (!u) return f;
    /** @type {Record<string, any>} */
    const out = {};
    for (const [k, v] of Object.entries(f)) {
      if (k === 'top') out[k] = u.top.map((r) => ({ code: r.code, name: r.name, weight: r.weight }));
      else if (k === 'asOf') out[k] = u.asOf;
      else out[k] = v;
    }
    if (!('asOf' in out)) out.asOf = u.asOf;
    if (!('top' in out)) out.top = u.top.map((r) => ({ code: r.code, name: r.name, weight: r.weight }));
    return out;
  });
}

/**
 * dry-run 用：現行 top → 新 top の差分（Markdown の表）。
 * @param {TopRow[]} oldTop
 * @param {TopRow[]} newTop
 * @returns {string}
 */
export function diffTopMarkdown(oldTop, newTop) {
  const o = Array.isArray(oldTop) ? oldTop : [];
  const n = Array.isArray(newTop) ? newTop : [];
  const fmt = (r) => (r ? `${r.code} ${r.name} ${(r.weight * 100).toFixed(2)}%` : '—');
  const lines = ['| 順位 | 現行 | 新 | |', '|---|---|---|---|'];
  for (let i = 0; i < Math.max(o.length, n.length); i++) {
    const a = o[i];
    const b = n[i];
    const same = a && b && a.code === b.code && a.name === b.name && a.weight === b.weight;
    lines.push(`| ${i + 1} | ${fmt(a)} | ${fmt(b)} | ${same ? '' : '変更'} |`);
  }
  return lines.join('\n');
}
