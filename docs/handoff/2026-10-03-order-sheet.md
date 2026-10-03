# 注文表：売買を「指値×株数」で仕組みから出す（関連 #668）

- **子 Issue**: PR1〜PR6（下記「実装ログ」）＋ Mulmo 向け提案 Issue 1 本。親 Issue なし。
- **サイズ**: L（Worker 新ルート・KV の新データ形状・公開データの新キー・MF 取り込みスクリプト・新 UI）
- **分担**: 設計＝architect（本書）／実装＝implementer（子 Issue ごとに 1 ブランチ 1 PR）／レビュー＝reviewer
- **入力資料**: 2026-10-03 の Mulmo 壁打ち結論（Toshio 経由の依頼）、Toshio 決定 A3・B3＋B4・C3・D2（2026-10-03）、#668（themeCaps・triggers の値変更）、`docs/wealth-networth-spec.md`、`docs/handoff/2026-07-20-networth-privacy-hardening.md`
- **Toshio 確認**: PR1〜PR6 の**全 PR で要**（KV のデータ形状・`data/*.json` のキー・Worker の認証/レート制限・MF 取り込みスクリプト・公開/非公開の境界・`CLAUDE.md` のいずれかに触れる）。reviewer はマージせず `needs-toshio` を付ける。
- **公開リポの前提**: 本書・子 Issue・テスト・PR 本文には**銘柄ごとの目標額・段の指値/株数・売却株数・資金不足額などの実値を書かない**。例はすべて合成値（銘柄名は `AAA` `BBB` などの架空ティッカー）を使う。

## 実装ログ（implementer が更新）
| PR | 子 Issue | branch | PR | 状態 |
|---|---|---|---|---|
| PR1 計算モジュール（純関数） | #670 | `feat/670-calc` | #____ | 実装済み・レビュー待ち（needs-toshio） |
| PR2 戦略設定（公開キー追加） | #____ | `feat/____-order-strategy-config` | #____ | 未着手（#668 マージ後） |
| PR3 Worker ルート＋約定の自動反映 | #____ | `feat/____-order-sheet-worker` | #____ | 未着手（PR1 後）／マージ後 Toshio が Worker デプロイ |
| PR4 mf-holdings に株数 `qty` | #____ | `feat/____-mf-qty` | #____ | 未着手（独立）／Mac 実機確認要 |
| PR5 アプリ表示（Briefing タブ） | #____ | `feat/____-order-sheet-ui` | #____ | 未着手（PR3 デプロイ後） |
| PR6 運用手順・投入スクリプト・CLAUDE.md | #____ | `docs/____-order-sheet-ops` | #____ | 未着手（PR3 後・PR5 と並走可） |

- 初期データ投入（§9）: [ ] Toshio が Mac で投入 [ ] 10/3 の手計算と照合（差分は Toshio に口頭/非公開で報告。公開の場に数値を書かない）
- Mulmo 側（§11）: [ ] 提案 Issue 起票 [ ] SKILL.md 追従完了の報告

---

## 1. 背景とゴール

- 2026-10-03 の投資相談で、Briefing とアプリの提案が本人の戦略と食い違う点が多数見つかり、手作業で直した（例：旧値の半導体上限で SMH トリムが毎日出る、TSLA の買い禁止が残る）。値の食い違いは #668 で直す。本書はその上位の仕組み。
- いまは銘柄ごとの目標額や段階買いの段（指値・株数）が散文とメモリにしか無く、提案が「指値だけ」「金額だけ」になりがち。
- **ゴール**:
  1. 銘柄ごとの目標額・tier・段（指値・株数・状態）が**非公開の設定（Worker KV・PIN 保護）**にある。
  2. Worker が決定論で**注文表（指値×株数）**を計算し、PIN 付きルートで返す。アプリ（Briefing タブ）はそれを表示し、Mulmo は読んで自分の発議を合わせる。
  3. 1 銘柄につき発注中は常に 1 段。約定で次の段へ進む。約定は ①MF の株数の増減 ②本人申告 ③対話中の Claude（マネックス MCP）で反映する。
  4. 資金繰り（同一通貨の売り代金→JPST の売却株数）・現金ガード（最深段の停止）・資金不足額・AI/テック合計・ストレスの落ち込みが一緒に出る。
  5. 本人の決定に反する発議（SMH トリム・TSLA 買い禁止）を注文表が出さない。

## 2. 決定事項（2026-10-03 Toshio 確定）と本書での既定

| ID | 決定 | 本書での具体化 |
|---|---|---|
| A3 | 目標額・段・状態・注文表は Worker KV に置き PIN で読む | KV キー `order:plan`（設定＋状態）・`order:log`（操作ログ）。注文表は保存せず GET のたびに計算（§4） |
| 計算 | Worker が計算。純関数モジュールで Worker と vitest の両方から呼ぶ。GitHub Secrets は追加しない | `worker/src/order-sheet-calc.js`・`worker/src/order-plan.js`（ともに env/fetch 非依存の純関数）。`tests/*.test.js` から `../worker/src/...` を import |
| C3 | 戦略（比率系）は公開 `data/target-allocation.json`、銘柄ごとの目標額・tier・段は KV | 公開側に `aiTech`・`stress`・`orderSheet` キーを追加（§3.2）。銘柄名と金額の組は公開側に置かない |
| B3＋B4 | 約定検知＝①mf-holdings に `qty` ②本人申告の入口 ③対話中は MCP（運用手順） | ①PR4 ②`POST /order-sheet/events` とアプリのボタン ③§8.3 の手順。寄付前同期のため asOf と「未反映の可能性」を表示 |
| D2 | Discord 配信は今回やらない。まず Briefing が注文表を表示 | Briefing の**生成 HTML は公開リポに保存される**ため、注文表を HTML に焼き込まない。アプリの Briefing タブ（表示側）が PIN で取得して iframe の上に出す（§7）。Mulmo は読むだけ（§11） |
| #668 | 半導体 15・megatech 17・SMH/200A の capPct 17・TSLA 買い禁止解除は #668 で単独進行 | 本書は #668 の値を前提にし、`themeCaps`・`triggers.json` の値は触らない |

## 3. データモデル

### 3.1 KV（非公開・PIN 保護）

