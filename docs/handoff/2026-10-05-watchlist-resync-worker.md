# Handoff: KV ウォッチリストの同期を Worker が公開データから行う／`PUT /watchlist` を PIN 必須にする（#715・#647）

- **Issue**: #715 `Worker: ウォッチリスト保存（PUT /watchlist）の認証を、kv-resync の扱いと合わせて決める`／#647 `fix: kv-resync.mjs のドリフト判定が3項目だけ → note・bandConfidence 等の更新がKVに届かない`
- **難易度**: medium〜hard（Worker の新ルート・Actions の書き込み経路の切り替え・認証の変更・アプリの未ログイン時の挙動を順番に入れる）
- **分担**: 設計＝architect（本 doc）／実装＝implementer／レビュー＝reviewer／Worker のデプロイ＝Mac セッション（Toshio の依頼時）または Toshio
- **区分**: 確定（2026-10-05 Toshio 決定「Worker が公開データを自分で取りに行く」＝#715 の選択肢 C の一形態）。§10 の「要 Toshio 判断」は推奨の既定で設計済み
- **Toshio 確認**: **要**（PR1＝#652 §11 の例外の承認、PR2・PR5＝`worker/**` の認証・レート制限、PR3＝`.github/workflows/**`・KV 書き込み経路、PR5＝`CLAUDE.md`）。PR4（アプリのみ）は不要

## 実装ログ（implementer が更新）
- [ ] PR1（#647 比較の全項目化）#____ / マージ ____
- [ ] PR2（Worker `POST /watchlist/resync`）#____ / マージ ____ / デプロイ ____ / curl 検証（§8.2）____
- [ ] PR3（`kv-resync.mjs` を POST に切り替え）#____ / マージ ____ / `kv-resync.yml` の手動実行 sync・check（§8.3）____ / 翌日の per-daily 後の同期 ____
- [ ] PR4（アプリ: 未ログイン時はローカルのみ）#____ / マージ ____ / Pages 反映 ____
- [ ] PR5（`PUT /watchlist` を PIN 必須）#____ / マージ ____ / デプロイ ____ / curl 検証（§8.5）____

---

## 0. 決定事項（前提）
1. **2026-10-05 Toshio 決定**: KV `watchlist` の valuation 同期は、Actions が KV の中身を組み立てて `PUT` するのではなく、**Worker が公開リポの `data/valuations.json`（main）を自分で取りに行き、KV にマージする**。Actions は「同期して」と頼むだけ（本文なし）。
2. その後で `PUT /watchlist` を `/positions` と同じ PIN 必須（`X-Pin-Hash`）にする。GitHub Secrets は増やさない（#715 選択肢 A は採らない）。
3. #647（比較が `perCurrent`/`status`/`asOf` の 3 項目だけ）を同じ流れで直す。比較は **valuation オブジェクト全体・キー順に依存しない**。ただしこの比較キーは #652 設計書 §11 で「投資判断の正本値」として固定されているため、**§11 の例外として Toshio の承認が要る**（§10 Q1。推奨＝承認）。
4. Mulmo は `GET /watchlist` と `GET /yahoo` だけを呼び、`PUT /watchlist` は呼ばない（`docs/interfaces.md` §3・#724 の Mulmo ワークスペース調査）。**Mulmo 側の変更は不要**（§9）。

## 1. 背景・ゴール

### 1.1 背景
- `PUT /watchlist` は認証なし（Origin ゲートのみ・Origin 無しのリクエストは通る）。#714 で PIN 必須にする予定だったが、`kv-resync.mjs`（`kv-resync.yml`・`per-daily.yml`・`weekly-valuations.yml` から実行）が PIN なしで PUT しているため見送った（#715）。
- アプリも同じ `PUT /watchlist` を使い、PIN があれば `X-Pin-Hash` を付け、無くても送る（#714 の暫定・`src/watchlist.js` `_syncWatchlistToWorker`）。
- `kv-sync.mjs` のドリフト判定が 3 項目だけなので、`note`・`bandConfidence` などだけが変わった銘柄が KV に届かない（#647）。マージ自体は正本のエントリ全体を `valuation` に入れているので、**直すのは「ズレの検出」だけ**で、書き込む値は変わらない。

### 1.2 ゴール
- Actions が KV に書く内容を自分で組み立てない。Worker は「公開 main の `valuations.json` を KV の `valuation` に写す」ことしかしない新ルートを持ち、これは本文・パラメータを一切受け取らない。
- その結果、`PUT /watchlist` を PIN 必須にできる（ブラウザ以外から任意の配列で上書きできる状態をなくす）。
- `valuation` の全項目の差分が KV に届く（#647）。
- 未ログインのアプリでのウォッチリスト編集は、端末内（localStorage）だけに残り、ログイン後に同期される。

### 1.3 用語
- **正本**: main の `data/valuations.json` の `valuations`（シンボル → エントリ）。
- **同期の意味（変えない）**: KV の配列の各要素のうち、正本にシンボルがある要素だけ `valuation` を正本のエントリで丸ごと差し替える。他のフィールド（`name` など）は保持。配列の形と並び順を保つ。正本に無い銘柄（債券・取得不可）は据え置き。**銘柄の追加・削除はしない**。

## 2. 全体の流れ（変更後）

