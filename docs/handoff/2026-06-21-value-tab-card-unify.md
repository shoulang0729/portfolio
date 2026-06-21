# Handoff（2026-06-21）: Value タブ カード統一 — 「レンズ＝並べ替えのみ」化

> 設計=Mulmo。実装はこの doc を正本に VS Code が **1タスク=1ブランチ=1PR=1Issue** で着手（チャネル原則 §`mulmo-vscode-workflow.md`）。
> 設計変更が要るときは口頭パッチせず Mulmo に戻して本 doc を更新 → 新版を渡す。

---

## 1. 背景／ゴール

### 背景（現状の問題）
Value タブはカードの**枠**（アクションバナー／銘柄+Verdict／サイズバー／判定確度）は全レンズ共通だが、**指標の段だけがレンズごとに別物に差し替わる**：

| レンズ | 指標段の実装 | 作り | 指標数 |
|---|---|---|---|
| 総合 (`total`) | `totalChipsHTML` | 枠付き大チップ（15px太字）の3列グリッド | 3 |
| バリュ (`value`) | `line3HTML` | 枠なし灰色テキストの折返し列（11px） | 8 |
| 品質 (`quality`) | `line3HTML` | 同上 | 6 |
| モメンタム (`momentum`) | `line3HTML` | 同上 | 4 |

→ レンズ切替（＝並べ替え）が「きれいな箱3つ」⇄「密な灰色テキストの塊」というレイアウトの作り替えになり、カード高さも視覚言語も変わる。これが「総合と総合以外でずいぶんビューが違う」の正体。

### ゴール（ユーザー確定・2026-06-21）
- **正準カードを1種類に固定**。レンズ切替は **並べ替え＋ソートキーの軽い強調のみ**。指標段はもう作り替えない。
- 常時表示は**厳選コアチップ4枚に統一**（総合の見やすい箱を全レンズへ展開し、灰色テキストの塊を廃止）。
- 深い指標は失わず **「詳細指標」タップ展開**に退避（カード既定形は常に同じ）。

### ユーザー決定（フォーム回答）
- カードの作り＝**A 案**：固定コアチップ＋『詳細指標』タップ展開（レンズ=並べ替えのみ）。
- 常時表示コアチップ（4枚）＝ **PER 実績→予想（向き）／PEG／%タイル（自分のバンド位置）／Fスコア（罠/本物）**。
- 選択中レンズの並べ替えキーを**カード上で強調する**。

---

## 2. 対象ファイル一覧

| ファイル | 区分 | 内容 |
|---|---|---|
| `src/valuation-tab.js` | 変更 | カードのメトリクス段をレンズ非依存に統一。コアチップ/詳細展開/ソートキー強調を実装。 |
| `assets/02-tables.css` | 変更 | `.val-chips`（4枚2×2）・`.is-sortkey` 強調・`.val-detail`（展開）スタイル。 |
| `index.html` | 変更 | `?v=YYYYMMDDX` を全 bump（CSS/JS/SW 全箇所）。 |
| `tests/`（任意） | 追加 | 純関数化した `sortKeyForLens` 等があればユニットテスト。 |

**並べ替えロジック（`sortedRows`）・`computeVerdict`・`getValuation`・サイズバー・アクションバナー・判定確度・統計ヘッダ・用語解説は挙動を変えない。**

---

## 3. 変更手順（ファイル単位）

### 3-1. `src/valuation-tab.js`

#### (a) カード本体 `rowHTML` — メトリクス段をレンズ非依存に
現状：
```js
const metrics = _lens === 'total' ? totalChipsHTML(val) : line3HTML(val);
```
変更後：**レンズ分岐を撤廃**し、常に同じコアチップ＋詳細展開を出す。
```js
const metrics = coreChipsHTML(val, _lens);   // 4枚固定・lens でソートキーだけ強調
const detail  = detailHTML(val);             // <details> 全レンズ共通の深掘り
// 並び: banner → head → size → metrics → 判定確度 → detail
return `<div class="val-row">${banner}<div class="val-body">${head}${size}${metrics}${confLine}${detail}</div></div>`;
```

