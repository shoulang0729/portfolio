# Portfolio Heatmap

Finnhub + Yahoo Finance API を使ったポートフォリオ可視化 Web アプリ。

## Live

https://shoulang0729.github.io/portfolio/

## 概要

3 タブ構成: Heatmap / Historical Heatmap / Watchlist Historical Heatmap

## 技術スタック

- フロントエンド: Vanilla JS (ESM) + D3.js
- ビルド: esbuild
- テスト: vitest
- リント: ESLint (flat config) + Prettier
- バックエンド: Cloudflare Workers (KV ストレージ + 各種 API プロキシ)
- ホスティング: GitHub Pages

## 開発

### セットアップ

```bash
npm install
npx playwright install --with-deps chromium  # E2E テスト用（初回必須）
```

### 利用可能なコマンド

```bash
npm test               # vitest で単体テスト実行
npm run lint          # ESLint でコード検査
npm run lint:fix      # ESLint で自動修正
npm run format        # Prettier でコード整形
npm run build         # esbuild でバンドル → dist/app.js
npm run build:watch   # watch モード
npm run test:e2e      # Playwright で E2E テスト実行
npm run test:e2e:setup # Playwright ブラウザをインストール
npm run check:types   # TypeScript で型チェック
npm run check:circular # 循環参照を検出
npm run check:deps    # 未使用依存を検出
```

## ドキュメント

- 設計・引き継ぎ情報: [CLAUDE.md](./CLAUDE.md)
- 機能仕様（中国語）: [docs/SPEC_cn.md](./docs/SPEC_cn.md)
- ルーティン定義: [docs/routine_japan_1700.md](./docs/routine_japan_1700.md) / [docs/routine_us_0600.md](./docs/routine_us_0600.md)

## ライセンス

Private project. All rights reserved.
