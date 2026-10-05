# portfolio が外部に約束していること（Mulmo・Actions・Mac との境目）

> 作成: 2026-10-05（#724・`docs/handoff/2026-10-05-refactor-before-migration.md` §7.1）。
> **用途**: リファクタ（段階5）の各 PR の「壊していないこと」の確認リスト。#713（Notion 移管・`claude -p` 化）の設計は「この表のどの行を動かすか」で書く。
> **正本の関係**: データの書き手は [CLAUDE.md](../CLAUDE.md)「データの書き手」、Worker のルートは `worker/src/index.js` 冒頭のコメント、Briefing の生成仕様は [docs/briefing-generation-spec.md](./briefing-generation-spec.md)（Mulmo の正本）、Mulmo の日次処理の現状は [docs/mulmo-data-scripts-asis.md](./mulmo-data-scripts-asis.md)、Actions の詳細は [data/scheduler/README.md](../data/scheduler/README.md)、注文表は [docs/order-sheet-ops.md](./order-sheet-ops.md)。食い違ったら正本を優先し、本書を直す。
> **公開リポ**: 本書には実額・口座名・秘密の値を書かない。Secrets・環境変数は名前だけ。
> Mulmo 側の行は #724 の Mulmo ワークスペース調査（2026-10-05） で埋めた（Mulmo ワークスペース内のパスは相対名で記す）。調査でも決められなかった点だけ「未確認」と書く。

時刻はすべて UTC。Mulmo の日次バッチは 21:00 UTC（＝05:00 CST）開始。土曜のバンド見直しは別ジョブではなく、この日次バッチの中で行う（土曜に `rebuildBands` フラグを立てて判断の段で見る。有効な週次ジョブは無い）。Mulmo の日次バッチは `watchlist-per`・`fund-per`・`kv-resync` を呼ばない（Mulmo 側から外した。KV の同期は Actions の `kv-resync.yml` に任せる）。出典は #724 の Mulmo ワークスペース調査（2026-10-05）。

## 1. Mulmo が書くもの

| 書く先 | 書く内容（キー） | タイミング | 約束（形・守ること） | 出典 |
|---|---|---|---|---|
| `data/valuations.json` | 判断の書き戻し（verdict 系）: 各銘柄の `note`・`buyProposal`・`sellProposal` と最上位の `note`（③c）。`bandLow`/`bandHigh` は土曜（`rebuildBands`）だけ書いてよい仕様（直近の差分に書いた実績は無い） | 日次バッチの最後（③c）に `data/briefings/` と同じ 1 回の commit・push。PER の当日コミットを最長 21:52 まで待ってから判断・書き戻し。push は 22:59 まで（Actions の push 禁止時間帯の内側） | インデント 1 スペース・キーと形を変えない。`perCurrent`/`percentile`/`status`/`asOf`（per-daily の担当）・`quality`/`value`/`sectorMedian`/`staleFields`（weekly の担当）は書き換えない（`staleFields` は消さない・`data/scheduler/README.md`）。push 前に `pull --rebase` | CLAUDE.md・asis §2・§5・§7・`docs/handoff/2026-10-05-per-daily-dispatch.md` §6.3・#724 の Mulmo ワークスペース調査（2026-10-05） |
| `data/valuations.json`（その他のキー） | `verdict`・`momentum`・`forwardPE` は書かない（仕様にも直近の差分にも無い）。`needsManual` は仕様上「trailingPE が取れない銘柄に付ける」とあるが、今の書き手が Mulmo か Actions かは未確認。`bandMedian`・`bandBasis`・`bandConfidence`・`bandNote` は直近の日次では書いていない（切り替え前の手動実行で `bandConfidence` を変えた実績のみ）。土曜のバンド再生成で変わるかは未確認 | — | 書かないキーは書き換えない | #724 の Mulmo ワークスペース調査（2026-10-05） |
| `data/briefings/<YYYY-MM-DD-HHMM>.html` | Briefing 本文（自己完結のモバイル HTML 1 ファイル・版 ID は CST） | 日次バッチ（③c）。毎回新規ファイル・既存号は上書きしない | 公開リポなので注文表の値・PIN ハッシュを書かない | briefing-generation-spec §0・order-sheet-ops §8 |
| `data/briefings/index.json` | `{ updated, issues: [{ date, title, path }] }`。`issues` の先頭に新版を追加（過去号を消さない） | 同上 | `date`＝`"YYYY-MM-DD HH:MM"`（固定幅・辞書順＝新しい順）・`title`＝`"Briefing YYYY/MM/DD HH:MM"`・`path`＝`"data/briefings/YYYY-MM-DD-HHMM.html"`。アプリ `src/briefing.js` がこの形を読む | briefing-generation-spec §0 |
| KV `order:plan`・`order:log`（Worker 経由のみ） | `POST /order-sheet/events` の `rebase`・`review` | イベント後の Briefing 生成で必要なとき | rev 楽観ロック（409 は取り直してから送り直す）。PIN ハッシュ・注文表の値をログ・Briefing・コミットに出さない。**Mulmo 側では未開始**（日次バッチ・スキル・スクリプトからの呼び出しは 0 件。#676 の提案のまま） | order-sheet-ops §8・#724 の Mulmo ワークスペース調査（2026-10-05） |

