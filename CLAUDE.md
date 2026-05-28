# Portfolio Heatmap — Claude Code 引き継ぎ情報

## プロジェクト概要
Finnhub API（優先）+ Yahoo Finance API（フォールバック）を使ったポートフォリオ可視化 Web アプリ。
Heatmap・Historical Heatmap・Watchlist Historical Heatmap の3タブ構成。
AI相談タブは現在無効化中（ソースは `src/_disabled/` に保管）。

- **本番 URL**: https://shoulang0729.github.io/portfolio/
- **GitHub**: https://github.com/shoulang0729/portfolio
- **現在バージョン**: `20260527B`

---

## ディレクトリ構成

```
/
├── index.html          # GitHub Pages エントリーポイント
├── CLAUDE.md           # Claude Code 引き継ぎ情報（このファイル）
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
│   ├── data.js             # Finnhub/Yahoo Finance API 通信
│   ├── heatmap.js          # D3.js ヒートマップ描画
│   ├── chart.js            # D3.js チャート描画
│   ├── stock-list.js       # Historical Heatmap タブ（銘柄リスト＋期間別騰落率）
│   ├── watchlist.js        # Watchlist Historical Heatmap タブ
│   ├── positions-store.js  # KV保存/読込・差分計算
│   ├── import-parse.js     # マネックスCSV/マネフォ画像パース
│   ├── import-ui.js        # 取込モーダルUI
│   ├── ptr.js              # ★新設：Pull-to-refresh（app.js から分離）
│   ├── _disabled/          # 無効化中コード（再有効化可能。再開手順は CLAUDE.md 参照）
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
│   └── *.png / *.svg       # アイコン類（favicon.svg・apple-touch-icon.png 等）
├── sw.js               # ★新設：PWA Service Worker（オフラインキャッシュ）
├── package.json        # ★新設：npm スクリプト（test / lint / format）
├── vitest.config.js    # ★新設：vitest テスト設定
├── eslint.config.js    # ★新設：ESLint flat config (v9)
├── .prettierrc         # ★新設：Prettier コードスタイル
├── data/               # ★新設：Workerが生成するデータファイル
│   ├── portfolio-snapshot.json  # スナップショット保存先（Worker → GitHub API で更新）
│   └── positions.json           # KV保有銘柄のGit同期（Worker → GitHub API で更新）
├── worker/             # Cloudflare Worker
│   ├── src/index.js    # Worker 本体
│   └── wrangler.toml   # Worker 設定
└── docs/               # 設計書・ルーティン定義
    ├── SPEC_cn.md              # 機能仕様書（中国語）
    ├── DESIGN.md               # フロントエンド設計規約（カラー・コンポーネント等）
    ├── ai-system-prompt.md     # AI相談ペルソナ定義（ai-system-prompt.js と同期）
    ├── routine_japan_1700.md   # 国内株ルーティン
    └── routine_us_0600.md      # 米国株ルーティン
```

### スクリプト読込順（index.html）

```
auth-pin → auth-crypto → auth-passkey → auth-ui
→ positions → state → funds → csv → utils → data
→ heatmap → chart → stock-list → watchlist
→ positions-store → import-parse → import-ui
→ app
```

`src/_disabled/` 内の各ファイルは index.html でコメントアウト中（git 履歴に残存）。

---

## デプロイ手順

```bash
# 1. バージョンを上げる（index.html の ?v=YYYYMMDDX を全置換で更新）
# 2. コミット & push → GitHub Pages に自動反映
```

**バージョン命名規則**: `?v=YYYYMMDDX`（例: `20260517H`）
英字は同日複数リリース時に a, b, c… → … → z → A, B, C… と順に振る。
index.html 内の CSS・JS すべての `?v=` を同じ値に揃える。

---

## データソース設計

### Finnhub（優先）
- APIキー: Cloudflare Worker Secret `FINNHUB_API_KEY`（フロントには露出しない）
- シンボル変換: `toFinnhubSymbol(ySymbol)` — `9983.T` → `TYO:9983`、US株はそのまま
- ライブ価格: `fetchFinnhubQuote(fSymbol)` — `dp`（日次騰落率）・`c`（現在値）を返す
- 履歴データ: `fetchFinnhubCandles(fSymbol, fromTs, toTs)` — 日足 OHLCV
- 無料枠: 60リクエスト/分