```
Actions（kv-resync.mjs）                  Worker                               GitHub（公開・読むだけ）
  GET /watchlist → 手元の正本と比較
  ズレ 0 → noop で終了
  ズレあり → POST /watchlist/resync ───→  ① main の先頭コミット SHA を取得 ──→ api.github.com（commits/main）
                                         ② SHA 固定で valuations.json を取得 → raw.githubusercontent.com/<SHA>/…
                                         ③ KV を読み、全項目比較でズレを算出
                                         ④ ズレがあればマージして KV に書く（無ければ書かない）
            ←──────────────────────────  { ok, stage, drift, symbols, sha }
  GET /watchlist（read-back）→ 正本（sha が違えばその sha の正本）と比較 → OK/NG
```
- Worker の Cron（`0 1,8,15,22 * * *`）でも ①〜④ を実行し、アプリの PUT が古い `valuation` で上書きした場合などを自己修復する（§10 Q3・推奨＝入れる）。

## 3. 対象ファイル一覧

| ファイル | PR | 状態 | 内容 |
|---|---|---|---|
| `data/scheduler/lib/kv-sync.mjs` | PR1 | 変更 | 比較を全項目・キー順非依存にする（`normValuation` を置換）。Worker からも import できるよう Node 依存を入れない（今も無い） |
| `tests/kv-sync.test.js` | PR1 | 変更 | 比較のテストを全項目版に |
| `worker/src/routes-kv.js` | PR2・PR5 | 変更 | PR2: `handleWatchlistResync` と同期の中核関数 `resyncWatchlistFromMain(env)` を追加。PR5: `PUT /watchlist` に `verifyPinHash` |
| `worker/src/index.js` | PR2・PR5 | 変更 | ルート追加・レート制限の対象追加・冒頭コメントのルート一覧 |
| `worker/src/cron.js` | PR2 | 変更 | `0 1,8,15,22` の回で `resyncWatchlistFromMain` を独立に実行 |
| `worker/wrangler.toml` | PR2 | 変更 | 専用の ratelimit binding `RESYNC_LIMITER` を追加（§4.4） |
| `worker/src/rate-limit.md` | PR2 | 変更 | 新 binding の記述 |
| `tests/worker-routes-contract.test.js` | PR2・PR5 | 変更 | ルート表・レート制限の対象表・新ルートの契約・PUT の PIN |
| `tests/worker-watchlist-resync.test.js` | PR2 | 新規 | 新ルートと Cron の単体テスト（fetch・KV はモック・合成値） |
| `tests/worker-route-auth.test.js` | PR5 | 変更 | `/watchlist` の PUT を PIN 必須に |
| `data/scheduler/kv-resync.mjs` | PR3 | 変更 | PUT をやめ `POST /watchlist/resync` を呼ぶ。read-back の比較先を §5.3 のとおりに |
| `tests/kv-resync.test.js` | PR3 | 新規（または既存に追加） | `workerFetch` をモックして通常・check・json・read-back・sha ずれの各経路 |
| `.github/workflows/kv-resync.yml`・`per-daily.yml`・`weekly-valuations.yml` | PR3 | 変更（コメントのみ） | 「Worker 中継口 /watchlist を叩くだけ」等の説明を「`POST /watchlist/resync` で Worker に同期させる」に。**ステップの中身・コマンド行・出力の扱いは変えない** |
| `src/watchlist.js` | PR4 | 変更 | 未ログイン時はローカルのみ・保留フラグ・ログイン後の同期（§6） |
| `tests/front-pin-header.test.js` | PR4 | 変更 | 「PIN が無くても送る」テストを「送らない・保留する」に |
| `index.html` | PR4 | 変更 | `?v=` bump |
| `docs/interfaces.md` | PR2・PR3・PR5 | 変更 | §3 の表に新ルート、`/watchlist` PUT の認証、§4.2 の `kv-resync.yml` の行（比較が全項目・Worker 経由） |
| `CLAUDE.md` | PR5 | 変更 | 「データの書き手」の KV `watchlist` の行と「Worker」節のルート要約（§7.5） |

## 4. PR2: Worker `POST /watchlist/resync`

### 4.1 ルートの契約

| 項目 | 内容 |
|---|---|
| パス・メソッド | `POST /watchlist/resync`。他のメソッドは 405（`OPTIONS` は既存のプリフライト処理） |
| 認証 | なし（Origin ゲートは既存どおり。許可外 Origin は 403、Origin 無しは通る）。理由は §4.5 |
| リクエスト | **本文・クエリを読まない**（送られても無視する。`request.json()` を呼ばない） |
| 成功 200 | `{ ok: true, stage: 'noop' \| 'resynced', drift: <数>, symbols: [<シンボル>…], sha: '<40桁>' }`。`noop`＝ズレ 0 で KV に書かなかった |
| 失敗 | 429（レート制限）／500 `KV 未設定`／502 `{ error, stage }`（`stage` は `sha`・`fetch`・`parse`・`validate` のいずれか。上流の応答本文は返さない・ログにも出さない） |
| 出すもの | シンボル・件数・SHA・HTTP ステータスだけ（シンボルは `GET /watchlist` で公開済み）。KV の本文・正本の値は応答にもログにも出さない |

