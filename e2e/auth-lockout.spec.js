import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { test, expect } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const _d3Content = readFileSync(join(__dirname, '../node_modules/d3/dist/d3.min.js'));

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
    // ロックアウト状態はクリア
    localStorage.removeItem('hm-lockout');
    // PINハッシュは「設定済み」にする（未設定だと #356+ の initAuth が初回設定オーバーレイ
    // #pc-overlay を出してしまうため）。未認証＋ハッシュ有り → ログイン画面 #pin-overlay が表示され、
    // 誤PIN入力でロックアウトが成立する。値は実PINと一致しない固定ハッシュ。
    localStorage.setItem('hm-pin-hash', '0'.repeat(64));
  });

  await page.route(/cdn\.bootcdn\.net.*d3|cdnjs\.cloudflare\.com.*d3|cdn\.jsdelivr\.net.*d3/, async route => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: _d3Content });
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
  // PIN ドットが6つある（AUTH_PIN_LEN = 6）
  const dots = page.locator('#pin-overlay .pin-dot');
  await expect(dots).toHaveCount(6);
  // PIN キーパッドのボタンが表示される（数字キー）
  await expect(page.locator('#pin-overlay .pin-key[data-arg="1"]')).toBeVisible();
});

test('PIN 5 回失敗でロックアウトエラーが表示される', async ({ page }) => {
  await stubApisNoAuth(page);
  await page.goto('/');

  await expect(page.locator('#pin-overlay')).toBeVisible({ timeout: 5000 });

  // 誤った PIN（111111）を 5 回入力（デフォルト PIN は 123456）
  const wrongPin = '111111';
  for (let i = 0; i < 5; i++) {
    // キーが有効になるまで待つ（前の入力後に一時 disabled になる）
    const key1 = page.locator(`#pin-overlay .pin-key[data-arg="1"]`);
    await expect(key1).toBeEnabled({ timeout: 2000 });
    await enterPin(page, wrongPin);
    // 6桁入力後、自動サブミット → エラー表示 → クリア（500ms 余裕）
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
  const wrongPin = '111111';
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
