# Handoff: per-daily を Worker の Cron から起動する（#708）

- **Issue**: #708 `per-daily の schedule が毎日約3時間遅れて起動し、Mulmo の 21:00 UTC に間に合わない`
- **難易度**: medium
- **分担**: 設計＝architect（本 doc）／実装＝implementer／レビュー＝reviewer／デプロイ＝Mac セッション（Toshio の依頼時）／トークン準備＝Toshio
- **区分**: 確定（方式は 2026-10-05 Toshio 決定「Worker の Cron から per-daily を起動する」）。§9「要 Toshio 判断」の 3 点は既定値で設計済み
- **Toshio 確認**: **要**（PR1＝`.github/workflows/**`、PR2＝`worker/**` の Cron と GitHub トークン・`CLAUDE.md`）

## 実装ログ（implementer が更新）
- [ ] T0（Toshio）: Worker Secret `GH_DISPATCH_TOKEN` の準備（§3.0）: ____
- [ ] PR1 #____ / マージ ____ / 重複スキップの確認（§7.1）____
- [ ] PR2 #____ / マージ ____ / デプロイ（Mac セッション）____ / 初回 20:20 UTC の確認（§7.2）____

---

## 1. 背景・ゴール

### 背景
- `per-daily.yml`（cron `15 20 * * *`）の schedule 起動が 10/03 は 23:02 UTC、10/04 は 23:08 UTC だった（約 2h50m 遅れ）。Mulmo の日次バッチ（21:00 UTC＝05:00 CST）より後なので、Briefing は前日の PER を使っている。
- workflow_dispatch（手動起動）はすぐに動く（10/03 22:31 UTC の実績。所要は約 1 分）。
- 米国の終値は夏時間なら 20:00 UTC にそろう。開始をこれより前にはできない。
- 今の per-daily には「当日分がもう書かれているか」の確認が無い。このため 10/03 は 22:32 UTC（手動）と 23:02 UTC（schedule）の 2 回、`data: daily PER 2026-10-03` がコミットされた。Worker から起動して schedule を予備に残すなら、二重書き込みを防ぐ仕組みが必要。

### per-daily の時刻による分岐（現状・`data/scheduler/lib/per-daily.mjs`。phase15 設計書 §2.3・§2.6）
| 開始時刻（UTC） | `runMode` | push | 結果 |
|---|---|---|---|
| 00:00〜20:54 | write | 可（`isPushBlocked`＝false） | 書き込み＋コミット＋kv-resync |
| 20:55〜22:30 | compute-only | — | 計算だけ（その日は前日値） |
| 22:31〜23:59 | write | 可 | 書き込み（Mulmo の後になる） |

- push の直前にも `push-ok` で確認する。21:00〜22:30 UTC は push しない（exit 3）。
- **20:20 UTC に dispatch した場合**: 開始は 20:20〜20:2x → `write`。約 1 分で終わり、push は 20:21〜20:25 ごろ（禁止時間帯の前）→ **通常の書き込み経路に入る**。20:55 までに始まらないと計算のみに落ちるので、余裕は約 35 分。
- concurrency `portfolio-data-batch`（`cancel-in-progress: false`）では、実行中の run の後ろで待てるのは 1 つだけ。後から来た run が待機中の run を取り消す（phase15 §6.4）。

### ゴール
- 毎日 20:20 UTC に Cloudflare Worker の Cron が `per-daily.yml` を workflow_dispatch で起動する。当日の PER が 21:00 UTC の Mulmo に間に合う。
- schedule（20:15 UTC）は**予備として残す**。per-daily 側で「当日分は書き込み済み」なら何もしない（二重書き込みをなくす）。
- Worker からの起動が効かず、予備の schedule が遅れて書いた日は、GitHub の Issue で気づけるようにする。
- コミットの形（`data: daily PER <UTC日付>`・author `github-actions[bot]`）と `valuations.json` の書き方は**変えない**。Mulmo 側の判定（main 上の文字列一致）はそのまま使える。

