# Mulmo の日次データ処理 — 現状仕様（第1.5次移行の入力資料）

> 作成: 2026-10-03 Mulmo。**これは設計書ではなく「今どう動いているか」の記録**。移行の設計は architect が `docs/handoff/` に書く。
> 対応 Issue: 第1.5次移行（本ファイルを参照する Issue）。決定事項は §6。

## 1. 背景
- portfolio のデータの一部は、Mulmo（MulmoClaude）のワークスペースにあるスクリプトが毎朝の日次バッチで更新している。スクリプトはリポ外にあり、Claude Code から見えない。
- 2026-10-03 Toshio 決定：**portfolio のデータ更新スクリプトは portfolio リポに移し、GitHub Actions で動かす**（第1.5次）。Briefing の生成は Mulmo に残す。
- スクリプトの原本（2026-10-03 時点）を `docs/handoff/assets/2026-10-03-phase15/` に置いた。**参考資料であり、そのまま動かす前提ではない**（パスがワークスペース基準）。

## 2. Mulmo の日次バッチ（毎日 21:00 UTC＝05:00 CST）での流れ
```
フェーズ0（21:00 UTC 開始・並走）
  git pull（github/portfolio を main で最新化）
  → market-snapshot.mjs（FRED/Yahoo のマクロ指標・Briefing 用）   … Mulmo に残す
  → watchlist-per.mjs --write   … 移す（§3.1）
  → fund-per.mjs --write        … 移す（§3.2）
  → curl GET /watchlist（KV の現状を取得）
③a 収集：上の結果を流用。直後に kv-resync.mjs --json（前日の KV 書き込み失敗の自己修復）   … 移す（§3.3）
③b/③b2 判断（Opus）：保有・ウォッチの判定（watchlistVerdicts）を作る
③c 組版&配信：data/briefings/<版ID>.html 生成 → valuations.json に判定を書き戻し
     → kv-resync.mjs --json → briefing-qa.mjs → git add data/briefings/ data/valuations.json → commit → push origin main
```
- 所要はおおむね 21:00〜22:00 UTC。この時間帯に他から main へ push されると、Mulmo の push が non-fast-forward で失敗しうる。

## 3. 移すスクリプト（Mulmo ワークスペース → portfolio リポ）
### 3.1 `watchlist-per.mjs`（毎日）
- 処理：`data/valuations.json` の各銘柄について、Worker の `/yahoo` 中継で Yahoo `quoteSummary`（summaryDetail/defaultKeyStatistics）の `trailingPE` を取り、**バンド（bandLow〜bandHigh）内の線形%タイル**と status（≤33 cheap／≤66 fair／それ以上 rich）を算術で再計算する。LLM 不使用。
- 書き込み：`--write` で `perCurrent` / `percentile` / `status` / `asOf` を更新。PER が取れない銘柄（例：赤字の CRWD、Yahoo 未提供の 2800.HK）は前回値を維持し `needsManual`。
- 出力形式：`JSON.stringify(obj, null, 1)`（**インデント1スペース**＝既存と最小差分）。
- 依存：`https://portfolio-proxy.shoulang.workers.dev/yahoo?url=...`、ヘッダ `Origin: https://shoulang0729.github.io`（Worker の CORS 判定）。API キー不要。
- バンドの見直しは土曜に Briefing の判断段（Opus）が行う（この処理の外）。

### 3.2 `fund-per.mjs` ＋ `fund-holdings.json`（毎日・入力は月次）
- 処理：アクティブ投信の月次レポート上位10銘柄（code/weight）について各 `trailingPE` を同じ中継で取り、組入比率で加重平均 → `valuations[<投信の正式名>]` に追加マージ（カバー率つき）。
- 入力 `fund-holdings.json`：レオス（ひふみ）の月次レポート PDF から上位10を抽出したもの。**2026-05 分のまま止まっている**（手動更新だった）。
  - PDF：`https://hifumi.rheos.jp/fund/<f>/pdf/report<YYYYMM>.pdf`（f = `toushin` / `microscope`）。`pdftotext -layout` で上位10（銘柄名・コード・比率）を抽出できた（2026-06-28 実績）。
  - ひふみクロスオーバーpro は上位5のみ・未上場株中心のため対象外（指数の代替 PER を維持）。
- 設計の経緯：`docs/handoff/2026-06-28-active-fund-valuation.md`。

