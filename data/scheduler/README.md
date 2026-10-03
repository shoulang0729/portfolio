# 自動供給バッチ（A3 quality / A4 ETF PER）

`valuations.json` の `quality` / `value` / `sectorMedian` ブロックと `verdict-outcomes.json` を週次で自動更新するバッチ群。
**GitHub Actions（`.github/workflows/weekly-valuations.yml`・毎週日曜 02:00 UTC）で実行する**（#652 PR5）。
外部 API はすべて Worker 中継口（`/fmp` `/edinet-db` `/edgar` `/finnhub` `/yahoo`）経由で、**API キーは不要**
（キーは Worker Secrets 側。GitHub Secrets にも置かない）。手元で実行する場合も同じコマンドでキー不要。

## スクリプト

| ファイル | 対象 | データソース | 更新ブロック |
|---|---|---|---|
| `quality-us.mjs` | 米国個別株（ETF 除外） | FMP stable API（Worker `/fmp`・優先）→ SEC EDGAR（Worker `/edgar`・フォールバック） | `quality` |
| `quality-jp.mjs` | 日本個別株（`.T`・ETF 除外） | EDINET DB API（Worker `/edinet-db`） | `quality` |
| `etf-pe.mjs` | ETF 10銘柄（広域株式＋セクター/テーマ） | Yahoo `summaryDetail.trailingPE`（Worker `/yahoo` 経由） | `value`（perTrail＋perSource） |
| `target-gap.mjs` | 個別株（quality 持ち・HK 除外） | Yahoo `financialData.targetMeanPrice`（Worker `/yahoo` 経由） | `value.targetGapPct`（既存 value にマージ） |
| `sector-median.mjs` | 米個別株（quality 持ち） | Finnhub `/stock/peers`→`/stock/metric`（Worker `/finnhub` 経由） | `sectorMedian` |
| `jp-sector-median.mjs` | 日本個別株（静的セクターETF マップ登録分） | Yahoo quoteSummary（Worker `/yahoo` 経由） | `value`（未設定のみ補完）・`sectorMedian` |
| `hit-rate.mjs` | verdict-outcomes の horizon 経過 pending | Yahoo chart（対象＋ACWI・Worker `/yahoo` 経由） | `data/verdict-outcomes.json` の `proposedOutcome`/`resolvedAt` |
| `diff-report.mjs` | — | `git show HEAD:<file>` と作業ツリーの比較（読むだけ） | なし（差分の Markdown を標準出力へ） |

Worker 中継口の呼び出しは `lib/worker-client.mjs` 経由（`Origin` ヘッダ・タイムアウト 25 秒・429/5xx リトライ・
レート制限対象パスは 600ms 間隔）。直接取得するのは SEC の `company_tickers.json`（Worker の許可パス外・キー不要）だけ。

`quality-*` は純関数 `src/quality-calc.js` の `computeQuality()` で指標を算出。
`etf-pe.mjs` は ETF のファンド実績PER を `value.perTrail` に投入し `value.perSource:"fund-trailing"` を立てる
（FMP は ETF の PER を持たないため Yahoo 経由・予想PER/PEG は ETF では取得不能なので触らない。設計＝`docs/d3-etf-proxy-data-availability.md` §7）。
`target-gap.mjs` は `(targetMeanPrice / currentPrice − 1)` を %（整数）で `value.targetGapPct` に投入。
アナリスト未カバー（例 6016.T）は null 継続・ETF/HK は対象外（#427）。
いずれも `data/scheduler/writeback.mjs` の `writeBlocks()` で**該当ブロックだけ**を元フォーマット保持で書き換える（インデント幅は自動検出）。
**スクリプトは作業ツリーに書くだけで `git commit` / `git push` はしない**（コミットはワークフローが 1 回で行う）。

> ⚠️ `etf-pe.mjs` の対象は広域株式（VT/VEA/VGK/ACWI）＋セクター/テーマ（SMH/XLF/XLV/XLP/DTCR/SHLD）の10銘柄のみ。
> シクリカル（COPX/REMX/XLE＝`cyclical` で na）・日本欠損 ETF（1629/1477/2516/200A.T＝percentile 判定維持）は対象外。

## 実行（GitHub Actions・`weekly-valuations.yml`）

