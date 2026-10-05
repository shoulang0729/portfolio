// @ts-check
// null-guard.mjs — 週次バッチの書き戻しで「新しい値が null・既存値が非 null」のフィールドを
// null で上書きせず、既存値を保持して `staleFields` に印を付ける（#652 PR6・設計書 §8.4.2〜§8.4.4）。
//
// - 判定はフィールド単位・ブロック内の 1 階層のみ。
// - 新ブロックにキーが無い（undefined）フィールドはガード対象外（etf-pe の丸ごと置換を変えない）。
// - 新ブロック自体が null で既存ブロックがオブジェクト → 全フィールドが null とみなす（既存ブロックを丸ごと保持）。
// - 印 `staleFields` はエントリ直下のフラットなオブジェクト。キー＝"<ブロック>.<フィールド>"、
//   値＝null を最初に観測した日（UTC・YYYY-MM-DD）。非 null が取れたら外す（回復）。空なら {} を残す。
// - 派生値の再計算はしない。`writeback.mjs` は変えずにそのまま使う。
// - ガード後のブロックが null（＝新ブロックが null で既存ブロックがオブジェクトでない）なら
//   `writeBlocks` に渡さず書かない（#665・Toshio 決定 (a)）。既存ブロックが無ければ作らない、
//   既存ブロックが null なら null のまま残す。`writeBlocks` は値 null の既存ブロックの置換で
//   後続ブロックの `{` を拾うため、null ブロックを生まない・触らないことで回避する。
import { readFileSync } from 'fs';
import { writeBlocks } from '../writeback.mjs';

/** @param {unknown} x @returns {x is Record<string, any>} */
const isPlainObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

/**
 * 1 銘柄・1 ブロックの null ガード（純関数）。
 * @param {unknown} oldBlock  既存ブロック（HEAD/作業ツリーの現在値）
 * @param {unknown} newBlock  新しい計算結果のブロック
 * @param {unknown} oldStale  この銘柄の既存 `staleFields`（無ければ undefined）
 * @param {string} blockKey   'quality' | 'value' | 'sectorMedian'
 * @param {string} today      UTC の YYYY-MM-DD
 * @returns {{ block: any, stale: Record<string, string>, kept: string[], recovered: string[] }}
 *   `stale` はこの銘柄の `staleFields` 全体（他ブロックの印はそのまま）。
 */
export function guardBlock(oldBlock, newBlock, oldStale, blockKey, today) {
  /** @type {Record<string, string>} */
  const stale = isPlainObj(oldStale) ? { ...oldStale } : {};
  /** @type {string[]} */
  const kept = [];
  /** @type {string[]} */
  const recovered = [];
  const oldObj = isPlainObj(oldBlock) ? oldBlock : null;
  const markKey = (/** @type {string} */ field) => `${blockKey}.${field}`;

  // 新ブロック自体が null：既存ブロックがオブジェクトなら全フィールド null とみなして丸ごと保持
  if (newBlock === null) {
    if (!oldObj) return { block: null, stale, kept, recovered };
    const block = { ...oldObj };
    for (const [field, v] of Object.entries(oldObj)) {
      if (v === null || v === undefined) continue;
      const k = markKey(field);
      if (!(k in stale)) stale[k] = today;
      kept.push(field);
    }
    return { block, stale, kept, recovered };
  }

  // オブジェクト以外（想定外）はそのまま通す
  if (!isPlainObj(newBlock)) return { block: newBlock, stale, kept, recovered };

  const block = { ...newBlock };
  for (const [field, v] of Object.entries(newBlock)) {
    const k = markKey(field);
    if (v === null) {
      const prev = oldObj ? oldObj[field] : undefined;
      if (prev !== null && prev !== undefined) {
        // 新 null・既存非 null → 既存値を保持し、印（最初の観測日を維持）
        block[field] = prev;
        if (!(k in stale)) stale[k] = today;
        kept.push(field);
      }
      // 既存も null／既存ブロック無し → null を書く（保持する値が無い・印は付けない）
    } else if (k in stale) {
      // 非 null が取れた → 回復（印を外す）
      delete stale[k];
      recovered.push(field);
    }
  }
  return { block, stale, kept, recovered };
}

/**
 * staleFields のキーと値の集合が同じか（キー順は問わない）。
 * @param {Record<string, string>} a
 * @param {Record<string, string>} b
 */
function sameStale(a, b) {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && a[k] === b[k]);
}

/**
 * null ガードを通してブロックを書き戻す（`writeBlocks` の置き換え）。
 * ファイルを読む → 銘柄ごとに `guardBlock` → `writeBlocks(path, guarded, blockKey)` →
 * 印が変わった銘柄だけ `writeBlocks(path, staleUpdates, 'staleFields')`。
 * @param {string} path  valuations.json のパス
 * @param {Record<string, any>} results  { symbol: blockObj | null }
 * @param {string} blockKey  'quality' | 'value' | 'sectorMedian'
 * @param {{ today?: string }} [opts]
 * @returns {number} `writeBlocks` と同じ（ブロックを更新したシンボル数。null で書かなかった銘柄は数えない）
 */
export function writeGuardedBlocks(path, results, blockKey, opts = {}) {
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const doc = JSON.parse(readFileSync(path, 'utf8'));
  const vals = isPlainObj(doc) && isPlainObj(doc.valuations) ? doc.valuations : {};

  /** @type {Record<string, any>} */
  const guarded = {};
  /** @type {Record<string, Record<string, string>>} */
  const staleUpdates = {};
  for (const [sym, newBlock] of Object.entries(results)) {
    const entry = vals[sym];
    if (!isPlainObj(entry)) {
      // エントリが無い → 従来どおり writeBlocks に任せる（警告してスキップされる）
      guarded[sym] = newBlock;
      continue;
    }
    const oldStale = isPlainObj(entry.staleFields) ? entry.staleFields : {};
    const g = guardBlock(entry[blockKey], newBlock, oldStale, blockKey, today);
    // ガード後も null → 書かない（#665）。既存ブロック無しなら作らず、既存 null ブロックはそのまま残す。
    // `writeBlocks` に null を渡すと `"key": null` が生まれ、次回のオブジェクト書き込みで後続ブロックを上書きする。
    if (g.block === null) {
      console.log(`  [null-guard] ${sym} ${blockKey}: null → 書かない（既存ブロックをそのまま）`);
      continue; // この場合 guardBlock は印を変えない（保持する既存値が無い）
    }
    guarded[sym] = g.block;
    for (const field of g.kept) {
      console.log(
        `  [null-guard] ${sym} ${blockKey}.${field}: null → 既存値を保持（stale since ${g.stale[`${blockKey}.${field}`]}）`
      );
    }
    for (const field of g.recovered) {
      console.log(`  [null-guard] ${sym} ${blockKey}.${field}: 回復（stale の印を外す）`);
    }
    if (!sameStale(oldStale, g.stale)) staleUpdates[sym] = g.stale;
  }

  const written = writeBlocks(path, guarded, blockKey);
  if (Object.keys(staleUpdates).length) writeBlocks(path, staleUpdates, 'staleFields');
  return written;
}