### 4.2 処理（`resyncWatchlistFromMain(env)`・ルートと Cron で共通）
1. **SHA の取得**: `GET https://api.github.com/repos/shoulang0729/portfolio/commits/main`、ヘッダ `Accept: application/vnd.github.sha`（本文が 40 桁の SHA だけになる）・`User-Agent: portfolio-proxy-worker`・`X-GitHub-Api-Version: 2022-11-28`。トークンがあれば `Authorization: Bearer <GH_DISPATCH_TOKEN || GITHUB_TOKEN>` を付ける（読むだけ・§10 Q2）。タイムアウト 10 秒・429/5xx/ネットワークエラーは計 3 回（2s→4s）。本文が `/^[0-9a-f]{40}$/` でなければ 502 `stage:'sha'`。Cloudflare 側でキャッシュしない（`cache: 'no-store'` 相当。`cf.cacheTtl` を付けない）。
2. **正本の取得**: `GET https://raw.githubusercontent.com/shoulang0729/portfolio/<SHA>/data/valuations.json`。SHA 固定の URL は内容が変わらないので、CDN のキャッシュ遅れ（`main` を指す URL では最大 5 分程度）の影響を受けない。タイムアウト 15 秒・同じリトライ。200 以外は 502 `stage:'fetch'`。本文が 2 MB を超えたら 502 `stage:'fetch'`（現在は約 0.1 MB）。
   - **`main` の URL へのフォールバックはしない**（数分古い内容で KV を巻き戻すおそれがあるため。SHA が取れなければ失敗にして、呼び出し側の read-back と失敗 Issue で見えるようにする）。
3. **検証**: JSON として読めない → 502 `stage:'parse'`。最上位がオブジェクトで、`valuations` がオブジェクト（配列でない）、各エントリがオブジェクト（null・配列でない）でなければ 502 `stage:'validate'`。`valuations` が空なら 502 `stage:'validate'`（正本が壊れたときに「同期済み」と返さない）。
4. **KV の読み込み**: `KV.get('watchlist')`。無い・空なら `[]` として扱い、`noop`（銘柄を足さないので書くものが無い）。配列でなければ 502 ではなく 500 `{ error:'KV の watchlist が配列ではありません', stage:'kv' }` で書かない。
5. **ズレの算出**: `findDrift(kv, valuations)`（PR1 の全項目比較・`data/scheduler/lib/kv-sync.mjs` を import。§4.3）。0 件なら `{ ok:true, stage:'noop', drift:0, symbols:[], sha }`。
6. **書き込み**: `mergeValuations(kv, valuations)` を `KV.put('watchlist', JSON.stringify(merged))`。書く直前に `KV.get('watchlist')` を読み直し、手順 4 の文字列と違えば（アプリの PUT と重なった）読み直した配列で手順 5〜6 を 1 回だけやり直す（2 回目も違えば、その時点の内容でマージして書く）。応答 `{ ok:true, stage:'resynced', drift:n, symbols, sha }`。
7. **書かないもの**: `watchlist` 以外の KV キー。`valuation` 以外のフィールド。正本に無い銘柄の要素。

### 4.3 マージ・比較のコードを 1 か所にする
- Worker は `worker/src/routes-kv.js` から `../../data/scheduler/lib/kv-sync.mjs` の `findDrift`・`mergeValuations` を import する（wrangler の esbuild が相対パスを束ねる。`data/scheduler/quality-*.mjs` が `../../src/…` を import している前例と同じ向きの共有）。**Actions と Worker で比較・マージの実装を二重に持たない**。
- `kv-sync.mjs` に Node 専用の import（`fs`・`path` 等）を入れないことをテストで固定する（ファイル本文に `from 'fs'`・`from 'node:` が無いことを検査）。
- `cd worker && npx wrangler deploy --dry-run --outdir <tmp>` がクラウドで動くなら PR で実行して束ね結果に `findDrift` が含まれることを確かめる。動かなければ Mac のデプロイ時に確認する（§8.2）。

### 4.4 レート制限
- 専用の ratelimit binding `RESYNC_LIMITER`（`worker/wrangler.toml` の `[[unsafe.bindings]]`・`type = "ratelimit"`・新しい `namespace_id`（既存 `1001` と別の値）・`simple = { limit = 10, period = 60 }`・IP 単位）。値は §10 Q4（推奨 10 回/60 秒）。
- 判定は既存のレート制限と同じ場所（`index.js`・ルート処理より前）。`RESYNC_LIMITER` が無い環境では `RATE_LIMITER` を使い、どちらも無ければ素通し。判定の例外は fail-open（既存どおり）。超過は 429。
- `kv-resync.mjs` の呼び出しは 1 回の実行で最大 9 回（POST 5 回＋§5.3 の再実行 4 回・間隔 2 秒以上と 15 秒）なので 10/60 秒に収まる。

### 4.5 認証なしで公開してよい理由（設計判断）
- 入力は「公開リポ main の `data/valuations.json`」だけで、URL・リポ・ブランチ・ファイルは Worker に固定されている。呼び出し側は本文・クエリ・SHA を指定できない（古いコミットを指定して KV を巻き戻すこともできない）。
- 書く内容は「誰でも GitHub から読める値」を `valuation` に写したものだけ。銘柄の追加・削除・`name` 等の変更はできない。結果は（main の内容, KV の内容）で決まり、冪等（同期済みなら書かない）。
- したがって悪用しても起きるのは「KV が main と一致する」ことだけで、これは本来の望ましい状態。残る影響は外部呼び出しの消費（GitHub API の回数・KV の読み）で、§4.4 のレート制限で抑える。KV の書き込みはズレがあるときだけなので、連打しても書き込み回数は増えない。
- 現在の `PUT /watchlist`（任意の配列で上書きできる）と比べ、外部から変えられる範囲は狭まる。PR5 で PUT を閉じた後は、ブラウザ以外から KV `watchlist` を変える手段はこのルート（＝main と一致させる）と PIN 付き PUT だけになる。

