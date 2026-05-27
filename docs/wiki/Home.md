# Portfolio Manager — Wiki

日米の保有株式・投資信託をリアルタイムで可視化するプライベートツールのドキュメント。

- **本番 URL**: https://shoulang0729.github.io/portfolio/
- **GitHub**: https://github.com/shoulang0729/portfolio

---

## 機能概要

| タブ | 概要 | 状態 |
|------|------|------|
| **Heatmap** | 保有銘柄を時価評価額の大きさで並べた色付きマップ | ✅ 有効 |
| **Historical Heatmap** | 保有銘柄の詳細テーブル（ソート・期間別騰落率） | ✅ 有効 |
| **Watchlist Historical Heatmap** | 保有外の気になる銘柄を追加・監視 | ✅ 有効 |
| **資産推移** | 日次の総資産額をグラフで記録・表示 | ⚠️ 未有効化 |
| **AI相談** | 5つのAIに同時に投資相談できる | 🚫 無効化中 |

---

## ページ一覧

### ユーザー向け

| ページ | 内容 |
|--------|------|
| [Getting Started](Getting-Started) | アクセス方法・ログイン・銘柄更新・ウォッチリスト・スナップショット |
| [Specification](Specification) | アプリ全機能の詳細仕様（外部設計・内部設計・運用） |

### 開発者向け

| ページ | 内容 |
|--------|------|
| [Architecture](Architecture) | システム構成・データフロー・Worker ルート・認証フロー・GitHub Actions |
| [Development Setup](Development-Setup) | ローカル環境構築・テスト・リント・デプロイ・Worker デプロイ |
| [Claude Code Guide](Claude-Code-Guide) | Claude Code 引き継ぎ情報・設計ルール・よくある作業パターン |

---

## 技術スタック

| 種別 | 技術 |
|------|------|
| フロントエンド | HTML / CSS / Vanilla JS / D3.js |
| ホスティング | GitHub Pages |
| バックエンド | Cloudflare Workers |
| データソース | Finnhub API（優先）/ Yahoo Finance API（フォールバック） |
| 認証 | 4桁PIN（SHA-256）/ WebAuthn パスキー |
| PWA | Service Worker + Web App Manifest |
| CI | GitHub Actions（vitest / ESLint） |
