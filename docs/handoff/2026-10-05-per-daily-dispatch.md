# Handoff: per-daily を Worker の Cron から起動する（夏時間 20:20／冬時間 21:20 UTC）（#708）

- **Issue**: #708 `per-daily の schedule が毎日約3時間遅れて起動し、Mulmo の 21:00 UTC に間に合わない`
- **難易度**: medium〜hard（Mulmo 側との時刻の取り決めを含む）
- **分担**: 設計＝architect（本 doc）／実装＝implementer／レビュー＝reviewer／デプロイ＝Mac セッション（Toshio の依頼時）／トークンの確認・準備＝Toshio／Mulmo 側の変更＝Mulmo（§6.4 の提案を Toshio が渡す）
- **区分**: 確定（2026-10-05 Toshio 決定 1〜4。§0）。§12「要 Toshio 判断」は既定で設計済み
- **Toshio 確認**: **要**（PR1・PR3＝`.github/workflows/**`、PR2＝`worker/**` の Cron と GitHub トークン・`CLAUDE.md`）
- **改訂**: 2026-10-05 初版（通年 20:20 UTC・`GH_DISPATCH_TOKEN` 新設が既定）→ 同日 第2版（本版。冬時間は 21:20 UTC・Mulmo の組み方を変える・まず既存トークンで試す）

## 実装ログ（implementer が更新）
- [ ] PR1 #710 に §3.1 の追加変更 / マージ ____ / 重複スキップの確認（§8.1）____
- [ ] PR2 #____ / マージ ____ / デプロイ（Mac セッション）____ / 初回 20:20 UTC の確認とトークン判定（§8.2）____ ／ 結果: GITHUB_TOKEN で 204・または GH_DISPATCH_TOKEN を作成 ____
- [ ] Mulmo 側の変更（§6.4）: Toshio が提案を渡した ____ / Mulmo 完了の報告 ____
- [ ] PR3 #____（Mulmo 完了の後・**2026-10-30 まで**）/ マージ ____ / 冬時間の初日（2026-11-02）の確認（§8.3）____

---

## 0. 2026-10-05 Toshio 決定（本改訂の前提）
1. Worker の Cron から per-daily を workflow_dispatch で起動する。夏時間は **20:20 UTC**。
2. 冬時間（米国標準時）は **21:20 UTC** に起動し、引け後の正確な終値で書く。そのために **Mulmo の日次バッチの時刻とジョブの組み方を調整する**（per-daily の push 禁止時間帯と衝突させない）。
3. トークンは**まず既存の Worker Secret `GITHUB_TOKEN` で試す**。有効なら新規作成しない。無効なら起動専用の fine-grained PAT `GH_DISPATCH_TOKEN` を Toshio が作る。
4. #709（Worker から公開リポへのスナップショット／positions の書き込み）は**止めたまま整理**する（別設計）。本設計では、`GITHUB_TOKEN` が有効だった場合に止まっている書き込みが再開しないことの確認方法だけ書く（§8.4）。

## 1. 背景・ゴール

### 背景
- `per-daily.yml`（cron `15 20 * * *`）の schedule 起動は 10/03 が 23:02 UTC、10/04 が 23:08 UTC（約 2h50m 遅れ）。Mulmo の日次バッチ（21:00 UTC＝05:00 CST）より後なので、Briefing は前日の PER を使っている。
- workflow_dispatch はすぐに動く（10/03 22:31 UTC の実績・所要約 1 分）。
- 米国の引けは夏時間（EDT）20:00 UTC、冬時間（EST）21:00 UTC。2026 年は **11-01（日）から冬時間**、2027-03-14（日）から夏時間。
- 今の per-daily には「当日分がもう書かれているか」の確認が無く、10/03 は手動と schedule の 2 回 `data: daily PER 2026-10-03` がコミットされた。

### 現状の時刻の関係（UTC。phase15 設計書 §2.3・§2.6・as-is `docs/mulmo-data-scripts-asis.md` §2・main の履歴）
| 時刻 | 誰が | 何を |
|---|---|---|
| 20:15（実際は 23:0x） | per-daily（schedule） | PER 計算→`valuations.json` の `perCurrent`/`percentile`/`status`/`asOf` とファンドの加重 PER を書いて push→kv-resync |
| 21:00 | Mac mini の MF 取込（launchd・05:00 CST） | `mf-holdings.json`・`mf-history.json` を push（21:00〜21:01） |
| 21:00 開始 | Mulmo 日次バッチ | git pull → market-snapshot（マクロ）→ /watchlist 取得 → ③b 判断（LLM・watchlistVerdicts）→ ③c Briefing 組版・`valuations.json` へ判断を書き戻し（`note`・`buyProposal`・`sellProposal`）→ briefing-qa → push。**push は 1 回だけ・最後**。実績は 21:32〜21:36 UTC（10/03・10/04） |
| 21:00〜22:30 | — | per-daily・weekly・monthly は push しない（Mulmo の時間帯） |
| 23:30 | kv-resync（schedule） | 自己修復 |

- per-daily の時刻判定（`data/scheduler/lib/per-daily.mjs`）: `runMode` は開始 20:55〜22:30 なら compute-only、他は write。`isPushBlocked` は 21:00〜22:30。
- Mulmo の当日分の判定（phase15 §9 ④）: `git log origin/main --author=github-actions --fixed-strings --grep="data: daily PER <D>" -1`（D＝CST 日付の前日＝per-daily 実行時の UTC 日付）。**コミットが無ければ前日値で続行**する。待ちは無い。

### 冬時間に 21:20 UTC 起動すると何が起きるか（何も変えない場合）
- 開始 21:20 は compute-only（20:55〜22:30）→ 書かない。予備の schedule が 23:0x に書く＝今と同じで、Briefing は前日値。
- 仮に push を許しても、Mulmo は 21:00 に読み始めているので判断は前日値。しかも Mulmo の push（21:3x）と per-daily の push（21:2x）が同じ `valuations.json` を近い行で書き換えるため、後から push する側の rebase が衝突しうる。
- → **per-daily の時間帯と Mulmo の組み方を一緒に変える必要がある**（§6）。

### ゴール
- 夏時間は 20:20 UTC、冬時間は 21:20 UTC に Worker の Cron が `per-daily.yml` を workflow_dispatch で起動し、**引け後の値**で当日分を書く。
- Mulmo の判断と Briefing は、その日の PER を読んでから行う（夏は今と同じ時刻、冬は最大約 50 分遅れ）。
- `valuations.json` に per-daily と Mulmo が**同時に push しない**（時間ではなく「順番」で分ける）。
- schedule（20:15 UTC）は予備として残す。当日分が書き込み済みなら何もしない。Worker からの起動が効かなかった日は Issue で気づける。
- コミットの形（`data: daily PER <UTC日付>`・author `github-actions[bot]`・`--allow-empty`）と `valuations.json` のキー・形状は**変えない**。

