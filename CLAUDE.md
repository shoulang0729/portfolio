# Portfolio Heatmap — Claude Code 引き継ぎ情報

> **開発フロー（必読）**: このリポは Claude Code が 設計（architect）→ 実装（implementer）→ レビュー（reviewer）で開発します。着手前に本ファイル「開発フロー（Claude Code・2026-10-03〜）」節を読んでください。

## 開発フロー（Claude Code・2026-10-03〜）

このリポは **Claude Code が 設計 → 実装 → レビュー を役割の違うサブエージェントで回す**（`.claude/agents/`）。`/feature "<お題>"` で一括実行できる（`.claude/commands/feature.md`）。設計と実装の分離は役割で保つ（2026-07 の公開リポ露出の再発防止策の継続）。

1. **設計（architect）**: 要件を `docs/handoff/YYYY-MM-DD-<slug>.md` に書き、Issue を起票する。アプリのコードは書かない。
2. **実装（implementer）**: Issue と設計書のとおりに 1タスク=1ブランチ=1PR で実装する。設計書は変えない。PR に `Closes #<Issue>`。
3. **レビュー（reviewer）**: 品質ゲート＋差分精査＋公開リポ検査。問題なければ squash マージ。下記「マージ前の確認」の対象はマージせず `needs-toshio` を付けて止める。

### サイズ判定
着手前に PM（親セッション）が判定する。**S**＝見た目のみの小変更で、次のどれにも触れないもの：計算・状態（`state`）・data-action・ソート・データファイル（`data/**`）・KV・Worker・認証・`getColor`/期間スケール・D3 のサイズ計算・タブ/モジュール構成。S は architect を省略し、PM が受け入れ条件つきの簡潔な Issue を書いて implementer に渡す。**迷ったら M/L**（フルパイプライン）。

### マージ前の確認（Toshio）
次に触れる PR は reviewer がマージせず、`needs-toshio` を付けて Toshio の確認を待つ。それ以外は CI green ＋ reviewer 承認で自動マージしてよい。
- **セキュリティ**: `src/auth-*.js`、`worker/**` の認証・レート制限・CORS、PIN/パスキー、Secrets
- **資産データ**: `scripts/fetch_mf*.py`、`src/networth.js`・`src/wealth.js`、`data/real-assets/**`、KV の networth/positions/order:plan・order:log、`scripts/order-plan.mjs`、公開/非公開の境界
- **データ構造**: `data/*.json` のキー・形状、`data/mf-import-config.json` の schema、KV のデータ形状
- **開発体制**: `CLAUDE.md`、`.claude/**`、`.github/workflows/**`

### データの書き手（手で編集しない）
| ファイル / KV | 書き手 |
|---|---|
| `data/mf-holdings.json`・`data/mf-history.json` | Mac mini の MF 取得バッチ（毎日） |
| `data/valuations.json`（判断の書き戻し）・`data/briefings/**` | Mulmo の日次バッチ（毎朝 05:00 CST。PER の当日コミット（引け以降・bot）を最長 21:52 UTC まで待ってから判断・書き戻し） |
| `data/valuations.json` の `perCurrent`/`percentile`/`status`/`asOf` とファンドの加重 PER | GitHub Actions `per-daily.yml`（Worker Cron が米国の夏時間は 20:20 UTC・冬時間は 21:20 UTC に workflow_dispatch で起動・予備 schedule 20:15 UTC・引け以降に当日分があれば何もしない・21:45〜22:59 UTC 開始は書かない・21:50〜22:59 UTC は push しない・コミット `data: daily PER <UTC日付>`） |
| `data/valuations.json` の `quality`/`value`/`sectorMedian`/`staleFields`・`data/verdict-outcomes.json` | GitHub Actions `weekly-valuations.yml`（毎週日曜 02:00 UTC） |
| `data/scheduler/fund-holdings.json` | GitHub Actions `fund-holdings-monthly.yml`（月次・毎月 1〜20 日 03:00 UTC） |
| `data/positions.json`・`data/portfolio-snapshot.json` | 書き手なし（#711 で Worker の書き込みを停止・凍結）。扱いは `docs/handoff/2026-10-05-refactor-before-migration.md` §6.6 |
| KV `watchlist` | アプリ（`PUT /watchlist`）と GitHub Actions `kv-resync.yml`（`data/scheduler/kv-resync.mjs`・`data/valuations.json` の push 時と毎日 23:30 UTC。`per-daily.yml` も同じジョブで実行） |
| KV `positions`・`networth`（非公開） | アプリ（PIN 必須の `PUT /positions`・`PUT /networth`） |
| KV `order:plan`・`order:log`（注文表の設定＋状態・操作ログ。非公開・PIN 保護） | Worker のみ：`PUT /order-sheet/plan`（初回投入・編集＝`scripts/order-plan.mjs`）／`POST /order-sheet/events`（アプリの Order タブの申告・対話中の Claude・Mulmo）／Cron（mf の株数で約定を確定・変化時のみ）。`wrangler kv` で直接書かない（復旧時の削除のみ・手順は `docs/order-sheet-ops.md`）。KV なので main へのコミットは無い |

