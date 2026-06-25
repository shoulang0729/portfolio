# Handoff（2026-06-25）: Value タブ 仕上げポリッシュ（サマリ/詳細ⓘ/見出し/ゲージ凡例/レンズ/4チップ/アクションバナー）

> 設計=Mulmo。実装は VS Code が本 doc を正本に着手。1タスク=1ブランチ=1PR=1Issue。
> **前提（実装済み）**: #475(目安ゲージ行 rev2)・#493/#497(同業中央値 peer 破線)・全用語ⓘ。本タスクは**その上の見た目仕上げ**。モックで合意（ワークスペース `artifacts/html/2026/06/value-eHXKadX68wULRKTr-*.html` ほか一連）。
> 対象: `src/valuation-tab.js`／`src/value-detail-meta.js`／`assets/02-tables.css`／`assets/01-base.css`／`index.html`(`?v=`)。**触ってはいけない範囲**は末尾。

ユーザー合意の7点を順に。コードは VS Code が書く（本 doc は指示）。

---

## A. サマリ統計（`val-stats`）― 値を高さ中央・トリガー/的中率は2段
対象: `statsHTML`（valuation-tab.js ~L575）＋CSS `.val-stats`/`.val-stat`。
1. **値を中央寄せ＋カード高さの縦中央**に: `.val-stat` を縦flex、`.k`(ラベル)は上のまま、`.v`(値)を `flex:1; display:flex; align-items:center; justify-content:center; text-align:center`。1行値（過大ポジ/割安候補）と2段値（的中率/トリガー）でカード高が揃い、値が縦に揃う。
2. **トリガーは「抵触」の後で改行**: 値を `抵触 N`＋`<span class="l2">監視 M</span>`（`.l2{display:block}`）の2段に。
3. **的中率もキリよく改行**: `発議 X/Y`＋`<span class="l2">判定 …</span>` の2段に（既存の hits/resolved 表記は維持）。
4. ラベル文言・ⓘ（各統計の用語解説）は現状維持。色は CSS 変数のみ。

## B. 詳細指標 ― 「・」削除＋ⓘは「銘柄ならではの評価」だけ
対象: `value-detail-meta.js`（TONE 定義 L17-21・各メタ）／`detailRow`（valuation-tab.js L230-257）。
1. **中立（neu）の「・」バッジを出さない**: 現状 `TONE.neu = { glyph:'・' … }` で 1Y騰落/52週位置 に「・ 文脈次第」が出る。→ **neu の指標は判定バッジ自体を非表示**にする（`detailRow` の badge 生成を「tone==='neu' なら空」に）。バー上のマーカー色は neu のままでよい（バッジだけ消す）。
2. **ⓘの中身を銘柄固有の評価に差し替え**（用語解説との重複解消）:
   - 現状 `detailRow` L243 は `t.desc`（glossary の一般定義）を `<p class="vg-expl">` に出している＝下部「📘用語解説」と被る。
   - **`value-detail-meta.js` の各メタに `evalText(val): string|null` を追加**。実値＋しきい値＋（あれば）同業中央値＋判定から、**その銘柄に踏み込んだ1〜2文**を返す。例:
     - PER: 「予想PER {perFwd}倍は過去5年({bandLow}〜{bandHigh})の下半分、同業中央値 約{sectorMedian.per}倍より低い＝相対的に割安。」
     - ROIC: 「ROIC {roic}% > WACC {wacc}%（+{diff}pt）＝資本を使うほど価値を生む。」
     - 対市場: 「世界株平均より{rsVsSector:+}%＝地合いを除いても個別で勝っている。」
   - `detailRow` を変更: `const ev = meta.evalText ? meta.evalText(val) : null;`
     - `ev` があれば `<p class="vg-expl">この銘柄: {escapeHTML(ev)}</p>` ＋ **「用語の意味を見る →」リンク**（下部 glossary を開く/スクロール）。
     - `ev` が無ければ（銘柄固有の評価が作れない指標）**一般定義は出さず**、`<p class="vg-expl vg-expl--link">意味は<a …>用語解説</a>へ</p>` の誘導のみ。
   - **正本ルール**: 一般的な用語定義は `glossary-data.js` の1箇所だけ（`vg-expl` に generic desc を二度書きしない）。`evalText` は"評価"であって"定義"ではない。
   - 「用語の意味を見る →」のリンク先＝下部 `glossaryHTML('value')`。実装は CSP 安全に: 既存の用語解説 `<details class="gloss">` を `id` 付与し、リンクは `<a href="#val-glossary">`（同ページアンカー）でよい。JS開閉が要るなら data-action 委譲（インライン onclick 禁止）。

