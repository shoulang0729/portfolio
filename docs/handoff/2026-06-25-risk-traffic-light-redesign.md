# Handoff（2026-06-25）: Risk タブ ①リスク要約 ②クオンツ の信号機リデザイン

> ✅ **実装完了（2026-06-24・PR#489 / Issue#488 クローズ）**＝①要約バナー＋信号機行・②クオンツを歴史イベント再現に置換・③地域 hero 比較バー・④自前 SVG スプライト化。PM盤面モニタで完了確認（2026-06-25）。残課題はイベント日付表記（§2-2）のみ。
> 設計＝Mulmo。実装は VS Code が本 doc を正本に着手。**1タスク=1ブランチ=1PR=1Issue**。
> 視覚リファレンス＝`docs/handoff/assets/2026-06-25-risk-traffic-light-mock.html`（ブラウザで開く。ライト/ダーク・実保有/実イベント名ベース）。
> ユーザー（Toshio）承認済み。残課題はイベントの日付表記のみ（後述 §2-2）。

## 背景／ゴール
Risk タブ先頭の **①「リスク要約（致命傷回避）」** と **②「クオンツ・リスク」** が「ラベル＋裸の数字」の羅列で不親切（良し悪し・次の一手・銘柄が読めない）。信号機サマリーに刷新し、以下を満たす:
1. **①要約**＝総合判定バナー（緑/黄/赤）＋指標を「アイコン＋ラベル＋状態ピル＋値＋一言＋**該当銘柄名**」の行に。
2. **②クオンツ**＝意味の薄い時間窓ラダー（1日/1週/1月/3月＝長い窓ほど深いのは自明）を廃止し、**名前のある歴史イベントを現PFで再現した「下落の深さ」**に置換（`eventStress`＋`stress-events.json` を流用）。これに伴い**別カード「歴史的危機の再現（what-if）」は統合・廃止**（ユーザー承認済）。
3. **地域 hero**＝裸の「日本 真%」を「あなたのPF vs 世界平均」の比較バーに。用語名を解説と一致（"真の地域%"）＋ⓘツールチップ。
4. **アイコンは絵文字を全廃**し、stroke 統一の自前 SVG スプライトに。

---

## 対象ファイル
| ファイル | 変更 |
|---|---|
| `index.html` | （新規）非表示 SVG スプライト `<defs><symbol>` 群を `<body>` 先頭に追加。`?v=` 全 bump。 |
| `src/risk-charts.js` | `buildRiskOverviewCard`（①書換）/ `buildQuantCard`（②書換）/ `buildStressCard`（廃止＝②へ統合）/ `buildRegionCard` hero（③書換）/ `renderRiskCharts`（呼び出し整理）。 |
| `assets/02-tables.css` | 新クラス（`.rv-*` verdict / `.rmrow` / `.rev` event / `.rcmp` 比較バー / `.rq-stat2` 等）追加。旧 `.ro-*`/`.rq-*`/`.stress-*` は新 DOM 不使用分を撤去。**prettier 一括禁止**。 |

> 命名衝突回避のため新クラスは `r`-接頭辞で新設し、旧 `.ro-*/.rq-*/.stress-*` を置換する方針（既存と混在させない）。

---

## §1 カスタムアイコン（絵文字廃止）

`index.html` の `<body>` 直後に**非表示スプライト**を 1 つ置き、各所から `<svg class="ric"><use href="#i-shield"/></svg>` で参照（CSP 安全＝inline JS/onclick 無し）。