| モード | 起動 | 動作 |
|---|---|---|
| `report`（既定） | schedule（毎週日曜 02:00 UTC）／workflow_dispatch | 7 本を順に実行（`quality-us` → `quality-jp` → `etf-pe` → `target-gap` → `sector-median` → `jp-sector-median` → `hit-rate`）→ `diff-report.mjs` の差分をジョブサマリと artifact（`weekly-diff-<日付>`・30 日）に出して終了。**commit しない** |
| `write` | workflow_dispatch で `mode=write` を選んだときだけ（PR5 時点） | `report` と同じ＋ `data/valuations.json` / `data/verdict-outcomes.json` を 1 回で commit → push（`pull --rebase`＋最大 3 回リトライ・21:00〜22:30 UTC は push しない）→ 同じジョブで `kv-resync.mjs --json` |

- 1 本が失敗しても残りは続け、最後にジョブを失敗にする。失敗時はラベル `weekly-batch-failed` の Issue を起票/更新し、成功で自動クローズ。
- concurrency グループは `portfolio-data-batch`（毎日の PER などと共通・`cancel-in-progress: false`）。
- 公開リポのため、ログ・サマリ・artifact に出すのは銘柄シンボル・指標値・件数まで（HTTP 本文は出さない）。

## CLI フラグ

| フラグ | 効果 |
|---|---|
| `--dry-run` | 取得・計算のみ。ファイルに書き込まない |
| `--symbol AAPL` | 1 銘柄だけ処理（動作確認用・`jp-sector-median` / `hit-rate` 以外） |

```bash
# 動作確認（書き込まない・キー不要）
node data/scheduler/quality-us.mjs --dry-run --symbol AAPL
node data/scheduler/quality-jp.mjs --dry-run --symbol 6301.T

# 作業ツリーに書く（commit はしない）→ 差分を確認
node data/scheduler/quality-us.mjs
node data/scheduler/diff-report.mjs
```

## 注意点

- **EDINET DB の USGAAP filer（例: コマツ 6301.T）は `gross_profit` が異常値**になるため、
  `src/edinet-normalize.js` が `accounting_standard === 'USGAAP'` の場合 `grossProfit=null` に変換する。
- JP バッチは `marketCap` を渡さないため `altmanZ` は null になる（許容）。
- FMP の新キーは `/stable/` エンドポイントのみ有効（v3 legacy は 401）。
- フロントと同じく、本バッチも Worker 経由（`/fmp` `/edgar` `/edinet-db` `/finnhub` `/yahoo`）でキーを隠蔽する。
  バッチ側にキーを読むコード（環境変数・設定ファイル）は無い。

## 毎日の PER（GitHub Actions・並行運転中・#652 PR2）

`.github/workflows/per-daily.yml` が毎日 **計算のみ**（`--write` なし）で PER を算出し、Mulmo の確定値と自動で突き合わせる。
この段階では `data/valuations.json` を書き換えない（書き込みへの切り替えは 3 日連続一致の後・PR3）。

| ファイル | 内容 |
|---|---|
| `watchlist-per.mjs` | `valuations` の全銘柄の実績PER を Worker `/yahoo` から取得し、バンド内%タイルと status を計算（原本＝Mulmo ワークスペース版の移植・計算は不変）。`--out <file>` / `--write` / 銘柄指定 |
| `fund-per.mjs` | `fund-holdings.json`（ひふみ上位10・公開開示）の加重実績PER と coverage。`--out <file>` / `--write` |
| `fund-holdings.json` | ファンドの上位10銘柄（月次レポートの公開情報） |
| `per-compare.mjs` | shadow の結果と Mulmo の確定コミットの `valuations.json` を突き合わせ（`match` / `band-changed` / `mismatch-input` / `mismatch-logic` / `one-side-skip`） |
| `lib/per-calc.mjs` / `lib/json-format.mjs` / `lib/per-compare.mjs` | 純関数（`tests/per-calc.test.js` ほか） |

- 20:15 UTC `shadow`：計算 → artifact `per-shadow-<UTC日付>`（保持 7 日）。
- 01:30 UTC `compare`：前日 UTC 日付の artifact と突き合わせ → トラッキング Issue（ラベル `per-shadow`）に連続一致日数を記録、不一致日は差分表をコメント。
- 手元での確認（キー不要・書き込まない）：`node data/scheduler/watchlist-per.mjs --out /tmp/w.json AAPL`
