// @ts-check
// ══════════════════════════════════════════════════════════════
// idb.js  ―  IndexedDB ラッパー
//
// Promise ベースの薄いラッパー。オフラインストレージの将来統合を想定。
// ══════════════════════════════════════════════════════════════

/**
 * IndexedDB を開く / 初期化
 *
 * @param {string} dbName - データベース名
 * @param {number} version - スキーマバージョン
 * @param {Function} upgradeCb - upgrade event callback: (db, oldVersion, newVersion) => void
 * @returns {Promise<IDBDatabase>}
 */
export function openDb(dbName, version, upgradeCb) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, version);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (upgradeCb) upgradeCb(db, e.oldVersion, e.newVersion);
    };
  });
}

/**
 * キーで値を取得
 *
 * @param {IDBDatabase} db
 * @param {string} storeName - オブジェクトストア名
 * @param {*} key
 * @returns {Promise<*>} 値、またはキーが見つからない場合は undefined
 */
export function idbGet(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

/**
 * キーと値を保存
 *
 * @param {IDBDatabase} db
 * @param {string} storeName
 * @param {*} key
 * @param {*} value
 * @returns {Promise<void>}
 */
export function idbPut(db, storeName, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value, key);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
  });
}

/**
 * オブジェクトストアをクリア
 *
 * @param {IDBDatabase} db
 * @param {string} storeName
 * @returns {Promise<void>}
 */
export function idbClear(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
  });
}

/**
 * オブジェクトストアのすべての値を取得
 *
 * @param {IDBDatabase} db
 * @param {string} storeName
 * @returns {Promise<Array<*>>}
 */
export function idbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}
