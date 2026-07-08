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

  // ①リスク要約: 信号機バナー＋統一セクション（#564）が出る
  await expect(page.locator('.risk-overview .rv')).toBeVisible();
  await expect(page.locator('.risk-overview .rms-sec').first()).toBeVisible();
  // 自前アイコン（絵文字廃止）が使われている
  await expect(page.locator('.risk-overview .ric').first()).toBeVisible();

  // ②クオンツ・リスクが描画される（イベント or 案内）
  await expect(page.locator('.risk-quant')).toBeVisible();

  // 旧ストレス別カードは無い（②へ統合）
  await expect(page.locator('.stress-card')).toHaveCount(0);

  expect(errors, errors.join('\n')).toEqual([]);
});

test('Risk タブのカードは各種別ちょうど1枚（重複しない・#502 A）', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // タブ連打で renderRiskCharts を多重起動させ、レンダーガードが重複を抑えることを確認
  for (let i = 0; i < 4; i++) {
    await page.locator('[data-tab="risk"]').click();
    await page.locator('[data-tab="list"]').click();
  }
  await page.locator('[data-tab="risk"]').click();
  await expect(page.locator('#panel-risk')).toBeVisible();
  await expect(page.locator('.risk-overview')).toBeVisible();

  // 各カード種別はちょうど1枚（クオンツ等が2回出ない）
  await expect(page.locator('#risk-charts-wrap .risk-overview')).toHaveCount(1);
  await expect(page.locator('#risk-charts-wrap .risk-quant')).toHaveCount(1);
  await expect(page.locator('#risk-charts-wrap .region-card')).toHaveCount(1);

  expect(errors, errors.join('\n')).toEqual([]);
});
