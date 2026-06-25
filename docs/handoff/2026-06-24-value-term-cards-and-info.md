# Handoff（2026-06-24・rev2）: Value タブ 詳細指標 ―― 目安ゲージ行リデザイン＋全用語ⓘ＋判定バッジ

> ✅ **実装完了（2026-06-25・#495 クローズ）**＝案B 目安ゲージ行を実装。`src/value-detail-meta.js`新設・`.vg-row`/`.vg-gauge`/判定バッジ/目安バー導入。`.vg-peer`(同業中央値破線)の差し込み口は用意済み（描画データは #493＝米株 / #496＝日本株 が供給）。PM盤面モニタで完了確認。
> 設計=Mulmo。実装は VS Code が本 doc を正本に着手。1タスク=1ブランチ=1PR=1Issue（**Issue #495**。rev1は#475/PR#477でマージ済）。
> **依存**: #443（コア4チップ＋『詳細指標』展開）／#450 PR#453（自己説明・的中率/トリガー明確化）の上に乗る（マージ済み前提）。
> **rev2 の経緯**: 初版（チップカード2列）を実装→ユーザーが実機で「左右に間延び」「単体だと良し悪しが分からない」と指摘。モックで方向性を確定（2026-06-24・フォーム2回）。確定版モック＝`artifacts/html/2026/06/value-b-*.html`（ワークスペース側・参考用）。

## 確定した方向（ユーザー回答そのまま）
1. **レイアウト＝案B「目安ゲージ行」**（1指標=1行・横全幅）。間延びの原因だった「数値を右端へ飛ばす2列カード」は廃止。
2. 各指標に**3点セットを全部載せる**: ①**判定バッジ**（◎良い/○標準/△注意/・文脈次第）②**目安バー**（今の値がレンジのどこか視覚化）③**目安キャプション**（例「〜8安」）。
3. **判定バッジの位置＝行の右上・数値のすぐ右**（ユーザー明示）。
4. 用語は全部わからない前提＝**Value タブ全用語に ⓘ**、タップで**その場アコーディオン展開**（既定）。
5. 「対・同業他社の平均」比較は**別タスクでデータ源から設計**（本 doc では破線プレースホルダだけ用意し、後乗せできる構造にしておく）。→ 別 handoff `2026-06-24-sector-average-benchmark.md` / 別 Issue。

---

## レイアウト仕様（1指標=1行）
```
┌────────────────────────────────────────────┐
│ EV/EBITDA  ⓘ                  8.2x  ○ 標準   │  ← 左:ラベル+ⓘ / 右上:数値+判定バッジ
│ ▕▔▔▔[good zone]▔│▔▔▔●▔▔┊▔▔▔▔▔▔▔▔▏          │  ← 目安バー: goodゾーン塗り / │目安tick / ●現在地 / ┊同業(将来)
│ 割安/低                              割高/高 │  ← 両端ラベル
│ 対◯◯  同業         〜8安 / 15+高            │  ← 左:タグ / 右:目安キャプション
│ （ⓘタップで↓）                              │
│ 借金込みで会社を丸ごと買うと本業の…           │  ← 解説（既定は隠れ・タップで開く）
└────────────────────────────────────────────┘
```
- **判定バッジ**は数値の右に隣接（`.row-right` に `数値` → `バッジ` の順で flex 配置）。`—`（文脈次第）の指標はバッジ非表示。
- **目安バー**＝細い track（高さ6px）。`zone`（良い範囲を薄塗り）／`tick`（目安＝中央値 or しきい値の縦線）／`mk`（現在地の丸・トーン色）／`peer`（同業中央値の破線・**将来用。今は描かないが CSS と差し込み口だけ用意**）。下に両端ラベル「割安/低 ↔ 割高/高」。
- **タグ**: `対ACWI`/`vs WACC`/`過去比`/`対目標` 等の `.tag-live`（実データ相対比較の明示）。静的しきい値の指標は無タグ。
- **ⓘ／解説**: 行を `<details>` にし、`<summary>` に「ラベル＋ⓘ＋数値＋バッジ＋目安バー＋両端ラベル＋キャプション」（=常時見える部分）を、本体 `<p>` に解説文を入れる。**native details（JS開閉・inline onclick なし＝CSP安全）**。app.js の data-action 追加は不要。ⓘは装飾グリフ（`aria-hidden`）、`summary` に `aria-label="◯◯ の説明を開く"`。
  - 注意: `summary` 内にクリック要素（別 data-action）を置かない（開閉と競合）。ⓘ自体も独立ボタンにせず summary タップで開く。

