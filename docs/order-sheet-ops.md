# 注文表 運用手順（order:plan の投入・約定の反映・見直し・復旧・Mulmo への申し送り）

- **設計の正本**: [`docs/handoff/2026-10-03-order-sheet.md`](./handoff/2026-10-03-order-sheet.md)（§3.1 データ形・§5 状態の変更・§8 約定検知と運用・§9 初期投入・§11 Mulmo・§12 決定）
- **本書の範囲**: 運用手順（§8.3・§8.4・§9）と Mulmo 向け申し送り（§11）の正本。計算仕様・データ形は設計書を見る。
- **表示場所**: アプリの新タブ「Order」（2026-10-04 Toshio 決定・設計書 §12 冒頭。当初案の Briefing タブ上部ではない）。未ログインでは表示も通信もしない。
- **関連**: Worker ルート #672（PR #683・デプロイ済み）／アプリ表示 #674／本書・投入スクリプト #675

## 0. 公開リポの約束（全手順で守る）

このリポは PUBLIC。次を **Issue・PR・コミット・Wiki・Briefing HTML・`data/**`・Actions ログ・この docs に書かない／貼らない**。

- 銘柄ごとの目標額・段の指値/株数・売却株数（JPST 等）・資金不足額・ストレスの実測値・注文表の応答そのもの
- PIN ハッシュ（`MF_PIN_HASH` の値）・口座名・証券会社の行名
- 照合で差が出たときの数値（対話の中だけで扱う）

plan の実ファイルは**リポの外**（例 `~/private/`）に置く。`.gitignore` に `*.order-plan.json`・`private/` を入れてあるが、これは保険で、リポ内に置かないのが原則。`scripts/order-plan.mjs` はリポ（git の作業ツリー）内のファイルを拒否する。

## 1. データの置き場所と書き手

| 置き場所 | 中身 | 書き手 |
|---|---|---|
| KV `order:plan`（非公開・PIN 保護） | 設定（目標額・tier・段）＋状態（working/filled・発注記録）＋`rev` | Worker のみ: `PUT /order-sheet/plan`（初回投入・編集）／`POST /order-sheet/events`（アプリの申告ボタン・対話中の Claude・Mulmo）／Cron（mf の株数で約定を確定・変化時のみ） |
| KV `order:log`（非公開・最大 300 件） | 操作ログ（新しい順） | 上と同じ（Worker が自動追記） |
| `data/target-allocation.json` の `aiTech`・`stress`・`orderSheet`（公開） | 比率と条件だけ | 人（設定変更の PR） |

- **KV を `wrangler kv` で直接書かない**（検証 `validatePlan` と楽観ロック `rev` を通らないため）。例外は §7 の「壊れた order:plan の復旧」での**削除**だけ。
- 注文表（指値×株数・資金繰り・ストレス）は保存しない。`GET /order-sheet` のたびに Worker が計算する。

## 2. 前提（環境変数）

| 変数 | 用途 | 備考 |
|---|---|---|
| `MF_PIN_HASH` | `X-Pin-Hash` ヘッダにそのまま使う PIN ハッシュ | Mac mini の既存環境変数（MF 取り込みの `PUT /networth` と同じ値）。**値を表示・貼り付けしない**（`echo` しない・会話ログ/Issue/コミットに出さない） |
| `WORKER_URL` | Worker のベース URL | 省略時 `https://portfolio-proxy.shoulang.workers.dev`（`scripts/order-plan.mjs`）。下の curl 例でも使う |

- 全ルート（GET を含む）が PIN 必須。PIN 無し・不一致は 401、PIN 未設定は 428。
- レート制限は IP 単位 120 回/60 秒（`RATE_LIMITER`）。ループで叩かない。
- 応答は `Cache-Control: no-store`。

curl を使うときは毎回この形（値はシェル変数のまま渡し、展開結果を表示しない）。保存先 `~/private/` は先に本人だけが読める権限で作っておく:

```bash
mkdir -p ~/private && chmod 700 ~/private
: "${WORKER_URL:=https://portfolio-proxy.shoulang.workers.dev}"
curl -sS -H "X-Pin-Hash: $MF_PIN_HASH" "$WORKER_URL/order-sheet/plan" -o ~/private/plan-now.json -w '%{http_code}\n'
```

- `-v`・`--trace` は使わない（ヘッダが表示される）。応答本文は**リポ外のファイル**に保存するか、対話の中だけで読む。

## 3. 投入スクリプト `scripts/order-plan.mjs`

```bash
node scripts/order-plan.mjs validate <file>   # validatePlan をローカルで通す（通信しない）
node scripts/order-plan.mjs put <file>        # validatePlan を通してから PUT /order-sheet/plan
node scripts/order-plan.mjs get <file>        # GET /order-sheet/plan を <file> に保存（既存ファイルは上書きしない・権限 600）
```