### 4.6 Cron
- `worker/src/cron.js` の `scheduled` の `0 1,8,15,22` の回（価格キャッシュ・注文表の約定の回）で、`resyncWatchlistFromMain(env)` を **他の処理と独立の try/catch** で実行する。失敗しても既存処理を止めない。ログはステージと件数だけ（`[cron watchlist-resync] noop 0` など）。
- `20 20,21`（per-daily の起動）の回では実行しない。
- 価格キャッシュの `if (!env.KV || !env.FINNHUB_API_KEY) return;` より**前**に置く（Finnhub キーの有無と無関係に動かす）。

### 4.7 PR2 の受け入れ条件
- [ ] 品質ゲート green（`npm test`・`npm run lint`・`npm run check:types`・`npm run check:circular`・`npm run build`）。`dist/app.js` を含めない（アプリは変えないので `?v=` の bump も不要）
- [ ] 契約テスト: `POST /watchlist/resync` → 200（合成の正本・KV で `resynced`、もう一度で `noop`）／`GET`・`PUT`・`DELETE /watchlist/resync` → 405／KV 無し → 500／SHA 取得失敗・正本 404・JSON 不正・`valuations` が配列 → 502 で `KV.put` を呼ばない
- [ ] 本文に任意の JSON（例: 銘柄を足した配列）を送っても結果が本文なしと同じ（本文を読まない）
- [ ] マージの意味: 正本にある銘柄だけ `valuation` が置き換わる／`name` 等は保持／正本に無い銘柄は据え置き／要素数と並び順は不変／銘柄が増えない
- [ ] 書く直前の読み直しで KV が変わっていたら、読み直した内容に対してマージする（テストで KV.get の 2 回目に別の配列を返す）
- [ ] raw の URL が SHA 固定（`/main/` を含まない）であること・`main` へのフォールバックが無いこと
- [ ] `RESYNC_LIMITER` の超過で 429・GitHub に fetch しない。`tests/worker-routes-contract.test.js` の `RATE_LIMITED_PATHS` に `/watchlist/resync` を追加
- [ ] Cron `0 1,8,15,22` で実行され、失敗しても価格キャッシュ・約定確定が続く。`20 20,21` では実行しない
- [ ] 応答・ログに KV の本文・正本の値・トークンが出ない（テストで `console.*` をスパイし、合成値の数値・トークン文字列が含まれないこと）
- [ ] `PUT /watchlist` の挙動は変えない（この PR では認証なしのまま）
- [ ] `worker/src/index.js` 冒頭のルート一覧・Binding・Cron の説明、`worker/src/rate-limit.md`、`docs/interfaces.md` §3 の表を更新

## 5. PR3: `kv-resync.mjs` を Worker 経由に切り替える

**前提**: PR2 が Worker にデプロイされ、§8.2 の curl 検証が通っていること。

### 5.1 変えないもの（#647・§2.1 の約束）
- ファイル名・CLI 引数（引数なし＝同期／`--check`／`--json`）・exit コード（成功 0／失敗 1／`--check` でズレあり 3）・`--json` の 1 行 JSON の形 `{ ok, stage, drift, symbols, msg }` と **stage の値の集合**（`read-valuations`・`get`・`check`・`noop`・`put`・`readback-get`・`readback-verify`・`resynced`・`unexpected`）。
  - `put` は名前を変えず、意味を「Worker への同期要求（`POST /watchlist/resync`）が 5 回とも失敗」にする（msg は `同期要求 5回全滅(最終http=…)`）。名前を変えるとワークフローのサマリ・失敗 Issue のタイトルの見え方が変わるため。
- `GET /watchlist` 最大 3 回・同期要求は最大 5 回リトライ・read-back 検証に失敗したら exit 1。
- `--check` は今までどおり手元の正本（checkout した main の `data/valuations.json`）と `GET /watchlist` の比較だけ（Worker に同期を頼まない）。
- 3 本のワークフローの実行行（`node data/scheduler/kv-resync.mjs --json`／`--json --check`）とその後の処理。

### 5.2 通常モードの手順
1. 手元の正本を読む（失敗 → `read-valuations`・exit 1）。
2. `GET /watchlist`（失敗 → `get`・exit 1）。`findDrift`（全項目）で 0 件なら `noop`・exit 0（**同期要求を送らない**）。
3. `POST /watchlist/resync`（本文なし）を最大 5 回。HTTP 200 かつ `ok === true` で成功。成功時の応答の `sha` を控える。5 回とも失敗 → `put`・exit 1。
4. read-back（§5.3）。OK → `resynced`（drift・symbols は手順 2 の値）・exit 0。

