# Portfolio Manager — アプリ仕様書

> 最終更新: 2026-05-26 / バージョン: 20260525C

---

## 目次

**外部設計（ユーザーから見た仕様）**
1. [アプリ概要](#1-アプリ概要)
2. [共通UI仕様](#2-共通ui仕様)
3. [Heatmap タブ](#3-heatmap-タブ)
4. [Historical Heatmap タブ](#4-historical-heatmap-タブ)
5. [Watchlist Historical Heatmap タブ](#5-watchlist-historical-heatmap-タブ)
6. [資産推移タブ（未有効化）](#6-資産推移タブ未有効化)
7. [AI相談タブ（無効化中）](#7-ai相談タブ無効化中)
8. [データソースと更新仕様](#8-データソースと更新仕様)

**内部設計（実装情報）**
9. [システム構成](#9-システム構成)
10. [ファイル構成と依存関係](#10-ファイル構成と依存関係)
11. [データ取得の詳細フロー](#11-データ取得の詳細フロー)
12. [状態管理](#12-状態管理)
13. [データ永続化](#13-データ永続化)
14. [セキュリティ・認証の実装](#14-セキュリティ認証の実装)
15. [CSSテーマ設計](#15-cssテーマ設計)

**運用**
16. [デプロイ手順](#16-デプロイ手順)
17. [LLMモデルバージョンの定期メンテナンス](#17-llmモデルバージョンの定期メンテナンス)
18. [改善ロードマップ](#18-改善ロードマップ)
19. [変更履歴](#19-変更履歴)

---

# 外部設計（ユーザーから見た仕様）

---

## 1. アプリ概要

### 何をするアプリか

日米の保有株式・投資信託をリアルタイムで可視化・分析するプライベートツール。
個人投資家（保有資産 5 億円超）が自分の資産状況を素早く把握するために使う。

### アクセス情報

| 項目 | 内容 |
|------|------|
| **本番URL** | https://shoulang0729.github.io/portfolio/ |
| **ホスティング** | GitHub Pages（静的サイト） |
| **対応デバイス** | PC・スマートフォン（PWA対応。ホーム画面に追加可能） |
| **認証** | 起動時に4桁PINまたはパスキー（指紋/顔認証）で保護 |

### タブ構成

| タブ | 概要 | 状態 |
|------|------|------|
| **Heatmap** | 保有銘柄を時価評価額の大きさで並べた色付きマップ | ✅ 有効 |
| **Historical Heatmap** | 保有銘柄の詳細テーブル（ソート・期間別騰落率） | ✅ 有効 |
| **Watchlist Historical Heatmap** | 保有外の気になる銘柄を追加・監視 | ✅ 有効 |
| **資産推移** | 日次の総資産額をグラフで記録・表示 | ⚠️ 未有効化（コード実装済み） |
| **AI相談** | 5つのAIに同時に投資相談できる | 🚫 無効化中 |

---

## 2. 共通UI仕様

### ヘッダー（常時固定）

画面上部に常に表示される固定ヘッダー。スクロールしても消えない。

**左側**: アプリタイトル「Portfolio Manager」＋バージョン番号（1行に収まるサイズ）

**右側**:
- **カウントダウン**: 自動更新が有効な場合に次回更新までの残り時間を表示
- **ハンバーガーメニュー（☰）**: タップでドロップダウンメニューを開く

### ハンバーガーメニューの項目

| 項目 | 説明 | 表示条件 |
|------|------|---------|
| **自動更新** | OFF / 5分 / 10分 / 30分 / 60分 から選択 | 常時 |
| **テーマ切替** | ☼（ライト）/ ☾（ダーク）/ A（システム自動）を循環 | 常時 |
| **PIN変更** | PINコードの変更 | ログイン後のみ |
| **パスキー登録** | 指紋・顔認証の登録 | ログイン後のみ |
| **マネックス取込** | マネックス証券のCSVファイルを取込 | ログイン後のみ |
| **マネフォ取込** | マネーフォワードのスクリーンショットを取込 | ログイン後のみ |
| **銘柄を整理** | 保有銘柄の削除・整理 | ログイン後のみ |
| **スナップショット保存** | 現在のポートフォリオをGitHubに保存 | ログイン後のみ |
| **マニュアル** | 本仕様書（SPEC.md）を開く | 常時 |

### プル・トゥ・リフレッシュ（スマートフォン専用）

ページ最上部で下に引っ張ると価格が更新される。

- 引っ張り量に応じてリフレッシュアイコンが回転（0→270度）
- 閾値（72px相当）を超えると360度スピン後にリロード
- タッチデバイスのみ動作（PCではスキップ）

### ステータスライン

ヒートマップタブ下部に表示。

| 色 | 意味 |
|----|------|
| 黄 | データ取得中 |
| 緑 | 取得完了 |
| 赤 | 取得失敗 |

### 統計バー

ヘッダー直下に表示。右端の目のアイコンで表示/非表示を切替。

| 表示項目 | 内容 |
|---------|------|
| 資産総額 | 全銘柄の時価評価額の合計（円） |
| 含み損益 | 取得原価との差額（円・%） |
| 期間別損益 | 1日・1週・1ヶ月…10年の各期間の損益額と騰落率 |

> 期間別損益は「今の保有銘柄を過去にも持っていたら」という**シミュレーション値**であり、実際の運用損益ではない。

### テーマ

| モード | 動作 |
|-------|------|
| ライト | 常に白背景（ウォームトーン） |
| ダーク | 常に黒背景（ウォームトーン） |
| 自動（A） | OSのダーク/ライト設定に自動追従 |

設定はブラウザに記憶される（ページを閉じても保持）。

---

## 3. Heatmap タブ

### 画面構成

保有銘柄を**時価評価額に比例したマスの大きさ**でレイアウトし、**騰落率または含み損益率**で色付けする。

**2グループに分かれて表示**:
- 米国株・ETF（上）
- 日本株・ETF・投資信託（下）

### 色の意味（日本株の慣習に準拠）

| 色 | 意味 |
|---|------|
| 濃い赤 | 大きく上昇 |
| 薄い赤 | 小幅上昇 |
| グレー | ほぼ変動なし |
| 薄い緑 | 小幅下落 |
| 濃い緑 | 大きく下落 |

### カラーモードの切替

ヒートマップ直上の期間ボタンで切替：

| 操作 | 表示内容 |
|------|---------|
| 「1d」「1w」…「10y」ボタンをタップ | その期間の騰落率で色付け |
| 「含み損益率」ボタンをタップ | 購入時からの含み損益率で色付け |
| 「含み損益率」を再タップ | 騰落率表示に戻る |

### セルの情報

| セルサイズ | 表示内容 |
|-----------|---------|
| 大・中セル | ティッカーシンボル ＋ 騰落率（%） |
| 小セル | ティッカーシンボルのみ |
| 極小セル | 何も表示しない |

### ツールチップ（セルにカーソルを乗せると表示）

- 銘柄名・シンボル
- 現在値・平均取得単価・保有数
- 時価評価額・含み損益（円・%）
- 前日比（円・%）
- 投資信託の場合は「📊 騰落率は代替インデックスで近似」の注記

### チャートを開く

セルをクリック/タップすると、その銘柄の株価チャートがモーダルで開く。

### 価格更新時のアニメーション

自動更新または手動更新で価格が変化したとき、該当セルが一瞬光る（上昇：明るく / 下落：暗く）。

---

## 4. Historical Heatmap タブ

保有銘柄の一覧テーブルに、各期間の騰落率を色付きセルで表示する。

### テーブル列

| 列名 | 内容 | 備考 |
|------|------|------|
| ティッカー/銘柄名 | シンボルと銘柄名 | 横スクロール時も左端に固定 |
| 市場 | 東証 / US / 投信 | |
| 現在値 | 現在の株価 | |
| 1d〜10y | 各期間の騰落率（色付き） | 取得中は「…」が点滅 |
| 含み損益 | 損益額（円）（詳細列） | 目のアイコンで表示切替 |
| 損益率 | 含み損益率（%）（詳細列） | 目のアイコンで表示切替 |
| 時価評価額 | （詳細列） | 目のアイコンで表示切替 |
| 保有数 | （詳細列） | 目のアイコンで表示切替 |
| 取得単価 | （詳細列） | 目のアイコンで表示切替 |

### バーグラフ

各行の背景に時価評価額の比率を示す横棒が表示される（最大保有銘柄を100%として比較）。

### ソート

列ヘッダーをクリックするとその列で並び替え。再クリックで昇順/降順が切替わる。

---

## 5. Watchlist Historical Heatmap タブ

### できること

- **銘柄の追加**: 上部の検索欄にティッカーまたは銘柄名を入力して検索・追加
- **価格監視**: 追加した銘柄の現在値・騰落率をリアルタイムで確認
- **期間別騰落率**: Historical Heatmap と同じ期間カラムで比較
- **ソート**: 銘柄リストと同様に列ヘッダーでソート
- **削除**: 行右端の「✕」ボタンで削除

### 検索の動作

| 入力例 | 自動判定 |
|-------|---------|
| `AAPL` | 米国株として検索 |
| `7203` | 日本株（7203.T）として検索 |
| `9988` | 香港株（9988.HK）もあわせて検索 |

検索結果にはティッカー・銘柄名・市場・種別（株/ETF/投信/通貨）が表示される。

### 保存

追加した銘柄はブラウザのlocalStorageに記憶される（ページを閉じても保持）。
ログイン後はCloudflare KVにも同期される。

---

## 6. 資産推移タブ（未有効化）

> `src/history.js` として実装済みだが、`index.html` に読み込まれていないため表示されない。
> 有効化手順は CLAUDE.md を参照。

### できること（実装済み）

- **自動記録**: 価格更新が完了するたびに、その日の総資産額を自動で記録する
- **グラフ表示**: 記録された日次総資産額をD3面グラフで表示
- **レンジ切替**: 全期間 / 1ヶ月 / 3ヶ月 / 6ヶ月 / 1年
- **CSV出力**: 記録データをCSVファイルとしてダウンロード

### 記録の仕様

- 1日1レコード（同日に複数回更新しても最新値で上書き）
- 最大1,000日分を保存（約3年分）
- ブラウザのlocalStorageに保存

---

## 7. AI相談タブ（無効化中）

> `src/ai-tab.js` / `src/ai-system-prompt.js` として実装済みだが、`index.html` でコメントアウトされており表示されない。

投資に関する質問を入力すると、5つのAIが同時に回答し、最終的にClaudeが統括する。

---

## 8. データソースと更新仕様

### データの取得元

| データ種別 | 主なソース | 補足 |
|-----------|-----------|------|
| ライブ株価・当日騰落率 | Finnhub API | 失敗時はYahoo Financeへ自動切替 |
| 株価履歴（1日〜10年） | Yahoo Finance API | Finnhubはスプリット未調整のため不使用 |
| 価格キャッシュ | Cloudflare KV | Cron で6時間ごとに自動更新 |
| AI回答 | 各AIのAPI | Cloudflare Worker経由でAPIキーを保護 |

> すべてのAPI通信はバックエンドプロキシ（Cloudflare Worker）を経由する。
> これによりAPIキーがブラウザ上に露出しない。

### 自動更新

| 設定 | 動作 |
|------|------|
| OFF | 自動更新なし |
| 5分 / 10分 / 30分 / 60分 | 指定間隔で自動更新 |

設定はハンバーガーメニュー内の「自動更新」セクションで変更する。
バックグラウンド（タブ非表示）中はカウントダウンが停止し、タブに戻ると再開する。

### プル・トゥ・リフレッシュ

スマートフォンでページ最上部を下に引っ張ることで、設定に関係なく任意のタイミングで価格を更新できる。

### 為替レート

現状、USD/JPYのリアルタイム為替は取得していない。
米国株の円建て評価額は「前回価格からの価格変動比率」で更新されるため、為替変動は反映されない。

### 投資信託の扱い

Finnhub・Yahoo Financeに未収録の投資信託（ひふみ等）は、対応する代替インデックスの騰落率で近似する。ツールチップに「📊 騰落率は代替インデックスで近似」と表示される。

### スナップショット機能

メニューの「スナップショット保存」で現在のポートフォリオ全体をJSONとしてGitHubに保存できる。

- 保存先: `data/portfolio-snapshot.json`（GitHub API経由でWorkerが書き込み）
- 内容: 全銘柄の時価・損益・期間別騰落率、ウォッチリスト、集計サマリー
- 外部参照: `https://raw.githubusercontent.com/shoulang0729/portfolio/main/data/portfolio-snapshot.json`
- historicals（日次価格系列）は容量が大きいため保存しない（performance値のみ集約）

---

# 内部設計（実装情報）

---

## 9. システム構成

```
ブラウザ（GitHub Pages）
    │
    ├── 株価・AI取得 ──→ Cloudflare Worker（portfolio-proxy.shoulang.workers.dev）
    │                        ├── /yahoo         → Yahoo Finance API（CORS回避）
    │                        ├── /finnhub        → Finnhub API（APIキー隠蔽）
    │                        ├── /ai/*           → 各AI API
    │                        ├── /watchlist      → Cloudflare KV
    │                        ├── /positions      → Cloudflare KV（PIN認証必須）
    │                        ├── /auth/*         → パスキー認証
    │                        ├── /prices/cache   → Cloudflare KV（Cronキャッシュ）
    │                        └── /portfolio/snapshot → GitHub API（data/ディレクトリ更新）
    │
    └── ローカル保存
             ├── localStorage   → テーマ・ウォッチリスト・資産履歴・タブ状態
             └── sessionStorage → 認証フラグ・AES鍵・履歴価格キャッシュ
```

### Cloudflare Worker エンドポイント一覧

| エンドポイント | メソッド | 用途 |
|--------------|---------|------|
| `/yahoo?url=<encoded>` | GET | Yahoo Finance プロキシ |
| `/finnhub?path=<path>&<params>` | GET | Finnhub プロキシ |
| `/ai/openai` | POST | OpenAI プロキシ |
| `/ai/gemini` | POST | Gemini プロキシ |
| `/ai/grok` | POST | Grok プロキシ |
| `/ai/deepseek` | POST | DeepSeek プロキシ |
| `/ai/claude` | POST | Anthropic プロキシ |
| `/watchlist` | GET / PUT | ウォッチリスト取得・保存（KV） |
| `/positions` | GET / PUT | 保有銘柄取得・保存（KV・PIN認証必須） |
| `/auth/pin-hash` | PUT | PIN ハッシュ更新（KV） |
| `/prices/cache` | GET | Cronキャッシュ価格取得（KV） |
| `/portfolio/snapshot` | POST | スナップショット → GitHub API で `data/portfolio-snapshot.json` 更新 |
| `/notion/save` | POST | AI相談結果をNotion DBに保存 |
| `/auth/challenge` | GET | パスキー認証チャレンジ生成 |
| `/auth/register` | POST | パスキー登録 |
| `/auth/verify` | POST | パスキー検証 |

**Cron**: `0 */6 * * *` — 6時間ごとに全保有銘柄の価格を取得してKVキャッシュ

Worker の環境変数（Cloudflare Secrets）:
`FINNHUB_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` / `GROK_API_KEY` / `DEEPSEEK_API_KEY` / `ANTHROPIC_API_KEY` / `NOTION_API_KEY` / `NOTION_DB_ID` / `ALLOWED_ORIGIN`

---

## 10. ファイル構成と依存関係

### フロントエンド（GitHub Pages）

| ファイル | 役割 |
|---------|------|
| `index.html` | HTML骨格・スクリプトロード順制御 |
| `src/auth-pin.js` | PIN ハッシュ・状態・ロックアウト |
| `src/auth-crypto.js` | AES-GCM 暗号化 |
| `src/auth-passkey.js` | WebAuthn パスキー |
| `src/auth-ui.js` | PINログイン・変更ダイアログ UI |
| `src/positions.js` | 保有銘柄データ・PERIODS 定義（編集はここだけ） |
| `src/state.js` | グローバル定数(C)・アプリ状態(state) |
| `src/funds.js` | 投資信託マッピング（FUND_DEFS） |
| `src/csv.js` | マネックスCSVパース |
| `src/utils.js` | フォーマッター・色計算・テーブルヘルパー |
| `src/data.js` | API通信・価格取得・履歴キャッシュ |
| `src/heatmap.js` | D3.js ツリーマップ描画 |
| `src/chart.js` | D3.js 個別銘柄チャート（モーダル） |
| `src/stock-list.js` | Historical Heatmap タブ（テーブル・ソート・バーグラフ） |
| `src/watchlist.js` | Watchlist Historical Heatmap タブ |
| `src/positions-store.js` | KV保存/読込・差分計算 |
| `src/import-parse.js` | マネックスCSV/マネフォ画像パース |
| `src/import-ui.js` | 取込モーダルUI |
| `src/app.js` | 初期化・タブ切替・テーマ・自動更新・スナップショット |
| `src/history.js` | 資産推移タブ ⚠️ **index.html に未ロード** |
| `src/ai-system-prompt.js` | AI相談ペルソナ 🚫 **index.html でコメントアウト** |
| `src/ai-tab.js` | AI相談タブ 🚫 **index.html でコメントアウト** |
| `assets/01-base.css` | CSS変数・テーマ・レイアウト・モーダル基本 |
| `assets/02-tables.css` | 銘柄リスト・ウォッチリスト・ヒートマップセル |
| `assets/03-misc.css` | タブバー・検索・タイプバッジ・PINキーパッド |
| `assets/04-auth.css` | PIN変更ダイアログ |
| `assets/05-ai-tab.css` | AI相談タブ全般（現在ほぼ未使用） |
| `data/portfolio-snapshot.json` | スナップショット保存先（Worker → GitHub API で更新） |
| `data/positions.json` | KV保有銘柄のGit同期（Worker → GitHub API で更新） |

### バックエンド（Cloudflare Workers）

| ファイル | 役割 |
|---------|------|
| `worker/src/index.js` | Worker本体（ルーティング・プロキシ処理） |
| `worker/wrangler.toml` | Cloudflare設定（Worker名・環境変数） |

### スクリプトロード順

```
auth-pin → auth-crypto → auth-passkey → auth-ui
→ positions → state → funds → csv → utils → data
→ heatmap → chart → stock-list → watchlist
→ positions-store → import-parse → import-ui
→ app
```

`history.js` / `ai-system-prompt.js` / `ai-tab.js` は index.html でコメントアウト中（ソース存在）。

---

## 11. データ取得の詳細フロー

### ライブ価格取得（`fetchLivePrice` in data.js）

```
fetchLivePrice(ySymbol)
  │
  ├─① Finnhub（Worker経由: /finnhub?path=/quote&symbol=TYO:9983）
  │    返値: { price: d.c, dayPct: d.dp }
  │    スキップ条件: d.c === 0（週末・未収録銘柄）
  │
  └─② Yahoo Finance（失敗時フォールバック）
       Worker経由: /yahoo?url=<encoded Yahoo Finance URL>
       さらに失敗時: query1直接 → query2直接 → corsproxy.io → allorigins
```

### 履歴データ取得（`fetchAllHistorical` in data.js）

Yahoo Finance のみ使用（Finnhubはスプリット未調整のため不使用）。

```
fetchAllHistorical(range)  range = '1y' | '5y' | '10y'
  ├─ 重複防止: fetchingRanges に range を追加（終了時に削除）
  ├─ キャッシュ済みシンボルをスキップ
  ├─ 5銘柄ずつバッチ取得（300msインターバル）
  └─ 失敗銘柄を2秒後にリトライ
```

取得中のセルは「…」が点滅表示される（未試行・取得中どちらも対象）。

### 全銘柄一括更新（`refreshPrices` in data.js）

```
refreshPrices()
  ├─ 5銘柄バッチで fetchLivePrice を並列実行
  ├─ 失敗銘柄を2秒後リトライ
  └─ 価格更新後の計算
       JPY建て: value = price × shares
       USD建て: 前回価格比率で円建て value をスケール
```

### 異常価格スキップ

| 場所 | 条件 | 処理 |
|------|------|------|
| `refreshPrices` | live.price / 前回価格 が 0.1未満 or 10超 | スキップ（前回値を保持） |
| 履歴キャッシュ更新 | price / 直近履歴値 が 0.3未満 or 3.0超 | スキップ |

### シンボル変換（Yahoo Finance → Finnhub）

| Yahoo Finance | Finnhub |
|--------------|---------|
| `9983.T` | `TYO:9983` |
| `AAPL` | `AAPL` |

---

## 12. 状態管理

アプリの状態は `state.js` のグローバル `state` オブジェクト一本で管理する（Redux等は不使用）。

### 主要なstateフィールド

| フィールド | 説明 |
|-----------|------|
| `colorMode` | ヒートマップの色モード（`'change'` or `'pnl'`） |
| `changePeriod` | 選択中の期間ID（`'1d'`〜`'10y'`） |
| `historicalCache` | 履歴データキャッシュ（`{range: {symbol: [{date, close}]}}`） |
| `fetchingRanges` | 取得中のレンジSet（重複リクエスト防止） |
| `yahooCrumb` / `yahooCrumbExpiry` | Yahoo Finance 認証トークンと有効期限 |
| `autoSec` / `countdownVal` | 自動更新間隔と残り秒数 |
| `themeMode` | テーマモード（`'auto'` / `'light'` / `'dark'`） |
| `listSortCol` / `listSortDir` | Historical Heatmap のソート状態 |
| `wlSortCol` / `wlSortDir` | Watchlist のソート状態 |
| `slDetailVisible` | Historical Heatmap の詳細列表示状態 |
| `activeTab` | 現在のタブ名（`'heatmap'` / `'list'` / `'watchlist'`） |
| `watchlist` | ウォッチリスト銘柄配列 |
| `watchlistPrices` | ウォッチリストのライブ価格キャッシュ |
| `prevPrices` | 価格更新アニメーション用の前回価格キャッシュ |

---

## 13. データ永続化

### localStorage（ブラウザを閉じても保持）

| キー | 内容 | 担当 |
|------|------|------|
| `hm-theme` | テーマモード | app.js |
| `hm-watchlist` | ウォッチリスト銘柄（JSON配列） | watchlist.js |
| `hm-active-tab` | 最後に開いていたタブ | app.js |
| `hm-asset-history` | 日次総資産額レコード（JSON配列、最大1,000件） | history.js（未有効化） |

### sessionStorage（タブを閉じると消える）

| キー | 内容 | 担当 |
|------|------|------|
| `hm-auth-v1` | 認証済みフラグ | auth-pin.js |
| `hm-enc-key-v1` | AES-256-GCM鍵（Base64） | auth-crypto.js |
| `hm-hist-cache` | 履歴価格キャッシュ（リロード時に復元、APIリクエスト節約） | data.js |

### Cloudflare KV（サーバー側永続化）

| キー | 内容 |
|------|------|
| `watchlist` | ウォッチリスト（ログイン後に同期） |
| `positions` | 保有銘柄（PIN認証必須） |
| `pin-hash` | PINのSHA-256ハッシュ |
| `prices:cache` | Cronで6時間ごと更新される全銘柄価格 |

### GitHubリポジトリ（data/ ディレクトリ）

| ファイル | 内容 | 更新元 |
|---------|------|-------|
| `data/portfolio-snapshot.json` | ポートフォリオ全体のスナップショット | フロントエンド手動保存 → Worker → GitHub API |
| `data/positions.json` | 保有銘柄データ | Worker → GitHub API（KV変更時） |

---

## 14. セキュリティ・認証の実装

### PIN認証フロー（`auth-pin.js` / `auth-ui.js`）

```
起動
  └─ sessionStorage['hm-auth-v1'] を確認
       ├─ あり → 認証済み、アプリ表示
       └─ なし → PINキーパッドを全画面表示
                   └─ 4桁入力 → SHA-256ハッシュで照合
                                 ├─ 一致 → AES-256-GCM鍵をPBKDF2導出（10万回反復）
                                 │         → sessionStorageに鍵・認証フラグ保存
                                 └─ 不一致 → 5回失敗で30秒ロック
```

### パスキー認証（`auth-passkey.js`）

WebAuthn API を使った指紋・顔認証。ログイン後のメニューから登録できる。
チャレンジ生成・登録・検証はCloudflare Worker側で処理。

### Cloudflare WorkerによるAPIキー保護

AIのAPIキーおよびFinnhub APIキーはCloudflare WorkerのSecrets（環境変数）に保存する。
ブラウザのJavaScriptコードにAPIキーは一切含まれない。

---

## 15. CSSテーマ設計

テーマは `html[data-theme]` 属性で制御。`applyTheme()` が `auto` を matchMedia で解決して常に `"light"` または `"dark"` を明示セットする。

Claude Desktop 準拠のウォームトーンパレット。

### 主要CSS変数

| 変数 | ライト | ダーク |
|------|-------|-------|
| `--bg` | `#f7f2ee` | `#1c1917` |
| `--surface` | `#ffffff` | `#27211e` |
| `--surface2` | `#f0e9e3` | `#322b28` |
| `--surface3` | `#e8ddd7` | `#3d3530` |
| `--border` | `#d4c8c0` | `#48403b` |
| `--text` | `#1c1714` | `#f5f0ec` |
| `--text2` | `#78695f` | `#a09188` |
| `--accent` | `#cc785c` | `#cc785c` |

`--accent` 以外はハードコードhex禁止。

### ヒートマップの色スケール

| 期間 | scale値 | 意味 |
|------|---------|------|
| 1日 | 4 | ±4%で最大色 |
| 1週 | 8 | ±8%で最大色 |
| 1ヶ月 | 15 | ±15%で最大色 |
| 1年 | 65 | ±65%で最大色 |
| 含み損益 | 50 | ±50%で最大色 |

---

# 運用

---

## 16. デプロイ手順

### フロントエンド（GitHub Pages）

```
1. feature ブランチで変更を開発
2. index.html の全 ?v= パラメータを更新
   形式: ?v=YYYYMMDDX（例: 20260525A, 20260525B, ...）
   同日複数リリース時は末尾アルファベットを a, b, c... → z → A, B, C... と進める
3. feature ブランチに push
4. GitHub でPRを作成してレビュー
5. PRをmainにマージ → GitHub Pages に自動反映（1〜2分）
```

### バックエンド（Cloudflare Worker）

```bash
cd worker
./node_modules/.bin/wrangler deploy
```

APIキーの追加・変更のみの場合は `wrangler secret put <KEY_NAME>` で対応（再デプロイ不要）。

---

## 17. LLMモデルバージョンの定期メンテナンス

AI 相談タブで利用する各 LLM のモデル名は `src/ai-tab.js` の `AI_MODELS` 配列で管理する。**2週間に1回** 棚卸しを行う。

> AI相談タブは現在無効化中だが、再有効化に備えてメンテナンスを継続する。

### メンテナンス対象

`src/ai-tab.js` の `AI_MODELS` 配列の各 `versions` プロパティ。**先頭要素がデフォルト**。

### 2週間ごとの作業手順

| # | プロバイダー | 公式モデル一覧の確認先 |
|---|---|---|
| 1 | OpenAI | https://platform.openai.com/docs/models |
| 2 | Google Gemini | https://ai.google.dev/gemini-api/docs/models |
| 3 | xAI Grok | https://console.x.ai/ → Models |
| 4 | DeepSeek | https://platform.deepseek.com/api-docs/api/list-models |
| 5 | Anthropic Claude | https://docs.claude.com/en/docs/about-claude/models |

### 最終確認日

| 日付 | 確認者 | 変更 |
|---|---|---|
| 2026-05-17 | shoulang | GPT を `gpt-5.4-mini` 追加・先頭化／Gemini を 2.5系GA + 3.1-flash-lite に総入替／Grok を `grok-4.3` 系に総入替／DeepSeek を一時無効化（残高なし） |

### 次回メンテナンス予定日

**2026-05-31**

---

## 18. 改善ロードマップ

### 完了済み

| 機能 | バージョン |
|------|----------|
| Cloudflare WorkerによるAPIプロキシ実装 | 20260516b |
| マネックスCSV/マネフォスクショ取込モーダル | 20260516i |
| 保有銘柄KV化・Worker Cron価格キャッシュ | 20260516i |
| パスキー（指紋/顔認証）対応 | 20260516c |
| ウォッチリストKV同期 | 20260516c |
| CSS 5分割・auth 4分割・import 3分割 | 20260517f |
| Historical Heatmap／Watchlist の期間カラム共通化 | 20260517H |
| スナップショット機能（data/portfolio-snapshot.json） | 20260517D |
| プル・トゥ・リフレッシュ（アイコン回転アニメーション） | 20260525A |
| 自動更新をハンバーガーメニュー内に移動 | 20260525C |
| マニュアルリンクをメニューに追加 | 20260525C |

### 着手予定

| # | 機能 | 概要 |
|---|------|------|
| 1 | **資産推移タブの有効化** | `history.js` を index.html に追加・タブ追加 |
| 2 | **USD/JPY為替レートのリアルタイム取得** | Yahoo Finance `/USDJPY=X` で取得し、米国株の円換算を正確化 |
| 3 | **リバランス提案パネル** | 目標比率と現在比率の差分表示 |

### 検討中

- AI相談タブの再有効化
- ES Modules 化（グローバルスコープからの脱却）

---

## 19. 変更履歴

| バージョン | 日付 | 内容 |
|-----------|------|------|
| 20260525C | 2026-05-26 | タイトル1行化・自動更新をメニュー内に移動（OFF/5分/10分/30分/60分）・マニュアルリンク追加 |
| 20260525B | 2026-05-25 | 更新頻度ボタンをOFF・60分の2つに絞る |
| 20260525A | 2026-05-25 | CLAUDE.md更新・プル・トゥ・リフレッシュをアイコン回転アニメーションに変更 |
| 20260517H | 2026-05-17 | Historical HeatmapとWatchlistの実装を共通化（historicalCache共有） |
| 20260517G | 2026-05-17 | ひふみ投信のproxyシンボルを `1312.T` → `2516.T` に変更 |
| 20260517F | 2026-05-17 | 履歴データ「…」点滅表示の条件を「未試行」も含めるよう拡張 |
| 20260517E | 2026-05-17 | 履歴データ取得中のセルを「…」点滅表示に |
| 20260517D | 2026-05-17 | スナップショットにウォッチリスト（performance付き）を追加 |
| 20260517B | 2026-05-17 | スナップショットからhistoricals除外（5.5MB→約20KB） |
| 20260517A | 2026-05-17 | タブ名修正: 保有銘柄リスト → Historical Heatmap |
| 20260517g | 2026-05-17 | AI相談 system prompt を「投資壁打ちAIペルソナ」に高度化。docs/ai-system-prompt.md 新設 |
| 20260517f | 2026-05-17 | 大規模リファクタリング: funds.js/csv.js新設、CSS 5分割、import.js 3分割、auth.js 4分割、onclick→data-action全置換 |
| 20260516i | 2026-05-16 | マネックスCSV/マネフォスクショ取込モーダル、保有銘柄KV化、Worker Cron 6h価格キャッシュ |
| 20260516h | 2026-05-16 | AI相談タブ全面リデザイン、Claude Desktopウォームトーンデザイン |
| 20260516c | 2026-05-16 | ディレクトリ構成整理（src/ assets/ docs/）、AI API外部化、パスキー認証追加 |
| 20260516b | 2026-05-16 | Cloudflare Worker プロキシ実装（Yahoo/Finnhub/AI）、APIキーをWorker Secretsに移管 |
| 20260322f | 2026-03-22 | PWAアイコン実装（SVG favicon、PNG各サイズ、manifest.json） |
| 20260322a | 2026-03-22 | Finnhub実装（優先→Yahoo フォールバック） |
| 20260311k | 2026-03-11 | ウォッチリストタブ実装 |
