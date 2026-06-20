// @ts-check
import { readFileSync, writeFileSync } from 'fs';

// ══════════════════════════════════════════════════════════════
// writeback.mjs ―― valuations.json の "quality" ブロックだけを
// 元フォーマット（インライン配列・既存インデント）を保ったまま書き換える。
//
// JSON.parse → JSON.stringify(doc,2) で全体を書き直すと、手で書かれた
// インライン配列（"drivers": ["a","b"] 等）が全展開され巨大な無関係 diff に
// なる。そこで生テキストに対し対象シンボルの quality 値だけを差し替える。
//
// 前提: 対象シンボルは既に "quality": { ... } ブロックを持つ（A3 初回バック
// フィルで全個別株に付与済み）。入れ子のない単層オブジェクトなので最初の
// '}' が quality の終端になる。
// ══════════════════════════════════════════════════════════════

/** 正規表現用にメタ文字をエスケープ。 */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 各シンボルの quality ブロックを差し替えて書き戻す。
 * @param {string} path  valuations.json のパス
 * @param {Record<string, object>} results  { symbol: qualityObj }
 * @returns {number} 実際に更新したシンボル数
 */
export function writeQualityBlocks(path, results) {
  let raw = readFileSync(path, 'utf8');
  let updated = 0;

  for (const [sym, quality] of Object.entries(results)) {
    // エントリ開始（4スペースインデントのキー） "SYM": {
    const keyRe = new RegExp(`\\n    "${escapeRe(sym)}": \\{`);
    const km = keyRe.exec(raw);
    if (!km) {
      console.warn(`  [writeback] ${sym}: エントリが見つかりません（スキップ）`);
      continue;
    }

    // 次のトップレベルキーまでを当該エントリの範囲とする
    const nextRe = /\n {4}"[^"]+": \{/g;
    nextRe.lastIndex = km.index + km[0].length;
    const nm = nextRe.exec(raw);
    const entryEnd = nm ? nm.index : raw.length;

    const qIdx = raw.indexOf('"quality":', km.index);
    if (qIdx === -1 || qIdx > entryEnd) {
      console.warn(`  [writeback] ${sym}: quality ブロックが無いためスキップ`);
      continue;
    }

    const braceStart = raw.indexOf('{', qIdx);
    const braceEnd = raw.indexOf('}', braceStart); // quality は入れ子なし
    if (braceStart === -1 || braceEnd === -1 || braceEnd > entryEnd) {
      console.warn(`  [writeback] ${sym}: quality ブロックの解析に失敗（スキップ）`);
      continue;
    }

    // 6スペースインデントの値（キー行は8スペース・閉じ } は6スペースになる）
    const body = JSON.stringify(quality, null, 2).replace(/\n/g, '\n      ');
    raw = raw.slice(0, braceStart) + body + raw.slice(braceEnd + 1);
    updated++;
  }

  // 妥当性チェック（壊れた JSON は書き戻さない）
  JSON.parse(raw);
  writeFileSync(path, raw, 'utf8');
  return updated;
}
