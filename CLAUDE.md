# Portfolio Heatmap — Claude Code 引き継ぎ情報

## プロジェクト概要
Yahoo Finance API を使ったポートフォリオ可視化 Web アプリ。
ヒートマップ・銘柄リスト・ウォッチリストの3タブ構成。

- **本番 URL**: https://shoulang0729.github.io/portfolio/
- **GitHub**: https://github.com/shoulang0729/portfolio

---

## ファイル構成（8モジュール）

| ファイル | 役割 |
|---|---|
| `positions.js` | 保有銘柄データ・PERIODS 定義・PERIOD_COLS/IDS |
| `state.js` | 定数 (C)・アプリ状態 (state)・CHART_RANGES |
| `utils.js` | 共通ユーティリティ（色計算・フォーマット・makeTh/makePctCell） |
| `data.js` | Yahoo Finance API 通信・価格取得・履歴キャッシュ |
| `heatmap.js` | D3.js ヒートマップ描画 |
| `chart.js` | D3.js チャート描画 |
| `stock-list.js` | 銘柄リストタブ（スクロール表・ソート） |
| `watchlist.js` | ウォッチリストタブ（追加・削除・ソート） |
| `app.js` | イベントハンドラ・タブ切り替え・初期化 |

---

## デプロイ手順

```bash
# 1. バージョンを上げる（index.html の ?v=YYYYMMDDX を更新）
# 2. コミット
bash deploy.sh
# 3. VM はネットワーク制限で push できないため GitHub Desktop で Push origin
```

**バージョン命名規則**: `?v=YYYYMMDDX`（例: `20260311n`）
英字は同日複数リリース時に a, b, c… と順に振る。

---

## 主要な設計ルール

### ソートの仕組み
- `state.listSortCol` / `state.listSortDir` で銘柄リストのソート状態を管理
- `state.wlSortCol` / `state.wlSortDir` でウォッチリストのソート状態を管理
- ソート comparator は必ず antisymmetric にすること（等値で 0 を返す）
- 文字列ソートは `localeCompare('ja')` を使う

### 期間カラム
- 期間設定は `positions.js` の `PERIODS` 配列が唯一の定義元
- `PERIOD_COLS` / `PERIOD_IDS` は PERIODS から自動生成（positions.js 末尾）
- 新しい期間を追加するときは `PERIODS` を変更するだけで全テーブルに反映される

### 共通ヘルパー（utils.js）
- `makeTh(label, col, align, activeSortCol, sortDir, sortFnName)` — テーブルヘッダー `<th>` 生成
- `makePctCell(pct, scale, dataCol)` — 色付き % セル `<td>` 生成
- `getColor(pct, mode, scale)` — ヒートマップ色計算
- `getCellTextColor(bg)` — 背景色に合わせた文字色（白 or 黒）
- `fmtPctInt(pct)` — % 表示フォーマット（小数点1桁）

### ウォッチリスト
- `localStorage` の `hm-watchlist` キーに JSON 保存
- `wlGetPct(item, periodId)` で 1d は livePrice キャッシュ、他は historicalCache から取得
- 市場列バッジは `<span class="wl-type-badge">` のみ（タイプ別クラスなし）

### CSS テーマ
- CSS 変数 `--bg`, `--border`, `--text`, `--text2` などでダーク/ライト切り替え
- `.wl-type-badge` ：`background: var(--border); color: var(--text2)` のピル形式

---

## 直近の変更履歴

| バージョン | 内容 |
|---|---|
| 20260311n | 市場ソート comparator バグ修正（localeCompare使用）、ウォッチリスト市場バッジを銘柄リストと統一、.wl-type-badge に background/color 追加 |
| 20260311m | リファクタリング：makeTh/makePctCell を utils.js に共通化、PERIOD_COLS/IDS を positions.js へ移動、wlSortCol/Dir を state.js へ移動 |
| 20260311l | 市場列・市場ソートを銘柄リスト/ウォッチリストに追加、デフォルトソートを 1d 降順に変更 |
| 20260311k | ウォッチリストタブ実装（watchlist.js 新規作成） |

---

## よくある作業パターン

### 保有銘柄を更新する
`positions.js` の `positions` 配列を編集するだけ。他のファイルは不要。

### 新しいソート列を追加する
1. `stock-list.js` の `slSort()` に case を追加
2. `slRenderRows()` のテーブルヘッダーに `th('ラベル', 'col-id', 'center')` を追加
3. 行の `<td data-col="col-id">` を追加

### API が返す形式を変更する
`data.js` の `fetchLivePrices()` / `fetchHistoricalData()` を確認する。
Yahoo Finance の crumb は `state.yahooCrumb` にキャッシュされ、期限切れで再取得される。