## 2. 対象ファイル一覧
| ファイル | 状態 | PR | 内容 |
|---|---|---|---|
| `data/scheduler/lib/per-daily.mjs` | 変更 | PR1 | 純関数 `isAlreadyWritten()`・`isOnTimeStart()` を追加 |
| `data/scheduler/per-daily-gate.mjs` | 変更 | PR1 | サブコマンド `already-written [--now]`・`on-time [--now]` を追加 |
| `tests/per-daily.test.js` | 変更 | PR1 | 上記 2 関数のテスト |
| `.github/workflows/per-daily.yml` | 変更 | PR1 | 書き込み済みチェック・`force` 入力・`per-daily-late` Issue |
| `worker/src/index.js` | 変更 | PR2 | `scheduled()` を `event.cron` で分ける。`_dispatchPerDaily(env)` を追加 |
| `worker/wrangler.toml` | 変更 | PR2 | `crons` に `"20 20 * * *"` を追加 |
| `tests/worker-per-daily-dispatch.test.js` | 新規 | PR2 | scheduled ハンドラの単体テスト（fetch モック） |
| `CLAUDE.md` | 変更 | PR2 | データの書き手の表・Cron の行・Worker Secrets |

## 3. 変更手順

### 3.0 T0（Toshio の作業・PR2 のデプロイ前）: 起動用トークン

#### 既存の `GITHUB_TOKEN` について分かっていること（コードと git 履歴から推定）
- Worker は Secret `GITHUB_TOKEN` を使っている（`_pushSnapshotToGithub`・`_syncPositionsToGithub`。Contents API の PUT）。`worker/src/index.js` のコメントは「Classic PAT で repo スコープ」。CLAUDE.md の Worker Secrets 一覧には載っていない。
- classic PAT の `repo` スコープなら workflow_dispatch API を呼べる（GitHub の仕様。`workflow` スコープはワークフローのファイルを書き換えるためのもので、起動には要らない）。fine-grained PAT なら「Actions: Read and write」が要る。
- **ただし、このトークンが今も有効かは分からない**。main の Worker のコミットは `chore(snapshot)` が 2026-05 下旬、`chore(positions)` が 2026-06 上旬で止まっている（git log）。止まった理由は分かっていない。考えられるのは、Cron が早めに return している（KV の positions が空、`FINNHUB_API_KEY` が未設定）か、トークンの失効・削除。

#### 決定（既定）: 起動専用の Worker Secret `GH_DISPATCH_TOKEN` を新しく作る
- **理由**:
  1. 権限を最小にできる（Actions だけ。Contents の書き込みは持たない）。
  2. 状態の分からない既存トークンに頼らずに済む。
  3. 既存の `GITHUB_TOKEN` を作り直すと、止まっているスナップショット／positions の公開リポへの書き込み（金額を含む）が**再開してしまう**おそれがある。これは避けたい。
- **GitHub Secrets（Actions の Secrets）は増やさない**。増えるのは Worker Secret が 1 つだけ。
- Toshio の手順（値はどこにも貼らない）:
  1. GitHub → Settings → Developer settings → Fine-grained tokens → Generate。Resource owner は自分。Repository access は **Only select repositories → `portfolio`**。Permissions は **Actions: Read and write** だけ（Metadata: Read は自動で付く）。有効期限は 1 年（作成日と期限を手元に控える）。
  2. Mac で `cd ~/GitHub/portfolio/worker && npx wrangler secret put GH_DISPATCH_TOKEN` を実行し、値を対話入力する。**Mac セッションには任せない**（CLAUDE.md の禁止事項「wrangler の secret 操作」に当たる）。
  3. 確認: `npx wrangler secret list` の出力に `GH_DISPATCH_TOKEN` の**名前**が出る（値は出ない）。
- 代替案（Toshio が選ぶ場合）: 既存の `GITHUB_TOKEN` を使う。この場合は Toshio が GitHub の設定画面で次を確かめる: 種類（classic なら `repo` スコープ／fine-grained なら Actions: Read and write があるか）、期限が切れていないか、`portfolio` へのアクセス権。作り直しが必要なら、上の理由 3 を先に整理すること（スナップショット経路を止めるか、公開をやめるか）。コードは `env.GH_DISPATCH_TOKEN` だけを読み、`GITHUB_TOKEN` に代わりに使うことはしない。代替案にする場合は、PR2 で名前を 1 か所だけ変える。

### 3.1 PR1: per-daily に「当日分は書き込み済み」チェックを入れる（`.github/workflows/per-daily.yml` ほか）

