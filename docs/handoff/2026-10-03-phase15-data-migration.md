# 第1.5次：Mulmo の日次データ処理を本リポ＋GitHub Actions へ移す（#652）

- **親 Issue**: #652 `第1.5次: Mulmo の日次データ処理を本リポ＋GitHub Actions へ移す（KV同期・毎日のPER・ひふみ月次・週次バッチ再開）`
- **サイズ**: L（データ書き込み・KV・ワークフロー新設）
- **分担**: 設計＝architect（本書）／実装＝implementer（PR ごとの子 Issue）／レビュー＝reviewer
- **入力資料**: `docs/mulmo-data-scripts-asis.md`（現状仕様・§6 決定・§7 注意点）、原本 `docs/handoff/assets/2026-10-03-phase15/`、`data/scheduler/README.md`
- **Toshio 確認**: **全 PR で要**（全 PR が `.github/workflows/**` を追加・変更する。PR3/PR4/PR6 は `CLAUDE.md` も変える）。reviewer はマージせず `needs-toshio` を付ける。

## 実装ログ（implementer が更新）
| PR | 子 Issue | branch | PR | 状態 |
|---|---|---|---|---|
| PR1 KV 自動同期 | #653 | `feat/653-kv-resync` | | 実装済み（PR 作成待ち） |
| PR2 毎日 PER 並行運転 | #654 | `feat/654-per-shadow` | | 実装済み（PR 作成待ち） |
| PR3 書き込みへ切り替え | #655 | | | 着手可（2026-10-03 Toshio 決定：着手条件を「同時刻の全銘柄一致1回」に変更・§6.0）。マージ順は #655 → #656 |
| PR4 ひふみ上位10 月次自動更新 | #656 | | | 実装停止→§7 改訂済み（2026-10-03・microscope の正解値を PDF 由来に変更）。再着手可。マージは PR3 の後 |
| PR5 週次バッチ再開（差分レポート） | #657 | `feat/657-weekly-report` | | 実装済み（PR 作成待ち） |
| PR6 週次バッチ書き込み開始 | #658 | `feat/658-weekly-write` | | 実装済み（PR 作成待ち） |

- 切替条件：**達成**（2026-10-03・同時刻の全銘柄一致1回・run 37109843815。§6.0）。トラッキング Issue の連続一致日数は参考扱い
- Mulmo 側作業（§9）完了：PR3 後 [ ] ／ PR4 後 [ ] ／ PR6 後 [ ]

---

## 1. 背景とゴール
- portfolio のデータの一部（`data/valuations.json` の毎日の PER・アプリの KV ウォッチリストの `valuation`）は、リポ外の Mulmo ワークスペースのスクリプトが日次バッチで更新している。Claude Code から見えず、壊れても気づきにくい（2026-07-06〜08 の KV 2日ズレ事故）。
- 週次バッチ（`data/scheduler/*.mjs`）は 2026-06-21〜25 を最後にどこからも実行されておらず、Value タブの品質指標・ETF PER・目標株価乖離・同業中央値・的中率が 3 か月以上古い。
- **2026-10-03 Toshio 決定**（as-is §6）：
  1. 範囲＝`watchlist-per` / `fund-per` / `kv-resync` の移管＋ひふみ上位10の月次自動更新＋週次バッチ再開。
  2. API キーは GitHub に置かず、Worker の中継口（`/yahoo` `/fmp` `/edinet-db` `/edgar` `/finnhub`）を使う（2026-10-03 Mulmo 確認：`/fmp` `/edinet-db` `/finnhub` はキー登録済みで正常応答）。
  3. 毎日の PER は**書き込まずに計算だけする並行運転**で Mulmo の結果と自動で突き合わせ、**3 日連続で一致したら切り替え**。一致＝**status と %タイルの一致**（PER 値は取得時刻の差を許容）。不一致の日は差分を Issue に自動で書く。
- **ゴール**：上記がすべて本リポの GitHub Actions で動き、Mulmo の日次バッチからフェーズ0（PER 計算）と kv-resync 呼び出しが外れた状態。Briefing の生成・判断（watchlistVerdicts）の書き戻しは Mulmo に残る。

## 2. 全体方針（全 PR 共通の決定）

### 2.1 置き場所と書き方
- スクリプトは既存の週次バッチと同じ `data/scheduler/` に置く。純関数は `data/scheduler/lib/*.mjs` に切り出し、`tests/*.test.js`（vitest・既存 `tests/writeback.test.js` と同じく `../data/scheduler/...` を import）で検証する。
- 原本（assets）は**参考**。`execSync('curl …')` は Node 20 の `fetch` に置き換え、パスは `import.meta.url` からリポルート基準で解決する（既存 `quality-jp.mjs` と同じ方式）。ワークスペース基準パス `github/portfolio/...` は使わない。
- **計算ロジックは原本どおりに移す（変更禁止）**。特に `watchlist-per` の `score()`（バンド内の線形%タイル・`Math.round`・0〜100 クランプ・`≤33 cheap / ≤66 fair / それ以外 rich`・バンド不正時 `percentile:null, status:'hold'`）と `fund-per` の加重平均・`coverage`。閾値は投資判断の正本値なので本移行では一切触らない。

### 2.2 Worker 中継口の呼び方（`data/scheduler/lib/worker-client.mjs`・PR1 で新設、PR2/PR5 で拡張）
- ベース URL `https://portfolio-proxy.shoulang.workers.dev`、全リクエストに `Origin: https://shoulang0729.github.io` を付ける（Mulmo 確認と同じ条件）。
- タイムアウト 25 秒、429/5xx/ネットワークエラーは最大 3 回リトライ（2s→4s→8s）。
- **スロットル**：レート制限対象パス（`/yahoo` `/finnhub` `/fmp` `/edgar` `/edinet-db`）は呼び出し間隔を最低 600ms（＝最大 100 回/分 < Worker 上限 120 回/分/IP）。`/watchlist` は対象外。
- API キーは扱わない（Worker Secrets が付与）。**GitHub Secrets は追加しない**。

### 2.3 ワークフロー共通ルール
| 項目 | 決定 |
|---|---|
| Node | `actions/setup-node@v4`・`node-version: "20"`・`npm ci` は不要（スクリプトは依存なし。`src/*.js` を import するものも Node 標準のみ） |
| concurrency | Worker の中継口を叩くワークフロー（per-daily / weekly / fund-holdings-monthly）は共通グループ `portfolio-data-batch`（`cancel-in-progress: false`）。kv-resync は別グループ `kv-resync` |
| push | `git config user.name "github-actions[bot]"`。`git pull --rebase origin main` → `git push` を最大 3 回リトライ（間隔 10s）。**rebase が衝突したら force せずジョブを失敗させる**（＝main 側を残す。CLAUDE.md の衝突ルールと同じ考え方） |
| 禁止時間帯 | **21:00〜22:30 UTC は push しない**（Mulmo が `valuations.json` を書く時間帯・as-is §7） |
| 失敗通知 | 失敗はジョブを赤にする。加えて各ワークフローの専用ラベルで Issue を起票/更新/自動クローズ（`mf-freshness.yml` と同じ冪等パターン） |
| ログ | **公開リポの Actions ログは誰でも読める**。KV や JSON の本文をログに丸ごと出さない。出すのは銘柄シンボル・件数・status/%タイル程度（いずれも既に公開の `valuations.json` 由来） |
| GITHUB_TOKEN の push | **GITHUB_TOKEN による push は他のワークフローの `on: push` を起動しない**。このため Actions が `valuations.json` を push したワークフローは、同じジョブ内で kv-resync を明示的に実行する（PR3・PR6） |

### 2.4 `valuations.json` の書式保持（`data/scheduler/lib/json-format.mjs`・PR2 で新設）
- 実ファイルの書式は書き手によって揺れている（現在：**2 スペース・末尾改行なし**／2026-09 以前：1 スペース。as-is の「1 スペース」記述は現状と違う）。
- 全体を書き直すスクリプト（watchlist-per / fund-per / fund-holdings 更新）は、**読み込んだファイルのインデント幅（最初の字下げ行の空白数）と末尾改行の有無を検出し、そのまま再現して書く**。
- 例：入力が `{\n  "updated": …}`（2 スペース・末尾改行なし）→ 出力も 2 スペース・末尾改行なし。入力が `{\n "updated": …}\n`（1 スペース・末尾改行あり）→ 出力も同じ。
- 部分書き換え（週次バッチ）は既存 `writeback.mjs` の `writeBlocks()` をそのまま使う（変更しない）。

### 2.5 日付の意味
- `asOf` は原本どおり **実行時の UTC 日付**（`new Date().toISOString().slice(0,10)`）。例：20:15 UTC（= 翌 04:15 CST）実行なら UTC の当日。Mulmo の 05:00 CST 実行から見ると「CST 日付の前日」が当日分になる（§9 で Mulmo に申し送る）。

### 2.6 時刻表（UTC）
| 時刻 | 処理 | push |
|---|---|---|
| 20:15 毎日 | per-daily（PR2 は計算のみ／PR3 以降は書き込み＋kv-resync） | PR3 以降のみ |
| 21:00〜22:30 | Mulmo 日次バッチ（Briefing・判断の書き戻し） | **Actions は push 禁止** |
| 01:30 毎日 | per-daily の突き合わせ（PR2〜PR3 の間だけ） | なし |
| 23:30 毎日＋`valuations.json` の push 時 | kv-resync（自己修復・冪等） | なし（KV のみ） |
| 03:00 毎月 1〜20 日 | ひふみ上位10 更新（PR4） | あり |
| 02:00 毎週日曜 | 週次バッチ（PR5 はレポートのみ／PR6 以降は書き込み） | PR6 以降のみ |