## グルーピング（似た意味を隣に・専門語をやめ「3つの問い」に）
従来の バリュ/品質/モメンタム を、平易な問いの見出しに置換（中身の指標は同じ）。各グループ見出し下に1行キャプション。
1. **① 価格は割安か？**（安く買えているか）: PER・PEG・EV/EBITDA・%タイル
2. **② ちゃんと稼ぐか・株主に返すか？**（稼ぐ力・還元・利益の質）: FCF利回り・株主還元・FCF変換・ROIC・粗利/資産・Altman Z・F/Qスコア
3. **③ 市場の期待・勢いは？**（期待の高さ・モメンタム・市場対比）: 織込成長・目標乖離・改定90d・1Y騰落・52週位置・対市場

---

## タスクA ― glossary-data.js に安定キー＋不足3語（rev1から変更なし）
- `GlossaryTerm` を `{ term, desc, key? }` に拡張、Value タブ参照語に英数スラッグ `key` を付与（表示 `term` は変えない）。`@typedef` 更新。
- 未収録3語を追加（説明はコードに書かずここへ）:
  - `株主還元`（カテゴリ`valuation`・key `shareholderYield`）＝配当＋自社株買いで毎年株主に戻す現金の利回り。3%超で手厚い。
  - `過大ポジ`（`discipline`・`overweightCount`）＝適正比率を超えている保有の本数。減らす候補の数。
  - `割安候補`（`discipline`・`cheapCount`）＝判定エンジンが割安(cheap)と見ている銘柄の本数。
- ラベル→key 対応表は本 doc 末尾「付録: 指標メタ表」に統合（gauge 設定と同じ行に記載）。

## タスクB ― glossary.js に `glossaryTermByKey(key)`（rev1から変更なし）
key→`{term,desc}` の Map ルックアップを export。`glossaryHTML(tab)`（タブ下部の全文解説）はそのまま併存。**desc が無ければ ⓘ を出さない**（壊れたⓘ防止）。

## タスクC ― valuation-tab.js を「目安ゲージ行」に作り替え
対象は `detailHTML(val)`。コア4チップ（`coreChipsHTML`）とヘッダ統計（`statsHTML`）は**ⓘ付与のみ**（タスクE）。

### C-1. 指標メタの一元定義
詳細指標の gauge/判定/キャプション/グループは**データ駆動**にする。`src/value-detail-meta.js`（新規・純データ＋小関数）に「付録: 指標メタ表」を定数化し、`detailHTML` はそれを回して行 HTML を生成。判定とgauge位置の算出は次の2系統：
- **静的しきい値系**（EV/EBITDA・PEG・FCF利回り・株主還元・FCF変換・粗利/資産・Altman Z・F/Qスコア・織込成長・改定90d・目標乖離）: メタに `min/max/good/tick/judge[]` を持ち、`pos=clamp((v-min)/(max-min)*100)`、`judge` は値としきい値の比較で `{tone,label}` を返す。
- **ライブ相対系**（PER・%タイル＝自分の過去バンド `bandLow/bandHigh/bandMedian/percentile`／ROIC＝`vs wacc`／対市場＝`rsVsSector`(対ACWI)／目標乖離＝`targetGapPct`）: メタに `live:true` とタグ文言を持ち、位置は実値から算出（PER/%タイルはバンド内位置、ROIC は WACC を tick に置いて ROIC をマーカー）。