#### `order:plan`（JSON 1 個・設定と状態を一緒に持つ）
```jsonc
{
  "schemaVersion": 1,
  "rev": 7,                         // 書き込みごとに +1（楽観ロック・§5.3）
  "updatedAt": "2026-10-03T12:00:00Z",
  "funding": {
    "sweepSymbol": "JPST",          // 不足分を売って充てる銘柄（USD 建て）
    "useUsdCash": true,             // 既存の米ドル預り金を先に充てるか（§6.5・要 Toshio 判断 #4）
    "usdCashRows": [                // mf の「現金・預金」行のうち米ドル預り金とみなす行（部分一致）
      { "institution": "<証券会社名>", "name": "<行名>" }
    ]
  },
  "symbols": {
    "AAA": {
      "tier": "thick",              // thick | thin | theme | special | exit
      "targetUsd": 100000,          // tier=theme / exit は null 可
      "lot": 1,                     // 売買単位（v1 は USD 建てのみ＝1）
      "basePrice": 400,             // 段価格の基準（イベントごとに取り直す）
      "baseAt": "2026-10-03T12:00:00Z",
      "baseEvent": "manual",        // CPI / FOMC / earnings / fill / move / manual …
      "note": "",                   // 任意・表示用（短文）
      "stages": [
        {
          "id": "s1",
          "side": "buy",            // buy | sell
          "amountUsd": 30000,       // 段の金額（不変量。指値を変えても保つ）
          "dropPct": 8,             // 基準価格からの下落率（null＝指値固定）
          "limit": null,            // 明示の指値（null＝basePrice×(1−dropPct/100) から導出）
          "qty": null,              // sell 専用: 株数 or "all"（buy は常に null＝金額から導出）
          "state": "working",       // waiting | working | filled | cancelled
          "placedAt": null,         // 本人が証券会社に発注した時刻（null＝要発注）
          "orderedQty": null,       // 発注した株数（placed 時に固定）
          "orderedLimit": null,     // 発注した指値（placed 時に固定。sell 成行は null）
          "qtyAtPlace": null,       // 発注時点の保有株数（mf qty。不明なら null＝自動検知しない）
          "filledQty": 0,           // 一部約定の累計
          "filledAt": null,
          "fillSource": null        // mf-qty | self | mcp
        }
      ]
    }
  }
}
```

- **tier の意味**（表示とガードに使う。段の組み方は人が決める）:
  - `thick` / `thin`: 個別株。単一銘柄の上限（§6.6）と目標額で判定。
  - `theme`: テーマ ETF（SMH・200A.T・CIBR 等）。単一銘柄の上限の対象外。`targetUsd` があれば目標額でも判定し、テーマ上限でも判定する。
  - `special`: 別勘定（上限の別枠）。単一銘柄の上限の対象外・目標額でだけ判定。
  - `exit`: 売り切る銘柄。`targetUsd: null`・sell 段だけ。
- **段の不変条件**（PUT 時に検証・§5.3）:
  - 1 銘柄の非 `filled`/`cancelled` 段のうち `working` は**ちょうど 1 つ**（未完了段が 0 なら 0）。`working` は `stages` の並び順で最初の未完了段であること。
  - buy 段は `amountUsd > 0` かつ（`limit > 0` または `dropPct` と `basePrice` が両方ある）。sell 段は `qty`（正の整数か `"all"`）必須・`limit` は null（成行）可。
  - v1 は USD 建ての銘柄だけ（`.T` 等は 400 で拒否）。
- **初期データの形**: 10/3 の段は「指値×株数」で決まっているので、投入時は `limit` に指値、`amountUsd` に「指値×株数」を入れ、`dropPct` は基準価格からの比率（任意）を入れる。こうすると導出株数＝floor(amountUsd÷limit)＝もとの株数に一致する（§6.2 の丸め）。

#### `order:log`（JSON 配列・新しい順・最大 300 件で古いものを捨てる）
```jsonc
[{ "at": "2026-10-04T01:00:00Z", "type": "filled", "symbol": "AAA", "stageId": "s1", "source": "mf-qty", "rev": 8 }]
```
- 値（指値・株数・金額）も入れてよい（KV は非公開）。ただし**Worker の console 出力には値を出さない**（`wrangler tail` で見えるため。シンボルと type だけ）。

#### 既存 KV の読み取り（変更しない）
| キー | 用途 |
|---|---|
| `networth` | MF 完全版（`holdings[]`・`totals.imported`・`asOf`）。保有評価額・株数（PR4 後）・現金。#589 で Mac mini が毎日 PUT |
| `prices:cache` | Cron の Finnhub 価格（ySymbol → `{price, ts}`・TTL 7h） |
| `forex:USDJPY` | 為替（`handleForex` と同じキー・TTL 1h） |
| `constituents:<SYM>` | ETF 構成銘柄の KV キャッシュ（中身の偏りの注意表示に使う・§6.9） |

### 3.2 公開側（`data/target-allocation.json` に追加・PR2）
比率と条件だけ。銘柄ごとの金額は置かない。

```jsonc
{
  // 既存キーはそのまま（themeCaps の値は #668 が更新）
  "aiTech": {
    "themes": ["semiconductor", "megatech"],
    "capPct": 29,                    // 要 Toshio 判断 #2（本人発言「最終形≈29%を許容」を既定に採用）
    "note": "AI/テック合計＝themes の members の現在%の和。capPct 超で警告。"
  },
  "stress": {
    "tolerancePct": 20,              // 本人の許容（総資産比の落ち込み）
    "nonEquity": ["JPST", "GLDM", "SLV"],  // 株として扱わない保有（要 Toshio 判断 #5）
    "scenarios": [
      { "id": "ai-crash",   "label": "AI −40%・他の株 −15%", "shocks": [{ "group": "aiTech", "pct": -40 }, { "group": "otherEquity", "pct": -15 }] },
      { "id": "semi-crash", "label": "半導体 −50%",          "shocks": [{ "group": "theme:semiconductor", "pct": -50 }] }
    ]
  },
  "orderSheet": {
    "cashFloorPct": 12,              // 現金比率がこれ未満なら各銘柄の最深段を停止
    "rebaseMovePct": 5,              // 基準価格からこれ以上動いたら「再計算推奨」を出す（要 Toshio 判断 #6）
    "note": "単一銘柄の上限は convictionPct.high（総資産比%）を使う。"
  }
}
```
- 書き手は人（設定変更の PR）。自動の書き手（Actions・Mulmo）はこのキーを書かない。
- `src/target-allocation.js` に読み出し関数を足す（`getAiTechConfig()`・`getStressConfig()`・`getOrderSheetConfig()`）。アプリ側では v1 で表示に使わない（計算は Worker）が、Value/Risk タブで将来使えるよう用意する。
- Worker は公開ファイルを `https://raw.githubusercontent.com/shoulang0729/portfolio/main/data/target-allocation.json` から取得する（`cf: { cacheTtl: 300 }`。KV には書かない）。取得失敗時は §6 の各既定値（上の値）で計算し、レスポンスの `meta.warnings` に「戦略設定を取得できず既定値で計算」を入れる。

