# Handoff（2026-06-25）: Value「詳細指標」トグルをアコーディオン行に（#507 B の作り直し）

> 設計=Mulmo。実装=VS Code。軽微・見た目のみ。**#507 B（summary を 40px＋回転▸）では"薄い灰色テキストでゴミっぽい"が解消せず**、モックで A案（アコーディオン行）に確定（ユーザー選択）。確定モック=`artifacts/html/2026/06/yY_PIAhH-*.html`。
> 対象: `src/valuation-tab.js`（L315 summary）／`assets/02-tables.css`（`.val-detail > summary` L807-819）／`index.html`(`?v=`)。

## 問題
現状 `.val-detail > summary` は `color:var(--text2)`（薄い灰）＋背景/枠なし＋`::before` の小さい `▸`。**ただのテキストに見えて開ける UI と分からない**。

## 修正 ― A案「アコーディオン行」
### HTML（valuation-tab.js L315）
`<summary>詳細指標</summary>` を次に置換（native details のまま・JS追加不要）:
```js
<summary class="val-detail-tog">
  <span class="vdt-lab">詳細指標</span>
  <span class="vdt-sub">13指標・目安バー・同業比較</span>
  <svg class="vdt-chev" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
</summary>
```
- 補助文「13指標・目安バー・同業比較」は**出す**（ユーザー決定）。

### CSS（02-tables.css・`.val-detail > summary` ブロック L807-819 を置換）
```css
.val-detail { margin-top: 10px; }                 /* border-top は撤去（行自体に枠が付くため） */
.val-detail > summary {
  display: flex; align-items: center; gap: 8px;
  min-height: 46px; padding: 12px 14px;
  background: var(--surface2); border: 1px solid var(--border); border-radius: 10px;
  cursor: pointer; list-style: none;
}
.val-detail > summary::-webkit-details-marker { display: none; }   /* 旧 ▸ マーカー除去 */
.vdt-lab { font-size: 14px; font-weight: 700; color: var(--text); }
.vdt-sub { font-size: 10.5px; color: var(--text3); font-weight: 500; }
.vdt-chev {
  margin-left: auto; width: 20px; height: 20px; flex: none;
  fill: none; stroke: var(--text2); stroke-width: 2.2;
  stroke-linecap: round; stroke-linejoin: round;
  transition: transform 0.2s;
}
.val-detail[open] > summary .vdt-chev { transform: rotate(180deg); }  /* 開＝上向き */
```
- 旧 `.val-detail > summary::before`（`▸`／回転）は**削除**（シェブロンを SVG に置換）。
- 色は CSS 変数のみ。`!important` 禁止。`assets/*.css` に prettier 一括をかけない（該当ブロックのみ手編集）。

## 受け入れ条件
- [ ] 「詳細指標」が**背景つきのアコーディオン行**（高さ ≥46px・枠 `--border`・角丸）で表示され、明確に**開ける UI**に見える。
- [ ] 右端のシェブロンが**閉=下向き / 開=上向き（180°回転）**で開閉が一目で分かる。`▸` の小さいテキストは残っていない。
- [ ] 補助文「13指標・目安バー・同業比較」が出る。ラベル「詳細指標」は本文色・14px/700。
- [ ] ライト/ダーク両モードでコントラスト確保。品質ゲート green／`?v=` 全 bump。

## 触ってはいけない範囲
- 展開中身（凡例・グループ・指標行）・`value-detail-meta.js`・`.vg-*` 描画。
- `dist/app.js`（CI 自動ビルド）。

## ブランチ／PR／Issue
- ブランチ `fix/value-detail-toggle-accordion`、base `main`。`Closes #<Issue>`。CI green で自動マージ可（軽微・見た目のみ）。
