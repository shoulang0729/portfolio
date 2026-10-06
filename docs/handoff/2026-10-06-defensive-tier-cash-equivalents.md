# Handoff: 守り枠の具体値（GLDM 6%・XLU 削除・現金同等 ETF・守り枠の表示）（#753）

- **Issue**: #753 `target-allocation.json: 守り枠の具体値（GLDM 6%・XLU削除・現金同等ETF・守り枠の構成）`
- **難易度**: medium（データ 1 ファイル＋アプリ 4 ファイル＋Worker 1 ファイル。計算の定義変更がアプリと Worker の両方にまたがる）
- **分担**: 設計＝architect（本 doc）／実装＝implementer／レビュー＝reviewer／Worker のデプロイ＝Toshio または Mac セッション（Toshio の依頼時）
- **区分**: 確定（2026-10-04 本人決定・#753 本文の値。Mulmo 経由で Toshio が「任せる」と確認）。§9 の質問は推奨の既定で設計済み
- **Toshio 確認**: **要**＝PR1（データ構造：`data/target-allocation.json` に最上位キー `cashEquivalents` を追加）・PR2（資産データ：`src/networth.js`）。PR3（Worker の計算のみ）は「マージ前の確認」の対象外だが、マージ後に Worker のデプロイが要る

## 実装ログ（implementer が更新）
- [x] PR1（データ＋実データのテスト）#754 / マージ e0af43c / Mulmo への連絡（§8）2026-10-06（#753 にコメント・Toshio が Mulmo に伝達）
- [x] PR2（アプリ: 現金比率の定義・集中度の除外・守り枠の表示）#756 / マージ 0f4c057 / Pages 反映 2026-10-06
- [x] PR3（Worker: 注文表の現金比率・ストレス）#755 / マージ 6976fbf / デプロイ 2026-10-06 Version 5f787c5e / Order タブで「現金 X% / 下限 12%」の値が Risk タブの現金枠と一致 2026-10-06（Toshio 目視 OK）

---

## 0. 決定事項（前提・#753 本文）
1. `tiers.defensive.targets.GLDM = 6`。`override.GLDM` は削除（override が先に効くため、残すと 8 のまま）。
2. `tiers.defensive.targets.XLU` を削除（2026-10-02 に全部売却）。
3. 最上位に `cashEquivalents: ["JPST", "SGOV", "BIL", "SHV"]` を追加。銘柄ごとの目標%は持たない（守り枠の `cash` の中で数える）。
4. **現金比率 ＝（現金・預金 − 生活防衛資金 ＋ cashEquivalents の評価額）÷ 分母**。生活防衛資金の扱いは今の `src/networth.js` のまま。分母は今どおり（`denominator: "managedAssets"`＝コード上は `totals.imported`）。
5. `orderSheet.cashFloorPct: 12` は据え置き。判定には 4 の現金比率を使う。
6. テーマ・集中度・単一銘柄の目標の計算では、cashEquivalents を株として数えない。
7. `stress.nonEquity: ["JPST", "SGOV", "BIL", "SHV", "GLDM"]`（SLV は 2026-10-05 に全部売却したので外す）。
8. `tiers.defensive.targets: { "GLDM": 6, "cash": 12.5 }`（合計 18.5）。`tiers.defensive.rule: "目安の帯（外れたら妥当性を見直す）"`。
9. GLDM は現金枠（下限 12%）に数えない。**守り枠の表示 ＝ 現金枠 ＋ GLDM**。
10. `updated: "2026-10-06"`。

本 doc は上の値をそのまま使う。閾値（5–20% の帯・下限 12・目標 12.5・GLDM 6）を新たに決めたり変えたりはしない。

## 1. 背景・ゴール

### 1.1 背景（今の実装の調査結果）
`data/target-allocation.json` の読み手と、関係する計算は次のとおり（2026-10-06 の main）。

