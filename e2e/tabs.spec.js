import { test, expect } from '@playwright/test';
import { stubApis } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await stubApis(page);
  await page.goto('/');
});

test('起動時にヒートマップパネルが表示される', async ({ page }) => {
  await expect(page.locator('#panel-heatmap')).toBeVisible();
  await expect(page.locator('#panel-list')).toBeHidden();
  await expect(page.locator('#panel-watchlist')).toBeHidden();
});

test('Historical Heatmap タブに切替', async ({ page }) => {
  await page.locator('[data-tab="list"]').click();
  await expect(page.locator('#panel-list')).toBeVisible();
  await expect(page.locator('#panel-heatmap')).toBeHidden();
});

test('Watchlist タブに切替', async ({ page }) => {
  await page.locator('[data-tab="watchlist"]').click();
  await expect(page.locator('#panel-watchlist')).toBeVisible();
  await expect(page.locator('#panel-heatmap')).toBeHidden();
});

test('タブを複数回切替しても正しく動作する', async ({ page }) => {
  await page.locator('[data-tab="list"]').click();
  await expect(page.locator('#panel-list')).toBeVisible();

  await page.locator('[data-tab="watchlist"]').click();
  await expect(page.locator('#panel-watchlist')).toBeVisible();
  await expect(page.locator('#panel-list')).toBeHidden();

  await page.locator('[data-tab="heatmap"]').click();
  await expect(page.locator('#panel-heatmap')).toBeVisible();
  await expect(page.locator('#panel-watchlist')).toBeHidden();
});