### 3.3 公開側（`data/mf-holdings.json` に `qty` 追加・PR4）
- `holdings[]` の各行に任意フィールド `qty`（数値。MF の「保有数」列。株・ETF は株数、投信は口数）。取れない行は出さない（キー自体を省く）。
- 既存の load-bearing フィールド（`cat` `cur` `value` `totals.imported` `asOf` など）は変えない。`src/holdings-from-mf.js` の `MfHolding` typedef に `qty?: number` を足すだけで、アプリの挙動は変えない。
- 公開してよい（B3 で Toshio 確定）。KV `networth`（完全版）にも同じ `qty` が入る（同じ `build()` から作るため）。

## 4. Worker ルート（PR3）

| ルート | 認証 | 内容 |
|---|---|---|
| `GET /order-sheet` | PIN（`X-Pin-Hash`） | 注文表を計算して返す（§6・§4.2）。KV に書かない |
| `GET /order-sheet/plan` | PIN | `order:plan` をそのまま返す（Claude・投入スクリプトが編集の元に使う）。未投入なら `null` |
| `PUT /order-sheet/plan` | PIN | `order:plan` を丸ごと置き換える。検証（§3.1 の不変条件）＋楽観ロック（§5.3） |
| `POST /order-sheet/events` | PIN | 状態の変更（発注した／約定した／取消／基準価格の取り直し／見直し記録）。§5 |

### 4.1 認証・CORS・レート制限
- **全ルート GET も PIN 必須**（`verifyPinHash` を流用）。理由は `/networth` と同じ（Origin ヘッダを付けない curl をオリジン判定で弾けない・#589）。
- **レート制限**: 既存の `RATE_LIMITER`（IP 単位 120 回/60 秒）の対象パスに `/order-sheet` と `/order-sheet/*` を追加する。PIN ハッシュの総当たり対策も兼ねる（既存 `/networth` 等への拡大は本書の範囲外・別 Issue 提案）。
- **CORS**: 既存の `corsHeaders`（GET/POST/PUT・`X-Pin-Hash` 許可）で足りる。変更しない。
- レスポンスに `Cache-Control: no-store` を付ける（`jsonRes` を呼んだ後にヘッダを足すか、注文表用の小ヘルパーを作る。既存ルートの挙動は変えない）。
- **GitHub へのミラーはしない**（`/positions` の `_syncPositionsToGithub` のような書き出しを作らない）。
- Worker の console 出力にシンボル・type 以外（価格・株数・金額・目標額）を出さない。

### 4.2 `GET /order-sheet` のレスポンス形（計算モジュールの戻り値そのまま）
```jsonc
{
  "asOf": "2026-10-04T01:23:00Z",          // 計算時刻
  "meta": {
    "planRev": 7,
    "holdingsAsOf": "2026-10-03",          // networth.asOf（MF 同期日）
    "holdingsLagNote": "MF の同期は寄付前のため、直近の取引日の約定は未反映の可能性があります",
    "fxUsdJpy": 147.2, "fxAsOf": "…",
    "denominatorUsd": 3600000,             // 総資産（§6.1）
    "qtyAvailable": true,                  // mf に qty があるか（PR4 前は false）
    "warnings": ["…"]
  },
  "cash": { "pct": 13.1, "floorPct": 12, "guardActive": false },
  "orders": [                               // 「今出す注文」＝working 段＋資金繰りの JPST 売り
    {
      "symbol": "AAA", "side": "buy", "tier": "thick", "stageId": "s1",
      "status": "toPlace",                 // toPlace（要発注）| placed（発注中）| partial（一部約定）
      "limit": 368, "qty": 81, "amountUsd": 29808,
      "currentPrice": 395.1, "inTheMoney": false,  // 現在値 ≤ 指値（buy）/ ≥ 指値（sell）
      "curUsd": 60000, "curPct": 1.67,
      "afterUsd": 89808, "afterPct": 2.49,
      "targetUsd": 100000, "targetPct": 2.78,
      "next": { "stageId": "s2", "limit": 320, "qty": 125, "dropPct": 20, "text": "約定したら次は $320×125（基準比 −20%）" },
      "flags": ["exceedsTargetAfterFill?", "cashFloorDeepest?", "rebaseSuggested?", "etfConcentration?"]
    },
    { "symbol": "JPST", "side": "sell", "role": "funding", "limit": null, "qty": 120, "amountUsd": 6000, "text": "米ドル買いの不足分を充当" }
  ],
  "ladders": [                              // 銘柄ごとの全段（状態つき）。折りたたみ表示用
    { "symbol": "AAA", "tier": "thick", "targetUsd": 100000, "targetPct": 2.78, "curUsd": 60000, "curPct": 1.67,
      "basePrice": 400, "baseAt": "…", "baseEvent": "manual", "hold": null,   // hold: "targetReached" | "themeCapReached" | null
      "stages": [{ "id": "s1", "state": "working", "display": "toPlace", "limit": 368, "qty": 81, "amountUsd": 29808, "suppressed": null }] }
  ],
  "funding": {
    "usd": { "buyWorking": 29808, "sellWorking": 0, "usdCash": 23808, "sweepQty": 120, "sweepUsd": 6000, "sweepCapped": false },
    "allStages": { "buyTotal": 0, "sellTotal": 0, "available": 0, "shortfallUsd": 0 }
  },
  "aiTech": { "capPct": 29, "now": 24.0, "afterWorking": 24.8, "final": 27.5, "over": false,
              "themes": [{ "theme": "semiconductor", "cap": 15, "now": 0, "afterWorking": 0, "final": 0 }] },
  "stress": { "tolerancePct": 20,
              "equityPct": { "now": 70.0, "afterWorking": 70.8, "final": 74.0 },
              "scenarios": [{ "id": "ai-crash", "label": "…", "now": 17.5, "afterWorking": 17.9, "final": 19.6, "overFinal": false }] },
  "review": { "lastEvent": "CPI", "lastAt": "…" }
}
```
- 数値の丸め: `*Pct` は小数 1 桁（表示側で丸めず、計算モジュールが `Math.round(x*10)/10`）。`*Usd` は整数ドル（`Math.round`）。`limit` は §6.2 の刻み。
- 上の数値は形の説明用の合成値（実値ではない）。

## 5. 状態の変更（`POST /order-sheet/events`）

