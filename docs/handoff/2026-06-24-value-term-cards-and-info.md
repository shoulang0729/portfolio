# Handoff（2026-06-24）: Value タブ ―― 詳細指標のチップカード化＋全用語ⓘタップ解説（その場展開）

> 設計=Mulmo。実装は VS Code が本 doc を正本に着手。1タスク=1ブランチ=1PR=1Issue。
> **依存**: #443（コア4チップ＋『詳細指標』展開）／#450 PR#453（詳細指標の自己説明・2列grid・的中率/トリガー明確化）の **上に乗る**。両者マージ済みが前提。
> ユーザー確定（2026-06-24・フォーム回答）: ①詳細指標は**各指標を独立チップカード**（枠＋背景・タイトル左/数値右）②ⓘは **Value タブの全用語**（詳細指標＋コア4チップ＋ヘッダ統計）③タップで**その場アコーディオン展開**。

## 背景／ゴール
ユーザーは「Value タブの用語がほぼ全部わからず、何度も確認が要る」「詳細指標の灰色テキストの塊が読みにくい」と訴えている。ねらいは2つ。

1. **詳細指標を独立チップカード化**：各指標を「枠＋背景つきの小カード」にし、**タイトル左・数値右**で視線が迷わないようにする。今の `.val-met`（2列grid のフラットなテキスト）を、1指標=1カードのチップ群に変える。
2. **全用語にⓘタップ解説**：Value タブに出る用語（詳細指標13＋コア4チップ＋ヘッダ統計4）の**それぞれの隣に小さな ⓘ** を出し、**タップするとその用語の真下に解説がアコーディオンで開く**。解説文の正本は `glossary-data.js`（重複定義を増やさない）。

### 実装方式の核（重要・先に読む）
- **ⓘ＝native `<details>`／`<summary>` を使う**（JS開閉・inline onclick を使わない）。既存の用語解説（`glossary.js`／`.gloss`／`.val-stats-help`）と**まったく同じ CSP 安全パターン**。`data-action` ディスパッチャ（app.js）に新ハンドラを足す必要は無い。
  - 各用語のチップ／行を `<details>` にし、`<summary>` に「タイトル＋数値＋ⓘグリフ」を、本体 `<p>` に解説文を入れる。タップで `<summary>` 直下に解説が開く＝「その場アコーディオン展開」が native で実現する。
  - `<details>` のネスト（`.val-detail` の中に各指標 `<details>`）は valid HTML。iOS Safari でも動作する（既存 `.gloss` も入れ子 details）。
- **解説文の単一正本＝`glossary-data.js`**。各用語に**安定キー `key`（スラッグ）** を追加し、`glossary.js` から `glossaryDescByKey(key)` で desc を引く。ビルダはこの関数で desc を取り出して `<p>` に流す（コード側に説明文を重複定義しない）。

ファイル: `src/glossary-data.js`（`key` 追加・不足3語の追加）／`src/glossary.js`（`glossaryDescByKey` 追加）／`src/valuation-tab.js`（`detailHTML`／`coreChipsHTML`／`statsHTML` を details 化）／`assets/02-tables.css`（`.val-card*` 新設・`.val-met` 置換・ⓘスタイル）／`index.html`（`?v=` bump）。

---

## タスクA ― glossary-data.js に安定キーを付与＋不足語を追加

### A-1. 全用語に `key`（スラッグ）を追加
`GlossaryTerm` を `{ term, desc, key? }` に拡張。Value タブで参照する用語に **英数字スラッグ** を付ける（既存 `term` 表記は変えない＝表示はそのまま）。`key` は UI 側の `data-arg` 兼ルックアップキー。型定義（JSDoc `@typedef`）も更新。

### A-2. 不足している3語を追加（現状 glossary に無い）
以下は UI に出るのに glossary 未収録。**glossary-data.js に追記**（説明はコードに書かず必ずここへ）。

| 追加語（term） | 入れるカテゴリ（id） | key | desc（非クオンツ向け・簡潔に） |
|---|---|---|---|
| 株主還元 | `valuation` | `shareholderYield` | 配当＋自社株買いで毎年株主に戻す現金の利回り。高いほど手厚い（3%超で厚い）。 |
| 過大ポジ | `discipline` | `overweightCount` | 今のサイズが適正比率を超えている保有の本数。減らす候補の数。 |
| 割安候補 | `discipline` | `cheapCount` | 判定エンジンが「割安（cheap）」と見ている銘柄の本数。買い増し検討の母数。 |

### A-3. Value タブ用語 → key 対応表（実装の参照・UI 側はこの key を `data-arg` に出す）