- ファイルの行は自動で main に直接コミットされる。形状を変える場合は「データ構造」扱い（Toshio 確認）とし、書き手側の対応を設計書に明記する。
- push 前の `git pull --rebase origin main` でこれらと衝突したら、**main 側を採用**する。
- **Briefing**：生成（`data/briefings/**` と `docs/briefing-generation-spec.md`）は Mulmo の担当。アプリの Briefing タブ（表示側）は Claude Code の担当。生成仕様の変更は Issue で提案する。

### クラウドから実行できないもの
- **Worker のデプロイ**：`worker/**` を含む PR がマージされたら、Toshio が Mac で `cd worker && npx wrangler deploy` ＋ curl 検証を行う（reviewer が報告する）。
- **Mac 実機の確認**：`scripts/fetch_mf*.py` など MF へのログインが要る処理は Claude Code では動作確認できない。原則は **マージ直後に即時確認**：
  1. CI green ＋ reviewer 承認でマージし、PM が Toshio に起動を依頼する。
  2. Toshio が Mac mini で `launchctl kickstart -k gui/$(id -u)/com.toshio.mf-snapshot`（毎朝のバッチと同じ条件で即時実行）。
  3. PM がクラウドから main の `data: refresh MF holdings snapshot` コミット・公開ファイルの形と変更点・非公開項目の漏れなしを確認して報告する。
  4. Toshio が MF 画面との数値の突き合わせ（必要なら KV）だけを目視する（数値はどこにも貼らない）。
  5. 問題があれば PM が即 revert する。
  - **例外（マージ前に Mac で確認）**：ログイン・取得処理、公開用の除去処理（`sanitize_for_public()`）、自動 commit/push 処理そのものを変える PR。PR に「Mac 実機確認要」と書く。
  - `fetch_mf.py run` は main 上での自動 commit/push を前提とするため、feature ブランチで実行しない。

### Mac セッション（クラウドから Mac mini を動かす・2026-10-04〜）
Mac mini で `claude remote-control`（環境 `shoulang-Mac-mini:portfolio`・作業ディレクトリ `~/GitHub/portfolio`）が動いている。PM（クラウドの親セッション）は Claude_Code_Remote の `create_session` でこの環境に指示を出し、上記の「Toshio が Mac で行う」作業を代行させてよい（Toshio がその都度依頼・了解したもの）。
- **任せてよい作業**：Worker のデプロイ（`npx wrangler deploy`）と curl 検証・問題時の `npx wrangler rollback`、MF 取込の即時実行（`launchctl kickstart -k gui/$(id -u)/com.toshio.mf-snapshot`）と結果確認、別の作業ツリーでの `fetch_mf.py run --dry-run`、ログ（`~/.mf-snapshot/*.log`）の確認、`git pull --ff-only`。
- **禁止**：`sudo`、リポのファイル編集・commit・push（取込バッチ自身の自動 commit は除く）、wrangler の secret / kv 操作、Secrets・PIN・ハッシュ・`.env`・Cookie の表示、feature ブランチでの `fetch_mf.py run`。
- **prompt は自己完結で書く**（Mac 側はクラウドの文脈を知らない）：目的・コマンド・合否の基準・失敗時の戻し方・結果のコメント先（Issue/PR）・権限（してよいこと/禁止）を明記する。
- **結果は GitHub で受け取る**：Mac 側に `gh` で Issue/PR へコメントさせる。内容は件数・成否・HTTP ステータス・エラーの種類だけ（金額・口座名・秘密は書かない）。状態は `get_session` で見る。
- **長い作業は分ける**：1つの結果を確かめてから次の `create_session` を出す。Mac 側で権限確認に止まったら、PM が勝手に権限を足さず Toshio に報告する。

### 公開リポの原則
このリポは PUBLIC。個人の資産データ（物件・評価額・負債・ネットワース実額・口座情報）と秘密（APIキー・トークン・PIN/ハッシュ値）をコミットしない。テストデータは合成値にする。reviewer は差分ごとに検査する。

