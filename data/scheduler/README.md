# 自動供給バッチ（A3 quality / A4 ETF PER）

`valuations.json` の `quality` / `value` / `sectorMedian` ブロックと `verdict-outcomes.json` を週次で自動更新するバッチ群。
**GitHub Actions（`.github/workflows/weekly-valuations.yml`・毎週日曜 02:00 UTC）で実行する**（#652 PR5・PR6 から書き込み）。
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
| `report` | workflow_dispatch（既定） | 7 本を順に実行（`quality-us` → `quality-jp` → `etf-pe` → `target-gap` → `sector-median` → `jp-sector-median` → `hit-rate`）→ `diff-report.mjs` の差分をジョブサマリと artifact（`weekly-diff-<日付>`・30 日）に出して終了。**commit しない** |
| `write` | schedule（毎週日曜 02:00 UTC・PR6 から）／workflow_dispatch で `mode=write` | `report` と同じ＋ `data/valuations.json` / `data/verdict-outcomes.json` を 1 回で commit → push（`pull --rebase`＋最大 3 回リトライ・21:00〜22:30 UTC は push しない）→ 同じジョブで `kv-resync.mjs --json` |

- 1 本が失敗しても残りは続け、最後にジョブを失敗にする。失敗時はラベル `weekly-batch-failed` の Issue を起票/更新し、成功で自動クローズ。
- concurrency グループは `portfolio-data-batch`（毎日の PER などと共通・`cancel-in-progress: false`）。
- 公開リポのため、ログ・サマリ・artifact に出すのは銘柄シンボル・指標値・件数まで（HTTP 本文は出さない）。

## null ガードと `staleFields`（#652 PR6）

`quality` / `value` / `sectorMedian` の書き戻しは `lib/null-guard.mjs` の `writeGuardedBlocks()` を通る
（`writeback.mjs` の `writeBlocks()` はそのまま使う）。データ提供元の欠損で値が null になっても、既存値を消さないため。

- **新しい値が null・既存値が非 null** のフィールドは、既存値を保持し、エントリ直下の `staleFields` に印を付ける。
  キー＝`"<ブロック>.<フィールド>"`（例 `"quality.roic"`）、値＝null を最初に観測した日（UTC・`YYYY-MM-DD`）。
- 引き続き null なら値は保持のまま・日付は最初の観測日を維持。**非 null が取れたら新値を書き、印を外す**（回復）。
  印が全部外れたら `staleFields: {}` を残す（キーは削除しない）。印が変わらない銘柄では `staleFields` に触れない。
- ガードしないもの：新ブロックに**キーが無い**フィールド（`etf-pe.mjs` の丸ごと置換）・既存も null（または既存ブロック無し）・
  銘柄ごとスキップ（取得失敗）・`verdict-outcomes.json`（`hit-rate.mjs`）・毎日の PER。
- 新ブロック自体が null（`computeQuality` が null 等）で既存ブロックがあれば、既存ブロックを丸ごと保持し、非 null だった各フィールドに印。
- 派生値は再計算しない（`roic` を保持しても `qScore` は新しく算出された値）。
- ログは `  [null-guard] <銘柄> <ブロック>.<フィールド>: null → 既存値を保持（stale since <日付>）`（値は出さない）。
- 差分レポート（`diff-report.mjs`）は `staleFields` の変化を「null 化（保持）」「保持継続」「回復（old→new）」の節で出し、
  サマリに列「うち null 化（保持）」を足す。既存の「うち null 化」は**保持されずに null になった件数**。
- Mulmo（Briefing 生成・書き戻し）は `staleFields` を消さない・書き換えないこと。

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
- ひふみ上位10の月次更新（`fund-holdings-update.mjs`・#656）は毎回 2026-05 の月次レポート PDF で自己検証する。この PDF が公開終了（404）になったら、取得できる月の PDF で `lib/hifumi-known.mjs` の `KNOWN_MONTH`/`KNOWN_TOP10` を更新する（それまで更新は止まる）。

## 毎日の PER（GitHub Actions・`per-daily.yml`・#652 PR3）

`.github/workflows/per-daily.yml` が毎日 **20:15 UTC** に PER を計算して `data/valuations.json` に書き込み、push する
（PR2 の並行運転と突き合わせ＝compare ジョブ・01:30 UTC は廃止。同時刻の全銘柄一致を確認して切り替え・設計書 §6）。