### C-2. 行ビルダ（native details）
```js
function detailRow(meta, val) {
  const t = glossaryTermByKey(meta.key);
  const m = computeMetric(meta, val);   // {valueHTML, pos, zone:[a,b], tick, peer:null, tone, judge}
  if (m == null) return '';             // データ無しの指標は行ごと出さない（従来同様）
  const badge = m.judge ? `<span class="vg-badge vg-${m.tone}">${GLYPH[m.tone]} ${escapeHTML(m.judge)}</span>` : '';
  const tag = meta.live ? `<span class="vg-live">${escapeHTML(meta.liveTag)}</span>` : '';
  const expl = t ? `<p class="vg-expl">${escapeHTML(t.desc)}</p>` : '';
  const i = t ? `<span class="vg-i" aria-hidden="true">ⓘ</span>` : '';
  return `<details class="vg-row">
    <summary aria-label="${escapeHTML(meta.label)} の説明">
      <span class="vg-top"><span class="vg-lab">${escapeHTML(meta.label)}</span>${i}
        <span class="vg-right"><span class="vg-val">${m.valueHTML}</span>${badge}</span></span>
      <span class="vg-gauge">${zoneHTML}${tickHTML}${peerHTML/*将来*/}${mkHTML}</span>
      <span class="vg-ends"><span>割安 / 低</span><span>割高 / 高</span></span>
      <span class="vg-bot">${tag}<span class="vg-cap">${escapeHTML(meta.cap)}</span></span>
    </summary>
    ${expl}
  </details>`;
}
```
- `m.valueHTML` は既存の色クラス付き span（`val-warn`/`val-bad`/`val-mom-up`/`val-mom-dn`）をそのまま許容（#450 の閾値記号併記は valueHTML 内に残す）。それ以外は escapeHTML。
- グループ見出し（`.val-detail-grp .lab`／`.grp-cap`）は3つの問いの文言に差し替え。`detailHTML` は「外側 `<details class="val-detail">` 詳細指標 → 各グループ見出し → 各 `detailRow`」の構造。

### C-3. peer（同業中央値）差し込み口だけ用意
`detailRow` に `meta.peerKey` があり `val[...]` に同業中央値があれば `peer` 位置に破線を描く分岐を**書いておくが、今はデータが無いので非表示**（別 Issue で供給）。CSS `.vg-peer`（破線）も先に入れておく。

## タスクD ― CSS（assets/02-tables.css）
**色・サイズは CSS 変数のみ／`!important` 禁止／`assets/*.css` に prettier 一括をかけない（該当ブロックのみ手編集）。** 旧 `.val-met`／`.val-met b` は撤去。
- `.vg-row{border:1px solid var(--border2);background:var(--surface);border-radius:10px;padding:10px 11px 9px;margin-bottom:7px}` ＋ `summary` のマーカー除去（`list-style:none;::-webkit-details-marker{display:none}`）。
- `.vg-top{display:flex;align-items:center;gap:7px}`／`.vg-right{margin-left:auto;display:flex;align-items:center;gap:7px}`（**数値→バッジの順＝バッジが数値の右**）。
- `.vg-gauge{position:relative;display:block;height:6px;border-radius:3px;background:var(--surface3);margin:11px 0 4px}`／`.vg-zone`（`opacity:.5`・トーン背景）／`.vg-tick`（`var(--text3)` 縦線）／`.vg-mk`（丸・トーン色・`border:2px solid var(--surface)`）／`.vg-peer`（`border-left:1.5px dashed var(--accent)`・**将来**）。
- `.vg-ends{display:flex;justify-content:space-between;font-size:9px;color:var(--text3)}`。
- `.vg-badge`：`vg-good`/`vg-ok`/`vg-warn`/`vg-neu` の4トーン。色は**価格の赤緑とは別系統**の意味色（good=緑系・ok=琥珀系・warn=橙系・neu=灰）。色覚配慮で必ず ◎/○/△/・ グリフ併記。**新しい CSS 変数（`--vg-good` 等）を `01-base.css` の `:root` と `[data-theme=dark]` 両方に定義**（ハードコード hex 禁止のため）。
- `.vg-live`（`.tag-live` 相当・accent 枠）／`.vg-cap`（`margin-left:auto;text-align:right;color:var(--text3)`）。
- `.vg-expl{display:none}` ＋ `.vg-row[open] .vg-expl{display:block}`（`border-top:1px dashed var(--border)`）。
- ⚠ 新トーン色は**ライト/ダーク両方でコントラスト 4.5:1**を満たすこと。