### 5.1 イベント
| type | 必須 | 効果 |
|---|---|---|
| `placed` | symbol, stageId（working 段） | `placedAt=now`・`orderedQty`（省略時は表示中の株数）・`orderedLimit`（省略時は表示中の指値）・`qtyAtPlace`（mf qty。無ければ null）を記録 |
| `filled` | symbol, stageId | `filledQty` 指定時に `filledQty < orderedQty` なら一部約定（working のまま `filledQty` を加算）。それ以外は `state=filled`・`filledAt`・`fillSource`（`self` 既定／`mcp` 指定可）→ 次の waiting 段を `working`（`placedAt=null`＝要発注）に進める |
| `cancelled` | symbol, stageId | 段を `cancelled` にして次の waiting 段を working に進める |
| `unplace` | symbol, stageId | 発注を取り消した（証券会社で注文を消した）。`placedAt`/`orderedQty`/`orderedLimit`/`qtyAtPlace` を null に戻す（段は working のまま・要発注） |
| `rebase` | symbol, basePrice, event | `basePrice`・`baseAt`・`baseEvent` を更新し、`dropPct` を持つ **waiting 段**の `limit` を null に戻す（＝新しい基準から導出）。`includeWorking: true` のときだけ working 段も再計算し、発注済みなら `unplace` と同じ扱い（要訂正）にする |
| `review` | event | 見直しをした記録だけ（`order:log` に追記。plan は rev だけ上がる） |

- 全イベントの body に `rev`（クライアントが見た `planRev`）を必須にし、KV の rev と違えば **409**（§5.3）。成功時は rev を +1 して保存し、**新しい注文表（§4.2）を返す**（アプリが再取得しなくてよい）。
- 状態遷移は `worker/src/order-plan.js` の純関数 `applyEvent(plan, event, ctx) → { plan, log }` で行う（PR1）。Worker は KV の読み書きだけ。

### 5.2 約定の自動検知（mf の株数）
- 純関数 `detectFills(plan, holdings) → { plan, logs }`（PR1）。条件（すべて満たすとき約定とみなす）:
  - 段が working かつ `placedAt` と `qtyAtPlace` と `orderedQty` がある。
  - `holdings.asOf`（日付）が `placedAt` の日付（UTC）**より後**（同日の同期は寄付前で約定を含まないため）。
  - buy: `mfQty ≥ qtyAtPlace + orderedQty` → filled。`qtyAtPlace < mfQty < qtyAtPlace + orderedQty` → 一部約定（`filledQty = mfQty − qtyAtPlace`・working のまま）。
  - sell: `mfQty ≤ qtyAtPlace − orderedQty` → filled（`qty:"all"` は `mfQty == 0` で filled）。途中は一部約定。
- 例（合成値）: `qtyAtPlace=100`・`orderedQty=81`・`placedAt=2026-10-03T14:00Z`。`asOf=2026-10-03` で `mfQty=100` → 何もしない（同日）。`asOf=2026-10-04` で `mfQty=181` → s1 filled（source `mf-qty`）・s2 が working（要発注）。`mfQty=140` → 一部約定 40/81。
- **反映のタイミング**: `GET /order-sheet` は `detectFills` を**メモリ上で適用して表示**する（KV は書かない。行に `fillSource:"mf-qty"`・「自動検知」を出す）。KV への確定は **Cron（既存 `scheduled`・1 日 4 回）**で `detectFills` を適用し、変化があるときだけ `order:plan` と `order:log` を書く（KV 書き込みは最大 4 回/日＋本人操作分。無料枠 1,000 回/日に対し十分小さい）。
- `qty` が無い（PR4 前・投信等）／`qtyAtPlace` が null の段は自動検知しない（申告・MCP のみ）。

### 5.3 楽観ロックと検証
- `PUT /order-sheet/plan` と `POST /order-sheet/events` は body の `rev` が KV の `rev` と一致するときだけ書く（不一致は 409 `{ error, rev }`）。KV 未投入時の初回 `PUT` だけ `rev` 不要。
- KV は結果整合（反映に最大 60 秒）なので完全な排他ではないが、利用者は本人＋Claude＋Cron の少数。Cron は書く直前に読み直し、rev が変わっていれば今回は書かない（次回に回す）。
- 検証 `validatePlan(plan) → { ok, errors[] }`（PR1 の純関数）。エラーは 400 で `errors` を返す。

## 6. 注文表の計算仕様（`worker/src/order-sheet-calc.js`・PR1）

入力 `buildOrderSheet({ plan, strategy, networth, prices, fx, etfTop, now })`。すべて引数で受け取り、fetch/KV/Date.now を中で呼ばない（`now` も引数）。

### 6.1 分母と現在額
- **総資産 D（USD）= `networth.totals.imported` ÷ USDJPY**。Value/Risk タブの分母（`getMfTotals().imported`）と同じ（要 Toshio 判断 #1）。
- 銘柄の現在額 `curUsd(sym)`: mf に `qty` があり現在値（USD）が取れれば `qty × price`、無ければ `Σ mf.value(JPY) ÷ USDJPY`（同じ ySymbol の行を合算）。
- mf の ySymbol 正規化: 4 桁コード（`/^\d{3}[0-9A-Z]$/`）は `.T` を付けて照合（例 `200A` → `200A.T`）。
- 現在値の取得順（Worker 側）: `prices:cache`（7h 以内）→ Finnhub `/quote`（`cf.cacheTtl: 300`・KV に書かない）→ mf の `price(JPY) ÷ USDJPY`（`meta.warnings` に「概算価格」）。
- `pct(x) = x ÷ D × 100`。

### 6.2 段の指値と株数
- 指値: `limit` があればそれ。無ければ `roundTick(basePrice × (1 − dropPct/100))`。刻みは価格 ≥ $20 で $1、未満で $0.01（四捨五入）。
- 株数（buy）: `floor(amountUsd ÷ limit ÷ lot) × lot`、最低 1 lot。**指値が上がって総額が増えるときは株数が減る**（floor のため金額は amountUsd を超えない）。
- 発注済み（`placedAt` あり）の段は `orderedQty`・`orderedLimit` を表示し再計算しない（実際の注文と食い違わせない）。
- sell: `qty:"all"` は mf の `qty`（無ければ `null` と「株数未取得のため要入力」フラグ）。金額は `qty × (limit ?? 現在値)`。
- **前後比較の例（合成値）**: `amountUsd=30,000`・`dropPct=8`
  - 基準 $400 → 指値 $368 → 株数 floor(81.52)=**81** → 金額 $29,808
  - イベントで基準を $380 に取り直し → 指値 $349.6→**$350** → 株数 floor(85.71)=**85** → 金額 $29,750（金額をほぼ保ったまま株数が増える）
  - 逆に基準 $420 → 指値 $386.4→**$386** → 株数 floor(77.72)=**77** → 金額 $29,722（指値が上がり株数が減る）