| 読み手 | 読むキー | 関係する計算 |
|---|---|---|
| `src/target-allocation.js` | 全体（`override`→`tiers.*.targets`→`themeEtfs`→`themeCaps`+`conviction` の順で target% を解決）・`aiTech`・`stress`・`orderSheet`（既定値つき） | `getTargetPct`・`getConviction`・`computeGap`・`computeThemeUsage`・`get*Config` |
| `src/valuation-tab.js` | 上のヘルパー経由 | Value タブの「サイズ乖離」（target% バー）。分母＝`getMfTotals().imported` |
| `src/risk-charts.js` | 上のヘルパー経由 | Risk タブ「リスク要約」: ①投資用キャッシュ比率（`getMfTotals().cashRatio`・5–20% の帯）②最大集中（テーマ／**単一銘柄**＝全 positions の最大）③過大ポジ（gap > 0.5pt）④テーマ上限超過 |
| `src/networth.js` | （読まない） | `getMfTotals().cashRatio = max(0, 現金・預金 − EMERGENCY_FUND) ÷ imported`。JPST は含まない |
| `src/render.js` | （読まない） | 統計バー「投資用キャッシュ」＝`dryPowder`（金額・マスク対象）＋`cashRatio`（%・常時表示） |
| `worker/src/order-sheet-calc.js`（`routes-order-sheet.js` が raw main から取得） | `themeCaps`・`convictionPct.high`・`aiTech`・`stress`・`orderSheet` | §6.7 現金比率（networth.js と同じ定義・**JPST 含めず**）→ 現金ガード（`cashFloorPct`）／§6.9 ストレス（`stress.nonEquity` は株に数えない） |
| Mulmo（日次バッチ） | `denominator`・`themeCaps`・`themeEtfs`・`aiTech`・`stress`・`orderSheet`・`conviction`（`docs/interfaces.md` §2） | Briefing の「キャッシュ比率＝投資用キャッシュ ÷ 運用資産」（`docs/briefing-generation-spec.md`）。**`tiers`・`override` は読まない** |
| `data/scheduler/*` | 読まない（`target-gap.mjs` はアナリスト目標株価の乖離で無関係） | — |
| テスト | `tests/target-allocation.test.js` が実データを読む（`stress` を完全一致で検査＝今の値のままだと PR1 で落ちる） | — |

- `tiers`・`override` を読むのは `src/target-allocation.js` だけ。`tiers.*` は `targets` 以外のキーを読まない（`note` を足しても無害）。
- **守り枠（現金枠＋GLDM）を表示している画面は今は無い**。現金比率は統計バーと Risk の①に、GLDM は Value タブの行と Risk の③（過大ポジ）に別々に出ているだけ。
- 公開ファイル `data/mf-holdings.json` には既に保有ごとの `ySymbol`・`value` がある（JPST の行を含む）。現金同等 ETF の評価額はこの既存の値から**実行時に計算するだけ**で、新しい金額をどのファイルにも書かない。

### 1.2 ゴール
- GLDM の目標がどこから参照しても 6（`getTargetPct('GLDM') === 6`・Value タブのバー・Risk の過大ポジ）。
- 守り枠の目標に XLU が出ない。
- 現金比率（統計バー・Risk・注文表の現金ガード）に JPST など cashEquivalents の評価額が入る。
- cashEquivalents は株として数えない（ストレスの株区分・Risk の単一銘柄の最大集中）。
- Risk タブに「守り枠」＝現金枠＋GLDM＝合計を、目標と並べて表示する。

## 2. 用語と数値の定義

### 2.1 現金比率（アプリと Worker で同じ式）
```
emergencyFund   = 今の networth.js / order-sheet-calc.js の定数（値は変えない）
dryPowder       = max(0, Σ「現金・預金」 − emergencyFund)        ← 今のまま
cashEquivJpy    = Σ mf の保有行のうち ySymbol（正規化後）が cashEquivalents に入る行の value（円）
investCash      = dryPowder + cashEquivJpy                         ← 新
cashRatio (%)   = investCash ÷ imported × 100                      ← 分子だけ変わる・分母は今のまま
```
- 生活防衛資金は「現金・預金 − 生活防衛資金」を **0 で下止めしてから** cashEquivalents を足す（今の `max(0, …)` を変えない＝決定事項 4「networth.js のまま」の解釈。§9 Q4）。
- cashEquivalents の評価額は **mf の行の `value`（円）**を使う（アプリはライブ価格を使わない。Worker も `groups` の `valueJpy` を使い、qty×ライブ価格にしない）。アプリと Worker で同じ値になるようにするため。
- 照合は **mf の行の `ySymbol`** だけで行う（大文字化・前後空白除去。Worker は既存の `normalizeYSymbol`）。アプリの positions の `ySymbol` は投信の proxy（例: `isProxy:true` で ySymbol に短期債 ETF を当てる行）を含むので使わない。

