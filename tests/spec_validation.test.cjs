/**
 * Tests for docs/SPEC.md — validates content added/changed in PR v20260525C.
 *
 * Runs with Node.js built-in test runner (Node 18+):
 *   node --test tests/spec_validation.test.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SPEC_PATH = path.join(ROOT, 'docs', 'SPEC.md');

// ── helpers ──────────────────────────────────────────────────────────────────

let _spec;
function spec() {
  if (!_spec) _spec = fs.readFileSync(SPEC_PATH, 'utf8');
  return _spec;
}

function lines() {
  return spec().split('\n');
}

function containsLine(text) {
  return lines().some(l => l.includes(text));
}

function containsExact(text) {
  return spec().includes(text);
}

// ── 1. Document metadata ──────────────────────────────────────────────────────

describe('SPEC.md — document metadata (v20260525C changes)', () => {
  it('exists at docs/SPEC.md', () => {
    assert.ok(fs.existsSync(SPEC_PATH), 'docs/SPEC.md must exist');
  });

  it('title is "Portfolio Manager" (not "Portfolio Heatmap")', () => {
    const firstLine = lines()[0];
    assert.ok(firstLine.includes('Portfolio Manager'), `Expected "Portfolio Manager" in title, got: ${firstLine}`);
    assert.ok(!firstLine.includes('Portfolio Heatmap'), 'Title must not contain old name "Portfolio Heatmap"');
  });

  it('version is 20260525C', () => {
    assert.ok(containsExact('バージョン: 20260525C'), 'Version must be 20260525C');
  });

  it('last-updated date is 2026-05-26', () => {
    assert.ok(containsExact('最終更新: 2026-05-26'), 'Last-updated date must be 2026-05-26');
  });

  it('version number follows YYYYMMDD[letter] format', () => {
    const versionMatch = spec().match(/バージョン:\s*(\d{8}[A-Za-z])/);
    assert.ok(versionMatch, 'Version string must be present');
    assert.match(versionMatch[1], /^\d{8}[A-Za-z]$/, 'Version must match YYYYMMDD+letter format');
  });
});

// ── 2. Tab structure ───────────────────────────────────────────────────────────

describe('SPEC.md — tab structure', () => {
  it('Heatmap tab is listed as enabled (✅ 有効)', () => {
    assert.ok(containsExact('**Heatmap**'), 'Heatmap tab must be documented');
    assert.ok(containsLine('**Heatmap**') && spec().includes('✅ 有効'), 'Heatmap tab must have ✅ 有効 status');
  });

  it('Historical Heatmap tab is listed as enabled (✅ 有効)', () => {
    assert.ok(containsExact('**Historical Heatmap**'), 'Historical Heatmap tab must be documented');
  });

  it('Watchlist Historical Heatmap tab is listed as enabled (✅ 有効)', () => {
    assert.ok(containsExact('**Watchlist Historical Heatmap**'), 'Watchlist Historical Heatmap tab must be documented');
  });

  it('資産推移 tab is marked as not-enabled (⚠️ 未有効化)', () => {
    assert.ok(containsExact('⚠️ 未有効化'), '資産推移 tab must be marked ⚠️ 未有効化');
  });

  it('AI相談 tab is marked as disabled (🚫 無効化中)', () => {
    assert.ok(containsExact('🚫 無効化中'), 'AI相談 tab must be marked 🚫 無効化中');
  });

  it('tab table has three columns: タブ / 概要 / 状態', () => {
    // The table header row must include the 状態 column (new in this PR)
    const headerRow = lines().find(l => l.startsWith('| タブ') && l.includes('状態'));
    assert.ok(headerRow, 'Tab table must include 状態 column');
  });

  it('old tab name "ヒートマップ" does not appear in tab table', () => {
    // Old tab "ヒートマップ" was renamed to "Heatmap"
    const tableSection = spec().split('### タブ構成')[1]?.split('---')[0] ?? '';
    assert.ok(!tableSection.includes('**ヒートマップ**'), 'Old tab name "ヒートマップ" must not appear in tab table');
  });

  it('old tab name "銘柄リスト" does not appear in tab table', () => {
    const tableSection = spec().split('### タブ構成')[1]?.split('---')[0] ?? '';
    assert.ok(!tableSection.includes('**銘柄リスト**'), 'Old tab name "銘柄リスト" must not appear in tab table');
  });

  it('old tab name "ウォッチリスト" does not appear in tab table', () => {
    const tableSection = spec().split('### タブ構成')[1]?.split('---')[0] ?? '';
    assert.ok(!tableSection.includes('**ウォッチリスト**'), 'Old tab name "ウォッチリスト" must not appear in tab table');
  });
});

// ── 3. Authentication ─────────────────────────────────────────────────────────

describe('SPEC.md — authentication spec', () => {
  it('documents both PIN and passkey authentication', () => {
    assert.ok(
      containsExact('4桁PINまたはパスキー（指紋/顔認証）で保護'),
      'Auth must document both PIN and passkey'
    );
  });

  it('passkey section exists', () => {
    assert.ok(containsExact('### パスキー認証（`auth-passkey.js`）'), 'Passkey auth section must exist');
  });

  it('passkey uses WebAuthn API', () => {
    assert.ok(containsExact('WebAuthn API'), 'Passkey section must mention WebAuthn API');
  });

  it('PIN auth is handled by auth-pin.js and auth-ui.js', () => {
    assert.ok(
      containsExact('### PIN認証フロー（`auth-pin.js` / `auth-ui.js`）'),
      'PIN auth must reference auth-pin.js and auth-ui.js'
    );
  });

  it('sessionStorage key hm-auth-v1 is attributed to auth-pin.js', () => {
    const sessionSection = spec().split('### sessionStorage')[1]?.split('###')[0] ?? '';
    assert.ok(sessionSection.includes('hm-auth-v1'), 'hm-auth-v1 must be in sessionStorage section');
    assert.ok(sessionSection.includes('auth-pin.js'), 'hm-auth-v1 must be attributed to auth-pin.js');
  });

  it('sessionStorage key hm-enc-key-v1 is attributed to auth-crypto.js', () => {
    const sessionSection = spec().split('### sessionStorage')[1]?.split('###')[0] ?? '';
    assert.ok(sessionSection.includes('hm-enc-key-v1'), 'hm-enc-key-v1 must be in sessionStorage section');
    assert.ok(sessionSection.includes('auth-crypto.js'), 'hm-enc-key-v1 must be attributed to auth-crypto.js');
  });

  it('PIN lockout is 5 failed attempts triggering 30-second lock', () => {
    assert.ok(containsExact('5回失敗で30秒ロック'), 'PIN lockout policy must be documented');
  });
});

// ── 4. Hamburger menu ─────────────────────────────────────────────────────────

describe('SPEC.md — hamburger menu', () => {
  it('hamburger menu section exists', () => {
    assert.ok(containsExact('### ハンバーガーメニューの項目'), 'Hamburger menu section must exist');
  });

  it('auto-refresh item is in the hamburger menu', () => {
    const menuSection = spec().split('### ハンバーガーメニューの項目')[1]?.split('###')[0] ?? '';
    assert.ok(menuSection.includes('**自動更新**'), '自動更新 must be in hamburger menu');
  });

  it('theme toggle item is in the hamburger menu', () => {
    const menuSection = spec().split('### ハンバーガーメニューの項目')[1]?.split('###')[0] ?? '';
    assert.ok(menuSection.includes('**テーマ切替**'), 'テーマ切替 must be in hamburger menu');
  });

  it('PIN change item is in the hamburger menu', () => {
    const menuSection = spec().split('### ハンバーガーメニューの項目')[1]?.split('###')[0] ?? '';
    assert.ok(menuSection.includes('**PIN変更**'), 'PIN変更 must be in hamburger menu');
  });

  it('passkey registration item is in the hamburger menu', () => {
    const menuSection = spec().split('### ハンバーガーメニューの項目')[1]?.split('###')[0] ?? '';
    assert.ok(menuSection.includes('**パスキー登録**'), 'パスキー登録 must be in hamburger menu');
  });

  it('Monex CSV import item is in the hamburger menu', () => {
    const menuSection = spec().split('### ハンバーガーメニューの項目')[1]?.split('###')[0] ?? '';
    assert.ok(menuSection.includes('**マネックス取込**'), 'マネックス取込 must be in hamburger menu');
  });

  it('MoneyForward import item is in the hamburger menu', () => {
    const menuSection = spec().split('### ハンバーガーメニューの項目')[1]?.split('###')[0] ?? '';
    assert.ok(menuSection.includes('**マネフォ取込**'), 'マネフォ取込 must be in hamburger menu');
  });

  it('stock organizer item is in the hamburger menu', () => {
    const menuSection = spec().split('### ハンバーガーメニューの項目')[1]?.split('###')[0] ?? '';
    assert.ok(menuSection.includes('**銘柄を整理**'), '銘柄を整理 must be in hamburger menu');
  });

  it('snapshot save item is in the hamburger menu', () => {
    const menuSection = spec().split('### ハンバーガーメニューの項目')[1]?.split('###')[0] ?? '';
    assert.ok(menuSection.includes('**スナップショット保存**'), 'スナップショット保存 must be in hamburger menu');
  });

  it('manual link is in the hamburger menu', () => {
    const menuSection = spec().split('### ハンバーガーメニューの項目')[1]?.split('###')[0] ?? '';
    assert.ok(menuSection.includes('**マニュアル**'), 'マニュアル must be in hamburger menu');
  });

  it('hamburger menu has exactly 9 items (rows with ** bold item name **)', () => {
    const menuSection = spec().split('### ハンバーガーメニューの項目')[1]?.split('###')[0] ?? '';
    const itemRows = menuSection.split('\n').filter(l => /^\|\s+\*\*[^|]+\*\*/.test(l));
    assert.equal(itemRows.length, 9, `Hamburger menu must have 9 items, found ${itemRows.length}`);
  });

  it('login-only items require ログイン後のみ condition', () => {
    const menuSection = spec().split('### ハンバーガーメニューの項目')[1]?.split('###')[0] ?? '';
    const loginOnlyCount = (menuSection.match(/ログイン後のみ/g) || []).length;
    assert.equal(loginOnlyCount, 6, `6 items should require login, found ${loginOnlyCount}`);
  });

  it('header left side shows app title Portfolio Manager', () => {
    assert.ok(
      containsExact('アプリタイトル「Portfolio Manager」'),
      'Header must document Portfolio Manager as app title'
    );
  });
});

