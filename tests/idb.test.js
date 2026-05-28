import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { openDb, idbGet, idbPut, idbClear, idbGetAll } from '../src/idb.js';

describe('idb.js — IndexedDB wrapper', () => {
  let db;

  beforeEach(async () => {
    // テスト用 DB を初期化
    db = await openDb('test-db', 1, (database) => {
      if (!database.objectStoreNames.contains('test-store')) {
        database.createObjectStore('test-store');
      }
    });
    // 前のテストのデータをクリア
    await idbClear(db, 'test-store');
  });

  it('openDb で objectStore が作られる', async () => {
    expect(db.objectStoreNames.contains('test-store')).toBe(true);
  });

  it('put → get で値が一致', async () => {
    const key = 'key1';
    const value = { data: 'test', count: 42 };
    await idbPut(db, 'test-store', key, value);
    const result = await idbGet(db, 'test-store', key);
    expect(result).toEqual(value);
  });

  it('put → getAll で配列に含まれる', async () => {
    await idbPut(db, 'test-store', 'a', { val: 1 });
    await idbPut(db, 'test-store', 'b', { val: 2 });
    const all = await idbGetAll(db, 'test-store');
    expect(all).toHaveLength(2);
    expect(all).toEqual(expect.arrayContaining([{ val: 1 }, { val: 2 }]));
  });

  it('存在しない key の get は undefined を返す', async () => {
    const result = await idbGet(db, 'test-store', 'nonexistent');
    expect(result).toBeUndefined();
  });

  it('clear で全項目削除', async () => {
    await idbPut(db, 'test-store', 'x', 100);
    await idbPut(db, 'test-store', 'y', 200);
    await idbClear(db, 'test-store');
    const all = await idbGetAll(db, 'test-store');
    expect(all).toHaveLength(0);
  });
});