- `<file>` はリポの外。リポ内・任意の git 作業ツリー内のパスは拒否する（終了コード 2）。
- 標準出力に出すのは**件数（銘柄・段・working）と rev と HTTP ステータス**だけ。検証エラーは場所（シンボル名・段の位置・項目名）と理由だけで、値は出さない。
- `put` の楽観ロック: KV が未投入なら `rev` 不要。投入済みなら**ファイルの `rev` が KV の `rev` と一致するときだけ**置き換わる（不一致は 409 と現在の rev を表示）。編集は必ず `get` → 編集 → `validate` → `put` の順で行う。
- 成功すると Worker が `rev` を +1 し、`order:log` に `plan-put` を追記する。

## 4. 初期データの投入と照合（設計書 §9・Toshio が Mac で実行）

前提: Worker の `/order-sheet` 系がデプロイ済み（PR #683）。

1. **plan を作る（リポ外）**: 例 `~/private/2026-10-03.order-plan.json`。形は [`docs/order-sheet/plan.example.json`](./order-sheet/plan.example.json)（合成値・架空ティッカー）を写して、10/3 確定の段（Wiki の投資判断ログ 2026/10/3）を入れる。
   - 各段: `limit`＝指値、`amountUsd`＝指値×株数、`dropPct`＝基準価格からの下落率（任意）。こうすると導出株数＝floor(amountUsd÷limit)＝もとの株数になる（設計書 §3.1「初期データの形」・§6.2）。
   - `state`: 各銘柄の 1 段目を `working`、残りを `waiting`。
   - 既に証券会社に発注済みの段は `placedAt`（発注時刻・ISO）・`orderedQty`・`orderedLimit`・`qtyAtPlace`（発注時点の保有株数。不明なら `null`＝自動検知しない）を入れる。
   - 全売り銘柄は `tier: "exit"`・`targetUsd: null`・`qty: "all"` の sell 段 1 つ。
   - `funding.usdCashRows` は mf の「現金・預金」行のうち米ドル預り金の行（部分一致）。実際の名前はこのファイルにだけ書く。
   - v1 は USD 建ての銘柄だけ（`.T` 等は検証で拒否）。
2. **検証**: `node scripts/order-plan.mjs validate ~/private/2026-10-03.order-plan.json` → `OK: 銘柄 N・段 M（working K）` を確認。エラーは場所を見て直す。
3. **投入**: `node scripts/order-plan.mjs put ~/private/2026-10-03.order-plan.json` → `PUT OK … → rev 1` を確認。
4. **照合**: アプリの「Order」タブで注文表を開き、10/3 の手計算（JPST の売却株数・全段の不足額・ストレスの落ち込み・AI/テック合計）と突き合わせる。
   - 差があれば**非公開の場（対話）で**原因を確認する。定義差は設計書 §6 の既定と §12 の決定で吸収する（例: 分母は `totals.imported`、現金比率は生活資金 ¥20M 控除（0 で下止め）・cashEquivalents（JPST 等）の評価額を含む（#753 以降））。
   - 照合結果を公開の場に書くときは「一致／差あり（定義差）」程度にし、数値は書かない。
5. 設計書の実装ログ（「初期データ投入」のチェック）は architect / PM が更新する。

Claude（対話）が代行する場合も同じスクリプトを使い、plan ファイルはリポ外に置く。

## 5. 約定・発注の反映

### 5.1 自動（mf の株数・Cron）

- 段に `placedAt`・`qtyAtPlace`・`orderedQty` があり、MF の同期日（`networth.asOf`）が発注日（UTC）**より後**で、mf の株数が増えて（buy）／減って（sell）いれば約定とみなす（設計書 §5.2）。
- `GET /order-sheet` はメモリ上で反映して表示する（「自動検知」）。KV への確定は Worker の Cron（6 時間ごと）が変化時だけ行う。
- MF の同期は寄付前なので、直近の取引日の約定は翌日の同期まで出ない（注文表に「未反映の可能性」と出る）。
- `qtyAtPlace` が `null` の段・株数が無い銘柄は自動検知しない（申告か対話で反映する）。

### 5.2 本人の申告（アプリ）

Order タブの `[発注した]`・`[約定した]`・`[取消]`・`[発注を取り消した]`。一部約定・指値を変えた発注などの細かい入力は v1 では UI に無いので、対話（§5.3）で送る。

### 5.3 対話中の Claude（マネックス MCP）— 設計書 §8.3