## 2. Mulmo が読むもの

| 読むもの | 読み方・目的 | 状態 | 出典 |
|---|---|---|---|
| `data/valuations.json` | PER ゲートで `git pull` した後に読む。判断（③b）の入力。③c で書き戻す（§1）。`asOf` が当日でなければ前日値で続行 | 日次バッチ・確認済み | asis §2・§7・#724 の Mulmo ワークスペース調査（2026-10-05） |
| main のコミット `data: daily PER <UTC日付>`（author `github-actions[bot]`） | PER ゲートが `git log origin/main --author=github-actions --grep="data: daily PER <D>"` で当日の PER が書かれたかを判定。最長 21:52 まで待ち、無ければ前日値で続行（`valuations.json` の `asOf`/`updated` は判定に使わない） | 日次バッチ・確認済み | data/scheduler/README.md・per-daily-dispatch §6.4・#724 の Mulmo ワークスペース調査（2026-10-05） |
| `data/mf-holdings.json` | 収集の段で保有を読む | 日次バッチ・確認済み（対話のセカンドオピニオンでも読む） | #724 の Mulmo ワークスペース調査（2026-10-05） |
| `data/target-allocation.json` | 収集の段で読む。使うキーは `denominator`・`themeCaps`・`themeEtfs`・`aiTech`・`stress`・`orderSheet`・`conviction` | 日次バッチ・確認済み | order-sheet-ops §8・#724 の Mulmo ワークスペース調査（2026-10-05） |
| `data/triggers.json` | 収集の段で `triggers` を読む | 日次バッチ・確認済み | #724 の Mulmo ワークスペース調査（2026-10-05） |
| `data/briefings/index.json`・`data/briefings/<前号>.html` | 組版の段と QA が読む（先頭に新版を追加・前号との比較） | 日次バッチ・確認済み | briefing-generation-spec §0・#724 の Mulmo ワークスペース調査（2026-10-05） |
| `data/mf-history.json` | 資産推移の sync（③.5）が読む | 日次バッチ・確認済み | #724 の Mulmo ワークスペース調査（2026-10-05） |
| `docs/briefing-generation-spec.md`・`docs/handoff/assets/2026-06-25-briefing-layout-reference.html` | 組版の段が読む（生成仕様とレイアウトの見本） | 日次バッチ・確認済み | 同ファイル冒頭・#724 の Mulmo ワークスペース調査（2026-10-05） |
| `data/positions.json` | 日次バッチでは読まない。対話のセカンドオピニオン用スキルが「個別の PF 実値」として読む | 対話のみ・確認済み | refactor 計画 §6.6・#724 の Mulmo ワークスペース調査（2026-10-05） |
| `data/mf-import-config.json`・`data/sector-medians.json` | 対話の手順書に記載があるだけ（日次バッチでは読まない） | 対話のみ・確認済み | #724 の Mulmo ワークスペース調査（2026-10-05） |
| `data/portfolio-snapshot.json` | 読まない（手順書に「直接手編集しない」の注記があるだけ） | 読まない・確認済み | refactor 計画 §6.6・#724 の Mulmo ワークスペース調査（2026-10-05） |
| `data/verdict-outcomes.json` | 読まない（ワークスペースのどこにも出てこない） | 読まない・確認済み | #724 の Mulmo ワークスペース調査（2026-10-05） |
| `data/scheduler/fund-holdings.json` | 読まない（手順書の経緯に名前が出てくるだけ） | 読まない・確認済み | #724 の Mulmo ワークスペース調査（2026-10-05） |
| raw URL | 読まない（`data/**` はすべて Mulmo 側の clone からのローカル読み。raw URL は 0 件） | 確認済み | #724 の Mulmo ワークスペース調査（2026-10-05） |

- **`data/positions.json` を消すには、先に Mulmo がセカンドオピニオン用スキルの参照先を変える必要がある**（Mulmo 側の作業）。#711 以降どこからも書かれていない凍結ファイルで、扱いは refactor 計画 §6.6（Q7）。

## 3. Mulmo・Actions・Mac が呼ぶ Worker API