**前後比較の例（合成値・単位は任意）**: imported 1,000／現金・預金 150／生活防衛資金 50／JPST 40／GLDM 60

| | 今 | 変更後 |
|---|---|---|
| dryPowder | max(0, 150−50) = 100 | 100（同じ） |
| cashEquivJpy | —（数えない） | 40 |
| 現金比率 | 100 ÷ 1,000 = **10.0%** | (100+40) ÷ 1,000 = **14.0%** |
| 現金ガード（下限 12） | guardActive = true（最深段を停止） | guardActive = false |
| 統計バー「投資用キャッシュ」 | 金額 100・10.0% | 金額 140・14.0%（金額と%が同じ定義） |

下止めの例（合成値）: 現金・預金 30／生活防衛資金 50／JPST 40／imported 1,000 → `max(0, 30−50) + 40 = 40` → **4.0%**（下止めしないと 2.0%）。

### 2.2 守り枠の表示（Risk タブ）
```
現金枠 (%)   = cashRatio（2.1）                目標 = tiers.defensive.targets.cash（12.5）・下限 = orderSheet.cashFloorPct（12）
GLDM (%)     = GLDM の現在%（Risk ③と同じ計算: positions の value ÷ 分母）   目標 = getTargetPct('GLDM')（6）
守り枠 (%)   = 現金枠 + GLDM                    目標 = 現金枠の目標 + GLDM の目標（18.5）
```
例（上の合成値）: 現金枠 14.0%（目標 12.5・下限 12）＋ GLDM 6.0%（目標 6）＝ 守り枠 20.0%（目標 18.5）。

- 目標値はコードに書かず `target-allocation.json` から読む（`tiers.defensive.targets` の `cash` と、`cash` 以外のキーの target%）。`cash` 以外の守り枠の銘柄は今は GLDM だけだが、**`tiers.defensive.targets` のキー（`cash` を除く）を列挙して行を作る**（銘柄を足しても表示側を変えずに済む）。
- 「目安の帯」の幅（何 pt 外れたら注意か）は決まっていないので、**守り枠には新しい判定（ピル・breach 加算）を付けない**。表示は「現在% ／ 目標%」と差（pt）だけ。既存の①の 5–20% の判定（`cashOut`・breach）は変えない（§9 Q2）。

### 2.3 集中度・テーマ・単一銘柄から外す
- `isCashEquivalent(sym)`（`src/target-allocation.js`・新）＝ `getCashEquivalents()` に入るか（大文字化して照合）。
- Risk ②の「単銘柄が最大なら」のループ（`buildRiskOverviewCard` の `for (const p of positions)`）で、`!p.isProxy && isCashEquivalent(p.ySymbol || p.symbol)` の行を飛ばす。
  - 例（合成値）: JPST 9%・MSFT 4%・テーマ最大 8% → 今は「最大集中＝JPST 9%」、変更後は「テーマ 8%」。
- テーマ：cashEquivalents はどの `themeCaps.members` にも入っていない（PR1 のテストで保証する）。`getTargetPct` は cashEquivalents に対して **null を返す**（`tiers`・`override` に誤って入っても目標%を持たない＝「銘柄ごとの目標%は持たない」）。`getConviction` も null。
- 過大ポジ（③）・Value タブのサイズ乖離: target が null なので今どおり対象外（JPST の行はバーなしの表示のまま）。
- Worker：ストレスの株区分 `isEquity` で `cashEquivalents ∪ stress.nonEquity` を株に数えない（2 つのリストがずれても cashEquivalents は株にならない）。単一銘柄の上限（§6.6 `targetOverConvictionCap`）は plan の `thick`/`thin` だけが対象で、現金同等 ETF は plan に入らない（資金繰りの `sweepSymbol` は plan の外）。念のため cashEquivalents の銘柄はこの警告の対象外にする。