#### (a) `lib/per-daily.mjs` に純関数を足す
```js
/** 20:00 UTC（米国の夏時間の引け）以降に書かれた当日分のコミットがあるか。 */
export function isAlreadyWritten(commits, now) // commits: [{ author, subject, committedAt(ISO) }]
/** 開始が 20:00〜20:54 UTC（Mulmo に間に合う時間帯）か。 */
export function isOnTimeStart(start)          // utcHHMM(start) が 2000〜2054
```
- `isAlreadyWritten` は、次をすべて満たすコミットが 1 つでもあれば true を返す。
  - `author === 'github-actions[bot]'`
  - `subject === dailyPerCommitMessage(D)`（D＝`now` の UTC 日付）
  - `D T20:00:00Z <= committedAt <= now`
- 20:00 より前のコミット（朝に手動で試した分など）は数えない。このため夕方の本番はスキップされない。
- 前後比較の例（`now` と main のコミット → 結果）:

| now（UTC） | main の当日コミット | 現状 | 変更後 |
|---|---|---|---|
| 10-05 23:02（予備の schedule） | `data: daily PER 2026-10-05`・bot・10-05 20:21 | もう一度書き、2 つ目のコミットができる | **スキップ**（コミットしない・result=skipped） |
| 10-05 20:20（Worker の起動） | なし | — | 書き込む |
| 10-05 20:21（Worker の起動・schedule が 20:15 に定刻で動いて先に書いた） | `…2026-10-05`・bot・10-05 20:16 | もう一度書く | **スキップ** |
| 10-05 20:20 | `…2026-10-05`・bot・10-05 08:30（朝の手動テスト） | 書く | 書く（20:00 より前なので数えない） |
| 10-06 00:30（予備の schedule が日付をまたいだ） | `…2026-10-05`・10-05 20:21 | `…2026-10-06` を書く | 同じ（D＝10-06 の 20:00 以降のコミットは無い）。10-06 20:20 の Worker 起動はスキップされない |
| 10-05 23:02 | `…2026-10-05`・author が人・20:30 | 書く | 書く（bot のコミットだけを数える＝Mulmo の判定と同じ条件） |
| 10-05 23:02 | `data: daily PER 2026-10-05 (retry)` | 書く | 書く（件名は完全一致だけ） |

#### (b) `per-daily-gate.mjs already-written [--now <ISO>]`
- `git log HEAD --since=<D>T20:00:00Z --format=%an%x09%cI%x09%s` を読む。checkout は `ref: main`・`fetch-depth: 0` なので、HEAD は最新の main。
- 結果を `isAlreadyWritten` に渡す。書き込み済みなら `written` を出して **exit 6**、まだなら `not-yet` を出して exit 0。それ以外の非 0 は判定の異常として扱う。
- 出力はこの 2 語だけにする（コミットの一覧はログに出さない）。

#### (c) `per-daily.yml`
1. `workflow_dispatch` に入力を足す: `force`（`type: boolean`・`default: false`・説明「当日分が書き込み済みでも実行する（手動の再実行用）」）。Worker からの起動は入力を渡さないので false になる。schedule では空になる。
2. 「Resolve mode」の次にステップ `already` を足す（id `already`）。
   - `inputs.force == true` なら判定せず `already=false` にし、`::notice` で強制実行を知らせる。
   - それ以外は `already-written --now "$START"` を実行する（START は mode ステップの出力を再利用し、`start` を `GITHUB_OUTPUT` に出す）。exit 6 なら `already=true` にして `::notice::当日分（data: daily PER <D>）は 20:00 UTC 以降に書き込み済みのため何もしません` を出す。exit 0 なら `already=false`。それ以外は失敗にする。
3. 「Compute PER」「Guard」「Commit and push」に `if: steps.already.outputs.already != 'true'` を足す。push の `if` は既存の条件と `&&` でつなぐ。Guard は今は無条件で動くので、新しく `if` を付ける。
4. 「Summarize result」:
   - `ALREADY=${{ steps.already.outputs.already }}` と `ALREADY_OUTCOME` を受け取る。
   - `ALREADY_OUTCOME == failure` なら `REASONS+=already-check=failure` にする。
   - **`ALREADY == true` なら最初に `RESULT=skipped`・`REASONS=`（空）に決めて、残りの判定は行わない**。こうしないと、スキップした compute の outcome `skipped` が `compute=skipped` として失敗扱いになる。
   - サマリ表に `| already-written | true/false |` の行と `| event | schedule/workflow_dispatch |` の行を足す。
