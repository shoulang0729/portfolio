import { test, expect } from '@playwright/test';
import { stubApis } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await stubApis(page);
  await page.goto('/');
});

test('起動時にヒートマップパネルが表示される', async ({ page }) => {
  await expect(page.locator('#panel-heatmap')).toBeVisible();
  await expect(page.locator('#panel-list')).toBeHidden();
});

test('Historical（保有＋ウォッチ統合）タブに切替', async ({ page }) => {
  await page.locator('[data-tab="list"]').click();
  await expect(page.locator('#panel-list')).toBeVisible();
  await expect(page.locator('#panel-heatmap')).toBeHidden();
  // セグメントピル［全部／保有／ウォッチ］が表示される
  await expect(page.locator('.heat-seg-pill[data-arg="all"]')).toBeVisible();
  await expect(page.locator('.heat-seg-pill[data-arg="held"]')).toBeVisible();
  await expect(page.locator('.heat-seg-pill[data-arg="watch"]')).toBeVisible();
});

test('統合タブ内でセグメント（保有/ウォッチ）を切替できる', async ({ page }) => {
  await page.locator('[data-tab="list"]').click();
  // 保有セグメント: 検索欄は隠れる
  await page.locator('.heat-seg-pill[data-arg="held"]').click();
  await expect(page.locator('.heat-seg-pill[data-arg="held"]')).toHaveClass(/active/);
  await expect(page.locator('#wl-search-wrap')).toBeHidden();
  // ウォッチセグメント: 検索欄が出る
  await page.locator('.heat-seg-pill[data-arg="watch"]').click();
  await expect(page.locator('.heat-seg-pill[data-arg="watch"]')).toHaveClass(/active/);
  await expect(page.locator('#wl-search-wrap')).toBeVisible();
});

test('タブを複数回切替しても正しく動作する', async ({ page }) => {
  await page.locator('[data-tab="list"]').click();
  await expect(page.locator('#panel-list')).toBeVisible();

  await page.locator('[data-tab="heatmap"]').click();
  await expect(page.locator('#panel-heatmap')).toBeVisible();
  await expect(page.locator('#panel-list')).toBeHidden();

  await page.locator('[data-tab="list"]').click();
  await expect(page.locator('#panel-list')).toBeVisible();
  await expect(page.locator('#panel-heatmap')).toBeHidden();
});

test('旧 Watchlist タブはタブバーから消えている', async ({ page }) => {
  await expect(page.locator('[data-tab="watchlist"]')).toHaveCount(0);
});
