# portfolio が外部に約束していること（Mulmo・Actions・Mac との境目）

> 作成: 2026-10-05（#724・`docs/handoff/2026-10-05-refactor-before-migration.md` §7.1）。
> **用途**: リファクタ（段階5）の各 PR の「壊していないこと」の確認リスト。#713（Notion 移管・`claude -p` 化）の設計は「この表のどの行を動かすか」で書く。
> **正本の関係**: データの書き手は [CLAUDE.md](../CLAUDE.md)「データの書き手」、Worker のルートは `worker/src/index.js` 冒頭のコメント、Briefing の生成仕様は [docs/briefing-generation-spec.md](./briefing-generation-spec.md)（Mulmo の正本）、Mulmo の日次処理の現状は [docs/mulmo-data-scripts-asis.md](./mulmo-data-scripts-asis.md)、Actions の詳細は [data/scheduler/README.md](../data/scheduler/README.md)、注文表は [docs/order-sheet-ops.md](./order-sheet-ops.md)。食い違ったら正本を優先し、本書を直す。
> **公開リポ**: 本書には実額・口座名・秘密の値を書かない。Secrets・環境変数は名前だけ。
> 「未確認（Mulmo に確認中）」の行は、Mulmo の回答（#724 のコメント）で埋める。

時刻はすべて UTC。Mulmo の日次バッチは 21:00 UTC（＝05:00 CST）開始。

## 1. Mulmo が書くもの

| 書く先 | 書く内容（キー） | タイミング | 約束（形・守ること） | 出典 |
|---|---|---|---|---|
| `data/valuations.json` | 判断の書き戻し: 各銘柄の `note`・`buyProposal`・`sellProposal`（③c）。土曜のバンド見直しで `bandLow`/`bandHigh`。最上位の `updated`/`asOf` も変わりうる | 日次バッチの最後（③c）に `data/briefings/` と同じ 1 回の commit・push。PER の当日コミットを最長 21:52 まで待ってから判断・書き戻し。push は 22:59 まで（Actions の push 禁止時間帯の内側） | インデント 1 スペース・キーと形を変えない。`perCurrent`/`percentile`/`status`/`asOf`（per-daily の担当）・`quality`/`value`/`sectorMedian`/`staleFields`（weekly の担当）は書き換えない（`staleFields` は消さない・`data/scheduler/README.md`）。push 前に `pull --rebase` | CLAUDE.md・asis §2・§5・§7・`docs/handoff/2026-10-05-per-daily-dispatch.md` §6.3 |
| `data/valuations.json`（その他のキー） | `verdict`・`momentum`・`bandMedian`・`bandBasis`・`bandConfidence`・`bandNote`・`forwardPE`・`needsManual` を Mulmo が書くか | — | 未確認（Mulmo に確認中） | — |
| `data/briefings/<YYYY-MM-DD-HHMM>.html` | Briefing 本文（自己完結のモバイル HTML 1 ファイル・版 ID は CST） | 日次バッチ（③c）。毎回新規ファイル・既存号は上書きしない | 公開リポなので注文表の値・PIN ハッシュを書かない | briefing-generation-spec §0・order-sheet-ops §8 |
| `data/briefings/index.json` | `{ updated, issues: [{ date, title, path }] }`。`issues` の先頭に新版を追加（過去号を消さない） | 同上 | `date`＝`"YYYY-MM-DD HH:MM"`（固定幅・辞書順＝新しい順）・`title`＝`"Briefing YYYY/MM/DD HH:MM"`・`path`＝`"data/briefings/YYYY-MM-DD-HHMM.html"`。アプリ `src/briefing.js` がこの形を読む | briefing-generation-spec §0 |
| KV `order:plan`・`order:log`（Worker 経由のみ） | `POST /order-sheet/events` の `rebase`・`review` | イベント後の Briefing 生成で必要なとき | rev 楽観ロック（409 は取り直してから送り直す）。PIN ハッシュ・注文表の値をログ・Briefing・コミットに出さない。運用開始済みかは未確認（Mulmo に確認中・#676 の提案） | order-sheet-ops §8 |

## 2. Mulmo が読むもの