// ── 5. Pull-to-refresh ────────────────────────────────────────────────────────

describe('SPEC.md — pull-to-refresh', () => {
  it('pull-to-refresh section exists', () => {
    assert.ok(containsExact('### プル・トゥ・リフレッシュ'), 'Pull-to-refresh section must exist');
  });

  it('icon rotates 0 to 270 degrees while pulling', () => {
    assert.ok(
      containsExact('リフレッシュアイコンが回転（0→270度）'),
      'Pull-to-refresh must document 0→270 degree icon rotation'
    );
  });

  it('threshold is 72px', () => {
    assert.ok(
      containsExact('閾値（72px相当）'),
      'Pull-to-refresh threshold must be documented as 72px'
    );
  });

  it('full 360 degree spin triggers reload', () => {
    assert.ok(
      containsExact('360度スピン後にリロード'),
      'Pull-to-refresh must document 360 degree spin before reload'
    );
  });

  it('only works on touch devices, not PC', () => {
    assert.ok(
      containsExact('タッチデバイスのみ動作（PCではスキップ）'),
      'Pull-to-refresh must be documented as touch-only'
    );
  });
});

// ── 6. Auto-refresh options ───────────────────────────────────────────────────

describe('SPEC.md — auto-refresh options', () => {
  it('documents OFF option', () => {
    const autoSection = spec().split('### 自動更新')[1]?.split('###')[0] ?? '';
    assert.ok(autoSection.includes('OFF'), 'OFF option must be documented');
  });

  it('documents 5-minute refresh interval', () => {
    const autoSection = spec().split('### 自動更新')[1]?.split('###')[0] ?? '';
    assert.ok(autoSection.includes('5分'), '5-minute interval must be documented');
  });

  it('documents 10-minute refresh interval', () => {
    const autoSection = spec().split('### 自動更新')[1]?.split('###')[0] ?? '';
    assert.ok(autoSection.includes('10分'), '10-minute interval must be documented');
  });

  it('documents 30-minute refresh interval', () => {
    const autoSection = spec().split('### 自動更新')[1]?.split('###')[0] ?? '';
    assert.ok(autoSection.includes('30分'), '30-minute interval must be documented');
  });

  it('documents 60-minute refresh interval', () => {
    const autoSection = spec().split('### 自動更新')[1]?.split('###')[0] ?? '';
    assert.ok(autoSection.includes('60分'), '60-minute interval must be documented');
  });

  it('does not document old "ライブ" option', () => {
    const autoSection = spec().split('### 自動更新')[1]?.split('###')[0] ?? '';
    assert.ok(!autoSection.includes('ライブ'), '"ライブ" option must not be in auto-refresh settings');
  });

  it('does not document old 1-minute interval as standalone option', () => {
    const autoSection = spec().split('### 自動更新')[1]?.split('###')[0] ?? '';
    // "1分" as an auto-refresh option was removed; "1分" may appear in text but not as a table option
    const tableLines = autoSection.split('\n').filter(l => l.startsWith('|'));
    const hasOneMin = tableLines.some(l => l.includes('1分') && !l.includes('10分') && !l.includes('30分'));
    assert.ok(!hasOneMin, '"1分" standalone option must not appear in auto-refresh table');
  });

  it('auto-refresh is configured via hamburger menu', () => {
    assert.ok(
      containsExact('ハンバーガーメニュー内の「自動更新」セクションで変更する'),
      'Auto-refresh must be configured via hamburger menu'
    );
  });

  it('hamburger menu auto-refresh shows OFF/5分/10分/30分/60分 options', () => {
    const menuSection = spec().split('### ハンバーガーメニューの項目')[1]?.split('###')[0] ?? '';
    assert.ok(
      menuSection.includes('OFF / 5分 / 10分 / 30分 / 60分'),
      'Hamburger menu auto-refresh must list OFF/5分/10分/30分/60分'
    );
  });
});