### Yahoo Finance（フォールバック）
- Finnhub が失敗した場合に自動切り替え（投資信託プロキシなど未収録銘柄向け）
- フォールバック順: Worker経由 → query1直接 → query2直接 → corsproxy.io → allorigins
- `fetchViaProxy(url)` 経由で取得

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
POST /portfolio/snapshot            スナップショット → data/portfolio-snapshot.json に保存（GitHub API）
POST /notion/save                   AI相談結果をNotion DBに保存
GET  /auth/challenge                パスキー認証チャレンジ生成
POST /auth/register                 パスキー登録
POST /auth/verify                   パスキー検証
```

**Cron**: `0 */6 * * *` — 6時間ごとに全保有銘柄の価格を取得してKVキャッシュ

**Worker Secrets**: `FINNHUB_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`,
`GROK_API_KEY`, `DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`,
`NOTION_API_KEY`, `NOTION_DB_ID`, `ALLOWED_ORIGIN`

---

## スナップショット機能

メニュー「スナップショット保存」ボタン（ログイン後のみ表示）から手動実行。

- フロントエンドが `buildSnapshot()` でポートフォリオ全体（positions + watchlist + 集計）を JSON 生成
- Worker `/portfolio/snapshot` に POST → GitHub API で `data/portfolio-snapshot.json` を更新
- historicals（日次価格系列）は重い（5MB超）ので **保存しない**。performance 値のみ集約
- 他の AI ツールがこの JSON を参照して現在のポートフォリオを把握できる仕組み

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
- 新しい期間を追加するときは `PERIODS` を変更するだけで全テーブルに反映される

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
- 検索は Yahoo Finance の chart/quoteSummary API（Finnhub の Search API は未使用）

### 資産推移（src/_disabled/history.js・未統合）
- `localStorage` の `hm-asset-history` キーに `{date, value}` 配列を保存（最大1000件）
- `recordTodayAsset()` を `refreshPrices()` 成功後に呼ぶ想定
- `renderHistoryTab()` で D3 面グラフ＋ホバーツールチップ描画
- **現在 index.html には読み込まれていない**。統合するには下記手順を参照

### CSS テーマ（Claude Desktop ウォームトーン）
- CSS 変数 `--bg`, `--border`, `--text`, `--text2`, `--surface`, `--accent` でダーク/ライト切り替え
- ベースパレット: ライト `#f7f2ee` / ダーク `#1c1917`（Claude Desktopトーン）
- アクセントカラー: `#cc785c`（Claude ブラウン）
- `--accent` 以外はハードコード hex 禁止
- `#watchlist-table-wrap` に `overflow-x: auto` を設定（スマホ横スクロール対応）

### 投資信託の扱い
- `isProxy: true` の銘柄は `ySymbol` に代替インデックスを指定
- 価格取得は代替シンボルで行い、表示名・通貨は元の投資信託名を使う
- `funds.js` の `FUND_DEFS` / `fundSymbolFromName()` / `fundProxyOf()` で管理

---

## 直近の変更履歴