### 6.3 1 銘柄 1 段
- 未完了段のうち並び順で最初の段を working とみなす（保存値が壊れていても表示は崩さず `meta.warnings` に出す。PUT は §5.3 で拒否）。
- 「今出す注文」（`orders`）には working 段だけを出す。残りは `ladders` に waiting として出す。
- `next`: working 段の次の waiting 段（停止中を含めず）。無ければ「最終段」。

### 6.4 出さない条件（hold・suppressed）
優先順に判定し、該当した理由を表示する（段を消さず `suppressed` に理由を入れ、`orders` と資金計算から外す）。
1. **目標到達**（tier ≠ exit で `targetUsd` あり）: `curUsd ≥ targetUsd` → その銘柄の buy 段をすべて停止（`hold:"targetReached"`・表示「目標到達・HOLD」）。押し目でも買い増しを出さない。
2. **テーマ上限到達**（その銘柄が themeCaps の member）: テーマの現在% ≥ cap → buy 段をすべて停止（`hold:"themeCapReached"`）。
3. **現金ガード**: 現金比率（§6.7）< `cashFloorPct` → 各銘柄の**最深の未完了 buy 段**（並び順の最後）を停止（`suppressed:"cashFloor"`・表示「現金 12% 割れのため停止」）。ただし**working 段は停止しない**（証券会社に注文が出ている可能性がある）。最深段が working の場合は行に `cashFloorDeepest` フラグ（「現金ガード対象・取消を検討」）を付けるだけ。
4. 約定後に目標を超える段は停止しない。行に `exceedsTargetAfterFill` フラグ（「約定後 目標超過 $X」）を付ける。
- **自動の売り発議はしない**: sell 行は plan に本人が入れた sell 段だけ。テーマ上限超過や目標超過から売りを自動生成しない（SMH トリム等の本人の決定に反する発議を構造的に出さない）。

### 6.5 資金繰り（USD）
- **今出す注文の分**: `need = Σ buy(working・非停止) − Σ sell(working) − usdCash`（`useUsdCash=false` なら usdCash=0）。
  - `usdCash = Σ mf.value(funding.usdCashRows に一致する行) ÷ USDJPY`。
  - `need > 0` → `sweepQty = ceil(need ÷ sweepPrice)`。保有株数（mf qty）を上限に切り詰め、切り詰めたら `sweepCapped:true` と不足額を表示。`orders` の末尾に `role:"funding"` の sell 行として出す（成行）。
  - `need ≤ 0` → JPST 行は出さない。
  - 例（合成値）: buy $29,808・sell $0・usdCash $23,808・JPST $50.00 → need $6,000 → **JPST 120 株**。sell に $10,000 が入ると need ≤ 0 → JPST 行なし。
- **全段の分**: `shortfall = Σ buy(未完了・非停止の全段) − Σ sell(未完了の全段) − usdCash − JPST 保有額`。正なら「全段の合計に対し資金が $X 不足」を出す。0 以下なら出さない。
- 同一通貨の考え方: v1 は USD 建て銘柄だけなので USD 内で完結。円の現金・円の売り代金は充当に使わない（為替を跨ぐ充当は表示しない）。

### 6.6 単一銘柄の上限（高確信の上限）
- `capUsd = D × convictionPct.high / 100`（既存の公開値。規模連動）。tier が `thick`/`thin` で `targetUsd > capUsd` のとき、ladder に「目標が高確信の上限（総資産の X%＝$Y）を超えています」を出す（警告のみ・計算は targetUsd のまま）。`theme`/`special`/`exit` は対象外。
- すべての金額表示に総資産比%を併記する（`curPct`・`afterPct`・`targetPct`）。

### 6.7 現金比率
- `cashPct = max(0, Σ「現金・預金」(JPY) − 20,000,000) ÷ totals.imported × 100`。アプリの `getMfTotals().cashRatio`（Risk タブ・統計バー）と同じ定義（JPST は含めない・要 Toshio 判断 #3）。判定は**現時点の値**で行う。

### 6.8 AI/テック合計とテーマ使用率
- `aiTech.now = Σ_{theme ∈ aiTech.themes} Σ_{member} curPct(member)`。
- 3 つの時点で出す: `now`（現在）／`afterWorking`（今出す注文がすべて約定）／`final`（未完了・非停止の全段が約定）。約定後は buy で +amount、sell で −amount、資金繰りの JPST 売り・usdCash の減少も反映（D は売買で不変とみなす）。
- `capPct` を超える時点があれば `over:true`。テーマごとにも同じ 3 時点を出す。

### 6.9 ストレス
- 区分: `aiTech`＝aiTech.themes の members／`theme:<key>`＝そのテーマの members／`otherEquity`＝株（mf の cat が「米国株・ETF」「日本株・ETF」「投資信託」）のうち aiTech に入らず `stress.nonEquity` にも入らないもの。現金・nonEquity・暗号資産・その他はショック 0。
- `loss = Σ curUsd(sym) × |pct|/100`（該当区分の shock）、`lossPct = loss ÷ D × 100`。3 時点（now / afterWorking / final）で計算し、`tolerancePct` を超えたら `over*`。
- `equityPct`（株の比率）= 株区分（aiTech＋otherEquity）の合計 ÷ D × 100 を 3 時点で出す（「現金で買うと株の比率が上がる」を見える化）。
- **前後比較の例（合成値）**: D=$1,000,000、aiTech $250,000、他の株 $500,000、現金等 $250,000。
  - 現在: シナリオ① = 250K×40% ＋ 500K×15% = $175,000 → **17.5%**（許容 20% 以内）・株比率 75.0%
  - 現金 $100,000 で aiTech を買い増した後: 350K×40% ＋ 500K×15% = $215,000 → **21.5%**（許容超過）・株比率 85.0%
  - シナリオ②（半導体 −50%）: 半導体 $120,000 → 現在 6.0%、半導体を $60,000 買い増し後 9.0%
- ETF の中身の偏り: tier=theme の行で `constituents:<SYM>` の KV キャッシュがあれば上位 1 銘柄とその比率を `etfConcentration` フラグで添える（例「上位: XXX 20%」）。キャッシュが無ければ出さない（取得しに行かない）。

### 6.10 再計算推奨（大きな値動き）
- working／waiting の段がある銘柄で `|現在値 ÷ basePrice − 1| × 100 ≥ rebaseMovePct` → `rebaseSuggested` フラグ（「基準価格から ±X% 動いた・基準を取り直して再計算を推奨」）。自動では基準を変えない（変えるのは `rebase` イベント）。

## 7. アプリ表示（PR5）

