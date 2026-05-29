# Portfolio Heatmap — Codex エージェント コンテキスト

> このファイルは OpenAI Codex CLI 用のコンテキストです。
> Claude Code (Opus) 向けは `CLAUDE.md` を参照してください。
>
> **役割分担**: Codex がソースコード変更を担当し、Claude Code (Opus) がレビュー・マージ・設計判断を担います。

## プロジェクト概要
Finnhub API（優先）+ Yahoo Finance API（フォールバック）を使ったポートフォリオ可視化 Web アプリ。
Heatmap・Historical Heatmap・Watchlist Historical Heatmap の3タブ構成。
AI相談タブは現在無効化中（ソースは `src/_disabled/` に保管）。

- **本番 URL**: https://shoulang0729.github.io/portfolio/
- **GitHub**: https://github.com/shoulang0729/portfolio
- **現在バージョン**: `20260529I`

---

## ディレクトリ構成

```
/
├── index.html          # GitHub Pages エントリーポイント
├── CLAUDE.md           # Claude Code 引き継ぎ情報
├── AGENTS.md           # Codex エージェント コンテキスト（このファイル）
├── src/                # JS ソースファイル（スクリプト読込順あり）
│   ├── auth-pin.js         # PIN ハッシュ・状態・ロックアウト
│   ├── auth-crypto.js      # AES-GCM 暗号化
│   ├── auth-passkey.js     # WebAuthn パスキー
│   ├── auth-ui.js          # PINログイン・変更ダイアログ UI
│   ├── positions.js        # 保有銘柄データ・PERIODS 定義（編集はここだけ）
│   ├── state.js            # 定数 (C)・アプリ状態 (state)
│   ├── funds.js            # 投資信託マッピング（FUND_DEFS）
│   ├── csv.js              # マネックスCSVパース
│   ├── utils.js            # 共通ユーティリティ
│   ├── data-helpers.js     # 共有ヘルパー（fetchWithTimeout / sleep / batchWithRetry）
│   ├── data-finnhub.js     # Finnhub 専用関数
│   ├── data-yahoo.js       # Yahoo Finance 専用関数
│   ├── data.js             # Finnhub/Yahoo Finance API オーケストレーション
│   ├── forex.js            # Worker /forex 経由で為替レート取得
│   ├── cache.js            # メモリキャッシュ・IndexedDB 統合
│   ├── historical-cache.js # IndexedDB ベースの historical キャッシュ
│   ├── color.js            # 色計算・テーマロジック
│   ├── fmt.js              # フォーマット関数（金額・通貨・日付）
│   ├── config.js           # 設定定数・UI パラメータ
│   ├── heatmap.js          # D3.js ヒートマップ描画
│   ├── chart.js            # D3.js チャート描画
│   ├── stock-list.js       # Historical Heatmap タブ（銘柄リスト＋期間別騰落率）
│   ├── watchlist.js        # Watchlist Historical Heatmap タブ
│   ├── positions-store.js  # KV保存/読込・差分計算
│   ├── import-parse.js     # マネックスCSV/マネフォ画像パース
│   ├── import-ui.js        # 取込モーダルUI
│   ├── portfolio-calc.js   # ポートフォリオ計算（含み損益・リスク等）
│   ├── ptr.js              # Pull-to-refresh
│   ├── render.js           # 描画オーケストレーション
│   ├── modal.js            # モーダルダイアログ共通処理
│   ├── table.js            # テーブル行生成ヘルパー
│   ├── ui-status.js        # ステータスバー・スピナー表示
│   ├── init.js             # 初期化・event listener 登録
│   ├── tabs.js             # タブ切替ロジック
│   ├── menu.js             # メニュー・更新オプション
│   ├── idb.js              # IndexedDB ラッパー
│   ├── _disabled/          # 無効化中コード（再有効化可能）
│   │   ├── history.js          # 資産推移記録＋D3グラフ（未統合）
│   │   ├── ai-system-prompt.js # AI相談ペルソナ
│   │   ├── ai-tab.js           # AI相談タブ
│   │   └── 05-ai-tab.css       # AI相談タブCSS
│   └── app.js              # data-action ディスパッチャ・タブ切替・初期化
├── assets/             # 静的アセット
│   ├── 01-base.css         # CSS変数・テーマ・レイアウト・モーダル基本
│   ├── 02-tables.css       # 銘柄リスト・ウォッチリスト・ヒートマップセル
│   ├── 03-misc.css         # タブバー・検索・タイプバッジ・PINキーパッド
│   ├── 04-auth.css         # PIN変更ダイアログ
│   ├── manifest.json       # PWA マニフェスト
│   └── *.png / *.svg       # アイコン類
├── sw.js               # PWA Service Worker（オフラインキャッシュ）
├── package.json        # npm スクリプト（test / lint / format）
├── vitest.config.js    # vitest テスト設定
├── eslint.config.js    # ESLint flat config (v9)
├── .prettierrc         # Prettier コードスタイル
├── data/               # Worker が生成するデータファイル
│   ├── portfolio-snapshot.json
│   └── positions.json
├── worker/             # Cloudflare Worker
│   ├── src/index.js
│   └── wrangler.toml
└── docs/               # 設計書・ルーティン定義
```