| バージョン | 内容 |
|---|---|
| 20260529A | a11y: 主要 UI に aria-label と role を追加 |
| 20260528Z | Issue#34 Phase 2 対応: 残りの confirm/alert を自作モーダルに置換 |
| 20260528Y | Issue#34 Phase 1 対応: 自作 confirm/alert モーダル実装 |
| 20260528X | Issue#66対応: dist/app.js を main マージ後に CI で自動ビルド |
| 20260528X | ESLint no-console: warn 導入、不要 console.log を整理 |
| 20260528W | utils.js のテストカバレッジ拡張（getColor 境界値・_tableSort 等） |
| 20260528V | Issue#54対応: import-ui.js の inline onclick を data-action 化（CSP前提条件） |
| 20260528U | positions-store.js の単体テスト追加 |
| 20260528T | Issue#58対応: csv.js の単体テスト追加（23ケース） |
| 20260527B | Issue#15修正: sw.js の CACHE 名を SW 登録 URL の `?v=` から動的生成。index.html のバージョン更新だけで自動同期 |
| 20260527A | Issue#11対応: アクセシビリティ改善 |
| 20260526F | Issue#17修正: statsバー横スクロール対応(flex:none→min-width:0)、バージョン表示をimport.meta.urlに変更 |
| 20260526E | ウォッチリストstickyティッカー列にwidth:130px固定追加（行固定崩れ修正） |
| 20260526D | コード品質改善: escapeHTML追加・XSS対策、PTRをptr.jsに分離、PINキーパッドdata-action化、resizeデバウンス、SW/PWA、vitest+CI、ESLint、Workerレート制限、localStorage quota対応 |
| 20260526C | sticky列固定・ステータス見切れ・ハンバーガー44px・パスキーボタン幅修正 |
| 20260526B | sticky列固定・ステータス見切れ・ハンバーガー44px化 |
| 20260526A | コードレビュー改善案#1-6適用: watchlist XSS修正、matchMedia二重登録解消、ロックアウト永続化、state.historicalAttempted正式定義、デッドコードをsrc/_disabled/に移動、_tableSortヘルパー追加 |
| 20260525C | 自動更新UIをハンバーガーメニューへ移動（5/10/30/60分）、マニュアルリンク追加、タイトル1行化 |
| 20260525B | Pull-to-refreshをSVGアイコンアニメーション（0→270deg回転→スピン）に変更 |
| 20260525A | SPEC.md全面更新（v=20260517g相当から現状へ追従）、PR#6マージ |
| 20260517H | 履歴ヒートマップ（Historical Heatmap）とウォッチリストの実装を共通化。stock-list.js・watchlist.js で同じ historicalCache を共有 |
| 20260517G | ひふみ投信の proxy シンボルを `1312.T` → `2516.T`（東証グロース250ETF）に変更 |
| 20260517F | 履歴データ「…」点滅表示の条件を「未試行」も含めるよう拡張 |
| 20260517E | 履歴データ取得中のセルを「…」点滅表示に |
| 20260517D | スナップショットにウォッチリスト（performance 付き）を追加 |
| 20260517B | スナップショットから historicals を除外（5.5MB→約20KB に削減） |
| 20260517A | タブ名修正: 保有銘柄リスト → Historical Heatmap |
| 20260517g | AI相談 system prompt を「投資壁打ちAIペルソナ」に高度化。`docs/ai-system-prompt.md` / `src/ai-system-prompt.js` 新設 |
| 20260517f | **大規模リファクタリング**: バグ修正、funds.js/csv.js 新設、CSS 5分割、import.js 3分割、auth.js 4分割、HTML の onclick → data-action 全置換 |
| 20260516i | マネックスCSV/マネフォスクショ取込モーダル、保有銘柄KV化、Worker Cron 6h価格キャッシュ |
| 20260516h | AI相談タブ全面リデザイン、Claude Desktop ウォームトーンデザイン |
| 20260516c | ディレクトリ構成整理（src/ assets/ docs/）、AI API外部化、パスキー認証追加 |
| 20260516b | Cloudflare Worker プロキシ実装、APIキーをWorker Secretsに移管 |
| 20260322f | PWA アイコン実装（SVG favicon、PNG 512/192/180px、manifest.json） |
| 20260322a | Finnhub 実装（Finnhub 優先→Yahoo フォールバック） |
| 20260311k | ウォッチリストタブ実装 |

---

## 開発ツール

### テスト
```bash
npm test          # vitest 単発実行（CI 相当）
npm run test:watch # ウォッチモード
```
- テストファイルは `tests/` 以下
- GitHub Actions `.github/workflows/test.yml` が push/PR 時に自動実行
- GitHub Actions `.github/workflows/daily-issues.yml` が毎日 0:00 UTC（9:00 JST）に open issues を自動修正して PR 作成
- `tests/fmt.test.js`: `fmtJPYInt`, `fmtPctInt`, `fmtShares`, `escapeHTML`, `getColor` の純関数テスト（vitest）

