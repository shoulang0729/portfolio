# 設計規約（Design System）とアプリの実装ルール

> CLAUDE.md から移した詳細（#722・`docs/handoff/2026-10-05-refactor-before-migration.md` §4）。要点は [CLAUDE.md](../CLAUDE.md)「主要な設計ルール」、開発ツールと作業手順は [docs/dev-guide.md](./dev-guide.md)。
> フロントエンド実装の落とし穴（プロジェクト非依存の罠と対策）は [docs/frontend-gotchas.md](./frontend-gotchas.md)。

## 1. カラーシステム（CSS変数トークン）

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

### CSS テーマ（Claude Desktop ウォームトーン）
- CSS 変数 `--bg`, `--border`, `--text`, `--text2`, `--surface`, `--accent` でダーク/ライト切り替え（定義は `assets/01-base.css`）
- ベースパレット: ライト `#f7f2ee` / ダーク `#1c1917`（Claude Desktopトーン）
- アクセントカラー: `#cc785c`（Claude ブラウン）
- `--accent` 以外はハードコード hex 禁止
- `#watchlist-table-wrap` に `overflow-x: auto` を設定（スマホ横スクロール対応）

### ヒートマップの色
- 騰落率の色は `getColor(pct, mode, scale)`（`src/fmt.js`）と `src/positions.js` の期間別スケールで決まる。濃淡は業務仕様なので、設計書の指示なしに変えない。
- セルの文字色は `getCellTextColor(bg)`（`src/color.js`）が背景色に合わせて白／黒を返す。

## 2. タイポグラフィ

```
フォント: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Hiragino Sans', Arial, sans-serif
サイズ: 10px(ラベル) / 11px(キャプション) / 12px(ステータス) / 13px(本文基本) / 14px(入力) / 15px(セクション) / 20px(ページ)
ウェイト: 400(通常) / 500(メニュー・タブ) / 600(ボタン・強調) / 700(見出し)
```

## 3. スペーシング

```
基本単位: 4px
xs: 4-6px(ピル・バッジ) / sm: 8-10px(ボタン) / md: 12-14px(カード) / lg: 16-20px(ページ余白)
border-radius: 4px(バッジ) / 6-8px(ボタン) / 10-12px(カード) / 20px+(ピル) / 50%(丸)
```

## 4. コーディング規約

**HTML:**
- ID はシングルトン、class は再利用可能
- `data-*` 属性で JS フック、スタイルフックには使わない
- `onclick=` は使わない（`data-action` 委譲・§5.1）

**JavaScript:**
- グローバル変数/関数は最小化、モジュールごとにファイル分割（ESM。`src/app.js` を入口に esbuild でバンドル）
- 状態は `state` オブジェクト（`src/state.js`）に集約
- DOM 操作は初期化時に querySelector でキャッシュ
- API 呼び出しは `try/catch`、エラーは UI に表示
- `async/await` + `Promise.allSettled()` で並列呼び出し

**CSS:**
- 色・サイズ・シャドウは CSS 変数のみ
- クラス命名: `コンポーネント名-要素名-修飾子` の BEM ライク規則
- セレクター深さは3段まで
- `!important` は使わない
- `assets/*.css` に `prettier --write` を掛けない

## 5. アプリの実装ルール

### 5.1 data-action イベント委譲
- HTML 要素に `data-action="funcName"` / `data-action="fn1|fn2"` を付ける
- `src/app.js` のアクションマップと委譲ディスパッチャが一括で処理する
- インライン `onclick=` は使わない（`auth-ui.js` 内の一部 PIN キーパッドを除く）
- `data-arg="value"` で引数を渡す。`data-event="input"` で click 以外のイベントを登録

### 5.2 ソートの仕組み
- `state.heatSortCol` / `state.heatSortDir` で統合 Historical タブ（保有＋ウォッチ）のソート状態を管理（#452。旧 `listSortCol`/`wlSortCol` は廃止）
- `state.heatSeg`（`all`/`held`/`watch`）でセグメント表示を管理（localStorage `hm-heat-seg` 永続）
- ソート comparator は必ず antisymmetric にすること（等値で 0 を返す）。null・保有専用列の空値は dir 非依存で末尾固定
- 文字列ソートは `localeCompare(..., 'ja')` を使う