- 20:15 UTC は夏時間（〜2026-11-01）なら米国市場の引け後（20:00 UTC）。冬時間（11 月〜3 月）は引け（21:00 UTC）の 45 分前の値になる（§10 確認推奨 1）。
- GitHub の cron は数十分遅れることがある。per-daily（書き込み）は**開始時刻が 20:55 UTC 以降なら書き込まず計算のみ**にしてジョブサマリと `::warning` で知らせる（その日の PER は前日値のまま。Mulmo は `asOf` が当日でなければ前日値で Briefing を続ける＝as-is §7）。Mulmo の書き戻しを上書きしないため、Mulmo の後に書く「追いかけ実行」は設けない。

## 3. PR 分割と順序

```
PR1 KV 自動同期 ──┬─> PR2 PER 並行運転 ──(3日連続一致＋Toshio)──> PR3 書き込み切替 ──> PR4 ひふみ月次（マージは PR3 後）
                 └─> PR5 週次バッチ再開（レポート） ──(初回レポート確認)──> PR6 週次書き込み開始
```

| PR | 内容 | 依存 | 並走 | Toshio |
|---|---|---|---|---|
| PR1 | KV 自動同期（push 起動＋日次自己修復） | なし | — | 要（workflows） |
| PR2 | 毎日 PER を計算のみで並行運転＋自動突き合わせ | PR1（`worker-client.mjs`） | PR5 と並走可 | 要（workflows・新データファイル） |
| PR3 | 書き込みへ切り替え | PR2＋3 日連続一致 | PR5/PR6 と並走可 | 要（workflows・CLAUDE.md） |
| PR4 | ひふみ上位10の月次自動更新 | PR2（`fund-holdings.json`・`json-format.mjs`）＋前提資料（§7.0） | 実装は PR3/PR5 と並走可。**マージは PR3 の後** | 要（workflows・データ書き手・CLAUDE.md） |
| PR5 | 週次バッチ再開（中継口へ切替・初回は差分レポートのみ） | PR1（`worker-client.mjs`） | PR2/PR3 と並走可 | 要（workflows） |
| PR6 | 週次バッチの書き込み開始 | PR5＋初回レポートの確認 | — | 要（workflows・CLAUDE.md） |

- 並走時の衝突注意：`data/scheduler/README.md` は PR3（毎日の節を追加）と PR5（全面改定）が触る。後からマージする方が rebase で解消する。`CLAUDE.md` の「データの書き手」表は PR3/PR4/PR6 が1行ずつ足す。
- 各 PR は `Closes #<子Issue>`。最後の PR（PR6 か PR4 の遅い方）の本文に `Refs #652` を書き、親 #652 のクローズは PM が全子 Issue 完了後に行う。

---

## 4. PR1：KV 自動同期

### 4.1 対象ファイル
| ファイル | 状態 | 内容 |
|---|---|---|
| `data/scheduler/lib/worker-client.mjs` | 新規 | §2.2。`workerFetch(path, init)`（Origin 付与・タイムアウト・リトライ・スロットル） |
| `data/scheduler/lib/kv-sync.mjs` | 新規 | 純関数 `normValuation(v)` / `findDrift(kvArray, valuations)` / `mergeValuations(kvArray, valuations)` |
| `data/scheduler/kv-resync.mjs` | 新規 | 原本 `kv-resync.mjs` の移植（CLI 互換：引数なし＝同期／`--check`／`--json`） |
| `tests/kv-sync.test.js` | 新規 | 純関数のテスト（合成データ） |
| `.github/workflows/kv-resync.yml` | 新規 | 下記 |

### 4.2 手順
1. `kv-sync.mjs`：原本の挙動をそのまま関数化する。
   - `normValuation(v)` = `v ? \`${v.perCurrent}/${v.status}/${v.asOf}\` : 'null'`（原本の `norm`。**比較キーを増やさない**）。
   - `findDrift`：KV 要素ごとに `valuations[el.symbol]` があり、`normValuation` が違えば drift。正本に無い銘柄は対象外（据え置き）。
   - `mergeValuations`：**配列形状を保持**し、正本にある銘柄だけ `{ ...el, valuation: valuations[el.symbol] }`。他フィールド（name 等）・正本に無い銘柄はそのまま。
2. `kv-resync.mjs`：`GET /watchlist`（最大 3 回・配列でなければリトライ）→ drift 算出 → `--check` なら drift ありで exit 3 → drift 0 なら noop exit 0 → PUT（最大 5 回・HTTP 200 かつ `{"ok":true}` で成功）→ **read-back GET で再検証**、残 drift があれば exit 1。`--json` は結果 1 行 JSON（`{ok, stage, drift, symbols, msg}`）。一時ファイル `/tmp/...` は使わず body を直接 fetch に渡す。正本パスはリポの `data/valuations.json`。
3. `kv-resync.yml`：
   - トリガー：`push`（`branches: [main]`, `paths: [data/valuations.json]`）／`schedule: '30 23 * * *'`（自己修復）／`workflow_dispatch`（input `mode`: `sync`(既定) / `check`）。
   - `actions/checkout@v4` は **`ref: main`**（起動コミットではなく最新 main に合わせる。連続 push 時は concurrency の保留 1 件＝最新が残る）。
   - `concurrency: { group: kv-resync, cancel-in-progress: false }`、`permissions: { contents: read, issues: write }`。
   - `node data/scheduler/kv-resync.mjs --json` の結果をジョブサマリに書く。
   - 失敗時：ラベル `kv-resync-failed` の Issue を起票/更新（本文＝stage・drift 件数・銘柄シンボル・Run URL）。成功時に既存 Issue があれば自動クローズ。

### 4.3 受け入れ条件
- [ ] `tests/kv-sync.test.js`：①正本と同じなら drift 0 ②`perCurrent`/`status`/`asOf` のどれかが違えば drift ③正本に無い銘柄は drift にも merge にも入らない（KV 要素が完全に元のまま）④merge 後も配列・要素順・`name` など他フィールド保持 ⑤`valuation` 以外のフィールドの違いは drift にしない。
- [ ] `npm test` / `npm run lint` / `npm run check:types` / `npm run check:circular` PASS。
- [ ] ワークフローの YAML に API キー・Secrets 参照が無い（`GITHUB_TOKEN` のみ）。ログに KV 本文を出していない。
- [ ] マージ後の確認（reviewer が PR 本文に手順を書き、PM/Toshio が実施）：`workflow_dispatch` を `mode=check` で 1 回 → exit 0 か 3。続けて `mode=sync` で 1 回 → `ok:true`（`noop` か `resynced`）。

---

## 5. PR2：毎日の PER を Actions で並行運転（計算のみ）＋自動突き合わせ

### 5.1 対象ファイル
| ファイル | 状態 | 内容 |
|---|---|---|
| `data/scheduler/lib/per-calc.mjs` | 新規 | 純関数 `pickTrailingPE(quoteSummaryJson)` / `score(per, lo, hi)` / `weightedPer(components)` |
| `data/scheduler/lib/json-format.mjs` | 新規 | §2.4。`detectFormat(raw)` / `stringifyLike(obj, fmt)` |
| `data/scheduler/lib/per-compare.mjs` | 新規 | 純関数 `compareDay(shadow, mulmoDoc)`（§5.3） |
| `data/scheduler/lib/worker-client.mjs` | 変更 | `yahooQuoteSummary(sym, modules)` を追加 |
| `data/scheduler/watchlist-per.mjs` | 新規 | 原本の移植。`--write` / `--out <file>` / 銘柄指定 |
| `data/scheduler/fund-per.mjs` | 新規 | 原本の移植。`--write` / `--out <file>` |
| `data/scheduler/fund-holdings.json` | 新規 | `docs/handoff/assets/2026-10-03-phase15/fund-holdings.json` を**そのまま**コピー（ファンドの公開情報・2026-05 分） |
| `data/scheduler/per-compare.mjs` | 新規 | 突き合わせ CLI（§5.3） |
| `tests/per-calc.test.js` / `tests/json-format.test.js` / `tests/per-compare.test.js` | 新規 | 合成データ |
| `.github/workflows/per-daily.yml` | 新規 | 下記 |

### 5.2 スクリプト
- `watchlist-per.mjs`：原本どおり `valuations` の全エントリを回し、`yahooQuoteSummary(sym, 'summaryDetail,defaultKeyStatistics')` から `trailingPE`（`summaryDetail` 優先→`defaultKeyStatistics`、正の有限値のみ・小数 2 桁）を取り、`score(per, bandLow, bandHigh)`。
  - 取れない銘柄は `skipped` に入れ、結果は前回値を維持（原本どおり）。
  - 変更点（出力に影響しない最適化のみ許可）：`source === 'fund-monthly-top10'` のエントリ（投信名キー）は Yahoo に問い合わせずスキップ（原本でも取得失敗→前回維持になるだけ）。
  - `--out <file>`：結果 JSON（原本の `out`）に加え、**計算に使った `bandLow`/`bandHigh` を銘柄ごとに記録**し、`runStartedAt`（ISO）を入れる。
  - `--write`（PR3 で使う）：原本どおり各銘柄の `perCurrent`/`percentile`/`status`/`asOf` を更新、トップの `updated = <today>-auto-per`・`asOf = today`、§2.4 の書式保持で保存。**他のキー・他のフィールドは触らない**。
- `fund-per.mjs`：原本どおり `fund-holdings.json` の各ファンドの `top` について `trailingPE` を取り加重平均。`--write` は `{...prev, ...e, status: prev.status || 'na'}` の追加マージ（原本どおり）。
- `score()` の例（`valuations.json` の公開値で検算）：band 12〜18.5・PER 16.56 → (16.56−12)/6.5 = 0.7015 → **70 → rich**。PER 11.0 → 0（クランプ）→ cheap。PER 14.1 → 32.3 → 32 → cheap。PER 14.2 → 33.8 → 34 → fair。bandHigh ≤ bandLow → `percentile:null, status:'hold'`。