## タスクE ― コア4チップ／ヘッダ統計に ⓘ（rev1から維持）
- `coreChipsHTML`：2×2 grid と `is-sortkey` 強調を維持し、各 `.val-c` を `<details>` 化して ⓘ＋解説を付与。
- `statsHTML`：各 `.val-stat` を `<details>` 化して個別 ⓘ＋解説。**旧「ⓘ 統計の見方」単独 `.val-stats-help` は撤去**。的中率/トリガーの値表記（hits/resolved・抵触/監視）は #450 のまま。

---

## 受け入れ条件（チェックリスト）
- [ ] 詳細指標が**1指標=1行の目安ゲージ行**で表示。間延び（中央の空白）が無い。
- [ ] 各行に **数値＋判定バッジ（数値の右）＋目安バー＋目安キャプション**が出る。`—`（文脈次第）指標はバッジ無し。
- [ ] 目安バーに **goodゾーン塗り・目安tick・現在地マーカー**が出て、今の値の位置が一目で分かる。`同業`破線の**差し込み口（CSS＋分岐）**があり、データ未供給時は非表示。
- [ ] 詳細指標が **3つの問い**（割安か/稼ぐか/期待勢い）でグルーピングされ、見出しが平易。
- [ ] Value タブ全用語（詳細13＋コア4＋ヘッダ統計4）に ⓘ。**タップでその場アコーディオン展開**（native details）。解説の正本は `glossary-data.js`（重複定義なし）。不足3語追加済み。
- [ ] コア4の `is-sortkey`・2×2、サイズバー・アクションバナー・判定確度は従来通り。旧 `.val-stats-help` 撤去。
- [ ] 判定/gauge のしきい値は `value-detail-meta.js`（付録表）に集約＝散らばらない。ライト/ダークでバッジ・バーのコントラスト確保（色は CSS 変数のみ・`!important` なし）。
- [ ] 品質ゲート green（vitest/eslint/prettier(srcのみ)/check:types/check:circular/e2e）。`index.html` の `?v=` 全 bump。

## 触ってはいけない範囲
- `getValuation`/`computeVerdict`/`computeHitRate`/`evaluateTriggers` のロジック・フィールド名（読むだけ）。
- 並べ替え基準・サイズバー・アクションバナー・判定確度・#443 コア4チップの並びとソートキー強調ロジック（**見た目に details/ⓘ/バッジ/バーを足すだけ**）。
- `glossaryHTML(tab)` の既存出力。`dist/app.js`（CI自動ビルド）・`assets/*.css` への prettier 一括。

## 落とし穴
- gauge 位置は必ず `clamp(0,100)`（外れ値で marker が枠外に飛ぶ）。データ欠損の指標は**行ごと出さない**（空 gauge を出さない）。
- 判定の意味色は**日本式の株価赤緑とは別系統**。価格モメンタムの `val-mom-up/dn`（赤=上げ）と混同しない＝バッジ用に別変数を新設。
- native details ネスト（外側 `.val-detail` 内に各行 details）は valid。iOS Safari 動作確認。
- ⚠ rev1 で実装済みなら、その差分の上に rev2 を重ねる（カード2列 CSS は撤去して置換）。