## 2. 対象ファイル一覧
| ファイル | 状態 | PR | 内容 |
|---|---|---|---|
| `data/scheduler/lib/us-market-time.mjs` | 新規 | PR1 | 純関数 `isUsEasternDst(date)`・`usCloseUtcHHMM(date)`・定数 `MULMO_WAIT_CUTOFF_HHMM` |
| `data/scheduler/lib/per-daily.mjs` | 変更 | PR1・PR3 | PR1: `isAlreadyWritten`・`isOnTimeStart` を引けの時刻基準に。PR3: `runMode`・`isPushBlocked` の時間帯を変更 |
| `data/scheduler/per-daily-gate.mjs` | 変更 | PR1・PR3 | PR1: `already-written` の `--since` を引けの時刻に。PR3: `mode` に `--force` |
| `tests/per-daily.test.js` | 変更 | PR1・PR3 | 前後比較の例・境界 |
| `tests/us-market-time.test.js` | 新規 | PR1（PR2 で追記） | DST 判定のテスト（PR2 で Worker 側の実装も同じ表で検査） |
| `.github/workflows/per-daily.yml` | 変更 | PR1・PR3 | PR1: #710 の内容＋文言。PR3: `mode` に force を渡す・コメントと警告文 |
| `.github/workflows/weekly-valuations.yml`・`fund-holdings-monthly.yml` | 変更 | PR3 | push 禁止時間帯 21:00〜22:30 → 21:00〜22:59 |
| `worker/src/us-dst.js` | 新規 | PR2 | `isUsEasternDst(date)`（PR1 と同じ規則・Worker 用の複製） |
| `worker/src/index.js` | 変更 | PR2 | `scheduled()` を `event.cron` で分ける。季節で片方の時刻だけ dispatch。`_dispatchPerDaily(env)` |
| `worker/wrangler.toml` | 変更 | PR2 | `crons` に `"20 20,21 * * *"` を追加 |
| `tests/worker-per-daily-dispatch.test.js` | 新規 | PR2 | scheduled ハンドラの単体テスト（fetch モック） |
| `CLAUDE.md` | 変更 | PR2・PR3 | PR2: per-daily の行・Cron・Worker Secrets。PR3: Mulmo の行（待ち）と push 禁止時間帯 |
| `docs/handoff/2026-10-03-phase15-data-migration.md` | 変更 | 本改訂（docs 直コミット） | §2.6 の注記を本版に合わせる |

## 3. 時刻の決まり（変更後・UTC）

### 3.1 用語
- **D**: 開始時刻の UTC 日付。
- **引け `close(D)`**: D が米国東部の夏時間なら 20:00、冬時間なら 21:00（`usCloseUtcHHMM`）。
- **Mulmo の待ち期限**: 21:52 UTC（Mulmo が PER の当日コミットを待つ最終時刻。§6.4）。
- **per-daily の書き込み締切 `MULMO_WAIT_CUTOFF_HHMM`**: 21:45（これより後に始まった per-daily は書かない）。push は 21:50 から禁止。→ 21:50 以降に PER が入ることは無いので、21:52 まで待った Mulmo は確実に「来る PER は全部来た」状態で判断に入れる。

### 3.2 夏時間と冬時間の流れ
| | 夏時間（〜2026-10-31・2027-03-14〜） | 冬時間（2026-11-01〜2027-03-13） |
|---|---|---|
| 米国の引け | 20:00 | 21:00 |
| Worker の起動 | 20:20 | 21:20 |
| PER の push | 20:21〜20:25 ごろ | 21:21〜21:25 ごろ |
| MF 取込（Mac mini） | 21:00（変えない） | 21:00（変えない） |
| Mulmo の開始 | 21:00（変えない） | 21:00（変えない） |
| Mulmo が PER を待つ | 待たない（もう入っている） | 約 20〜25 分（21:2x まで） |
| Mulmo の push（見込み） | 21:35 前後＝05:35 CST（今と同じ） | 22:00 前後＝06:00 CST（遅くとも 22:30＝06:30 CST） |

### 3.3 per-daily の開始時刻による分岐（前後比較）
| 開始（UTC） | 現状 | PR1 後（PR3 前） | PR3 後 |
|---|---|---|---|
| 00:00〜引けの前 | write | write | **compute-only**（引け前の値を書かない。`force=true` なら write） |
| 引け〜20:54 | write | write | write |
| 20:55〜21:44 | compute-only | compute-only | **write**（冬の 21:20 起動はここ） |
| 21:45〜22:30 | compute-only | compute-only | compute-only |
| 22:31〜22:59 | write | write | **compute-only** |
| 23:00〜23:59 | write | write | write（予備の schedule） |
| push 禁止 | 21:00〜22:30 | 21:00〜22:30 | **21:50〜22:59** |

- 「書き込み済みならスキップ」（PR1）はどの行でも先に判定する（`force=true` を除く）。
- 例（PR3 後）:
  - 2026-11-02 21:20 開始（Worker・冬）→ write。21:21 に push（禁止時間帯の前）。
  - 2026-11-02 20:16 開始（予備の schedule が定刻で動いた・冬）→ 引け前（21:00 より前）なので compute-only。21:20 の Worker 起動が書く。
  - 2026-10-05 20:20 開始（Worker・夏）→ write（今と同じ）。
  - 2026-10-05 21:47 開始（Actions の混雑）→ compute-only。予備の schedule（23:0x）が書く。
  - 2026-10-05 23:03 開始（予備の schedule）→ 当日分が引け以降にあればスキップ、無ければ write。
  - 2026-10-06 09:00 開始（人が手動・入力なし）→ 引け前なので compute-only。書きたいときは `force=true`。

## 4. 変更手順
（トークンの扱いは §7。）

### 4.1 PR1（#710）への追加変更（`data/scheduler/**`・`tests/**`・`.github/workflows/per-daily.yml`）
PR #710 は「20:00 UTC 以降」「定刻＝20:00〜20:54」の固定値で書かれている。冬時間に 21:20 起動にするため、次を**PR #710 に追加**する（PR #710 の他の内容はそのまま）。

#### (a) 新規 `data/scheduler/lib/us-market-time.mjs`
```js
/** 米国東部が夏時間か（UTC の暦日で判定。3 月第 2 日曜〜11 月第 1 日曜の前日まで true）。 */
export function isUsEasternDst(date)          // Date → boolean
/** その UTC 日付の米国の引けの時刻（HHMM 整数）。夏時間 2000・冬時間 2100。 */
export function usCloseUtcHHMM(date)          // Date → 2000 | 2100
/** per-daily が書いてよい開始時刻の上限（これ以上は Mulmo の時間帯）。 */
export const MULMO_WAIT_CUTOFF_HHMM = 2145;
```
- 規則（2007 年以降の米国の規則）: 夏時間は 3 月第 2 日曜 07:00 UTC 〜 11 月第 1 日曜 06:00 UTC。Cron は 20:20／21:20 UTC なので**暦日だけで判定してよい**（切替は日曜の朝に済んでいる）。`Intl` には依存しない（純関数・テストしやすい）。
- テストの表（`tests/us-market-time.test.js`）:

| UTC 日付 | `isUsEasternDst` | `usCloseUtcHHMM` |
|---|---|---|
| 2026-03-07 | false | 2100 |
| 2026-03-08（第 2 日曜） | true | 2000 |
| 2026-10-30（金） | true | 2000 |
| 2026-10-31 | true | 2000 |
| 2026-11-01（第 1 日曜） | false | 2100 |
| 2026-11-02（月） | false | 2100 |
| 2027-03-13 | false | 2100 |
| 2027-03-14（第 2 日曜） | true | 2000 |
| 2027-11-06 | true | 2000 |
| 2027-11-07（第 1 日曜） | false | 2100 |
- 加えて、2026-01-01〜2035-12-31 の毎日 21:20 UTC について、`Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' })` が `GMT-4` を返すことと `isUsEasternDst` が一致することを確かめる（Node 20 は full ICU）。

#### (b) `lib/per-daily.mjs`
- `isAlreadyWritten(commits, now)`: 下限を **`D T20:00:00Z` 固定から `close(D)`** に変える（夏 20:00・冬 21:00）。他の条件（bot・件名完全一致・`<= now`）は変えない。
- `isOnTimeStart(start)`: **`close(D) <= 開始 < 21:45`**（`MULMO_WAIT_CUTOFF_HHMM`）に変える。夏は 20:00〜21:44、冬は 21:00〜21:44。PR3 前は 20:55〜21:44 の開始は compute-only で write にならないので、PR3 前後どちらでも意味が通る。
- 前後比較（#710 の表への追加）:

| now | main の当日コミット | #710 のまま | 追加変更後 |
|---|---|---|---|
| 2026-11-02 21:20（冬・Worker） | bot・`…2026-11-02`・20:16（予備の schedule が定刻で動き、引け前の値を書いた） | **スキップ**（引け前の値のまま Mulmo へ） | 書く（21:00 より前は数えない） |
| 2026-11-02 23:03（冬・予備） | bot・`…2026-11-02`・21:21 | スキップ | スキップ |
| 2026-10-05 23:03（夏・予備） | bot・`…2026-10-05`・20:21 | スキップ | スキップ（夏は今と同じ） |

| 開始 | #710 の `isOnTimeStart` | 追加変更後 |
|---|---|---|
| 2026-10-05 20:20（夏） | true | true |
| 2026-10-05 20:55（夏） | false | true（PR3 前は compute-only なので使われない） |
| 2026-11-02 21:20（冬） | false | **true** |
| 2026-11-02 20:30（冬） | true | **false**（引け前） |
| 2026-11-02 21:45 | false | false |

#### (c) `per-daily-gate.mjs`
- `already-written`: `git log` の `--since` を `D T<close(D)>Z`（`20:00:00Z` か `21:00:00Z`）にする。出力（`written`/`not-yet`）と exit コード（6/0）は変えない。
- `on-time`: 判定を (b) の新しい `isOnTimeStart` に（exit 0/7 は変えない）。

#### (d) `per-daily.yml`（#710 の文言だけ）
- 「20:00 UTC 以降」→「米国の引け（夏 20:00・冬 21:00 UTC）以降」。「定刻（20:00〜20:54 UTC）」→「定刻（引け〜21:44 UTC）」。
- `per-daily-late` のタイトル: `⚠ 当日の PER が Mulmo に間に合いませんでした（予備の schedule が書き込み）`。本文の「20:20 UTC の Worker 起動」→「Worker 起動（夏 20:20・冬 21:20 UTC）」。
- 先頭コメント: 「本番は Worker Cron の workflow_dispatch（夏 20:20・冬 21:20 UTC）、schedule 20:15 は予備」。
- schedule の cron（`15 20 * * *`）は**変えない**（予備。§5）。

#### (e) テスト
- #710 の既存テストのうち「20:00 固定」「20:00〜20:54」を前提にしたものを (b) の表に合わせて直す。夏の日付の例はそのまま通るはず。冬の日付（2026-11-02 など）の例を足す。

### 4.2 PR2: Worker の Cron から dispatch する（`worker/**`・`CLAUDE.md`）

#### (a) `worker/wrangler.toml`
```toml
# 0 1,8,15,22: 価格キャッシュ・注文表の約定・スナップショット（JST 10:00/17:00/0:00/7:00）
# 20 20,21: per-daily.yml の起動（workflow_dispatch・#708）。米国の夏時間は 20:20、冬時間は 21:20 だけ起動（Worker 内で判定）
[triggers]
crons = ["0 1,8,15,22 * * *", "20 20,21 * * *"]
```
- 1 本の式に 2 つの時刻を書く（Cron の本数は 2。式を 2 本に分けると 3 本になる）。無料プランの Cron の上限（アカウント全体で 5 本）に当たるとデプロイが失敗するので、デプロイの出力で確かめる（§8.2）。

#### (b) `worker/src/us-dst.js`（新規）
- `export function isUsEasternDst(date)`。PR1 の `data/scheduler/lib/us-market-time.mjs` と**同じ規則の複製**（Worker のバンドルを `data/scheduler` に依存させない）。
- `tests/us-market-time.test.js` に「Worker 側の実装も同じ表・同じ 10 年分の日付で一致する」テストを足す。

#### (c) `worker/src/index.js`
- 定数: `const PER_DAILY_CRON = '20 20,21 * * *';`・`const PER_DAILY_DISPATCH_URL = 'https://api.github.com/repos/shoulang0729/portfolio/actions/workflows/per-daily.yml/dispatches';`（env から受け取らない）。
- `scheduled(event, env, ctx)` の**先頭**（`_cronConfirmOrderFills` より前）:
  ```js
  if (event?.cron === PER_DAILY_CRON) {
    const t = new Date(event.scheduledTime ?? Date.now());
    const want = isUsEasternDst(t) ? 20 : 21;
    if (t.getUTCHours() !== want) { console.log('[cron per-daily] skip (season)', t.getUTCHours()); return; }
    await _dispatchPerDaily(env);
    return;
  }
  ```
  - この Cron では、注文表の約定・価格キャッシュ・スナップショットを**動かさない**。
  - `event.cron` が無い場合と既存の式の場合は、今と同じ処理（既存テストの `scheduled({}, …)` はそのまま通る）。
- `async function _dispatchPerDaily(env)`:
  1. **トークン**: `const token = env.GH_DISPATCH_TOKEN || env.GITHUB_TOKEN;`・`const tokenName = env.GH_DISPATCH_TOKEN ? 'GH_DISPATCH_TOKEN' : 'GITHUB_TOKEN';`（決定 3。`GH_DISPATCH_TOKEN` があればそちらを優先）。どちらも無ければ `console.error('[cron per-daily] no token')` を出して `throw new Error('per-daily dispatch: no token')`。
  2. `POST PER_DAILY_DISPATCH_URL`。ヘッダは `Authorization: Bearer <token>`・`Accept: application/vnd.github+json`・`X-GitHub-Api-Version: 2022-11-28`・`User-Agent: portfolio-proxy-worker`・`Content-Type: application/json`。本文は `{"ref":"main"}`（inputs は送らない）。
  3. 成功は **HTTP 204**。`console.log('[cron per-daily] dispatched 204 token=' + tokenName)`。**ログに出すのはトークンの名前だけ**。
  4. 再試行は最大 3 回（初回を含む）。対象はネットワークエラー・タイムアウト（1 回 15 秒・`AbortController`）・429・5xx、間隔 2 秒→4 秒。**401/403/404/422 は再試行しない**。
  5. 最終的に失敗したら `console.error('[cron per-daily] dispatch failed', status, 'token=' + tokenName, msg)` を出して `throw new Error('per-daily dispatch failed: HTTP <status>')`。`msg` は応答 JSON の `message` を最大 200 文字。
  6. ログに出さないもの: トークンの値・リクエストヘッダ・応答ヘッダ。
