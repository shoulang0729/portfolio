// @ts-check

// ══════════════════════════════════════════════════════════════
// order-sheet.js  ―  Order タブ（注文表）の取得・描画・本人申告
//
// 設計: docs/handoff/2026-10-03-order-sheet.md §7（表示場所は §12 冒頭の
// 2026-10-04 Toshio 決定で新タブ「Order」）。
// - Worker `GET /order-sheet`（PIN 必須・X-Pin-Hash）を PIN ログイン後だけ取得する。
//   未ログイン（PIN ハッシュ無し）では通信せず案内だけ出す。
// - 本人申告は `POST /order-sheet/events`（rev 付き）。成功時は返ってきた注文表で再描画、
//   409（rev 不一致）は「他で更新されました」と出して再取得する。
// - 描画の整形は order-sheet-view.js（純関数）。状態は state.orderSheet に集約する。
// - Worker・PIN ハッシュ・実値は console に出さない。
// ══════════════════════════════════════════════════════════════

import { state } from './state.js';
import { WORKER_URL } from './config.js';
import { fetchWithTimeout } from './data-helpers.js';
import { _getActivePinHash } from './auth-pin.js';
import { showConfirm, showAlert } from './modal.js';
import { renderOrderSheetHTML, renderOrderSheetMessage, parseStageArg, confirmMessage } from './order-sheet-view.js';

const FETCH_TIMEOUT_MS = 15000;

/** 描画先 */
function _wrap() {
  return document.getElementById('order-wrap');
}

/** state.orderSheet の内容で描画し直す（通信しない。マスク切替などから呼ぶ） */
export function rerenderOrderTab() {
  const wrap = _wrap();
  if (!wrap) return;
  const os = state.orderSheet;
  if (os.status === 'ok' && os.data) {
    wrap.innerHTML = renderOrderSheetHTML(os.data, { masked: state.statsMasked, busy: os.busy });
    return;
  }
  if (os.status === 'nologin' || os.status === 'empty' || os.status === 'error') {
    wrap.innerHTML = renderOrderSheetMessage(os.status, os.error || undefined);
    return;
  }
  wrap.innerHTML = renderOrderSheetMessage('loading');
}

/**
 * 応答の JSON を読む（失敗時は null）
 * @param {Response} r
 */
async function _json(r) {
  try {
    return await r.json();
  } catch {
    return null;
  }
}

/**
 * Order タブを描画する（タブを開くたびに最新を取得）。
 * @returns {Promise<void>}
 */
export async function renderOrderTab() {
  const pinHash = _getActivePinHash();
  if (!pinHash) {
    state.orderSheet = { status: 'nologin', data: null, error: null, busy: false };
    rerenderOrderTab();
    return;
  }
  // 取得中は前回の表を残す（無ければ「読み込み中」）
  if (state.orderSheet.status !== 'ok') state.orderSheet = { ...state.orderSheet, status: 'loading', error: null };
  rerenderOrderTab();
  try {
    const r = await fetchWithTimeout(`${WORKER_URL}/order-sheet`, FETCH_TIMEOUT_MS, {
      headers: { 'X-Pin-Hash': pinHash },
      cache: 'no-store',
    });
    if (r.status === 401) throw new Error('PIN 認証に失敗しました（401）');
    if (!r.ok) throw new Error(`取得失敗（HTTP ${r.status}）`);
    const sheet = await _json(r);
    if (sheet == null) {
      state.orderSheet = { status: 'empty', data: null, error: null, busy: false };
    } else if (typeof sheet !== 'object' || !sheet.meta) {
      throw new Error('応答の形が不正です');
    } else {
      state.orderSheet = { status: 'ok', data: sheet, error: null, busy: false };
    }
  } catch (e) {
    console.warn('[order-sheet] 取得失敗', e?.name || 'Error');
    state.orderSheet = {
      status: 'error',
      data: null,
      error: e instanceof Error && e.name !== 'AbortError' ? e.message : 'タイムアウトしました',
      busy: false,
    };
  }
  if (state.activeTab === 'order') rerenderOrderTab();
}

/**
 * 本人申告（§7.3）: 確認 → POST /order-sheet/events（rev 付き）→ 再描画
 * @param {'placed'|'filled'|'cancelled'|'unplace'} type
 * @param {unknown} arg data-arg（"SYM:stageId"）
 */
async function _sendEvent(type, arg) {
  const target = parseStageArg(arg);
  const os = state.orderSheet;
  if (!target || os.status !== 'ok' || !os.data || os.busy) return;
  const pinHash = _getActivePinHash();
  if (!pinHash) {
    await showAlert({ title: '注文表', message: 'PIN でログインしてから操作してください。' });
    return;
  }
  const ok = await showConfirm({
    title: '注文表の申告',
    message: confirmMessage(os.data, type, target.symbol, target.stageId),
    okLabel: '申告する',
  });
  if (!ok) return;

  const rev = os.data.meta?.planRev;
  state.orderSheet = { ...state.orderSheet, busy: true };
  rerenderOrderTab();
  /** @type {Record<string, unknown>} */
  const body = { type, symbol: target.symbol, stageId: target.stageId, rev };
  if (type === 'filled') body.source = 'self';
  try {
    const r = await fetchWithTimeout(`${WORKER_URL}/order-sheet/events`, FETCH_TIMEOUT_MS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Pin-Hash': pinHash },
      body: JSON.stringify(body),
    });
    if (r.status === 409) {
      state.orderSheet = { ...state.orderSheet, busy: false };
      await showAlert({ title: '注文表', message: '他で更新されました。再読み込みします。' });
      await renderOrderTab();
      return;
    }
    const res = await _json(r);
    if (!r.ok) {
      state.orderSheet = { ...state.orderSheet, busy: false };
      const msg = res && typeof res.error === 'string' ? res.error : `HTTP ${r.status}`;
      await showAlert({ title: '注文表', message: `申告できませんでした: ${msg}` });
      // 500 でも書き込み済みの場合がある（Worker が rev を返す）ので取り直す
      await renderOrderTab();
      return;
    }
    if (res && typeof res === 'object' && res.meta) {
      state.orderSheet = { status: 'ok', data: res, error: null, busy: false };
      if (state.activeTab === 'order') rerenderOrderTab();
    } else {
      state.orderSheet = { ...state.orderSheet, busy: false };
      await renderOrderTab();
    }
  } catch (e) {
    console.warn('[order-sheet] 申告失敗', e?.name || 'Error');
    state.orderSheet = { ...state.orderSheet, busy: false };
    rerenderOrderTab();
    await showAlert({ title: '注文表', message: '通信に失敗しました。再読み込みして状態を確認してください。' });
  }
}

/** [発注した] @param {unknown} arg */
export function orderPlaced(arg) {
  return _sendEvent('placed', arg);
}

/** [約定した] @param {unknown} arg */
export function orderFilled(arg) {
  return _sendEvent('filled', arg);
}

/** [取消]（段をスキップ） @param {unknown} arg */
export function orderCancelled(arg) {
  return _sendEvent('cancelled', arg);
}

/** [発注を取り消した]（要発注に戻す） @param {unknown} arg */
export function orderUnplace(arg) {
  return _sendEvent('unplace', arg);
}

/** [再読み込み] */
export function orderReload() {
  return renderOrderTab();
}