## 3. 対象ファイル一覧

| ファイル | PR | 状態 | 内容 |
|---|---|---|---|
| `data/target-allocation.json` | 1 | 変更 | §4.1 |
| `tests/target-allocation.test.js` | 1・2 | 変更 | PR1: 実データの検査を新しい値に。PR2: 既定値・新ヘルパーの単体テスト |
| `src/target-allocation.js` | 2 | 変更 | `cashEquivalents` の取得・判定ヘルパー、`getTargetPct`/`getConviction` で null、`ORDER_STRATEGY_DEFAULTS.stress.nonEquity` を新しい値に、守り枠の目標の取得ヘルパー |
| `src/networth.js` | 2 | 変更 | `getMfTotals()` の `cashRatio` を §2.1 に。`cashEquivalents`（円）・`investCash` を返す |
| `src/render.js` | 2 | 変更 | 統計バー「投資用キャッシュ」の金額を `investCash` に（%と同じ定義にそろえる） |
| `src/risk-charts.js` | 2 | 変更 | ②の単一銘柄から除外（§2.3）・①を「守り枠」セクションに拡張（§2.2） |
| `tests/networth.test.js` | 2 | 変更 | §2.1 の例（合成値）のテスト |
| `tests/risk-*.test.js`（新規可） | 2 | 新規/変更 | 守り枠の数値・単一銘柄の除外（純関数に切り出してテストする） |
| `index.html` | 2 | 変更 | `?v=` を bump（CSS・JS・SW 登録 URL すべて同じ値） |
| `assets/*.css` | 2 | 変更（必要なら） | 守り枠の行のスタイル（既存の `.rms-*` を流用。新色は CSS 変数のみ） |
| `worker/src/order-sheet-calc.js` | 3 | 変更 | `resolveStrategy` に `cashEquivalents`、§6.7 の `cashPct` を §2.1 に、`isEquity` に cashEquivalents、`DEFAULT_STRESS.nonEquity`、単一銘柄の上限の除外 |
| `tests/order-sheet-calc.test.js` | 3 | 変更 | 現金ガードの境目（合成値） |
| `docs/order-sheet-ops.md` | 3 | 変更 | §4 の「現金比率は生活資金控除・JPST 含めず」を「cashEquivalents（JPST 等）を含む」に |

## 4. 変更手順

### 4.1 PR1: `data/target-allocation.json`（＋実データのテスト）
変更後の該当部分（他のキー・値・並びは変えない。インデント 2・既存の書式に合わせる）:
```jsonc
{
  "updated": "2026-10-06",
  // denominator / note / unitUSD / probeUSD / convictionPct は変えない
  "tiers": {
    "core": { /* 変えない */ },
    "defensive": {
      "rule": "目安の帯（外れたら妥当性を見直す）",
      "note": "GLDM＝保険として保有を続ける。2026-09に縮小。全部売る予定はない。cash＝現金・預金−生活防衛資金＋cashEquivalents の評価額（GLDM は cash に数えない）。守り枠＝cash＋GLDM。",
      "targets": { "GLDM": 6, "cash": 12.5 }
    }
  },
  "cashEquivalents": ["JPST", "SGOV", "BIL", "SHV"],
  // themeCaps / conviction / themeEtfs / aiTech は変えない（SLV の扱いは §9 Q1）
  "override": {
    "AAPL": { "targetPct": 2.2, "note": "目標・薄め・2026-10-05" }   // GLDM を削除・AAPL は残す
  },
  "stress": {
    "tolerancePct": 20,
    "nonEquity": ["JPST", "SGOV", "BIL", "SHV", "GLDM"],
    "scenarios": [ /* 変えない */ ]
  },
  "orderSheet": { /* 変えない（cashFloorPct 12） */ }
}
```
- `cashEquivalents` の置き場所は `tiers` の直後（最上位）。`note` は `tiers.defensive` の中（`tiers.*` は `targets` 以外を読まれないので無害）。金額・口座名は書かない。
- `tests/target-allocation.test.js`（実データの describe）:
  - `real.stress` の完全一致を新しい `nonEquity` に更新。
  - 追加: `__setConfig(real)` で `getTargetPct('GLDM') === 6`・`real.override.GLDM === undefined`・`'XLU' in real.tiers.defensive.targets === false`・`real.tiers.defensive.targets` が `{ GLDM: 6, cash: 12.5 }`・`real.cashEquivalents` が 4 銘柄・cashEquivalents のどれも `themeCaps.*.members`・`themeEtfs`・`conviction` に無い。
  - 既定値のテスト（`config 未読込なら既定値`）は PR1 では触らない（コードの既定値は PR2 で変える）。合成の `TEST_CONFIG`（override が tier に勝つ解決順のテスト）は解決順の単体テストなので残す。
