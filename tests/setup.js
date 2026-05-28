// vitest グローバルセットアップ: Node.js 環境にないブラウザ API をモック

globalThis.sessionStorage = {
  _store: {},
  getItem(key) { return this._store[key] ?? null; },
  setItem(key, value) { this._store[key] = String(value); },
  removeItem(key) { delete this._store[key]; },
};

globalThis.localStorage = {
  _store: {},
  getItem(key) { return this._store[key] ?? null; },
  setItem(key, value) { this._store[key] = String(value); },
  removeItem(key) { delete this._store[key]; },
};

// 各テストの共通 setup を将来集約するためのファイル。
// 現状: 各テストの mock は独立性が高く、共通化候補なし（Issue #115 で確認済み）。