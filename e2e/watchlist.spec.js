import { test, expect } from '@playwright/test';
import { stubApis } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await stubApis(page);
  await page.goto('/');
  // Watchlist タブに切替
  await page.locator('[data-tab="watchlist"]').click();
  await expect(page.locator('#panel-watchlist')).toBeVisible();
});

test('初期状態でウォッチリストが空', async ({ page }) => {
  await expect(page.locator('.wl-empty-msg')).toBeVisible();
});

test('銘柄検索でドロップダウンが表示される', async ({ page }) => {
  const searchInput = page.locator('#wl-search-input');
  await searchInput.fill('AAPL');

  // 500ms デバウンス + API 呼び出し
  const dropdown = page.locator('#wl-search-dropdown');
  await expect(dropdown).toBeVisible({ timeout: 5000 });
  // 検索中メッセージが表示される（確認中…）または結果が出る
  await expect(dropdown).not.toBeEmpty();
});

test('銘柄を追加するとウォッチリストに表示される', async ({ page }) => {
  const searchInput = page.locator('#wl-search-input');
  await searchInput.fill('AAPL');

  // 結果が出るまで待つ
  const dropdown = page.locator('#wl-search-dropdown');
  // クリック可能な検索結果（確認中…メッセージ以外）を待つ
  const result = dropdown.locator('.wl-search-item').first();
  await expect(result).toBeVisible({ timeout: 5000 });

  await result.click();

  // 空メッセージが消えてウォッチリストに追加された
  await expect(page.locator('.wl-empty-msg')).toBeHidden();
});