**詳細指標（13）**
| UI ラベル | glossary term | key |
|---|---|---|
| EV/EBITDA | EV/EBITDA | `evEbitda` |
| FCF利回り | FCF利回り | `fcfYield` |
| 株主還元 | 株主還元（A-2で追加） | `shareholderYield` |
| 織込成長 | リバースDCF / 織り込み成長率 | `impliedGrowth` |
| 目標乖離 | 目標株価乖離（targetGap） | `targetGap` |
| ROIC | ROIC | `roic` |
| 粗利/資産 | グロス収益性（Novy-Marx） | `grossProfitability` |
| FCF変換 | FCF変換率 | `fcfConversion` |
| Altman Z | Altman Z | `altmanZ` |
| Qスコア | Qスコア（0〜9） | `qScore` |
| 改定90d | epsRev90d（業績改定） | `epsRev90d` |
| 1Y騰落 | priceMom1Y（1Y騰落率） | `priceMom1Y` |
| 52週位置 | pos52w（52週位置） | `pos52w` |
| 対市場 | rsVsSector（対市場 相対強さ） | `rsVsSector` |

**コア4チップ**
| UI ラベル | glossary term | key |
|---|---|---|
| PER | PER（trail→fwd） | `per` |
| PEG | PEG | `peg` |
| %タイル | %タイル | `percentile` |
| Fスコア | F-Score（0〜9・Piotroski） | `fScore` |

**ヘッダ統計4**
| UI ラベル | glossary term | key |
|---|---|---|
| 過大ポジ | 過大ポジ（A-2で追加） | `overweightCount` |
| 割安候補 | 割安候補（A-2で追加） | `cheapCount` |
| 的中率 | 的中率（hit-rate） | `hitRate` |
| トリガー | 売りトリガー3種 | `sellTriggers` |

> 上表の key は提案値。既存 term 名と機械的に一致しないものは、実装者が glossary-data.js の各 term に `key` を付ける際にこの表のスラッグを採用すること。

---

## タスクB ― glossary.js に `glossaryDescByKey` を追加
既存 `glossaryHTML(tab)` はそのまま（タブ下部の全文用語解説は残す＝詳細リファレンスとして併存）。**追加で** key→desc ルックアップを export する。

```js
// glossary.js
/** key→desc の早見表（valuation-tab.js のⓘが使う）。term/key 重複は最後勝ち。 */
const _byKey = new Map();
for (const cat of GLOSSARY) for (const t of cat.terms) if (t.key) _byKey.set(t.key, t);

/**
 * 用語キーから { term, desc } を返す（見つからなければ null）。
 * @param {string} key
 * @returns {{term:string,desc:string}|null}
 */
export function glossaryTermByKey(key) {
  return _byKey.get(key) || null;
}
```

`valuation-tab.js` 側は `glossaryTermByKey(key)?.desc` を `escapeHTML` して `<p>` に入れる。**desc が null のときは ⓘ を出さない**（壊れたⓘを出さない・将来の追加漏れに強い）。

---

## タスクC ― valuation-tab.js を「ⓘ付き details」に変える

### 共通ヘルパー（valuation-tab.js 内に1つ作る）
タイトル・数値・key を受け取り、ⓘ付き details を返す小関数を用意して3か所で使い回す。

```js
import { glossaryTermByKey } from './glossary.js';

/**
 * 用語チップ（ⓘタップでその場に解説アコーディオン）。
 * desc が無ければⓘ無しのプレーン表示にフォールバック。
 * @param {string} cls   ルート class（'val-card' | 'val-c' | 'val-stat'）
 * @param {string} title ラベル
 * @param {string} valueHTML 数値部の HTML（色クラス付き span を許容＝呼び出し側で生成済み）
 * @param {string} key   glossary キー
 * @param {string} [extraSummaryCls] summary 追加 class（is-sortkey 等）
 */
function termChip(cls, title, valueHTML, key, extraSummaryCls = '') {
  const t = glossaryTermByKey(key);
  const sCls = extraSummaryCls ? ` ${extraSummaryCls}` : '';
  if (!t) {
    // 解説が無い→ details にせずプレーン（ⓘを出さない）
    return `<div class="${cls}${sCls}"><span class="t">${escapeHTML(title)}</span><span class="v">${valueHTML}</span></div>`;
  }
  return `<details class="${cls}">
    <summary class="${cls}-h${sCls}"><span class="t">${escapeHTML(title)}</span><span class="v">${valueHTML}</span><span class="ti" aria-hidden="true">ⓘ</span></summary>
    <p class="${cls}-x">${escapeHTML(t.desc)}</p>
  </details>`;
}
```
- `valueHTML` は呼び出し側が組む（`val-warn`/`val-bad`/`val-mom-up`/`val-mom-dn` の色付き span はこれまで通り維持）。ここに入るのはアプリ内由来の値のみ。**色付き span 以外のテキストは必ず escapeHTML を通す**（現状の `escapeHTML(fmtRaw(...))` を踏襲）。
- `aria-label` で読み上げ対応（例 `aria-label="EV/EBITDA の説明を開く"`）を summary に付けてよい。