## C. グループ見出し ①②③ ― カード/帯をやめ「文字のみ」
対象: `detailHTML`（L268-）の `.val-detail-grp .lab`/`.grp-cap`＋CSS。
- 現状はラベル＋キャプションのインライン。→ **番号＋問い＋キャプションを1行**にし、**下に細い罫線**（`border-bottom:1.5px solid var(--border)`）だけの**文字のみ見出し**に。アクセント帯・塗りカードにしない（"AIっぽさ"回避）。
- **丸数字①②③は見出しと同じ文字色**（`var(--text)`・太字）。アクセント色にしない。問い＝14px/700、キャプション＝`var(--text3)`・右寄せ。
- グループ文言（平易な3つの問い）: ①価格は割安か？ ②ちゃんと稼ぐか・株主に返すか？ ③市場の期待・勢いは？（meta の group ラベルに合わせる）。

## D. 目安バーの凡例（新規）
- **詳細指標（`<details class="val-detail">`）を開いた先頭**に、**「目安バーの見方」凡例ブロック**を1つ表示（各行ではなく1回）。
- 内容: ミニチュアのサンプルバー＋4項目 —
  - **塗り＝良い範囲（目安）**（`.vg-zone` の見本）
  - **● いまの値（この銘柄）**（`.vg-mk` の見本）
  - **│ 目安ライン（中央値/しきい値）**（`.vg-tick`）
  - **┊ 同業中央値（破線）**（`.vg-peer`・accent）
- CSS 新規 `.vg-legend`（`border:1px dashed var(--border); background:var(--surface2)`）。色は CSS 変数のみ。

## E. レンズ（並べ替えピル）― 「総合」→「サイズ乖離」
対象: valuation-tab.js L584 のレンズ配列 `{ key:'total', label:'総合' }` → **label を「サイズ乖離」に**（内部 key `'total'` は変えない＝ソート/分岐に影響させない）。L4 コメントも「サイズ乖離/バリュ/品質/モメンタム」に。
- `lensCap('total')`（L449「乖離順｜サイズ過大が上」）は維持。
- **PEG 専用ソートは追加しない**（決定）。**モメンタムレンズは残す**（決定）。

## F. コア4チップ ― PER/PEG/%タイル/Fスコア → PER/%タイル/品質/モメンタム
対象: `coreChipsHTML`（L206-219）＋`sortKeyForLens`（L186-198）。
- **チップ4枚を `PER / %タイル / 品質 / モメンタム` に変更**（PEG・Fスコアを置換）:
  - `PER`（`v.perTrail→v.perFwd`・key `per`）
  - `%タイル`（`val.percentile`・key `percentile`・位置id `pct`）
  - **`品質`（`q.qScore` を表示・例 `Q7`・key `qScore`・位置id `qual`）**
  - **`モメンタム`（`m.priceMom1Y` を表示・例 `+22%`・key `priceMom1Y`・位置id `mom`）**
- **`sortKeyForLens` をレンズ↔チップ1対1に更新**: value→`pct` / quality→`qual` / momentum→`mom` / total→`sizeBar`（チップ無し・サイズバー強調）。`skCls` の位置id を `per/pct/qual/mom` に。
- 効果: 選んだレンズに対応するチップが `is-sortkey` で光る（バリュ→%タイル・品質→品質・モメンタム→モメンタム）。**サイズ乖離レンズはサイズバーをリング強調**（既存挙動）。
- **PER のヒーロー化はしない**（4枚並列のまま）。PEG/EV-EBITDA 等は詳細①に既出（チップから外しても情報は残る）。
- 各チップは `termChip(...)`（ⓘ付き）を維持。`is-sortkey` の見た目（リング/強調）は維持。