### git / gh
- ベースは必ず `main`。push 前に `git pull --rebase origin main`。マージは squash＋ブランチ削除。
- **gh CLI が無い環境（クラウドセッション等）**：Issue/PR/マージは PM（親）が GitHub MCP で代行する。サブエージェントは本文をドラフトファイルで渡し、git は commit まで（push は親）。
- main 直コミットは docs と設計書の「実装ログ」更新のみ。アプリ実装は必ず PR。
- PR に `dist/app.js` を含めない（main への push で `build-dist.yml` が自動ビルド・コミットする）。

## プロジェクト概要
個人のポートフォリオを可視化する Web アプリ（GitHub Pages・PWA）。
- **本番 URL**: https://shoulang0729.github.io/portfolio/ ／ **GitHub**: https://github.com/shoulang0729/portfolio
- **タブ**: Heatmap ／ Historical（期間ヒートマップ・保有＋ウォッチを統合・セグメントピル[全部/保有/ウォッチ]・#452）／ Valuation ／ Risk ／ Wealth ／ Briefing ／ Order（PIN ログイン後）
- **データの流れ**: 保有は Mac mini の MF 取込 → `data/mf-*.json`。バリュエーションは Mulmo と Actions → `data/valuations.json`、Briefing は Mulmo → `data/briefings/`。価格は Worker 中継で Finnhub（優先）→ Yahoo Finance（フォールバック）。
- **バージョン**: `index.html` の `?v=YYYYMMDDX` を見る（CLAUDE.md には数字を書かない）。

## 構成
| 層 | 中身 |
|---|---|
| 配信 | `index.html` ＋ `src/app.js`（入口）→ esbuild → `dist/app.js`（ESM 1 本・D3 は CDN）。main への push で `build-dist.yml` が自動コミットし、Pages が main のルートから配信。`sw.js` は PWA のオフラインキャッシュ |
| `src/` 認証 | `auth-*`（PIN・暗号化・パスキー・UI） |
| `src/` データ取得 | `data*`（Finnhub/Yahoo/プロファイル等）・`forex`・`cache`・`historical-cache`・`idb`・`holdings-from-mf` |
| `src/` タブ別の描画 | `heatmap`・`stock-list`（＋`watchlist`）・`valuation-tab`・`risk-*`・`wealth`・`briefing`・`order-sheet*` |
| `src/` 計算 | `*-calc`・`reverse-dcf` など |
| `src/` 共通 | `utils`・`fmt`・`color`・`table`・`state`・`config`・`positions`（`PERIODS`） |
| `assets/` | CSS（`01-base.css` に CSS 変数）・アイコン・`manifest.json` |
| `worker/src/` | Cloudflare Worker（下記「Worker」） |
| `scripts/` | Mac mini の MF 取込（`fetch_mf*.py`・launchd plist）・注文表の投入 `order-plan.mjs` |
| `data/scheduler/` | Actions の日次・週次・月次のスクリプト（`README.md`） |
| `.github/workflows/` | CI（`test.yml`・`e2e.yml`）・`build-dist.yml`・データ（`per-daily.yml`・`weekly-valuations.yml`・`fund-holdings-monthly.yml`・`kv-resync.yml`）・監視（`mf-freshness.yml`） |
| `tests/`・`e2e/` | vitest・Playwright |
| `docs/` | 正本の仕様・運用手順。`docs/handoff/` は設計書（記録） |

ファイル単位の一覧は置かない（古くなる）。

## Worker
- **ルートの正本は `worker/src/index.js` 冒頭のコメント**（ここには要約だけ）。
  - 市場データ中継: `/yahoo`・`/finnhub`・`/fmp`・`/edgar`・`/edinet-db`・`/forex`・`/etf/constituents`
  - KV データ: `/watchlist`（GET は公開）・`/positions`・`/networth`（PIN 必須）・`/prices/cache`
  - 注文表: `/order-sheet`・`/order-sheet/plan`・`/order-sheet/events`（PIN 必須・rev 楽観ロック）
  - 認証: `/auth/pin-hash`・`/auth/challenge`・`/auth/register`・`/auth/verify`
  - 410 済み（古いキャッシュのアプリ向けに 404 ではなく 410 を返す）: `/portfolio/snapshot`・`/ai/*`・`/notion/save`

| Cron（`worker/wrangler.toml`） | 内容 |
|---|---|
| `0 1,8,15,22 * * *` | 全保有銘柄の価格を KV にキャッシュ＋注文表の約定（mf の株数の増減）を `order:plan` に確定（変化時のみ書く） |
| `20 20,21 * * *` | `per-daily.yml` を workflow_dispatch で起動（米国の夏時間は 20:20、冬時間は 21:20 UTC の回だけ） |