### 5.3 read-back の比較先（main が先に進んでいる・Worker が遅れている場合）
- 期待する SHA＝手元の `git rev-parse HEAD`（`per-daily`・`weekly` では push した直後のコミット、`kv-resync.yml` では checkout した main）。取れなければ（git が無い環境）SHA の判定を省いて手元の正本と比べる。
- (a) 応答の `sha` が期待と同じ → `GET /watchlist` を手元の正本と比べる。ズレ 0 で OK。
- (b) 違う → `git fetch --quiet --depth=50 origin main` のあと `git merge-base --is-ancestor <期待> <応答sha>`：
  - 真（Worker の方が新しい＝main が進んだ）→ `git show <応答sha>:data/valuations.json` を正本として read-back を比べる。
  - 偽（Worker が古い main を見た＝GitHub API の反映遅れ）→ 15 秒待って手順 3 を 1 回だけ行い (a)/(b) をやり直す。これを最大 4 回。最後まで遅れたまま → `readback-verify`・exit 1（msg `Worker が古い main を参照(sha 先頭7桁)`）。
  - `git fetch`・`merge-base` 自体が失敗 → 手元の正本と比べる（従来どおりの厳しい判定。ズレれば exit 1）。
- read-back の GET 失敗 → `readback-get`・exit 1。ズレが残る → `readback-verify`・exit 1（従来どおり）。
- ログ・JSON に出すのは SHA の先頭 7 桁・シンボル・件数・HTTP コードだけ。

### 5.4 ワークフロー
- 3 本とも**ステップの中身は変えない**。冒頭・ステップのコメントの「Worker 中継口 /watchlist を叩くだけ」「PUT」を「`POST /watchlist/resync` で Worker に同期させる（本文なし・Secrets 不要）」に直すだけ。`kv-resync.yml` の `permissions`・`concurrency`・失敗 Issue の処理も不変。
- `kv-resync.yml` の checkout は `fetch-depth` 既定（1）のままでよい（§5.3 で必要な分だけ fetch する）。

### 5.5 PR3 の受け入れ条件
- [ ] 品質ゲート green。`tests/per-daily.test.js` の `kv-resync.mjs --json`・`kv-resync-failed` の検査がそのまま通る
- [ ] テスト（`workerFetch` と git 呼び出しをモック・合成値）: ズレ 0 → POST を呼ばず `noop` exit 0／ズレあり → POST 1 回・read-back OK で `resynced` exit 0／POST 5 回失敗 → `put` exit 1／read-back にズレ → `readback-verify` exit 1／応答 sha が新しい → その sha の正本で判定／sha が古い → 15 秒待って再要求（タイマーはモック）・4 回で失敗
- [ ] `--check`: `note` だけ違う銘柄で exit 3（#647 の受け入れ条件 1）・完全一致で exit 0。PUT も POST も呼ばない
- [ ] `--json` の出力の形・stage の値の集合が変わらない（#647 の受け入れ条件 4）
- [ ] `kv-resync.mjs` に `method: 'PUT'` が残っていない
- [ ] マージ後、`kv-resync.yml` を workflow_dispatch で `check` → `sync` の順に実行し、両方 success（§8.3）

## 6. PR4: アプリ — 未ログイン時はウォッチリストを端末内だけに保存する

### 6.1 方針
- 「ログイン済み」＝`_getActivePinHash()` が値を返す（`positions-store.js` と同じ判定。この端末で PIN を設定済み）。
- ログイン済みなら今までどおり 1 秒の debounce で `PUT /watchlist`（`X-Pin-Hash` 付き）。
- 未ログインなら **PUT を送らない**。localStorage には今までどおり保存し、保留フラグ `hm-watchlist-pending`（値 `'1'`）を立てる。
- 送ったが 401・428・ネットワークエラー・5xx のときも保留フラグを立てる（ローカルは保存済み）。200 で保留を消す。

### 6.2 読み込み（`_loadWatchlistFromWorker`）
今は KV の配列で必ずローカルを上書きするため、未ログインの編集が次に Historical タブを開いた時点で消える。次のように変える。
| 状態 | 動作 |
|---|---|
| 保留なし | 従来どおり KV の配列でローカルを置き換える（KV が空のときの初期シード・スナップショット復元も従来どおり。ただし送信は §6.1 に従う） |
| 保留あり・KV の取得成功 | **銘柄の並び・追加・削除はローカルを採用**し、各銘柄の `valuation` だけ KV の同じシンボルの要素から取る（KV に無い銘柄はローカルのまま）。ログイン済みならこの内容で PUT（成功で保留を消す）、未ログインなら保留のまま |
| 取得失敗 | 従来どおりローカルをそのまま使う |

- KV の `valuation` を取り込むのは、PUT が古い `valuation` で KV を上書きしないため（上書きしても §4.6 の Cron で直るが、無駄な巻き戻りを避ける）。

### 6.3 表示（文言は既存の `setStatus` を使う・新しい UI 部品は作らない）
- 未ログインで編集した直後: `setStatus('ウォッチリストはこの端末にだけ保存しました（PIN ログイン後に同期します）', 'yellow')`。同じ文言を連続して出さない（1 回の debounce につき 1 回）。
- 401・428: `setStatus('ウォッチリストを同期できませんでした（PIN を確認してください・この端末には保存済み）', 'yellow')`。
- その他の失敗: 既存の文言のまま。
- PIN ログイン（キーパッドの成功・パスキー成功）の直後に保留があれば同期を 1 回試みる。ログイン成功の通知点は `src/auth-ui.js` の既存の処理の中にあるが、**`auth-*.js` を変えると Toshio 確認対象になる**ため、この PR では auth 側を変えず、`watchlist.js` 側で「Historical タブを開いたとき（`_loadWatchlistFromWorker`）」と「次の編集時」に同期する。ログイン直後に即同期したい場合は別 Issue（§10 Q5）。