5. per-daily-failed Issue のステップは変えない（skipped は「Issue は変更しない」の分岐に入る）。
6. 新しいステップ「Open / update / close per-daily-late issue (idempotent)」を足す（`if: always()`）。ラベルは `per-daily-late`（色 `FBCA04`・説明「Worker 起動の当日 PER が Mulmo に間に合わなかった（自動管理）」）。
   - **開く・更新する**: `RESULT == write` かつ `github.event_name == 'schedule'` かつ開始が `isOnTimeStart` で**ない**。つまり予備の schedule が遅れて書いた日は、20:20 UTC の Worker 起動で当日分が書けなかったことを意味する。
     - タイトル: `⚠ 当日の PER が Mulmo（21:00 UTC）に間に合いませんでした（予備の schedule が書き込み）`
     - 本文: 開始時刻（UTC）・Run の URL・確認先（Cloudflare ダッシュボード → Worker `portfolio-proxy` → Cron イベントの履歴／Actions の per-daily に 20:20 ごろの workflow_dispatch の run があるか／per-daily-failed Issue）。金額・トークンは書かない。
   - **閉じる**: `RESULT == write` かつ開始が `isOnTimeStart`（起動経路は問わない）。コメントは「定刻（20:00〜20:54 UTC）の書き込みが成功しました」。
   - それ以外（skipped・failure・朝の手動の write）は何もしない。
   - 開始時刻の判定は `per-daily-gate.mjs on-time --now "$START"`（exit 0＝定刻／exit 7＝定刻外。(b) と同じ形で足す）を使う。`node -e` で書かない。
7. 先頭のコメントに「起動は Worker Cron 20:20 UTC の workflow_dispatch が本番、schedule 20:15 は予備。20:00 UTC 以降に当日分を書き込み済みなら何もしない（#708・本設計書）」を足す。
8. schedule の cron（`15 20 * * *`）は**変えない**（予備。§4 の二重実行の整理を参照）。

### 3.2 PR2: Worker の Cron から dispatch する（`worker/**`・`CLAUDE.md`）

#### (a) `worker/wrangler.toml`
```toml
# 0 1,8,15,22: 価格キャッシュ・注文表の約定・スナップショット（JST 10:00/17:00/0:00/7:00）
# 20 20: per-daily.yml の起動（workflow_dispatch・#708。米国の引け 20:00 UTC の後・Mulmo 21:00 UTC の前）
[triggers]
crons = ["0 1,8,15,22 * * *", "20 20 * * *"]
```
- Workers の無料プランで使える Cron は、アカウント全体で 5 個まで（1 つの式で複数の時刻を書いても 1 個）。この Worker は今 1 個なので 2 個になる。上限に当たるとデプロイが失敗するので、デプロイの出力で確認する（§7.2）。

#### (b) `worker/src/index.js`
- 定数を足す: `const PER_DAILY_CRON = '20 20 * * *';` と `const PER_DAILY_DISPATCH_URL = 'https://api.github.com/repos/shoulang0729/portfolio/actions/workflows/per-daily.yml/dispatches';`。リポ名と workflow のファイル名は固定。env からは受け取らない。
- `scheduled(event, env, ctx)` の**先頭**（`_cronConfirmOrderFills` より前）に分岐を足す:
  ```js
  if (event?.cron === PER_DAILY_CRON) { await _dispatchPerDaily(env); return; }
  ```
  - この Cron では、注文表の約定・価格キャッシュ・スナップショットを**動かさない**。
  - `event.cron` が無い場合と、既存の式の場合は、今と同じ処理にする（既存テストは `scheduled({}, …)` を呼んでいるので、そのまま通る）。