### スクリプト読込順（index.html）

```
auth-pin → auth-crypto → auth-passkey → auth-ui
→ positions → state → funds → csv → utils → data-helpers → data-finnhub → data-yahoo → data → forex
→ heatmap → chart → stock-list → watchlist
→ positions-store → import-parse → import-ui
→ menu → app
```

---

## デプロイ手順

```bash
# 1. バージョンを上げる（index.html の ?v=YYYYMMDDX を全置換で更新）
# 2. コミット & push → GitHub Pages に自動反映
```

**バージョン命名規則**: `?v=YYYYMMDDX`（例: `20260517H`）
英字は同日複数リリース時に a, b, c… → z → A, B, C… と順に振る。
index.html 内の CSS・JS すべての `?v=` を同じ値に揃える。

### ⚠️ git push の注意（このターミナル固有）

`git push` の HTTPS が 403 で失敗します。以下のいずれかで対処してください。

```bash
# 方法1: gh CLI でブランチを作成し PR は Claude Code (Opus) に任せる
git commit -m "fix: ..."
# → push は Claude Code (Opus) が GitHub API 経由で代行

# 方法2: gh api でブランチ作成（blob → tree → commit → ref の順）
# 詳細は Claude Code (Opus) に依頼する
```

---

## データソース設計

### Finnhub（優先）
- APIキー: Cloudflare Worker Secret `FINNHUB_API_KEY`（フロントには露出しない）
- シンボル変換: `toFinnhubSymbol(ySymbol)` — `9983.T` → `TYO:9983`、US株はそのまま
- ライブ価格: `fetchFinnhubQuote(fSymbol)` — `dp`（日次騰落率）・`c`（現在値）を返す
- 履歴データ: `fetchFinnhubCandles(fSymbol, fromTs, toTs)` — 日足 OHLCV
- 無料枠: 60リクエスト/分

### Yahoo Finance（フォールバック）
- Finnhub が失敗した場合に自動切り替え
- フォールバック順: Worker経由 → query1直接 → query2直接 → corsproxy.io → allorigins

### データ取得フロー
```
fetchLivePrice(ySymbol)
  → fetchFinnhubQuote(TYO:XXXX or AAPL)
  → [失敗時] fetchViaProxy(Yahoo Finance chart API)

fetchSymbolHistory(ySymbol, range)
  → fetchFinnhubCandles(TYO:XXXX, fromTs, toTs)
  → [失敗時] fetchViaProxy(Yahoo Finance chart API, range=1y/5y/10y)
```

---

## Cloudflare Worker ルート一覧

```
GET  /yahoo?url=<encoded>           Yahoo Finance プロキシ（CORS回避）
GET  /finnhub?path=<path>&<params>  Finnhub プロキシ（APIキー隠蔽）
GET  /forex?from=<from>&to=<to>     為替レートプロキシ
POST /ai/openai                     OpenAI プロキシ
POST /ai/gemini                     Gemini プロキシ
POST /ai/grok                       Grok プロキシ
POST /ai/deepseek                   DeepSeek プロキシ
POST /ai/claude                     Claude プロキシ
GET  /watchlist                     ウォッチリスト取得（KV）
PUT  /watchlist                     ウォッチリスト保存（KV）
GET  /positions                     保有銘柄取得（KV・非公開）
PUT  /positions                     保有銘柄保存（KV・PIN認証必須）
PUT  /auth/pin-hash                 PIN ハッシュ更新（KV）
GET  /prices/cache                  Cron キャッシュ価格取得（KV）
POST /portfolio/snapshot            スナップショット保存（GitHub API）
GET  /auth/challenge                パスキー認証チャレンジ生成
POST /auth/register                 パスキー登録
POST /auth/verify                   パスキー検証
```

**Cron**: `0 */6 * * *` — 6時間ごとに全保有銘柄の価格を取得してKVキャッシュ

---

## 主要な設計ルール