Worker は `https://portfolio-proxy.shoulang.workers.dev`。ブラウザ以外の呼び出しも `Origin: https://shoulang0729.github.io` を付ける（`data/scheduler/lib/worker-client.mjs`）。Origin が付いていて許可外なら 403、Origin 無しは通る。レート制限は `/yahoo`・`/finnhub`・`/fmp`・`/edgar`・`/edinet-db`・`/etf/constituents`・`/forex`・`/order-sheet*` に IP 単位で掛かる（429・`worker/src/rate-limit.md`）。API キーは Worker の Secrets（`FINNHUB_API_KEY`・`FMP_API_KEY`・`EDINET_DB_API_KEY`・`SEC_USER_AGENT`）が付け、呼び出し側は持たない。

| ルート | メソッド | 認証 | リクエスト／レスポンスの形（概要） | 呼び出し元 |
|---|---|---|---|---|
| `/yahoo?url=<encoded>` | GET | なし（Origin） | `url` は `https://query1|query2.finance.yahoo.com` のみ（他は 400）。Yahoo の応答をそのまま中継 | Mulmo（日次バッチの `market-snapshot.mjs` がマクロ表のハンセン `^HSI` と TOPIX 代理 `1308.T` の 1 年分の終値を取る。Origin 付き・#724 の Mulmo ワークスペース調査（2026-10-05））／Actions: `watchlist-per`・`fund-per`・`etf-pe`・`target-gap`・`jp-sector-median`・`hit-rate`／アプリ |
| `/watchlist` | GET | なし（公開） | JSON 配列（各要素に `symbol`・`name`・`valuation` ほか） | Mulmo（日次バッチの PER ゲートの後に 1 回。PER ゲートの結果が無いときは収集の段が自前で `curl` するフォールバックあり・#724 の Mulmo ワークスペース調査（2026-10-05））／`kv-resync.mjs`（read-back を含む）／アプリ |
| `/watchlist` | PUT | なし（Origin のみ・PIN 不要） | JSON 配列のみ（オブジェクトなら 400。各要素は `symbol`・`name` 必須） | `kv-resync.mjs`（`kv-resync.yml`・`per-daily.yml`・`weekly-valuations.yml`）／アプリ。Mulmo は呼ばない（2026-10-03〜・#724 の Mulmo ワークスペース調査（2026-10-05）） |
| `/finnhub?path=<path>&…` | GET | なし（Origin） | Finnhub の応答を中継 | Actions: `sector-median`／アプリ・Cron |
| `/fmp?path=<path>&…` | GET | なし（Origin） | FMP stable API の応答を中継（不正な `path` は 400） | Actions: `quality-us` |
| `/edgar?path=<path>` | GET | なし（Origin） | SEC EDGAR（XBRL 系パスのみ）の応答を中継 | Actions: `quality-us`（フォールバック） |
| `/edinet-db?path=<path>` | GET | なし（Origin） | EDINET DB の応答を中継 | Actions: `quality-jp` |
| `/order-sheet` | GET | `X-Pin-Hash`（無し・不一致 401・PIN 未設定 428） | 注文表を計算して返す（KV に書かない・`Cache-Control: no-store`） | アプリ Order タブ／対話中の Claude／Mulmo は呼ばない（#676 の提案のまま未開始・#724 の Mulmo ワークスペース調査（2026-10-05）） |
| `/order-sheet/plan` | GET・PUT | `X-Pin-Hash` | GET＝`order:plan` を返す。PUT＝丸ごと置換（`validatePlan` を通る形・`rev` 一致が必要・不一致 409＋現在の `rev`。KV 未投入時の初回のみ `rev` 不要）。応答 `{ ok, rev, updatedAt }` | `scripts/order-plan.mjs`（`get`/`put`・環境変数 `MF_PIN_HASH`・`WORKER_URL`）／対話中の Claude |
| `/order-sheet/events` | POST | `X-Pin-Hash` | オブジェクト `{ rev, type, … }`（`rev` 整数必須・不一致 409。`type` は `placed`・`filled`・`cancelled`・`unplace`・`rebase`・`review`）。状態を変えて `order:log` に追記 | アプリ Order タブ（申告）／対話中の Claude／Mulmo は呼ばない（`rebase`・`review` は #676 の提案のまま未開始・#724 の Mulmo ワークスペース調査（2026-10-05）） |
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
| Mulmo の日次バッチ | 21:00 開始（土曜のバンド見直しも同じバッチ内） | §1 の行（`data/briefings/<版ID>.html`・`data/briefings/index.json`・`data/valuations.json` の verdict 系）。コミット `data: briefing <版ID>` | 1 回の commit・push を最後に。PER を最長 21:52 まで待つ。push は 22:59 まで。push 前に `pull --rebase` | — |

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