### 6.4 PR4 の受け入れ条件
- [ ] 品質ゲート green・E2E green（`e2e/helpers.js` の `/watchlist` モックで未ログインの起動が従来どおり描画される）
- [ ] `index.html` の `?v=` を CSS・JS・SW 登録 URL すべて同じ値に bump
- [ ] `tests/front-pin-header.test.js`: 未ログインで `saveWatchlist()` → fetch を呼ばない・`hm-watchlist-pending` が `'1'`／ログイン済み → `X-Pin-Hash` 付き PUT・200 で保留が消える／401 → 保留が残る
- [ ] 保留ありで `_loadWatchlistFromWorker()` → ローカルの銘柄構成が残り、`valuation` は KV の値になる（合成値）／保留なしなら KV で置き換え（従来どおり）
- [ ] data-action・escapeHTML・CSS 変数の規約に違反しない（UI 部品は増やさない）
- [ ] Worker 側（PR5 前）は PIN 無しでも受け付けるので、この PR 単体で既存の利用者の動作は「未ログインなら KV に送らない」以外変わらない

## 7. PR5: `PUT /watchlist` を PIN 必須にする

**前提**: PR3 がマージされ、PR3 経路での同期が 1 回以上成功（`kv-resync.yml` の手動 sync か、per-daily の push 後）。PR4 がマージされ Pages に反映済み。

### 7.1 変更
- `handleWatchlist` の PUT の先頭（本文を読む前）で `verifyPinHash(request, env, origin)`。無し・不一致 401、PIN 未設定 428（`/positions` と同じ）。本文の検証・保存・応答は不変。
- `GET /watchlist` は公開のまま（Mulmo・アプリの未ログイン表示・`kv-resync.mjs` が使う）。
- コメント更新: `routes-kv.js` の `// PUT: 現状は認証なし…`、`index.js` 冒頭のルート一覧。

### 7.2 テスト
- `tests/worker-routes-contract.test.js`: `['PUT','/watchlist',{ body }]` を `pin: null` → 401／`pin:'bad'` → 401／`pin:'ok'` → 200／`pin:'ok', kv:{}`（PIN 未設定）→ 428／`pin:'ok'` で本文不正 → 400 に置き換える。`PUT /watchlist は KV watchlist に保存し {ok:true}` のテストに PIN を付ける。
- `tests/worker-route-auth.test.js` の describe「/watchlist（今回は従来どおり）」を「GET は公開・PUT は PIN 必須」に変える。

### 7.3 古いキャッシュのアプリ
- #714 以降のアプリはログイン済みなら `X-Pin-Hash` を送るので影響なし。
- 未ログインの古いアプリの PUT は 401 になり「保存に失敗しました（ローカルには保存済み）」が出る。その編集は次の読み込みで KV に上書きされて消える（PR4 前のアプリの挙動。共有の KV を未ログインで変えられないことが目的なので許容）。

### 7.4 PR5 の受け入れ条件
- [ ] 品質ゲート green
- [ ] `PUT /watchlist` が PIN 無し・不一致で 401、PIN 未設定で 428、一致で 200（本文の検証は従来どおり 400）
- [ ] `GET /watchlist`・`POST /watchlist/resync` は認証なしのまま
- [ ] `grep -rn "method: 'PUT'" data/scheduler` に `/watchlist` への PUT が無い（PR3 で除去済みの確認）
- [ ] `docs/interfaces.md` §3（`/watchlist` PUT の認証＝`X-Pin-Hash`・呼び出し元＝アプリのみ）・§4.2、`CLAUDE.md`（§7.5）を更新

### 7.5 CLAUDE.md の更新（PR5・Toshio 確認）
- 「データの書き手」表の KV `watchlist` の行を次にする:
  `KV watchlist` ｜ アプリ（PIN 必須の `PUT /watchlist`）と Worker（`POST /watchlist/resync`＝公開 main の `data/valuations.json` の `valuation` を写す。GitHub Actions `kv-resync.yml`（`data/scheduler/kv-resync.mjs`・`data/valuations.json` の push 時と毎日 23:30 UTC。`per-daily.yml`・`weekly-valuations.yml` も push 後に実行）と Worker Cron `0 1,8,15,22` が起動）
- 「Worker」節の「KV データ」の要約に `/watchlist/resync`（POST・公開データの写しのみ）を足し、`/watchlist` の注記を「GET は公開・PUT は PIN 必須」にする。Cron の表の `0 1,8,15,22` に「KV `watchlist` の valuation を main に同期（ズレ時のみ書く）」を足す。binding に `RESYNC_LIMITER` を足す。
- 見出し名は変えない（refactor 計画 §2.1）。

## 8. 順序・デプロイ・確認・戻し方

