# Handoff（2026-06-21）: Value タブ 詳細指標の自己説明化・行揃え・的中率/トリガー明確化

> 設計=Mulmo。実装は VS Code が本 doc を正本に着手。1タスク=1ブランチ=1PR=1Issue。
> **依存**: #443（カード統一・コア4チップ＋『詳細指標』tap展開）の**上に乗る**。#443 マージ後に着手するのが安全（detailHTML の器ができてから中身を整える）。

## 背景／ゴール
1. 「詳細指標」の各指標を**ひとつずつ理解できる**自己説明レイアウトにする（用語解説と二重管理しない）。
2. 詳細指標の**行の高さがバラバラ**→揃える。
3. ヘッダーの**的中率・トリガー**を、説明なしでも意味が分かる表示にする。

ファイル: `src/valuation-tab.js`（`detailHTML` 周辺・ヘッダ統計）／`assets/02-tables.css`（`.val-met`/`.val-stat`）／用語解説データ `src/glossary-data.js`。

---

## タスクA — 詳細指標の意味と自己説明IA

### 全指標の一言説明（実装の参照表＝用語解説/凡例の原文に使う）

| 指標 | 算出元 | 一言説明（非クオンツ向け） | 良い向き / 目安 |
|---|---|---|---|
| EV/EBITDA | `value.evEbitda` | 借金も込みで会社を丸ごと買ったら本業の儲け何年分か＝割安度 | 低いほど割安。〜8倍=割安/15超=割高 |
| FCF利回り | `value.fcfYield`(%) | 時価総額に対し自由に使える現金をどれだけ生むか（株の利回り版） | 高いほど割安。4〜5%超で妙味 |
| 株主還元 | `value.shareholderYield`(%) | 配当＋自社株買いで毎年株主に戻す現金の利回り | 高いほど良い。3%超で手厚い |
| 織込成長(逆DCF) | `reverse-dcf.js impliedGrowth(fcfYield,wacc)`・cyclicalは `—` | 今の株価が前提にしている将来FCF成長率を逆算 | 低〜中庸が安全。**7%超=期待過多**でVerdict driver付与 |
| 目標乖離 | `value.targetGapPct`(%)・符号色 | アナリスト平均目標株価と現値の差（＋=上値余地） | ＋大=良い（ただしアナリスト少だと当てにならない） |
| ROIC vs WACC | `quality.roic`/`quality.wacc`・roic<waccは赤 | 投じた資本の稼ぐ利率が調達コストを上回るか（下回ると稼ぐほど価値破壊） | ROIC>WACC必須・差が大きいほど良い |
| 粗利/資産 | `quality.grossProf`(Novy-Marx) | 資産規模に対し粗利をどれだけ生むか＝質の高い割安株の指標 | 高いほど良い。0.33超目安 |
| FCF変換 | `quality.fcfConv` | 帳簿利益が実際の現金にどれだけ化けるか（低い=見かけ倒し疑い） | 高いほど良い。1.0近辺以上が健全 |
| Altman Z | `quality.altmanZ`・<3で注意色 | 倒産の起きにくさを合成した安全度 | **3超=安全圏 / 1.8未満=危険** |
| Qスコア | `quality.qScore`(0〜9)・品質レンズのソートキー | 品質指標を束ねた総合の「稼ぐ力」点数 | 高いほど良い。7〜9が健全 |
| 改定90d | `momentum.epsRev90d`(%) | 直近90日でアナリストが利益予想を上方/下方修正した度合い | ＋=良い（上方修正） |
| 1Y騰落 | `momentum.priceMom1Y`・履歴liveで補完・符号色 | 直近1年の値上がり率（モメンタムのソートキー） | 文脈依存・日本式 上昇=赤/下落=緑 |
| 52週位置 | `momentum.pos52w` | 過去1年の値幅の中で今が安値寄り(0%)か高値寄り(100%)か | 用途次第（高=高値圏/低=底値圏） |
| 対市場 | `momentum.rsVsSector`(=銘柄1Y−ACWI1Y) | 世界株平均より強かったか弱かったか＝地合いを除いた個別の実力 | ＋=市場に勝っている |

### IA 提案（詳細expandの自己説明化）
1. **正本は1箇所に集約**：個別13指標の説明文は**既設の用語解説 `glossary-data.js`（既に全指標収録）**を正とし、詳細expandには**重複定義を増やさない**。
2. **グループ・ミニ凡例**：詳細の3グループ見出し（バリュ/品質/モメンタム）の右に小さな `ⓘ`（native `details` か `title` 属性tooltip＝CSP安全・JS開閉禁止）。1行で「このグループで何を見るか」（バリュ=価格が割安か／品質=罠でないか・稼ぐ力／モメンタム=勢いと市場対比）＋「→用語解説」誘導。
3. **閾値を値の隣に併記（色だけに頼らない）**：例 `Altman Z 2.4 (<3⚠)`、`織込成長 9% (>7 期待過多)`、`ROIC 12% vs WACC 8%`。色覚配慮で記号も併記。
4. 既存 `glossaryHTML('value')`（`<details>` 用語解説）のスタイルと一貫させる。

---

## タスクB — 詳細指標の行高さを揃える