## G. アクションバナー ― 記号 ▼▲◦▪ を SVG アイコンに・薄い塗りは残す/端の濃い帯なし
対象: `bannerHTML`（L289-318）＋CSS `.val-banner`系。
1. **記号 `▼▲◦▪` を全廃**し、**SVG ラインアイコン**に: 積増=trending-up / トリム=trending-down / 監視=eye / 維持=check。
   - **SVG スプライトを1回だけ DOM に出す**（`renderValuationTab` の出力先頭 or index.html）: `<svg style="position:absolute;width:0;height:0"><defs><g id="vb-add">…</g>…</defs></svg>`。各バナーは `<svg class="vb-ic"><use href="#vb-add"/></svg>`。CSP 安全（同一文書 use・外部参照なし）。
   - 推奨パス（feather風・stroke=currentColor）:
     - add(trending-up): `<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>`
     - trim(trending-down): `<polyline points="3 7 9 13 13 9 21 17"/><polyline points="15 17 21 17 21 11"/>`
     - watch(eye): `<path d="M1.5 12S5 5.5 12 5.5 22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12Z"/><circle cx="12" cy="12" r="3"/>`
     - hold(check): `<polyline points="20 6.5 9.5 17 4.5 12"/>`
   - `<g>` は `fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"`。アイコン色は `.val-banner--{kind}` の `color` を継承。
2. **薄い塗りつぶし背景は残す**（積増=`--goodbg`/トリム=`--warnbg`/監視=`--okbg`/維持=`--surface2`）。**端の濃い色帯（左の太い border）は付けない**（"AIっぽさ"の原因）。
3. アイコン＋アクション語に色（good/warn/ok/neu）、理由(`vb`)は `var(--text2)` で右寄せ。`vc-*` の意味色は CSS 変数で（赤緑のハードコード禁止）。kind と CSS クラスの対応（buy→add 等）を bannerHTML で揃える。

---

## 受け入れ条件（チェックリスト）
- [ ] サマリ4枚の値が**カード高さの縦中央**に揃い、トリガー＝`抵触/監視`・的中率＝`発議/判定` の2段表示。
- [ ] 詳細の中立指標に「・」バッジが**出ない**。ⓘ展開は**銘柄固有の評価**＋用語解説リンク。評価が無い指標はリンクのみ（一般定義の重複なし）。
- [ ] グループ見出し①②③が**文字のみ**（番号は本文色・下罫線のみ）。塗りカード/アクセント帯にしない。
- [ ] 詳細先頭に**目安バー凡例**（塗り/●/│/┊ の4説明）が1回出る。
- [ ] レンズ先頭の表示名が**「サイズ乖離」**（内部 key は total のまま）。PEGソート無し・モメンタム有り。
- [ ] コア4チップが **PER/%タイル/品質/モメンタム**。レンズ選択で対応チップが光る（value→%タイル/quality→品質/momentum→モメンタム）、サイズ乖離はサイズバー強調。PERヒーロー化なし。
- [ ] アクションバナーが **SVGアイコン＋薄い塗り**（端の濃い帯なし）。`▼▲◦▪` は残っていない。
- [ ] 品質ゲート green（vitest/eslint/prettier(srcのみ)/check:types/check:circular/e2e）。`index.html` の `?v=` 全 bump。色は CSS 変数のみ・`!important` 禁止・escapeHTML・data-action 委譲（inline onclick 禁止）。

## 触ってはいけない範囲
- 並べ替えロジック本体（`sortedRows` の比較・lens 内部 key `total/value/quality/momentum`）。**表示名と対応チップだけ**変える。
- `getValuation`/`computeVerdict`/`computeHitRate`/`evaluateTriggers`/`sectorMedian` のデータ・フィールド名（読むだけ）。
- `glossary-data.js` の用語定義は正本（ⓘ評価で一般定義を複製しない）。`.vg-peer`/`sectorMedian` 描画（#493/#497）は壊さない。
- `dist/app.js`（CI自動ビルド）・`assets/*.css` への prettier 一括。

## ブランチ／PR／Issue
- ブランチ `feat/value-tab-polish`、base `main`。`Closes #<Issue>`。
- 見た目中心だが**コアチップ構造とソートキー強調に触れる**ため、CI green 後 **Toshio 事前レビュー**推奨。
