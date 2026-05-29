import { test, expect } from '@playwright/test';
import { stubApis } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await stubApis(page);
  await page.goto('/');
});

test('ハンバーガーメニューが開閉できる', async ({ page }) => {
  const menuBtn = page.locator('#hm-menu-btn');
  const menuDropdown = page.locator('#hm-menu-dropdown');

  // 初期状態: メニューが閉じている
  await expect(menuBtn).toHaveAttribute('aria-expanded', 'false');

  // クリックで開く
  await menuBtn.click();
  await expect(menuBtn).toHaveAttribute('aria-expanded', 'true');
  await expect(menuDropdown).toBeVisible();
});

test('メニューにテーマ切替ボタンがある', async ({ page }) => {
  await page.locator('#hm-menu-btn').click();
  await expect(page.locator('#theme-btn')).toBeVisible();
});

test('メニュー外クリックでメニューが閉じる', async ({ page }) => {
  const menuBtn = page.locator('#hm-menu-btn');
  await menuBtn.click();
  await expect(menuBtn).toHaveAttribute('aria-expanded', 'true');

  // メニュー外のエリアをクリック
  await page.locator('#panel-heatmap').click({ position: { x: 10, y: 10 }, force: true });
  await expect(menuBtn).toHaveAttribute('aria-expanded', 'false');
});
