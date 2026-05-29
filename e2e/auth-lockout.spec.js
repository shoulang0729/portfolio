import { test, expect } from '@playwright/test';

/**
 * auth-lockout.spec.js  ―  PIN ロックアウト動作テスト
 *
 * helpers.js の stubApis は認証をスキップするため、
 * このファイルでは PIN 認証画面が表示される状態でテストする。
 * sessionStorage の hm-auth-v1 を設定せずに goto する。
 */

const WORKER = 'portfolio-proxy.shoulang.workers.dev';

/**
 * PIN ロックアウトテスト用: 認証をスキップしないセットアップ
 * Worker API のみスタブして sessionStorage は空（PIN 認証画面を表示）。
 */
async function stubApisNoAuth(page) {
  // sessionStorage を空にして PIN 認証画面を表示させる
  await page.addInitScript(() => {
    sessionStorage.removeItem('hm-auth-v1');
    sessionStorage.removeItem('hm-enc-key-v1');
    // ロックアウト状態もクリア
    localStorage.removeItem('hm-lockout');
    localStorage.removeItem('hm-pin-hash');
  });

  await page.route(`**/${WORKER}/positions`, route =>
    route.fulfill({ status: 404, body: 'not found' })
  );
  await page.route(`**/${WORKER}/prices/cache`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
  await page.route(`**/${WORKER}/watchlist`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route(`**/${WORKER}/yahoo**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );
  await page.route(`**/${WORKER}/finnhub**`, route =>
    route.fulfill({ status: 404, body: 'not found' })
  );
  await page.route(`**/${WORKER}/forex**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '150' })
  );
  await page.route('**/query1.finance.yahoo.com/**', route => route.abort());
  await page.route('**/query2.finance.yahoo.com/**', route => route.abort());
  await page.route('**/corsproxy.io/**', route => route.abort());
  await page.route('**/api.allorigins.win/**', route => route.abort());
}

/**
 * PIN キーパッドで数字を入力するヘルパー
 * data-action="authKeyPress" data-arg="<n>" のボタンをクリックする
 */
async function enterPin(page, pin) {
  for (const ch of pin.split('')) {
    const key = page.locator(`#pin-overlay .pin-key[data-arg="${ch}"]`);
    await key.click();
  }
}

test('PIN 画面が表示される', async ({ page }) => {
  await stubApisNoAuth(page);
  await page.goto('/');

  // PIN オーバーレイが表示される
  await expect(page.locator('#pin-overlay')).toBeVisible({ timeout: 5000 });
  // PIN ドットが4つある
  const dots = page.locator('#pin-overlay .pin-dot');
  await expect(dots).toHaveCount(4);
  // PIN キーパッドのボタンが表示される（数字キー）
  await expect(page.locator('#pin-overlay .pin-key[data-arg="1"]')).toBeVisible();
});

test('PIN 5 回失敗でロックアウトエラーが表示される', async ({ page }) => {
  await stubApisNoAuth(page);
  await page.goto('/');

  await expect(page.locator('#pin-overlay')).toBeVisible({ timeout: 5000 });

  // 誤った PIN（1111）を 5 回入力（デフォルト PIN は 1234）
  const wrongPin = '1111';
  for (let i = 0; i < 5; i++) {
    // キーが有効になるまで待つ（前の入力後に一時 disabled になる）
    const key1 = page.locator(`#pin-overlay .pin-key[data-arg="1"]`);
    await expect(key1).toBeEnabled({ timeout: 2000 });
    await enterPin(page, wrongPin);
    // 4桁入力後、自動サブミット → エラー表示 → クリア（500ms 余裕）
    await page.waitForTimeout(500);
  }

  // ロックアウトエラーメッセージが表示される
  const errorEl = page.locator('#pin-error');
  await expect(errorEl).toBeVisible({ timeout: 3000 });
  const errText = await errorEl.textContent();
  // "5回失敗" かつロック時間（"分後に" または "秒後に"）を含む
  expect(errText).toMatch(/5回失敗|分後に|秒後に/);
});

test('PIN 5 回失敗後はキーパッドが無効になる', async ({ page }) => {
  await stubApisNoAuth(page);
  await page.goto('/');

  await expect(page.locator('#pin-overlay')).toBeVisible({ timeout: 5000 });

  // 誤った PIN を 5 回入力してロックアウトを発動させる
  const wrongPin = '1111';
  for (let i = 0; i < 5; i++) {
    const key1 = page.locator(`#pin-overlay .pin-key[data-arg="1"]`);
    await expect(key1).toBeEnabled({ timeout: 2000 });
    await enterPin(page, wrongPin);
    await page.waitForTimeout(500);
  }

  // ロックアウト後はキーパッドが disabled になる
  // （_submitPin 内で _setKeypadEnabled(false) が呼ばれる）
  const firstKey = page.locator('#pin-overlay .pin-key[data-arg="1"]');
  await expect(firstKey).toBeDisabled({ timeout: 3000 });
});
