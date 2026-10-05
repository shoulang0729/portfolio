// Tests for src/order-sheet.js（Order タブの取得の順序・#703）
// すべて合成値。通信・PIN・モーダルはモック。

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/data-helpers.js', () => ({ fetchWithTimeout: vi.fn() }));
vi.mock('../src/auth-pin.js', () => ({ _getActivePinHash: vi.fn(() => 'synthetic-hash') }));
vi.mock('../src/modal.js', () => ({ showConfirm: vi.fn(async () => true), showAlert: vi.fn(async () => {}) }));

import { fetchWithTimeout } from '../src/data-helpers.js';
import { state } from '../src/state.js';
import { renderOrderTab } from '../src/order-sheet.js';

const SHEET = { meta: { planRev: 3, warnings: [] }, ladders: {}, orders: [] };

function okResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

beforeEach(() => {
  vi.mocked(fetchWithTimeout).mockReset();
  globalThis.document = /** @type {any} */ ({ getElementById: () => ({ innerHTML: '' }) });
  state.activeTab = 'order';
});

describe('renderOrderTab（#703）', () => {
  it('申告の POST 中（busy）にタブへ戻っても GET しない', async () => {
    state.orderSheet = { status: 'ok', data: SHEET, error: null, busy: true };
    await renderOrderTab();
    expect(fetchWithTimeout).not.toHaveBeenCalled();
    expect(state.orderSheet.busy).toBe(true);
    expect(state.orderSheet.data).toBe(SHEET);
  });

  it('busy でなければ GET して表を更新する', async () => {
    const next = { ...SHEET, meta: { ...SHEET.meta, planRev: 4 } };
    vi.mocked(fetchWithTimeout).mockResolvedValue(/** @type {any} */ (okResponse(next)));
    state.orderSheet = { status: 'ok', data: SHEET, error: null, busy: false };
    await renderOrderTab();
    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
    expect(state.orderSheet).toEqual({ status: 'ok', data: next, error: null, busy: false });
  });
});
