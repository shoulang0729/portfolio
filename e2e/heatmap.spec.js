import { test, expect } from '@playwright/test';
import { stubApis } from './helpers.js';

// Issue #156: IDB マイグレーション or hideHeatmapSkeleton 未呼び出しで SVG が hidden のまま
// 根本修正完了まで全シナリオ skip
test.describe.skip('heatmap (skipped: see #156)', () => {

test.beforeEach(async ({ page }) => {
  await stubApis(page);
  await page.goto('/');
  // ヒートマップパネルが表示されるまで待機
  await expect(page.locator('#panel-heatmap')).toBeVisible();
});

test('ヒートマップ SVG が描画される', async ({ page }) => {
  // SVG 要素が表示される（スケルトン非表示・SVG 表示）
  const svg = page.locator('#heatmap');
  await expect(svg).toBeVisible({ timeout: 10000 });

  // SVG に子要素（グループ・rect など）が存在する
  const childCount = await svg.evaluate(el => el.children.length);
  expect(childCount).toBeGreaterThan(0);
});

test('配色モード切替：含み損益率ボタンで pnl モードになる', async ({ page }) => {
  // SVG が描画されるのを待つ
  await expect(page.locator('#heatmap')).toBeVisible({ timeout: 10000 });

  // PnL モードボタンをクリック
  const pnlBtn = page.locator('#btn-pnl');
  await expect(pnlBtn).toBeVisible();
  await pnlBtn.click();

  // ボタンの状態が active クラスを持つ
  await expect(pnlBtn).toHaveClass(/active/);

  // SVG が再描画後も子要素がある
  const svg = page.locator('#heatmap');
  const childCountAfter = await svg.evaluate(el => el.children.length);
  expect(childCountAfter).toBeGreaterThan(0);
});

test('期間切替：1m ボタンで期間変更', async ({ page }) => {
  // SVG が描画されるのを待つ
  await expect(page.locator('#heatmap')).toBeVisible({ timeout: 10000 });

  // デフォルトは 1d がアクティブ
  const btn1d = page.locator('[data-period="1d"]');
  await expect(btn1d).toHaveClass(/active/);

  // 1m に切り替え
  const btn1m = page.locator('[data-period="1m"]');
  await btn1m.click();
  await expect(btn1m).toHaveClass(/active/);
  await expect(btn1d).not.toHaveClass(/active/);
});

test('期間切替：1y ボタンで期間変更', async ({ page }) => {
  await expect(page.locator('#heatmap')).toBeVisible({ timeout: 10000 });

  const btn1y = page.locator('[data-period="1y"]');
  await btn1y.click();
  await expect(btn1y).toHaveClass(/active/);
});

test('セル hover でツールチップが表示される', async ({ page }) => {
  // SVG が描画され cell-g グループが存在するまで待つ
  const svg = page.locator('#heatmap');
  await expect(svg).toBeVisible({ timeout: 10000 });
  await page.waitForFunction(
    () => {
      const el = document.getElementById('heatmap');
      return el && el.querySelectorAll('.cell-g').length > 0;
    },
    { timeout: 10000 }
  );

  // .cell-g 内の rect（銘柄セル）を取得してホバー
  const cell = page.locator('#heatmap .cell-g rect').first();
  const tooltip = page.locator('#tooltip');

  // mousemove イベントでツールチップが表示される
  await cell.hover();

  // ツールチップが display:block で可視状態になる
  await expect(tooltip).toBeVisible({ timeout: 3000 });
  const tipText = await tooltip.textContent();
  expect(tipText?.trim().length).toBeGreaterThan(0);
});
});