### data-action イベント委譲
- HTML 要素に `data-action="funcName"` / `data-action="fn1|fn2"` を付ける
- `app.js` の `document.addEventListener('click', ...)` が一括ディスパッチ
- インライン `onclick=` は使わない（auth-ui.js 内の一部 PIN キーパッドを除く）
- `data-arg="value"` で引数を渡す。`data-event="input"` で click 以外のイベントを登録

### ソートの仕組み
- `state.listSortCol` / `state.listSortDir` で Historical Heatmap のソート状態を管理
- `state.wlSortCol` / `state.wlSortDir` で Watchlist Historical Heatmap のソート状態を管理
- ソート comparator は必ず antisymmetric にすること（等値で 0 を返す）
- 文字列ソートは `localeCompare('ja')` を使う

### 期間カラム
- 期間設定は `positions.js` の `PERIODS` 配列が唯一の定義元
- `PERIOD_COLS` / `PERIOD_IDS` / `PERIOD_MAP` は PERIODS から自動生成（positions.js 末尾）

### 共通ヘルパー（utils.js）
- `makeTh(label, col, align, activeSortCol, sortDir, sortFnName)` — テーブルヘッダー `<th>` 生成
- `makePctCell(pct, scale, dataCol)` — 色付き % セル `<td>` 生成
- `_tableSort(colKey, dirKey, col, defaultAscCols)` — テーブルのソート切り替え共通処理
- `getColor(pct, mode, scale)` — ヒートマップ色計算
- `getCellTextColor(bg)` — 背景色に合わせた文字色（白 or 黒）
- `fmtPctInt(pct)` — % 表示フォーマット（小数点1桁）
- `fmtJPYInt(val)` — 日本円整数フォーマット（億・万・円）
- `getHistoricalChangePct(ySymbol, periodId)` — historicalCache から期間騰落率を取得

### ウォッチリスト
- `localStorage` の `hm-watchlist` キーに JSON 保存 + Worker KV に同期
- `wlGetPct(item, periodId)` で 1d は watchlistPrices キャッシュ、他は historicalCache から取得
- 市場列バッジは `<span class="wl-type-badge">` のみ（タイプ別クラスなし）
- 検索は Yahoo Finance の chart/quoteSummary API

### CSS テーマ
- CSS 変数 `--bg`, `--border`, `--text`, `--text2`, `--surface`, `--accent` でダーク/ライト切り替え
- ベースパレット: ライト `#f7f2ee` / ダーク `#1c1917`
- アクセントカラー: `#cc785c`
- `--accent` 以外はハードコード hex 禁止

### 投資信託の扱い
- `isProxy: true` の銘柄は `ySymbol` に代替インデックスを指定
- `funds.js` の `FUND_DEFS` / `fundSymbolFromName()` / `fundProxyOf()` で管理

---

## 自律実行ルール

**確認なしで自律実行してよい操作**（環境非依存・全端末共通）:

| 操作 | 内容 |
|------|------|
| レビュー対応 | CodeRabbit 等のレビューコメントを読んで修正し、コメントに返信する |
| テスト対応 | テスト失敗を修正し、対応内容を Issue にコメントする |
| 依存追加 | `npm install <pkg> --save-dev` で devDependency を追加する |
| バージョン更新 | `?v=YYYYMMDDX` のバージョン文字列を更新する |
| Issue 管理 | Issue を作成・クローズする |
| CI 軽微修正 | GitHub Actions のタイムアウト・トリガー条件など軽微な修正 |

**Codex が担当する範囲**:
- ソースコード変更（src/ / assets/ / worker/ / tests/）
- `git commit` まで完了させる
- `git push` が失敗する場合はコミットまで完了させて Claude Code (Opus) に報告

**Claude Code (Opus) に任せる操作**:
- PR 作成・マージ・ブランチ削除（git push HTTPS が 403 のため Opus が GitHub API 経由で対応）
- `git push --force` / `git reset --hard` / main ブランチ削除
- Secrets・認証情報の変更
- `CLAUDE.md` / `AGENTS.md` / `.claude/settings.json` の変更
- GitHub Actions ワークフローの大幅な変更
- 設計判断・根本バグ修正・衝突解消

---

## 開発ツール

### テスト
```bash
npm test              # vitest 単発実行（CI 相当）
npm run test:watch    # ウォッチモード
npm run test:e2e      # Playwright（chromium）
```

### リント・フォーマット
```bash
npm run lint          # ESLint（src/ / worker/src/）
npm run lint:fix      # 自動修正
npm run format        # Prettier 整形
```