### 5.3 期間カラム
- 期間設定は `src/positions.js` の `PERIODS` 配列が唯一の定義元
- `PERIOD_COLS` / `PERIOD_IDS` / `PERIOD_MAP` は PERIODS から自動生成（positions.js 末尾）
- 新しい期間を追加するときは `PERIODS` を変更するだけで全テーブルに反映される

### 5.4 共通ヘルパー
`src/utils.js` は `fmt.js` などの関数を再エクスポートしている。定義元は次のとおり。
- `makeTh(label, col, align, activeSortCol, sortDir, sortFnName)` — テーブルヘッダー `<th>` 生成（`src/table.js`）
- `makePctCell(pct, scale, dataCol)` — 色付き % セル `<td>` 生成（`src/table.js`）
- `_tableSort(colKey, dirKey, col, defaultAscCols)` — テーブルのソート切り替え共通処理（`src/table.js`）
- `getColor(pct, mode, scale)` — ヒートマップ色計算（`src/fmt.js`）
- `getCellTextColor(bg)` — 背景色に合わせた文字色（白 or 黒）（`src/color.js`）
- `fmtPctInt(pct)` — % 表示フォーマット（整数に丸める）（`src/fmt.js`）
- `fmtJPYInt(val)` — 日本円整数フォーマット（億・万・円）（`src/fmt.js`）
- `getHistoricalChangePct(ySymbol, periodId)` — historicalCache から期間騰落率を取得（`src/portfolio-calc.js`）
- `escapeHTML(s)` — HTML エスケープ（`src/fmt.js`。`utils.js` からも import できる）

### 5.5 escapeHTML
- Yahoo Finance API 等の外部値を `innerHTML` に埋め込む前に必ず `escapeHTML(s)` を通す
- ユーザー入力も同じ（または `textContent` を使う）

### 5.6 ウォッチリスト
- `localStorage` の `hm-watchlist` キーに JSON 保存 + Worker KV（`PUT /watchlist`）に同期
- データ層は `src/watchlist.js`、描画は統合 Historical タブの `src/stock-list.js`（#452）
- 統合タブの期間騰落率は `heatGetPct(row, periodId)`（`src/stock-list.js`）で、1d はライブ値、他は historicalCache から取得
- 市場列バッジは `<span class="wl-type-badge">` のみ（タイプ別クラスなし）
- 検索は Yahoo Finance の chart/quoteSummary API（Finnhub の Search API は未使用）

### 5.7 投資信託の扱い
- `isProxy: true` の銘柄は `ySymbol` に代替インデックスを指定
- 価格取得は代替シンボルで行い、表示名・通貨は元の投資信託名を使う
- `src/funds.js` の `FUND_DEFS` / `fundSymbolFromName()` / `fundProxyOf()` で管理

## 6. アンチパターン

| NG | 代替案 |
|---|---|
| `el.style.color = '#ff0000'` | CSS class toggle / CSS 変数 |
| `document.write(...)` | innerHTML / createElement |
| APIキーをフロントに書く | Cloudflare Worker Secrets |
| `localStorage.setItem('key', apiKey)` | Worker KV / Secrets |
| `setInterval` でポーリング | WebSocket / SSE / ユーザーアクション起点 |
| 深いセレクター `.a .b .c .d {}` | コンポーネントクラスを直接ターゲット |
| `innerHTML` にユーザー入力を直接展開 | `textContent` / エスケープ処理 |

## 7. セキュリティチェックリスト

- [ ] ユーザー入力・外部 API の値は `textContent` か `escapeHTML()` でエスケープ
- [ ] APIキーは Cloudflare Secrets / 環境変数（フロントに置かない）
- [ ] CORS ホワイトリストを Worker で管理（`ALLOWED_ORIGIN`）
- [ ] `.gitignore` に `.env`, `push.sh`, `*secret*` を追加
- [ ] 個人の資産データ（物件・評価額・負債・ネットワース実額・口座情報）と秘密の値をコミットしない（テストデータは合成値）