### C-1. `detailHTML` → 各指標を `.val-card` チップに
現状の `.val-met`（`<b>ラベル</b><span>値</span>` の2列grid）を廃し、**1指標 = `termChip('val-card', …)`** に置換。グループ（バリュ/品質/モメンタム）の見出し＋1行キャプション（`.val-detail-grp`）は**残す**。各グループ本体は `.val-cards`（カードを並べるコンテナ）にする。

イメージ（バリュ群）:
```js
const valueGrp = `<div class="val-cards">
  ${termChip('val-card', 'EV/EBITDA', escapeHTML(fmtRaw(v.evEbitda)), 'evEbitda')}
  ${termChip('val-card', 'FCF利回り', `${escapeHTML(fmtRaw(v.fcfYield))}%`, 'fcfYield')}
  ${termChip('val-card', '株主還元', `${escapeHTML(fmtRaw(v.shareholderYield))}%`, 'shareholderYield')}
  ${termChip('val-card', '織込成長', igHTML, 'impliedGrowth')}   // igHTML=色クラス付き span を含む既存ロジック
  ${termChip('val-card', '目標乖離', tgHTML, 'targetGap')}
</div>`;
```
品質群・モメンタム群も同様（key は対応表 A-3）。閾値の記号併記（`⚠<3`・`⚠期待過多`・`vs WACC …`）は**これまで通り valueHTML 内に残す**（色だけに頼らない方針＝#450 を維持）。

### C-2. `coreChipsHTML` → 各チップを `.val-c` details に＋ⓘ
2×2 grid（`.val-chips`）は維持。各 `.val-c` を `termChip('val-c', label, valueHTML, key, isSortkey ? 'is-sortkey' : '')` に置換。**ソートキー強調 `is-sortkey` を保持**（summary に付与）。`PER`/`PEG`/`%タイル`/`Fスコア` の4枚。

### C-3. `statsHTML` → 各統計を `.val-stat` details に＋ⓘ／旧 `.val-stats-help` を撤去
ヘッダ統計4枚（過大ポジ/割安候補/的中率/トリガー）を `termChip('val-stat', …)` に置換。**従来の単独「ⓘ 統計の見方」`.val-stats-help`（`<details class="val-stats-help">`）は撤去**（各統計に個別ⓘが付くため重複）。
- 的中率の値（`hitRateVal`）は `発議 3/3 ・判定 …` の色付き span を含む既存 HTML。`termChip` の `valueHTML` にそのまま渡す（中の span は維持）。`title` 属性での補足説明は冗長になるので、ⓘ側に集約してよい（title は残しても可）。

---

## タスクD ― CSS（assets/02-tables.css）
**色・サイズは CSS 変数のみ／`!important` 禁止／`assets/*.css` に prettier 一括をかけない（該当ブロックのみ手編集）。**

### D-1. 詳細指標カード `.val-card`
```css
.val-cards { display: grid; grid-template-columns: 1fr; gap: 6px; margin-top: 6px; }
.val-card { border: 1px solid var(--border2); background: var(--surface2); border-radius: 8px; }
.val-card-h {
  display: flex; align-items: baseline; gap: 8px;
  padding: 7px 10px; cursor: pointer; list-style: none;
  font-size: 11px; color: var(--text2);
}
.val-card-h::-webkit-details-marker { display: none; }
.val-card-h .t { color: var(--text); font-weight: 500; }       /* タイトル左 */
.val-card-h .v { margin-left: auto; color: var(--text); }       /* 数値右 */
.val-card-h .ti { color: var(--text3); font-size: 12px; flex: none; }
.val-card[open] .val-card-h .ti { color: var(--accent); }
.val-card-x { margin: 0; padding: 0 10px 9px; font-size: 11px; color: var(--text2); line-height: 1.5; }
```
- **タイトル左／数値右**＝`.t` 左・`.v` を `margin-left:auto` で右寄せ。ⓘは最右。
- スマホ1カラム（`.val-cards` 1fr）。横並べ2カラムにしたい場合は `repeat(2,1fr)` でも可だが、解説アコーディオンの開閉でズレるため**1カラム推奨**。