### 5.3 突き合わせの定義（`per-compare.mjs`）
- **入力**：①前日 20:15 UTC の shadow 実行の結果（artifact `per-shadow-<YYYY-MM-DD>`：watchlist-per と fund-per の `--out`）②**Mulmo の確定値**＝shadow 実行開始以降に `data/valuations.json` を変更した最後のコミット（author が `github-actions[bot]` 以外）時点のファイル（`git log --since=<runStartedAt> -- data/valuations.json` → `git show <sha>:data/valuations.json`）。
- **比較対象**：shadow の `watchlist-per` 結果の全銘柄（投信エントリを除く）。「更新した」とは、shadow 側＝`skipped` に無い、Mulmo 側＝エントリの `asOf` が shadow 日付 D または D+1（Mulmo の実行が 0 時 UTC を跨いだ場合）。
- **銘柄ごとの判定**：
  | 区分 | 条件 | 一致扱い |
  |---|---|---|
  | `match` | 両方更新で `status` と `percentile` が同じ／両方未更新 | 一致 |
  | `band-changed` | Mulmo 確定値の `bandLow`/`bandHigh` が shadow 計算時と違う（土曜のバンド見直し等） | **集計から除外**（一致にも不一致にも数えない） |
  | `mismatch-input` | 不一致だが、`score(Mulmo の perCurrent, shadow のバンド)` が Mulmo の値と一致＝計算は同じで PER の入力だけ違う | **不一致**（決定どおり status と%タイルで判定）。区分は診断用に表示 |
  | `mismatch-logic` | 上記以外の不一致 | 不一致 |
  | `one-side-skip` | 片方だけ更新 | 不一致 |
- 投信エントリ（fund-per）は `perCurrent` と `coverage` を**参考表示のみ**（status は `na` 固定のため判定に使わない）。
- **日の判定**：比較対象（除外後）がすべて `match` → **一致日**。1 件でも不一致 → **不一致日**。shadow の artifact が無い、または Mulmo の確定コミットが無い → **判定不能日**（連続日数を増やしもリセットもしない）。
- 例（合成）：shadow `AAA` per 20.0・band 10〜30 → 50/fair、Mulmo `AAA` per 20.1 → 51/fair → `mismatch-input`（%タイル 50≠51）→ 不一致日。shadow `BBB` band 10〜30、Mulmo の確定 band 12〜30 → `band-changed`（除外）。

### 5.4 `per-daily.yml`（PR2 時点）
- トリガー：`schedule: '15 20 * * *'`（shadow）／`schedule: '30 1 * * *'`（compare）／`workflow_dispatch`（input `job`: `shadow` / `compare`）。ジョブは `github.event.schedule` か input で振り分ける。
- `concurrency: portfolio-data-batch`。`permissions: { contents: read, issues: write, actions: read }`。
- **shadow ジョブ**：checkout（main）→ `watchlist-per.mjs --out` と `fund-per.mjs --out`（**`--write` を付けない**）→ `actions/upload-artifact@v4`（名前 `per-shadow-<UTC日付>`・`retention-days: 7`）→ ジョブサマリに件数・skipped 銘柄。
- **compare ジョブ**：checkout（`fetch-depth: 0`）→ 前日 UTC 日付の shadow artifact を `actions/download-artifact@v4`（`run-id` は `gh run list --workflow per-daily.yml` で特定、`github-token` 指定）→ `per-compare.mjs` → トラッキング Issue を更新。
- **トラッキング Issue**（ラベル `per-shadow`・タイトル「PER 並行運転の突き合わせ（#652）」・無ければ作成）：
  - 本文に機械可読の行 `<!-- per-shadow-streak: N last: YYYY-MM-DD -->` を持ち、一致日で N+1、不一致日で N=0、判定不能日は据え置き。同じ日付の二重実行で二重カウントしない（`last` で判定）。
  - 不一致日：差分表（銘柄・区分・shadow の PER/%/status・Mulmo の PER/%/status）をコメント。判定不能日：理由をコメント。一致日：1 行コメント。
  - **N が 3 に達したら**「切替条件達成（3 日連続一致）。PR3 着手可」とコメント（以後も更新は続ける）。Issue は自動クローズしない（PR3 で閉じる）。

### 5.5 受け入れ条件
- [ ] `tests/per-calc.test.js`：§5.2 の `score()` の例がすべて一致（70/rich・0/cheap・32/cheap・34/fair・不正バンドで null/hold）。`pickTrailingPE` は `{raw: x}` 形式と素の数値の両方、0 以下・非数は null。`weightedPer` は PER null の銘柄を除いた加重平均と coverage（例：w 0.05/PER 20・w 0.03/PER null・w 0.02/PER 10 → PER (1.0+0.2)/0.07 = 17.14・coverage 0.07）。
- [ ] `tests/json-format.test.js`：1 スペース＋末尾改行／2 スペース＋改行なし の両方で「読み→無変更で書き」がバイト一致。
- [ ] `tests/per-compare.test.js`：§5.3 の 5 区分と日の判定（一致・不一致・除外のみの日＝一致・判定不能）を合成データで網羅。
- [ ] PR2 の範囲では**どのジョブも `data/**` に書き込まない・push しない**（`permissions: contents: read`）。
- [ ] 原本からの計算差分が無いこと（PR 本文に原本との対応表を書く）。
- [ ] 品質ゲート PASS。マージ後の確認：`workflow_dispatch job=shadow` が成功し artifact が出る。

---

## 6. PR3：書き込みへ切り替え（同時刻の全銘柄一致の後）

> **2026-10-03 改訂（Toshio 決定・#655）**：着手条件を「トラッキング Issue で 3 日連続一致」から「**同時刻の全銘柄一致 1 回**」に変更。書き込みコミットのメッセージを固定形式にし、Mulmo の当日分判定に使う（§6.2・§9）。本節の着手条件は §1・§3・§5.4・§10 の「3 日連続一致」の記述より優先する。

### 6.0 着手条件
- **同時刻の全銘柄一致 1 回**（達成済み・2026-10-03）。根拠：Actions の `per-daily.yml`（`workflow_dispatch job=shadow`・run 37109843815・開始 08:29:15 UTC）と Mulmo ワークスペース版 `watchlist-per.mjs`/`fund-per.mjs` の書き込みなし実行（08:28 UTC 台）を同じ origin/main の入力で実行し、ウォッチ 39 銘柄すべてで status・%タイル一致・PER 差 0、ひふみ 2 本の加重 PER・カバー率も同値（#655 の Mulmo コメント・Toshio 決定コメント）。
- Toshio の切り替え了承（PR は needs-toshio で止まる）。
- 突き合わせジョブ（compare）と 01:30 UTC の schedule は §6.1 のとおり PR3 で削除する。トラッキング Issue（`per-shadow`）の連続一致日数は判定に使わない。

### 6.1 対象ファイル
| ファイル | 状態 | 内容 |
|---|---|---|
| `.github/workflows/per-daily.yml` | 変更 | shadow → **write** に変更、compare ジョブと 01:30 の schedule を削除 |
| `data/scheduler/README.md` | 変更 | 「毎日の PER（Actions）」節と「KV 同期」節を追加 |
| `CLAUDE.md` | 変更 | 「データの書き手」表の `data/valuations.json` 行を「Mulmo（判断の書き戻し）＋ GitHub Actions `per-daily.yml`（毎日 20:15 UTC・`perCurrent`/`percentile`/`status`/`asOf` とファンドの加重 PER）」に分ける |

### 6.2 手順
1. write ジョブ：`permissions: { contents: write, issues: write }`。開始時刻が 20:55〜22:30 UTC なら計算のみに落とす（§2.6）。
2. `watchlist-per.mjs --write` → `fund-per.mjs --write` → `git commit data/valuations.json -m "data: daily PER <YYYY-MM-DD>"` → push（§2.3 のリトライ）。
   - **コミットメッセージは固定形式 `data: daily PER <YYYY-MM-DD>`**。日付は書き込んだ `asOf` と同じ**実行時の UTC 日付**（§2.5）。例：2026-10-03 20:15 UTC の実行 → `data: daily PER 2026-10-03`。接頭辞・空白・日付書式を変えない（Mulmo が文字列一致で判定する）。author/committer は §2.3 の `github-actions[bot]`。
   - 理由：Mulmo は毎朝「このコミットが main にあるか」で Actions が当日分を書いたかを判定する。`valuations.json` 最上位の `asOf`/`updated` は Mulmo の Briefing 書き戻し（段C）でも書き換わるため判定に使えない。
   - 差分が無い場合も `git commit --allow-empty` で同じメッセージのコミットを作る（判定用。通常は銘柄の `asOf` が毎日変わるので差分は出る）。
   - 計算のみに落ちた日（開始が 20:55 UTC 以降・§2.6）と、失敗した日はコミットしない＝Mulmo は前日値で続行する。
3. push 成功後、同じジョブで `node data/scheduler/kv-resync.mjs --json`（GITHUB_TOKEN の push では kv-resync.yml が起動しないため）。失敗時は kv-resync と同じ `kv-resync-failed` Issue。
4. write ジョブ失敗時：ラベル `per-daily-failed` の Issue を起票/更新、成功で自動クローズ。
5. トラッキング Issue（`per-shadow`）は PR 本文で `Closes` しない。マージ後に PM が「切替済み」とコメントしてクローズ。
6. Mulmo への申し送り（§9）を PR 本文に貼り、マージ後に PM が #652 にコメントする。

### 6.3 受け入れ条件
- [ ] `valuations.json` の変更は `perCurrent`/`percentile`/`status`/`asOf`（銘柄）と `updated`/`asOf`（トップ）、ファンドエントリの `perCurrent`/`coverage`/`source`/`asOf`/`components` だけ（`git diff` で確認できる合成テスト、または dry-run の差分を PR に添付）。書式（インデント・末尾改行）が変わらない。
- [ ] 21:00〜22:30 UTC に push しないガードがある。
- [ ] 書き込みコミットのメッセージが `data: daily PER <UTC日付 YYYY-MM-DD>` に完全一致（差分なしの日も `--allow-empty` で作る。計算のみ・失敗の日は作らない）。
- [ ] compare ジョブと 01:30 UTC の schedule が削除されている。
- [ ] push 後に kv-resync が同じジョブで走る。
- [ ] 品質ゲート PASS。