- PR1 だけをマージした時点の挙動（壊れないことの確認）:
  - アプリ: GLDM の目標が 6（tiers から解決）。`cashEquivalents` はまだ誰も読まない（無視される）。
  - Worker: raw main を読むので、マージ後数分で `stress.nonEquity` の新しい値が注文表のストレスに効く（SLV を外す・未保有の SGOV/BIL/SHV を足す）。デプロイ不要。`cashEquivalents` は PR3 まで無視される。
  - Mulmo: 読むキーのうち変わるのは `stress.nonEquity` だけ。`cashEquivalents` は新しいキーで、知らなければ無視される（§8 で連絡）。

### 4.2 PR2: アプリ
1. `src/target-allocation.js`
   - `export const CASH_EQUIVALENTS_DEFAULT = Object.freeze(['JPST', 'SGOV', 'BIL', 'SHV'])`（データと同じ値。config 未読込・キー欠落・型不正のときだけ使う。既存の `ORDER_STRATEGY_DEFAULTS` と同じ考え方）。
   - `getCashEquivalents(): string[]`（大文字化したコピー）・`isCashEquivalent(sym): boolean`（null/空は false・大文字化して照合）。
   - `getTargetPct(sym)`・`getConviction(sym)`：先頭で `isCashEquivalent(sym)` なら null（override・tiers より先）。
   - `getDefensiveTargets(): { cashPct: number|null, items: Array<{ symbol, targetPct }> }`（`tiers.defensive.targets` の `cash` と、`cash` 以外のキー。config 未読込なら `{ cashPct: null, items: [] }`）。
   - `ORDER_STRATEGY_DEFAULTS.stress.nonEquity` を `['JPST', 'SGOV', 'BIL', 'SHV', 'GLDM']` に（既定値テストも更新）。
   - 依存を増やさない（このファイルは import 無しのまま＝`networth.js` から import しても循環しない。`npm run check:circular` で確認）。
2. `src/networth.js`
   - `import { isCashEquivalent } from './target-allocation.js'`。
   - `getMfTotals()` に §2.1 を実装: `cashEquivalents`（円）・`investCash` を戻り値に追加し、`cashRatio = investCash / imported * 100`。`dryPowder`・`cash`・`securities`・`imported` の意味と値は変えない。
   - 照合は `x.ySymbol`（文字列化・trim・大文字化）。`ySymbol` の無い行（投信・現金）は対象外。
   - target-allocation が未読込でも既定リストで計算されるので、統計バーの初回描画とその後で値が変わらない。
   - ヘッダコメントの「キャッシュ比率 = 投資用キャッシュ ÷ 運用資産」に「投資用キャッシュ＝現金・預金−生活防衛資金（0 下止め）＋cashEquivalents の評価額（#753）」を足す。