### リント・フォーマット
```bash
npm run lint        # ESLint（src/ / worker/src/）
npm run lint:fix    # 自動修正
npm run format      # Prettier 整形
```
- `eslint.config.js`: ESLint v9 flat config
- `.prettierrc`: シングルクォート・印刷幅 120

### utils.js の escapeHTML
- Yahoo Finance API 等の外部値を `innerHTML` に埋め込む前に必ず `escapeHTML(s)` を通す
- `escapeHTML` は `utils.js` に定義。`src/watchlist.js` の検索ドロップダウンで適用済み

---

## Claude Code 自律実行ルール

**以下の操作は確認なしで自律実行してよい**（環境非依存・全端末共通）:

| 操作 | 内容 |
|------|------|
| レビュー対応 | CodeRabbit 等のレビューコメントを読んで修正し、コメントに返信する |
| テスト対応 | テスト失敗を修正し、対応内容を Issue にコメントする |
| PR 操作 | PR を作成・マージし、マージ済みブランチを削除する |
| 自動 PR | `daily-issues.yml` が自動生成した PR をマージする |
| 依存追加 | `npm install <pkg> --save-dev` で devDependency を追加する |
| バージョン更新 | `?v=YYYYMMDDX` のバージョン文字列を更新する |
| Issue 管理 | Issue を作成・クローズする |
| CI 軽微修正 | GitHub Actions のタイムアウト・トリガー条件など軽微な修正 |

**以下は確認してから実行（変更しない）**:
- `git push --force` / `git reset --hard` / main ブランチ削除
- Secrets・認証情報の変更
- `CLAUDE.md` / `.claude/settings.json` の変更
- GitHub Actions ワークフローの大幅な変更

---

## よくある作業パターン

### 保有銘柄を更新する
`positions.js` の `positions` 配列を編集するだけ。他のファイルは不要。

### バージョンを上げる
index.html 内の `?v=YYYYMMDDX` を新しい値に全置換する。CSS・JS・SW 登録 URL（`./sw.js?v=...`）合わせて全箇所を同じ値に揃える。
`sw.js` の `CACHE` 名は SW 登録 URL の `?v=` から自動生成されるため、`sw.js` 本体の更新は不要（Issue#15 対応・v=20260527B〜）。

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
`data/portfolio-snapshot.json` を raw.githubusercontent.com 経由で取得可能（キャッシュラグ最大5分）:
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
  --accent    /* アクセントカラー（#cc785c = Claude ブラウン） */
}
```

**ルール:**
- 色は必ず変数で指定（ハードコード hex は NG）
- ライト/ダーク両モードでコントラスト比 4.5:1 以上を確保
- `auto` モードは `matchMedia` で解決、`data-theme` 属性で明示セット

### タイポグラフィ

```
フォント: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Hiragino Sans', Arial, sans-serif
サイズ: 10px(ラベル) / 11px(キャプション) / 12px(ステータス) / 13px(本文基本) / 14px(AI入力) / 15px(セクション) / 20px(ページ)
ウェイト: 400(通常) / 500(メニュー・タブ) / 600(ボタン・強調) / 700(見出し)
```

### スペーシング

```
基本単位: 4px
xs: 4-6px(ピル・バッジ) / sm: 8-10px(ボタン) / md: 12-14px(カード) / lg: 16-20px(ページ余白)
border-radius: 4px(バッジ) / 6-8px(ボタン) / 10-12px(カード) / 20px+(ピル) / 50%(丸)
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
| `localStorage.setItem('key', apiKey)` | Worker KV / Secrets |
| `setInterval` でポーリング | WebSocket / SSE / ユーザーアクション起点 |
| 深いセレクター `.a .b .c .d {}` | コンポーネントクラスを直接ターゲット |
| `innerHTML` にユーザー入力を直接展開 | `textContent` / エスケープ処理 |

### セキュリティチェックリスト

- [ ] ユーザー入力は `textContent` か `escapeHTML()` でエスケープ
- [ ] APIキーは Cloudflare Secrets / 環境変数
- [ ] CORS ホワイトリストを Worker で管理
- [ ] `.gitignore` に `.env`, `push.sh`, `*secret*` を追加