### 6.4 運用メモ（concurrency）
- `per-daily.yml`・`weekly-valuations.yml`・`fund-holdings-monthly.yml`（PR4）は同じ concurrency group `portfolio-data-batch`（`cancel-in-progress: false`）。GitHub の仕様で、**実行中 1 つの後ろに待機できるのは 1 つだけ**で、後から来た実行が待機中の実行を取り消す（2026-10-03、手動の shadow が週次の手動実行に押し出された実績あり・#655）。
- 定時（20:15 毎日／02:00 日曜／03:00 毎月 1〜20 日）は通常重ならない。**手動実行（workflow_dispatch）を重ねるときは、前の実行の終了を待ってから起動する**。取り消された実行は「cancelled」になり、失敗通知 Issue は立たないので見落としに注意。

---

## 7. PR4：ひふみ上位10の月次自動更新

> **2026-10-03 改訂（Toshio 決定）**：implementer の停止報告で、現行 `data/scheduler/fund-holdings.json` の **microscope（2026-05）が月次レポートと一致しない（誤り）** ことが判明した。toushin は月次レポートと完全一致。以下の 4 点を決定し、§7.0〜7.3 に反映した。
> 1. fixture テストの期待値：toushin＝現行 JSON（＝PDF と一致）、**microscope＝PDF の目視値**（§7.2.3 の表）を正とする。
> 2. 既知月の自己検証の比較相手は現行 JSON ではなく、**PDF 由来の正しい 2026-05 上位10の定数**（`hifumi-known.mjs`）。
> 3. 誤った現行 JSON の microscope は**今は手で直さない**。PR4 を PR3 の後にマージし、PR4 の初回の月次実行で正しい値に自動上書きさせる（§7.4）。
> 4. 銘柄名内の連続空白は**半角スペース 1 つ**にまとめる。

### 7.0 前提資料（用意済み・2026-10-03）
- 実装環境（クラウド）から `hifumi.rheos.jp` に接続できない（2026-10-03 確認：egress で拒否）ため、Mulmo が月次レポートの `pdftotext -layout` 出力を用意した。ファンドの公開資料なのでコミット可。
- 置き場所 `docs/handoff/assets/2026-10-03-phase15/`、ファイル名 **`hifumi-<f>-report<YYYYMM>.layout.txt`**（`<f>` = `toushin` / `microscope`）：

| ファイル | 内容 | 上位10の範囲（行） |
|---|---|---|
| `hifumi-toushin-report202605.layout.txt` | ひふみ投信 2026年5月度 | 224〜276 |
| `hifumi-microscope-report202605.layout.txt` | ひふみマイクロスコープpro 2026年5月度（作成基準日 2026-05-29） | 149〜213 |
| `hifumi-toushin-report202608.layout.txt` | ひふみ投信 2026年8月度 | 229〜290 |
| `hifumi-microscope-report202608.layout.txt` | ひふみマイクロスコープpro 2026年8月度（英数コード・銘柄名内の連続空白を含む） | 148〜212 |

- 行番号は確認時点の目安。パーサは行番号に依存せず §7.2.1 の見出しと終端で範囲を決める。

### 7.1 対象ファイル
| ファイル | 状態 | 内容 |
|---|---|---|
| `data/scheduler/lib/hifumi-parse.mjs` | 新規 | 純関数 `parseTop10(text, fund)` → `[{code, name, weight}]`（`fund` = `'toushin'`/`'microscope'`）、`validateTop10(rows)` → `{ok, errors[]}`、`normalizeName(s)` |
| `data/scheduler/lib/hifumi-known.mjs` | 新規 | **PDF 由来の正しい 2026-05 上位10の定数** `KNOWN_MONTH = '202605'`・`KNOWN_TOP10 = { toushin: [...], microscope: [...] }`（値は §7.2.3。`code` は `.T` 付き・`weight` は小数）。自己検証とテストが共用する唯一の定義元 |
| `data/scheduler/fund-holdings-update.mjs` | 新規 | PDF 取得→`pdftotext -layout`→パース→検証→自己検証→`fund-holdings.json` 更新。`--month YYYYMM` / `--dry-run` |
| `tests/hifumi-parse.test.js` | 新規 | §7.3 のとおり |
| `tests/fixtures/hifumi/*.layout.txt` | 新規 | §7.0 の 4 ファイルのコピー（ファイル名はそのまま） |
| `.github/workflows/fund-holdings-monthly.yml` | 新規 | 下記 |
| `CLAUDE.md` | 変更 | 「データの書き手」表に `data/scheduler/fund-holdings.json` ＝ GitHub Actions `fund-holdings-monthly.yml`（月次）を追加 |

### 7.2 手順・決定
- 対象＝`toushin`（ひふみ投信）と `microscope`（ひふみマイクロスコープpro）。**クロスオーバーpro は対象外**（上位5のみ・未上場中心・as-is §3.2）。
- `fund-holdings.json` の要素との対応は `fund` の値で引く：`toushin` ↔ `"ひふみ投信"`、`microscope` ↔ `"ひふみマイクロスコープpro"`。どちらかが見つからなければ書き込まずに失敗。
- 取得 URL：`https://hifumi.rheos.jp/fund/<f>/pdf/report<YYYYMM>.pdf`。対象月＝実行日（UTC）の**前月**。`fund-holdings.json` の該当ファンドの `asOf`（`YYYY-MM`）が既に対象月なら何もしない。
- **公開状況（Mulmo 確認・2026-10-03）**：202606〜202608 は 200、**202609 は 404（未公開）**。月初はまだ前月分が出ていないのが普通。
- **未公開（404）の扱い**（ファンドごとに独立に判定。片方だけ公開ならその片方だけ更新する）：
  | 実行日（UTC） | 対象月が 404 のとき |
  |---|---|
  | 1〜19 日 | 失敗扱いにしない。ジョブは成功（緑）で終え、ジョブサマリに「<f> <YYYYMM> 未公開・翌日再試行」と出す。翌日 03:00 UTC の定時実行が再試行する |
  | 20 日（その月の最終定時実行）、および 20 日以降の手動実行 | ジョブを失敗（赤）にし、ラベル `fund-holdings-stale` の Issue を起票/更新（本文：ファンド・対象月・最終確認日時）。その月はこれ以上自動で再試行しない |
  - 翌月 1 日からは対象月が 1 つ進む。未公開のまま過ぎた月は**遡って取りに行かない**（`asOf` は古いまま次の月の公開で一気に進む）。`fund-holdings-stale` Issue は、いずれかの月で更新に成功したファンドが全部そろった時点で自動クローズ。
  - 404 以外の取得エラー（5xx・タイムアウト・ネットワーク）は §2.2 と同じ 3 回リトライの後、日付にかかわらず即失敗（赤）＋同ラベルの Issue。
  - 自己検証用の 2026-05 PDF は公開済みのはずなので、404 を含め取得できなければ即失敗（書き込まない）。
- **`month` 入力（workflow_dispatch）の扱い**：指定月が該当ファンドの現在の `asOf` より古い、または同じなら書き込まない（後戻り防止）。

#### 7.2.1 パース仕様（`parseTop10`）
両ファンド共通：
1. **範囲**：見出し `組入比率1[~～]10位`（半角 `~` と全角 `～` の両方を受ける。toushin は全角、microscope は半角）を含む最初の行の次の行から、その後に最初に現れる `※「組入比率」は` を含む行の直前まで。見出しまたは終端が見つからなければ 0 行（→検証①で NG）。toushin は終端の後に「組入比率11～30位」の表が続くが、範囲外なので読まない。
2. **銘柄行**：範囲内で次の正規表現に一致する行だけを銘柄行とする（それ以外の説明文・見出し・空行は捨てる）。
   - toushin：`^\s*(\d{1,2})\s+(.+?)\s{2,}([0-9][0-9A-Z]{3})\s+\S+\s+\S+\s+\S+\s+(\d+(?:\.\d+)?)%\s*$`（No・銘柄名・コード・規模・上場市場・業種・比率。順位は行頭にある）
   - microscope：`^\s*(.+?)\s{2,}([0-9][0-9A-Z]{3})\s+\S+\s+(\d+(?:\.\d+)?)%\s*$`（銘柄名・コード・業種・比率。**順位の数字は別の行に単独で出る**ため順位は読まず、出現順を順位とする）
   - 説明文中の `%`（例：microscope 2026-05 の「40%を目安に…」）は、コード列と行末の比率の形に一致しないので銘柄行にならない。
   - 銘柄名の lazy マッチは、銘柄名内に 2 個以上の空白がある場合（例：`Ｔｅｒｒａ   Ｄｒｏｎｅ`）でもコードの位置まで伸びる（空白の後がコード形式でなければ一致しないため）。実装時にこの 2 例（`Ｔｅｒｒａ   Ｄｒｏｎｅ`・`ＨＵＭＡＮ   ＭＡＤＥ`）がテストで通ることを確認する。
3. **変換**：
   - `code`：英数字 4 桁（例 `8001` / `141A`）に `.T` を付ける。
   - `name`：前後の空白を除き、**連続する空白（半角・全角 U+3000 を問わない）を半角スペース 1 つにまとめる**。それ以外（全角英字・中黒など）は PDF 表記のまま。例：`Ｔｅｒｒａ   Ｄｒｏｎｅ` → `Ｔｅｒｒａ Ｄｒｏｎｅ`、`ＭＴＧ` → `ＭＴＧ`。
   - `weight`：% → 小数 4 桁（`Math.round(pct * 100) / 10000`。例 5.28% → 0.0528、3.80% → 0.038）。
