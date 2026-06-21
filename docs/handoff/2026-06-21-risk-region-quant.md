# Handoff（2026-06-21）: Risk タブ 地域統合・カード余白・要約/クオンツ明確化

> 設計=Mulmo。実装は VS Code が本 doc を正本に着手。1タスク=1ブランチ=1PR=1Issue。
> ファイル: `src/risk-charts.js`／`src/risk-calc.js`／`src/region-calc.js`／`assets/02-tables.css`（risk CSS ≈427-578, 817-944）。

## 背景／ゴール
1. 「国・地域」ドーナツと「地域エクスポージャ（ルックスルー）」が**別データ・別分類で併存**し矛盾に見える → **ルックスルーを正に一本化**（ユーザー確定）。
2. 「対象 NNN 銘柄」カードの上下余白を対称化。
3. 「リスク要約」と「クオンツ・リスク」を**ひとつずつ理解できる**自己説明IAに。

---

## タスクA — 地域表示の一本化（ルックスルーを正・全資産カバレッジ）

### 現状（重複の正体）
- **①「国・地域」ドーナツ**（`risk-charts.js` `TITLES.country`、`buildChartCard('country')`、`.risk-grid` 内）：`computeRiskBreakdown` の curated バケット（japan/us/europe/em/latam/china/global/commodity）。全資産対象だが**広域ファンドを国に分解せず**「分散(global)」スライスとして残す。
- **②「地域エクスポージャ（ルックスルー）」カード**（`risk-charts.js buildRegionCard`、`region-calc.js computeTrueRegionExposure`）：別ファイル `data/region-map.json`＋`data/region-weights.json` で**広域ファンドを地域へ按分**（オルカン/ひふみ等）。分類が細かい（japan/north_america/europe/em_latam/em_asia/china_hk/global/commodity_cash）。**証券のみ**（現金/暗号未カバー）。hero に **日本 真% / ACWIベンチ5% / ホームバイアス ±Xpt**。テキストリスト（チャート無し）。
- ユーザー視点では「分散20%」(①) と「北米60%/日本25%」(②) が同じ問いへの矛盾回答に見える。

### 設計（確定：統合）
**1つの `.risk-card`「地域（ルックスルー）」に統合**：
1. **hero を維持**：日本 真% ｜ ACWIベンチ5% ｜ ホームバイアス ±Xpt（見出しインサイト）。
2. **ドーナツ＋凡例を1つ**：`computeTrueRegionExposure().pct` を `buildChartCard` のドーナツ/凡例/PALETTE 機構に流し込む（curated `country` ドーナツを置換）。テキストリストだった地域ビューにチャートが付き、誤解を生む「分散」スライスが消える。
3. **鮮度ノート維持**：既存「静的・四半期更新／鮮度 asOf」（region-weights が静的なので必須）。
4. **`.risk-grid` から `country` を外す** → グリッドは アセットクラス/通貨/セクター の3つに。
5. **全資産カバレッジに拡張（確定）**：`buildRegionCard` に `assets`（= positions + manualAssets）を渡し、現金/暗号は `commodity_cash` に寄せてカバレッジを正直に保つ。`region-calc.js computeTrueRegionExposure` が証券前提の箇所を「現金/暗号は commodity_cash 固定」で受けられるよう拡張。カバレッジ% を hero 近傍に表示。

> ⚠ load-bearing: `region-map.json`/`region-weights.json` のスキーマ・`japanHomeBias` 算出は壊さない。ドーナツ化は表示層の差し替えで、地域分類ロジックは保持。

---

## タスクB — 「対象 NNN 銘柄」カードの余白対称化
- 対象: `.risk-summary` バー（`risk-charts.js` `summary.className='risk-summary'`、`対象 N 銘柄 ┃ 分類済み N ┃ 分類不明 N`）。
- 原因: CSS（`assets/02-tables.css` ≈559-568）が `margin-bottom:12px` のみで**上マージン無し**＝上に詰まって見える。padding 自体は `8px 10px` で縦は対称。
- 修正:
  ```css
  .risk-summary {
    margin: 12px 0;   /* was margin-bottom:12px → 上下対称 */
    padding: 10px;    /* was 8px 10px → 縦横揃える（他カード default に寄せるなら 14px） */
  }
  ```

---

## タスクC — リスク要約 / クオンツ・リスクの明確化

