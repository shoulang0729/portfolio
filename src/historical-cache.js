// ══════════════════════════════════════════════════════════════
// historical-cache.js  ―  historicalCache の IndexedDB 永続化
//
// state.historicalCache（メモリ）を一次キャッシュとして維持しつつ、
// IndexedDB を永続ストレージとして並行書き込みする（Phase 2）。
// sessionStorage は後方互換フォールバックとして並行書き込みを継続する。
// ══════════════════════════════════════════════════════════════

import { openDb, idbGet, idbPut, idbClear, idbGetAllEntries } from './idb.js';
import { state } from './state.js';
import { saveCacheToSession } from './cache.js';

const DB_NAME    = 'hm-historical';
const DB_VERSION = 1;
const STORE_NAME = 'historical';

// DB 接続シングルトン（モジュールあたり 1 接続）
let _dbPromise = null;

function getDb() {
  if (!_dbPromise) {
    _dbPromise = openDb(DB_NAME, DB_VERSION, (db) => {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    });
  }
  return _dbPromise;
}

/** IDB から 1 エントリ取得。不在時は null */
export async function getHistoricalEntry(range, symbol) {
  try {
    const db = await getDb();
    const stored = await idbGet(db, STORE_NAME, `${range}:${symbol}`);
    if (!stored?.entries) return null;
    return stored.entries.map(e => ({
      date:  e.date instanceof Date ? e.date : new Date(e.date),
      close: e.close,
    }));
  } catch (e) {
    console.warn('[historical-cache] getHistoricalEntry failed:', e);
    return null;
  }
}

/**
 * 1 エントリを IDB・sessionStorage・メモリに書き込む（並行書き込み）
 * state.historicalCache への反映を同期的に行い、IDB 書き込みは await する。
 */
export async function setHistoricalEntry(range, symbol, entries) {
  // メモリキャッシュを同期更新（既存の同期読み込みコードが即利用可能）
  if (!state.historicalCache[range]) state.historicalCache[range] = {};
  state.historicalCache[range][symbol] = entries;

  // IDB に永続化（クロスセッション）
  try {
    const db = await getDb();
    const serialised = entries.map(e => ({
      date:  e.date instanceof Date ? e.date.toISOString() : e.date,
      close: e.close,
    }));
    await idbPut(db, STORE_NAME, `${range}:${symbol}`, { entries: serialised, ts: Date.now() });
  } catch (e) {
    console.warn('[historical-cache] IDB write failed:', e);
  }

  // sessionStorage にも書き込み（後方互換フォールバック）
  saveCacheToSession();
}

/** 指定レンジのすべてのエントリを IDB から取得して {symbol: entries} 形式で返す */
export async function getAllHistorical(range) {
  try {
    const db = await getDb();
    const all = await idbGetAllEntries(db, STORE_NAME);
    const prefix = `${range}:`;
    const result = {};
    for (const { key, value } of all) {
      if (typeof key !== 'string' || !key.startsWith(prefix)) continue;
      const symbol = key.slice(prefix.length);
      result[symbol] = (value.entries || []).map(e => ({
        date:  e.date instanceof Date ? e.date : new Date(e.date),
        close: e.close,
      }));
    }
    return result;
  } catch (e) {
    console.warn('[historical-cache] getAllHistorical failed:', e);
    return {};
  }
}

/**
 * IDB のすべてのエントリを state.historicalCache に読み込む
 * loadCacheFromSession() で復元済みのエントリは IDB で上書き（IDB が正）
 */
export async function restoreFromIDB() {
  try {
    const db = await getDb();
    const all = await idbGetAllEntries(db, STORE_NAME);
    for (const { key, value } of all) {
      const colonIdx = key.indexOf(':');
      if (colonIdx === -1) continue;
      const range  = key.slice(0, colonIdx);
      const symbol = key.slice(colonIdx + 1);
      if (!state.historicalCache[range]) state.historicalCache[range] = {};
      state.historicalCache[range][symbol] = (value.entries || []).map(e => ({
        date:  e.date instanceof Date ? e.date : new Date(e.date),
        close: e.close,
      }));
    }
  } catch (e) {
    console.warn('[historical-cache] restoreFromIDB failed:', e);
  }
}

/**
 * sessionStorage のキャッシュを IDB に移行する（初回起動時に 1 度だけ呼ぶ）
 * IDB に既存エントリがあるキーはスキップする（上書きしない）。
 */
export async function migrateFromSessionStorage() {
  try {
    const raw = sessionStorage.getItem('hm-hist-cache');
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (!obj) return;

    const db = await getDb();
    const existing = await idbGetAllEntries(db, STORE_NAME);
    const existingKeys = new Set(existing.map(e => e.key));

    for (const range of ['1y', '5y', '10y']) {
      if (!obj[range]) continue;
      for (const [sym, entries] of Object.entries(obj[range])) {
        const key = `${range}:${sym}`;
        if (existingKeys.has(key)) continue;
        const serialised = entries.map(e => ({
          date:  typeof e.date === 'string' ? e.date : new Date(e.date).toISOString(),
          close: e.close,
        }));
        await idbPut(db, STORE_NAME, key, { entries: serialised, ts: Date.now() });
      }
    }
  } catch (e) {
    console.warn('[historical-cache] migrateFromSessionStorage failed:', e);
  }
}

/** IDB ストアと state.historicalCache を両方クリア（CSV 取込時等） */
export async function clearHistoricalIDB() {
  try {
    const db = await getDb();
    await idbClear(db, STORE_NAME);
  } catch (e) {
    console.warn('[historical-cache] clearHistoricalIDB failed:', e);
  }
  state.historicalCache = { '1y': {}, '5y': {}, '10y': {} };
}