#### (b) `coreChipsHTML(val, lens)` — 新設（`totalChipsHTML` を 4枚へ拡張して置換）
- チップは固定4枚（順序固定）：
  1. `per` … `PER` = `perTrail→perFwd`（例 `31→20`）
  2. `peg` … `PEG`
  3. `pct` … `%タイル` = `percentile`（例 `12%ile`）
  4. `f` … `Fスコア` = `quality.fScore`
- 値が無い項目は `—`（既存 `fmtRaw` を流用）。
- **ソートキー強調**：`sortKeyForLens(lens)` が返す chip id に `is-sortkey` クラスを付ける（下表）。
- `totalChipsHTML` は削除（このコアチップに統合）。

```html
<div class="val-chips">
  <span class="val-c is-sortkey"><span class="k">%タイル</span><b>12%ile</b></span>
  ...
</div>
```

#### (c) `sortKeyForLens(lens)` — 新設（純関数・テスト対象）
レンズの並べ替え基準を、カード上で強調する対象に対応づける：

| lens | 並べ替え基準（既存 `sortedRows`） | 強調対象 |
|---|---|---|
| `total` | `gap` DESC（サイズ乖離） | **サイズバー** （`.val-size-wrap` に `is-sortkey`）。コアチップ強調なし。 |
| `value` | `percentile` ASC | コアチップ **`pct`（%タイル）** |
| `quality` | `qScore` DESC | コアチップ **`f`（Fスコア）**＝品質の代表値（深い qScore は詳細に） |
| `momentum` | `priceMom1Y` DESC | **該当コアチップ無し**（下記 既知トレードオフ参照）。レンズキャプション側で表現。 |

- 返り値は `{ chip: 'pct'|'f'|null, sizeBar: boolean }` のような形を推奨（実装者裁量）。

#### (d) `detailHTML(val)` — 新設（`line3HTML` を解体して再構成）
- `<details class="val-detail"><summary>詳細指標</summary> … </details>`。
- **全レンズで同じ内容**（カードを安定させる目的）。中身は3グループに整理。コアチップと重複する PER/PEG/%タイル/F は**載せない**（重複回避）。
- 既存の色キュー（ROIC<WACC=`val-bad`、Altman Z<3=`val-warn`、モメンタム up/down=`val-mom-*`、目標乖離の符号色）はそのまま移植。

グループ構成（`line3HTML` の各レンズ枝から、コア4項目を除いた残りを移送）：

- **バリュ**：`EV/EBITDA` ／ `FCF利回り` ／ `株主還元` ／ `織込成長`（リバースDCF・`impliedGrowth`、cyclical は `—`）／ `目標株価乖離`（符号色）
- **品質**：`ROIC vs WACC`（ROIC<WACC は赤）／ `粗利/資産` ／ `FCF変換` ／ `Altman Z`（<3 注意色）／ `Qスコア`
- **モメンタム**：`改定90d`（EPS revision）／ `1Y騰落`（符号色）／ `52週位置` ／ `対市場`（rs vs ACWI）

- グループ見出しは小さなラベル（例 `.val-detail-grp > .lab`）。中の指標行は既存 `.val-met`（flex 折返し）を再利用してよい。
- `line3HTML` 本体は削除（中身を上記グループビルダーに移植）。

#### (e) サイズバー強調（total レンズ）
- `rowHTML` でサイズバーを包む `.val-size-wrap` に、`lens==='total'` のとき `is-sortkey` を付与。

### 3-2. `assets/02-tables.css`

> ⚠ CSS には `prettier --write` を掛けない（format script は `src/**/*.js` のみ。全体再整形で巨大 diff 化する）。該当ブロックのみ手で編集。

- `.val-chips`：**4枚2×2グリッド**へ。`grid-template-columns: repeat(2, 1fr);`（モバイルで `PER 31→20` が潰れない）。既存の箱スタイル（`.val-c`）は流用。
- `.val-c.is-sortkey`：アクセント強調（`border-color: var(--accent)` ＋ `background: color-mix(in srgb, var(--accent) 10%, transparent)` 程度）。`!important` 禁止・色は CSS 変数のみ。
- `.val-size-wrap.is-sortkey`：同系のアクセントリング（角丸＋細枠）。
- `.val-detail`：`.val-gloss`（用語解説）と同系の native `details` スタイル。`summary` は `▸/▾` で開閉が分かる程度の最小装飾。
- `.val-detail-grp .lab`：10px・`--text3` の小見出し。
- 不要化する `.val-met` の**レンズ固有依存**は無いのでセレクタは残置可（詳細グループ内で再利用）。`.val-chips` の旧 `repeat(3,1fr)` は2列へ更新。