### 7.1 置き場所
- **Briefing タブの iframe の上**に「注文表」ストリップを置く（既定・要 Toshio 判断 #7）。理由: D2「まず Briefing で表示」。Briefing の生成 HTML は公開リポに保存されるので中に入れられない。タブを増やさずに済む。
- 未ログイン（PIN ハッシュ無し）・取得失敗・plan 未投入のときはストリップ自体を出さない（未ログインで「注文表がある」ことも見せない）。取得失敗はコンソール警告のみ。
- 新モジュール `src/order-sheet.js`（取得・描画・申告）。`src/briefing.js` は描画後に `renderOrderSheetStrip(wrap)` を 1 回呼ぶだけ。ストリップの開閉後に `_fitFrame()` を呼んで iframe の高さを合わせ直す（`_fitFrame` を export するか、`briefing.js` 側にコールバックを渡す）。

### 7.2 レイアウト（モック用仕様）
```
┌ 注文表 ───────────────────────────── [▾] ┐  ← 閉じた状態（1 行）
│ 要発注 2 ・ 発注中 5 ・ 資金 JPST 売 *** 株 ・ 不足 $*** │
└──────────────────────────────────────────┘

開いた状態（max-height: 60vh・内部スクロール）
┌ 注文表 ─────────────── MF 2026-10-03 同期 ⓘ  [▴] ┐
│ ⓘ MF の同期は寄付前のため、直近の約定は未反映の可能性      │
│ [現金 13.1% / 下限 12%]  [AI/テック 24.0→27.5% / 29%]     │
│                                                           │
│ 今出す注文                                                │
│ 銘柄  売買 指値   株数  金額    約定後        目標     状態│
│ AAA   買  $368    81  $29,808  $89,808 2.5%  $100K 2.8% 要発注│
│        └ 次: $320×125（−20%）            [発注した][約定した]│
│ BBB   売  成行   200  $***     $0 0.0%      —         発注中│
│ JPST  売  成行   120  $6,000   資金繰り（米ドル買いの不足分）│
│ ⚠ 全段の合計に対し資金が $*** 不足                          │
│                                                           │
│ ストレス（許容 20%）     現在   今の注文後  全段約定後       │
│  AI −40%・他の株 −15%   17.5%   17.9%       19.6%          │
│  半導体 −50%             6.0%    6.2%        9.0%           │
│  株の比率                70.0%   70.8%       74.0%          │
│                                                           │
│ ▸ はしご全体（銘柄ごと・折りたたみ）                         │
│   AAA thick 目標 $100K(2.8%) 現在 $60K(1.7%) 基準 $400 (manual)│
│     s1 $368×81 要発注 ／ s2 $320×125 待機 ／ s3 … 停止（現金ガード）│
└───────────────────────────────────────────────────────────┘
```
- 合成値のモック。色は CSS 変数のみ（`--accent` 以外の hex 禁止）。状態ピル: 要発注＝`--accent` 枠、発注中＝`--text2`、停止中・HOLD＝`--text3`。超過（ストレス許容超・AI/テック上限超・不足）は既存の警告色トークン（Risk タブの warn/bad と同じクラス）を流用。
- **金額のマスク**: 金額（金額・約定後 $・目標 $・不足額・JPST 売の株数以外の $）はアプリの既存マスク状態（`state.statsMasked`・目アイコン）に従う。指値・株数・% は常時表示（売買に必要なため）。
- スマホ幅（≤ 480px）は表を縦積みカードにする（銘柄・売買・指値×株数を 1 行目、約定後/目標を 2 行目、ボタンを 3 行目）。`#watchlist-table-wrap` と同様の横スクロールでもよいが、ボタンが画面外に出ないこと。

### 7.3 申告ボタン
- `[発注した]`（`data-action="orderPlaced"`・`data-arg="<SYM>:<stageId>"`）／`[約定した]`（`orderFilled`）／ladder 内の `[取消]`（`orderCancelled`）・`[発注を取り消した]`（`orderUnplace`）。`data-action` 委譲（`app.js` のディスパッチャに登録）。インライン onclick 禁止。
- 押下時は既存の自作確認モーダル（`modal.js`）で「AAA 買 $368×81 を約定にします」と確認 → `POST /order-sheet/events`（`rev` 付き）→ 返ってきた注文表で再描画。409 は「他で更新されました。再読み込みします」と表示して再取得。
- 一部約定・指値を変えて発注した等の細かい入力は v1 では UI に出さない（Claude 経由で events を送る・§8.3）。
- 外部値（銘柄・note）は `escapeHTML` を通す。

## 8. 約定検知と運用

### 8.1 mf-holdings の `qty`（PR4）
- `scripts/fetch_mf.py` の `build()` で、行に `shares` があれば `rec["qty"] = r["shares"]`（数値）を足す。`sanitize_for_public()` は `qty` を消さない（公開可）。
- `tests/test_fetch_mf.py` に「shares あり→qty 出力／なし→キー無し」を追加。
- `data/mf-import-config.json` の `schema` 説明に `qty`（任意・株数/口数）を追記（データ構造の変更）。
- **Mac 実機確認要**（MF ログインが要る）。PR に明記し、Mac mini で 1 回実行して `qty` が入ることを確認してからマージ。

### 8.2 本人申告
- アプリのボタン（§7.3）か、Claude に「XLU 売れた」と言う → Claude が `POST /order-sheet/events`（§8.3）。

### 8.3 対話中の Claude（マネックス MCP）— 運用手順（PR6 で `docs/order-sheet-ops.md` に書く）
1. マネックス MCP で約定一覧・保有株数・注文一覧を読む。
2. `GET /order-sheet/plan` で plan と `rev` を取る。
3. 約定した段に `filled`（`source: "mcp"`）、新しく出した注文に `placed`（実際の `orderedQty`・`orderedLimit`）、消した注文に `unplace` を送る。指値を変えて出し直したら `unplace` → `placed`。
4. `GET /order-sheet` で次の段・資金繰りを確認して本人に伝える。
- PIN ハッシュは対話環境の環境変数から使い、会話ログ・Issue・コミットに貼らない。

### 8.4 イベント駆動の見直し
- 見直しの合図: 雇用統計・CPI・FOMC・FOMC 議事要旨・日銀・ISM・保有銘柄の決算・約定・大きな値動き（§6.10 のフラグ）。
- 経済カレンダーは Briefing（Mulmo）のものを使う。portfolio 側はカレンダーを持たない（v1）。見直した主体（Mulmo／対話中の Claude）が `rebase`（基準価格の取り直し）・`review`（見直しの記録）を送る。注文表の末尾に最終見直し（event・時刻）を出す。
- 構造化カレンダー（例 `data/event-calendar.json` を Mulmo が書く）は v1 の範囲外。必要になったら別設計。

