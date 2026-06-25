# Handoff（2026-06-25）: Risk タブ 地域カード 円グラフ復活＋3カードにアイコン（#502 への追補）

> ✅ **実装完了（2026-06-25・PR#510 / Issue#509 クローズ）**＝地域ドーナツ復活・タイトル「地域」・マザーマーケット偏りを円グラフ下へ・3カードにアイコン。PM盤面モニタで完了確認。
> 設計＝Mulmo。実装は VS Code が本 doc を正本に着手。**1タスク=1ブランチ=1PR=1Issue**。
> #502（信号機仕上げ）実装後のレビュー指摘。**表示層のみ**の小改修。
> 視覚リファレンス（確定形）＝`docs/handoff/assets/2026-06-25-risk-region-restore-v8-mock.html`（ブラウザで開く）。ユーザー承認済み。

## 背景／ゴール
#502 の地域カード改修で、**もともと表示されていたルックスルー円グラフ（ドーナツ）を誤って削除**してしまった（構成バーに置換）。円グラフを復活させ、その上でマザーマーケット（日本）への偏りを明示する。あわせて「アセットクラス／通貨／セクター」3カードの見出しにアイコンを付ける。

---

## タスクA — 地域カード（円グラフ復活＋マザーマーケット偏り）
対象: `src/risk-charts.js` `buildRegionCard`／`assets/02-tables.css`。

1. **円グラフ（ドーナツ）を復活**。#502 以前（#451 実装）で動いていた **D3 ドーナツ機構**（`buildChartCard` の PALETTE／凡例描画、`computeTrueRegionExposure().pct` を流し込む形）を地域カードに戻す。スライス＝日本／北米／欧州／新興国／現金等、凡例に各%。**日本スライスはアクセント色で強調**。
   - #502 で入れた「地域構成バー（横棒）」は撤去し、ドーナツ＋凡例に戻す。
2. **カードタイトルを「地域の傾き」→「地域」** に変更（`title.textContent`）。
3. **マザーマーケット（日本）偏りの説明は円グラフの"下"** に配置（順序＝タイトル → ドーナツ＋凡例 → マザーマーケット偏りバナー → 注記）。
   - バナー内容: home アイコン＋「マザーマーケット（日本）への偏り」＋ `日本 真% (例 41.3%)`＋1行 `世界株指数(ACWI)の日本比率5%に対し +X.Xpt（約N倍）。世界平均より日本に厚い。`（`japanHomeBias()` の `japanPct/benchPct/biasPt` を使用＝**新規計算なし**）。
   - ACWI は**到達目標ではなく参考値**の扱い（#502踏襲）。注記1行 `ACWI 5%は世界平均の参考値で、合わせる必要はなく日本への傾きの目安`。
4. home アイコンを SVG スプライトに追加（下記§C）。

> ⚠ load-bearing: `computeTrueRegionExposure`／`japanHomeBias`／`region-*.json` のロジック・スキーマは不変。**表示層の差し替えのみ**。

---

## タスクB — アセットクラス／通貨／セクター 3カードにアイコン
対象: `src/risk-charts.js` `buildChartCard`（`.risk-grid` 内の各ドーナツカード見出し `TITLES[dim]`）／`assets/02-tables.css`。

- 各カード見出し（`risk-card-title` 相当）に**先頭アイコン**を付与（既存リスク要約/クオンツ/地域カードと同じ `.ric` 18px・stroke 1.7・`var(--accent)`）。
- dim → アイコン対応:
  - `asset`（アセットクラス）→ `#i-assetclass`（円グラフ＝構成）
  - `currency`（通貨）→ `#i-currency`（紙幣）
  - `sector`（セクター）→ `#i-sector`（2×2区画グリッド）
- 実 dim キー名はコードに合わせる（`RISK_DIMENSIONS` の `assetClass`/`currency`/`sector` 等）。`country` はグリッドから除外済み（地域カードへ一本化済み）。

---

## §C — SVG スプライトに追加するアイコン（#502で導入済みスプライトへ追記）
```html
<symbol id="i-assetclass" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.2"/><path d="M12 12V3.8M12 12l7 3.6"/></symbol>
<symbol id="i-currency" viewBox="0 0 24 24"><rect x="3.4" y="6.6" width="17.2" height="10.8" rx="2.2"/><circle cx="12" cy="12" r="2.7"/><path d="M6.4 9v6M17.6 9v6"/></symbol>
<symbol id="i-sector" viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.4"/><rect x="13" y="4" width="7" height="7" rx="1.4"/><rect x="4" y="13" width="7" height="7" rx="1.4"/><rect x="13" y="13" width="7" height="7" rx="1.4"/></symbol>
<symbol id="i-home" viewBox="0 0 24 24"><path d="M4 11.5L12 5l8 6.5"/><path d="M6 10.5V19h12v-8.5"/><path d="M10 19v-4.5h4V19"/></symbol>
```
- すべて `fill:none;stroke:currentColor;stroke-width:1.7`・`aria-hidden`。既存の shield/coin/target/expand/layers/history/pulse/link/globe/book/warn と同型。

---

## 受け入れ条件（チェックリスト）
- [ ] 地域カードに**ドーナツ円グラフ＋凡例**が表示される（#502で消えた円グラフが復活）。日本スライスがアクセント色で強調。
- [ ] カードタイトルが「**地域**」（「地域の傾き」でない）。
- [ ] **マザーマーケット偏りの説明は円グラフの下**（順序：タイトル→円グラフ→偏りバナー→注記）。
- [ ] アセットクラス／通貨／セクターの3カード見出しに**アイコン**が付く（自前SVG・stroke統一）。
- [ ] 品質ゲート green／`?v=` 全 bump／色は CSS変数のみ・`!important` 禁止・`escapeHTML`／`assets/*.css` に prettier 一括をかけない。

## 触ってはいけない範囲
- `computeTrueRegionExposure`／`japanHomeBias`／`region-*.json`／`computeRiskBreakdown` の**算出ロジック・スキーマ**（表示層のみ）。
- #502 で実装済みの ①要約 ②クオンツ ③用語解説（地域以外）には触れない。
- `dist/app.js`（CI自動ビルド）。

## ブランチ／PR／Issue
- ブランチ `feat/risk-region-donut-restore`、base `main`、squash。`Closes #509`。