| 読むもの | 読み方・目的 | 状態 | 出典 |
|---|---|---|---|
| `data/valuations.json` | `git pull` 後に読む。判断（③b）の入力。`asOf` が当日でなければ前日値で続行 | 確認済み（docs） | asis §2・§7 |
| main のコミット `data: daily PER <UTC日付>`（author `github-actions[bot]`） | 当日の PER が書かれたかの判定。最長 21:52 まで待ち、無ければ前日値で続行（`valuations.json` の `asOf`/`updated` は判定に使わない） | 確認済み（docs） | data/scheduler/README.md・per-daily-dispatch §6.4 |
| `data/briefings/index.json` | 先頭に新版を追加するために読む | 確認済み（docs） | briefing-generation-spec §0 |
| `docs/briefing-generation-spec.md` | 生成仕様（プロンプトに貼る） | 確認済み（docs） | 同ファイル冒頭 |
| `data/target-allocation.json` | 発議の前にテーマ上限・AI/テック上限を確かめる | 申し送り済み・実際に読んでいるかは未確認（Mulmo に確認中） | order-sheet-ops §8 |
| `data/mf-holdings.json` | 保有の判断に使うか | 未確認（Mulmo に確認中） | — |
| `data/mf-history.json` | 同上 | 未確認（Mulmo に確認中） | — |
| `data/verdict-outcomes.json` | 判断の的中率の振り返りに使うか | 未確認（Mulmo に確認中） | — |
| `data/scheduler/fund-holdings.json` | ファンドの上位銘柄を判断に使うか | 未確認（Mulmo に確認中） | — |
| `data/portfolio-snapshot.json` | 読んでいるか（#711 以降どこからも書かれていない凍結ファイル） | 未確認（Mulmo に確認中） | refactor 計画 §6.6 |
| `data/positions.json` | 読んでいるか（同上・凍結ファイル） | 未確認（Mulmo に確認中） | refactor 計画 §6.6 |
| 上記以外の `data/**`・raw URL | 読んでいるものがあるか | 未確認（Mulmo に確認中） | — |

## 3. Mulmo・Actions・Mac が呼ぶ Worker API

Worker は `https://portfolio-proxy.shoulang.workers.dev`。ブラウザ以外の呼び出しも `Origin: https://shoulang0729.github.io` を付ける（`data/scheduler/lib/worker-client.mjs`）。Origin が付いていて許可外なら 403、Origin 無しは通る。レート制限は `/yahoo`・`/finnhub`・`/fmp`・`/edgar`・`/edinet-db`・`/etf/constituents`・`/forex`・`/order-sheet*` に IP 単位で掛かる（429・`worker/src/rate-limit.md`）。API キーは Worker の Secrets（`FINNHUB_API_KEY`・`FMP_API_KEY`・`EDINET_DB_API_KEY`・`SEC_USER_AGENT`）が付け、呼び出し側は持たない。