### 3-3. `index.html`
- `?v=` を CSS/JS/SW 登録 URL すべて同値へ bump（例 `20260621A`）。

---

## 4. 受け入れ条件（チェックリスト）

- [ ] 4レンズすべてで **カードのレイアウト・高さ・要素構成が同一**（指標段が作り替わらない）。レンズ切替で変わるのは「並び順」と「ソートキー強調の位置」だけ。
- [ ] コアチップは **PER（実績→予想）／PEG／%タイル／Fスコア** の4枚固定、2×2、箱スタイル。値欠損は `—`。
- [ ] `value` で %タイルチップ、`quality` で Fチップ、`total` でサイズバーにアクセントリングが付く。`momentum` はカードのキャプション/レンズピルで並べ替えが分かる（チップ強調無しでよい）。
- [ ] 「詳細指標」をタップで、バリュ/品質/モメンタムの深い指標（EV/EBITDA・FCF利回り・還元・織込成長・目標乖離・ROIC vs WACC・粗利/資産・FCF変換・Altman Z・Qスコア・改定90d・1Y・52週位置・対市場）が**全レンズ同じ内容**で展開される。色キュー保持。
- [ ] 既存の統計ヘッダ（過大ポジ/割安候補/的中率/トリガー）・並べ替え順・Verdict・サイズバー・アクションバナー・判定確度・用語解説の**挙動が不変**。
- [ ] 品質ゲート green（vitest / eslint / prettier(src のみ) / check:types / check:circular / e2e）。
- [ ] `index.html` の `?v=` を全 bump。
- [ ] data-action 委譲・`escapeHTML` 必須・色は CSS 変数のみ・`!important` 禁止を遵守。
- [ ] 期待挙動：レンズを4つ切り替えても「同じカードが並び替わるだけ」に見える。

---

## 5. 触ってはいけない範囲（load-bearing・既存挙動）

- `getValuation` / `computeVerdict` / `valuations.js` の**フィールド名・ロジック**（`value.perTrail/perFwd/peg/percentile/quality.fScore` 等を読むだけ。改名・改変禁止）。
- `sortedRows` の**並べ替え基準**（total=gap / value=percentile / quality=qScore / momentum=priceMom1Y）。今回は表示統一のみで並び順は変えない。
- サイズバー（`sizeBarHTML`）・アクションバナー（`bannerHTML`）・判定確度（`confidenceHTML`）・統計ヘッダ・用語解説の中身。
- `mf-holdings` の load-bearing フィールド（`cat/cur/value/totals.imported/asOf`）。
- `dist/app.js`（CI 自動ビルド・手 commit 不可）。`assets/*.css` への一括 prettier。

---

## 6. 既知のトレードオフ（実装後ユーザーに見せて再判断）

- **モメンタムレンズはカードのコアチップに代表値（1Y）が無い** → 並べ替えキーがカード表面に出ない。まず4枚で進め、モメンタムレンズが「空」に感じるなら **1Yモメンタムをコア5枚目に昇格**する余地を残す（その場合 `.val-chips` を 5枚レイアウトへ。設計に戻して本 doc を更新する）。
- コアと詳細の重複回避のため、詳細にはコア4項目を再掲しない。深い qScore は詳細・品質グループに残す（コアの F とは別物）。

---

## 7. ブランチ／PR／Issue

- ブランチ：`feat/value-card-unify`（base=`main`、push 前に `git pull --rebase`）。
- PR：本 doc を参照。`Closes #<Issue>`。
- Issue：本 doc へのリンク＋ゴール要約のみ（設計内容は複製しない＝doc が正本）。
- squash マージ＋ブランチ auto-delete。
