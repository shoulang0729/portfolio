# Portfolio Heatmap — Agent 向けプロジェクト情報

## プロジェクト概要

**Portfolio Heatmap** は、Finnhub API（優先）+ Yahoo Finance API（フォールバック）を使ったポートフォリオ可視化 Web アプリケーション。

- **本番 URL**: https://shoulang0729.github.io/portfolio/
- **ホスティング**: GitHub Pages
- **バックエンド**: Cloudflare Workers（KV ストレージ + API プロキシ）
- **フロントエンド**: Vanilla JS (ESM) + D3.js（CDN 読込）
- **現在バージョン**: v20260529I

### 主要機能
- **Heatmap**: ポートフォリオの現在値を色分けヒートマップで表示
- **Historical Heatmap**: 銘柄ごとの期間別騰落率表示
- **Watchlist Historical Heatmap**: ウォッチリスト管理と期間別パフォーマンス追跡

---

## セットアップ

### 初回セットアップ

```bash
# 依存関係のインストール
npm install

# E2E テスト用 Playwright ブラウザのインストール（初回必須）
npx playwright install --with-deps chromium
# または
npm run test:e2e:setup
```

### 環境変数・秘密情報
- **APIキー**: すべて Cloudflare Worker Secrets に管理（フロントエンド露出なし）
- 必要な Secrets:
  - `FINNHUB_API_KEY`
  - `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROK_API_KEY`, `DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`
  - `NOTION_API_KEY`, `NOTION_DB_ID`
  - `ALLOWED_ORIGIN`

---

## テスト・リント・ビルドコマンド

### テスト実行

```bash
# 単体テスト（vitest）— CI 相当
npm test

# ウォッチモード
npm run test:watch

# カバレッジレポート
npm run test:coverage

# E2E テスト（Playwright）
npm run test:e2e
```

### コード品質チェック

```bash
# ESLint でコード検査（src/ と worker/src/）
npm run lint

# 自動修正
npm run lint:fix

# Prettier でフォーマット
npm run format

# 型チェック（opt-in: // @ts-check 付きファイルのみ）
npm run check:types

# 循環参照の検出
npm run check:circular

# 未使用依存の検出
npm run check:deps
```

### ビルド

```bash
# esbuild でバンドル（D3 は external）
npm run build

# ウォッチモード
npm run build:watch
```

---

## ディレクトリ構成

```
/
├── index.html              # GitHub Pages エントリーポイント
├── CLAUDE.md               # Claude Code 引き継ぎ情報（詳細な設計情報）
├── AGENTS.md               # このファイル
├── package.json            # npm スクリプト・devDependencies
├── src/                    # フロントエンド JS（ESM）
│   ├── app.js              # メインアプリケーション
│   ├── data-finnhub.js     # Finnhub API 関数
│   ├── data-yahoo.js       # Yahoo Finance API 関数
│   ├── heatmap.js          # D3.js ヒートマップ描画
│   ├── chart.js            # D3.js チャート描画
│   ├── stock-list.js       # Historical Heatmap タブ
│   ├── watchlist.js        # Watchlist 管理タブ
│   ├── auth-pin.js         # PIN 認証ロジック
│   ├── auth-passkey.js     # WebAuthn パスキー認証
│   └── _disabled/          # 無効化中コード（history.js など）
├── assets/                 # CSS・画像・マニフェスト
│   ├── 01-base.css         # テーマ・レイアウト基本
│   ├── 02-tables.css       # テーブル・ヒートマップセル
│   ├── 03-misc.css         # タブバー・検索・バッジ
│   ├── 04-auth.css         # PIN変更ダイアログ
│   └── *.png / *.svg       # アイコン類
├── worker/                 # Cloudflare Worker
│   ├── src/index.js        # Worker 本体（API プロキシ・KV 管理）
│   └── wrangler.toml       # Worker 設定
├── data/                   # ジェネレータが生成するデータ
│   ├── portfolio-snapshot.json
│   └── positions.json
├── docs/                   # 設計書・仕様書
│   ├── SPEC_cn.md          # 機能仕様（中国語）
│   ├── DESIGN.md           # フロントエンド設計規約
│   ├── routine_japan_1700.md
│   └── routine_us_0600.md
├── tests/                  # vitest テストファイル
├── e2e/                    # Playwright E2E テスト
├── eslint.config.js        # ESLint flat config (v9)
├── vitest.config.js        # vitest 設定
├── .prettierrc              # Prettier 設定
└── .gitignore              # Git 除外ルール
```