- **参照中の Secrets・vars（名前のみ）**: `FINNHUB_API_KEY`・`FMP_API_KEY`・`EDINET_DB_API_KEY`・`SEC_USER_AGENT`・`GH_DISPATCH_TOKEN`（無ければ `GITHUB_TOKEN`）・`ALLOWED_ORIGIN`（vars）。binding は `KV`・`RATE_LIMITER`。参照されなくなった Secrets・vars も削除せず残している（削除は Toshio の判断）。
- レート制限: [worker/src/rate-limit.md](./worker/src/rate-limit.md)。注文表の運用: [docs/order-sheet-ops.md](./docs/order-sheet-ops.md)（設計は `docs/handoff/2026-10-03-order-sheet.md`。plan の実値はリポに置かない）。
- デプロイはクラウドから行わない（「クラウドから実行できないもの」）。

## 主要な設計ルール
- **data-action 委譲**: `data-action="fn"`（`fn1|fn2`）・`data-arg`・`data-event` を `src/app.js` のディスパッチャが処理する。インライン `onclick=` は使わない。
- **escapeHTML**: 外部 API の値・ユーザー入力を `innerHTML` に入れる前に必ず `escapeHTML()` を通す（または `textContent`）。
- **色は CSS 変数のみ**（ハードコード hex 禁止）。`!important` は使わない。`assets/*.css` に `prettier --write` を掛けない。
- **色の計算を変えない**: `getColor` と `src/positions.js` の期間別スケール（濃淡は業務仕様）。D3 のサイズ計算も設計書の指示なしに触らない。
- **ソート**: comparator は antisymmetric（等値で 0）。null・保有専用列の空値は dir 非依存で末尾固定。文字列は `localeCompare(..., 'ja')`。
- **期間**: `src/positions.js` の `PERIODS` が唯一の定義元（`PERIOD_COLS` 等は自動生成）。
- **`?v=` の bump**: `src/**`・`assets/**`・`index.html` を変えたら `index.html` の `?v=YYYYMMDDX` を CSS・JS・SW 登録 URL すべて同じ値に揃えて上げる（英字は同日内で a→z→A→Z）。
- 詳細: [docs/design-system.md](./docs/design-system.md)（設計規約・実装ルール）・[docs/dev-guide.md](./docs/dev-guide.md)（開発ツール・よくある作業）。

## 品質ゲート
`npm test` ／ `npm run lint` ／ `npm run check:types` ／ `npm run check:circular` ／ `npm run build`（CI の `test.yml` と同じ。`dist/app.js` のサイズも監視）。
E2E は `npm run test:e2e`（CI の `e2e.yml`）。
詳細は [docs/dev-guide.md](./docs/dev-guide.md)。

## Claude Code 自律実行ルール

**以下の操作は確認なしで自律実行してよい**（環境非依存・全端末共通）:

| 操作 | 内容 |
|------|------|
| テスト対応 | テスト失敗を修正し、対応内容を Issue にコメントする |
| PR 操作 | PR を作成する。マージは reviewer が『マージ前の確認』に従って行う |
| 依存追加 | `npm install <pkg> --save-dev` で devDependency を追加する |
| バージョン更新 | `?v=YYYYMMDDX` のバージョン文字列を更新する |
| Issue 管理 | Issue を作成・クローズする |
| CI 軽微修正 | GitHub Actions のタイムアウト・トリガー条件など軽微な修正 |
| Worker デプロイ | クラウド環境からは実行しない。マージ後に Toshio が Mac で deploy する（reviewer が報告）。Toshio の依頼があれば Mac セッションに代行させてよい |

**以下は確認してから実行（変更しない）**:
- `git push --force` / `git reset --hard` / main ブランチ削除
- Secrets・認証情報の変更
- `CLAUDE.md` / `.claude/settings.json` の変更
- GitHub Actions ワークフローの大幅な変更

## 並列作業の注意
- ベースは必ず `main`。他のエージェントのブランチをベースにしない。
- 1 Task＝1 ブランチ＝1 PR＝1 Issue。同じ Issue を複数 PR に分けるときは最後の PR だけ `Closes`、他は `Refs`。
- push 前に `git pull --rebase origin main`（コンフリクトの解消は各自）。
- `?v=` を bump する PR は並行させない（順番に）。
- サブエージェントで `gh`・`npm`・`npx` が拒否されたら、実装と commit までで止めて親に報告する。
- 背景と過去の事例は [docs/dev-guide.md](./docs/dev-guide.md)「並列作業の注意（詳細）」。