| ファイル | 内容 |
|---|---|
| `watchlist-per.mjs` | `valuations` の全銘柄の実績PER を Worker `/yahoo` から取得し、バンド内%タイルと status を計算（原本＝Mulmo ワークスペース版の移植・計算は不変）。`--write` で銘柄の `perCurrent`/`percentile`/`status`/`asOf` とトップの `updated`/`asOf` を更新。`--out <file>` / 銘柄指定 |
| `fund-per.mjs` | `fund-holdings.json`（ひふみ上位10・公開開示）の加重実績PER と coverage。`--write` でファンドエントリの `perCurrent`/`coverage`/`source`/`asOf`/`components` を追加マージ。`--out <file>` |
| `fund-holdings.json` | ファンドの上位10銘柄（月次レポートの公開情報） |
| `per-daily-gate.mjs` | ワークフローの判定 CLI：`mode`（開始 20:55〜22:30 UTC は計算のみ）／`push-ok`（21:00〜22:30 UTC は push しない）／`message <日付>`（コミットメッセージ）／`updated <file>`（ウォッチの更新件数・0 件で exit 4）／`check-diff`（許可フィールド以外の変更・書式の変化を検出） |
| `per-compare.mjs` | PR2 の突き合わせ CLI（ワークフローからは呼ばない・参考に残置） |
| `lib/per-calc.mjs` / `lib/json-format.mjs` / `lib/per-daily.mjs` / `lib/per-compare.mjs` | 純関数（`tests/per-calc.test.js`・`tests/per-daily.test.js` ほか） |

ジョブの流れ（`write` ジョブ・schedule／workflow_dispatch とも同じ）：

1. 開始時刻が 20:55〜22:30 UTC なら**計算のみ**（書き込み・コミットしない。ジョブサマリと `::warning` で通知）。
2. `watchlist-per.mjs --write` → `fund-per.mjs --write`（書式＝インデント・末尾改行は読み込んだファイルのまま）。
3. `per-daily-gate.mjs check-diff`：`valuations.json` 以外のファイルの変更、許可フィールド以外の変更、書式の変化があれば失敗。
4. commit：メッセージは**固定形式 `data: daily PER <YYYY-MM-DD>`**（日付＝書き込んだ `asOf`＝実行時の UTC 日付）、
   author は `github-actions[bot]`。差分が無い日も `--allow-empty` で作る。
   Mulmo はこのコミットが main にあるかで「Actions が当日分を書いたか」を判定する（`valuations.json` 最上位の `asOf`/`updated` は Briefing の書き戻しでも変わるため判定に使わない）。
5. push：`git fetch` → `git rebase --empty=keep --reapply-cherry-picks origin/main`（`git pull --rebase` 相当。
   判定用コミットが空・main と同内容でも落とさない）→ `git push`。最大 3 回リトライ（10 秒間隔）。
   rebase が衝突したら force せずジョブを失敗させる（main 側を残す）。21:00〜22:30 UTC に入ったら push しない。
6. push 後、同じジョブで `kv-resync.mjs --json`（GITHUB_TOKEN の push では `kv-resync.yml` の `on: push` が起動しないため）。

- 計算のみに落ちた日・失敗した日はコミットしない（Mulmo は前日値で続行）。
- **ウォッチの PER を 1 件も更新できなかった日**（全銘柄 skipped・fund-per だけ成功した日を含む）は失敗扱いでコミット・push しない（`per-daily-gate.mjs updated` が exit 4。Mulmo の「当日分あり」誤判定を防ぐ）。skipped の割合の閾値は設けない。
- 失敗時はラベル `per-daily-failed` の Issue を起票/更新し、書き込み成功で自動クローズ。kv-resync の失敗は `kv-resync-failed` の Issue。
- concurrency グループは `portfolio-data-batch`（週次・ひふみ月次と共通・`cancel-in-progress: false`）。待機できる実行は 1 つだけで、
  後から来た実行が待機中の実行を取り消す（cancelled になり失敗 Issue は立たない）。**手動実行を重ねるときは前の実行の終了を待つ**。
- 手元での確認（キー不要・書き込まない）：`node data/scheduler/watchlist-per.mjs --out /tmp/w.json AAPL`

## KV 同期（GitHub Actions・`kv-resync.yml`・#652 PR1）

アプリ KV のウォッチリストの `valuation` を正本 `data/valuations.json` に合わせる（`kv-resync.mjs`・純関数は `lib/kv-sync.mjs`）。

| 起動 | 動作 |
|---|---|
| `data/valuations.json` の push（main） | 即同期（Mulmo の push で起動する） |
| schedule（毎日 23:30 UTC） | 自己修復（冪等・drift が無ければ noop） |
| workflow_dispatch | `mode=sync`（既定）／`mode=check`（ドリフト検知のみ・PUT しない・ドリフトありで exit 3） |
| `per-daily.yml`・`weekly-valuations.yml` の push 後 | 同じジョブ内で明示実行（GITHUB_TOKEN の push は `on: push` を起動しないため） |

- 比較キーは `perCurrent`/`status`/`asOf`。正本に無い銘柄・`valuation` 以外のフィールドは触らない。PUT 後に read-back で再検証。
- 失敗時はラベル `kv-resync-failed` の Issue を起票/更新し、成功で自動クローズ。
- 公開リポのため、ログ・サマリには KV の本文を出さない（stage・drift 件数・銘柄シンボルのみ）。