- `async function _dispatchPerDaily(env)`:
  1. `env.GH_DISPATCH_TOKEN` が無ければ `console.error('[cron per-daily] GH_DISPATCH_TOKEN 未設定')` を出し、`throw new Error('per-daily dispatch: no token')`。
  2. `POST PER_DAILY_DISPATCH_URL` を送る。ヘッダは `Authorization: Bearer <token>`・`Accept: application/vnd.github+json`・`X-GitHub-Api-Version: 2022-11-28`・`User-Agent: portfolio-proxy-worker`・`Content-Type: application/json`。本文は `{"ref":"main"}`（inputs は送らない）。
  3. 成功は **HTTP 204**。`console.log('[cron per-daily] dispatched 204')` を出して終わる。
  4. 再試行は最大 3 回（初回を含む）。対象はネットワークエラー・タイムアウト（1 回 15 秒・`AbortController`）・429・5xx で、間隔は 2 秒→4 秒。**401/403/404/422 は再試行しない**（権限・設定の誤りなので、何度送っても同じ）。
  5. 最終的に失敗したら、`console.error('[cron per-daily] dispatch failed', status, msg)` を出してから `throw new Error('per-daily dispatch failed: HTTP <status>')`。`status` は数値かエラー名、`msg` は応答 JSON の `message` を最大 200 文字まで。throw すると、Cloudflare の Cron イベントの履歴に失敗として残る（他に通知の手段は無い。気づく経路は §5）。
  6. **ログに出さないもの**: トークン・リクエストヘッダ・応答ヘッダ。
- **起動用の HTTP ルートは作らない**（外から起動できる口を増やさない）。テストは `worker.scheduled({ cron: '20 20 * * *' }, env, ctx)` を直接呼ぶ。
- Worker 側では「当日分がコミット済みか・実行中か」を**確かめない**。冪等性は per-daily 側（PR1）で一か所にまとめる。理由は 3 つある。
  - トークンの権限を Actions の起動だけにできる。
  - Mulmo と同じ判定（main のコミット）を正本にできる。
  - 実行中の run があっても、dispatch した run は concurrency で待ち、始まってから判定してスキップするので害が無い。
- 既存の `_pushSnapshotToGithub`・`_syncPositionsToGithub`・`GITHUB_TOKEN` の扱いは**変えない**。

#### (c) `tests/worker-per-daily-dispatch.test.js`（新規・vitest）
- `vi.stubGlobal('fetch', fetchMock)` を使い、`worker.scheduled({ cron: '20 20 * * *' }, env, { waitUntil() {} })` を呼ぶ。待ち時間は `vi.useFakeTimers()`＋`vi.advanceTimersByTimeAsync` で進める。または `_dispatchPerDaily` に sleep を差し込める形にする（どちらを選ぶかは実装に任せる）。
- ケース:
  1. 204 → fetch は 1 回。URL・`method: 'POST'`・本文 `{"ref":"main"}`・`Authorization: Bearer <テスト用の合成値>`・`X-GitHub-Api-Version` を確かめる。KV の get/put は呼ばれない（`env.KV` のスパイで確認）。finnhub への fetch も無い。
  2. 503 → 503 → 204 → fetch は 3 回で成功（throw しない）。
  3. 500 が 3 回 → reject（`per-daily dispatch failed`）。fetch は 3 回。
  4. 403 → fetch は 1 回だけで reject（再試行しない）。401・404・422 も同じ（`it.each`）。
  5. fetch が throw（ネットワークエラー）→ 再試行の対象。
  6. `GH_DISPATCH_TOKEN` が無い → fetch を呼ばずに reject。
  7. ログ（`console.error`／`console.log` のスパイ）にトークンの文字列が含まれない。
  8. `scheduled({ cron: '0 1,8,15,22 * * *' })` と `scheduled({})` では、dispatch の URL への fetch が無い（既存の経路のまま）。
- トークンは `'test-token-not-real'` のような合成値にする。

#### (d) `CLAUDE.md`（開発体制＝Toshio 確認）
- データの書き手の表、per-daily の行: 「GitHub Actions `per-daily.yml`（Worker Cron が毎日 20:20 UTC に workflow_dispatch で起動・予備 schedule 20:15 UTC・20:00 UTC 以降に当日分があれば何もしない・コミット `data: daily PER <UTC日付>`）」。
- 「**Cron**」の行: `0 1,8,15,22 * * *`（価格キャッシュ・注文表の約定・スナップショット）と `20 20 * * *`（per-daily.yml の workflow_dispatch・Secret `GH_DISPATCH_TOKEN`）。今の記述 `0 */6 * * *` は実際の値と違うので、あわせて直す。
- 「**Worker Secrets**」に `GH_DISPATCH_TOKEN`（fine-grained・portfolio のみ・Actions: Read and write）を足す。既存の `GITHUB_TOKEN` も載っていないので、名前だけ足す。