```html
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l7 2.6v6c0 4.4-3 7.2-7 8.4-4-1.2-7-4-7-8.4v-6L12 3z"/><path d="M9 11.8l2.1 2.1 4-4.2"/></symbol>
  <symbol id="i-coin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.2"/><path d="M12 7.6v8.8M9 12.3h6M9 14.4h6M12 7.6l-3 3.4M12 7.6l3 3.4"/></symbol>
  <symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="3.6"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></symbol>
  <symbol id="i-expand" viewBox="0 0 24 24"><path d="M4 9V4.5h4.5M20 9V4.5h-4.5M4 15v4.5h4.5M20 15v4.5h-4.5"/><path d="M9.5 12h5"/></symbol>
  <symbol id="i-layers" viewBox="0 0 24 24"><path d="M12 3.6l8.4 4.2L12 12 3.6 7.8 12 3.6z"/><path d="M3.6 12L12 16.2 20.4 12M3.6 16.2L12 20.4l8.4-4.2"/></symbol>
  <symbol id="i-history" viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 107.5-7.5A7.5 7.5 0 005 8.5M4.5 4.5v4h4"/><path d="M12 8.2v4.3l2.8 1.8"/></symbol>
  <symbol id="i-pulse" viewBox="0 0 24 24"><path d="M3 13.5h3.2l2.3-7.2 3.3 12.4 2.4-8.2 1.4 3h5"/></symbol>
  <symbol id="i-link" viewBox="0 0 24 24"><path d="M9.5 14.5l5-5"/><path d="M8 12l-2.2 2.2a3.1 3.1 0 004.4 4.4L12 16.6M16 12l2.2-2.2a3.1 3.1 0 00-4.4-4.4L12 7.4"/></symbol>
  <symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.4"/><path d="M3.6 12h16.8M12 3.6c2.6 2.4 2.6 14.4 0 16.8M12 3.6c-2.6 2.4-2.6 14.4 0 16.8"/></symbol>
  <symbol id="i-book" viewBox="0 0 24 24"><path d="M5 4.5h10.5a2 2 0 012 2V20a1.6 1.6 0 00-1.6-1.6H5V4.5z"/><path d="M5 4.5v15.4"/></symbol>
  <symbol id="i-warn" viewBox="0 0 24 24"><path d="M12 4.2l8.4 14.6H3.6L12 4.2z"/><path d="M12 10v4.2M12 16.8v.1"/></symbol>
</defs></svg>
```
```css
.ric{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;
  stroke-linecap:round;stroke-linejoin:round;flex:none;vertical-align:middle}
.ric-sm{width:14px;height:14px}
```
- アイコン色は親の `color`（見出しは `var(--accent)`、行アイコンは `var(--text2)`）。
- 用途: shield=要約／coin=キャッシュ／target=集中・分散／expand=過大ポジ／layers=テーマ／history=クオンツ(危機再現)・最大DD／pulse=ボラ・リスク寄与／link=相関／globe=地域／book=用語解説／warn=判定バッジ。
- a11y: スプライトは `aria-hidden="true"`。各カードの既存 `aria-label` は維持。

---

## §2 ②クオンツ・リスク（最重要・新規ロジック）

### 2-1 イベント別「下落の深さ」（時間窓ラダーを置換）
- データ源＝**既存** `loadStressEvents()`（`data/stress-events.json`）＋ `eventStress(seriesMap, weights, ev.from, ev.to)`。**`buildStressCard` のロジックを `buildQuantCard` 内に移植**し、別カードは廃止。
- 各イベント行（下落の大きい順 = `res.ret` 昇順）:
  - **イベント名**（`escapeHTML(ev.label)`）＋ **日付（§2-2 の和暦風表記）**。
  - 横バー：`width = |ret| / maxAbsRet * 100`（`maxAbsRet`＝当回イベント群の最大下落絶対値で正規化）。グラデーション `linear-gradient(90deg,var(--warn),var(--neg))`。
  - 右に下落率（`-X.X%`・`var(--neg)`・tabular-nums）。
  - 下に `cov NN%`、90%未満は `var(--warn)`＋`⚠`（既存 `lowCov` 判定を踏襲）。`res.ret==null`（窓内データ無）は行末 `—`・バー無し・末尾へ。
- **読み筋キャプション**（1行）：最も深いイベントとPFの偏りを結ぶ動的文（例「半導体偏重のため DeepSeek 型の半導体ショックで特に深い」）。最深イベントの label と最大集中テーマから組み立てる。難しければ静的でも可。

### 2-2 日付表記（ユーザー要望）★
イベント日付は **「YYYY年M月」** 形式で表示する（`ev.from`/`ev.to` の `YYYY-MM-DD` から導出）。
- 同月内: `2025年4月`
- 月跨ぎ同年: `2022年8〜10月`
- 年跨ぎ: `2024年12月〜2025年1月`
ヘルパー例（実装側で命名は任意）:
```js
function fmtEventPeriod(from, to){
  const f=new Date(from), t=new Date(to);
  const fy=f.getFullYear(), ty=t.getFullYear(), fm=f.getMonth()+1, tm=t.getMonth()+1;
  if(fy===ty&&fm===tm) return `${fy}年${fm}月`;
  if(fy===ty) return `${fy}年${fm}〜${tm}月`;
  return `${fy}年${fm}月〜${ty}年${tm}月`;
}
```
（`title` 属性には従来どおり `from〜to`＋`note` の正確な日付を残す。）

### 2-3 参考スタッツ＋寄与＋分散（クオンツ下段）
- **参考値**（恣意的な"適正≤20%"バンドは出さない）: `年率ボラ` `最大DD` を2枚の `.rq-stat2` カードで「参考値」ラベル付き表示。ⓘは `title` で定義（ボラ/最大DD）。
- **リスク寄与 Top3**: `nameOfSymbol(sym)` で名称化（生ティッカー単独表示禁止）。横バー（最大寄与=100%基準）。
- **分散・流動性**: 高相関ペア（`nameOfSymbol` 名称・相関値）／出口日数（最長・銘柄名）。チップ2枚。
- 履歴未取得時は既存のグレースフルメッセージ（`履歴未取得（Historical/Watch…）`）を踏襲。

### 2-4 別カード廃止
`renderRiskCharts` から `buildStressCard` の呼び出しを削除し、関数とその専用CSS（`.stress-*`）を撤去。`loadStressEvents`/`ensureStressHistory`/`eventStress` は②へ移して存続。