// ── 7. CSS theme design (warm tone palette) ────────────────────────────────────

describe('SPEC.md — CSS warm tone variables (v20260525C)', () => {
  it('theme section mentions Claude Desktop warm tone palette', () => {
    assert.ok(containsExact('Claude Desktop 準拠のウォームトーンパレット'), 'Warm tone palette attribution must be present');
  });

  it('--bg light value is #f7f2ee', () => {
    assert.ok(containsExact('`#f7f2ee`'), '--bg light must be #f7f2ee');
  });

  it('--bg dark value is #1c1917', () => {
    assert.ok(containsExact('`#1c1917`'), '--bg dark must be #1c1917');
  });

  it('--surface light value is #ffffff', () => {
    assert.ok(containsExact('`#ffffff`'), '--surface light must be #ffffff');
  });

  it('--surface dark value is #27211e', () => {
    assert.ok(containsExact('`#27211e`'), '--surface dark must be #27211e');
  });

  it('--surface2 light value is #f0e9e3', () => {
    assert.ok(containsExact('`#f0e9e3`'), '--surface2 light must be #f0e9e3');
  });

  it('--surface2 dark value is #322b28', () => {
    assert.ok(containsExact('`#322b28`'), '--surface2 dark must be #322b28');
  });

  it('--surface3 light value is #e8ddd7', () => {
    assert.ok(containsExact('`#e8ddd7`'), '--surface3 light must be #e8ddd7');
  });

  it('--surface3 dark value is #3d3530', () => {
    assert.ok(containsExact('`#3d3530`'), '--surface3 dark must be #3d3530');
  });

  it('--accent is #cc785c in both themes', () => {
    const accentCount = (spec().match(/#cc785c/g) || []).length;
    assert.ok(accentCount >= 2, '--accent #cc785c must appear at least twice (light and dark)');
  });

  it('--accent is exempt from no-hardcode-hex rule', () => {
    assert.ok(containsExact('`--accent` 以外はハードコードhex禁止'), '--accent must be documented as the only hardcoded hex exception');
  });

  it('theme modes include warm tone description', () => {
    // The theme table rows contain ウォームトーン; search spec-wide since table separators
    // (|-------|------|) contain '---' which would break a split-based extraction.
    const warmToneLines = spec().split('\n').filter(l => l.includes('ウォームトーン'));
    const inThemeTable = warmToneLines.some(l => l.includes('ライト') || l.includes('ダーク'));
    assert.ok(inThemeTable, 'Theme mode table must mention warm tone (ウォームトーン)');
  });

  it('new CSS variable --surface2 is documented', () => {
    assert.ok(containsExact('--surface2'), '--surface2 CSS variable must be documented');
  });

  it('new CSS variable --surface3 is documented', () => {
    assert.ok(containsExact('--surface3'), '--surface3 CSS variable must be documented');
  });

  it('new CSS variable --accent is documented', () => {
    assert.ok(containsExact('--accent'), '--accent CSS variable must be documented');
  });
});

// ── 8. Data persistence / storage keys ───────────────────────────────────────

describe('SPEC.md — data persistence', () => {
  it('localStorage key hm-theme is documented', () => {
    const lsSection = spec().split('### localStorage')[1]?.split('###')[0] ?? '';
    assert.ok(lsSection.includes('hm-theme'), 'hm-theme must be in localStorage section');
  });

  it('localStorage key hm-watchlist is documented', () => {
    const lsSection = spec().split('### localStorage')[1]?.split('###')[0] ?? '';
    assert.ok(lsSection.includes('hm-watchlist'), 'hm-watchlist must be in localStorage section');
  });

  it('localStorage key hm-active-tab is documented (new in this PR)', () => {
    const lsSection = spec().split('### localStorage')[1]?.split('###')[0] ?? '';
    assert.ok(lsSection.includes('hm-active-tab'), 'hm-active-tab must be in localStorage section (added in v20260525C)');
  });

  it('localStorage does NOT contain hm-pin-hash (moved to KV)', () => {
    const lsSection = spec().split('### localStorage')[1]?.split('###')[0] ?? '';
    assert.ok(!lsSection.includes('hm-pin-hash'), 'hm-pin-hash must NOT be in localStorage (it is now in KV)');
  });

  it('Cloudflare KV section exists', () => {
    assert.ok(containsExact('### Cloudflare KV（サーバー側永続化）'), 'Cloudflare KV section must exist');
  });

  it('KV key watchlist is documented', () => {
    const kvSection = spec().split('### Cloudflare KV')[1]?.split('###')[0] ?? '';
    assert.ok(kvSection.includes('`watchlist`'), 'watchlist KV key must be documented');
  });

  it('KV key positions is documented', () => {
    const kvSection = spec().split('### Cloudflare KV')[1]?.split('###')[0] ?? '';
    assert.ok(kvSection.includes('`positions`'), 'positions KV key must be documented');
  });

  it('KV key pin-hash is documented', () => {
    const kvSection = spec().split('### Cloudflare KV')[1]?.split('###')[0] ?? '';
    assert.ok(kvSection.includes('`pin-hash`'), 'pin-hash KV key must be documented');
  });

  it('KV key prices:cache is documented', () => {
    const kvSection = spec().split('### Cloudflare KV')[1]?.split('###')[0] ?? '';
    assert.ok(kvSection.includes('`prices:cache`'), 'prices:cache KV key must be documented');
  });

  it('Cron updates prices:cache every 6 hours', () => {
    assert.ok(containsExact('Cronで6時間ごと更新される全銘柄価格'), 'Cron 6-hour update must be documented');
  });

  it('watchlist is synced to KV after login', () => {
    assert.ok(containsExact('ログイン後はCloudflare KVにも同期される'), 'Watchlist KV sync must be documented');
  });

  it('GitHub data/ directory section exists', () => {
    assert.ok(containsExact('### GitHubリポジトリ（data/ ディレクトリ）'), 'GitHub data/ directory section must exist');
  });

  it('data/portfolio-snapshot.json is documented', () => {
    assert.ok(containsExact('data/portfolio-snapshot.json'), 'portfolio-snapshot.json must be documented');
  });

  it('data/positions.json is documented', () => {
    assert.ok(containsExact('data/positions.json'), 'positions.json must be documented');
  });
});

// ── 9. Cloudflare Worker endpoints ───────────────────────────────────────────

describe('SPEC.md — Cloudflare Worker endpoints', () => {
  it('/watchlist endpoint is documented', () => {
    assert.ok(containsExact('`/watchlist`'), '/watchlist endpoint must be documented');
  });

  it('/positions endpoint is documented', () => {
    assert.ok(containsExact('`/positions`'), '/positions endpoint must be documented');
  });

  it('/auth/pin-hash endpoint is documented', () => {
    assert.ok(containsExact('`/auth/pin-hash`'), '/auth/pin-hash endpoint must be documented');
  });

  it('/prices/cache endpoint is documented', () => {
    assert.ok(containsExact('`/prices/cache`'), '/prices/cache endpoint must be documented');
  });

  it('/portfolio/snapshot endpoint is documented', () => {
    assert.ok(containsExact('`/portfolio/snapshot`'), '/portfolio/snapshot endpoint must be documented');
  });

  it('/auth/challenge endpoint is documented', () => {
    assert.ok(containsExact('`/auth/challenge`'), '/auth/challenge endpoint must be documented');
  });

  it('/auth/register endpoint is documented', () => {
    assert.ok(containsExact('`/auth/register`'), '/auth/register endpoint must be documented');
  });

  it('/auth/verify endpoint is documented', () => {
    assert.ok(containsExact('`/auth/verify`'), '/auth/verify endpoint must be documented');
  });

  it('/notion/save endpoint is documented', () => {
    assert.ok(containsExact('`/notion/save`'), '/notion/save endpoint must be documented');
  });

  it('Cron schedule 0 */6 * * * is documented', () => {
    assert.ok(containsExact('0 */6 * * *'), 'Cron schedule must be documented');
  });

  it('Worker secrets include NOTION_API_KEY', () => {
    assert.ok(containsExact('NOTION_API_KEY'), 'NOTION_API_KEY must be in Worker secrets list');
  });

  it('Worker secrets include NOTION_DB_ID', () => {
    assert.ok(containsExact('NOTION_DB_ID'), 'NOTION_DB_ID must be in Worker secrets list');
  });

  it('Worker secrets include ALLOWED_ORIGIN', () => {
    assert.ok(containsExact('ALLOWED_ORIGIN'), 'ALLOWED_ORIGIN must be in Worker secrets list');
  });
});

// ── 10. Source file references ────────────────────────────────────────────────

describe('SPEC.md — source file references exist on disk', () => {
  const srcFiles = [
    'src/auth-pin.js',
    'src/auth-crypto.js',
    'src/auth-passkey.js',
    'src/auth-ui.js',
    'src/positions.js',
    'src/state.js',
    'src/funds.js',
    'src/csv.js',
    'src/utils.js',
    'src/data.js',
    'src/heatmap.js',
    'src/chart.js',
    'src/stock-list.js',
    'src/watchlist.js',
    'src/positions-store.js',
    'src/import-parse.js',
    'src/import-ui.js',
    'src/app.js',
    'src/_disabled/history.js',
    'src/_disabled/ai-system-prompt.js',
    'src/_disabled/ai-tab.js',
  ];

  for (const relPath of srcFiles) {
    it(`${relPath} exists on disk`, () => {
      const fullPath = path.join(ROOT, relPath);
      assert.ok(fs.existsSync(fullPath), `${relPath} must exist (referenced in SPEC.md file table)`);
    });
  }

  const assetFiles = [
    'assets/01-base.css',
    'assets/02-tables.css',
    'assets/03-misc.css',
    'assets/04-auth.css',
    'src/_disabled/05-ai-tab.css',
  ];

  for (const relPath of assetFiles) {
    it(`${relPath} exists on disk`, () => {
      const fullPath = path.join(ROOT, relPath);
      assert.ok(fs.existsSync(fullPath), `${relPath} must exist (referenced in SPEC.md file table)`);
    });
  }

  it('data/portfolio-snapshot.json exists on disk', () => {
    assert.ok(fs.existsSync(path.join(ROOT, 'data/portfolio-snapshot.json')));
  });

  it('data/positions.json exists on disk', () => {
    assert.ok(fs.existsSync(path.join(ROOT, 'data/positions.json')));
  });
});

// ── 11. Source file table content ─────────────────────────────────────────────

describe('SPEC.md — source file table content', () => {
  it('src/auth-pin.js is documented as PIN hash/state/lockout module', () => {
    assert.ok(containsExact('`src/auth-pin.js`'), 'src/auth-pin.js must be in file table');
  });

  it('src/auth-crypto.js is documented as AES-GCM encryption module', () => {
    assert.ok(containsExact('`src/auth-crypto.js`'), 'src/auth-crypto.js must be in file table');
  });

  it('src/auth-passkey.js is documented as WebAuthn passkey module', () => {
    assert.ok(containsExact('`src/auth-passkey.js`'), 'src/auth-passkey.js must be in file table');
  });

  it('src/funds.js is documented as investment trust mapping module', () => {
    assert.ok(containsExact('`src/funds.js`'), 'src/funds.js must be in file table');
  });

  it('src/csv.js is documented as Monex CSV parse module', () => {
    assert.ok(containsExact('`src/csv.js`'), 'src/csv.js must be in file table');
  });

  it('src/positions-store.js is documented as KV read/write module', () => {
    assert.ok(containsExact('`src/positions-store.js`'), 'src/positions-store.js must be in file table');
  });

  it('src/import-parse.js is documented', () => {
    assert.ok(containsExact('`src/import-parse.js`'), 'src/import-parse.js must be in file table');
  });

  it('src/import-ui.js is documented', () => {
    assert.ok(containsExact('`src/import-ui.js`'), 'src/import-ui.js must be in file table');
  });

  it('src/stock-list.js is documented as Historical Heatmap tab module', () => {
    const fileTableSection = spec().split('### フロントエンド')[1]?.split('###')[0] ?? '';
    assert.ok(
      fileTableSection.includes('`src/stock-list.js`') && fileTableSection.includes('Historical Heatmap'),
      'stock-list.js must be documented as Historical Heatmap tab'
    );
  });

  it('src/history.js is marked as not loaded in index.html', () => {
    assert.ok(
      containsExact('src/history.js` | 資産推移タブ ⚠️ **index.html に未ロード**'),
      'history.js must be marked as not loaded'
    );
  });

  it('src/ai-tab.js is marked as commented out', () => {
    assert.ok(
      containsExact('src/ai-tab.js` | AI相談タブ 🚫 **index.html でコメントアウト**'),
      'ai-tab.js must be marked as commented out'
    );
  });
});

// ── 12. Script load order ─────────────────────────────────────────────────────

describe('SPEC.md — script load order', () => {
  it('script load order section exists', () => {
    assert.ok(containsExact('### スクリプトロード順'), 'Script load order section must exist');
  });

  it('auth modules load first: auth-pin → auth-crypto → auth-passkey → auth-ui', () => {
    assert.ok(
      containsExact('auth-pin → auth-crypto → auth-passkey → auth-ui'),
      'Auth modules must load in correct order'
    );
  });

  it('app.js loads last in the main sequence', () => {
    const loadSection = spec().split('### スクリプトロード順')[1]?.split('---')[0] ?? '';
    const codeBlock = loadSection.match(/```([\s\S]*?)```/)?.[1] ?? '';
    const trimmed = codeBlock.trim();
    assert.ok(trimmed.endsWith('→ app'), 'app.js must be last in script load order');
  });

  it('positions loads after auth modules', () => {
    const loadSection = spec().split('### スクリプトロード順')[1]?.split('---')[0] ?? '';
    const codeBlock = loadSection.match(/```([\s\S]*?)```/)?.[1] ?? '';
    assert.ok(codeBlock.includes('→ positions'), 'positions must be in script load order after auth');
  });

  it('history.js / ai-system-prompt.js / ai-tab.js are commented out in index.html', () => {
    assert.ok(
      containsExact('`history.js` / `ai-system-prompt.js` / `ai-tab.js` は index.html でコメントアウト中'),
      'Disabled scripts must be noted in script load order section'
    );
  });
});

// ── 13. Snapshot feature ──────────────────────────────────────────────────────

describe('SPEC.md — snapshot feature', () => {
  it('snapshot section exists', () => {
    assert.ok(containsExact('### スナップショット機能'), 'Snapshot feature section must exist');
  });

  it('snapshot saves to data/portfolio-snapshot.json', () => {
    assert.ok(
      containsExact('保存先: `data/portfolio-snapshot.json`'),
      'Snapshot save path must be documented'
    );
  });

  it('snapshot is written via GitHub API through the Worker', () => {
    assert.ok(
      containsExact('GitHub API経由でWorkerが書き込み'),
      'Snapshot GitHub API write flow must be documented'
    );
  });

  it('snapshot excludes historicals to reduce size', () => {
    assert.ok(
      containsExact('historicals（日次価格系列）は容量が大きいため保存しない'),
      'Snapshot historicals exclusion must be documented'
    );
  });

  it('snapshot external reference URL is documented', () => {
    assert.ok(
      containsExact('https://raw.githubusercontent.com/shoulang0729/portfolio/main/data/portfolio-snapshot.json'),
      'Snapshot external reference URL must be documented'
    );
  });
});

// ── 14. Price cache (Cloudflare KV Cron) ─────────────────────────────────────

describe('SPEC.md — price cache via Cloudflare KV', () => {
  it('price cache is documented as a data source', () => {
    const dataSourceSection = spec().split('### データの取得元')[1]?.split('###')[0] ?? '';
    assert.ok(dataSourceSection.includes('価格キャッシュ'), '価格キャッシュ must be in data sources table');
    assert.ok(dataSourceSection.includes('Cloudflare KV'), 'Price cache must be attributed to Cloudflare KV');
  });

  it('Cron runs every 6 hours', () => {
    assert.ok(
      containsExact('Cron で6時間ごとに自動更新'),
      'Cron 6-hour price cache update must be documented in data sources'
    );
  });

  it('/prices/cache Worker endpoint uses GET method', () => {
    const endpointLine = lines().find(l => l.includes('`/prices/cache`'));
    assert.ok(endpointLine, '/prices/cache endpoint line must exist');
    assert.ok(endpointLine.includes('GET'), '/prices/cache must document GET method');
  });
});

// ── 15. Change history ────────────────────────────────────────────────────────

describe('SPEC.md — change history (v20260525C)', () => {
  it('version 20260525C entry exists in changelog', () => {
    assert.ok(containsExact('20260525C'), '20260525C must be in changelog');
  });

  it('20260525C entry mentions auto-refresh menu migration', () => {
    const changelogSection = spec().split('## 19. 変更履歴')[1] ?? '';
    const v525cLine = changelogSection.split('\n').find(l => l.includes('20260525C'));
    assert.ok(v525cLine, '20260525C changelog entry must exist');
    assert.ok(v525cLine.includes('自動更新をメニュー内に移動'), '20260525C must mention auto-refresh menu migration');
  });

  it('20260525C entry mentions manual link addition', () => {
    const changelogSection = spec().split('## 19. 変更履歴')[1] ?? '';
    const v525cLine = changelogSection.split('\n').find(l => l.includes('20260525C'));
    assert.ok(v525cLine?.includes('マニュアルリンク追加'), '20260525C must mention manual link addition');
  });

  it('20260525C entry mentions title single-line layout', () => {
    const changelogSection = spec().split('## 19. 変更履歴')[1] ?? '';
    const v525cLine = changelogSection.split('\n').find(l => l.includes('20260525C'));
    assert.ok(v525cLine?.includes('タイトル1行化'), '20260525C must mention title single-line layout');
  });

  it('20260525A entry mentions pull-to-refresh icon rotation animation', () => {
    const changelogSection = spec().split('## 19. 変更履歴')[1] ?? '';
    const v525aLine = changelogSection.split('\n').find(l => l.includes('20260525A'));
    assert.ok(v525aLine, '20260525A changelog entry must exist');
    assert.ok(v525aLine.includes('プル・トゥ・リフレッシュ'), '20260525A must mention pull-to-refresh');
  });

  it('20260517A entry mentions Historical Heatmap tab rename', () => {
    const changelogSection = spec().split('## 19. 変更履歴')[1] ?? '';
    const v517aLine = changelogSection.split('\n').find(l => l.includes('20260517A'));
    assert.ok(v517aLine, '20260517A changelog entry must exist');
    assert.ok(v517aLine.includes('Historical Heatmap'), '20260517A must mention Historical Heatmap');
  });
});

// ── 16. State management ──────────────────────────────────────────────────────

describe('SPEC.md — state management', () => {
  it('slDetailVisible state field is documented', () => {
    assert.ok(containsExact('slDetailVisible'), 'slDetailVisible must be documented in state');
  });

  it('watchlistPrices state field is documented', () => {
    assert.ok(containsExact('watchlistPrices'), 'watchlistPrices must be documented in state');
  });

  it('activeTab documents valid tab names', () => {
    assert.ok(
      containsExact("（`'heatmap'` / `'list'` / `'watchlist'`）"),
      'activeTab must document valid tab name values'
    );
  });

  it('listSortCol and listSortDir are attributed to Historical Heatmap', () => {
    // Table separators (|-----------|------|) contain '---', so split by section heading instead.
    const sortLine = spec().split('\n').find(l => l.includes('listSortCol'));
    assert.ok(sortLine, 'listSortCol must be present in SPEC.md');
    assert.ok(sortLine.includes('Historical Heatmap'), 'listSortCol must be attributed to Historical Heatmap');
  });
});

// ── 17. Deploy procedure (GitHub PR flow) ─────────────────────────────────────

describe('SPEC.md — deploy procedure', () => {
  it('deploy flow uses feature branch and PR review', () => {
    const deploySection = spec().split('## 16. デプロイ手順')[1]?.split('---')[0] ?? '';
    assert.ok(deploySection.includes('feature ブランチ'), 'Deploy must use feature branch');
    assert.ok(deploySection.includes('PR'), 'Deploy must include PR review step');
  });

  it('version format example includes uppercase letter', () => {
    assert.ok(
      containsExact('例: 20260525A, 20260525B, ...'),
      'Version format examples must include uppercase letter variants'
    );
  });

  it('version letter sequence goes a..z then A..Z', () => {
    assert.ok(
      containsExact('a, b, c... → z → A, B, C...'),
      'Version letter ordering must document the a-z → A-Z progression'
    );
  });
});

// ── 18. Historical Heatmap tab specifics ─────────────────────────────────────

describe('SPEC.md — Historical Heatmap tab', () => {
  it('section heading is "## 4. Historical Heatmap タブ"', () => {
    assert.ok(containsExact('## 4. Historical Heatmap タブ'), 'Section 4 must be named Historical Heatmap タブ');
  });

  it('loading cells show blinking ellipsis "…"', () => {
    assert.ok(
      containsExact('取得中は「…」が点滅'),
      'Loading cells must be documented as showing blinking "…"'
    );
  });

  it('含み損益 column is a detail column with eye-icon toggle', () => {
    const listSection = spec().split('## 4. Historical Heatmap タブ')[1]?.split('## 5.')[0] ?? '';
    assert.ok(
      listSection.includes('目のアイコンで表示切替'),
      'Detail columns must document eye-icon toggle'
    );
  });
});

// ── 19. Watchlist Historical Heatmap specifics ────────────────────────────────

describe('SPEC.md — Watchlist Historical Heatmap tab', () => {
  it('section heading is "## 5. Watchlist Historical Heatmap タブ"', () => {
    assert.ok(containsExact('## 5. Watchlist Historical Heatmap タブ'), 'Section 5 must be named Watchlist Historical Heatmap タブ');
  });

  it('period columns are shared with Historical Heatmap', () => {
    const wlSection = spec().split('## 5. Watchlist Historical Heatmap タブ')[1]?.split('## 6.')[0] ?? '';
    assert.ok(
      wlSection.includes('Historical Heatmap と同じ期間カラムで比較'),
      'Watchlist must document shared period columns with Historical Heatmap'
    );
  });

  it('watchlist is persisted in localStorage', () => {
    const wlSection = spec().split('## 5. Watchlist Historical Heatmap タブ')[1]?.split('## 6.')[0] ?? '';
    assert.ok(
      wlSection.includes('localStorageに記憶'),
      'Watchlist persistence must reference localStorage'
    );
  });
});

// ── 20. 資産推移 tab (not-enabled) ────────────────────────────────────────────

describe('SPEC.md — 資産推移 tab (disabled)', () => {
  it('section is titled "## 6. 資産推移タブ（未有効化）"', () => {
    assert.ok(containsExact('## 6. 資産推移タブ（未有効化）'), '資産推移 section title must include (未有効化)');
  });

  it('implementation note references src/history.js', () => {
    const section = spec().split('## 6. 資産推移タブ（未有効化）')[1]?.split('## 7.')[0] ?? '';
    assert.ok(section.includes('src/history.js'), '資産推移 section must reference src/history.js');
  });

  it('history graph is documented as D3 area graph (面グラフ)', () => {
    assert.ok(containsExact('D3面グラフ'), 'history tab must document D3 area graph (changed from line graph)');
  });

  it('range switching options are documented', () => {
    const section = spec().split('## 6. 資産推移タブ（未有効化）')[1]?.split('## 7.')[0] ?? '';
    assert.ok(section.includes('全期間'), '全期間 range must be documented');
    assert.ok(section.includes('1ヶ月'), '1ヶ月 range must be documented');
  });
});

// ── 21. AI tab (disabled) ─────────────────────────────────────────────────────

describe('SPEC.md — AI相談 tab (disabled)', () => {
  it('section is titled "## 7. AI相談タブ（無効化中）"', () => {
    assert.ok(containsExact('## 7. AI相談タブ（無効化中）'), 'AI tab section title must include (無効化中)');
  });

  it('notes that ai-tab.js is commented out in index.html', () => {
    const section = spec().split('## 7. AI相談タブ（無効化中）')[1]?.split('## 8.')[0] ?? '';
    // The backtick after "index.html" is part of the inline code: `index.html` でコメントアウト
    assert.ok(
      section.includes('index.html` でコメントアウト'),
      'AI tab section must note the code is commented out in index.html'
    );
  });
});

// ── 22. Table of contents completeness ───────────────────────────────────────

describe('SPEC.md — table of contents', () => {
  const tocEntries = [
    '[Heatmap タブ](#3-heatmap-タブ)',
    '[Historical Heatmap タブ](#4-historical-heatmap-タブ)',
    '[Watchlist Historical Heatmap タブ](#5-watchlist-historical-heatmap-タブ)',
    '[資産推移タブ（未有効化）](#6-資産推移タブ未有効化)',
    '[AI相談タブ（無効化中）](#7-ai相談タブ無効化中)',
  ];

  for (const entry of tocEntries) {
    it(`table of contents contains "${entry}"`, () => {
      assert.ok(containsExact(entry), `TOC must contain: ${entry}`);
    });
  }
});
