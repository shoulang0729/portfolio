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
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`IndexedDB open timeout: ${dbName}`));
    }, 3000);
    const finish = cb => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cb();
    };
    req.onerror = () => finish(() => reject(req.error || new Error(`IndexedDB open failed: ${dbName}`)));
    req.onblocked = () => finish(() => reject(new Error(`IndexedDB open blocked: ${dbName}`)));
    req.onsuccess = () => finish(() => resolve(req.result));
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
    tx.onabort = () => reject(tx.error || new Error(`idbGet aborted: ${storeName}`));
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
    tx.onabort = () => reject(tx.error || new Error(`idbPut aborted: ${storeName}`));
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
    tx.onabort = () => reject(tx.error || new Error(`idbClear aborted: ${storeName}`));
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
    tx.onabort = () => reject(tx.error || new Error(`idbGetAll aborted: ${storeName}`));
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

/**
 * オブジェクトストアのすべてのキーと値のペアを取得
 *
 * @param {IDBDatabase} db
 * @param {string} storeName
 * @returns {Promise<Array<{key: *, value: *}>>}
 */
export function idbGetAllEntries(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.openCursor();
    const entries = [];
    tx.onabort = () => reject(tx.error || new Error(`idbGetAllEntries aborted: ${storeName}`));
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        entries.push({ key: cursor.key, value: cursor.value });
        cursor.continue();
      } else {
        resolve(entries);
      }
    };
  });
}