3. `src/render.js`：「投資用キャッシュ」の金額を `mf.investCash` に（マスクの扱いは今のまま。%は常時表示のまま）。
4. `src/risk-charts.js`
   - ②：§2.3 のとおり単一銘柄のループで cashEquivalents を飛ばす。
   - ①：見出しを「守り枠」に変え、行を 3 つ（＋守り枠の銘柄の数だけ）にする。既存の `sec()`/`entry()` を使う:
     - 「現金枠（現金・預金−生活防衛資金＋現金同等ETF）」: 大きな数字＝`cashRatio`、補助＝「目標 12.5%・下限 12%」（値は `getDefensiveTargets().cashPct` と `getOrderSheetConfig().cashFloorPct` から）。トーンとピルは既存の `cashOut`（5–20%）のまま。
     - 「GLDM」: 大きな数字＝現在%、補助＝「目標 6%」。トーンは中立（判定しない）。
     - 「守り枠 合計」: 大きな数字＝合計%、補助＝「目標 18.5%」。トーンは中立。
     - 目標が取れない（config 未読込）ときは補助を出さない。数値の計算は純関数（例: `computeDefensiveTier({ cashRatio, defensiveItems: [{symbol, curPct, targetPct}], cashTargetPct })`）に切り出してテストする。
   - バナーの文言（`subBits`・`vs`）・breach の数え方は変えない。
5. `index.html` の `?v=` を bump。
6. テスト: `tests/networth.test.js` に §2.1 の 2 例（合成値・JPST の行を足した HOLDINGS）。既存の AC3（v4/v5 で集計が 1 円も変わらない）は `investCash`・`cashEquivalents` もキーに加える。`tests/target-allocation.test.js` にヘルパーのテスト（`getTargetPct('JPST') === null` を、`tiers` に JPST を入れた合成 config でも確認）。

### 4.3 PR3: Worker
1. `worker/src/order-sheet-calc.js`
   - `export const DEFAULT_CASH_EQUIVALENTS = ['JPST', 'SGOV', 'BIL', 'SHV']`。`resolveStrategy` に `cashEquivalents`（配列なら正規化して使う・無ければ既定）。
   - §6.7: `cashPct = (max(0, cashJpy − EMERGENCY_FUND_JPY) + Σ groups.get(k).valueJpy for k ∈ cashEquivalents) ÷ imported × 100`。`imported` と生活資金の定数は変えない。判定は今どおり「現時点」（資金繰りの JPST 売り後の値では判定しない・§9 Q3）。
   - コメント「§6.7 現金比率（生活資金控除・JPST 含めず・現時点）」を「cashEquivalents を含む・#753」に。
   - `isEquity`: `nonEquitySet` に cashEquivalents も入れる（`new Set([...stress.nonEquity, ...cashEquivalents].map(normalizeYSymbol))`）。
   - `DEFAULT_STRESS.nonEquity` を `['JPST', 'SGOV', 'BIL', 'SHV', 'GLDM']` に。
   - §6.6 の単一銘柄の上限: cashEquivalents の銘柄は対象外（`tier` の判定の前に除外）。
   - 返り値の形（`cash: { pct, floorPct, guardActive }`）は変えない（アプリの `order-sheet-view.js` は無改修）。
2. `tests/order-sheet-calc.test.js`：合成値で「JPST を足すと guardActive が true→false に変わる」境目、`cashEquivalents` が strategy に無いときは既定で数える、strategy の `nonEquity` から JPST を抜いても JPST はストレスの株に入らない。
3. `docs/order-sheet-ops.md` §4 の照合の注記を「現金比率は生活資金控除・cashEquivalents（JPST 等）を含む（#753 以降）」に。
4. `worker/**` を含むので、マージ後に Toshio（または依頼を受けた Mac セッション）が `cd worker && npx wrangler deploy`。確認は Order タブの「現金 X% / 下限 12%」が Risk タブの現金枠と同じ値になること（値はどこにも貼らない）。

## 5. 受け入れ条件

### 共通
- [ ] 品質ゲート green：`npm test` / `npm run lint` / `npm run check:types` / `npm run check:circular` / `npm run build`、E2E（`npm run test:e2e`）
- [ ] 差分・テスト・PR 本文・コミットメッセージに実額（資産・現金・保有額）・口座名を書かない。テストは合成値のみ（既存テストの架空の金融機関名に合わせる）
- [ ] `dist/app.js` を PR に含めない

