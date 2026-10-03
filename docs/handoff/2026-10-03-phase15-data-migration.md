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
| PR2 毎日 PER 並行運転 | #____ | | | 未着手 |
| PR3 書き込みへ切り替え | #____ | | | 未着手（PR2＋3日連続一致待ち） |
| PR4 ひふみ上位10 月次自動更新 | #____ | | | 未着手 |
| PR5 週次バッチ再開（差分レポート） | #657 | `feat/657-weekly-report` | | 実装済み（PR 作成待ち） |
| PR6 週次バッチ書き込み開始 | #____ | | | 未着手（PR5 初回レポート確認待ち） |

- 並行運転の連続一致日数：____（トラッキング Issue #____ が自動更新）
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

## 6. PR3：書き込みへ切り替え（3 日連続一致の後）

### 6.0 着手条件
- トラッキング Issue の連続一致日数が 3 以上（`mismatch-input` だけで止まり続ける場合は §10 確認推奨 2 で Toshio 判断）。
- Toshio の切り替え了承（PR は needs-toshio で止まる）。

### 6.1 対象ファイル
| ファイル | 状態 | 内容 |
|---|---|---|
| `.github/workflows/per-daily.yml` | 変更 | shadow → **write** に変更、compare ジョブと 01:30 の schedule を削除 |
| `data/scheduler/README.md` | 変更 | 「毎日の PER（Actions）」節と「KV 同期」節を追加 |
| `CLAUDE.md` | 変更 | 「データの書き手」表の `data/valuations.json` 行を「Mulmo（判断の書き戻し）＋ GitHub Actions `per-daily.yml`（毎日 20:15 UTC・`perCurrent`/`percentile`/`status`/`asOf` とファンドの加重 PER）」に分ける |

### 6.2 手順
1. write ジョブ：`permissions: { contents: write, issues: write }`。開始時刻が 20:55〜22:30 UTC なら計算のみに落とす（§2.6）。
2. `watchlist-per.mjs --write` → `fund-per.mjs --write` → 差分が無ければ終了 → `git commit data/valuations.json -m "data: daily PER auto-update <UTC日付>"` → push（§2.3 のリトライ）。
3. push 成功後、同じジョブで `node data/scheduler/kv-resync.mjs --json`（GITHUB_TOKEN の push では kv-resync.yml が起動しないため）。失敗時は kv-resync と同じ `kv-resync-failed` Issue。
4. write ジョブ失敗時：ラベル `per-daily-failed` の Issue を起票/更新、成功で自動クローズ。
5. トラッキング Issue（`per-shadow`）は PR 本文で `Closes` しない。マージ後に PM が「切替済み」とコメントしてクローズ。
6. Mulmo への申し送り（§9）を PR 本文に貼り、マージ後に PM が #652 にコメントする。

### 6.3 受け入れ条件
- [ ] `valuations.json` の変更は `perCurrent`/`percentile`/`status`/`asOf`（銘柄）と `updated`/`asOf`（トップ）、ファンドエントリの `perCurrent`/`coverage`/`source`/`asOf`/`components` だけ（`git diff` で確認できる合成テスト、または dry-run の差分を PR に添付）。書式（インデント・末尾改行）が変わらない。
- [ ] 21:00〜22:30 UTC に push しないガードがある。
- [ ] push 後に kv-resync が同じジョブで走る。
- [ ] 品質ゲート PASS。

---

## 7. PR4：ひふみ上位10の月次自動更新

### 7.0 前提資料（着手前に PM が用意）
- 実装環境（クラウド）から `hifumi.rheos.jp` に接続できない（2026-10-03 確認：egress で拒否）。パーサを書くために、**2026-05 の月次レポート 2 本（`toushin` / `microscope`）の `pdftotext -layout` 出力テキスト**を `docs/handoff/assets/2026-10-03-phase15/hifumi-report-202605-<f>.txt` として置く（Mulmo に依頼。ファンドの公開資料なのでコミット可）。用意できない場合、PR4 は保留。

### 7.1 対象ファイル
| ファイル | 状態 | 内容 |
|---|---|---|
| `data/scheduler/lib/hifumi-parse.mjs` | 新規 | 純関数 `parseTop10(text)` → `[{code, name, weight}]`、`validateTop10(rows)` |
| `data/scheduler/fund-holdings-update.mjs` | 新規 | PDF 取得→`pdftotext -layout`→パース→検証→`fund-holdings.json` 更新。`--month YYYYMM` / `--dry-run` |
| `tests/hifumi-parse.test.js` | 新規 | §7.0 のテキストを fixture に、2026-05 の既存 `fund-holdings.json` と完全一致すること |
| `tests/fixtures/hifumi/*.txt` | 新規 | §7.0 のテキスト（コピー） |
| `.github/workflows/fund-holdings-monthly.yml` | 新規 | 下記 |
| `CLAUDE.md` | 変更 | 「データの書き手」表に `data/scheduler/fund-holdings.json` ＝ GitHub Actions `fund-holdings-monthly.yml`（月次）を追加 |