---

## §3 ①リスク要約（信号機・銘柄名つき）
- **総合判定バナー**（既存 `breaches` カウントを流用）: 0=緑「リスク低（閾値抵触なし）」/ 1=黄「注意 1件」/ ≥2=赤「要注意 N件」。warn アイコン＋平易な補足文。**先頭固定**。
- 指標を4つの **`.rmrow`**（アイコン枠＋本文）に再構成。各行＝ラベル／状態ピル（ok/warn/bad）／値（右寄せ太字）／一言キャプション。
  1. **投資用キャッシュ比率**（coin）: 5–20%適正、外れで warn ピル＆`var(--warn)`。
  2. **最大集中（テーマ）**（target）: 値＝最大テーマ%。**その構成銘柄を `.htag` チップで列挙**（例 `SMH 9.4%` `200A 7.2%`）。20%超で bad。単一銘柄が最大なら銘柄名で。キャプションに単一筆頭（オルカン等）も一言。
  3. **過大ポジ（目標超過）**（expand）: **どの銘柄が超過か**を `.htag.hot` で明示（`200A 目標7%→12.1%`）。`computeGap>0.5` の銘柄名・現%・目標%・超過pt。複数なら最大のものを主表示＋「他N件」。
  4. **テーマ上限超過**（layers）: 超過テーマのチップ or「なし」。
- **色トークン是正（前 handoff #451 から継続）**: 「悪い数字」は `var(--neg)`/`var(--warn)`。旧 `.ro-v-bad` が `var(--up)` にマップされていた誤りを**修正**（up=上昇色を悪事象に使わない）。

---

## §4 ③地域 hero（比較バー＝実装バグ注意）
- hero を「日本 真%」単独表示から **比較2バー**へ:
  - `あなたのPF / 日本 真の%` … `var(--accent)` バー＋値（`bias.japanPct`）
  - `世界平均 / ACWIの日本%` … `var(--text3)` バー＋値（`bias.benchPct`＝5）
  - 幅は `pct / maxScale * 100`（`maxScale`＝両者最大値を少し上回る固定 or 50%）。
- キャプション: `ホームバイアス +X.Xpt ＝世界平均の約N倍`（`bias.biasPt`／`japanPct/benchPct` 比）。「意図的なら問題なし、無意識なら是正の検討材料」。
- **★実装バグ注意（モックで踏んだ）**: バーの塗り要素を `<span>` のまま `width:%` にすると**インライン要素では幅が効かず潰れる**。塗りは必ず `display:block`（または `position:absolute`）にすること。
- 用語名を解説と一致: ラベルは「日本（真の地域%）」、`title` 属性 or ⓘ にツールチップ。**新規計算は不要**（`japanHomeBias()` が `japanPct/benchPct/biasPt` を算出済み）。
- 用語解説（📘 `buildRiskGlossary`）は現状どおり末尾に常設（Valueタブと同一 `glossaryHTML`）。`glossary-data.js` の region 用語は既存のままでよい。

---

## 受け入れ条件（チェックリスト）
- [ ] **①要約**＝判定バナー＋4行（アイコン/ピル/値/一言）。**集中・過大ポジに銘柄名**が出る。内部フェーズ用語（"4b"等）露出なし。
- [ ] **②クオンツ**＝イベント別「下落の深さ」（深い順・バー・cov）。**日付が「YYYY年M月／YYYY年M〜M月」表記**。時間窓ラダー（1日/1週/1月/3月）は無い。参考ボラ/最大DD・リスク寄与Top3（名称化）・分散/流動性。
- [ ] 別カード「歴史的危機の再現（what-if）」は**消えている**（②へ統合）。
- [ ] **③地域 hero**＝比較2バーが**実際に塗られて**表示（display:block）。用語名「真の地域%」一致＋ⓘ。📘はValueと同一。
- [ ] **アイコンは全て自前SVG**（絵文字なし）。stroke 1.7 統一・`currentColor`・ライト/ダーク両対応。
- [ ] 品質ゲート green（vitest/eslint/prettier/check:types/check:circular/e2e）。`index.html` の `?v=` 全 bump。色は **CSS変数のみ**・`!important` 禁止・`escapeHTML`（イベント名・銘柄名）。`assets/*.css` に prettier 一括をかけない。

## 触ってはいけない範囲
- `risk-calc.js` の各指標算出式・`eventStress`/`region-calc.js` の地域分類ロジック・`japanHomeBias`（**表示層の差し替えのみ**）。
- `region-map.json`/`region-weights.json`/`stress-events.json` のスキーマ。
- mf-holdings の load-bearing フィールド（`cat/cur/value/totals.imported/asOf`）。
- `dist/app.js`（CI自動ビルド）。

## ブランチ／PR／Issue
- ブランチ `feat/risk-traffic-light`、base `main`、squash マージ。`Closes #488`。