| ルート | メソッド | 認証 | リクエスト／レスポンスの形（概要） | 呼び出し元 |
|---|---|---|---|---|
| `/yahoo?url=<encoded>` | GET | なし（Origin） | `url` は `https://query1|query2.finance.yahoo.com` のみ（他は 400）。Yahoo の応答をそのまま中継 | Mulmo（asis §2.1 の `curl`・確認済み。今どの処理で呼ぶかは未確認（Mulmo に確認中））／Actions: `watchlist-per`・`fund-per`・`etf-pe`・`target-gap`・`jp-sector-median`・`hit-rate`／アプリ |
| `/watchlist` | GET | なし（公開） | JSON 配列（各要素に `symbol`・`name`・`valuation` ほか） | Mulmo（`curl GET`・asis §2）／`kv-resync.mjs`（read-back を含む）／アプリ |
| `/watchlist` | PUT | なし（Origin のみ・PIN 不要） | JSON 配列のみ（オブジェクトなら 400。各要素は `symbol`・`name` 必須） | `kv-resync.mjs`（`kv-resync.yml`・`per-daily.yml`・`weekly-valuations.yml`）／アプリ |
| `/finnhub?path=<path>&…` | GET | なし（Origin） | Finnhub の応答を中継 | Actions: `sector-median`／アプリ・Cron |
| `/fmp?path=<path>&…` | GET | なし（Origin） | FMP stable API の応答を中継（不正な `path` は 400） | Actions: `quality-us` |
| `/edgar?path=<path>` | GET | なし（Origin） | SEC EDGAR（XBRL 系パスのみ）の応答を中継 | Actions: `quality-us`（フォールバック） |
| `/edinet-db?path=<path>` | GET | なし（Origin） | EDINET DB の応答を中継 | Actions: `quality-jp` |
| `/order-sheet` | GET | `X-Pin-Hash`（無し・不一致 401・PIN 未設定 428） | 注文表を計算して返す（KV に書かない・`Cache-Control: no-store`） | アプリ Order タブ／対話中の Claude／Mulmo（発議前に読む・#676 の提案。運用開始済みかは未確認（Mulmo に確認中）） |
| `/order-sheet/plan` | GET・PUT | `X-Pin-Hash` | GET＝`order:plan` を返す。PUT＝丸ごと置換（`validatePlan` を通る形・`rev` 一致が必要・不一致 409＋現在の `rev`。KV 未投入時の初回のみ `rev` 不要）。応答 `{ ok, rev, updatedAt }` | `scripts/order-plan.mjs`（`get`/`put`・環境変数 `MF_PIN_HASH`・`WORKER_URL`）／対話中の Claude |
| `/order-sheet/events` | POST | `X-Pin-Hash` | オブジェクト `{ rev, type, … }`（`rev` 整数必須・不一致 409。`type` は `placed`・`filled`・`cancelled`・`unplace`・`rebase`・`review`）。状態を変えて `order:log` に追記 | アプリ Order タブ（申告）／対話中の Claude／Mulmo（`rebase`・`review`・#676 の提案） |
| `/networth` | PUT（GET も有り） | `X-Pin-Hash` | 完全版の資産ドキュメント（非公開 KV `networth`） | Mac mini の MF 取込（`scripts/fetch_mf.py`・環境変数 `MF_WORKER_URL`・`MF_PIN_HASH`・失敗しても公開 commit は続ける）／アプリ |

- アプリだけが使うルート（`/forex`・`/etf/constituents`・`/positions`・`/prices/cache`・`/auth/*`）と 410 にしたルート（`/portfolio/snapshot`・`/ai/*`・`/notion/save`。古いキャッシュのアプリ向けに 404 にしない）も、パス・メソッド・応答の形・ステータスを変えない（refactor 計画 §2.1）。
- Worker の Cron（`worker/wrangler.toml`）: `0 1,8,15,22 * * *` で価格キャッシュ＋注文表の約定確定（`order:plan` を変化時のみ書く・`rev` を見て衝突時は次回へ）、`20 20,21 * * *` で `per-daily.yml` を workflow_dispatch（夏時間 20:20・冬時間 21:20 の回だけ。トークンは `GH_DISPATCH_TOKEN`、無ければ `GITHUB_TOKEN`）。

## 4. 書き手と時刻・push 禁止時間帯

### 4.1 main に書くもの

| 書き手 | 起動（UTC） | 書くもの | push の約束 | concurrency |
|---|---|---|---|---|
| `per-daily.yml` | Worker Cron の workflow_dispatch（夏 20:20・冬 21:20）＋予備 schedule `15 20 * * *` | `data/valuations.json` の `perCurrent`/`percentile`/`status`/`asOf`（＋最上位 `updated`/`asOf`）とファンドの加重 PER。コミット `data: daily PER <UTC日付>`（author `github-actions[bot]`・差分なしでも `--allow-empty`） | 米国の引け（夏 20:00・冬 21:00）前の開始は計算のみ（`force=true` なら書く）。**21:45〜22:59 開始は書かない（`force` でも）**。**21:50〜22:59 は push しない**。引け以降に当日分が main にあれば何もしない。rebase 衝突時は force せず失敗（main 側を残す）。push 後に同じジョブで `kv-resync.mjs --json` | `portfolio-data-batch` |
| `weekly-valuations.yml` | `0 2 * * 0`（日曜 02:00・write）／workflow_dispatch（既定 report＝書かない） | `data/valuations.json` の `quality`/`value`/`sectorMedian`/`staleFields`・`data/verdict-outcomes.json`。コミット `data: weekly valuations batch <日付>` | **21:00〜22:59 は push しない**。`pull --rebase`＋最大 3 回リトライ。push 後に `kv-resync.mjs --json` | `portfolio-data-batch` |
| `fund-holdings-monthly.yml` | `0 3 1-20 * *`（毎月 1〜20 日 03:00）／workflow_dispatch | `data/scheduler/fund-holdings.json`（`top`/`asOf`）。コミット `data: hifumi top10 <asOf>` | **21:00〜22:59 は push しない**。rebase＋リトライ | `portfolio-data-batch` |
| `build-dist.yml` | main への push | `dist/app.js`（変化時のみ）。コミット `build: dist/app.js を自動更新 [skip ci]` | 時間帯の制限なし | なし |
| Mac mini の MF 取込（launchd `com.toshio.mf-snapshot`） | 毎日 05:00 CST（21:00 UTC） | `data/mf-holdings.json`（公開用に除去済みの形）・`data/mf-history.json`・`data/real-assets/` の `valueHowMa`。完全版は KV `networth`（`PUT /networth`） | main で自動 commit・push。feature ブランチで `run` しない | — |
| Mulmo の日次バッチ | 21:00 開始 | §1 の行 | 1 回の commit・push を最後に。PER を最長 21:52 まで待つ。push は 22:59 まで。push 前に `pull --rebase` | — |