### 3.3 `kv-resync.mjs`（`valuations.json` が変わるたび）
- 処理：アプリのウォッチリスト（Worker KV・`GET/PUT /watchlist`）の各要素の `valuation` を、正本 `data/valuations.json` に合わせる。**配列形状を保持**（Worker はオブジェクトを送ると 400）、他フィールド（name 等）は保持、正本に無い銘柄は据え置き。PUT は最大5回リトライし、**read-back で反映を必ず検証**、失敗時は exit≠0。
- モード：引数なし＝同期、`--check`＝検知のみ（ズレありで exit 3）、`--json`＝結果を1行JSON。
- 経緯：2026-07-06〜08 に KV が2日ズレたまま気づかれなかった事故の対策（冪等＝同期済みなら何もしない）。
- 認証：`PUT /watchlist` は Origin ヘッダのみ（PIN 不要）。

## 4. リポにあるが止まっている週次バッチ
`data/scheduler/README.md` の各スクリプト（`quality-us` / `quality-jp` / `etf-pe` / `target-gap` / `hit-rate`）と `sector-median` / `jp-sector-median`。README は「Mulmo のワークスペースで実行する前提・CI では動かさない（API キーを Secrets に置かないため）」だが、**どこからも定期実行されておらず、最後の更新は 2026-06-21〜25**（Value タブの品質指標・ETF PER・目標株価乖離・同業中央値・的中率が3か月以上古い）。
- API キー：Worker に中継口がある（`/fmp` `/edinet-db` `/finnhub` `/edgar` `/yahoo`、キーは Worker の Secrets）。`quality-jp.mjs` は現状 `EDINET_DB_API_KEY` を環境変数で直接使う。
- ワークスペース側にも `quality-us.mjs`（2026-06-20）があるが、リポ版とは別物の古いコピーで、どこからも呼ばれていない → 移さない（Mulmo 側で削除する）。

## 5. Mulmo に残るもの（移さない）
- `market-snapshot.mjs`（マクロ指標）・`briefing-qa.mjs`（Briefing の公開前チェック）＝ Briefing の部品。
- Briefing の判断（watchlistVerdicts）の `valuations.json` への書き戻し（③c）。→ 移行後も `valuations.json` は Mulmo からも書かれる。

## 6. 決定事項（2026-10-03 Toshio）
1. 範囲：§3 の3つ ＋ ひふみ上位10の月次自動更新 ＋ §4 の週次バッチの再開。
2. API キーは GitHub に置かず、Worker の中継口を使う。
3. 毎日の PER（§3.1/§3.2）は、**書き込まずに計算だけする並行運転で Mulmo の結果と自動で突き合わせ、3日連続で一致したら切り替える**。一致の判定は status と %タイルの一致（PER 値は取得時刻の差を許容）。不一致の日は差分を Issue に自動で書く。
4. 推奨の PR 順（Mulmo 案・architect が確定）：
   1. KV 自動同期（`valuations.json` の push をきっかけに `kv-resync`＋日次の自己修復）— 冪等なので並行運転不要
   2. 毎日の PER を Actions で並行運転（計算のみ）＋突き合わせ
   3. 3日一致後に書き込みへ切り替え（→ Mulmo 側でフェーズ0と kv-resync 呼び出しを外す。Mulmo の担当）
   4. ひふみ上位10の月次自動更新
   5. 週次バッチの再開（中継口への切り替え・README 改定。初回は差分レポートを出してから書き込み）

## 7. 移行で気をつける点（Mulmo の所見）
- **時刻**：毎日の PER は Briefing（21:00 UTC）より前に終える。GitHub Actions の cron は数十分遅れることがあるので余裕を持たせる。US 市場の終了は夏時間中 20:00 UTC・冬時間（11月〜3月）21:00 UTC。
- **push の衝突**：21:00〜22:30 UTC は Mulmo が `valuations.json` を書くので、Actions からの push を避ける（週次バッチもこの時間帯を外す）。push する Actions は `pull --rebase`＋リトライを入れる。Mulmo 側も push 前に `pull --rebase` を入れる（Mulmo の担当）。
- **Actions が遅れた/失敗した朝**：Mulmo は `valuations.json` の `asOf` が当日でなければ前日値で Briefing を続け、その旨を記録する（Mulmo 側の対応）。
- **Worker のレート制限**：IP あたり毎分120回。銘柄は40前後なので1回の実行は収まるが、複数のジョブを同時に走らせない（concurrency を設定）。
- **形式**：`valuations.json` はインデント1スペース。`data/scheduler/writeback.mjs` の `writeBlocks()` は元の形式を保つ。
- **公開リポ**：`fund-holdings.json` はファンドの公開情報なのでコミットしてよい。個人の保有額・資産は扱わない。