4. toushin は行頭の順位が 1〜10 の昇順で欠番なしであることも確認する（違えば検証 NG 扱い）。
5. **似た表の取り違え防止**（Mulmo 確認・#656）：
   - toushin には同じ列構成の表が 2 つある（2026-05 版：224 行目付近の見出し「組入比率1～10位」の表が正、290 行目付近の見出し「組入比率11～30位」の表は別物）。見出しの正規表現は `組入比率1[~～]10位` で、`組入比率` の直後が `1` 1 文字＋波線であることを要求するため「11～30位」には一致しない。さらに範囲を**最初の見出しから最初の `※「組入比率」は` まで**に限ることで、11〜30 位の行は読まない。見出し `組入比率1[~～]10位` が 2 回以上現れたら検証 NG（レイアウト変更の疑い）。
   - microscope は上位10銘柄の表（2026-05 版：151 行目付近）より上に「組み入れ上位10業種 比率」の別表（112 行目付近。`1 サービス業 15.23% …` の形）がある。業種表の見出しは `組入比率1~10位` を含まないので範囲の開始にならず、行もコード列（英数字 4 桁）を持たないので銘柄行の正規表現に一致しない。`上位10業種` を手掛かりに範囲を決めない。
   - テスト：2026-05 fixture で、toushin の 11〜30 位の銘柄（例：11 位以降のコード）と microscope の業種名が結果に含まれないこと。合成テキストで「見出しが 2 回」→ NG。
6. 上記 1〜3 は architect が §7.0 の 4 ファイルで試算し、4 本とも 10 行が取れ、2026-05 の 2 本は §7.2.3 の表と完全一致することを確認済み（2026-10-03）。

#### 7.2.2 検証（`validateTop10`・すべて満たさなければ書き込まない）
①ちょうど 10 行 ②code が `^[0-9][0-9A-Z]{3}\.T$` ③0 < weight < 0.2 ④weight 合計 ≤ 1 ⑤name が空でない ⑥code 重複なし ⑦weight が出現順に非増加（同値は可。例：microscope 2026-08 の 6492 と 2782 はともに 2.43%）。

#### 7.2.3 既知月の自己検証（比較相手＝`hifumi-known.mjs` の定数）
- 毎回、2026-05 の PDF も取得・パースし、`KNOWN_TOP10`（下表＝PDF 由来の正しい値）と `code`・`name`・`weight` が完全一致することを確認する。違えば「パーサ不整合（レイアウト変更の疑い）」として書き込まない。
- **比較相手は現行 `fund-holdings.json` ではない**（現行 JSON の microscope は誤り。§7.4）。
- 2026-05 PDF の取得自体が失敗（404・ネットワーク）した場合も書き込まない（自己検証できないため）。

`KNOWN_TOP10.toushin`（2026-05・現行 JSON と同一）：

| 順位 | code | name | weight |
|---|---|---|---|
| 1 | 8001.T | 伊藤忠商事 | 0.0528 |
| 2 | 5802.T | 住友電気工業 | 0.0513 |
| 3 | 6723.T | ルネサスエレクトロニクス | 0.0411 |
| 4 | 7012.T | 川崎重工業 | 0.0411 |
| 5 | 8002.T | 丸紅 | 0.0406 |
| 6 | 8035.T | 東京エレクトロン | 0.0392 |
| 7 | 8411.T | みずほフィナンシャルグループ | 0.038 |
| 8 | 8802.T | 三菱地所 | 0.0352 |
| 9 | 8031.T | 三井物産 | 0.0328 |
| 10 | 6981.T | 村田製作所 | 0.0328 |

`KNOWN_TOP10.microscope`（2026-05・PDF 目視値。**現行 JSON とは異なる**）：

| 順位 | code | name | weight |
|---|---|---|---|
| 1 | 7806.T | ＭＴＧ | 0.0428 |
| 2 | 6492.T | 岡野バルブ製造 | 0.0398 |
| 3 | 5074.T | テスホールディングス | 0.0393 |
| 4 | 3480.T | ジェイ・エス・ビー | 0.0313 |
| 5 | 8366.T | 滋賀銀行 | 0.0262 |
| 6 | 4390.T | ＩＰＳ | 0.0239 |
| 7 | 2170.T | リンクアンドモチベーション | 0.0225 |
| 8 | 4275.T | カーリット | 0.0223 |
| 9 | 6143.T | ソディック | 0.0218 |
| 10 | 4377.T | ワンキャリア | 0.021 |

- `name` は PDF 表記（全角英字を含む）。上表の表記と PDF テキストの表記が食い違う場合は **PDF テキスト（fixture）を正**とし、定数をそれに合わせる（目視転記の誤りの訂正として可。code・weight が食い違う場合は止めて PM に報告）。

#### 7.2.4 書き込み・ワークフロー
- `fund`/`fundSymbol`/`source` は既存値を保持し、`top` と `asOf`（`YYYY-MM`）だけ差し替える。書式は §2.4 で保持。
- ワークフロー：`schedule: '0 3 1-20 * *'`＋`workflow_dispatch`（input `mode`: `write`(既定) / `dry-run`、`month`）。`apt-get install -y poppler-utils`。`concurrency: portfolio-data-batch`。`permissions: { contents: write, issues: write }`。更新があれば `git commit data/scheduler/fund-holdings.json -m "data: hifumi top10 <YYYY-MM>"` → push（§2.3）。
- dry-run は書き込まず、ファンドごとの「現行 `top` → 新 `top`」の差分（code・name・weight）をジョブサマリに出す。
- 失敗/未公開の通知：検証 NG・自己検証 NG・取得エラー（404 以外）は即、**20 日の実行でも前月分が未公開**ならラベル `fund-holdings-stale` の Issue（§7.2 の表）。1〜19 日の 404 は通知しない。更新成功で自動クローズ。
- 加重 PER の再計算は翌日の per-daily（PR3）が `fund-holdings.json` を読んで行う（このワークフローは `valuations.json` を触らない）。

### 7.3 受け入れ条件
- [ ] `tests/hifumi-parse.test.js`：
  - 2026-05 の fixture 2 本のパース結果が `KNOWN_TOP10`（§7.2.3）と `code`・`name`・`weight` で完全一致（toushin＝現行 JSON と同値、**microscope＝PDF の目視値**。現行 JSON の microscope とは一致しないのが正しい）。
  - 2026-08 の fixture 2 本が検証 ①〜⑦ を通る。microscope 2026-08 で `141A.T`・`215A.T`・`278A.T`・`456A.T` が取れ、`278A.T` の name が `Ｔｅｒｒａ Ｄｒｏｎｅ`、`456A.T` が `ＨＵＭＡＮ ＭＡＤＥ`（半角スペース 1 つ）。microscope 2026-08 の 1 位が `7806.T`・0.0482、toushin 2026-08 の 1 位が `8001.T`・0.0618、10 位が `4676.T`・0.0282。
  - 説明文中の `%`（microscope 2026-05 の「40%を目安に」）を銘柄行として拾わない。toushin の「組入比率11～30位」の表を読まない。
  - 検証 ①〜⑦ の各違反ケースで NG。自己検証は 1 銘柄でも違えば NG（合成テキストで確認）。
  - 見出し `組入比率1[~～]10位` が 2 回ある合成テキストで NG。toushin の 11〜30 位・microscope の業種表の行を拾わない。
- [ ] 404 の扱い：対象月 404 のとき、実行日 1〜19 日は成功終了（書き込みなし・Issue なし）、20 日以降は失敗＋`fund-holdings-stale` Issue（日付を注入できる純関数で判定し、テストで確認）。片方のファンドだけ公開なら公開側だけ更新。
- [ ] `month` 入力が現在の `asOf` 以前なら書き込まない。
- [ ] `valuations.json` を書かない。`fund-holdings.json` の `top`/`asOf` 以外のキーを変えない。
- [ ] 現行 `fund-holdings.json` の microscope を **PR4 の中で手で直さない**（§7.4）。
- [ ] 品質ゲート PASS。マージ後の確認：`workflow_dispatch mode=dry-run` で前月分の差分がジョブサマリに出る（microscope は誤った 2026-05 構成からの差分になる）。
- [ ] マージは PR3 の後（PR3 前に入れると Mulmo のワークスペース版と入力がずれる）。

### 7.4 現行 `fund-holdings.json` の microscope の誤りの扱い（2026-10-03 Toshio 決定）
- **事実**：現行 JSON の microscope（2026-05）の上位10（6544・3139・9554・6200・4666・2782・4258・3480・2157・7381）は、§7.0 の資料 4 本のいずれとも一致しない（共通は 3480 のみで比率も異なる：JSON 2.35% / PDF 3.13%）。toushin は PDF と完全一致。
- **今は手で直さない**：PR2 の並行運転は Mulmo のワークスペース版 `fund-holdings.json`（同じく誤っているはず）と同じ入力で突き合わせている。リポ側だけ直すと microscope の加重 PER が Mulmo 版とずれ、突き合わせが乱れる。
- **直るタイミング**：PR4 は PR3（書き込み切替＝Actions が正）の後にマージする。PR4 マージ後の最初の月次実行（対象月＝前月。`asOf` が 2026-05 のままなので必ず更新対象になる）で、microscope の `top`/`asOf` が PDF 由来の正しい値に自動で上書きされる。toushin も同時に最新月へ進む。
- **既定案（対象月のみ・未公開なら待つ）**：2026-10 中にマージした場合、対象月は 2026-09。2026-10-03 時点で 202609 は 404 のため、**202609 が公開されるまで microscope の誤データが残る**（10 月 20 日までに公開されなければ 11 月の対象月 202610 の公開まで残る）。公開済みの最新月（202608）へ一度だけ遡って更新するかは **要 Toshio 判断**（下記）。
  - 代替案 B（コード変更なし）：PR4 マージ後に PM が `workflow_dispatch mode=write month=202608` を 1 回手動実行する（`asOf` 2026-05 → 2026-08 は前進なので §7.2 の後戻り防止に掛からない）。以後は通常の月次で 202609 に進む。
  - **→ 2026-10-03 Toshio 決定：初回は案 B で実施**（PR4 マージ後に PM が `month=202608` を 1 回手動実行。2026-08 のパース結果は PR 本文の「初回書き込みのプレビュー」で事前に確認する）。
  - 代替案 C（コード変更あり）：対象月が 404 のとき、`asOf` より新しい公開済みの最新月まで遡って更新する。毎月の挙動が変わるため既定にはしない。
  - Toshio が B を選んだ場合、本節に「初回は B で実施」と追記し、PM がマージ後に実行する。