## 4. 二重実行の整理（schedule を予備に残す）

| 状況 | 起きること | 結果 |
|---|---|---|
| 通常（schedule は 23:00 ごろ） | 20:20 に Worker の dispatch → 20:2x に書く → 23:0x に schedule → 書き込み済みでスキップ | コミット 1 つ |
| schedule が定刻（20:15）に動いた | schedule が実行中・dispatch（20:20）は待機 → schedule が書く → dispatch が始まり、書き込み済みでスキップ | コミット 1 つ |
| 実行中の run＋待機中の run があるところに dispatch | 待機中の run が取り消される（cancelled）。残った run が判定する | どれが残っても同じ処理なので害は無い。取り消しの通知は無い（phase15 §6.4） |
| Worker の dispatch が失敗（トークン・GitHub 障害） | 23:0x に schedule が書く（今と同じ） | Mulmo には間に合わない。`per-daily-late` Issue が開く |
| dispatch した run が失敗（計算・push） | `per-daily-failed` Issue（既存）。23:0x に schedule が再挑戦する（20:00 以降のコミットが無いので書く） | 成功すれば `per-daily-failed` は閉じる。`per-daily-late` は開く |
| dispatch した run が 20:55 以降に始まった（Actions の混雑） | compute-only で書かない → 予備の schedule が書く | 上の行と同じ |
| 手動で再実行したい | `force=true` で workflow_dispatch | 書き込み済みでも書く（2 つ目のコミットになる。Mulmo の判定には影響しない） |

- 週次（日曜 02:00）・月次（03:00）は 20:20 と重ならない。人が手動で起動する場合は、phase15 §6.4 のとおり前の run の終了を待つ。

## 5. 失敗の気づき方
| 失敗 | 気づく場所 |
|---|---|
| Worker の Cron が動かない・dispatch が 4xx/5xx | Cloudflare ダッシュボードの Cron イベント（throw で失敗として残る）。翌朝までに予備の schedule が書けば `per-daily-late` Issue が開く |
| run が失敗 | `per-daily-failed` Issue（既存） |
| run が計算のみに落ちた（20:55 以降に開始） | ジョブサマリと `::warning`（既存）。予備の schedule が書けば `per-daily-late` |
| kv-resync の失敗 | `kv-resync-failed` Issue（既存） |
- Worker のログはリポに出ない（Cloudflare の中だけ）。それでも、トークン・ヘッダはログに出さない。

## 6. 夏時間（米国 DST）の扱い
- **決定（既定）: 通年 20:20 UTC。冬時間でも Cron を動かさない**（Cron は UTC 固定。切り替えの仕組みは作らない）。

| 期間 | 米国の引け（UTC） | Worker の起動 | PER の元になる値 | Mulmo（21:00 UTC） |
|---|---|---|---|---|
| 夏時間（〜2026-11-01・2027-03-14〜） | 20:00 | 20:20 | 引け後の終値 | 間に合う |
| 冬時間（2026-11-02〜2027-03-13） | 21:00 | 20:20 | **引けの 40 分前の値** | 間に合う |
| （却下案）冬時間だけ 21:20 | 21:00 | 21:20 | 引け後 | **間に合わない**。しかも 20:55〜22:30 の開始は compute-only、21:00〜22:30 は push 禁止なので、書けない |

- 冬時間に引け前の値になる点は、phase15 設計書 §10-1 で受け入れ済みの「20:15 UTC 固定」と同じ考え方（今回 15 分→20 分になるだけ）。
- 冬時間にも引け後の値がほしい場合は、Mulmo の実行時刻を 22:00 UTC 以降に動かす必要がある。そのうえで、per-daily の時刻の窓（compute-only・push 禁止）と Worker の Cron を一緒に変えることになる。これは Mulmo の担当範囲なので、本設計の範囲外とする（必要なら Issue で提案する）。§9 Q2。

