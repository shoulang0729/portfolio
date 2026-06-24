import { test, expect } from '@playwright/test';
import { stubApis } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await stubApis(page);
  await page.goto('/');
});

test('Risk タブが信号機リデザインで描画される（#488）', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.locator('[data-tab="risk"]').click();
  await expect(page.locator('#panel-risk')).toBeVisible();

  // ①リスク要約: 信号機バナー＋行が出る
  await expect(page.locator('.risk-overview .rv')).toBeVisible();
  await expect(page.locator('.risk-overview .rmrow').first()).toBeVisible();
  // 自前アイコン（絵文字廃止）が使われている
  await expect(page.locator('.risk-overview .ric').first()).toBeVisible();

  // ②クオンツ・リスクが描画される（イベント or 案内）
  await expect(page.locator('.risk-quant')).toBeVisible();

  // 旧ストレス別カードは無い（②へ統合）
  await expect(page.locator('.stress-card')).toHaveCount(0);

  expect(errors, errors.join('\n')).toEqual([]);
});
