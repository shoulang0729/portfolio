// @ts-check
// ══════════════════════════════════════════════════════════════
// constituents-cache.js  ―  live 構成銘柄（state.liveConstituents）の
//   IndexedDB 永続化。
//
// リスク断面 Phase B / B6（#205）。historical-cache.js のパターンを踏襲し、
// store/鍵 `constituents:<symbol>`、値 `{holdings, asOf, source}` を永続化する。
//
// 二段構え:
//   1. 起動時 restoreConstituentsFromIDB() で IDB → メモリ（state.liveConstituents）先読み
//   2. 新規取得（B4 profile2 / B3 等）時に setConstituentEntry() で IDB へ並行書き込み
//
// 鮮度: asOf から STALE_DAYS 超過で再取得対象（要件 §6 の週次相当をクライアント側で判定）。
//
// 依存: idb.js / state.js
// ══════════════════════════════════════════════════════════════

import { openDb, idbPut, idbClear, idbGetAllEntries } from './idb.js';
import { state } from './state.js';

const DB_NAME    = 'hm-constituents';
const DB_VERSION = 1;
const STORE_NAME = 'constituents';

/** 鮮度判定（日）: これより古い asOf は再取得対象 */
export const STALE_DAYS = 7;

// DB 接続シングルトン（モジュールあたり 1 接続）
let _dbPromise = null;

function getDb() {
  if (!_dbPromise) {
    _dbPromise = openDb(DB_NAME, DB_VERSION, (db) => {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    }).catch(e => {
      _dbPromise = null;
      throw e;
    });
  }
  return _dbPromise;
}

/**
 * asOf（ISO 文字列）が STALE_DAYS より古いか判定する。
 * asOf が無効なら true（=要再取得）。
 * @param {string} [asOf]
 * @param {number} [days]
 * @returns {boolean}
 */
export function isStale(asOf, days = STALE_DAYS) {
  if (!asOf) return true;
  const t = Date.parse(asOf);
  if (Number.isNaN(t)) return true;
  return (Date.now() - t) > days * 24 * 60 * 60 * 1000;
}

/**
 * IDB の全構成銘柄を state.liveConstituents に先読み復元する。
 * 既にメモリにあるエントリ（同一セッション内で取得済み）は上書きしない。
 * @returns {Promise<number>} 復元したエントリ数
 */
export async function restoreConstituentsFromIDB() {
  try {
    const db = await getDb();
    const all = await idbGetAllEntries(db, STORE_NAME);
    let n = 0;
    for (const { key, value } of all) {
      if (!value || !Array.isArray(value.holdings)) continue;
      const symbol = String(key);
      if (state.liveConstituents[symbol]) continue; // メモリ優先
      state.liveConstituents[symbol] = value;
      n++;
    }
    return n;
  } catch (e) {
    console.warn('[constituents-cache] restore failed:', e);
    return 0;
  }
}

/**
 * 1 銘柄の構成銘柄エントリを IDB に書き込む。
 * @param {string} symbol
 * @param {{holdings: Array<object>, asOf?: string, source?: string}} entry
 * @returns {Promise<void>}
 */
export async function setConstituentEntry(symbol, entry) {
  try {
    const db = await getDb();
    await idbPut(db, STORE_NAME, symbol, entry);
  } catch (e) {
    console.warn(`[constituents-cache] set(${symbol}) failed:`, e);
  }
}

/** IDB の構成銘柄ストアを全消去（デバッグ/リセット用）。 */
export async function clearConstituentsIDB() {
  try {
    const db = await getDb();
    await idbClear(db, STORE_NAME);
  } catch (e) {
    console.warn('[constituents-cache] clear failed:', e);
  }
}
