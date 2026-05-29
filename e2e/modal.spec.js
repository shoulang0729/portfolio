import { test, expect } from '@playwright/test';
import { stubApis } from './helpers.js';

/**
 * modal.spec.js  ―  自作 showConfirm モーダルの動作テスト (src/modal.js)
 *
 * showConfirm は modal.js の ES Module エクスポート（依存なし）のため、
 * page.evaluate 内で動的 import して呼び出す。
 * modal.js は依存モジュールが一切ないため、動的 import が安全に機能する。
 */

test.beforeEach(async ({ page }) => {
  await stubApis(page);
  await page.goto('/');
  await expect(page.locator('#panel-heatmap')).toBeVisible();
});

/**
 * showConfirm を evaluate で呼び出して結果を window.__confirmResult に格納するヘルパー
 */
async function invokeShowConfirm(page, { title, message, okLabel = 'OK', cancelLabel = 'キャンセル' }) {
  await page.evaluate(
    ({ title, message, okLabel, cancelLabel }) => {
      window.__confirmResult = undefined;
      return import('/src/modal.js').then(({ showConfirm }) => {
        showConfirm({ title, message, okLabel, cancelLabel }).then(r => {
          window.__confirmResult = r;
        });
      });
    },
    { title, message, okLabel, cancelLabel }
  );
}

test('showConfirm の OK ボタンで true が返る', async ({ page }) => {
  await invokeShowConfirm(page, {
    title: 'テスト確認',
    message: 'OK を押してください',
  });

  // モーダルが表示される（role=dialog）
  const overlay = page.locator('.modal-overlay[role="dialog"]').last();
  await expect(overlay).toBeVisible({ timeout: 3000 });

  // OK ボタンをクリック
  const okBtn = overlay.locator('button').filter({ hasText: 'OK' });
  await okBtn.click();

  // resolve(true) を確認
  await page.waitForFunction(() => window.__confirmResult !== undefined, { timeout: 3000 });
  const result = await page.evaluate(() => window.__confirmResult);
  expect(result).toBe(true);
});

test('showConfirm の Cancel ボタンで false が返る', async ({ page }) => {
  await invokeShowConfirm(page, {
    title: 'テスト確認',
    message: 'キャンセルを押してください',
  });

  const overlay = page.locator('.modal-overlay[role="dialog"]').last();
  await expect(overlay).toBeVisible({ timeout: 3000 });

  // Cancel ボタンをクリック
  const cancelBtn = overlay.locator('button').filter({ hasText: 'キャンセル' });
  await cancelBtn.click();

  await page.waitForFunction(() => window.__confirmResult !== undefined, { timeout: 3000 });
  const result = await page.evaluate(() => window.__confirmResult);
  expect(result).toBe(false);
});

test('showConfirm で ESC キーを押すとモーダルが閉じて false が返る', async ({ page }) => {
  await invokeShowConfirm(page, {
    title: 'テスト確認',
    message: 'ESC を押してください',
  });

  const overlay = page.locator('.modal-overlay[role="dialog"]').last();
  await expect(overlay).toBeVisible({ timeout: 3000 });

  // ESC キーを押す
  await page.keyboard.press('Escape');

  // resolve(false) を確認
  await page.waitForFunction(() => window.__confirmResult !== undefined, { timeout: 3000 });
  const result = await page.evaluate(() => window.__confirmResult);
  expect(result).toBe(false);

  // モーダルが DOM から消える
  await expect(overlay).toBeHidden({ timeout: 3000 });
});