- **それまでの影響**：microscope の加重 PER は誤った構成銘柄で計算され続ける。microscope は総資産比 約 0.2% のため影響は限定的（Toshio 了承済み）。
- **Mulmo への共有（§9 の補足・PM が #652 にコメントで伝える）**：Mulmo のワークスペース版 `fund-holdings.json` の microscope も同じく誤っているはず。PR3 切替後は Actions（リポの `data/scheduler/fund-holdings.json`）が正となるため **Mulmo 側での修正は不要**。PR4 マージ後は §9 のとおりワークスペース版の手動更新をやめる。

---

## 8. PR5：週次バッチ再開（中継口へ切替・初回は差分レポートのみ）／PR6：書き込み開始

### 8.1 PR5 対象ファイル
| ファイル | 状態 | 内容 |
|---|---|---|
| `data/scheduler/lib/worker-client.mjs` | 変更 | `fmp(path, params)` / `edinetDb(path, params)` / `edgar(path)` / `finnhub(path, params)` を追加（§2.2 のスロットル共通） |
| `data/scheduler/quality-us.mjs` | 変更 | FMP 直叩き（`apikey=`）→ `/fmp?path=/stable/...`。EDGAR `companyfacts` → `/edgar?path=/api/xbrl/companyfacts/CIK<10桁>.json`。`company_tickers.json`（`www.sec.gov/files/...`）は Worker の許可パス外なので**直接取得**（キー不要・`User-Agent: portfolio-quality (github-actions)`）。取れなければ EDGAR フォールバック不可としてその銘柄をスキップ。`getApiKey()` と `fmp-config.json` 読み込みを削除 |
| `data/scheduler/quality-jp.mjs` | 変更 | `edinetdb.jp` 直叩き（`X-API-Key`）→ `/edinet-db?path=/v1/search&q=<code4>`、`/edinet-db?path=/v1/companies/<code>/financials&period=annual&limit=2`。`resolveApiKey()` と `edinet-config.json` 読み込みを削除 |
| `data/scheduler/{quality-us,quality-jp,etf-pe,target-gap,sector-median,jp-sector-median,hit-rate}.mjs` | 変更 | **スクリプト内の `git commit` / `git push` を削除**（コミットはワークフローが 1 回で行う）。Worker 呼び出しは `worker-client.mjs` 経由（Origin・スロットル）。`sector-median` の既存 throttle（1100ms）は残す。対象銘柄・計算・書き戻しは変えない |
| `data/scheduler/diff-report.mjs` | 新規 | `git show HEAD:<file>` と作業ツリーを比べ、`valuations.json` は銘柄×ブロック（`quality`/`value`/`sectorMedian`）のフィールド単位 old→new、`verdict-outcomes.json` は `proposedOutcome`/`resolvedAt` の変化を Markdown で出す |
| `tests/diff-report.test.js` | 新規 | 合成データ |
| `.github/workflows/weekly-valuations.yml` | 新規 | 下記 |
| `data/scheduler/README.md` | 変更 | 「Mulmo のワークスペースで実行」「API キーの渡し方」を削除し、「GitHub Actions（`weekly-valuations.yml`）で実行・Worker 中継口経由・キー不要・手元実行も同じコマンド（キー不要）」に改定 |

### 8.2 `weekly-valuations.yml`（PR5 時点）
- トリガー：`schedule: '0 2 * * 0'`（日曜 02:00 UTC）＋`workflow_dispatch`（input `mode`: `report`(既定) / `write`）。**PR5 では schedule も `report`**。
- 順に実行：`quality-us` → `quality-jp` → `etf-pe` → `target-gap` → `sector-median` → `jp-sector-median` → `hit-rate`（各スクリプトは作業ツリーに書く・`--dry-run` は付けない）。1 本が失敗しても残りは続け、最後にジョブを失敗にする。
- `diff-report.mjs` の出力をジョブサマリと artifact（`weekly-diff-<日付>`・保持 30 日）に出す。
- `report` モードはここで終了（commit しない）。`write` モード（PR5 では workflow_dispatch のみ）：`git commit data/valuations.json data/verdict-outcomes.json -m "data: weekly valuations batch <日付>"` → push（§2.3）→ 同じジョブで `kv-resync.mjs --json`。
- `concurrency: portfolio-data-batch`。`permissions: { contents: write, issues: write }`。失敗時はラベル `weekly-batch-failed` の Issue を起票/更新、成功で自動クローズ。

### 8.3 PR5 受け入れ条件
- [ ] `data/scheduler/**` に API キー（環境変数・設定ファイル）を読むコードが残っていない。直接 API を叩くのは SEC の `company_tickers.json` だけ。
- [ ] スクリプト単体で `git commit`/`git push` しない。
- [ ] 既存テスト（`writeback` / `quality-calc` / `edinet-normalize` / `edgar-normalize` / `verdict-outcomes`）が変更なしで PASS。`tests/diff-report.test.js` PASS。
- [ ] schedule は `report` モード。品質ゲート PASS。
- [ ] マージ後の確認：`workflow_dispatch mode=report` を 1 回実行し、差分レポート（artifact）を #652 に貼る。

### 8.4 PR6：書き込み開始（初回レポート確認後）
- **子 Issue**: #658。**Toshio 確認：要**（workflows・CLAUDE.md に加え、**`valuations.json` の各銘柄エントリにキー `staleFields` を足す＝データ構造の変更**）。
- 着手条件：PR5 の初回差分レポートを Toshio が確認（3 か月分の更新でブロックが大きく変わる想定。不自然な値＝null 化の多発・桁違いが無いこと）。→ 2026-10-03 確認済み（下記 8.4.1）。
- 変更：`weekly-valuations.yml` の schedule を `write` に。`CLAUDE.md`「データの書き手」表に `data/valuations.json` の `quality`/`value`/`sectorMedian`/`staleFields` と `data/verdict-outcomes.json` ＝ GitHub Actions `weekly-valuations.yml`（毎週日曜 02:00 UTC）を追加。**加えて 8.4.2〜8.4.6 の null ガード**。

#### 8.4.1 初回差分レポートの所見（2026-10-03・run 37107968851・artifact `weekly-diff-2026-10-03`）
- null 化は 3 件：`6301.T` の `quality.roic`・`quality.intCoverage`、`6016.T` の `quality.grossProf`。
- 原因は取得経路の移行ではなく**データ提供元（EDINET DB）側**。最新の決算行（6301 は USGAAP の 2026/3 期）で `operating_income` と `ordinary_income` が空 → `src/edinet-normalize.js` の EBIT フォールバック（73〜77 行）が null → `roic`・`intCoverage` が null。6016 は `gross_profit` が空。
- `GOOGL` の `quality.intCoverage` 1110.7→216.8 は**未確定**（実態の借入増の可能性が高いが、FMP 失敗 → EDGAR フォールバックで算出元が変わった可能性も残る）。8.4.7 の手順で取得元を確認する。
- **Toshio 決定（2026-10-03）**：週次の書き込みで「新しい値が null・既存の値が非 null」のフィールドは、**既存値を保持し、古い値（stale）である印を付ける**（null で上書きしない）。

#### 8.4.2 null ガードの適用範囲
| 対象 | 適用 | 理由 |
|---|---|---|
| `valuations.json` の `quality`（`quality-us.mjs`・`quality-jp.mjs`） | **する** | 今回の null 化の発生源 |
| `valuations.json` の `value`（`etf-pe.mjs`・`target-gap.mjs`・`jp-sector-median.mjs`） | **する** | 書き戻し経路が同じ（現状の書き方では null を出さないが、同じ入口で守る） |
| `valuations.json` の `sectorMedian`（`sector-median.mjs`・`jp-sector-median.mjs`） | **する** | `per`/`evEbitda`/`grossMargin`/`pb` が個別に null になりうる |
| `verdict-outcomes.json`（`hit-rate.mjs`） | **しない** | 遷移は null→値（判定確定）が正。値→null は想定外で、ガードで隠さず差分レポートの「null 化」にそのまま出す |
| `valuations.json` の毎日の PER（`perCurrent`/`percentile`/`status`/`asOf`。PR2/PR3） | **しない** | 週次バッチの範囲外（判定ルールは §11 の正本値） |

判定のしかた（フィールド単位・ブロック内の 1 階層のみ）：
- 新ブロックに**キーが存在し値が `null`**、かつ既存ブロックの同キーが**非 null** → 既存値を書く＋印を付ける。
- 新ブロックに**キーが無い**（`undefined`）→ ガード対象外。`etf-pe.mjs` の「ブロック丸ごと置換で seed を撤去する」既存挙動を変えないため。
- 新ブロック自体が `null`（例：`quality-us.mjs` で `computeQuality` が null を返した）で既存ブロックがオブジェクト → **全フィールドが null とみなす**（既存ブロックを丸ごと保持し、非 null だった各フィールドに印）。
- 既存も null（または既存ブロック無し）→ そのまま null を書く（保持する値が無い。印は付けない）。
- 銘柄ごとスキップ（取得失敗で `results` に入らない）→ 従来どおり書かない（既存ブロックが残る）。**印は付けない**（今回の決定の範囲外・現行挙動のまま）。
- 派生値の再計算はしない。例：`roic` を保持しても `qScore` は新しく算出された値をそのまま書く（`qScore = fScore` で `roic`/`intCoverage`/`grossProf` に依存しない）。`quality-calc.js`・`edinet-normalize.js` の計算は変えない。

