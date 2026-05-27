# アーキテクチャ

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Vanilla JS (ES Modules) + D3.js v7 |
| スタイル | CSS カスタムプロパティ（ダーク/ライト/オート）|
| ホスティング | GitHub Pages |
| バックエンド | Cloudflare Worker |
| データ永続化 | Cloudflare KV（ウォッチリスト・保有銘柄・PIN ハッシュ）|
| 認証 | PIN (SHA-256) + WebAuthn パスキー（Touch ID / Face ID）|
| PWA | Service Worker（オフラインキャッシュ）|

---

## データフロー

```
ブラウザ
  │
  ├─ Finnhub API（優先）
  │    └─ Cloudflare Worker /finnhub プロキシ（APIキー隠蔽）
  │
  ├─ Yahoo Finance API（フォールバック）
  │    └─ Cloudflare Worker /yahoo プロキシ（CORS 回避）
  │
  └─ Cloudflare KV（保有銘柄・ウォッチリスト・PIN ハッシュ）
       └─ Worker /positions, /watchlist, /auth/pin-hash
```

フォールバック順（Yahoo Finance）:
```
Worker 経由 → query1 直接 → query2 直接 → corsproxy.io → allorigins
```

---

## Worker ルート一覧

| メソッド | パス | 用途 |
|---|---|---|
| GET | `/yahoo?url=` | Yahoo Finance プロキシ |
| GET | `/finnhub?path=` | Finnhub プロキシ |
| GET/PUT | `/positions` | 保有銘柄 KV 同期 |
| GET/PUT | `/watchlist` | ウォッチリスト KV 同期 |
| PUT | `/auth/pin-hash` | PIN ハッシュ更新 |
| GET | `/prices/cache` | Cron 価格キャッシュ取得 |
| POST | `/portfolio/snapshot` | スナップショット → GitHub API |
| POST | `/ai/*` | AI プロキシ（OpenAI / Gemini / Grok / DeepSeek / Claude）|
| GET/POST | `/auth/challenge`, `/auth/register`, `/auth/verify` | パスキー認証 |

Cron: `0 */6 * * *`（6時間ごとに全保有銘柄の価格を KV キャッシュ）

---

## ファイル構成（主要）

```
src/
  positions.js      ← 保有銘柄データの唯一の定義元（ここだけ編集）
  state.js          ← アプリ状態・定数
  data.js           ← API 通信（Finnhub / Yahoo Finance）
  heatmap.js        ← D3 ヒートマップ描画
  stock-list.js     ← Historical Heatmap タブ
  watchlist.js      ← Watchlist Historical Heatmap タブ
  app.js            ← エントリーポイント・data-action ディスパッチャ

worker/src/index.js ← Cloudflare Worker 本体
sw.js               ← Service Worker（PWA オフラインキャッシュ）
```

---

## 認証フロー

```
起動
 └─ sessionStorage に enc鍵あり？
     ├─ Yes → 自動ログイン（_restoreEncKey）
     └─ No  → PIN 画面表示
               └─ PIN 照合成功 → AES-GCM 鍵導出（_deriveEncKey）
                               → sessionStorage に保存
```

パスキー登録後は、次回起動時に Face ID / Touch ID シートが自動起動します。

---

## GitHub Actions

| ワークフロー | トリガー | 内容 |
|---|---|---|
| `test.yml` | push / PR | vitest 単体テスト（15件） |
| `daily-issues.yml` | 毎日 9:00 JST / 手動 | open issues を Claude Code で自動修正 → PR 作成 |
