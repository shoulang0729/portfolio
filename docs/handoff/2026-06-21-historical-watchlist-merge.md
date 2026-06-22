# Handoff（2026-06-21）: Historical ＋ Watchlist タブ統合（セグメントピル方式）

> ✅ **実装完了（2026-06-22・PR #457 マージ済）**＝2タブをセグメントピル[全部/保有/ウォッチ]で1タブ統合。load-bearing 改修につき事前レビュー経由でマージ。PM盤面モニタにて完了確認。
> 設計=Mulmo。実装は VS Code が本 doc を正本に着手。1タスク=1ブランチ=1PR=1Issue。
> ⚠ 影響範囲が広い（タブ構成・state・e2e）＝**load-bearing 改修**。マージ方針は Toshio 事前レビュー（大規模）。

## 背景／ゴール
2タブ（Historical Heatmap＝保有 / Watchlist Heatmap＝ウォッチ）は期間ヒートマップ・キャッシュ・ヘルパーを既に共有。**1タブに統合**し、保有/ウォッチを**セグメントピル[全部/保有/ウォッチ]で切替**（ユーザー確定）。

## 現状の差分
| 項目 | Historical（`stock-list.js`, tab=`list`） | Watchlist（`watchlist.js`, tab=`watchlist`） |
|---|---|---|
| データ源 | `positions.js`（KV `/positions`・PIN） | `state.watchlist`（localStorage `hm-watchlist`＋KV `/watchlist`） |
| 列 | 名/市場/**評価額/保有数/取得単価**/現在値/期間×10/**含み損益/損益率** | 名/市場/現在値/期間×10/**削除×** |
| 価格 | `position.price` | `state.watchlistPrices[sym]` |
| ソート状態 | `state.listSortCol/Dir` | `state.wlSortCol/Dir` |
| 追加/削除 | なし | Yahoo検索追加・`removeFromWatchlist` |
| 固有UI | 評価額バー(`applyStockBars`)・詳細列トグル | 検索ボックス＋ドロップダウン |
| パネル | `#panel-list`/`#stock-list-wrap` | `#panel-watchlist`/`#watchlist-table-wrap` |

**共有**: `makeTh`/`makePctCell`/`makePeriodCells`/`_tableSort`/`getColor`/`getHistoricalChangePct`、`PERIODS` 系、`.sl-table` 骨格、高さ調整ロジック。

## マージ設計（確定：セグメントピル）
- **タブ名 `Historical`**（タブバーから `Watchlist` 削除）。`data-tab` は既存 `list` を流用（タブ復元/e2e 互換）。
- **ヘッダ（sticky-top）**：左にセグメントピル `[全部][保有][ウォッチ]`、右に検索ボックス＋詳細列トグル。セグメントは新 `state.heatSeg`（既定 `all`・localStorage 永続）。
- **セグメント挙動**：
  - `保有` = positions のみ。検索欄は隠す（保有は追加不可）。評価額バー・保有額系列を表示。
  - `ウォッチ` = watchlist のみ。検索欄＋削除ボタン表示。保有専用列は非表示。
  - `全部` = 結合。**区分バッジ（保有=primary色 / ウォッチ=muted）を symbol セルに付与**。保有専用列はウォッチ行で空セル `–`、削除×はウォッチ行のみ、バー は value 有り行のみ。
- **列（統合）**：ティッカー＋名 / **区分バッジ**（全部時） / 市場 / 評価額 / 保有数 / 取得単価 / 現在値 / 期間×10 / 含み損益 / 損益率 / 削除。保有額系はウォッチ行で空、削除はウォッチ行のみ。
- **検索追加スコープ**：検索は常に watchlist へ（`addToWatchlist`）。`保有` では検索欄を隠す。`全部`で追加した銘柄はウォッチ区分で出る。
- **ソート（2状態→1）**：`state.heatSortCol/heatSortDir`（既定 `1d`/`desc`、`symbol` のみ asc）。comparator は antisymmetric（等値0）・null/保有額なし行は末尾固定。`slSort`/`wlSort` → 単一 `heatSort(col)`。
- **削除**：`removeFromWatchlist` 据置。保有行に×ボタンを描画しない。

### 代替案と却下理由
- (b) 保有/ウォッチを縦に2セクション：同一期間列での横断比較（ヒートマップ本来の狙い）を満たせず、スマホで縦伸び・sticky2重。却下。
- (c) 区分列＋常に全件固定：(a) の `全部` 固定版。保有だけ/ウォッチだけに集中したいニーズに応えられず保有専用列が常に半分空く。(a) が包含するので却下。

## 影響ファイルと変更の形（コードは書かない・設計のみ）
- **`src/state.js`**：`heatSeg`('all'|'held'|'watch')・`heatSortCol`/`heatSortDir` 追加。`listSortCol/Dir`・`wlSortCol/Dir` は統合（移行期エイリアス可）。
- **`src/stock-list.js`（統合先・リネーム候補 `heatmap-list.js`）**：`renderStockList`＋`renderWatchlist` → 単一 `renderHeatmapList()`。保有行/ウォッチ行ビルダに分け、セグメントで items 構築→共通 `makePeriodCells`/`makeTh`。`getPctForPeriod`/`wlGetPct` → `heatGetPct(item)`（`item.kind` 分岐）。`slSort`/`wlSort` → `heatSort`。
- **`src/watchlist.js`**：STORAGE/SEARCH/FETCH（`addToWatchlist`/`removeFromWatchlist`/`onWatchlistSearch`/`searchTicker`/`fetchWatchlistData`/`wlDetectMarket` 等）はデータ層として残置、render 部のみ統合先へ委譲。
- **`index.html`**：タブバーから `Watchlist` 削除。`#panel-watchlist` 廃止し `#panel-list` 一本化。sticky-top にセグメントピル＋検索＋詳細トグルを再配置。`?v=` bump。
- **`src/tabs.js`**：`switchTab` の `watchlist` 分岐削除、`list` 分岐で `_loadWatchlistFromWorker`→`renderHeatmapList`→`fetchWatchlistData`。
- **`src/app.js`**：`heatSort`・セグメント切替アクション（例 `setHeatSeg`）を data-action 登録。`renderStockList`/`renderWatchlist` 呼出を `renderHeatmapList` に置換。
- **`src/render.js`**：`updateListHeight`/`updateWatchlistHeight` を1つに。
- **`assets/02-tables.css, 03-misc.css`**：セグメントピル・区分バッジ・混在行・検索欄常時表示のレイアウト。

## 移行・テスト上の注意
- **初回起動**：`renderStockList()` 必須呼出（app.js）と watchlist 遅延ロードのタイミング差 → 初期は保有のみ即描画、ウォッチは `fetchWatchlistData` 完了後に再描画の二段が無難。
- **sticky/バー**：セグメント切替＝列構成変化 → `requestAnimationFrame(applyStockBars)` で `symTh.getBoundingClientRect` 再実行。
- **localStorage 移行**：`hm-active-tab` に旧 `'watchlist'` が残るユーザー向けに `switchTab` で `'list'` へ正規化するマイグレーション。
- **e2e（要更新）**：`e2e/tabs.spec.js`（`#panel-watchlist` 可視性3テスト・`[data-tab="watchlist"]`）、`e2e/watchlist.spec.js`（冒頭の panel 前提）をタブ統合＋ウォッチセグメント選択に書換。`.wl-empty-msg`/`#wl-search-input`/`.wl-search-item` セレクタは流用可。
- **CLAUDE.md**：「3タブ構成」「ウォッチリスト」「新しいソート列を追加する」節を実装時に更新。

## 受け入れ条件
- [ ] 1タブに統合され、セグメント[全部/保有/ウォッチ]で切替。`全部`で区分バッジ、保有専用列はウォッチ行で空、削除はウォッチ行のみ。
- [ ] 検索追加はウォッチへ、`保有`では検索欄非表示。保有は削除不可。
- [ ] ソートが単一状態で antisymmetric、null/空値は末尾。期間ヒートマップ色は不変。
- [ ] 旧 `watchlist` タブ復元値でも壊れない（マイグレーション）。e2e 更新で green。
- [ ] 品質ゲート green／`?v=` 全 bump／data-action委譲・escapeHTML・色CSS変数・`!important`禁止。

## 触ってはいけない範囲
- `PERIODS` 系の期間定義（単一ソース）・`getHistoricalChangePct`・historicalCache スキーマ。
- `addToWatchlist`/`removeFromWatchlist`/KV `/watchlist`・`/positions` の通信契約。
- `dist/app.js`・`assets/*.css` への prettier 一括。

## ブランチ／PR／Issue
- ブランチ `feat/heatmap-tabs-merge`、base `main`。`Closes #<Issue>`。大規模＝Toshio 事前レビュー。