1. マネックス MCP で**約定一覧・保有株数・注文一覧**を読む。
2. `GET /order-sheet/plan` で plan と `rev` を取る（応答はリポ外に保存するか対話の中だけで読む）。
3. 差分をイベントで送る（`POST /order-sheet/events`・body に必ず `rev`）:
   - 約定した段 → `filled`（`source: "mcp"`。一部約定は `filledQty` に**今回新たに約定した株数**を付ける＝累計ではなく増分。Worker が既存の `filledQty` に足し、`orderedQty` に届けば filled になる）
   - 新しく出した注文 → `placed`（実際の `orderedQty`・`orderedLimit`。省略すると表示中の株数・指値。`qtyAtPlace` は Worker が mf の株数から記録する）
   - 証券会社で消した注文 → `unplace`
   - 指値を変えて出し直した → `unplace` → `placed`（2 回目は 1 回目の応答の新しい `rev` を使う）
   - 段そのものをやめる → `cancelled`（次の waiting 段が working＝要発注になる）
4. `GET /order-sheet`（または events の応答＝新しい注文表）で、次の段・資金繰り（JPST の売却株数）・不足額を確認して本人に伝える。
- 成功すると `rev` が +1 され、応答は新しい注文表（`meta.planRev` が新しい rev）。続けて送るときはその rev を使う。
- **409**（rev 不一致）は他（アプリ・Cron・Mulmo）が先に更新した印。`GET /order-sheet/plan` で取り直し、状態を確かめてから送り直す（同じ約定を二重に送らない）。
- **400** はイベントが状態に合わない（working でない段への `placed` など）。メッセージを読んで直す。
- PIN ハッシュは対話環境の環境変数から使い、会話ログ・Issue・コミットに貼らない。

イベントの例（**合成値**・架空ティッカー。実際の値は対話の中だけで組み立てる）:

```bash
# 発注した（AAA の s1 を 81 株・$368 で発注）
curl -sS -X POST -H "X-Pin-Hash: $MF_PIN_HASH" -H 'Content-Type: application/json' \
  -d '{"rev":7,"type":"placed","symbol":"AAA","stageId":"s1","orderedQty":81,"orderedLimit":368}' \
  "$WORKER_URL/order-sheet/events" -o ~/private/sheet.json -w '%{http_code}\n'

# 約定した（MCP で確認）
curl -sS -X POST -H "X-Pin-Hash: $MF_PIN_HASH" -H 'Content-Type: application/json' \
  -d '{"rev":8,"type":"filled","symbol":"AAA","stageId":"s1","source":"mcp"}' \
  "$WORKER_URL/order-sheet/events" -o ~/private/sheet.json -w '%{http_code}\n'
```

## 6. イベント駆動の見直し（設計書 §8.4）

- **見直しの合図**: 雇用統計・CPI・FOMC・FOMC 議事要旨・日銀・ISM・保有銘柄の決算・約定・大きな値動き（注文表の `rebaseSuggested`＝基準価格から ±5% 以上）。
- 経済カレンダーは Briefing（Mulmo）のものを使う。portfolio 側はカレンダーを持たない（v1）。
- 見直した主体（Mulmo／対話中の Claude）が送る:
  - `rebase`（`symbol`・`basePrice`・`event`）: 基準価格を取り直す。`dropPct` を持つ **waiting 段**の指値が新しい基準から導出し直される（金額は保ち株数が変わる）。working 段も直すときだけ `includeWorking: true`（発注済みなら「要訂正」＝`unplace` 扱いになるので、証券会社の注文も直す）。
  - `review`（`event`）: 見直しをした記録だけ（注文表の末尾に最終見直しとして出る）。
- 自動では基準を変えない。基準価格の決め方（終値・直近高値など）は見直す側が決める（Mulmo は SKILL.md）。

```bash
# 例（合成値）: CPI 後に AAA の基準を取り直し、見直しを記録
curl -sS -X POST -H "X-Pin-Hash: $MF_PIN_HASH" -H 'Content-Type: application/json' \
  -d '{"rev":9,"type":"rebase","symbol":"AAA","basePrice":380,"event":"CPI"}' \
  "$WORKER_URL/order-sheet/events" -o ~/private/sheet.json -w '%{http_code}\n'
curl -sS -X POST -H "X-Pin-Hash: $MF_PIN_HASH" -H 'Content-Type: application/json' \
  -d '{"rev":10,"type":"review","event":"CPI"}' \
  "$WORKER_URL/order-sheet/events" -o ~/private/sheet.json -w '%{http_code}\n'
```

## 7. 障害時

### 7.1 壊れた `order:plan` / `order:log` の復旧（#683 レビュー Low 指摘 3・#686）

**症状**: `GET /order-sheet`・`GET/PUT /order-sheet/plan`・`POST /order-sheet/events` がすべて 500「KV のデータを読めません」を返す。Worker は KV の値を JSON として読めないと 500 にするので、`PUT` でも上書きできない（現在値の読み取りで止まる）。`order:log` が壊れた場合も同じ症状になる（PUT・events が両方を読むため）。