判定の場所：**新設 `data/scheduler/lib/null-guard.mjs`** に集約し、各スクリプトの `writeQualityBlocks(...)` / `writeBlocks(...)` 呼び出しを `writeGuardedBlocks(...)` に置き換える。`writeback.mjs`（`writeBlocks`/`writeQualityBlocks`）は**変えない**（§11・`tests/writeback.test.js` が守る既存挙動）。

| 関数 | 形 | 内容 |
|---|---|---|
| `guardBlock(oldBlock, newBlock, oldStale, blockKey, today)` | 純関数 | → `{ block, stale, kept: string[], recovered: string[] }`。`stale` はこの銘柄の `staleFields` 全体（他ブロックの印はそのまま） |
| `writeGuardedBlocks(path, results, blockKey, { today })` | I/O | ファイルを読む → 銘柄ごとに `guardBlock` → `writeBlocks(path, guarded, blockKey)` → 印が変わった銘柄だけ `writeBlocks(path, staleUpdates, 'staleFields')`。戻り値は `writeBlocks` と同じ件数。`today` 省略時は UTC の当日（`new Date().toISOString().slice(0, 10)`） |

- 置換箇所：`quality-us.mjs`・`quality-jp.mjs`（`writeQualityBlocks` → `writeGuardedBlocks(..., 'quality')`）、`etf-pe.mjs`・`target-gap.mjs`（`'value'`）、`sector-median.mjs`（`'sectorMedian'`）、`jp-sector-median.mjs`（`'value'` と `'sectorMedian'` の 2 箇所）。
- `--dry-run` の出力は従来どおり（ガード前の計算結果）。`report` モードも作業ツリーへの書き込みは同じ処理を通る（＝レポートはガード後の結果を示す）。
- ログ：保持したフィールドは `  [null-guard] 6301.T quality.roic: null → 既存値を保持（stale since 2026-10-04）` の形で出す（シンボル・フィールド名・日付のみ。値は出さなくてよい）。

#### 8.4.3 stale の印の形（データ構造の追加）
各銘柄エントリに**フラットなオブジェクト `staleFields`** を足す。キー＝`"<ブロック>.<フィールド>"`、値＝**null を最初に観測した週次実行の日付（UTC・YYYY-MM-DD）**。

前後比較の例（合成値）：
```jsonc
// 実行前（HEAD）
"XXXX.T": { "quality": { "roic": 6.0, "intCoverage": 80.2, "qScore": 4 }, ... }
// 新しい計算結果：{ "roic": null, "intCoverage": null, "qScore": 5 }
// 実行後（ガードあり）
"XXXX.T": {
  "staleFields": { "quality.roic": "2026-10-04", "quality.intCoverage": "2026-10-04" },
  "quality": { "roic": 6.0, "intCoverage": 80.2, "qScore": 5 }, ...
}
// （ガードなしなら "roic": null, "intCoverage": null になっていた）
```

この形にした理由：
- **既存キーの型を変えない**：`quality.roic` 等は数値か null のまま。アプリの読み手（`src/valuation-tab.js`・`src/valuations.js`・`src/value-detail-meta.js`）は `val.quality.<key>` を直接読むだけで、エントリのキーを列挙しない → 影響なし。
- **ブロックの中に入れない**：`quality` 内に `_stale` 等を足すと読み手が見るブロックのキー集合が変わり、入れ子にすると `writeBlocks` の「単層ブロック（最初の `}` が終端）」前提が壊れる。エントリ直下の単層オブジェクトなら `writeBlocks(path, x, 'staleFields')` でそのまま書ける。
- **ブロックごとに別キー（`qualityStale` 等）にしない**：1 キーで 3 ブロックを扱え、`"quality.roic"` のようなキー名は `writeBlocks` の `"quality":` 検索に一致しない（誤ヒットしない）。
- **日付＝null を最初に観測した日**：`quality`/`value` ブロックには取得日が無く、保持値の取得日は分からない。「この日以降、提供元から値が取れていない」が確実に言える情報。
- 他の読み手への影響：
  - `kv-resync`（`lib/kv-sync.mjs` の `mergeValuations`）はエントリ全体を KV の `valuation` に入れるため `staleFields` も KV に載る。比較キー（`perCurrent/status/asOf`）は不変なので drift 判定に影響しない。サイズ増は数十バイト／銘柄。
  - `watchlist-per.mjs`（`{ ...v, ... }`）は未知キーを保持する。
  - Mulmo（Briefing 生成・段C書き戻し）は `valuations.json` を読み書きする。**`staleFields` を消さない・書き換えないこと**を PM が #652 で申し送る（§9 に追記する代わりにここに記す）。Briefing 側で stale を使うかは Mulmo の判断（生成仕様の変更が要るなら Issue で提案）。
- **§11 の例外**：§11「`valuations.json` に新しいキーを足さない」に対し、`staleFields` だけは Toshio 決定（2026-10-03）により追加する。それ以外のキー追加は引き続き禁止。
- 読み手側の表示（Value タブで stale の値を薄く・注記する等）は**今回の範囲外**。**別 Issue 推奨**（`src/**` を触るので PR6 には入れない）。

#### 8.4.4 stale からの回復
- 次回以降の実行で同じフィールドに**非 null 値が取れたら**、その値を書き、`staleFields` から該当キーを外す。
- 引き続き null なら値は保持のまま、**日付は最初の観測日を維持**（上書きしない）。
- `staleFields` が空になったら `{}` を残す（`writeBlocks` はキーを削除できないため。読み手は空オブジェクトを無視する）。キーを消す処理は作らない。
- 書くのは**印が変わった銘柄だけ**（変化が無ければ `staleFields` に触れず、無関係な diff を出さない）。

例（合成値）：
| 回 | 新しい計算値 `roic` | 書く `quality.roic` | `staleFields["quality.roic"]` |
|---|---|---|---|
| 前回までの状態 | — | 6.0 | （無し） |
| 1 回目（2026-10-04） | null | 6.0（保持） | `"2026-10-04"` |
| 2 回目（2026-10-11） | null | 6.0（保持） | `"2026-10-04"`（維持） |
| 3 回目（2026-10-18） | 7.2 | 7.2 | 外す（他に無ければ `staleFields: {}`） |

#### 8.4.5 差分レポート（`diff-report.mjs`）
ガードで保持したフィールドは作業ツリー上では値が変わらないため、既存の `diffValuations` には出ない。`staleFields` の変化から別に拾う。
- 新関数 `diffStale(oldDoc, newDoc)` → `{ symbol, key, kind, since }[]`。`kind`：
  - `kept-new`＝**null 化（保持）**：HEAD に無いキーが作業ツリーにある。
  - `kept-cont`＝保持継続：両方にある。
  - `recovered`＝回復：HEAD にあり作業ツリーに無い。
- サマリ表：`valuations.quality`/`value`/`sectorMedian` の各行に列「**うち null 化（保持）**」（`kept-new` の件数・ブロックはキーの接頭辞で振り分け）を足す。既存の「うち null 化」列は**保持されずに null になった件数**のまま（ガード対象外の経路や想定外の null を見落とさないため）。
- 本文：`## data/valuations.json` の後に `### null 化（保持）`（銘柄・フィールド・stale since・保持している値＝作業ツリーの値）、`### 保持継続`、`### 回復（old→new）` を出す。いずれも 0 件なら節ごと省略。
- `VALUATION_BLOCKS` は変えない（`staleFields` 自体はブロック差分に出さない）。既存のテストは変更なしで PASS すること。

#### 8.4.6 PR6 の対象ファイル（追加分）
| ファイル | 状態 | 内容 |
|---|---|---|
| `data/scheduler/lib/null-guard.mjs` | 新規 | 8.4.2 の `guardBlock` / `writeGuardedBlocks` |
| `data/scheduler/{quality-us,quality-jp,etf-pe,target-gap,sector-median,jp-sector-median}.mjs` | 変更 | 書き戻し呼び出しを `writeGuardedBlocks` に置換（計算・対象銘柄は変えない） |
| `data/scheduler/diff-report.mjs` | 変更 | 8.4.5 |
| `tests/null-guard.test.js` | 新規 | 合成データ（下記） |
| `tests/diff-report.test.js` | 変更 | `diffStale` とサマリ列のテストを追加（既存ケースは変えない） |
| `data/scheduler/README.md` | 変更 | null ガードと `staleFields` の説明を 1 節 |
| `.github/workflows/weekly-valuations.yml`・`CLAUDE.md` | 変更 | 上記「変更」のとおり |

変えない：`data/scheduler/writeback.mjs`・`src/**`（`quality-calc.js`・`edinet-normalize.js` の EBIT フォールバック含む）・`hit-rate.mjs`・`data/valuations.json` 本体（手で編集しない。印は初回 write 実行で入る）。

#### 8.4.7 初回 write 実行の確認手順（マージ後・PM）
1. `workflow_dispatch mode=write` を 1 回実行する。
2. ジョブサマリの差分レポートで、`null 化（保持）` に 6301.T `quality.roic`・`quality.intCoverage`、6016.T `quality.grossProf` が出て、「うち null 化」（保持されない null）が 0 件であることを確認する（提供元の状況が変わっていれば件数は変わってよい）。
3. **GOOGL の取得元**：`quality-us` ステップのログで `[GOOGL]` の直後に `[FMP] Failed for GOOGL: ... — trying EDGAR fallback` があるか確認する。無ければ FMP（実態の借入増と判断してよい）、あれば EDGAR フォールバック（`intCoverage` の算出元が変わった）。結果を #652 にコメントし、EDGAR だった場合は Toshio に報告する（値の扱いは Toshio 判断・本 PR では変えない）。
4. push 後に kv-resync が成功していること（KV の `valuation` に `staleFields` が載ってもアプリが正常表示）。