### 8.1 順序
```
PR1（#647）──→ PR2（Worker ルート）─デプロイ→ PR3（kv-resync 切替）─同期1回成功→ PR5（PUT に PIN）─デプロイ
                         PR4（アプリ）は PR1 以降いつでも可。PR5 より前にマージ・Pages 反映
```
- PR1 は単独でも価値がある（今の PUT 経路でも #647 が直る）ので先に入れる。PR2 は PR1 の関数を import するので PR1 の後。
- `?v=` を上げるのは PR4 だけ。`worker/**` を含む PR（PR2・PR5）はマージ後にデプロイ（クラウドからはしない）。

### 8.2 PR2 のデプロイと確認（Mac セッション or Toshio）
1. `cd worker && npx wrangler deploy`（`RESYNC_LIMITER` の binding が出力に出ること）。
2. `curl -s -X POST -H 'Origin: https://shoulang0729.github.io' https://portfolio-proxy.shoulang.workers.dev/watchlist/resync` → HTTP 200・`ok:true`・`stage` が `noop` か `resynced`・`sha` が main の先頭と一致（`git ls-remote origin main` で照合）。
3. もう一度同じ curl → `stage:'noop'`（冪等）。
4. `curl -s -o /dev/null -w '%{http_code}' -X GET …/watchlist/resync` → 405。
5. 結果は PR に件数・ステータス・stage だけをコメント（KV の本文・金額は貼らない）。
- 失敗時: `npx wrangler rollback` で直前の版へ。ルートは誰も使っていない段階なので影響は無い。

### 8.3 PR3 の確認
1. マージ後、`kv-resync.yml` を workflow_dispatch `mode=check` → success または drift（PR1 の全項目比較で初回はズレが出てよい）。
2. `mode=sync` → success・stage が `resynced` か `noop`。もう一度 `check` → success（ズレ 0）。
3. 翌日の per-daily（または weekly）の「KV resync (after push)」ステップが成功していること。
- 失敗時: PR3 を revert（PR5 の前なら PUT 経路に戻るだけで動く）。

### 8.4 PR4 の確認
- Pages 反映後、未ログインのブラウザ（シークレットウィンドウ等）でウォッチを 1 件追加 → 黄色のステータスが出る・Network に `PUT /watchlist` が無い・再読込後も端末内に残る。ログイン済み端末では従来どおり同期される。

### 8.5 PR5 のデプロイと確認
1. `npx wrangler deploy`。
2. `curl -s -o /dev/null -w '%{http_code}' -X PUT -H 'Origin: https://shoulang0729.github.io' -H 'Content-Type: application/json' --data '[]' …/watchlist` → **401**（本文は空配列・PIN 無し。KV は変わらない）。
3. `GET /watchlist` → 200。`POST /watchlist/resync` → 200。
4. ログイン済みのアプリでウォッチを追加・削除し、保存の失敗表示が出ないこと（Toshio が目視）。
5. 直後の `kv-resync.yml` の `check` → success。
- 失敗時: `npx wrangler rollback`（PUT が認証なしに戻るだけ。PR3・PR4 はそのままで動く）。

### 8.6 戻し方のまとめ
| 戻す対象 | 方法 | 他への影響 |
|---|---|---|
| PR1 | revert | 3 項目比較に戻る（#647 再発）。PR2 以降が入っていても動く |
| PR2 | revert ＋ `wrangler rollback` | **PR3 が入っていれば先に PR3 を revert**（ルートが無いと同期が失敗する）。PR5 が入っていれば PR3 を戻しても PUT が 401 になるので、PR5 → PR3 → PR2 の順に戻す |
| PR3 | revert | PR5 デプロイ後は PUT が 401 になるため、PR5 を先に `wrangler rollback` する |
| PR4 | revert（`?v=` を再 bump） | 未ログイン端末が PUT を送るようになる（PR5 後は 401 で失敗表示） |
| PR5 | `wrangler rollback` ＋ revert | PUT が認証なしに戻る（#715 の状態） |

## 9. Mulmo への連絡
- **不要**。Mulmo は `GET /watchlist`・`GET /yahoo` だけを使い、`PUT /watchlist` も `kv-resync.mjs` も呼ばない（`docs/interfaces.md` 冒頭・§3）。`GET /watchlist` の形・公開性は変えない。
- 変わる点は「`note` 等だけが変わった銘柄の `valuation` も KV に届くようになる」ことで、Mulmo の読む値がより正本に近くなるだけ。必要なら Toshio から一言伝える程度でよい（`docs/briefing-generation-spec.md` の変更は不要）。

## 10. 要 Toshio 判断（推奨の既定で設計済み）
| # | 論点 | 推奨（既定） | 代案 |
|---|---|---|---|
| Q1 | #647: 比較キー（#652 §11 で「投資判断の正本値」として固定）を valuation 全体の比較にしてよいか | **承認**。書き込む値は今も正本のエントリ全体で、変わるのは「ズレの検出」だけ。判断の閾値・算出は一切変えない | 3 項目のまま（#647 を閉じない） |
| Q2 | Worker が main の SHA を読むときに既存の Worker Secret（`GH_DISPATCH_TOKEN`、無ければ `GITHUB_TOKEN`）を**読み取りのみ**に使ってよいか | **使う**。未認証の GitHub API は Cloudflare の共有 IP で回数制限に当たりやすい。新しい Secret は作らない | 未認証で読む（失敗しやすい）／読み取り専用の新 Worker Secret を作る |
| Q3 | Worker Cron `0 1,8,15,22` でも同期するか | **する**（アプリの PUT による巻き戻り・Actions の失敗を 1 日 4 回で自己修復。ズレが無ければ KV に書かない） | しない（Actions からの呼び出しだけ） |
| Q4 | 新ルートのレート制限 | **専用 binding 10 回/60 秒・IP 単位** | 既存の `RATE_LIMITER`（120/60 秒）に相乗り |
| Q5 | 未ログイン時の編集 | **端末内だけに保存・ログイン後（タブを開いた時・次の編集時）に同期**。auth 側の即時同期は別 Issue | 未ログインではウォッチの追加・削除 UI を隠す |

