// @ts-check
// json-format.mjs — 読み込んだ JSON ファイルの書式（インデント幅・末尾改行）を検出して再現する（#652 §2.4）。
//
// valuations.json は書き手によって書式が揺れている（現在 2 スペース・末尾改行なし／以前は 1 スペース）。
// 全体を書き直すスクリプトは、読み込んだファイルの書式をそのまま再現して最小 diff で書く。

/**
 * @typedef {{indent: number | string, trailingNewline: boolean}} JsonFormat
 */

/**
 * 生テキストから書式を検出する。
 * - indent: 最初の字下げ行の先頭空白（スペースなら個数・タブを含むならその文字列）。字下げ行が無ければ 0（1 行 JSON）。
 * - trailingNewline: 末尾が改行で終わるか。
 * @param {string} raw
 * @returns {JsonFormat}
 */
export function detectFormat(raw) {
  const m = /\n([ \t]+)\S/.exec(raw);
  /** @type {number | string} */
  let indent = 0;
  if (m) indent = /^ +$/.test(m[1]) ? m[1].length : m[1];
  return { indent, trailingNewline: raw.endsWith('\n') };
}

/**
 * 検出した書式で JSON を文字列化する。
 * @param {any} obj
 * @param {JsonFormat} fmt
 * @returns {string}
 */
export function stringifyLike(obj, fmt) {
  return JSON.stringify(obj, null, fmt.indent) + (fmt.trailingNewline ? '\n' : '');
}