### 型チェック・その他
```bash
npm run check:types     # tsc --noEmit（// @ts-check 付きファイルのみ）
npm run check:circular  # madge で循環参照検出
npm run check:deps      # depcheck で未使用依存検出
```

### セキュリティルール
- ユーザー入力は `textContent` か `escapeHTML()` でエスケープ
- Yahoo Finance API 等の外部値を `innerHTML` に埋め込む前に必ず `escapeHTML(s)` を通す
- APIキーは Cloudflare Secrets / 環境変数
- CORS ホワイトリストを Worker で管理

---

## よくある作業パターン

### 保有銘柄を更新する
`positions.js` の `positions` 配列を編集するだけ。他のファイルは不要。

### バージョンを上げる
index.html 内の `?v=YYYYMMDDX` を新しい値に全置換する。CSS・JS・SW 登録 URL（`./sw.js?v=...`）合わせて全箇所を同じ値に揃える。

### 新しいソート列を追加する（Historical Heatmap）
1. `stock-list.js` の `slSort()` に case を追加
2. `slRenderRows()` のテーブルヘッダーに `makeTh('ラベル', 'col-id', 'center', ...)` を追加
3. 行の `<td data-col="col-id">` を追加

### Finnhub が取れない銘柄への対処
- `fetchFinnhubQuote` が null を返すと自動で Yahoo Finance にフォールバック
- 東証シンボルで取れない場合は `toFinnhubSymbol` の変換ロジックを確認
- 投資信託は `isProxy: true` + `ySymbol` に代替インデックスを指定して対処

### history.js タブを有効化する手順
1. `src/_disabled/history.js` を `src/history.js` にコピー
2. index.html に `<script src="src/history.js?v=...">` を追加（app.js の直前）
3. index.html のタブバーに `<button data-tab="history" ...>資産推移</button>` を追加
4. `<section id="panel-history" class="tab-panel">` パネルを追加
5. `app.js` の `switchTab()` に `if (name === 'history') renderHistoryTab();` を追加
6. `data.js` の `refreshPrices()` 成功後に `recordTodayAsset()` を呼ぶ

### スナップショットの外部参照
```
https://raw.githubusercontent.com/shoulang0729/portfolio/main/data/portfolio-snapshot.json
```

---

## 設計規約（Design System）

### カラーシステム（CSS変数トークン）

```css
:root {
  --bg        /* 背景最底層 */
  --surface   /* カード・パネル背景 */
  --surface2  /* ネストされたカード・インプット背景 */
  --surface3  /* ホバー・アクティブ state */
  --border    /* 主要ボーダー */
  --border2   /* サブ・セパレーター */
  --text      /* プライマリテキスト */
  --text2     /* セカンダリ / プレースホルダー */
  --text3     /* ディセーブル / 薄いラベル */
  --shadow    /* ボックスシャドウ値 */
  --shadow2   /* オーバーレイ背景色 */
  --accent    /* アクセントカラー（#cc785c） */
}
```

### タイポグラフィ

```
フォント: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Hiragino Sans', Arial, sans-serif
サイズ: 10px(ラベル) / 11px(キャプション) / 12px(ステータス) / 13px(本文基本) / 14px(AI入力) / 15px(セクション) / 20px(ページ)
ウェイト: 400(通常) / 500(メニュー・タブ) / 600(ボタン・強調) / 700(見出し)
```

### コーディング規約

**HTML:**
- ID はシングルトン、class は再利用可能
- `data-*` 属性で JS フック、スタイルフックには使わない
- `onclick=` はグローバル関数に限定

**JavaScript:**
- グローバル変数/関数は最小化、モジュールごとにファイル分割
- 状態は `state` オブジェクトに集約
- DOM 操作は初期化時に querySelector でキャッシュ
- API 呼び出しは `try/catch`、エラーは UI に表示
- `async/await` + `Promise.allSettled()` で並列呼び出し

**CSS:**
- 色・サイズ・シャドウは CSS 変数のみ
- クラス命名: `コンポーネント名-要素名-修飾子` の BEM ライク規則
- セレクター深さは3段まで
- `!important` は使わない

### アンチパターン

| NG | 代替案 |
|---|---|
| `el.style.color = '#ff0000'` | CSS class toggle / CSS 変数 |
| `document.write(...)` | innerHTML / createElement |
| APIキーをフロントに書く | Cloudflare Worker Secrets |
| `innerHTML` にユーザー入力を直接展開 | `textContent` / `escapeHTML()` |
| 深いセレクター `.a .b .c .d {}` | コンポーネントクラスを直接ターゲット |