## 11. 触ってはいけない範囲
- `data/valuations.json` を含む `data/**` の中身・キー・形（本計画では読むだけ）。
- `GET /watchlist` の応答の形・公開性、`PUT /watchlist` の本文の検証と JSON 配列の要求（PR5 で足すのは PIN だけ）。
- 同期の意味（§1.3）: `valuation` だけを差し替え／他フィールド保持／配列の形と並び／正本に無い銘柄は据え置き／銘柄を足さない。
- `kv-resync.mjs` のファイル名・CLI 引数・exit コード・`--json` の形と stage の集合（§5.1）。3 本のワークフローの実行行。
- 投資判断の正本値（`score()` の閾値・%タイルの算出・バンドの扱い・`fund-per` の加重）。Q1 は「比較」だけの例外。
- `auth-*.js`・`verifyPinHash` の実装、他の KV ルート（`/positions`・`/networth`・`/order-sheet*`）。
- Worker の URL・CORS 判定・既存ルートのパス・メソッド・応答（refactor 計画 §2.1）。
- `docs/briefing-generation-spec.md`。

## 12. 公開リポの注意
- テスト・PR・Issue・ログの例は合成値（シンボル `AAA` 等）。KV の中身・トークンの値・PIN／ハッシュを書かない。
- 応答とログに出すのはシンボル・件数・stage・SHA（先頭 7 桁で十分）・HTTP ステータスだけ。

## 13. 付録: #647 の比較の前後

比較関数を次に置き換える（`normValuation` は名前を残して中身を変えてよい。テストは全項目版に書き換える）。
- 値が null/undefined → `'null'`。
- それ以外 → キーを再帰的に昇順に並べた JSON 文字列（オブジェクトのキーだけ並べ替え、配列の順序はそのまま）。

例（合成値）:
| KV の valuation | 正本のエントリ | 前（3 項目） | 後（全項目） |
|---|---|---|---|
| `{perCurrent:12.3, status:'cheap', asOf:'2026-01-02', note:'A'}` | `{perCurrent:12.3, status:'cheap', asOf:'2026-01-02', note:'B'}` | 一致（**同期されない**） | ズレ（同期される） |
| `{asOf:'2026-01-02', status:'cheap', perCurrent:12.3}` | `{perCurrent:12.3, status:'cheap', asOf:'2026-01-02'}` | 一致 | 一致（キー順に依存しない） |
| `{perCurrent:12.3, status:'cheap', asOf:'2026-01-02', bandLow:10}` | `{perCurrent:12.3, status:'cheap', asOf:'2026-01-02'}` | 一致 | ズレ（正本に無いキーが KV に残っている → 正本で置き換え） |
| `{…, sellProposal:[{a:1},{b:2}]}` | `{…, sellProposal:[{b:2},{a:1}]}` | 一致 | ズレ（配列の順序は意味を持つ） |
| （valuation 無し） | `{perCurrent:12.3, …}` | ズレ | ズレ |

### PR1 の受け入れ条件
- [ ] 品質ゲート green
- [ ] `tests/kv-sync.test.js`: 上の表の 5 例・入れ子オブジェクトのキー順違いは一致・正本に無い銘柄は対象外・`mergeValuations` の既存テストは不変で通る
- [ ] `--check` で `note` だけ違う銘柄が exit 3（スクリプトを `findDrift` 経由で通すテスト、または `findDrift` の単体で代替）・完全一致で exit 0
- [ ] `kv-sync.mjs` の先頭コメントの「比較キーは変更しない（#652 §11）」を「#647・Toshio 承認（日付）で全項目比較に変更」に更新
- [ ] PR は `Closes #647`。Toshio の Q1 承認を PR で得てからマージ（`needs-toshio`）

## 14. ブランチ / PR / Issue
| PR | ブランチ | タイトル | Issue | Toshio |
|---|---|---|---|---|
| PR1 | `fix/647-kv-sync-full-compare` | fix(kv-sync): ドリフト判定を valuation 全体の比較にする | `Closes #647` | 要（Q1） |
| PR2 | `feat/715-watchlist-resync-route` | feat(worker): POST /watchlist/resync（公開 main の valuation を KV に写す） | `Refs #715` | 要（worker・レート制限・トークン） |
| PR3 | `feat/715-kv-resync-via-worker` | feat(scheduler): kv-resync を Worker の同期ルート経由に | `Refs #715` | 要（workflows） |
| PR4 | `feat/715-watchlist-local-until-login` | feat(watchlist): 未ログイン時は端末内に保存しログイン後に同期 | `Refs #715` | 不要 |
| PR5 | `feat/715-watchlist-put-pin` | feat(worker): PUT /watchlist を PIN 必須にする | `Closes #715` | 要（worker 認証・CLAUDE.md） |