- 起動用の HTTP ルートは作らない。Worker 側では「当日分がコミット済みか」を確かめない（冪等性は per-daily 側にまとめる）。
- 既存の `_pushSnapshotToGithub`・`_syncPositionsToGithub`・`handlePortfolioSnapshot`・`handlePositions` は**変えない**（#709 の範囲）。

#### (d) `tests/worker-per-daily-dispatch.test.js`（新規・vitest）
- `vi.stubGlobal('fetch', fetchMock)`。`worker.scheduled({ cron: '20 20,21 * * *', scheduledTime: <ms> }, env, { waitUntil() {} })` を直接呼ぶ。待ち時間は fake timers か sleep の差し込み（実装に任せる）。
- ケース:
  1. 季節の選択（`it.each`）: 2026-10-05T20:20Z→dispatch／2026-10-05T21:20Z→fetch なし／2026-11-02T21:20Z→dispatch／2026-11-02T20:20Z→fetch なし／2027-03-13T21:20Z→dispatch／2027-03-14T20:20Z→dispatch。
  2. 204 → fetch 1 回。URL・`POST`・本文 `{"ref":"main"}`・`Authorization: Bearer <合成値>`・`X-GitHub-Api-Version` を確認。KV の get/put と finnhub への fetch は無い。
  3. トークンの選択: `GH_DISPATCH_TOKEN` と `GITHUB_TOKEN` の両方ある→前者を使う。`GITHUB_TOKEN` だけ→それを使う。ログに `token=GITHUB_TOKEN` の名前が出る。
  4. 503→503→204 で成功（fetch 3 回）。500×3 で reject。403 は 1 回で reject（401・404・422 も同じ）。fetch の throw は再試行の対象。
  5. トークンが両方無い → fetch せず reject。
  6. ログにトークンの値（合成値の文字列）が含まれない。
  7. `scheduled({ cron: '0 1,8,15,22 * * *' })` と `scheduled({})` では dispatch の URL への fetch が無い。
- トークンは `'test-token-not-real'` のような合成値。

#### (e) `CLAUDE.md`（開発体制＝Toshio 確認）
- データの書き手の表、per-daily の行: 「GitHub Actions `per-daily.yml`（Worker Cron が米国の夏時間は 20:20 UTC・冬時間は 21:20 UTC に workflow_dispatch で起動・予備 schedule 20:15 UTC・引け以降に当日分があれば何もしない・コミット `data: daily PER <UTC日付>`）」。
- 「**Cron**」の行: `0 1,8,15,22 * * *`（価格キャッシュ・注文表の約定・スナップショット）と `20 20,21 * * *`（per-daily.yml の workflow_dispatch。季節でどちらか一方だけ）。今の記述 `0 */6 * * *` は実際と違うので直す。
- 「**Worker Secrets**」に `GITHUB_TOKEN`（既存・per-daily の起動にも使う）と、作った場合の `GH_DISPATCH_TOKEN`（fine-grained・portfolio のみ・Actions: Read and write）を足す。

### 4.3 PR3: per-daily の時間帯を Mulmo の新しい組み方に合わせる（`data/scheduler/**`・`.github/workflows/**`・`CLAUDE.md`）
**前提**: Mulmo が §6.4 の変更（PER の当日コミットを 21:52 UTC まで待つ）を済ませたと報告してから作る・マージする。**期限 2026-10-30（金）**（冬時間の最初の取引日は 11-02（月）、最初の 21:20 起動は 11-01（日））。

#### (a) `lib/per-daily.mjs`
```js
/** 開始時刻から実行モードを決める（§3.3）。 */
export function runMode(start, { force = false } = {})
// 引け前（close(D) より前）→ force なら write、それ以外 compute-only
// close(D)〜21:44 → write ／ 21:45〜22:59 → compute-only ／ 23:00〜23:59 → write
/** push 禁止時間帯 21:50〜22:59（22:59 台を含む）。 */
export function isPushBlocked(now)
```
- 境界のテスト: 夏 19:59（compute-only）/20:00（write）、冬 20:59（compute-only）/21:00（write）、21:44（write）/21:45（compute-only）、22:59（compute-only）/23:00（write）。`isPushBlocked` は 21:49 false／21:50 true／22:59 true／23:00 false。force=true の 09:00 は write、force=true の 22:00 は compute-only（Mulmo の時間帯は force でも書かない）。

#### (b) `per-daily-gate.mjs`
- `mode [--now <ISO>] [--force]`。`push-ok` は新しい `isPushBlocked` を使う（exit 3 は変えない）。

#### (c) `per-daily.yml`
- Resolve mode に `--force` を渡す（`inputs.force == true` のとき）。
- 警告文: compute-only の理由を出し分ける（`引け前` / `Mulmo の時間帯（21:45〜22:59 UTC）`）。push 禁止の文言を「21:50〜22:59 UTC」に。
- 先頭コメントの時間帯の説明を §3.3 の PR3 後の列に合わせる。

#### (d) `weekly-valuations.yml`・`fund-holdings-monthly.yml`
- インラインの判定 `HM >= 2100 && HM <= 2230` を `HM >= 2100 && HM <= 2259` に（Mulmo の push が冬に 22:30 ごろまで延びるため。21:00〜21:49 も禁止のままにする＝この 2 本は急ぐ理由が無い）。文言も合わせる。

#### (e) `CLAUDE.md`
- データの書き手の表、Mulmo の行に「PER の当日コミット（引け以降・bot）を最長 21:52 UTC まで待ってから判断・書き戻し」を足す。per-daily の行に「21:45〜22:59 UTC 開始は書かない・21:50〜22:59 UTC は push しない」を足す。

## 5. 二重実行の整理（schedule を予備に残す）
| 状況 | 起きること | 結果 |
|---|---|---|
| 通常（schedule は 23:0x） | Worker の dispatch が書く → 23:0x の schedule は書き込み済みでスキップ | コミット 1 つ |
| schedule が定刻（20:15）に動いた・夏 | schedule が書く → 20:20 の dispatch は待機後スキップ | コミット 1 つ |
| schedule が定刻（20:15）に動いた・冬 | PR3 後: 引け前なので compute-only → 21:20 の dispatch が書く。PR3 前: schedule が引け前の値を書き、21:20 は compute-only（その日は引け前の値） | PR3 後はコミット 1 つ（引け後） |
| Worker の dispatch が失敗 | 23:0x に schedule が書く | Mulmo は前日値（21:52 まで待ってから続行）。`per-daily-late` が開く |
| dispatch した run が失敗 | `per-daily-failed`。23:0x の schedule が再挑戦 | 成功すれば `per-daily-failed` は閉じ、`per-daily-late` が開く |
| dispatch した run が 21:45 以降に始まった | compute-only → 予備の schedule が書く | 上と同じ |
| 手動で再実行したい | `force=true` で workflow_dispatch | 書き込み済みでも・引け前でも書く。Mulmo の時間帯（21:45〜22:59 開始・21:50〜22:59 push）では書かない |