### PR1
- [ ] `data/target-allocation.json` が §4.1 のとおり（`override.GLDM` 無し・`tiers.defensive.targets` が `{GLDM:6, cash:12.5}`・`cashEquivalents` 4 銘柄・`stress.nonEquity` 5 銘柄・`rule`・`updated`）。他のキーは変わっていない（`git diff` で確認）
- [ ] 実データのテストで `getTargetPct('GLDM') === 6`・XLU が守り枠に無い・cashEquivalents がテーマ・themeEtfs・conviction に無い
- [ ] PR 本文に「データ構造（最上位キー追加）＝needs-toshio」「Mulmo への連絡（§8）」を書く

### PR2
- [ ] `getMfTotals().cashRatio` が §2.1 の 2 例（合成値）どおり（14.0%・4.0%）。`investCash` と `cashRatio` が同じ定義
- [ ] 統計バーの「投資用キャッシュ」の金額が `investCash`（マスクは今どおり）
- [ ] Risk タブに「守り枠」＝現金枠・GLDM・合計の 3 行が出て、目標（12.5／下限 12・6・18.5）が JSON から読まれている（コードに数値を書いていない）
- [ ] Risk ②の単一銘柄の最大に cashEquivalents が出ない（合成値のテスト）
- [ ] `getTargetPct('GLDM') === 6`・`getTargetPct('JPST') === null`（tiers に入れた合成 config でも null）
- [ ] 既存の判定（①の 5–20%・バナー・breach の数え方・`getColor`・期間スケール・D3 のサイズ計算）は不変
- [ ] `?v=` を bump・data-action 委譲・escapeHTML・色は CSS 変数のみ・`!important` なし
- [ ] PR 本文に「資産データ（src/networth.js）＝needs-toshio」

### PR3
- [ ] 注文表の `cash.pct` が §2.1 と同じ式（合成値のテストで境目を確認）
- [ ] ストレスで cashEquivalents が株に数えられない（`stress.nonEquity` から抜いた合成 strategy でも）
- [ ] `cash` の返り値の形が変わらない（`tests/order-sheet-view.test.js`・`e2e/order.spec.js` が無改修で通る）
- [ ] PR 本文に「マージ後に Worker のデプロイが必要」

## 6. 触ってはいけない範囲
- 生活防衛資金の定数（`src/networth.js` `EMERGENCY_FUND`・`worker/src/order-sheet-calc.js` `EMERGENCY_FUND_JPY`）の値と、0 下止めの扱い。
- 分母（`totals.imported`）・`denominator` キー・`dryPowder` の意味。
- 閾値の値：`cashFloorPct`・`tiers.defensive.targets` の値・Risk ①の 5–20%・`convictionPct`・`themeCaps`・`aiTech.capPct`・`stress.tolerancePct`・`scenarios`。
- `override.AAPL`・`tiers.core`・`themeCaps`・`themeEtfs`・`conviction`（SLV を含む。§9 Q1）。
- Wealth タブの現金比率（`src/wealth.js` の `mf-history` の `cash ÷ 合計`＝別定義の推移グラフ）。本 Issue では変えない。
- `docs/briefing-generation-spec.md`（Mulmo の正本。変更は §8 の提案のみ）。
- 注文表の資金繰り（`plan.funding.sweepSymbol`＝JPST の売却株数の計算）・返り値の形・KV の書き込み。
- `getColor`・`src/positions.js` の期間スケール・D3 のサイズ計算・タブ/モジュール構成。

## 7. PR 分割と順番

| 順 | PR | ブランチ例 | Toshio 確認 | ?v= | Worker デプロイ | Issue |
|---|---|---|---|---|---|---|
| 1 | データ＋実データのテスト | `data/753-defensive-tier` | **要**（データ構造：最上位キー追加） | 不要 | 不要（Worker は raw main を読む） | `Refs #753` |
| 2 | アプリ（現金比率・集中度の除外・守り枠の表示） | `feat/753-cash-equivalents-app` | **要**（資産データ：`src/networth.js`） | **要** | 不要 | `Refs #753` |
| 3 | Worker（注文表の現金比率・ストレス）＋ops doc | `feat/753-cash-equivalents-worker` | 不要（認証・レート制限・CORS・KV 書き込みに触れない） | 不要 | **要**（マージ後） | `Closes #753` |

