# Portfolio Heatmap — アプリ仕様書

> **このドキュメントはコード変更のたびに更新すること。**
> 最終更新: 2026-05-16 / バージョン: 20260516a

---

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [ファイル構成と依存関係](#2-ファイル構成と依存関係)
3. [主要業務ロジック](#3-主要業務ロジック)
4. [状態管理](#4-状態管理)
5. [データ永続化（localStorage / sessionStorage）](#5-データ永続化)
6. [セキュリティ・認証](#6-セキュリティ認証)
7. [UI・描画パターン](#7-ui描画パターン)
8. [CSS テーマ設計](#8-css-テーマ設計)
9. [デプロイ手順](#9-デプロイ手順)
10. [今後の改善計画](#10-今後の改善計画)
11. [変更履歴](#11-変更履歴)

---

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| **アプリ名** | Portfolio Heatmap |
| **本番 URL** | https://shoulang0729.github.io/portfolio/ |
| **GitHub** | https://github.com/shoulang0729/portfolio |
| **ホスティング** | GitHub Pages（静的サイト） |
| **主要ライブラリ** | D3.js v7（CDN、中国向け bootcdn フォールバックあり） |
| **対象デバイス** | PC / スマートフォン（PWA対応） |

### アプリの目的

個人投資家（保有資産 5 億円超）が日米の保有銘柄を一覧・可視化するためのプライベートツール。
- 保有銘柄のヒートマップ（時価評価額に比例したマス目、騰落率 / 含み損益で色付け）
- 銘柄リスト（ソート・期間別騰落率）
- ウォッチリスト（任意銘柄の追加・監視）
- AI 相談タブ（ChatGPT / Gemini / Grok / DeepSeek / Claude に同時に質問し Claude が総括）

---

## 2. ファイル構成と依存関係

### ファイル一覧

| ファイル | 役割 | 行数目安 |
|---------|------|---------|
| `index.html` | エントリーポイント・HTML骨格・スクリプトロード順制御 | ~280行 |
| `auth.js` | PIN認証・AES-GCM暗号化鍵の導出・PIN変更ダイアログ | ~450行 |
| `positions.js` | 保有銘柄データ配列・期間設定（PERIODS） | ~165行 |
| `state.js` | グローバル定数(C)・アプリ状態(state)・チャートレンジ設定 | ~80行 |
| `utils.js` | フォーマッター・色計算・テーブルヘルパー | ~200行 |
| `data.js` | Finnhub/Yahoo Finance API通信・価格取得・履歴キャッシュ | ~570行 |
| `heatmap.js` | D3.js ツリーマップ描画 | ~200行 |
| `chart.js` | D3.js 個別銘柄チャート（モーダル内） | ~300行 |
| `stock-list.js` | 銘柄リストタブ（テーブル・ソート・バーグラフ） | ~190行 |
| `watchlist.js` | ウォッチリストタブ（検索・追加・削除・ソート） | ~340行 |
| `history.js` | 資産推移タブ（日次記録・D3折れ線グラフ・CSV出力） | ~210行 |
| `ai-tab.js` | AI相談タブ（5モデル並列・会話履歴・Claudeストリーミング） | ~600行以上 |
| `app.js` | 初期化・タブ切替・テーマ・自動更新・statsバー | ~420行 |
| `portfolio.css` | 全スタイル（テーマ変数・レスポンシブ） | ~1400行以上 |

### スクリプトロード順（index.html）

```
auth.js → positions.js → state.js → utils.js → data.js
→ heatmap.js → chart.js → stock-list.js → watchlist.js
→ ai-tab.js → app.js
```

### 依存関係マップ

```
positions.js ─────────────────────────────────────────┐
state.js ──────────────────────────────────────────┐  │
utils.js (← state, positions, D3) ──────────────┐  │  │
data.js  (← state, utils, positions) ─────────┐  │  │  │
auth.js  (独立・暗号化鍵のみ他から参照)         │  │  │  │
                                                │  │  │  │
heatmap.js    (← state, utils, positions, D3) ──┤  │  │  │
chart.js      (← state, utils, data, D3) ───────┤  │  │  │
stock-list.js (← state, utils, positions) ──────┤  │  │  │
watchlist.js  (← state, utils, data, positions) ┤  │  │  │
ai-tab.js     (← auth, positions) ──────────────┤  │  │  │
app.js        (← 全モジュール) ─────────────────┘──┘──┘──┘
```

> **現状の課題**: すべての関数・変数がグローバルスコープに露出している。
> ES Modules 化（`type="module"` + `import/export`）が改善計画に含まれる。

---

## 3. 主要業務ロジック

### 3-1. 価格データ取得フロー

#### ライブ価格取得（`fetchLivePrice` in data.js）

```
fetchLivePrice(ySymbol)
  │
  ├─① Finnhub Quote API（優先）
  │    URL: /api/v1/quote?symbol=TYO:9983&token=...
  │    返値: { price: d.c, dayPct: d.dp }
  │    失敗条件: d.c === 0（週末・未収録）
  │
  └─② Yahoo Finance（フォールバック）
       URL: /v8/finance/chart/{symbol}?interval=1d&range=2d
       fetchViaProxy() 経由（4段フォールバック）
       返値: { price, dayPct }
```

#### Yahoo Finance CORS 4段フォールバック（`fetchViaProxy` in data.js）

```
① query1.finance.yahoo.com（直接・credentials: include）
② query2.finance.yahoo.com（直接）
③ corsproxy.io/?url=...
④ api.allorigins.win/get?url=...
```

各ステップはタイムアウト 7 秒で試行し、失敗したら次へ。

#### シンボル変換（`toFinnhubSymbol`）

| Yahoo Finance | Finnhub |
|--------------|---------|
| `9983.T` | `TYO:9983` |
| `1306.T` | `TYO:1306` |
| `AAPL` | `AAPL` |
| `GLDM` | `GLDM` |

#### 異常価格スキップ

- `refreshPrices`: `live.price / p.price` が 0.1 未満 or 10 超 → スキップ
- `updateCache`: `price / lastHistorical` が 0.3 未満 or 3.0 超 → スキップ

### 3-2. 履歴データ取得フロー（`fetchAllHistorical` in data.js）

```
fetchAllHistorical(range)  range = '1y' | '5y' | '10y'
  │
  ├─ 重複防止: fetchingRanges に range を追加（終了時に削除）
  ├─ キャッシュ済みシンボルをスキップ
  ├─ 5銘柄ずつバッチ取得（300ms インターバル）
  └─ 失敗銘柄を 2 秒後にリトライ
```

履歴データは **Yahoo Finance のみ** 使用（Finnhub はスプリット未調整でデータ不正確のため）。

#### スプリット自動補正（`applySplitCorrection`）

1 日で ±50% 超の変動を検出し、古い価格を遡って補正する。
株式分割（例: 1629の500:1分割、8050の2:1分割）に対応。

### 3-3. 全銘柄価格更新フロー（`refreshPrices` in data.js）

```
refreshPrices()
  │
  ├─ 5銘柄バッチで fetchLivePrice を並列実行
  ├─ 失敗銘柄を 2 秒後リトライ
  └─ 成功時の計算
       JPY建て: value = price × shares
       USD建て: 前回比率で円建て value をスケール
                (costJPY = value - pnl で取得原価保持)
```

> **既知の制限**: USD建て銘柄はUSD/JPY為替レートを取得していないため、
> 円建て評価額は「前回価格からの比率」で更新される。
> 起動時の静的 positions データに含まれる value が基準となる。

### 3-4. ヒートマップ描画（`renderHeatmap` in heatmap.js）

**グループ構成（2グループ）:**

| グループ | カテゴリ |
|---------|---------|
| 米国株・ETF | 米国株・ETF |
| 日本株・ETF・投資信託 | 日本株・ETF / 投資信託 |

**描画手順:**

1. D3 `treemap()` で時価評価額比例レイアウト計算
2. グループ背景矩形 → カテゴリラベル → 銘柄セル の順で SVG に追加
3. セル色: `getColor(pct, mode, scale)` で赤緑グラデーション
4. セル内テキスト: セルサイズに応じてフォントサイズを動的計算

**色計算ルール（日本株慣習）:**

| 値 | 色 |
|----|---|
| プラス（上昇） | 赤系 (#E8E8ED → #C62828) |
| マイナス（下落） | 緑系 (#E8E8ED → #1B5E20) |
| データなし | `--null-cell` |

**スケール（`PERIOD_MAP[id].scale`）:**

| 期間 | scale | 意味 |
|------|-------|------|
| 1d | 4 | ±4%で最大色 |
| 1w | 8 | ±8%で最大色 |
| 1m | 15 | ±15%で最大色 |
| 1y | 65 | ±65%で最大色 |
| 含み損益 | 50 | ±50%で最大色 |

### 3-5. 銘柄リスト（`stock-list.js`）

**列構成（左→右）:**

| 列 | data-col | 詳細列 |
|----|----------|------|
| ティッカー・銘柄名 | symbol | - |
| 市場 | market | - |
| 時価評価額 | value | ✓ |
| 保有数 | shares | ✓ |
| 取得単価 | avgCost | ✓ |
| 現在値 | price | - |
| 1d〜10y 騰落率 | 各period id | - |
| 含み損益 | pnl | ✓ |
| 損益率 | pnlPct | - |

詳細列（✓）は目のアイコンボタンで一括表示/非表示。

**バーグラフ**: `tr` の `background-image` を CSS linear-gradient で描画。
ティッカー列右端〜テーブル右端を最大幅として、時価評価額の比率でバーを描画。

**ソート**: `state.listSortCol` / `state.listSortDir` で管理。
同一列クリックで昇順/降順トグル。comparator は必ず antisymmetric（等値で 0）。

### 3-6. ウォッチリスト（`watchlist.js`）

**検索フロー:**
1. 入力テキストから候補シンボルを生成（数字4-5桁 → `.T` / `.HK` も試す）
2. Yahoo Finance chart API + quoteSummary API を並列取得
3. 名前は longName > shortName の順で最長を採用
4. quoteType（ETF / MUTUALFUND / CURRENCY / EQUITY）を判定

**価格取得**: `fetchWatchlistData()` → `fetchLivePrice()` + `fetchSymbolHistory()` を並列実行。
ウォッチリスト銘柄は `state.watchlistPrices[symbol]` にキャッシュ。

**永続化**: `localStorage['hm-watchlist']` に JSON 保存。

### 3-7. AI 相談タブ（`ai-tab.js`）

**呼び出し構成（5モデル）:**

| モデル | API | 役割 |
|-------|-----|------|
| ChatGPT | OpenAI Chat Completions | 独立回答 |
| Gemini | Google Generative Language | 独立回答 |
| Grok | xAI（OpenAI互換） | 独立回答 |
| DeepSeek | DeepSeek（OpenAI互換） | 独立回答 |
| Claude | Anthropic Messages API | 他4モデルの回答を統合・総括 |

**実行フロー:**
1. 最初の4モデルを `Promise.allSettled()` で並列実行
2. 完了後、Claude に「他4モデルの回答 + ユーザー質問」を送信して統括させる
3. Claude のシステムプロンプトに `buildPortfolioContext()` でポートフォリオ情報を付与（オプション）

**APIキー管理:**
- AES-GCM（auth.js の `aiEncrypt/aiDecrypt`）で暗号化して `localStorage['hm-ai-keys-enc']` に保存
- PINから PBKDF2 導出した鍵を使うため、PINを知らないと複合不可

---

## 4. 状態管理

### state オブジェクト（`state.js`）

| フィールド | 型 | 説明 |
|-----------|---|------|
| `colorMode` | `'change' \| 'pnl'` | ヒートマップ色モード |
| `changePeriod` | string | 選択中の期間ID（`'1d'`〜`'10y'`） |
| `lastChangePeriod` | string | PnLトグル前の期間を記憶（戻り用） |
| `historicalCache` | `{range: {symbol: [{date, close}]}}` | 履歴データキャッシュ（メモリのみ） |
| `fetchingRanges` | Set | 取得中のレンジ（重複リクエスト防止） |
| `yahooCrumb` | string\|null | Yahoo Finance 認証トークン |
| `yahooCrumbExpiry` | number | crumb 有効期限（ms） |
| `autoInterval` | number\|null | 自動更新インターバルID |
| `countdownTimer` | number\|null | カウントダウンタイマーID |
| `countdownVal` | number | カウントダウン残秒数 |
| `autoSec` | number | 自動更新間隔（秒） |
| `currentPos` | object\|null | チャートモーダルで開いている銘柄 |
| `currentRange` | string | チャートの選択レンジ（デフォルト`'3m'`） |
| `statsVisible` | boolean | statsバー表示状態（デフォルト false） |
| `themeMode` | `'auto' \| 'light' \| 'dark'` | テーマモード |
| `listSortCol` | string | 銘柄リストのソート列（デフォルト`'1d'`） |
| `listSortDir` | `'asc' \| 'desc'` | 銘柄リストのソート方向 |
| `slDetailVisible` | boolean | 詳細列表示状態（デフォルト false） |
| `activeTab` | string | 現在のタブ |
| `lastUpdateText` | string\|null | 最終更新ステータス文字列（履歴取得後復元用） |
| `watchlist` | Array | ウォッチリスト銘柄配列 |
| `watchlistPrices` | Object | ウォッチリスト価格キャッシュ |
| `wlSortCol` | string | ウォッチリストのソート列 |
| `wlSortDir` | `'asc' \| 'desc'` | ウォッチリストのソート方向 |

### C 定数（`state.js`）

ヒートマップのレイアウト計算に使う固定値（`Object.freeze` で不変）。

| 定数 | 値 | 説明 |
|------|---|------|
| `MOBILE_BREAKPOINT` | 600 | モバイル判定ピクセル数 |
| `HEATMAP_ASPECT_MOB` | 0.85 | モバイルのアスペクト比 |
| `HEATMAP_ASPECT_DSK` | 0.58 | デスクトップのアスペクト比 |
| `SYM_FONT_COEFF` | 0.22 | シンボルフォントサイズ係数 |

---

## 5. データ永続化

### localStorage

| キー | 内容 | 担当 |
|------|------|------|
| `hm-theme` | テーマモード (`auto`/`light`/`dark`) | app.js |
| `hm-watchlist` | ウォッチリスト銘柄 JSON 配列 | watchlist.js |
| `hm-ai-keys-enc` | AIタブ APIキー（AES-GCM暗号化済み） | ai-tab.js |
| `hm-pin-hash` | 変更後のPINのSHA-256ハッシュ | auth.js |
| `hm-asset-history` | 日次総資産額レコード JSON 配列 | history.js |

### sessionStorage

| キー | 内容 | 担当 |
|------|------|------|
| `hm-auth-v1` | 認証済みフラグ (`'1'`) | auth.js |
| `hm-enc-key-v1` | AES-256-GCM鍵（Base64）| auth.js |
| `hm-hist-cache` | 履歴価格キャッシュ（`{_v, 1y, 5y, 10y}`） | data.js |

> `state.historicalCache` は sessionStorage にシリアライズして永続化済み（v20260516a）。
> タブリロード後もキャッシュが復元されるため API リクエスト数が大幅に減少する。

---

## 6. セキュリティ・認証

### PIN認証（`auth.js`）

**フロー:**
1. 起動時に `sessionStorage['hm-auth-v1']` を確認
2. 未認証 → PINキーパッドを全画面表示（`overflow: hidden`）
3. 4桁入力 → SHA-256ハッシュで照合（デフォルトPIN: `1234`）
4. 認証成功 → PBKDF2（100,000回反復）でAES-256-GCM鍵を導出
5. 鍵をBase64でsessionStorageに保存（ページリロード時に復元）

**ロックアウト**: 5回失敗で30秒ロック。

**PINハッシュ保存**: 変更後のPINは SHA-256ハッシュで `localStorage['hm-pin-hash']` に保存。

### APIキー暗号化（`auth.js` + `ai-tab.js`）

```
PIN → PBKDF2 → AES-256-GCM鍵
                │
                ├─ 暗号化: aiEncrypt(JSON.stringify(keys))
                └─ 復号:   aiDecrypt(localStorage['hm-ai-keys-enc'])
```

IV（初期化ベクタ）はランダム12バイトを毎回生成し、暗号文の先頭12バイトに付加。

### ⚠️ 既知のセキュリティ課題

| 課題 | 場所 | 対処方針 |
|------|------|---------|
| Finnhub APIキーがソースコードに平文 | `data.js` L55 | バックエンドプロキシまたはGitHub Actions Secrets に移行 |
| GitHubリポジトリが公開状態 | - | プライベートリポジトリ化、またはキー削除 |

---

## 7. UI・描画パターン

### タブ切替（`switchTab` in app.js）

各パネル（`panel-heatmap` / `panel-list` / `panel-watchlist` / `panel-ai`）を
`hidden` 属性でトグル。タブボタンは `active` クラスで状態管理。

タブ切替時のサイドエフェクト:
- `heatmap` → `renderHeatmap()`（W=0 時の再描画）
- `list` → `renderStockList()` + `updateListHeight()`
- `watchlist` → `renderWatchlist()` + `fetchWatchlistData()`
- `ai` → `renderAiTab()`（初回のみDOM構築）

### チャートモーダル（`chart.js`）

銘柄クリック → `openModal(pos)` → `loadChart(symbol, range)` → D3 折れ線チャート。
取得元は Yahoo Finance chart API。取得単価の水平線を重ね描き。

### 高さ動的計算

銘柄リストのスクロールエリア高さを `updateListHeight()` で計算：
```
wrap.maxHeight = innerHeight - stickyHeaderHeight - slControlsHeight - paddingBottom - 4px
```

`ResizeObserver` で `sticky-top` の高さ変化を監視し自動再計算。

### モバイルレイアウト（`_setupMobileLayout`）

DOM要素（refresh-switch / countdown / theme-btn / status-line）を
JSで移動して `.mobile-refresh` コンテナに再配置。

---

## 8. CSS テーマ設計

### 変数定義（`portfolio.css`）

テーマは `html[data-theme]` 属性で切替（`auto` / `light` / `dark`）。

| 変数 | light | dark |
|------|-------|------|
| `--bg` | #F2F2F7 | #000000 |
| `--surface` | #FFFFFF | #1C1C1E |
| `--text` | #1C1C1E | #FFFFFF |
| `--text2` | #8E8E93 | #8E8E93 |
| `--border` | #C6C6CB | #3A3A3C |
| `--null-cell` | #E5E5EA | #2C2C2E |

### テーマ切替フロー（v20260516a 改善済み）

```
cycleTheme() → state.themeMode = 'auto' → 'light' → 'dark' → 'auto' ...
             → localStorage.setItem('hm-theme', mode)
             → applyTheme():
                  themeMode==='auto' ? matchMedia で light/dark を解決
                  document.documentElement.dataset.theme = 'light' | 'dark'
             → renderHeatmap()（色再計算）

// システムテーマ変更時の自動追従
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ...)
```

> **v20260516a 改善**: `html[data-theme="dark"]` と `@media (prefers-color-scheme: dark) html[data-theme="auto"]`
> の CSS 変数重複を解消。`applyTheme()` が matchMedia で 'auto' を解決して常に `data-theme="dark"|"light"` を明示セットするため、
> CSS 側に @media ブロックが不要になった（ファイルにコメントとして残存）。

---

## 9. デプロイ手順

```bash
# 1. バージョン文字列を更新（index.html 全?v=パラメータ）
#    形式: ?v=YYYYMMDDX （例: 20260514a, 20260514b...）

# 2. デプロイコミットを作成
bash deploy.sh

# 3. GitHub Desktop で「Push origin」を実行
#    （VM環境はネットワーク制限のため push.sh では git push を実行しない）
```

**deploy.sh の内容**: `git add -A && git commit -m "deploy: v[バージョン]"` 相当。

**push.sh**: GitHubトークンを含むため `.gitignore` に記載済み。
絶対にリポジトリにコミットしないこと。

---

## 10. 今後の改善計画

### 実装予定（優先度順）

| # | 機能 | 対象ファイル | 状態 |
|---|------|------------|------|
| 1 | **履歴キャッシュのsessionStorage永続化** | data.js | ✅ 実装済み（v20260516a） |
| 2 | **資産推移の自動記録・グラフ表示** | history.js | ✅ 実装済み（v20260516a） |
| 3 | **AI相談の会話継続化＋ストリーミング** | ai-tab.js | ✅ 実装済み（v20260516a） |
| 4 | **ES Modules化** | 全JSファイル | 未着手（グローバル依存多く大規模変更） |
| 5 | **CSSダーク変数の重複排除** | portfolio.css / app.js | ✅ 実装済み（v20260516a） |
| 6 | **価格更新時のセルフラッシュアニメーション** | data.js / heatmap.js / portfolio.css | ✅ 実装済み（v20260516a） |
| 7 | **銘柄リストのティッカー列 sticky 固定** | portfolio.css | ✅ 実装済み（v20260516a） |
| 8 | **初回データ取得中のスケルトン表示** | index.html / app.js / portfolio.css | ✅ 実装済み（v20260516a） |
| 9 | **リバランス提案パネル** | rebalance.js（新規）| 未着手 |
| 10 | **USD/JPY為替レートのリアルタイム取得** | data.js | 未着手 |

### 検討中

- Finnhub APIキーのバックエンドプロキシ化
- 資産贈与・税務シミュレーター（AI相談タブに統合）

---

## 11. 変更履歴

| バージョン | 日付 | 内容 |
|-----------|------|------|
| 20260516a | 2026-05-16 | 機能追加8件: sessionStorageキャッシュ永続化・資産推移タブ(history.js新規)・AI会話継続化＋Claude ストリーミング・CSSダーク変数重複排除(JS解決)・価格フラッシュアニメーション・ティッカー列sticky固定・初回ロードスケルトン表示・システムテーマ自動追従改善 |
| 20260514a | 2026-05-14 | ポートフォリオ更新（1306追加・JPST追加・GDX/SHV削除・各銘柄価格・株数更新） |
| 20260417j | 2026-04-17 | ポートフォリオ更新（1629:500:1分割・8050:2:1分割・PLTR追加・GLDM/MSFT/XLE株数変更）、Finnhub異常価格スキップ修正 |
| 20260322f | 2026-03-22 | PWAアイコン実装（SVG favicon、PNG 512/192/180px、manifest.json） |
| 20260322e | 2026-03-22 | 投資信託追加（ひふみ3銘柄・PIMCO-ST）、CSVボタンコメントアウト |
| 20260322b | 2026-03-22 | ウォッチリストのスマホ表示修正（overflow-x: auto） |
| 20260322a | 2026-03-22 | Finnhub実装（優先→Yahoo フォールバック）、ポートフォリオ更新 |
| 20260311o | 2026-03-11 | Yahoo Finance安定性改善（query2追加・バッチ取得・リトライ） |
| 20260311n | 2026-03-11 | 市場ソートcomparatorバグ修正、ウォッチリスト市場バッジ統一 |
| 20260311m | 2026-03-11 | リファクタリング：makeTh/makePctCell共通化、PERIOD_COLS/IDS移動 |
| 20260311l | 2026-03-11 | 市場列・市場ソートを銘柄リスト/ウォッチリストに追加 |
| 20260311k | 2026-03-11 | ウォッチリストタブ実装（watchlist.js新規作成） |