### 原因
`.val-met { display:flex; flex-wrap:wrap; gap:8px; }`（`assets/02-tables.css`）で、各指標が `<span><b>ラベル</b> 値</span>` の**1スパン・可変幅**。グループごとの指標数差（バリュ5/品質5/モメンタム4）＋ラベル長差（`EV/EBITDA` vs `1Y`）で折返し行数がばらつき、行高が不揃い。

### CSS 修正（ラベル/値の2列grid・推奨）
`.val-met` を flex → 2トラック grid にし、各指標を `<b>ラベル</b><span>値</span>` のフラットペアに変更（色付き `val-bad`/`val-warn` は値`<span>`側に維持）。
```css
.val-met {
  display: grid;
  grid-template-columns: max-content 1fr;  /* ラベル | 値 */
  column-gap: 8px; row-gap: 4px;
  align-items: baseline;
  font-size: 11px; color: var(--text2);
}
.val-met b { color: var(--text); font-weight: 500; white-space: nowrap; }
```
→ 1指標=1行で行高一定、ラベル列が縦に整列（最長 `EV/EBITDA` に幅が揃う）。グループ間の指標数差があっても各行は同じ高さ。
- `valuation-tab.js` の各グループビルダ（バリュ/品質/モメンタム）のテンプレを「`<b>ラベル</b><span>値</span>` の2要素出力」に変更。
- ⚠ `assets/*.css` に prettier 一括をかけない（該当ブロックのみ手編集）。

---

## タスクC — 的中率・トリガーの明確化

### 意味（実装の説明文に使う）
- **的中率（`computeHitRate` in `verdict-outcomes.js`）**：`data/verdict-outcomes.json` を集計。`X-Y = hits-misses`、pending は分母外。常に**対ACWI相対**で地合いを除く。
  - **発議(action)**：自分の売買アクションの質。buy=アウトパフォームでhit / sell=アンダーでhit。地平**≈21営業日(約1ヶ月)**。
  - **判定(verdict)**：エンジンのVerdict分類の精度。cheap=アウトパフォーム/rich=アンダーでhit。fair等は方向なしで対象外。地平**≈126営業日(約6ヶ月)**。
- **トリガー（`evaluateTriggers` in `triggers.js`）**：銘柄ごとの事前ルールを%タイル/PEG/テーマ集中度/価格で評価し `active`(抵触)/`watching`(監視中)に分類。ヘッダの「トリガー」値は **active な銘柄数**（watching は含まない）。active がカード上部のアクションバナー（▼トリム/▲積増/◦監視/▪維持）になる。

### 現状の分かりにくさ
1. `発議3-0 / 判定—` の `X-Y` が hits-misses と分からない（`-` が引き算に見える）。`title` の率%はモバイルで hover 不可。
2. 「トリガー」の数字が抵触数か登録総数か曖昧。watching が別なのも伝わらない。
3. 地平差(1ヶ月/6ヶ月)・対ACWI相対の前提がヘッダから見えない。

### 表示改善案
1. **ラベル意味化**：的中率を `発議 3/3` のような `hits/resolved`（または `当3 外0`）に。`-` 表記をやめる。「トリガー」→「抵触」に改名し watching を併記（例 `抵触 2・監視 4`）。
2. **tap-to-explain**：ヘッダ統計4枚（`.val-stat`）に小 `<details>` を1つ足し、3行で説明（「発議=自分の売買が約1ヶ月後に対ACWIで正しかったか」「判定=エンジンのcheap/richが約6ヶ月後に当たったか」「トリガー=事前ルールに今抵触している銘柄数」）。用語解説 `glossary-data.js` の「規律」カテゴリに定義が既にあるので誘導でも可。CSP安全な native details。
3. **pending可視化**：resolved=0で `発議—` の代わりに `発議 判定待ち3` 等「集計中」を明示し「データ無し」誤読を防ぐ。
4. 率が一定以上で軽いaccent色（色はCSS変数のみ・`!important`禁止）。

---

## 受け入れ条件
- [ ] 詳細expandの各指標が、グループ凡例＋閾値併記で**説明なしでも意味が分かる**。説明の正本は `glossary-data.js`（重複定義を増やさない）。
- [ ] 詳細指標の各行が**同じ高さ・ラベル列が縦整列**（2列grid）。モバイルで「灰色テキストの塊」感が解消。
- [ ] 的中率が `hits/resolved`（または当◯外◯）表記で `-` の誤読が無い。トリガーは「抵触」表記＋監視併記。tap説明あり。
- [ ] 品質ゲート green（vitest/eslint/prettier(srcのみ)/check:types/check:circular/e2e）。`?v=` 全 bump。
- [ ] data-action委譲・escapeHTML・色はCSS変数のみ・`!important`禁止。

## 触ってはいけない範囲
- `getValuation`/`computeVerdict`/`computeHitRate`/`evaluateTriggers` のロジック・フィールド名（読むだけ）。
- 並べ替え基準・サイズバー・アクションバナー・判定確度・#443 のコア4チップ構造。
- `dist/app.js`（CI自動ビルド）・`assets/*.css` への prettier 一括。

## ブランチ／PR／Issue
- ブランチ `feat/value-detail-stats`、base `main`（#443 マージ後）。`Closes #<Issue>`。