- concurrency `portfolio-data-batch`（`cancel-in-progress: false`）は変えない。週次（日曜 02:00）・月次（03:00）は 20:20／21:20 と重ならない。

## 6. Mulmo の組み方（案の比較と推奨）

### 6.1 制約
- 判断（③b）は当日の PER を読む必要がある。判断の書き戻し（③c）は per-daily と同じ `valuations.json` を書く。
- PER は米国の引け（冬 21:00 UTC）より前には作れない。Briefing は CST の朝に読む。
- Mulmo の push は最後の 1 回だけ。push の衝突が起きるのは「Mulmo が読んでから push するまでの間に per-daily が push した」とき。
- 日付: per-daily は UTC 日付 D、Mulmo は CST 日付（D＋1）で動く。21:20 UTC も 22:30 UTC も CST では翌日 05〜06 時台なので、D の対応（CST 日付の前日＝D）は変わらない。

### 6.2 案
| 案 | 中身 | 夏の Briefing | 冬の Briefing | 季節の判定を持つ場所 | 弱点 |
|---|---|---|---|---|---|
| (a) Mulmo の時刻を季節で変える | 冬は Mulmo を 22:00 UTC 開始に。per-daily の時間帯も冬だけ 1 時間ずらす | 05:35 CST | 06:35 CST | Worker・per-daily の時間帯・Mulmo のスケジュール（年 2 回の切替。CST に夏時間は無いので手で替えるか自前判定） | 3 か所で季節を持つ。切替を忘れると衝突。PER が早く入った日も 1 時間待つ |
| **(b) Mulmo が PER を待つ（期限つき）＋ per-daily の禁止時間帯を後ろへ縮める** | Mulmo は 21:00 開始のまま。判断の前に PER の当日コミットを最長 21:52 まで待つ。per-daily は 21:45 まで書いてよく、21:50〜22:59 は push しない | 05:35 CST（今と同じ。もう入っている） | 06:00〜06:30 CST | Worker（どちらの時刻に起動するか）と per-daily の「引けの時刻」だけ。**Mulmo は季節を知らなくてよい** | Mulmo に待ちのループが要る。Worker が失敗した日は Mulmo が 21:52 まで無駄に待つ |
| (c) Mulmo を通年 22:00 UTC 開始 | 待ちは無し。per-daily の禁止時間帯を通年 22:00〜23:30 に | 06:35 CST（1 時間遅くなる） | 06:35 CST | Worker だけ | 夏も 1 時間遅い。MF 取込（05:00 CST）と Mulmo の時刻がずれる（害は無い） |
| (c') Worker の起動を通年 21:20 ＋ (b) | 季節の判定がいらない | 06:00 CST | 06:00 CST | なし | 決定 1（夏は 20:20）と合わない。夏も遅くなる |
| (d) Mulmo の処理を Worker／Actions へ移す | §6.3 | — | — | — | 時間帯の問題そのものは消えない（§6.3 の結論） |

### 6.3 (d) Mulmo の処理をどこに置くか
判断軸: 決定論的な計算か LLM の判断か／Mulmo の記憶・Wiki（投資判断ログ・メンター等）が要るか／Worker の制限（無料プランなら 1 回あたり CPU 10ms・外部リクエスト 50 本。現在のプランは未確認）／公開リポに出してよいか（Actions のログは公開）／push の衝突。

#### 段階 1: 今（Wiki は Mac 上・Mulmo は常駐エージェント）
| Mulmo の処理 | 種類 | Worker | Actions | 置き場所（今） | 理由 |
|---|---|---|---|---|---|
| 毎日の PER（watchlist-per・fund-per） | 決定論 | △ 外部リクエストが 50 本を超える（銘柄 40 前後＋投信の上位 10×数本）。結果をリポに書くには Contents 書き込みのトークンが要る（#709 の方針と逆） | ◎（移行済み） | **Actions（Worker が時計）** | 時刻は米国の引けで決まり、実行場所では変わらない。Worker は「正確な時刻に起動する」役に限るのが最小 |
| kv-resync | 決定論 | ○ | ◎（移行済み） | Actions | 済み |
| market-snapshot（マクロ指標） | 決定論 | ○（/yahoo の中継あり。FRED は中継が無い） | ○ | Mulmo（Briefing の部品） | `valuations.json` を書かないので時間帯の問題に関係しない。移しても #708 は変わらない |
| ③b 判断（watchlistVerdicts） | **LLM** | × Wiki・記憶が無い | × GitHub Secrets を増やさない方針。公開ログ | **Mulmo** | 記憶・Wiki が要る |
| ③c Briefing の組版 | **LLM** | × | × | **Mulmo** | 同上。ニュース収集・メンター見解 |
| 判断の書き戻し（`note`・`buyProposal`・`sellProposal`） | 決定論（入力は LLM の出力） | × リポへの書き込み権限が要る | △ | **Mulmo** | 判断の直後に同じ push で書くのが最も衝突しにくい |
| briefing-qa（公開前チェック） | 決定論 | — | ○（CI として足せる） | Mulmo | push 前のゲート |
| 土曜のバンド見直し（`bandLow`/`bandHigh`） | **LLM** | × | × | Mulmo | 投資判断 |
| 注文表の申告（`POST /order-sheet/events`） | — | ◎（済み） | — | Worker | 済み |
| MF 取込（Mac mini の launchd・Mulmo ではない） | 決定論 | × ログインが要る | × | Mac | 対象外 |

#### 段階 2: Wiki が Notion に移り、LLM 部分を `claude -p` にした後
- **`claude -p`（非対話の単発実行）**: 決まったプロンプト＋必要な入力ファイルだけを渡して 1 回で終わる。常駐の対話セッションと違い、過去の会話・記憶・作業中のツール出力が文脈に積み上がらない。
  - 節約の効き方: 入力トークンは「固定の指示（生成仕様など）」＋「その日の入力」で上限が決まる。固定の指示はプロンプトキャッシュが効きやすい。その日の入力は、**決定論の前処理で絞るほど減る**（例: `valuations.json` 全体ではなく、判断に要る銘柄の PER・%タイル・前回の判断だけを 1 つの JSON に詰める。Wiki もその日に関係するページだけを渡す）。
  - 測り方: `claude -p --output-format json` の結果にある使用量（トークン数・費用）を毎日記録し、今の常駐セッションの 1 日分と比べる（Mulmo 側で測る。本設計では数値を決めない）。`--max-turns`・使うツールの制限・モデルの指定で上限を固定できる。
- **どこで `claude -p` を動かすか**:

| 場所 | 向き | 不向き |
|---|---|---|
| Mac の launchd | Claude Code のログインと git の認証が既にある。Secrets を増やさない。MF 取込と同じ運用（Mac セッションから kickstart・ログ確認できる） | Mac が止まると止まる |
| GitHub Actions | 時刻・順番の制御（per-daily の後に続けて動かす）が最も簡単 | Anthropic のキーを GitHub Secrets に置く必要がある（方針と逆。Toshio 判断）。ログが公開（判断の中身・Wiki の内容が漏れうる） |
| Worker から Claude API を直接呼ぶ | 正確な時刻。キーは既に Worker Secret にある | `claude -p` ではない（エージェントのループ・ファイル・git が無い）。結果を公開リポに書くには Contents 書き込みのトークンが要る（#709 と逆）か、KV に置いてアプリが読む形への変更（データ構造の変更）が要る。今の `/ai/claude` 中継を Actions から使う案は、中継口の認証の見直しが先 |
- **Notion 移管で変わること**: 「Mac 上の記憶が要るから Mulmo に残す」理由が無くなる。Worker には `NOTION_API_KEY`・`NOTION_DB_ID` がある（ただし今の連携は AI 相談の保存用で、Wiki のページを読むにはそのページを連携に共有する必要がある）。Actions から Notion を読むのはログ公開の点で避ける。
- 段階 2 の置き場所（案）:

| 処理 | 段階 2 の置き場所 | 変わる点 |
|---|---|---|
| 毎日の PER・kv-resync | Actions（Worker が時計）のまま | なし |
| ③b 判断・③c 組版・書き戻し・qa | **Mac の launchd で `claude -p`**（Wiki は Notion から必要な分だけ読む） | 常駐セッションが不要。**時刻ではなく「PER のコミットが来たら始める」**（launchd で 21:00 に起動し、PER を待ってから `claude -p`）にできる |
| market-snapshot | Actions か Mac の前処理 | 判断の入力を絞る前処理の一部にまとめられる |
| バンド見直し（土曜） | Mac の `claude -p`（週 1） | 同上 |

#### (d) の結論（#708 の時間帯問題への効き方）
- 時間帯の問題は「PER（引けの後にしか作れない）」と「その PER を読んで同じファイルに書く LLM の判断」の**順番**の問題で、LLM の判断は段階 1 では Mulmo から動かせない。Worker に移せるのは決定論の処理だけで、そのうち時間に効く PER は既に Actions にあり、Worker は時計の役（dispatch）を担えば足りる。**Worker へ移しても push 禁止時間帯の要否は変わらない**。
- 段階 2 で判断が `claude -p` の単発ジョブになれば、「PER のコミットを待ってから始める」が自然な形になり、(b) の待ちがそのまま本体の起動条件になる。per-daily の 21:50〜22:59 の push 禁止は「判断ジョブの書き戻し中」を守る保険として残す（時刻の窓ではなく順番で守れていれば、窓は短くできる）。

### 6.4 推奨
- **短期（2026-11-01 の冬時間まで・今の構成）: (b)**。理由:
  1. 夏の Briefing は今と同じ時刻（05:35 CST 前後）のまま。冬だけ、PER が来るまでの必要な分（約 20〜25 分）だけ遅れる。
  2. 季節の判定は Worker（どちらの時刻に起動するか）と per-daily（引けの時刻）だけ。Mulmo は季節を知らなくてよく、年 2 回の切替作業が要らない。
  3. 順番が「PER の push → Mulmo の読み込み → Mulmo の push」に固定される。per-daily は 21:50 以降 push しないので、21:52 まで待った Mulmo の読み込み以降に PER が割り込むことは無い。
  4. 失敗した日も今と同じ（前日値で続行・予備の schedule が後で書く・`per-daily-late` で気づく）。
  - Mulmo が待ちのループを入れたくない場合の代替は (c)（通年 22:00 UTC 開始）。per-daily の禁止時間帯を 21:55〜23:30 に変えるだけで済むが、夏も 1 時間遅くなる。
- **中期（Wiki の Notion 移管・`claude -p` 化の後）**: 判断・組版を Mac の launchd の `claude -p` 単発ジョブにし、起動条件を「PER の当日コミットが来たら（期限つき）」にする（段階 2 の表）。Worker は時計（per-daily の dispatch）のまま。GitHub Secrets に Anthropic のキーを置くか（Actions で per-daily に続けて判断まで動かす案）は、そのときに Toshio が判断する（本設計の範囲外。別 Issue）。
- **Mulmo に渡す提案文**: 本リポには置かない（Toshio が Mulmo に渡す）。要点は §6.5。

### 6.5 Mulmo 側の変更（提案の要点。正本は Mulmo の手順）
1. 開始は 21:00 UTC（05:00 CST）のまま。git pull・market-snapshot・ニュース収集など PER を使わない処理は今どおり先に行う。
2. 判断（③b）の前に、PER の当日コミットを待つ: 2 分おきに `git fetch origin main` して `git log origin/main --author=github-actions --since="<D>T20:00:00Z" --fixed-strings --grep="data: daily PER <D>" -1` を確かめる（D＝CST 日付の前日）。見つかるか **21:52 UTC（05:52 CST）** になったら次へ。`--since` を足すのは、日付をまたいだ予備の実行や朝の手動実行のコミットを数えないため。
3. 待ちの後に `git pull --rebase` で `valuations.json` を読み直し、`GET /watchlist` もこの後に行う（per-daily の push の後に kv-resync が KV を更新しているため）。
4. 期限までに来なければ前日値で続行し、その旨を記録する（今と同じ）。
5. push は 1 回・最後のまま。push 前の `git pull --rebase` も今どおり。**22:59 UTC（06:59 CST）までに push を終える**（per-daily は 21:50〜22:59 に push しない。23:00 以降は予備の schedule が push しうる）。
6. 変更が済んだら #708 に報告する（PR3 のマージ条件）。夏の間に入れても害は無い（PER は 20:2x に入っているので待たない）。

## 7. トークン（決定 3）

### 7.1 既存の `GITHUB_TOKEN` について分かっていること（コードと git の履歴）
- Worker は `GITHUB_TOKEN` を `_pushSnapshotToGithub`・`_syncPositionsToGithub`（Contents API の PUT）で使う。コメントは「Classic PAT で repo スコープ」。classic の `repo` スコープなら workflow_dispatch を呼べる（`workflow` スコープは要らない）。fine-grained なら「Actions: Read and write」が要る。
- main に Worker 経由で入った最後のコミットは、スナップショットが 2026-05-27（`frontend-manual`）、positions が 2026-06-03。author はいずれも Toshio のアカウント（＝このトークンの持ち主）。Cron 由来（`worker-cron`）のスナップショットは履歴に 1 つも無い。
- 今も有効かは分からない（§8.2 で確かめる）。

### 7.2 試し方
- PR2 のコードは `env.GH_DISPATCH_TOKEN || env.GITHUB_TOKEN`（§4.2(c)）。`GH_DISPATCH_TOKEN` は**最初は作らない**。
- デプロイ後の最初の 20:20 UTC（夏の間にデプロイする）で判定する（§8.2）。
  - **有効（204）**: その日の 20:20〜20:25 UTC に `event=workflow_dispatch` の run ができ、`triggering_actor` がトークンの持ち主。→ 新規作成しない。§8.4 の確認に進む。
  - **無効**: run ができない。Toshio が Cloudflare ダッシュボードの Cron イベント（または Toshio の了解のうえで Mac で `npx wrangler tail portfolio-proxy` を 20:19〜20:23 UTC に見る）で `dispatch failed 401|403 token=GITHUB_TOKEN` を確かめる。→ 起動専用の `GH_DISPATCH_TOKEN` を作る（下記）。コードの変更は要らない（`||` で自動的にそちらを使う）。
  - 401 と 403 のどちらでも対応は同じ（新しく作る）。404 はテストで防ぐ（URL 固定）。
- `GH_DISPATCH_TOKEN` の作り方（Toshio・値はどこにも貼らない）:
  1. GitHub → Settings → Developer settings → Fine-grained tokens → Generate。Repository access は **Only select repositories → `portfolio`**。Permissions は **Actions: Read and write** だけ。有効期限 1 年（作成日と期限を手元に控える）。
  2. Mac で `cd ~/GitHub/portfolio/worker && npx wrangler secret put GH_DISPATCH_TOKEN`（対話入力）。**Mac セッションには任せない**（secret の操作は禁止事項）。
  3. `npx wrangler secret list` に名前が出ることを確認。翌日 20:20 UTC の run で確かめる。
- 既存の `GITHUB_TOKEN` を**作り直したり権限を足したりはしない**（止まっている書き込みが再開するおそれ。#709）。

## 8. デプロイと確認

### 8.1 PR1 マージ後（PM・クラウドから）
1. その日の `data: daily PER <D>`（引け以降）が main にある時間帯（例 23:30 UTC）に、`per-daily.yml` を workflow_dispatch で起動（入力なし）。**合格**: result=skipped・already-written=true・新しいコミットなし・Issue に変化なし。前の run が実行中なら終わってから。
2. PR2 のデプロイ前は予備の schedule が定刻外に書くので `per-daily-late` が開く。PR2 のデプロイ後の最初の正常日に閉じる。PR1 の後、なるべく早く PR2 をデプロイする。

### 8.2 PR2 マージ後（Mac セッション＝Toshio の依頼時）
- **デプロイは夏の間（2026-10-31 まで）に行う**（トークンの判定を 20:20 UTC で行うため）。
- Mac セッションへの prompt（自己完結）: 目的／コマンド `cd ~/GitHub/portfolio && git pull --ff-only && cd worker && npx wrangler deploy`／合格の基準（出力に schedule `0 1,8,15,22 * * *` と `20 20,21 * * *` の両方。`curl -sS https://portfolio-proxy.shoulang.workers.dev/` が `portfolio-proxy OK`）／失敗時 `npx wrangler rollback`／結果は #708 に成否・HTTP ステータス・schedule の一覧だけ／禁止: secret の操作・ファイル編集。
- 初回 20:20 UTC の後、PM がクラウドから確認:
  1. `gh api "repos/shoulang0729/portfolio/actions/workflows/per-daily.yml/runs?event=workflow_dispatch&per_page=5"` に **20:20〜20:25 UTC 作成**の run がある（`triggering_actor.login` も見る）。→ あれば `GITHUB_TOKEN` は有効（§7.2）。
  2. その run が result=write で、main に `data: daily PER <D>`（bot）が 21:00 UTC より前に入っている。
  3. 21:20 UTC に dispatch の run が**無い**（夏は 20:20 だけ）。
  4. その夜の予備の schedule run が result=skipped。`per-daily-late` が開いていたなら 2 の run で閉じている。
- 1 が無いとき: §7.2 の「無効」の手順。Cron 自体が無ければデプロイを確認。必要なら `npx wrangler rollback`（予備の schedule があるのでデータは止まらない）。

### 8.3 PR3 マージ後と冬時間の初日（PM）
- PR3 マージ後（夏）: 翌日の 20:20 の run が今までどおり write、Mulmo の Briefing の時刻が変わらないこと。
- **2026-11-02（月）**: 21:20〜21:25 UTC 作成の dispatch run があり result=write、20:20 UTC には run が無い。main で `data: daily PER 2026-11-02`（21:2x）が Mulmo の Briefing コミットより前にある。Mulmo の Briefing コミットが 22:59 UTC より前。予備の schedule が skipped。
- 11-01（日）の 21:20 の run も同じ形で確かめられる（市場は休みだが起動・書き込みは動く）。

### 8.4 `GITHUB_TOKEN` が有効だった場合: 止まっている書き込みが再開しないことの確認（決定 4）
- 本設計（PR2）は、Worker の次の 3 つの経路のコードも `GITHUB_TOKEN` も**変えない**。デプロイで変わるのは per-daily の Cron の分岐だけ。止まっている理由（下の条件）はデプロイの前後で同じなので、デプロイが原因で再開することは無い。
- 経路と、再開する条件（コードを読んだ結果）:

| 経路 | 書く先 | 再開する条件 |
|---|---|---|
| Cron `0 1,8,15,22` の最後のスナップショット | `data/portfolio-snapshot.json` | KV `positions` が空でない配列・`FINNHUB_API_KEY` がある・`GITHUB_TOKEN` に Contents の書き込み権限がある、のすべて（どれかが欠けると何も書かない。失敗は Worker のログだけ） |
| `POST /portfolio/snapshot`（アプリのメニュー「スナップショット保存」） | 同上 | このルートが呼ばれ、トークンに Contents の書き込み権限がある。**認証の扱いは #709 で確認する** |
| `PUT /positions`（アプリの取込モーダルの保存・PIN 必須） | `data/positions.json` | 取込を保存し、トークンに Contents の書き込み権限がある |

- 確認の手順（PM・デプロイ後 48 時間）:
  1. `gh api "repos/shoulang0729/portfolio/commits?path=data/portfolio-snapshot.json&since=<デプロイ時刻>"` と `…path=data/positions.json…` が空。
  2. Toshio は、この間アプリのメニュー「スナップショット保存」と取込モーダルの保存を使わない。
  3. Toshio が GitHub の設定画面で、このトークンの種類・スコープ・期限を確かめて #709 に書く（値は書かない）。classic の `repo` なら Contents の書き込みもできる＝上の条件の「権限」は満たしている、ということになる。
- **推奨（#709 で Toshio 判断）**: `GITHUB_TOKEN` が有効で `repo` スコープだった場合、#709 の「止めたまま」を確実にするには、起動専用の `GH_DISPATCH_TOKEN` を作って `GITHUB_TOKEN` を Worker から削除する（`wrangler secret delete GITHUB_TOKEN`・Toshio が Mac で）のが最も確実（3 つの経路はトークンが無いと何もしない。dispatch は `||` で `GH_DISPATCH_TOKEN` を使う）。本設計はこれを前提にしない。

## 9. 失敗の気づき方
| 失敗 | 気づく場所 |
|---|---|
| Worker の Cron が動かない・dispatch が 4xx/5xx | Cloudflare の Cron イベント（throw で失敗として残る）。予備の schedule が書けば `per-daily-late` |
| run が失敗 | `per-daily-failed`（既存） |
| run が compute-only に落ちた | ジョブサマリと `::warning`。予備の schedule が書けば `per-daily-late` |
| kv-resync の失敗 | `kv-resync-failed`（既存） |
| Mulmo が期限まで待って前日値で続行 | Mulmo の記録（Mulmo 側）。同じ日に `per-daily-late` も開く |

## 10. 受け入れ条件

### 共通
- [ ] 品質ゲート green: vitest / eslint / prettier / check:types / check:circular（e2e は UI 変更なし）。`index.html` の `?v=` は bump しない。
- [ ] 公開リポ検査: トークン・金額・口座の情報が差分・テスト・ログ出力に無い。テストのトークンは合成値。

### PR1（#710 ＋追加）
- [ ] #710 の受け入れ条件（元の §8 PR1）をすべて満たす。ただし「20:00 UTC」「20:00〜20:54」は §4.1 のとおり引けの時刻基準。
- [ ] `isUsEasternDst`・`usCloseUtcHHMM` が §4.1(a) の表どおり。10 年分で `Intl` と一致。
- [ ] `isAlreadyWritten`・`isOnTimeStart` が §4.1(b) の前後比較どおり（冬の日付の例を含む）。
- [ ] `runMode`・`isPushBlocked`・schedule の cron は変えていない（PR3 で変える）。

### PR2
- [ ] crons が `["0 1,8,15,22 * * *", "20 20,21 * * *"]`。
- [ ] 夏は 20:20 だけ、冬は 21:20 だけ dispatch する（§4.2(d) の 6 例）。
- [ ] トークンは `GH_DISPATCH_TOKEN || GITHUB_TOKEN`。ログに出るのは名前だけ。両方無ければ fetch せず throw。
- [ ] 204 で成功。429/5xx/ネットワークエラーは計 3 回まで。401/403/404/422 は再試行しない。最終的に失敗したら throw。
- [ ] 既存の Cron と `event.cron` が無い呼び出しの動きが変わらない（既存の `tests/worker-order-sheet.test.js` が green）。HTTP ルートを足していない。スナップショット・positions の経路と `GITHUB_TOKEN` の他の使い方を変えていない。
- [ ] CLAUDE.md が §4.2(e) のとおり。PR 本文に「マージ後に Worker のデプロイが必要（Mac セッション可）・夏の間にデプロイ・トークンの判定は §8.2」と書いてある。

### PR3
- [ ] Mulmo の変更完了の報告が #708 にある（マージ前に reviewer が確認）。
- [ ] `runMode`・`isPushBlocked` が §3.3 の「PR3 後」の列と §4.3(a) の境界どおり。force の扱いも同じ。
- [ ] weekly・monthly の禁止時間帯が 21:00〜22:59。
- [ ] コミットの形・Guard・kv-resync・Issue の動きは変わっていない。
- [ ] CLAUDE.md が §4.3(e) のとおり。

## 11. 触ってはいけない範囲
- `data: daily PER <YYYY-MM-DD>` の形・author・`--allow-empty`（Mulmo が文字列一致で判定する）。
- Guard（phase15 §6.3 の許可フィールド）・kv-resync の流れ・`per-daily-failed`／`kv-resync-failed` の Issue の動き。`runMode`・`isPushBlocked` は PR3 で §3.3 のとおりにだけ変える。
- `data/valuations.json` のキー・形状、投資判断の正本値（`score()` の閾値・%タイル・`fund-per` の加重）。
- concurrency group `portfolio-data-batch`・`cancel-in-progress: false`。
- Worker の既存の Cron の処理、スナップショット・positions の書き込み経路、`GITHUB_TOKEN` の他の使い方、認証・CORS・レート制限（#709 の範囲）。
- `docs/briefing-generation-spec.md`（Mulmo の正本）。Mulmo の組み方の変更は §6.5 の提案として Toshio が渡す。

## 12. 要 Toshio 判断（既定で設計済み・変えたければ指示）
- **Q1 Mulmo の組み方**: 既定は (b)（21:00 開始のまま・PER を最長 21:52 UTC まで待つ）。冬の Briefing は 06:00〜06:30 CST。代替は (c)（通年 22:00 UTC 開始・06:35 CST）。
- **Q2 時刻の値**: per-daily の書き込み締切 21:45（開始）、push 禁止 21:50〜22:59、Mulmo の待ち期限 21:52、Mulmo の push 期限 22:59。運用の時刻であり投資判断の値ではないので既定で置いた。
- **Q3 予備の schedule**: `15 20 * * *` のまま残す（冬は定刻に動いても引け前なので書かない）。
- **Q4 #709 とトークン**: `GITHUB_TOKEN` が有効だった場合も、#709 で `GH_DISPATCH_TOKEN` を作り `GITHUB_TOKEN` を削除するのを推奨（§8.4）。本設計の範囲では決めない。
- **Q5 中期の構成**（Notion 移管・`claude -p` 化の後に判断・組版をどこで動かすか。Anthropic のキーを GitHub Secrets に置くか）: 本設計の範囲外。§6.3 段階 2 を材料に別 Issue で。

## 13. ブランチ / PR / Issue
- **PR1**: 既存の #710（ブランチ `ci/708-per-daily-skip-if-written`）に §4.1 を追加コミットする。本文は `Refs #708`。`needs-toshio`。
- **PR2**: ブランチ `feat/worker-per-daily-dispatch`（base=`main`・PR1 マージ後）。タイトル `feat(worker): Cron から per-daily を workflow_dispatch で起動（夏 20:20／冬 21:20 UTC）（#708 PR2）`。本文 `Refs #708`。`needs-toshio`。マージ後、**10-31 までに**デプロイ（§8.2）。
- **PR3**: ブランチ `ci/per-daily-mulmo-window`（base=`main`・Mulmo の完了報告の後）。タイトル `ci(per-daily): 冬時間 21:20 起動に合わせて書き込み・push 禁止の時間帯を変更（#708 PR3）`。本文 **`Closes #708`**。`needs-toshio`。**10-30 までにマージ**。
- 順序: **PR1 → PR2（デプロイ・トークン判定）→ Mulmo の変更 → PR3**。Mulmo の変更は PR1・PR2 と並行でよい。
- **PR3 が間に合わなかった場合**: 冬の 21:20 起動は compute-only になり、予備の schedule（23:0x）が書く＝今と同じ（Briefing は前日値、`per-daily-late` が毎日開く）。データが壊れることは無い。

## 14. 未解決の別件（本 Issue の範囲外）
- #709: Worker のスナップショット／positions の書き込み（止めたまま整理）。§8.4 の確認結果を材料にする。
- 中期の構成（§6.3 段階 2・§12 Q5）: Notion 移管と `claude -p` 化の後に別 Issue。