## ブランチ／PR／Issue
- ブランチ `feat/value-detail-gauge-rows`（rev1 から改称可）、base `main`。`Closes #495`（#475はrev1で既にクローズ済）。
- **マージ方針: コア4チップ/ヘッダ統計に触れる（load-bearing 近傍）＋見た目の大改修＝Toshio 事前レビュー**（CI green 後、自動マージしない）。

---

## 付録: 指標メタ表（`value-detail-meta.js` の中身＝判定/gauge/キャプション/key の正本）
凡例: 軸=gaugeの[min..max]が表す意味 / good=良い範囲 / tick=目安縦線 / 判定=しきい値→バッジ / live=実データ相対。**しきい値は #450 の一言説明表と整合**。

### ① 価格は割安か？
| label | key | 軸(min..max) | good | tick | 判定 | tag |
|---|---|---|---|---|---|---|
| PER | per | 自分の過去バンド[bandLow..bandHigh] | 左(安) | bandMedian | %タイル<40◎ / 40–70○ / >70△ | 過去比(live) |
| PEG | peg | 0..3 | 0..1 | 1.0 | <1◎ / 1–2○ / >2△ | — |
| EV/EBITDA | evEbitda | 0..20 | 0..8 | 15 | <8◎ / 8–15○ / >15△ | —（peer差込口）|
| %タイル | percentile | 0..100 | 0..40 | 50 | <40◎ / 40–70○ / >70△ | 過去比(live) |

### ② ちゃんと稼ぐか・株主に返すか？
| label | key | 軸 | good | tick | 判定 | tag |
|---|---|---|---|---|---|---|
| FCF利回り | fcfYield | 0..10 | 4..10 | 4 | >4◎ / 2–4○ / <2△ | — |
| 株主還元 | shareholderYield | 0..8 | 3..8 | 3 | >3◎ / 1–3○ / <1△ | — |
| FCF変換 | fcfConversion | 0..2 | 0.9..2 | 1.0 | >0.9◎ / 0.6–0.9○ / <0.6△ | — |
| ROIC | roic | 0..25（tick=WACC） | roic>wacc | wacc値 | roic≥wacc◎ / 同等○ / <wacc⚠ | vs WACC(live) |
| 粗利/資産 | grossProfitability | 0..1 | 0.33..1 | 0.33 | >0.33◎ / 0.2–0.33○ / <0.2△ | —（peer差込口）|
| Altman Z | altmanZ | 0..8 | 3..8 | 3 | ≥3◎ / 1.8–3○ / <1.8⚠ | — |
| F/Qスコア | fScore | 0..9 | 7..9 | 5 | ≥7◎ / 5–6○ / <5△ | —（Fをマーカー）|

### ③ 市場の期待・勢いは？
| label | key | 軸 | good | tick | 判定 | tag |
|---|---|---|---|---|---|---|
| 織込成長 | impliedGrowth | 0..15 | 0..7 | 7 | <7○ / ≥7△(期待過多) | —（cyclicalは行を出さない=既存） |
| 目標乖離 | targetGap | -30..+50 | >0 | 0 | >0◎ / <0△ | 対目標(live) |
| 改定90d | epsRev90d | -10..+10 | >0 | 0 | >0◎ / <0△ | — |
| 1Y騰落 | priceMom1Y | -40..+40 | — | 0 | 判定なし(neu) | —（価格色は従来踏襲） |
| 52週位置 | pos52w | 0..100 | — | 50 | >85△ / それ以外 neu | — |
| 対市場 | rsVsSector | -20..+20 | >0 | 0 | >0◎ / <0△ | 対ACWI(live) |

### コア4チップ／ヘッダ統計の ⓘ key
PER→`per` / PEG→`peg` / %タイル→`percentile` / Fスコア→`fScore` / 過大ポジ→`overweightCount` / 割安候補→`cheapCount` / 的中率→`hitRate` / トリガー→`sellTriggers`。
