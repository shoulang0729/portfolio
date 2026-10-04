/**
 * order.spec.js  ―  Order タブ（注文表・#674）
 *
 * Worker の /order-sheet・/order-sheet/events をモックする（すべて合成値・架空ティッカー）。
 * PIN ハッシュはダミー文字列（実ハッシュではない）。
 */
import { test, expect } from '@playwright/test';
import { stubApis } from './helpers.js';

const WORKER = 'portfolio-proxy.shoulang.workers.dev';
const FAKE_PIN_HASH = 'e2e-dummy-pin-hash';

/** 合成の注文表（§4.2 の形） */
function sheet({ rev = 7, s1 = 'toPlace' } = {}) {
  return {
    asOf: '2026-01-10T00:00:00Z',
    meta: {
      planRev: rev,
      holdingsAsOf: '2026-01-09',
      holdingsLagNote: 'MF の同期は寄付前のため、直近の取引日の約定は未反映の可能性があります',
      warnings: [],
    },
    cash: { pct: 13.1, floorPct: 12, guardActive: false },
    orders: [
      {
        symbol: 'AAA',
        side: 'buy',
        tier: 'thick',
        stageId: 's1',
        status: s1,
        limit: 368,
        qty: 81,
        filledQty: 0,
        amountUsd: 29808,
        curUsd: 60000,
        curPct: 1.7,
        afterUsd: 89808,
        afterPct: 2.5,
        targetUsd: 100000,
        targetPct: 2.8,
        next: { stageId: 's2', text: '約定したら次は $320×125（基準比 −20%）' },
        flags: [],
        notes: [],
      },
      {
        symbol: 'JPST',
        side: 'sell',
        role: 'funding',
        limit: null,
        qty: 120,
        amountUsd: 6000,
        text: '米ドル買いの不足分を充当',
      },
    ],
    ladders: [
      {
        symbol: 'AAA',
        tier: 'thick',
        targetUsd: 100000,
        targetPct: 2.8,
        curUsd: 60000,
        curPct: 1.7,
        basePrice: 400,
        baseEvent: 'manual',
        hold: null,
        notes: [],
        stages: [
          { id: 's1', side: 'buy', state: 'working', display: s1, limit: 368, qty: 81, suppressed: null },
          { id: 's2', side: 'buy', state: 'waiting', display: 'waiting', limit: 320, qty: 125, suppressed: null },
        ],
      },
    ],
    funding: {
      usd: {
        buyWorking: 29808,
        sellWorking: 0,
        usdCash: 23808,
        sweepSymbol: 'JPST',
        sweepQty: 120,
        sweepUsd: 6000,
        sweepCapped: false,
      },
      allStages: { buyTotal: 69808, sellTotal: 0, available: 80000, shortfallUsd: 0 },
    },
    aiTech: { capPct: 29, now: 24, afterWorking: 24.8, final: 27.5, over: false, themes: [] },
    stress: {
      tolerancePct: 20,
      equityPct: { now: 70, afterWorking: 70.8, final: 74 },
      scenarios: [{ id: 'ai-crash', label: 'AI −40%・他の株 −15%', now: 17.5, afterWorking: 17.9, final: 19.6 }],
    },
    review: { lastEvent: null, lastAt: null },
  };
}

async function setup(page, { login = true } = {}) {
  await stubApis(page);
  if (login) {
    await page.addInitScript((h) => localStorage.setItem('hm-pin-hash', h), FAKE_PIN_HASH);
  }
  await page.route(`**/${WORKER}/networth`, (route) => route.fulfill({ status: 404, body: 'not found' }));
}

test('Order タブ: 注文表（指値×株数）を出し、申告で返ってきた注文表に再描画する', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await setup(page);
  let getCount = 0;
  let posted = null;
  await page.route(`**/${WORKER}/order-sheet`, (route) => {
    getCount++;
    expect(route.request().headers()['x-pin-hash']).toBe(FAKE_PIN_HASH);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sheet()) });
  });
  await page.route(`**/${WORKER}/order-sheet/events`, (route) => {
    posted = JSON.parse(route.request().postData() || '{}');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sheet({ rev: 8, s1: 'placed' })),
    });
  });
  await page.goto('/');

  await page.locator('[data-tab="order"]').click();
  await expect(page.locator('#panel-order')).toBeVisible();
  const table = page.locator('#order-wrap .os-table').first();
  await expect(table).toContainText('AAA');
  await expect(table).toContainText('$368');
  await expect(table).toContainText('81');
  await expect(table).toContainText('JPST');
  await expect(page.locator('#order-wrap')).toContainText('未反映の可能性');
  await expect(page.locator('#order-wrap')).toContainText('rev 7');
  expect(getCount).toBe(1);

  await page.locator('#order-wrap [data-action="orderPlaced"][data-arg="AAA:s1"]').click();
  const overlay = page.locator('.modal-overlay[role="dialog"]').last();
  await expect(overlay).toContainText('AAA 買 $368×81 を発注済みにします');
  await overlay.getByRole('button', { name: '申告する' }).click();

  await expect(page.locator('#order-wrap')).toContainText('rev 8');
  await expect(page.locator('#order-wrap [data-action="orderPlaced"]')).toHaveCount(0);
  await expect(page.locator('#order-wrap [data-action="orderFilled"][data-arg="AAA:s1"]')).toHaveCount(1);
  expect(posted).toEqual({ type: 'placed', symbol: 'AAA', stageId: 's1', rev: 7 });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('Order タブ: 申告が 409 なら案内して再取得する', async ({ page }) => {
  await setup(page);
  let getCount = 0;
  await page.route(`**/${WORKER}/order-sheet`, (route) => {
    getCount++;
    const body = getCount === 1 ? sheet() : sheet({ rev: 9, s1: 'placed' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route(`**/${WORKER}/order-sheet/events`, (route) =>
    route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'rev 不一致', rev: 9 }),
    })
  );
  await page.goto('/');
  await page.locator('[data-tab="order"]').click();
  await expect(page.locator('#order-wrap')).toContainText('rev 7');

  await page.locator('#order-wrap [data-action="orderFilled"][data-arg="AAA:s1"]').click();
  await page.locator('.modal-overlay[role="dialog"]').last().getByRole('button', { name: '申告する' }).click();
  const alert = page.locator('.modal-overlay[role="dialog"]').last();
  await expect(alert).toContainText('他で更新されました');
  await alert.getByRole('button', { name: 'OK' }).click();
  await expect(page.locator('#order-wrap')).toContainText('rev 9');
  expect(getCount).toBe(2);
});

test('Order タブ: 未ログイン（PIN ハッシュ無し）では通信せず案内だけ出す', async ({ page }) => {
  await setup(page, { login: false });
  let called = false;
  await page.route(`**/${WORKER}/order-sheet**`, (route) => {
    called = true;
    return route.fulfill({ status: 500, body: '' });
  });
  await page.goto('/');
  // PIN 未設定時の初回セットアップ画面が出る場合は閉じられないため、タブを直接切り替える
  await page.evaluate(() => {
    const btn = document.querySelector('[data-tab="order"]');
    if (btn instanceof HTMLElement) btn.click();
  });
  await expect(page.locator('#order-wrap')).toContainText('PIN でログインすると注文表を表示します');
  expect(called).toBe(false);
});
