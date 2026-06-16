import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const yahooChartFixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/yahoo-chart.json'), 'utf8')
);
const _d3Content = readFileSync(join(__dirname, '../node_modules/d3/dist/d3.min.js'));

/**
 * 共通 API スタブ設定
 * Worker 経由のすべてのリクエストと直接の Yahoo/Finnhub リクエストをモックする。
 * また、PIN 認証画面を initScript でスキップする（デフォルト PIN 1234 相当の AES 鍵を注入）。
 *
 * @param {import('@playwright/test').Page} page
 */
export async function stubApis(page) {
  const WORKER = 'portfolio-proxy.shoulang.workers.dev';

  // D3 CDN → node_modules から提供（CI での不安定なCDN依存を排除）
  await page.route(/cdn\.bootcdn\.net.*d3|cdnjs\.cloudflare\.com.*d3|cdn\.jsdelivr\.net.*d3/, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: _d3Content,
    });
  });

  // PIN 認証オーバーレイをスキップ:
  //   sessionStorage に認証済みフラグと AES-256 鍵を事前セットし
  //   initAuth() が PIN 画面を表示しないようにする。
  await page.addInitScript(() => {
    // hm-auth-v1 = '1' → isAuthenticated() が true を返す
    sessionStorage.setItem('hm-auth-v1', '1');
    // hm-enc-key-v1 = base64(32バイト) → _restoreEncKey() が成功する
    const fakeKeyBytes = new Uint8Array(32);
    const fakeKeyB64 = btoa(String.fromCharCode(...fakeKeyBytes));
    sessionStorage.setItem('hm-enc-key-v1', fakeKeyB64);
  });

  // Worker /positions → 404（ローカル positions.js を使用）
  await page.route(`**/${WORKER}/positions`, route =>
    route.fulfill({ status: 404, body: 'not found' })
  );

  // Worker /prices/cache → 空オブジェクト
  await page.route(`**/${WORKER}/prices/cache`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );

  // Worker /watchlist → 空配列
  await page.route(`**/${WORKER}/watchlist`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

  // data/portfolio-snapshot.json → 空（KV が空のとき watchlist.js が
  //   _restoreWatchlistFromSnapshot() で実スナップショット(19件)を復元してしまい
  //   「初期状態でウォッチリストが空」テストが落ちるため、空オブジェクトを返す）
  await page.route(/\/data\/portfolio-snapshot\.json(\?|$)/, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"watchlist":[]}' })
  );

  // Worker /yahoo proxy → Yahoo chart fixture（quoteSummary 含む全リクエスト）
  await page.route(`**/${WORKER}/yahoo**`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(yahooChartFixture),
    })
  );

  // Worker /finnhub → 404（Yahoo フォールバックへ誘導）
  await page.route(`**/${WORKER}/finnhub**`, route =>
    route.fulfill({ status: 404, body: 'not found' })
  );

  // Worker /forex → 150（USD/JPY）
  await page.route(`**/${WORKER}/forex**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '150' })
  );

  // 直接 Yahoo Finance フォールバックは全部 abort（Worker 経由を強制）
  await page.route('**/query1.finance.yahoo.com/**', route => route.abort());
  await page.route('**/query2.finance.yahoo.com/**', route => route.abort());
  await page.route('**/corsproxy.io/**', route => route.abort());
  await page.route('**/api.allorigins.win/**', route => route.abort());
}