## 9. 初期データの投入（10/3 確定値）

- **公開リポに実値を書かない**。PR6 で次を用意する:
  - `docs/order-sheet/plan.example.json`: §3.1 の形の**合成値**サンプル（架空ティッカー）。
  - `scripts/order-plan.mjs`: `node scripts/order-plan.mjs get|put|validate <file>`。`put` は `worker/src/order-plan.js` の `validatePlan` を先に通し、`WORKER_URL`（既定 `https://portfolio-proxy.shoulang.workers.dev`）と `MF_PIN_HASH`（Mac mini の既存環境変数）で `PUT /order-sheet/plan` を呼ぶ。**入力ファイルがリポジトリ内のパスなら拒否**する（誤コミット防止）。値を標準出力に出さない（件数と rev のみ）。
  - `.gitignore` に `*.order-plan.json` と `private/` を追加（保険）。
- 手順（Toshio・Mac、PR3 デプロイ後）:
  1. リポ外（例 `~/private/2026-10-03.order-plan.json`）に plan を作る。10/3 確定の段（Wiki の投資判断ログ 2026/10/3）を、§3.1「初期データの形」に従って入れる（`limit`＝指値、`amountUsd`＝指値×株数、working＝各銘柄の 1 段目、`placedAt` は既に発注済みなら時刻を入れる）。全売り銘柄は `tier:"exit"`・`qty:"all"` の sell 段 1 つ。
  2. `node scripts/order-plan.mjs validate <file>` → `put <file>`。
  3. アプリの Briefing タブで注文表を開き、10/3 の手計算（JPST の売却株数・全段の不足額・ストレス）と照合する。差があれば**非公開の場（対話）で**原因を確認する（定義差は §6 の既定・§12 の要判断で吸収）。
- Claude（対話）が代行する場合も同じスクリプトを使い、plan ファイルはリポ外に置く。

## 10. 対象ファイル一覧

| ファイル | 状態 | PR | 内容 |
|---|---|---|---|
| `worker/src/order-plan.js` | 新規 | PR1 | `validatePlan`・`applyEvent`・`detectFills`・`normalizeYSymbol`（純関数） |
| `worker/src/order-sheet-calc.js` | 新規 | PR1 | `buildOrderSheet`（§6 全部・純関数） |
| `tests/order-plan.test.js` | 新規 | PR1 | 検証・遷移・自動検知（§5 の例を含む） |
| `tests/order-sheet-calc.test.js` | 新規 | PR1 | §6 の前後比較例・ガード・資金繰り・ストレス・自動売り発議が出ないこと |
| `data/target-allocation.json` | 変更 | PR2 | `aiTech`・`stress`・`orderSheet` キー追加（既存キーと値は不変） |
| `src/target-allocation.js` | 変更 | PR2 | `getAiTechConfig`・`getStressConfig`・`getOrderSheetConfig`（未設定時は §3.2 の既定値） |
| `tests/target-allocation.test.js` | 変更 | PR2 | 新キーの形・既定値のテスト |
| `worker/src/index.js` | 変更 | PR3 | 4 ルート・レート制限対象追加・Cron に約定確定・ヘッダ一覧コメント更新 |
| `tests/worker-order-sheet.test.js` | 新規 | PR3 | ハンドラの意味論（PIN 必須・409・400・KV 書き込みしない GET） |
| `scripts/fetch_mf.py` | 変更 | PR4 | `qty` 出力 |
| `tests/test_fetch_mf.py` | 変更 | PR4 | `qty` のテスト |
| `data/mf-import-config.json` | 変更 | PR4 | schema 説明に `qty` |
| `src/holdings-from-mf.js` | 変更 | PR4 | typedef に `qty?` のみ（挙動不変） |
| `src/order-sheet.js` | 新規 | PR5 | 取得・描画・申告 |
| `src/briefing.js` | 変更 | PR5 | ストリップ呼び出し・再フィット |
| `src/app.js` | 変更 | PR5 | data-action 登録 |
| `assets/02-tables.css`（または 03-misc.css） | 変更 | PR5 | `os-` 接頭辞のクラス |
| `index.html` | 変更 | PR5 | `?v=` 全 bump（新 script はバンドル経由なら追加不要。読込方式は既存に合わせる） |
| `e2e/*.spec.js` | 変更/新規 | PR5 | `/order-sheet` をモックしてストリップ表示・申告で再描画（合成値） |
| `docs/order-sheet-ops.md` | 新規 | PR6 | 運用手順（§8.3・§9）・Mulmo 向け申し送り（§11）の正本 |
| `docs/order-sheet/plan.example.json` | 新規 | PR6 | 合成値サンプル |
| `scripts/order-plan.mjs` | 新規 | PR6 | 投入スクリプト |
| `.gitignore` | 変更 | PR6 | `*.order-plan.json`・`private/` |
| `CLAUDE.md` | 変更 | PR6 | Worker ルート一覧に 4 ルート追加 |

## 11. Mulmo への申し送り（`docs/briefing-generation-spec.md` は変えない。Issue で提案）

1. **注文表の数値を Briefing HTML・`valuations.json`・Wiki など公開される場所に書かない**（`data/briefings/**` は公開リポ）。注文表はアプリの Briefing タブが PIN で取得して iframe の上に出す。Briefing 本文で触れるなら「注文表はアプリ上部」程度にする。
2. 発議を出す前に `GET /order-sheet`（`X-Pin-Hash`。Mac mini の既存 `MF_PIN_HASH` と同じ値。どこに置くかは要 Toshio 判断 #8）を読み、次に反する発議をしない:
   - `ladders[].hold = targetReached` の銘柄に押し目買いを出さない。
   - buy の段がある銘柄にトリム・売りを出さない（本人の段階買いと逆行）。sell は plan の sell 段に限る。
   - テーマ上限・AI/テック上限は `data/target-allocation.json`（#668 後の値）に従う。
3. イベント（雇用統計・CPI・FOMC・議事要旨・日銀・ISM・保有銘柄の決算）の後の Briefing 生成で、必要なら `POST /order-sheet/events` に `rebase`（基準価格の取り直し）と `review` を送る。基準価格の決め方（終値・直近高値など）は Mulmo の SKILL.md で決める（portfolio 側は値を受け取るだけ）。
4. SKILL.md（Mulmo 側 `data/skills/briefing/SKILL.md`）の追従は Mulmo が行い、完了を Issue に報告する。
5. Discord 配信は今回やらない（D2）。

