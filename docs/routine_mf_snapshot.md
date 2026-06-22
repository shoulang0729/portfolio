> # ⚠️ 廃止（SUPERSEDED・2026-06-22）
> **この「Claude for Chrome に貼る」方式は使わない。** 構造が「外部URLの設定とWebページ内容を"従う命令"扱い（このルールにのみ従う）」＝プロンプトインジェクション温床で、LLM が正しく実行を拒否する（実際に拒否された）。
> **後継＝決定論ローカル自動化**：`scripts/fetch_mf.py`（Playwright・LLMなし・決定論）＋ Mac mini launchd。正本＝`docs/handoff/2026-06-21-mf-snapshot-automation.md`。
> **この文書を claude.ai / Claude for Chrome の予定タスクに登録しないこと。既存の `snapshot-holdings` 等の予定タスクは削除する（毎朝のinjection拒否アラートの原因）。**

# MF スナップショット更新（定常・Claude for Chrome）【廃止・履歴参照のみ】

目的: MoneyForward の銘柄ごと評価額を読み取り、`data/mf-holdings.json` を更新して main に直接コミットする。下流（日次ルーティン／Heatmap）はこの raw を読んで自動追従する。

頻度: 週1目安（Toshio が任意のタイミングで起動）。
前提: Chrome で MoneyForward にログイン済み、かつ GitHub にログイン済み。

> なぜ `portfolio-snapshot.json` を直接編集しないか: あちらには各銘柄の `performance` 履歴が埋まっており手編集で壊れるため。MF からは履歴を持たない単純ファイル `data/mf-holdings.json` のみを上書きする。

---

## プロンプト（Claude for Chrome にそのまま貼る）

あなたは私の資産スナップショット更新を手伝うアシスタントです。**MoneyForward 上では閲覧・読み取りのみ**を行い、発注・設定変更・送信は一切しないでください。GitHub 上では**指定ファイル1つの編集コミットのみ**を行います。

### Step 0: 取り込みルールを読む
次の raw を取得し、JSON として解釈する。以降このルールにのみ従う:
`https://raw.githubusercontent.com/shoulang0729/portfolio/main/data/mf-import-config.json`

### Step 1: MF を読む
`https://moneyforward.com/bs/portfolio` を開く。`include.categories` に挙がったカテゴリの**銘柄ごと**に、次を読み取る:
- 金融機関/口座名（→ `institution`。どの口座の資産か）
- カテゴリ（→ `cat`）
- 銘柄名（→ `name`）/ コードまたはティッカー（→ `ySymbol`・証券のみ）
- 取得単価（平均）（→ `avgCost`・証券のみ・取れなければ省略）
- 現在値 / 基準価額（→ `price`・証券のみ・取れなければ省略）
- **評価額（時価・円）（→ `value`）** ← 最重要
- 通貨（→ `cur`）

### Step 2: 除外を適用
- `exclude.accounts` のいずれかに**部分一致**する口座の資産は**すべて捨てる**。
- `exclude.holdings` に一致する銘柄も捨てる。
- `include.categories` に無いカテゴリは最初から対象外。

### Step 3: 整形（mf-holdings.json の形にする）
残った銘柄を次の配列に変換する。`cat` は `categoryToCat` に従う:
- 日本株/ETF（4桁コード or .T）→ cat `"日本株・ETF"`, ySymbol `"<コード>.T"`
- 米国株/ETF → cat `"米国株・ETF"`, ySymbol = ティッカー
- 投信→`"投資信託"` / 債券→`"債券"` / 年金→`"年金"` / 暗号資産→`"暗号資産"` / 預金・現金→`"現金・預金"` / FX・商品先物→`"FX・商品先物"` / その他→`"その他"`
- `cash.includeInPositions` が true の場合、預金・現金も1件=1レコードで入れる（`cat="現金・預金"`, `value=金額`, `cur=通貨`。`ySymbol`/`avgCost`/`price` は付けない）。

出力 JSON 形（これを丸ごと mf-holdings.json の中身にする・正規スキーマ v4）:
```json
{
  "asOf": "<実行日 例 2026-06-14>",
  "totals": {
    "mfNetWorth": <MF総資産(画面表示)>,
    "imported": <Σ取り込みvalue>,
    "excludedAccounts": ["<除外した口座/金融機関名>", "..."]
  },
  "holdings": [
    { "institution": "マネックス証券", "cat": "米国株・ETF", "name": "アップル", "ySymbol": "AAPL", "avgCost": 208.92, "price": 308.33, "value": 9072672, "cur": "USD", "asOf": "2026-06-14" },
    { "institution": "三井住友銀行", "cat": "現金・預金", "name": "円普通預金 JPY", "value": 32747, "cur": "JPY", "asOf": "2026-06-14" }
  ]
}
```
スキーマ規約（`mf-import-config.json` の `schema` が正本）:
- **必須フィールド**: `institution` / `cat` / `name` / `value` / `cur` / `asOf`。
- **証券のみ任意**: `ySymbol`（日本株/ETF=`<コード>.T`、米国=ティッカー）/ `avgCost` / `price`。現金・暗号資産は省略可。
- `totals.excludedAccounts` は**除外口座名の配列**（額の合計ではない）。
- 旧版にあった top の `source` / `configVersion`、holding の `account`(→`institution`に改名)・`symbol`・`shares`・`costPrice`・`currentPrice`・`currency` は**廃止**。
- 数値はカンマ・通貨記号を除いた数値のみ。不明な任意項目は省略（0埋めしない）。
- ★フロント `src/networth.js` が読むのは `holdings[].cat` / `holdings[].cur` / `holdings[].value` / `totals.imported` / `asOf` の5つ。ここは名前変更・欠落させないこと。

### Step 4: チェックサム（合わなければ中止）
`checksum.enabled` が true のとき:
- `imported` == **Σ(holdings.value)** を厳密一致で確認（`totals.imported` は取り込んだ評価額の合計そのもの）。
- `imported` ≈ `mfNetWorth − Σ(除外口座のMF表示額)` を **±`tolerancePct`%** で確認。
- さらに口座ごとに Σ(その口座の holdings.value) ≈ MF のその口座合計表示 を確認。
- **1つでも外れたらコミットしない。** どの口座/カテゴリで何円ズレたかを報告して停止する。

### Step 5: コミット（チェックサム通過時のみ）
`https://github.com/shoulang0729/portfolio/blob/main/data/mf-holdings.json` を開く（無ければ `data/` 配下に新規作成）。鉛筆アイコンで編集に入り、**ファイル全体を Step 3 の JSON で置き換える**。コミットメッセージ `data: refresh MF holdings snapshot (YYYY-MM-DD)`、**Commit directly to the main branch** を選んでコミット。

### Step 6: 報告
コミットの URL、`imported` 額、`mfNetWorth` との差、除外した口座名を1〜2行で報告する。

---

## 運用メモ
- 口座を増減したら `mf-import-config.json` の `exclude.accounts` を見直す（必要なら `routine_mf_discovery.md` を再実行）。
- 桁ズレ・読み取り不能が頻発するカテゴリがあれば、そのカテゴリを `include.categories` から外して手動管理に回す。
- 将来 ③（アプリ側に専用取り込み口＋自動マージ）へ発展させる場合も、この `mf-holdings.json` を入力にできる。