### 4.2 main に書かないもの（KV・Issue）

| 書き手 | 起動（UTC） | 書くもの |
|---|---|---|
| `kv-resync.yml` | `data/valuations.json` の main への push／`30 23 * * *`（自己修復）／workflow_dispatch（`sync`・`check`） | KV `watchlist` の各要素の `valuation`（比較キー `perCurrent`/`status`/`asOf`。配列形状・他フィールド・正本に無い銘柄は保持。PUT 後に read-back） |
| `mf-freshness.yml` | `40 0 * * *` | 書かない。`data/mf-holdings.json` の `asOf` が古ければ Issue（ラベル `stale-mf-holdings`） |
| 失敗通知（各ワークフロー） | 失敗時 | Issue（ラベル `per-daily-failed`・`per-daily-late`・`weekly-batch-failed`・`kv-resync-failed` ほか） |

### 4.3 時刻の並び（1 日）

| 時刻（UTC） | 何が起きるか |
|---|---|
| 20:00（夏）／21:00（冬） | 米国の引け |
| 20:15 | per-daily の予備 schedule（遅れて 23 時台に動くことがある） |
| 20:20（夏）／21:20（冬） | Worker Cron が per-daily を起動（本番） |
| 21:00 | Mac mini の MF 取込・Mulmo の日次バッチ開始。weekly・monthly の push 禁止が始まる |
| 21:45 | これ以降に始まった per-daily は書かない（〜22:59） |
| 21:50 | per-daily の push 禁止が始まる（〜22:59） |
| 21:52 | Mulmo が PER の当日コミットを待つ期限 |
| 22:59 | Mulmo の push の期限・Actions の push 禁止の終わり |
| 23:30 | kv-resync の自己修復 |

## 5. リポ外（アプリ以外）からの import

| import する側 | import される側（パス・export 名を変えない） | 方法 |
|---|---|---|
| `data/scheduler/quality-us.mjs` | `src/edgar-normalize.js`（`normalizeEdgarFacts`）・`src/quality-calc.js`（`computeQuality`） | `await import('../../src/...')` |
| `data/scheduler/quality-jp.mjs` | `src/edinet-normalize.js`（`normalizeEdinetFinancials`・`resolveEdinetCode`）・`src/quality-calc.js`（`computeQuality`） | `import ... from '../../src/...'` |
| `data/scheduler/hit-rate.mjs` | `src/verdict-outcomes.js`（`resolveOutcome`・`HORIZON_DAYS`・`DEFAULT_BENCHMARK`） | `import ... from '../../src/...'` |
| `scripts/order-plan.mjs` | `worker/src/order-plan.js`（`validatePlan`） | ソースを読んで `data:` URL で import（`worker/package.json` が commonjs のため）。`order-plan.js` は import を持たない純関数のまま保つ |

- `src/edgar-normalize.js`・`src/edinet-normalize.js` はアプリからは import されていない。未使用に見えても消さない・移さない。
- `data/scheduler/*.mjs` のファイル名・CLI 引数（`--write`・`--json`・`--check`・`--out`・`--dry-run`・`--symbol`）・出力形式も Actions と Mulmo の手順が呼ぶので変えない（refactor 計画 §2.1）。
