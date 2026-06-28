# レスポンシブ・レイアウト統一 — 実装指示書（handoff）

> 設計=Mulmo / 実装=VS Code。**見た目（レイアウト層）だけ**を直す。**業務仕様（ロジック・計算・load-bearing・D3の描画ロジック）は変えない。**
> 前提：デザイン統一（`docs/handoff/2026-06-26-design-system-unification.md`・#515）は P1〜P5 マージ済み。本書はその上に**レスポンシブ（iPhone/iPad/PCで破綻なく、広い画面では2カラムに広げる）**を載せる。
> 視覚リファレンス：`docs/handoff/assets/2026-06-28-responsive-grid.html`（iPhone1列 vs iPad/PC2列・Risk円グラフ2×2）／`docs/handoff/assets/2026-06-28-responsive-centered.html`（中央カラムの考え方）。

---

## 0. ゴール
- iPhone＝**1カラム**（現状維持）。iPad/デスクトップ＝**コンテンツ最大幅 1080px で中央寄せ＋2カラム**。
- 「広い画面で全幅に間延びする」を解消し、端末をまたいで破綻しない一貫レイアウトにする。
- ユーザー確定事項：**(1) デスクトップ全体上限 1080px・中央寄せ**／**(2) Risk の4円グラフ（国/通貨/セクター/地域）を1グリッドに統一して 2×2**（地域だけ全幅だった特例を解消）。モバイル基準カラム幅は約540px相当。

## 1. ★絶対に壊さない（DO NOT TOUCH）
1. **D3 チャートの描画ロジック**：Heatmap(treemap)・Risk(donut) は**コンテナ幅を読んでサイズを決める**。**サイズ計算・getColor・期間scale・凡例の色は変更しない**。コンテナ幅が変わる（最大幅cap＋2カラム）ので、**既存の resize/ResizeObserver ハンドラが新コンテナ幅で正しく再描画されることを必ず確認**（幅変化で歪む/潰れるのは回帰）。
2. **計算・state・配線**：`state.*`（heatSeg/sort 等）、`data-action` 委譲、ソート、KV/Worker、IndexedDB、含み損益/集中度/ルックスルー/PER% 等の算出。**不変**。
3. **機能CSSの挙動**：sticky ヘッダ／表の sticky 左列・横スクロール／列非表示（seg別）／モーダル／PTR。**保つ**。
4. **ビルド/CI**：`assets/*.css` に prettier をかけない／`dist/app.js` 手commitしない／`!important` 禁止・色はCSS変数のみ。
5. **テーマ**：light/dark 維持。

> 判断基準：**レイアウト（幅・列数・中央寄せ）が変わるのはOK、数値・計算・チャートの中身が変わるのはNG。**

## 2. アプリシェル（最大幅＋中央寄せ）
- コンテンツの最大幅トークンを追加：`:root{ --app-max:1080px; }`。
- **ヘッダ（sticky-top / stats / tab-bar）と各タブパネルの中身**を、同一の中央寄せコンテナに収める：
  ```css
  .app-shell{ max-width:var(--app-max); margin-inline:auto; }
  ```
  - ヘッダ内側・タブバー・各 `#panel-*` の中身に `.app-shell`（または同等の `max-width:var(--app-max);margin-inline:auto`）を適用し、**ヘッダと本文の左右端が揃う**ようにする。
  - `body` は背景・スクロール担当のまま。左右の余白（gutter）は `--bg` で埋まる。
- モバイル（`--app-max` 未満の幅）では実質全幅＝現状の見た目を維持。

## 3. タブ内のグリッド（モバイル1列／iPad・PC2列）
各タブパネルの中身を1つのグリッドで包む：
```css
.tab-grid{ display:grid; gap:12px; grid-template-columns:1fr; }
@media (min-width:760px){ .tab-grid{ grid-template-columns:1fr 1fr; } }   /* iPad/PC=2カラム */
.tab-grid > .span-all{ grid-column:1 / -1; }                              /* 幅広カードは全幅 */
```
- **カード（`.card`）＝グリッドのセル**＝iPad/PCで自然に2-up。
- **`.span-all` を付ける“幅広”要素**：表（Historical の `.sl-table` ラッパ）、Heatmap の treemap、Risk のリスク要約バナー／クオンツ、Value のレンズ行（セグメント）、Briefing の iframe ラッパ。

### タブ別ルール
- **Heatmap**：treemap は `.span-all`（最大1080幅をフル活用）。D3 は新コンテナ幅で再描画されること確認。
- **Historical**：セグメント行＋表は `.span-all`（表は2分割しない）。横スクロール・sticky列は維持。
- **Risk**：①リスク要約＝`.span-all` ②**国/通貨/セクター/地域の4円グラフ＝グリッドのセル（2×2）**＝`.risk-grid` の auto-fit をやめ、**地域カードも同じグリッドに入れる**（現状 `region-card{margin-top}` の全幅特例を撤廃しグリッド子要素化）。`grid-template-columns` は §3 の `.tab-grid` を流用（mobile1×4 / wide2×2）。③クオンツ＝`.span-all`。
- **Value**：レンズ（セグメント）＝`.span-all`。各銘柄カード＝セル＝iPad/PCで2-up。カード内のゲージ/チップ等の内部レイアウトは不変。
- **Briefing**：iframe ラッパは中央寄せ（最大約600px・`.span-all` 内で `margin-inline:auto`）。Briefing 本文は別経路（Mulmo）なので**生成物・spec には触らない**。

## 4. 段階ロールアウト（1フェーズ=1PR）
- **R1 アプリシェル**：`--app-max:1080px` 追加＋ヘッダ/タブバー/各パネルを中央寄せコンテナに。**モバイルは見た目不変**、iPad/PCで中央寄せ＋gutter。D3チャートが新コンテナ幅で正しく描画されることを確認（最重要テスト）。
- **R2 タブグリッド**：各パネルに `.tab-grid`＋`.span-all` を適用。**Risk 4円グラフを統一グリッドで2×2**（地域カードのグリッド子化）。Value カード2-up。
- **R3 仕上げ**：Heatmap/Briefing の幅・中央寄せ調整、ランドスケープ/分割表示など端末別の微調整、回帰掃除。

各PR：`index.html` の `?v=` 全bump・品質ゲート green。

## 5. 受け入れ条件
- [ ] iPhone（≤~430）＝1カラム・現状の見た目を維持（回帰なし）。
- [ ] iPad/デスクトップ＝コンテンツ最大1080px中央寄せ・2カラム。ヘッダと本文の左右端が揃う。
- [ ] **Risk の4円グラフが iPad/PC で 2×2（はぐれ無し）**、要約・クオンツは全幅。
- [ ] **Heatmap/Risk の D3 チャートが各幅で正しく再描画**（getColor出力・期間scale・サイズ計算は不変）。
- [ ] 表（Historical）は分割せず全幅・sticky列/横スクロール維持。
- [ ] light/dark 両方・縦横回転で破綻なし・意図しない横スクロール無し。
- [ ] 品質ゲート green・`?v=` 全bump。

— 設計：MulmoClaude（2026-06-28）。設計変更は口頭パッチせず本書を更新して再配布。