**手順**（Toshio が Mac の `worker/` で実行。Mac セッション〔Claude〕には `wrangler kv` 操作を任せない＝CLAUDE.md「Mac セッション」の禁止事項）:

1. 退避（リポ外へ。中身を画面に出さない）:
   ```bash
   cd ~/GitHub/portfolio/worker
   mkdir -p ~/private && chmod 700 ~/private
   npx wrangler kv key get "order:plan" --binding KV --remote > ~/private/order-plan.broken.json
   npx wrangler kv key get "order:log"  --binding KV --remote > ~/private/order-log.broken.json
   ```
   - wrangler v4 の `kv key` は既定がローカルなので `--remote` を必ず付ける。
   - どちらが壊れているかは `node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' <file> && echo OK` で確かめる（エラーの文面は値の断片を含みうるので貼らない）。
2. 壊れているキーだけ削除する:
   ```bash
   npx wrangler kv key delete "order:plan" --binding KV --remote   # plan が壊れている場合
   npx wrangler kv key delete "order:log"  --binding KV --remote   # log が壊れている場合（履歴は失われる）
   ```
3. plan を消した場合は投入し直す（未投入扱いなので `rev` 不要の初回 PUT になる）:
   - 手元に最新の plan ファイル（`get` で保存したもの・初期投入のファイル）があれば、状態（filled・placedAt 等）を最新に直してから `node scripts/order-plan.mjs validate <file>` → `put <file>`。
   - 退避した壊れたファイルが部分的に読めるなら、それを元に直してもよい（リポ外で作業する）。
   - ファイルの `rev` が残っていれば、Worker は `rev+1` から続ける。
4. `GET /order-sheet` が 200 になること、Order タブが表示されることを確かめる。
5. 退避ファイルは不要になったら削除する。Issue 等への報告は「復旧済み・どのキーを削除したか・HTTP ステータス」だけ（値は書かない）。

- 復旧はあくまで削除＋再投入。**`wrangler kv key put` で直接書き戻さない**（検証と rev を通らない）。

### 7.2 その他

| 症状 | 原因と対処 |
|---|---|
| 401 / 428 | `MF_PIN_HASH` の誤り／PIN 未設定。値は表示せず、アプリで PIN を変えたなら Mac mini の環境変数も更新する |
| 409 | rev 不一致。`get`（または `GET /order-sheet/plan`）で取り直して再実行 |
| 400（PUT） | `errors` の場所を見てファイルを直す（`validate` で事前に確認できる） |
| 429 | レート制限（120 回/60 秒）。1 分待つ |
| Order タブに出ない | 未ログイン・plan 未投入・取得失敗のいずれか（失敗はブラウザのコンソール警告のみ） |
| `meta.warnings` に「戦略設定を取得できず既定値で計算」 | `data/target-allocation.json` の取得失敗。既定値で計算済み。続くなら Issue（数値は書かない） |
| 約定が自動で反映されない | `qtyAtPlace` が `null`／MF の同期日が発注日と同じ（寄付前同期）／mf に株数が無い。申告か対話で送る |

## 8. Mulmo への申し送り（設計書 §11）

`docs/briefing-generation-spec.md` は Mulmo の正本なので変えない。下記は Issue で Mulmo に提案し、Mulmo が SKILL.md（`data/skills/briefing/SKILL.md`・Mulmo 側）に反映して完了を Issue に報告する。

1. **注文表の数値を Briefing HTML・`valuations.json`・Wiki など公開される場所に書かない**（`data/briefings/**` は公開リポ）。注文表はアプリの **Order タブ**が PIN で取得して表示する。Briefing 本文で触れるなら「注文表はアプリの Order タブ」程度にする。
2. 発議を出す前に `GET /order-sheet`（`X-Pin-Hash`。Mac mini の既存 `MF_PIN_HASH` と同じ値を Mulmo の実行環境でも読む＝§12 #8 の決定）を読み、次に反する発議をしない:
   - `ladders[].hold = "targetReached"` の銘柄に押し目買いを出さない。
   - buy の段がある銘柄にトリム・売りを出さない（本人の段階買いと逆行）。sell は plan の sell 段に限る。
   - テーマ上限・AI/テック上限は `data/target-allocation.json`（#668 後の値）に従う。
3. イベント（雇用統計・CPI・FOMC・議事要旨・日銀・ISM・保有銘柄の決算）の後の Briefing 生成で、必要なら `POST /order-sheet/events` に `rebase`（基準価格の取り直し）と `review` を送る（§6）。基準価格の決め方は Mulmo の SKILL.md で決める（portfolio 側は値を受け取るだけ）。409 は取り直してから送り直す。
4. Mulmo のログ・Briefing・コミットに PIN ハッシュと注文表の値を出さない。
5. Discord 配信は今回やらない（D2）。