## 7. デプロイと確認

### 7.1 PR1 マージ後（PM・クラウドから）
1. その日の `data: daily PER <D>` コミット（20:00 UTC 以降）が main にある時間帯（例：23:30 UTC）に、PM が `per-daily.yml` を workflow_dispatch で起動する（入力なし）。
   - **合格**: result=skipped・already-written=true・新しいコミットが無い・Issue が変わらない。
   - 前の run が実行中なら、終わるのを待ってから起動する。
2. 次の日の予備の schedule run（23:0x）も、同じく skipped になることを確かめる（PR2 のデプロイ前なら、その日は schedule が書くので write になり、`per-daily-late` が開く。PR2 のデプロイ後の最初の正常日に閉じる）。
   - **注意**: PR1 と PR2 の間が 1 日以上空くと、その間は毎日 `per-daily-late` が開いたままになる。PR1 マージ後、なるべく早く PR2 をデプロイする。

### 7.2 PR2 マージ後（Mac セッション＝Toshio の依頼時。T0 の後）
- Mac セッションへの prompt は自己完結で書く。内容は次のとおり。
  - 目的
  - コマンド: `cd ~/GitHub/portfolio && git pull --ff-only && cd worker && npx wrangler deploy`
  - 合格の基準: デプロイの出力に schedule `0 1,8,15,22 * * *` と `20 20 * * *` の両方が出る。`curl -sS https://portfolio-proxy.shoulang.workers.dev/` が `portfolio-proxy OK`
  - 失敗時の戻し方: `npx wrangler rollback`
  - 結果のコメント先: #708。書くのは成否・HTTP ステータス・schedule の一覧だけ
  - 禁止: secret の操作・ファイル編集
- 初回の 20:20 UTC の後に、PM がクラウドから確認する。
  1. `gh api repos/shoulang0729/portfolio/actions/workflows/per-daily.yml/runs?per_page=5` に、`event=workflow_dispatch` の run が **20:20〜20:25 UTC に作成**されている。
  2. その run が result=write で終わり、main に `data: daily PER <D>`（github-actions[bot]）が **21:00 UTC より前**に入っている。
  3. その夜の予備の schedule run が result=skipped で、2 つ目のコミットが無い。
  4. `per-daily-late` が開いていたなら、2 の run で閉じている。
- 1 が無いとき: Toshio が Cloudflare ダッシュボードの Cron イベントで失敗の内容を見る（401/403 なら T0 のトークンの権限・リポの指定、404 ならリポ・ファイル名、Cron 自体が無ければデプロイ）。必要なら `npx wrangler rollback`（予備の schedule があるので、戻してもデータは止まらない）。

## 8. 受け入れ条件

### 共通
- [ ] 品質ゲート green: vitest / eslint / prettier / check:types / check:circular（e2e は UI 変更なし）。
- [ ] UI の変更が無いので `index.html` の `?v=` は bump しない。
- [ ] 公開リポ検査: トークン・金額・口座の情報が差分・テスト・ログ出力に無い。テストのトークンは合成値。

### PR1
- [ ] `isAlreadyWritten` が §3.1(a) の表の 7 例どおりに判定する（テストあり）。`isOnTimeStart` の境界 19:59 / 20:00 / 20:54 / 20:55 のテストがある。
- [ ] 20:00 UTC 以降に当日分（bot・件名完全一致）があると、per-daily は計算・push をせず result=skipped。per-daily-failed Issue は変わらない。ジョブは green。
- [ ] `force=true` の手動起動は書き込み済みでも書く。
- [ ] 予備の schedule が定刻外（20:00〜20:54 以外）に書くと `per-daily-late` が開く。定刻内に書くと閉じる。
- [ ] コミットの形（`data: daily PER <UTC日付>`・github-actions[bot]）・`runMode`・`isPushBlocked`・Guard・kv-resync は変わっていない。
- [ ] Secrets の参照が増えていない（`GITHUB_TOKEN` のみ）。