### 全指標の一言説明（実装の凡例/tooltip原文に使う）
| 指標 | 算出 | 一言説明 | 良い向き |
|---|---|---|---|
| 投資用キャッシュ比率 | `totals.cashRatio` | 投資資産のうち現金の割合 | 5〜20%が適正（外れ赤） |
| 過大ポジ | `computeGap>0.5` | 目標配分より持ちすぎの銘柄数 | 少ない=良い(0件) |
| 最大集中 | テーマ/単銘柄の最大% | 一番偏っているテーマor銘柄と比率 | 低い=良い(>20%赤) |
| テーマ上限超過 | `computeThemeUsage>cap` | 上限超過テーマのチップ | なし=良い |
| 年率ボラ | `annualizedVol`=stdev×√252 | 1年あたりの値動きの激しさ | 低い=安定(>20%警告) |
| 最大DD(PF) | `maxDrawdown` | 過去のピークから谷までの最大下落率 | 0に近い=良い |
| 最悪1日/1週/1月/3月 | `worstReturn`/`worstWindow(5/21/63)` | 各期間で最も損した下落幅 | 浅い=良い |
| 高相関ペア(≥0.85) | `highCorrelationPairs` | ほぼ同じ動きの銘柄ペア（分散不足） | なし=良い |
| リスク寄与Top3 | `vol×|β|` 降順 | PF全体のリスクを一番押上げる銘柄 | (情報提示) |
| ベータ(β) | `betaTo`=cov/var | 各銘柄がPF全体に対しどれだけ振れるか | 1未満=PFより穏やか |
| 流動性 出口日数 | `computeLiquidity` 株数÷(ADV×参加率) | 売り切るのに何営業日かかるか | 短い=良い |

> 注: HHI/相関は**算出されていない**（「最大集中」は単一max%）。`eventStress`（ストレスシナリオ）は別カードで使用。

### 現状の分かりにくさ
1. 要約末尾の `※ ベータ・相関は下段クオンツカード(4b)を参照`／クオンツの「Phase 4b」など**内部フェーズ用語が露出**。
2. 「ストレス」が2箇所で別意味：クオンツ内 `ストレス（過去1年の最悪局面）` と別カード `ストレスシナリオ（現PFが当時を再体験したら）`。
3. 相関ペア/リスク寄与/流動性で**生ティッカー**（`9983.T`）表示（`nameOfSymbol` で名称化可能）。
4. β/DD/ボラに**閾値の手掛かりが無く色のみ**。しかも `.rq-sev` が `var(--up)`（上昇色）にマップ＝「悪い数字を上昇色」で意味が逆に感じる。

### IA 提案
- **要約（一目で「今ヤバいか」）**＝配分ベース（履歴不要）：キャッシュ比率/最大集中/テーマ上限超過/過大ポジ を維持。**先頭に総合判定チップ（緑/黄/赤）**＝閾値抵触があるか1目で。`※…4b参照` を削除し中立文言に。
- **クオンツ（履歴ベース・どれくらい振れる/沈むか）**＝3小節に整理＋各小節1行凡例：
  - **値動き**（年率ボラ・最大DD）／**最悪局面**（最悪1日〜3ヶ月）／**分散・流動性**（高相関ペア・リスク寄与Top3・出口日数）。
  - 各ラベル下に小凡例：`年率ボラ（大きいほど振れる・20%超注意）`／`β（1超でPFより大きく振れる）`／`最大DD（過去最大下落・浅いほど安全）`。既存の `_stat(label,…)` ビルダに `hint` 引数（`var(--text3)` 小文字 or `title` tooltip）を追加。
  - **生ティッカー→`nameOfSymbol(sym)`**（ティッカーは副次表示）。
  - **色トークン修正**：「悪い」数字は `var(--neg)`/`var(--warn)` を使い（`.rq-sev` の `var(--up)` を是正）、閾値抵触に ⚠ グリフ（ストレスカードの ⚠ と一貫）。グレースケールでも意味が残る。
  - **2つの「ストレス」を区別**：クオンツ内を `過去1年の最悪局面（実績）`、別カードを `歴史的危機の再現（what-if）` に改名。

---

## 受け入れ条件
- [ ] 地域は「地域（ルックスルー）」1カードに統合：hero＋ドーナツ＋凡例＋鮮度ノート、`.risk-grid` は3つ、カバレッジに現金/暗号含む＋カバレッジ%表示。「分散」スライス・二重表示が無い。
- [ ] 「対象 NNN 銘柄」カードの上下余白が対称。
- [ ] 要約＝総合判定チップ＋4指標、内部フェーズ用語なし。クオンツ＝3小節＋凡例＋名称表示＋色是正＋⚠＋ストレス2種の名称区別。
- [ ] 品質ゲート green／`?v=` 全 bump／color はCSS変数のみ・`!important`禁止・escapeHTML。

## 触ってはいけない範囲
- `region-map.json`/`region-weights.json` スキーマ・`japanHomeBias`・`computeTrueRegionExposure` の地域分類ロジック（表示層の差し替えのみ）。
- `risk-calc.js` の各指標算出式・`eventStress`（ストレスシナリオカード）。
- `dist/app.js`・`assets/*.css` への prettier 一括。

## ブランチ／PR／Issue
- ブランチ `feat/risk-region-quant`、base `main`。`Closes #<Issue>`。