### D-2. コアチップ `.val-c`／ヘッダ統計 `.val-stat` をⓘ details 化
- 既存 `.val-c`／`.val-stat` のレイアウト（フォントサイズ・`.k`/`.v`/`.b` 等）は流用しつつ、`<details>`/`<summary>` 化に伴うマーカー除去（`::-webkit-details-marker{display:none}` / `list-style:none`）と、`.ti`（ⓘグリフ）・`[open]` 時の解説 `<p>` スタイルを追加。
- `.val-c .ti`／`.val-stat .ti` は小さく `var(--text3)`、`[open]` で `var(--accent)`。解説 `<p>`（`.val-c-x`/`.val-stat-x`）は `font-size:11px; color:var(--text2)`。
- `.is-sortkey` の既存強調は summary に乗るので維持されること（セレクタが効くか確認）。
- **旧 `.val-stats-help` 関連 CSS（621-627 行目あたり）は撤去**（撤去後 prettier 全体整形はしない）。

### D-3. 詳細指標の旧 `.val-met` 系 CSS を撤去
`.val-met`／`.val-met b`（781-790 行目あたり）と `.val-detail-grp .grp-cap` 以外の不要分を整理（グループ見出し `.val-detail-grp .lab`／`.grp-cap` は残す）。撤去は該当ブロックのみ手編集。

---

## 受け入れ条件（チェックリスト）
- [ ] 「詳細指標」の各指標が**独立したチップカード**（枠＋背景）で表示され、**タイトル左・数値右**に揃う。行高はカード単位で一定。
- [ ] Value タブの**全用語**（詳細指標13＋コア4チップ＋ヘッダ統計4）の隣に **ⓘ** が出る。glossary に解説がある語のみ表示（無い語はⓘを出さずプレーン）。
- [ ] ⓘ（または用語チップ）を**タップすると、その用語の真下に解説がアコーディオンで開く**（native details・JS開閉なし）。もう一度タップで閉じる。
- [ ] 解説文の正本は `glossary-data.js`。コード側に説明文の重複定義が無い（`glossaryTermByKey` 経由）。不足3語（株主還元・過大ポジ・割安候補）が glossary-data.js に追加されている。
- [ ] コアチップの**ソートキー強調 `is-sortkey`** と 2×2 grid、サイズバー／アクションバナー／判定確度は従来通り。的中率・トリガーの値表記（hits/resolved・抵触/監視）は #450 のまま維持。
- [ ] 旧「ⓘ 統計の見方」単独 details は撤去され、機能が各統計の個別ⓘに移っている。タブ下部の全文「📘 用語解説」は従来通り併存。
- [ ] ライト/ダーク両モードでⓘ・カードのコントラストが確保（色は CSS 変数のみ・`!important` なし）。
- [ ] 品質ゲート green（vitest / eslint / prettier(src のみ) / check:types / check:circular / e2e）。`index.html` の `?v=` を全 bump。
- [ ] data-action 委譲・escapeHTML 順守（新規 data-action は不要＝native details のため）。

## 触ってはいけない範囲
- `getValuation`／`computeVerdict`／`computeHitRate`／`evaluateTriggers` のロジック・フィールド名（読むだけ）。
- 並べ替え基準・サイズバー・アクションバナー・判定確度・#443 のコア4チップの**並びとソートキー強調ロジック**（見た目に details/ⓘ を足すだけ。値・並び・強調条件は変えない）。
- `glossaryHTML(tab)`（タブ下部全文解説）の既存出力。
- `dist/app.js`（CI 自動ビルド）・`assets/*.css` への prettier 一括。

## 落とし穴
- **details のネスト**：`.val-detail`（外側）の中に各指標 `.val-card` details が入る入れ子になる。valid だが、外側 `.val-detail` を閉じると中身ごと隠れる点は仕様通り（詳細指標を開いてから各語を開く2段）。コアチップ／ヘッダ統計は外側 details に包まれていないので単段。
- **summary 内の data-action**：summary 自体のタップで開閉する。summary 内に別の data-action ボタンを置かない（タップが競合する）。
- **アクセシビリティ**：`<summary>` はデフォルトでフォーカス可能・Enter/Space で開閉。ⓘは `aria-hidden="true"` の装飾グリフにし、説明は summary の `aria-label` で。
- **CSS 行番号**：本 doc の行番号は目安。実装時に該当セレクタを grep して確認。

## ブランチ／PR／Issue
- ブランチ `feat/value-term-cards-info`、base `main`。`Closes #<Issue>`。
- マージ方針：**コア4チップ／ヘッダ統計の構造に手を入れる（load-bearing 近傍）ため、Toshio 事前レビュー**を推奨（CI green 後、自動マージせず一旦確認）。