### PR2
- [ ] `wrangler.toml` の crons が `["0 1,8,15,22 * * *", "20 20 * * *"]`。
- [ ] `20 20 * * *` の Cron では、`POST …/actions/workflows/per-daily.yml/dispatches`（`{"ref":"main"}`）だけを呼び、KV・Finnhub・注文表・スナップショットに触れない。
- [ ] 204 で成功。429/5xx/ネットワークエラーは計 3 回まで再試行。401/403/404/422 は再試行しない。最終的に失敗したら throw する。
- [ ] `GH_DISPATCH_TOKEN` が無ければ fetch しないで throw する。トークンはログに出ない。
- [ ] 既存の Cron（と `event.cron` が無い呼び出し）の動きが変わらない（既存の `tests/worker-order-sheet.test.js` が green）。
- [ ] HTTP ルートを足していない。
- [ ] CLAUDE.md の書き手の表・Cron・Worker Secrets が §3.2(d) のとおり。
- [ ] PR 本文に「マージ後に Worker のデプロイが必要（Mac セッション可）・T0 のトークン準備が先」と書いてある。

## 9. 要 Toshio 判断（既定で設計済み・変えたければ指示）
- **Q1 トークン**: 既定は「起動専用の Worker Secret `GH_DISPATCH_TOKEN`（fine-grained・portfolio のみ・Actions: Read and write だけ）を新しく作る」。代替案は既存の `GITHUB_TOKEN` を使うこと（§3.0）。既存トークンが今も有効かは不明。main への Worker のスナップショット書き込みは 2026-05 下旬から止まっている。
- **Q2 冬時間**: 既定は通年 20:20 UTC（2026-11-02〜2027-03-13 は引けの 40 分前の値。phase15 §10-1 と同じ考え方）。引け後の値がほしいなら、Mulmo の時刻の変更を別に提案する必要がある。
- **Q3 予備の schedule**: 既定は `15 20 * * *` のまま残し、書き込み済みならスキップする。消す案もある。ただしその場合、Worker が失敗した日は PER が更新されないまま、翌日まで気づきにくい。

## 10. 触ってはいけない範囲
- `data: daily PER <YYYY-MM-DD>` の形・author・`--allow-empty` の運用（Mulmo が文字列一致で判定する）。
- `runMode`（20:55〜22:30 は compute-only）・`isPushBlocked`（21:00〜22:30）・Guard（§6.3 の許可フィールド）・kv-resync の流れ・per-daily-failed／kv-resync-failed の Issue の動き。
- `data/valuations.json` のキー・形状、投資判断の正本値（`score()` の閾値・%タイル・`fund-per` の加重）。
- concurrency group `portfolio-data-batch`・`cancel-in-progress: false`。
- Worker の既存の Cron の処理（価格キャッシュ・注文表の約定・スナップショット）、`GITHUB_TOKEN` の使い方、認証・CORS・レート制限。
- `docs/briefing-generation-spec.md`（Mulmo の正本）。Mulmo 側の判定は変わらないので、変更の提案も不要。

## 11. ブランチ / PR / Issue
- PR1: ブランチ `ci/per-daily-already-written`（base=`main`）。タイトル `ci(per-daily): 当日分が書き込み済みならスキップ＋per-daily-late 通知（#708 PR1）`。本文は **`Refs #708`**。`needs-toshio`（`.github/workflows/**`）。
- PR2: ブランチ `feat/worker-per-daily-dispatch`（base=`main`・PR1 マージ後に作る）。タイトル `feat(worker): Cron 20:20 UTC から per-daily を workflow_dispatch で起動（#708 PR2）`。本文は **`Closes #708`**。`needs-toshio`（`worker/**`・トークン・`CLAUDE.md`）。マージ後にデプロイ（§7.2）。
- 順序: **PR1 → PR2**。PR1 が先に入っていないと、Worker の起動と予備の schedule が毎日 2 回書く。T0 は PR2 のデプロイ前ならいつでもよい。

## 12. 未解決の別件（本 Issue の範囲外・Issue 化を推奨）
- Worker Cron のスナップショット（`data/portfolio-snapshot.json`）と positions のミラー（`data/positions.json`）の main への書き込みが、2026-05〜06 から止まっている。`docs/handoff/2026-10-04-history-rewrite.md` の表は「動いている」前提で書かれている。止まった理由（KV positions・`FINNHUB_API_KEY`・`GITHUB_TOKEN` のどれか）と、続けるか（公開リポに金額を書く経路）を別の Issue で決める。
