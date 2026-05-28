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

```bash
npm install
npm test        # vitest
npm run lint    # eslint
npm run build   # esbuild → dist/app.js
```

## ドキュメント

- 設計・引き継ぎ情報: [CLAUDE.md](./CLAUDE.md)
- 機能仕様（中国語）: [docs/SPEC_cn.md](./docs/SPEC_cn.md)
- ルーティン定義: [docs/routine_japan_1700.md](./docs/routine_japan_1700.md) / [docs/routine_us_0600.md](./docs/routine_us_0600.md)

## ライセンス

Private project. All rights reserved.
