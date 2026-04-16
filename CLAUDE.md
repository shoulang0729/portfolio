# Portfolio Heatmap — Claude Code 引き継ぎ情報

## プロジェクト概要
Finnhub API（優先）+ Yahoo Finance API（フォールバック）を使ったポートフォリオ可視化 Web アプリ。
ヒートマップ・銘柄リスト・ウォッチリストの3タブ構成。

- **本番 URL**: https://shoulang0729.github.io/portfolio/
- **GitHub**: https://github.com/shoulang0729/portfolio

---

## ファイル構成（9モジュール）

| ファイル | 役割 |
|---|---|
| `positions.js` | 保有銘柄データ・PERIODS 定義・PERIOD_COLS/IDS |
| `state.js` | 定数 (C)・アプリ状態 (state)・CHART_RANGES |
| `utils.js` | 共通ユーティリティ（色計算・フォーマット・makeTh/makePctCell） |
| `data.js` | Finnhub/Yahoo Finance API 通信・価格取得・履歴キャッシュ |
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

**バージョン命名規則**: `?v=YYYYMMDDX`（例: `20260322b`）
英字は同日複数リリース時に a, b, c… と順に振る。

---

## データソース設計

### Finnhub（優先）
- APIキー: `FINNHUB_KEY`（data.js に定数定義）
- シンボル変換: `toFinnhubSymbol(ySymbol)` — `9983.T` → `TYO:9983`、US株はそのまま
- ライブ価格: `fetchFinnhubQuote(fSymbol)` — `dp`（日次騰落率）・`c`（現在値）を返す
- 履歴データ: `fetchFinnhubCandles(fSymbol, fromTs, toTs)` — 日足 OHLCV
- 無料枠: 60リクエスト/分

### Yahoo Finance（フォールバック）
- Finnhub が失敗した場合に自動切り替え（投資信託プロキシなど未収録銘柄向け）
- 4段フォールバック: query1直接 → query2直接 → corsproxy.io → allorigins
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
- 検索は Yahoo Finance の chart/quoteSummary API（Finnhub の Search API は未使用）

### CSS テーマ
- CSS 変数 `--bg`, `--border`, `--text`, `--text2` などでダーク/ライト切り替え
- `.wl-type-badge` ：`background: var(--border); color: var(--text2)` のピル形式
- `#watchlist-table-wrap` に `overflow-x: auto` を設定（スマホ横スクロール対応）

---

## 直近の変更履歴

| バージョン | 内容 |
|---|---|
| 20260417a | ポートフォリオ更新（1629:500:1分割・8050:2:1分割・PLTR追加・GLDM/MSFT/XLE株数変更・SHV減少）、Finnhub異常価格スキップ修正（updateCache±70%チェック） |
| 20260322f | PWA アイコン実装（ヒートマップグリッドデザイン、dark/light SVG favicon、PNG 512/192/180px、manifest.json） |
| 20260322e | 投資信託追加（ひふみ3銘柄・PIMCO-ST）、CSV ボタンコメントアウト |
| 20260322b | ウォッチリストのスマホ表示修正（overflow-x: auto 追加・プレースホルダー短縮） |
| 20260322a | Finnhub 実装（Finnhub 優先→Yahoo フォールバック）、ポートフォリオ更新（SHLD/SHV/XLE 追加、EPI/EPP等削除、投資信託をオルカンのみに） |
| 20260311o | Yahoo Finance 安定性改善（query2追加・バッチ取得・リトライ） |
| 20260311n | 市場ソート comparator バグ修正、ウォッチリスト市場バッジ統一 |
| 20260311m | リファクタリング：makeTh/makePctCell 共通化、PERIOD_COLS/IDS 移動 |
| 20260311l | 市場列・市場ソートを銘柄リスト/ウォッチリストに追加 |
| 20260311k | ウォッチリストタブ実装（watchlist.js 新規作成） |

---

## よくある作業パターン

### 保有銘柄を更新する
`positions.js` の `positions` 配列を編集するだけ。他のファイルは不要。

### 新しいソート列を追加する
1. `stock-list.js` の `slSort()` に case を追加
2. `slRenderRows()` のテーブルヘッダーに `th('ラベル', 'col-id', 'center')` を追加
3. 行の `<td data-col="col-id">` を追加

### Finnhub が取れない銘柄への対処
- `fetchFinnhubQuote` が null を返すと自動で Yahoo Finance にフォールバック
- 東証シンボルで取れない場合は `toFinnhubSymbol` の変換ロジックを確認
- 投資信託は `isProxy: true` + `ySymbol` に代替インデックスを指定して対処