## 12. 要 Toshio 判断（既定案で実装は進める）

| # | 論点 | 既定案（本書の仕様） |
|---|---|---|
| 1 | 「総資産の何%」の分母 | `totals.imported`（Value/Risk タブと同じ）。MF 総資産（mfNetWorth）ではない |
| 2 | AI/テック合計の上限値 | 29%（本人発言「最終形≈29%を許容」）。PR2 のレビューで確定 |
| 3 | 現金 12% ガードの現金の定義と判定時点 | 既存の現金比率（生活資金 ¥20M 控除・JPST 含めず）を現時点で判定。working 段は止めない |
| 4 | 既存の米ドル預り金を JPST より先に充てるか | 充てる（`funding.useUsdCash: true`）。KV の設定で切替可 |
| 5 | ストレスで「株」に数えないもの | `JPST`・`GLDM`・`SLV`・現金・暗号資産。「AI」＝semiconductor＋megatech（ai_power は含めない） |
| 6 | 「大きな値動き」の閾値 | 基準価格から ±5% で再計算推奨（自動では変えない） |
| 7 | 表示場所 | Briefing タブの iframe の上のストリップ（新タブは作らない）。代案＝Value タブ上部 or 新タブ「注文」 |
| 8 | Mulmo に PIN ハッシュを渡すか | 渡す（Mac mini の既存 `MF_PIN_HASH` を Mulmo の実行環境でも読む）。渡さない場合 Mulmo は注文表を読めず §11-2/3 ができない |
| 9 | 範囲外の本人決定（8050 確信保有・SMH＋200A 二重保有は意図的）の設定化 | 本書の範囲外。`triggers.json`（8050 の thesis 売り）等は #668 と同様の別 Issue で扱う |

## 13. 受け入れ条件（全体）
- [ ] 品質ゲート green：vitest / eslint / prettier / check:types / check:circular / e2e（各 PR）
- [ ] 目標額・tier・段・状態が KV `order:plan` にあり、`GET /order-sheet` が「今出す注文」を**指値×株数**（＋金額・約定後の $ と総資産%・目標%・次の段）で返す
- [ ] 1 銘柄につき working は常に 1 段。`filled` で次の段が working（要発注）になる。mf の株数増で自動検知され、Cron で確定する
- [ ] USD の買いが売り代金と米ドル預り金で足りないとき JPST の売却株数が出る。全段の合計が資金を超えると不足額が出る
- [ ] 現金比率 < 12% のとき各銘柄の最深段が「停止」と表示され、資金計算から外れる
- [ ] AI/テック合計（現在・今の注文後・全段約定後）と 2 つのストレスの落ち込み（同 3 時点・許容 20% 併記・株比率）が出る
- [ ] 注文表は plan に無い売りを出さない（テスト：テーマ上限超過・目標超過の状態でも sell 行が増えない）。#668 マージ後の Value/Briefing で SMH トリム・TSLA 買い禁止が出ない（#668 の受け入れ条件）
- [ ] 目標到達の銘柄に buy 行が出ない
- [ ] 未ログインでは注文表のストリップも通信も出ない。全ルートが PIN 無しで 401
- [ ] 公開リポ（コード・テスト・docs・PR/Issue 本文・Actions ログ）に実値が無い

## 14. 触ってはいけない範囲
- `data/target-allocation.json` の既存キーと値（`themeCaps`・`convictionPct`・`conviction` 等）・`data/triggers.json`（#668 の担当）。PR2 は新キーの追加だけ。
- `verifyPinHash`・`/networth`・`/positions` の既存挙動、`corsHeaders`、`isAllowedOrigin`。レート制限は対象パスの追加だけ。
- `data/mf-holdings.json` の既存フィールドと `sanitize_for_public()` の除去対象（`qty` を足すだけ）。
- `src/networth.js` の集計定義（現金比率の式は Worker 側で**同じ式を再実装**し、networth.js は変えない）。
- `docs/briefing-generation-spec.md`・`data/briefings/**`（Mulmo の正本）。
- 投資判断の正本値（`valuations.json` の閾値・%タイル判定・`score()`）。
- 自動の書き手が書くファイル（CLAUDE.md「データの書き手」表）。

## 15. PR 分割と順序

```
#668（別途進行）──▶ PR2 戦略設定 ──┐
PR1 計算モジュール ─────────────────┴▶ PR3 Worker ──(デプロイ)──▶ PR5 アプリ表示
PR4 mf qty（独立・Mac 実機）                         └──────────▶ PR6 運用・投入・CLAUDE.md
```

| PR | 内容 | 依存 | 並走 | Toshio 確認 | Mac 実機 | Worker デプロイ |
|---|---|---|---|---|---|---|
| PR1 | 計算・検証・遷移の純関数＋テスト | なし | PR2・PR4 と並走可 | 要（KV のデータ形状を定義） | 不要 | 不要（未接続） |
| PR2 | 公開の戦略キー追加＋読み出し関数 | #668 マージ後（同ファイルの衝突回避） | PR1・PR4 と並走可 | 要（`data/*.json` のキー） | 不要 | 不要 |
| PR3 | Worker 4 ルート・レート制限・Cron 確定 | PR1（PR2 は無くても既定値で動く） | PR4 と並走可 | 要（`worker/**` の認証・レート制限） | 不要 | **要**（マージ後 Toshio が `npx wrangler deploy`＋curl 確認） |
| PR4 | mf-holdings に `qty` | なし | 全 PR と並走可 | 要（資産データ・`scripts/fetch_mf*.py`・schema） | **要** | 不要 |
| PR5 | Briefing タブの注文表 UI＋申告 | PR3 マージ＆デプロイ | PR6 と並走可 | 要（公開/非公開の境界） | 不要 | 不要 |
| PR6 | 運用手順・合成サンプル・投入スクリプト・.gitignore・CLAUDE.md | PR3（ルート確定後） | PR5 と並走可 | 要（`CLAUDE.md`） | 投入時に Mac で実行（PR 自体は不要） | 不要 |

- 実装 PR は各子 Issue を `Closes`。index.html の `?v=` bump は PR5 だけ。
- 全 PR で reviewer は公開リポ検査（実値・PIN ハッシュ・口座名が差分に無いか）を行う。

## 16. 公開リポの確認（本書の自己点検）
- [x] 銘柄ごとの目標額・段の指値/株数・売却株数・資金不足額・ストレスの実測値を書いていない（例はすべて合成値・架空ティッカー）
- [x] 口座名・PIN ハッシュ・Worker の秘密を書いていない
- [x] 公開側に置くのは比率と条件（AI/テック上限・ストレス条件・現金下限）だけ（C3）