---

## 重要な制約事項

### D3.js は CDN 読込
- **esbuild の external として指定**（バンドルに含めない）
- index.html で CDN から読込: `<script src="https://cdn.bootcdn.net/...d3.min.js">`
- npm install で d3 をインストール **しない**

### スクリプト読込順（index.html）
JavaScript ファイルは**読込順序が重要**。依存関係を保証するため以下の順序で読み込む:

```
auth → positions → state → funds → csv → utils → data-helpers
→ data-finnhub → data-yahoo → data → forex
→ heatmap → chart → stock-list → watchlist
→ positions-store → import → menu → app
```

### バージョン管理
- index.html 内の `?v=YYYYMMDDX` で全キャッシュを制御
- CSS・JS・SW 登録 URL のすべてを同じバージョンに揃える
- Service Worker の `CACHE` 名は URL の `?v=` から自動生成

### セキュリティ
- **Content Security Policy (CSP)**: meta タグで実装
- **ユーザー入力エスケープ**: `escapeHTML()` で XSS 対策（utils.js）
- **APIキー隠蔽**: Cloudflare Secrets 利用（フロント露出なし）

---

## 開発時の注意点

### data-action イベント委譲
```html
<!-- HTML に data-action を付ける -->
<button data-action="funcName">ボタン</button>

<!-- app.js が一括ディスパッチ -->
document.addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action) callFunctionByName(action);
});
```

### テーブルソート
- `state.listSortCol` / `state.listSortDir` で状態管理
- Comparator は等値で 0 を返す（antisymmetric）
- 文字列は `localeCompare('ja')` 使用

### IndexedDB キャッシュ
- `cache.js`: メモリ + IndexedDB 統合キャッシュ
- `historical-cache.js`: 履歴データ専用

### Cloudflare Worker ルート（主要）
```
GET  /yahoo?url=<encoded>           # Yahoo Finance プロキシ
GET  /finnhub?path=<path>&...       # Finnhub プロキシ（APIキー隠蔽）
GET  /forex?from=<from>&to=<to>    # 為替レート
POST /portfolio/snapshot            # スナップショット保存
GET  /positions                     # 保有銘柄取得（KV）
PUT  /positions                     # 保有銘柄保存（PIN 認証必須）
```

---

## よくある作業

### 保有銘柄を編集
`src/positions.js` の `positions` 配列を編集するだけ。他ファイルの変更は不要。

### バージョンを上げる
index.html 内の `?v=YYYYMMDDX` を全置換する。
```bash
# 例: v=20260529I → v=20260530A
```

### 新しい E2E テストケースを追加
`e2e/` 配下に Playwright テストを作成:
```bash
npm run test:e2e
```

### 型チェックを有効化
```javascript
// @ts-check  ← ファイル先頭に追加
```

---

## CI / デプロイ

### GitHub Actions
- `.github/workflows/test.yml`: push/PR 時にテスト・リント・型チェック・E2E 実行
- `.github/workflows/daily-issues.yml`: 毎日 0:00 UTC に open issues を自動修正

### デプロイ手順
```bash
# 1. index.html のバージョンを更新
# 2. git commit & push
# 3. GitHub Pages に自動反映（GitHub Actions で dist/app.js を自動ビルド）
```

### Worker デプロイ
```bash
cd worker
npx wrangler deploy
```

---

## 詳細情報

**詳細な設計情報・引き継ぎ情報は [CLAUDE.md](./CLAUDE.md) を参照してください。**

- プロジェクト引き継ぎ情報
- 全モジュール説明
- データソース設計（Finnhub / Yahoo Finance）
- セキュリティ・アクセシビリティ規約
- よくある質問への対応方法