- **データを先にする理由**: PR1 だけをマージしても、アプリと Worker は新しいキーを無視し、GLDM 6・XLU 削除・`nonEquity` だけが効く（§4.1 の「PR1 だけの挙動」）。実データを読むテストは PR1 の中で直すので CI も壊れない。コードを先にしても既定値（`CASH_EQUIVALENTS_DEFAULT`）で動くが、データとテストの期待値が 2 つの PR に分かれるので採らない。
- PR2 と PR3 は互いに依存しない（並行で実装してよい）。ただし現金比率の定義が「アプリは新・注文表は旧」になる期間を短くするため、**PR2 と PR3 は続けてマージし、PR3 のデプロイまでを同じ日に行う**。その間に注文表とアプリの現金比率が食い違うのは既知の一時差。
- `?v=` を上げるのは PR2 だけ（他の `?v=` を上げる PR と並行させない）。

## 8. Mulmo への連絡（PR1 のマージ時に PM が #753 か Mulmo の窓口で伝える・下書き）

> `data/target-allocation.json` を #753 で変更しました（2026-10-06）。Mulmo が読むキーのうち変わったのは `stress.nonEquity` だけです（`["JPST","SGOV","BIL","SHV","GLDM"]`・SLV を削除）。
> 新しい最上位キー `cashEquivalents: ["JPST","SGOV","BIL","SHV"]` を追加しました。意味は「現金同等 ETF＝守り枠の現金に数える・株として数えない・銘柄ごとの目標%は持たない」です。アプリと注文表の現金比率は「（現金・預金 − 生活防衛資金（0 で下止め）＋ cashEquivalents の評価額）÷ 運用資産」に変わります（#753 の PR2・PR3 のマージ後）。
> お願い（提案）: (1) Briefing の「投資用キャッシュ／キャッシュ比率」を同じ定義にそろえるか検討してください（`docs/briefing-generation-spec.md` の変更は Mulmo の判断）。(2) テーマ・集中度・単一銘柄の判断で cashEquivalents を株として数えないでください。(3) `cashEquivalents` を読むようにしたら知らせてください（`docs/interfaces.md` §2 の「使うキー」に追記します）。
> GLDM の目標は 6%（`tiers.defensive`）、XLU は守り枠から削除しました（`tiers`・`override` は Mulmo の読むキーではないので参考情報）。

- `docs/interfaces.md` §2 の行は、Mulmo が実際に読むようになったと確認してから更新する（今は書かない）。

## 9. Toshio への質問（推奨の既定で設計済み・回答が違えばその PR だけ直す）
1. **SLV を `conviction`・`themeCaps.silver`・`themeEtfs` からも外すか**（#753 は `stress.nonEquity` からだけ外す指示）。**推奨: 今回は残す**。保有が無ければテーマ使用率 0・目標の表示だけで実害がない。テーマ上限の正本値の削除は Toshio の判断なので、外す場合は別 Issue（`silver` のラベル `THEME_LABELS` も合わせて）。なお 2026-10-06 の MF スナップショットにはまだ SLV の行がある（同期の遅れの可能性。値は確認していない）。
2. **Risk ①の「適正レンジ 5–20%」を下限 12・目標 12.5 に寄せるか**。**推奨: 今回は変えない**（帯の幅は「目安の帯」で未決。守り枠は表示だけで判定を付けない）。
3. **注文表の現金ガードを「資金繰りの JPST 売り後」の現金比率で判定するか**。JPST を現金に数えると、資金繰りで JPST を売って株を買うと現金比率が下がる。**推奨: 今どおり「現時点」で判定**（§6.7 の決定を変えない。売り後の値は将来の改善候補）。
4. **生活防衛資金を引いた結果がマイナスのとき**、0 で下止めしてから cashEquivalents を足すか（今の networth.js の扱い）、マイナスのまま足すか。**推奨: 0 で下止め**（「networth.js のまま」）。現金・預金が生活防衛資金を下回らない限り差は出ない。
5. **統計バー「投資用キャッシュ」の金額にも cashEquivalents を含めるか**。**推奨: 含める**（%と金額の定義をそろえる）。
