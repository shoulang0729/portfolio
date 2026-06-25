# Handoff（2026-06-25）: Value 詳細 ―― 目安バー凡例の二重マーカー修正＋詳細トグルの視認性

> 設計=Mulmo。実装は VS Code。1タスク=1ブランチ=1PR=1Issue。**#504/PR#505（仕上げポリッシュ）のバグ修正**（軽微・見た目のみ）。
> 対象: `src/valuation-tab.js`（凡例 HTML・L304-313）／`assets/02-tables.css`（`.vg-legend*`/`.lg-*`・`.val-detail > summary`）／`index.html`(`?v=`)。

## 背景（ユーザー実機指摘）
詳細指標の「目安バーの見方」凡例で、各項目のマーカーが**2つずつ**見える:
- 「いまの値」に ◯ が **2個**
- 「目安ライン」に 白い縦線が **2本**
- 「同業中央値」に 縦線1本＋**謎の点**
- 加えて「詳細指標」トグルの ▸/▾ が**小さすぎて開閉が分からない**。

## 原因（確定）
凡例の各 `<li>`（valuation-tab.js L309-312）が **CSSスウォッチ（`.lg-sw .lg-mk/.lg-tick/.lg-peer/.lg-zone`）と、テキスト中の文字グリフ（●／│／┊）を二重に**持っている。スウォッチ＋グリフ＝マーカーが2つ見える。
```
<li><span class="lg-sw lg-mk"></span>● いまの値（この銘柄）</li>   ← .lg-mk の丸 ＋ 文字「●」＝2個
<li><span class="lg-sw lg-tick"></span>│ 目安ライン…</li>          ← 縦線 ＋ 文字「│」＝2本
<li><span class="lg-sw lg-peer"></span>┊ 同業中央値（破線）</li>   ← 破線 ＋ 文字「┊」＝謎の点
```

## 修正A ― 凡例の文字グリフ（●│┊）を削除（スウォッチだけ残す）
`valuation-tab.js` の凡例 `<li>` から **先頭の ●／│／┊ を削除**。CSSスウォッチ（実際のバー要素と同じ見た目）だけ残す。
```js
<ul class="vg-legend-items">
  <li><span class="lg-sw lg-zone"></span>良い範囲（目安）</li>
  <li><span class="lg-sw lg-mk"></span>いまの値（この銘柄）</li>
  <li><span class="lg-sw lg-tick"></span>目安ライン（中央値/しきい値）</li>
  <li><span class="lg-sw lg-peer"></span>同業中央値（破線）</li>
</ul>
```
- これで各項目のマーカーは1つだけになる。
- `.lg-peer`（02-tables.css L836・`width:0;height:11px;border-left:1.5px dashed var(--accent)`）が「謎の点」に見えないよう、**破線の縦線とハッキリ分かる**ように軽く調整（例 `height:12px`・`border-left-width:2px`）。`.lg-tick`/`.lg-mk`/`.lg-zone` は現状でOK。
- 上の `.vg-legend-bar`（実物デモバー・L307）は**そのまま**（zone/tick/peer/mk が文脈付きで1つずつ＝正しい）。重複していない。

## 修正B ― 「詳細指標」トグルを大きく・開閉が分かるように
対象: `.val-detail > summary`（02-tables.css L810-816）。現状 `::before { content:'▸ ' }` / `[open]::before { content:'▾ ' }` が小さく、開閉が見えづらい。
- **summary を明確なタップ行に**: `font-size:13px; font-weight:600; padding:10px 2px;`（タップ高さ ≥40px）。`cursor:pointer; list-style:none;`（既存のマーカー除去は維持）。
- **開閉インジケータを視認できる大きさ＋回転**に: `▸/▾` の文字差し替えではなく、**回転するシェブロン**にする（"回転が見えない"の解消）。
  - 案: `summary::before { content:'▸'; display:inline-block; font-size:13px; color:var(--text2); margin-right:6px; transition:transform .15s; }` ＋ `.val-detail[open] > summary::before { transform:rotate(90deg); }`（`▸` を90°回して `▾` 相当に・回転が見える）。
  - これなら content の差し替えをやめ、1つの `▸` を回すだけ＝アニメで開閉が明確。
- ラベル「詳細指標」は右に件数や「タップで展開」を添えてもよい（任意）。

## 修正C ― デモバーの「同業中央値」が点に見える（追加・ユーザー実機指摘）
凡例の**デモバー `.vg-legend-bar`**（valuation-tab.js L307）の `left:72%` にある `.vg-peer`（同業中央値サンプル）が、`border-left:1.5px dashed`（02-tables.css L863）＋バーが低い（6px→実高さ12px）ため**破線が1〜2個しか出ず「ゴミのような点」**に見える。
- **原因**: `border-*-style:dashed` は要素の辺長が短いとダッシュが1〜2個で点化する。
- **修正**: `.vg-peer`（と凡例スウォッチ `.lg-peer`）の破線を **`border-left:dashed` から `repeating-linear-gradient` ベースの縦破線**に変更し、高さに依らず常に破線として読めるようにする。例:
  ```css
  .vg-peer { position:absolute; top:-3px; bottom:-3px; width:1.5px;
    background: repeating-linear-gradient(to bottom, var(--accent) 0 2.5px, transparent 2.5px 5px);
    border-left: 0; }
  .lg-peer { width:2px; height:12px; border-left:0;
    background: repeating-linear-gradient(to bottom, var(--accent) 0 2.5px, transparent 2.5px 5px); }
  ```
  （実バーの行でも同じく破線が安定する＝両方が綺麗になる。位置ロジック `left:%` は不変。）
- これは**実バーの `.vg-peer` 描画の見た目改善**で、データ・位置・`#493/#497` の供給ロジックには触れない（スタイルのみ）。

## 受け入れ条件
- [ ] 凡例の各項目のマーカーが**1つずつ**（◯/縦線/破線が二重に出ない）。`●│┊` の文字が消えている。
- [ ] デモバーの**同業中央値（~72%）が破線の縦線**として読める（点・ゴミに見えない）。実バーの同業破線も同様に綺麗。
- [ ] 「同業中央値」のスウォッチが**破線の縦線**として分かる（点に見えない）。
- [ ] デモバー（`.vg-legend-bar`）は従来どおり zone/tick/peer/mk が1つずつ。
- [ ] 「詳細指標」トグルが**大きく**、開閉でシェブロンが**回転して見える**。タップ領域 ≥40px。
- [ ] 品質ゲート green／`?v=` 全 bump／色は CSS 変数のみ・`!important` 禁止・`assets/*.css` に prettier 一括をかけない（該当ブロックのみ手編集）。

## 触ってはいけない範囲
- 実バーの `detailRow` 描画（`.vg-zone/.vg-tick/.vg-peer/.vg-mk`）・`value-detail-meta.js` のロジック。
- `.vg-legend-bar`（デモバー）の中身（正しいので触らない）。
- `dist/app.js`（CI自動ビルド）。

## ブランチ／PR／Issue
- ブランチ `fix/value-legend-toggle`、base `main`。`Closes #<Issue>`。CI green で自動マージ可（軽微・見た目のみ）。