#### 8.4.8 受け入れ条件
- [ ] schedule が `write`・push 後に kv-resync・品質ゲート PASS。
- [ ] `writeback.mjs` に差分なし。`tests/writeback.test.js` ほか既存テスト（`quality-calc`/`edinet-normalize`/`edgar-normalize`/`verdict-outcomes`/`diff-report` の既存ケース）が変更なしで PASS。
- [ ] `tests/null-guard.test.js`（合成データ・一時ファイル）PASS。最低限の観点：
  1. 新 null・既存非 null → 既存値保持＋`staleFields["quality.roic"] = today`。
  2. 新 null・既存 null／既存ブロック無し → null を書く・印なし。
  3. 新非 null → 新値を書く。既に印があれば外す（回復）。他フィールド・他ブロックの印は残る。
  4. 連続 null → 日付は最初の観測日のまま。
  5. 新ブロックにキーが無い（etf-pe 型の丸ごと置換）→ ガードしない（キーは消える）。
  6. 新ブロック自体が null・既存がオブジェクト → 既存ブロック丸ごと保持＋非 null だった全フィールドに印。
  7. 派生値（`qScore`）は新値のまま書かれる。
  8. 印が変わらない銘柄では `staleFields` を書かない（ファイルの該当箇所がバイト一致）。全回復で `staleFields: {}`。
  9. 書き戻し後のファイルが JSON として妥当で、対象外のフィールド（`bandLow`/`note` 等）とインデント・インライン配列が保たれる。
  10. `staleFields` がある状態で `writeBlocks(..., 'quality')` が `"quality.roic"` キーに誤ヒットしない。
- [ ] `tests/diff-report.test.js` 追加分 PASS：`kept-new`/`kept-cont`/`recovered` の判定、サマリの「うち null 化（保持）」列、保持されない null が従来どおり「うち null 化」に数えられること。
- [ ] `verdict-outcomes.json` の書き方は変わらない（ガードを通さない）。
- [ ] ログ・レポートに出すのはシンボル・フィールド名・日付・公開済みの指標値まで（§12）。
- [ ] マージ後：8.4.7 を実施し結果を #652 に記録。

#### 8.4.9 申し送り・別 Issue 候補
- **別 Issue 推奨**：Value タブ等で `staleFields` の値を「古い値」と分かるように表示する（`src/**`・表示の方向性は Toshio 確認）。
- **別 Issue 候補（要 Toshio 判断）**：USGAAP 企業で `operating_income`・`ordinary_income` が共に空のとき、税引前利益を EBIT に使う案（`src/edinet-normalize.js` の EBIT フォールバック変更＝計算の正本に関わるため PR6 では扱わない）。
- Mulmo へ（PM が #652 にコメント）：`valuations.json` の `staleFields` を消さない・書き換えない。

---

## 9. Mulmo 側作業の申し送り（本リポの範囲外・PM が #652 にコメントで依頼）
| タイミング | Mulmo の作業 |
|---|---|
| PR2 の並行運転中 | 日次バッチは**今のまま**（フェーズ0・kv-resync とも継続）。毎日 1 回 `valuations.json` を commit/push すること（突き合わせの相手になる） |
| PR3 マージ後 | ①フェーズ0から `watchlist-per.mjs --write` と `fund-per.mjs --write` を外す ②③a・③c の `kv-resync.mjs` 呼び出しを外す（Mulmo の push で kv-resync.yml が起動する） ③push 前に `git pull --rebase` を入れる ④Actions が当日分を書いたかは、**main に `github-actions[bot]` の `data: daily PER <D>` コミットがあるか**で判定する（D＝CST 日付の前日＝Actions 実行時の UTC 日付。例：2026-10-04 05:00 CST の実行なら `data: daily PER 2026-10-03`。確認例 `git fetch origin && git log origin/main --author=github-actions --fixed-strings --grep="data: daily PER 2026-10-03" -1`）。`valuations.json` 最上位の `asOf`/`updated` は段C の書き戻しでも変わるので判定に使わない。コミットが無ければ前日値で続行し、その旨を記録（2026-10-03 改訂・§6.2） ⑤ワークスペースの `watchlist-per.mjs`/`fund-per.mjs`/`kv-resync.mjs` を削除 |
| PR4 マージ後 | ワークスペースの `fund-holdings.json` の手動更新をやめる（正本はリポの `data/scheduler/fund-holdings.json`） |
| PR5/PR6 マージ後 | ワークスペースの古い `quality-us.mjs`（2026-06-20）を削除（as-is §4） |
| 常時 | 21:00〜22:30 UTC 以外の時間帯でも、push 前は `git pull --rebase`。土曜のバンド見直しで `bandLow`/`bandHigh` を変えた場合、%タイルの再計算は翌日の Actions（20:15 UTC）で入る（従来の翌日フェーズ0と同じタイミング） |

## 10. 確認推奨（既定で進める・Toshio が変えたければ指示）
1. **per-daily の時刻**：20:15 UTC 固定。冬時間（2026-11-01〜）は米国市場の引け 45 分前の PER になる。引け後にしたい場合は 21:00 UTC 以降が必要だが Mulmo の Briefing（21:00 UTC）に間に合わない。並行運転が 11 月に掛かると Mulmo（21:00 UTC＝引け時点）との PER 入力差で `mismatch-input` が出やすくなる。
2. **%タイルの一致は厳密一致**（決定どおり）。`mismatch-input`（計算は同じ・PER の取得時刻差で境界をまたいだ）だけで連続一致が途切れ続ける場合は、許容（例：±1）を入れるか Toshio が判断する。本設計では許容を入れていない。
3. **判定不能日**（shadow 失敗・Mulmo 未実行）は連続日数に数えず、リセットもしない。
4. **band-changed 銘柄は除外**（土曜のバンド見直し日を不一致にしないため）。
5. ひふみ上位10は検証＋既知月の自己検証が通れば **main に直接コミット**（他の自動データと同じ扱い）。

## 11. 触ってはいけない範囲
- **投資判断の正本値**：`score()` の閾値（33/66）・線形%タイルの算出・バンド不正時の扱い・`fund-per` の加重平均と `coverage`・`kv-sync` の比較キー（`perCurrent/status/asOf`）。原本から一字一句変えない。
- `data/valuations.json` の**キー・形状**（新しいキーを足さない）。書くフィールドは §6.3 の範囲だけ。`bandLow`/`bandHigh`/`note`/提案系など Mulmo が書くフィールドに触れない。
- `data/scheduler/writeback.mjs`（`tests/writeback.test.js` が守る既存挙動）。
- 週次バッチの対象銘柄リスト（`ETF_SKIP` / `JP_ETF_SKIP` / etf-pe の 10 銘柄・jp-sector-median の静的マップ）と計算。
- `worker/**`（中継口の追加・変更は本移行の範囲外。必要になったら別 Issue＝セキュリティ扱い）。
- `src/**`・`assets/**`・`index.html`（アプリは変えない）。週次バッチが import する `src/quality-calc.js` 等も変えない。
- `docs/briefing-generation-spec.md`・`data/briefings/**`（Mulmo の正本）。
- 既存ワークフロー（`test.yml`・`e2e.yml`・`build-dist.yml`・`mf-freshness.yml`）。
- GitHub Secrets・Worker Secrets（追加しない）。
- `data/mf-*.json`・`data/positions.json`・`data/portfolio-snapshot.json`・`data/real-assets/**`（無関係）。

## 12. 公開リポの確認
- 扱うデータ：`valuations.json`（既に公開）・KV ウォッチリスト（`symbol`/`name`/`exchange`/`cur`/`type`/`valuation`＝保有額・株数を含まない。`GET /watchlist` は元々認証なし）・`fund-holdings.json`（ファンドの公開開示）・`verdict-outcomes.json`（既に公開）。**個人の保有額・資産実額・口座情報は扱わない**。
- Actions のログ・ジョブサマリ・artifact・自動 Issue は公開される。出すのは銘柄シンボル・PER・%タイル・status・件数まで。KV の生ボディ・HTTP レスポンス本文をログに出さない。
- Secrets は追加しない（API キーは Worker 側のみ）。`Origin` ヘッダの値は秘密ではない。
- 既存の観察（本移行の範囲外・別 Issue 推奨）：`PUT /watchlist` は Origin ヘッダの有無にかかわらず受け付ける（PIN 不要）。誰でも KV のウォッチリストを書き換えられる。kv-resync の自己修復で `valuation` は戻るが、`name` 等や銘柄の削除は戻らない。

## 13. ブランチ / PR
| PR | ブランチ例 | PR タイトル例 |
|---|---|---|
| PR1 | `feat/phase15-kv-resync` | feat: KV ウォッチリストの valuation を Actions で自動同期（#652 PR1） |
| PR2 | `feat/phase15-per-shadow` | feat: 毎日の PER を Actions で並行運転（計算のみ）＋自動突き合わせ（#652 PR2） |
| PR3 | `feat/phase15-per-cutover` | feat: 毎日の PER を Actions の書き込みに切り替え（#652 PR3） |
| PR4 | `feat/phase15-hifumi-monthly` | feat: ひふみ上位10を月次レポートから自動更新（#652 PR4） |
| PR5 | `feat/phase15-weekly-report` | feat: 週次バッチを Worker 中継口で再開（差分レポート）（#652 PR5） |
| PR6 | `feat/phase15-weekly-write` | feat: 週次バッチの書き込みを開始（#652 PR6） |

- base は `main`。各 PR は `Closes #<子Issue>`＋`Refs #652`。全 PR が `needs-toshio`。
- 「Mac 実機確認要」は無い（全処理が Actions で完結）。動作確認はマージ後の `workflow_dispatch`（各 PR の受け入れ条件に記載）。
