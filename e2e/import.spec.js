import { test, expect } from '@playwright/test';
import { stubApis } from './helpers.js';

/**
 * import.spec.js  ―  マネックス CSV 取込フローの E2E テスト
 *
 * import-ui.js の openImportModal は data-action ディスパッチャ経由で呼び出す。
 * 認証済みフラグ（stubApis の initScript）により import ボタンは表示済み。
 */

test.beforeEach(async ({ page }) => {
  await stubApis(page);

  // Worker /positions PUT → 成功 mock
  await page.route('**/*.workers.dev/positions', route => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    }
    return route.fulfill({ status: 404, body: 'not found' });
  });

  await page.goto('/');
  await expect(page.locator('#panel-heatmap')).toBeVisible();

  // 認証済みとして import ボタンを表示する
  await page.evaluate(() => {
    const ids = ['import-manex-btn', 'import-mf-btn', 'manage-positions-btn'];
    ids.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.style.display = '';
    });
  });
});

/**
 * ハンバーガーメニューからマネックス取込ボタンをクリックするヘルパー
 */
async function openManexImportModal(page) {
  await page.locator('#hm-menu-btn').click();
  await expect(page.locator('#hm-menu-dropdown')).toBeVisible();
  await page.locator('#import-manex-btn').click();
  await expect(page.locator('#import-modal-overlay')).toBeVisible({ timeout: 3000 });
}

test('マネックス取込モーダルを開くとファイル選択画面が表示される', async ({ page }) => {
  await openManexImportModal(page);

  // タイトルが「マネックス証券 取込」
  await expect(page.locator('#import-modal-title')).toHaveText('マネックス証券 取込');

  // ドロップゾーン（ファイル選択エリア）が表示される
  await expect(page.locator('#import-drop-zone')).toBeVisible();

  // 「ファイルを選択」ボタンが表示される
  await expect(
    page.locator('#import-drop-zone button[data-action="focusImportFileInput"]')
  ).toBeVisible();
});

test('取込モーダルの ✕ ボタンでモーダルが閉じる', async ({ page }) => {
  await openManexImportModal(page);

  const overlay = page.locator('#import-modal-overlay');

  // ✕ ボタン（data-action="closeImportModal"）をクリック
  await page.locator('#import-modal-overlay .modal-close').click();

  // モーダルが閉じる（display:none に戻る）
  await expect(overlay).toBeHidden({ timeout: 3000 });
});

test('銘柄整理モーダルを開くとレビュー画面が表示される', async ({ page }) => {
  // ハンバーガーメニューから「銘柄を整理」ボタンを開く
  await page.locator('#hm-menu-btn').click();
  await expect(page.locator('#hm-menu-dropdown')).toBeVisible();

  const manageBtn = page.locator('#manage-positions-btn');
  await expect(manageBtn).toBeVisible();
  await manageBtn.click();

  const overlay = page.locator('#import-modal-overlay');
  await expect(overlay).toBeVisible({ timeout: 3000 });

  // タイトルが「保有銘柄を整理」
  await expect(page.locator('#import-modal-title')).toHaveText('保有銘柄を整理');

  // レビュー画面（import-review クラス）が表示される
  await expect(page.locator('.import-review')).toBeVisible();

  // 「保存 →」確定ボタンと「キャンセル」ボタンがある
  await expect(page.locator('.import-confirm-btn')).toBeVisible();
  await expect(page.locator('.import-cancel-btn')).toBeVisible();

  // キャンセルボタンでモーダルを閉じる
  await page.locator('.import-cancel-btn').click();
  await expect(overlay).toBeHidden({ timeout: 3000 });
});
