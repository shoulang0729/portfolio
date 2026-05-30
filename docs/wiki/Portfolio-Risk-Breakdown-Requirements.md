# ポートフォリオ・リスク断面タブ 要件定義

新タブ「リスク断面」の要件定義。複数の円グラフでポートフォリオの**リスクの取り方**（通貨・国/地域・セクター・資産クラス）を可視化する。

> ステータス: **Phase A 実装済み（[PR #199](https://github.com/shoulang0729/portfolio/pull/199)・v=20260530A）／ Phase B 未実装** / 作成: 2026-05-30
>
> - **Phase A（実装済み）**: フロント完結。curated 分解データ + look-through 集計 + D3 ドーナツ4枚 + タブ。
> - **Phase B（未実装）**: Worker `/etf/constituents` + Cron 週次 + 公式 CSV による ETF のライブ構成銘柄化。実装可能単位は §9 と GitHub Issue を参照。

---

## 1. 目的・背景

現状の Portfolio Heatmap は「銘柄ごとの騰落率・含み損益」は見えるが、**「自分がどの種類のリスクをどれだけ取っているか」という断面が見えない**。

特に投信/ETF が「1つの塊」としてしか扱われないため、次のような**隠れたリスク偏り**が把握できない:

- 円建て投信（オルカン等）の中身が実は米国株 = 実質的に大きなドルエクスポージャーを取っている
- 複数のファンド・個別株を合算すると、特定セクター（例: テック）に集中している
- コモディティ・債券をどれだけ持っているか

これを解消するため、保有銘柄を**透過（look-through）して構成銘柄まで分解**し、リスク軸ごとに集計して円グラフで可視化する。

---

## 2. リスク軸の定義（プロ視点の根拠つき）

look-through 分析で機関投資家が標準的に見る軸のうち、本ポートフォリオ（日本株 + 米国株 + 投信/ETF）に実用的な **4軸** を採用する。

| 軸 | 内容 | 狙い |
|---|---|---|
| **資産クラス** | 株式 / 債券 / REIT / コモディティ / 現金 | 「コモディティ何%」もここで可視化。最も根源的な軸 |
| **通貨エクスポージャー** | JPY / USD / EUR / その他（実質ベース） | 円建て投信の中の "隠れドル比率" まで分解 |
| **地域・国** | 日本 / 米国 / 欧州 / 新興国 / 中国 等 | 地理的な偏りを把握 |
| **セクター/業種** | GICS 準拠（テック / 金融 / ヘルスケア…） | 業種集中を把握 |

将来拡張（Future Work）として、**集中度**（上位N銘柄・単一銘柄比率）、**スタイル**（大型/小型・バリュー/グロース）を候補に置く。

---

## 3. 集計ロジック（look-through 計算式）

- 各保有ポジション `p`（評価額 `p.value`、JPY）を、その構成銘柄 `c`（ウェイト `w_c`、合計 1.0）に分解する。
- 各構成銘柄は属性（通貨・国・セクター・資産クラス）を持つ。
- リスク軸 `D` のカテゴリ `k` への配分額:

  ```
  配分額(D, k) = Σ_p Σ_c ( p.value × w_c × [ c の D 属性 == k ] )
  ```

- 円グラフは軸ごとにカテゴリ別配分額を % 表示する。
- **個別株**は「自分自身がウェイト 1.0 の構成銘柄」として同じロジックに乗る。
- 構成比が判明していない残差（後述の日本アクティブ投信など）は **「その他/不明」スライス** として正直に表示する。

---

## 4. データモデル拡張

現状 `src/positions.js` の銘柄は `cat` / `cur` / `ySymbol` / `isProxy` のみで、**セクター・国・資産クラス・構成銘柄のフィールドが無い**。新たに以下を定義する。

### 構成銘柄テーブル

```js
constituents[ySymbol] = {
  asOf: '2026-05-30T00:00:00Z',     // 取得日（鮮度判定用）
  source: 'ishares'|'yahoo'|'finnhub'|'curated',
  coverage: 1.0,                     // 判明している構成比合計（0..1）
  holdings: [
    {
      ticker, name, weight,          // weight: 0..1, Σ ≒ coverage
      currency, country, sector, assetClass
    },
    // ...
  ]
}
```

### 属性の付与

- **個別株**: セクター/国は Finnhub `/stock/profile2`（`finnhubIndustry`・`country`、無料枠可）、通貨は `p.cur`、資産クラス = `equity`。
- **キュレーション上書き**: API で取れない/不正確な銘柄（日本投信の国別比率など）は静的 JSON `data/constituents-overrides.json` で補完する。

---

## 5. データソース戦略（無料 + キュレーション、ファンド種別ハイブリッド）

> **重要な調査結果（2026-05 実地確認）**: 「全ファンド一律フル構成銘柄（Level 2）」は**日本籍アクティブ投信で構造的に不可能**。取得可否はファンド種別で大きく異なるため、種別ごとのハイブリッド戦略を採る。

| 保有種別 | フル構成 | 一次ソース | フォールバック |
|---|---|---|---|
| 個別株 | ◎（自分自身） | Finnhub `/stock/profile2`（業種・国） | `cat` / `cur` から推定 |
| 米国上場ETF（proxy 含む: ACWI 等） | ◎ | iShares / Vanguard **公式日次フル保有CSV**（無料・認証不要、CORS 回避に Worker `/etf/constituents` 経由） | Yahoo `quoteSummary?modules=topHoldings,fundProfile`（上位10 + セクター比率） |
| インデックス投信（オルカン / eMAXIS Slim） | ◎（近似） | 連動指数 = 中身。proxy ETF の公式 CSV で代用（既存 `isProxy` / `ySymbol`） | curated 指数配分マップ |
| **日本アクティブ投信（ひふみ等）** | **✗ 上位10止まり** | 取れる**上位10銘柄**のみ + 残りは「その他」 | 国/業種は `data/constituents-overrides.json` の curated 近似 |

- Yahoo は既に Worker `/yahoo` プロキシ経由で取得可能。`topHoldings` で `sectorWeightings`・上位保有・`equityHoldings` / `bondHoldings` が取れる。
- 国別比率は API カバレッジが弱いため、**指数ごとの代表的地域配分を curated マップで補完**（例: ACWI ≒ 米国 60% / 他）。

### 既知の制約（Limitations）

**日本籍アクティブ投信のフル構成銘柄は Web で月次取得できない。** 各ソースの公開範囲を実地確認した結果:

| ソース | 公開範囲 |
|---|---|
| みんかぶ投信 | 上位20まで。**全銘柄・業種別・国別・資産配分はプレミアム会員限定で数値非表示** |
| ウエルスアドバイザー | 上位10のみ（業種/国/資産配分なし） |
| レオス公式 月次レポート | 上位10のみ |
| 運用報告書 PDF | 全銘柄が載るのは**年1〜2回のみ**（月次更新不可） |

→ よってひふみ等は **「上位10銘柄 + その他N%」** で表示し、**カバレッジ率（判明している構成比合計）を UI に明示**する。

Web スクレイピングは**非推奨**: (a) 上位10止まりで "フル" にならない、(b) PDF パースが必要、(c) 各サイトの利用規約・robots、(d) 月次で全銘柄は構造的に不可能 — 費用対効果が低い。

円グラフは常に「判明分の属性集計 + 残差 = その他/不明」で**正直に**描画する設計とする。

---

## 6. 更新方針（週次）

- 既存 Worker Cron（`scheduled()`、現状 1日4回の価格キャッシュ）を拡張する。
- 構成銘柄は値動きより低頻度で十分 → **週1回ローテーション取得**（1 Cron 実行で数銘柄ずつ取得し負荷分散）。
- 鮮度判定: `(now - asOf) > 7日` で再取得対象。
- キャッシュ: Worker KV（`constituents:<ySymbol>`）+ クライアント側 IndexedDB。実装は `src/historical-cache.js` のパターン（`<key>:<symbol>` で IDB store、`ts` / `asOf` で鮮度管理）を踏襲する。

---

## 7. UI 要件

- 新タブ「**リスク断面**」（`data-tab="risk"`）を `index.html` のタブバー + `<section id="panel-risk">` に追加。
- **4つのドーナツ/円グラフ**（資産クラス・通貨・地域/国・セクター）をグリッド配置。
- D3 v7.8.5 はロード済みだが**円グラフは未実装** → `d3.pie()` + `d3.arc()` で新規 `src/risk-charts.js` を作成。`src/heatmap.js` の D3 描画パターンを参考にする。
- カテゴリ色は categorical scale（`d3.scaleOrdinal`）。テーマ整合のため `src/color.js` の `cssVar()` を流用。
- 描画オーケストレーションは `src/tabs.js` の `switchTab` にケースを追加し、`src/render.js` の per-tab render 方式に倣う。
- 凡例・ホバーで「カテゴリ名・金額・%」を表示。
- **カバレッジ表示**: 各円グラフに「判明している構成比合計（カバレッジ率）」を明示し、未判明分は「その他/不明」スライスとして描画する（日本アクティブ投信の上位10止まり対応）。

---

## 8. スコープ外 / Future Work

- **スコープ外（今回）**: 実コード実装、有料データ提供者連携。
- **Future Work**:
  - 集中度 / スタイル軸の追加
  - 複数ファンド横断の単一銘柄重複集中ビュー（Level 2 データを活用）
  - 債券のデュレーション / 格付け軸
  - `data/portfolio-snapshot.json` へのリスク断面集約

---

## 9. 実装フェーズ

### Phase A（実装済み・[PR #199](https://github.com/shoulang0729/portfolio/pull/199)）

フロント完結。外部依存ゼロで即動作・テスト可能。

- `src/constituents.js`: 保有銘柄の curated look-through 分解表（4軸ウェイト・summary 形式）
- `src/risk-calc.js`: `value × ウェイト` 集計・残差は「その他/不明」・軸別カバレッジ算出（DOM 非依存）
- `src/risk-charts.js`: D3 ドーナツ4枚 + 凡例 + 中央カバレッジ% + ホバー
- `assets/02-tables.css` / `index.html` / `tabs.js` / `app.js`: スタイル + タブ配線
- `tests/risk-calc.test.js`: 集計ロジック単体テスト8件

### Phase B（未実装・ETF をライブ構成銘柄化）

curated を実データに置換し、ETF/ファンドを公式保有データで透過する。実装可能単位
（GitHub Issue 化済み。`enhancement` ラベル）:

| # | 単位 | 概要 | 目安 |
|---|---|---|---|
| B1 | Worker `/etf/constituents` ルート + KV キャッシュ | `GET /etf/constituents?symbol=` で正規化済み holdings を返す。KV 鍵 `constituents:<symbol>`・`asOf` 付き | medium |
| B2 | ETF 公式保有 CSV アダプタ | iShares/Vanguard 等の日次フル保有 CSV を取得・パースし正規化 holdings に変換（CORS は Worker 経由） | hard |
| B3 | Yahoo `topHoldings` フォールバック | CSV 非対応銘柄向けに `quoteSummary?modules=topHoldings,fundProfile` でセクター比率+上位10+資産配分を取得 | medium |
| B4 | 個別株の属性付与（Finnhub `/stock/profile2`） | 個別株のセクター（`finnhubIndustry`）・国を取得しキャッシュ。curated 依存を削減 | easy |
| B5 | Cron 週次ローテーション取得 | 既存 `scheduled()` を拡張し数銘柄/実行で構成を更新。鮮度 `asOf > 7日` で再取得 | medium |
| B6 | クライアント側 構成銘柄キャッシュ（IndexedDB） | `historical-cache.js` パターンを踏襲し `constituents:<symbol>` を IDB 永続化 | medium |
| B7 | `risk-calc` を holdings-list 対応に拡張 | 現状の summary 形式に加え、Level 2 の holdings list からも per-dim 集計できるアダプタを追加 | medium |
| B8 | curated を `data/constituents-overrides.json` 化 + ロード/マージ | curated を JSON 外出しし、live データと優先順位マージ（live > curated > 既定推定） | easy |
| B9 | カバレッジ/鮮度/ソースの UI 表示強化 | `asOf` 表示・ソースバッジ（live/curated/推定）・古いデータの注意表示 | easy |

> 依存関係の目安: B1 ←(B2,B3) / B7 は B2,B3 の正規化形式に依存 / B8 は B7 と統合 / B5 は B1 完了後 / B6・B9 は独立。
> 1 Task = 1 ブランチ = 1 PR = 1 Issue。`Closes` は各 Issue の最終 PR のみ。

**対応 Issue**: B1 [#200](https://github.com/shoulang0729/portfolio/issues/200) ／ B2 [#201](https://github.com/shoulang0729/portfolio/issues/201) ／ B3 [#202](https://github.com/shoulang0729/portfolio/issues/202) ／ B4 [#203](https://github.com/shoulang0729/portfolio/issues/203) ／ B5 [#204](https://github.com/shoulang0729/portfolio/issues/204) ／ B6 [#205](https://github.com/shoulang0729/portfolio/issues/205) ／ B7 [#206](https://github.com/shoulang0729/portfolio/issues/206) ／ B8 [#207](https://github.com/shoulang0729/portfolio/issues/207) ／ B9 [#208](https://github.com/shoulang0729/portfolio/issues/208)

---

## 確定事項（要件決定の記録）

| 項目 | 決定 |
|---|---|
| リスク軸 | 資産クラス / 通貨 / 地域・国 / セクター の4軸すべて |
| 分解の深さ | Level 2: フル構成銘柄（ファンド種別でハイブリッド。日本アクティブ投信は上位10止まり） |
| データ取得 | 無料API + キュレーション（手動マップで補完） |
| 日本アクティブ投信の残差 | 「その他N%」表示 + カバレッジ率を UI に明示 |
| 更新頻度 | 週1回（Cron ローテーション） |