### 7.2 手順・決定
- 対象＝`toushin`（ひふみ投信）と `microscope`（ひふみマイクロスコープpro）。**クロスオーバーpro は対象外**（上位5のみ・未上場中心・as-is §3.2）。
- 取得 URL：`https://hifumi.rheos.jp/fund/<f>/pdf/report<YYYYMM>.pdf`。対象月＝実行日の**前月**。`fund-holdings.json` の該当ファンドの `asOf`（`YYYY-MM`）が既に対象月なら何もしない。404 は「未公開」で正常終了。
- 変換：`code` は 4 桁（英数字・例 `8001` / `285A`）に `.T` を付ける。`weight` は % → 小数 4 桁（5.28% → 0.0528）。`name` は PDF 表記のまま。`fund`/`fundSymbol`/`source` は既存値を保持し、`top` と `asOf` だけ差し替える。書式は §2.4 で保持。
- **検証（すべて満たさなければ書き込まない）**：①ちょうど 10 行 ②code が `^[0-9][0-9A-Z]{3}$` ③0 < weight < 0.2 ④weight 合計 ≤ 1 ⑤name が空でない ⑥code 重複なし。
- **既知月の自己検証**：毎回、2026-05 の PDF も取得・パースし、テスト fixture と同じ結果（＝現行 `fund-holdings.json` の 2026-05 値）になることを確認する。違えば「パーサ不整合（レイアウト変更の疑い）」として書き込まない。
- ワークフロー：`schedule: '0 3 1-20 * *'`＋`workflow_dispatch`（input `mode`: `write`(既定) / `dry-run`、`month`）。`apt-get install -y poppler-utils`。`concurrency: portfolio-data-batch`。`permissions: { contents: write, issues: write }`。更新があれば `git commit data/scheduler/fund-holdings.json -m "data: hifumi top10 <YYYY-MM>"` → push（§2.3）。
- 失敗/未公開の通知：検証 NG・自己検証 NG・取得エラーは即、**20 日の実行でも前月分が未公開**ならラベル `fund-holdings-stale` の Issue。更新成功で自動クローズ。
- 加重 PER の再計算は翌日の per-daily（PR3）が `fund-holdings.json` を読んで行う（このワークフローは `valuations.json` を触らない）。

### 7.3 受け入れ条件
- [ ] `tests/hifumi-parse.test.js`：fixture 2 本のパース結果が現行 `fund-holdings.json`（2026-05）の `top` と完全一致。検証 ①〜⑥ の各違反ケースで NG。
- [ ] `valuations.json` を書かない。`fund-holdings.json` の `top`/`asOf` 以外のキーを変えない。
- [ ] 品質ゲート PASS。マージ後の確認：`workflow_dispatch mode=dry-run` で前月分の差分がジョブサマリに出る。
- [ ] マージは PR3 の後（PR3 前に入れると Mulmo のワークスペース版と入力がずれる）。

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
- 着手条件：PR5 の初回差分レポートを Toshio が確認（3 か月分の更新でブロックが大きく変わる想定。不自然な値＝null 化の多発・桁違いが無いこと）。
- 変更：`weekly-valuations.yml` の schedule を `write` に。`CLAUDE.md`「データの書き手」表に `data/valuations.json` の `quality`/`value`/`sectorMedian` と `data/verdict-outcomes.json` ＝ GitHub Actions `weekly-valuations.yml`（毎週日曜 02:00 UTC）を追加。
- 受け入れ条件：schedule が write・push 後に kv-resync・品質ゲート PASS。

---

## 9. Mulmo 側作業の申し送り（本リポの範囲外・PM が #652 にコメントで依頼）
| タイミング | Mulmo の作業 |
|---|---|
| PR2 の並行運転中 | 日次バッチは**今のまま**（フェーズ0・kv-resync とも継続）。毎日 1 回 `valuations.json` を commit/push すること（突き合わせの相手になる） |
| PR3 マージ後 | ①フェーズ0から `watchlist-per.mjs --write` と `fund-per.mjs --write` を外す ②③a・③c の `kv-resync.mjs` 呼び出しを外す（Mulmo の push で kv-resync.yml が起動する） ③push 前に `git pull --rebase` を入れる ④`valuations.json` の `asOf` は**実行時の UTC 日付**。05:00 CST 実行時は「CST 日付の前日」なら当日分。違えば前日値で続行し、その旨を記録 ⑤ワークスペースの `watchlist-per.mjs`/`fund-per.mjs`/`kv-resync.mjs` を削除 |
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
