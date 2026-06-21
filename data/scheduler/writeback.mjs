// @ts-check
import { readFileSync, writeFileSync } from 'fs';

// ══════════════════════════════════════════════════════════════
// writeback.mjs ―― valuations.json の単層ブロック（quality / value 等）だけを
// 元フォーマット（インライン配列・既存インデント）を保ったまま書き換える。
//
// JSON.parse → JSON.stringify(doc,N) で全体を書き直すと、手書きのインライン配列
// （"drivers": ["a","b"] 等）が全展開され巨大な無関係 diff になる。そこで生テキストに
// 対し対象シンボルの該当ブロックだけを差し替える。
//
// インデント幅はファイルから動的検出する（別プロセスが 1スペース/2スペース等で
// 再フォーマットしても追従するため。実際 briefing 生成バッチが 1スペースに再整形した）。
// 対象ブロックは入れ子のない単層オブジェクト（quality / value）を想定。
// 既存ブロックがあれば置換、無ければエントリ先頭フィールドとして挿入する。
// ══════════════════════════════════════════════════════════════

/** 正規表現用にメタ文字をエスケープ。 */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 各シンボルの単層ブロック（blockKey）を差し替え／挿入して書き戻す。
 * インデントは各エントリの実際の字下げから検出する。
 * @param {string} path  valuations.json のパス
 * @param {Record<string, object>} results  { symbol: blockObj }
 * @param {string} blockKey  'quality' | 'value' 等の単層ブロックキー
 * @returns {number} 実際に更新したシンボル数
 */
export function writeBlocks(path, results, blockKey) {
  let raw = readFileSync(path, 'utf8');
  let updated = 0;

  for (const [sym, block] of Object.entries(results)) {
    // エントリ開始 "SYM": {（行頭の字下げを捕捉）
    const keyRe = new RegExp(`\\n([ \\t]*)"${escapeRe(sym)}":\\s*\\{`);
    const km = keyRe.exec(raw);
    if (!km) {
      console.warn(`  [writeback] ${sym}: エントリが見つかりません（スキップ）`);
      continue;
    }
    const entryIndent = km[1]; // 例: 1スペースファイルなら "  "（2スペース）
    const entryOpenEnd = km.index + km[0].length;

    // 同じ字下げの次のキー＝当該エントリの終端
    const nextRe = new RegExp(`\\n${entryIndent}"[^"]+":\\s*\\{`, 'g');
    nextRe.lastIndex = entryOpenEnd;
    const nm = nextRe.exec(raw);
    const entryEnd = nm ? nm.index : raw.length;

    // フィールド字下げ（エントリ開始直後の最初の字下げ）からインデント単位を検出
    const fieldM = /\n([ \t]+)\S/.exec(raw.slice(entryOpenEnd, entryEnd));
    const fieldIndent = fieldM ? fieldM[1] : `${entryIndent}  `;
    const unitLen = Math.max(1, fieldIndent.length - entryIndent.length);

    // ブロック値を unit 幅で直列化し、各行頭に fieldIndent を付与（ブロックは入れ子なし）
    const body = JSON.stringify(block, null, unitLen).replace(/\n/g, `\n${fieldIndent}`);

    const bIdx = raw.indexOf(`"${blockKey}":`, entryOpenEnd);
    if (bIdx !== -1 && bIdx < entryEnd) {
      // 既存ブロックを置換（単層なので最初の '}' が終端）
      const braceStart = raw.indexOf('{', bIdx);
      const braceEnd = raw.indexOf('}', braceStart);
      if (braceStart === -1 || braceEnd === -1 || braceEnd > entryEnd) {
        console.warn(`  [writeback] ${sym}: ${blockKey} ブロックの解析に失敗（スキップ）`);
        continue;
      }
      raw = raw.slice(0, braceStart) + body + raw.slice(braceEnd + 1);
    } else {
      // ブロックが無ければエントリ先頭フィールドとして挿入（キー順は JSON 上不問）
      const insertion = `\n${fieldIndent}"${blockKey}": ${body},`;
      raw = raw.slice(0, entryOpenEnd) + insertion + raw.slice(entryOpenEnd);
    }
    updated++;
  }

  // 妥当性チェック（壊れた JSON は書き戻さない）
  JSON.parse(raw);
  writeFileSync(path, raw, 'utf8');
  return updated;
}

/**
 * 各シンボルの quality ブロックを差し替えて書き戻す（後方互換ラッパー）。
 * @param {string} path  valuations.json のパス
 * @param {Record<string, object>} results  { symbol: qualityObj }
 * @returns {number} 実際に更新したシンボル数
 */
export function writeQualityBlocks(path, results) {
  return writeBlocks(path, results, 'quality');
}
