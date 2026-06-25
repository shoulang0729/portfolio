# Handoff（2026-06-25）: Risk タブ 信号機リデザイン 仕上げ（#489 への追補）

> 設計＝Mulmo。実装は VS Code が本 doc を正本に着手。**1タスク=1ブランチ=1PR=1Issue**。
> #489（信号機リデザイン）実装後、実画面レビューで出た12点＋微修正3点＋表示バグ1件を反映する仕上げ。
> 視覚リファレンス（確定形）＝`docs/handoff/assets/2026-06-25-risk-polish-v6-mock.html`（ブラウザで開く。これが正・サンプルは実保有/実テーマ設定ベース）。

## 背景／ゴール
Risk タブ ①リスク要約 ②クオンツ ③地域 を、実装済み画面のフィードバックどおり仕上げる。加えて「同じカードが重複表示される」レンダーバグを直す。

---

## タスクA — 表示バグ（カード重複）★最優先・実害
**症状**: 「クオンツ・リスクが2回出る」「同じカードが何度も出る」。
**原因（確定）**: `renderRiskCharts`（`src/risk-charts.js`）は `await buildQuantCard()` / `await buildRegionCard()` を挟む **async**。タブ切替＋価格更新などで**二重起動**されると、先頭の `wrap.textContent=''` でのクリア後に処理が交錯し、**await 後に append されるカード（クオンツが筆頭）だけが重複**する（同期 append の要約カードは重複しにくい）。
**修正**: 世代トークン＋レンダー中ガード。
```js
let _riskRenderSeq = 0;
export async function renderRiskCharts() {
  const myRun = ++_riskRenderSeq;
  // …各 await の直後に：
  if (_riskRenderSeq !== myRun) return; // 後発レンダーに追い越されたら破棄
  // wrap.textContent='' は「全 await 完了後・append 直前」に1回、または上記ガードで二重を抑止
}
```
- 受け入れ: タブを連打／価格更新を挟んでもカードは各1枚。E2E に「Risk タブのカード種別が一意」チェックを足せれば尚良。

---

## タスクB — ①リスク要約
1. **テーマ名を自然言語化**（生キー `japan_theme` 等の露出を撲滅）。ラベルマップを新設（`src/target-allocation.js` に `THEME_LABELS` を定義しエクスポート、`risk-charts.js` で使用）:
   ```js
   export const THEME_LABELS = {
     semiconductor:'半導体', ai_power:'AI電力', megatech:'メガテック',
     japan_theme:'日本テーマ株', commodity_miner:'資源・鉱山', silver:'銀',
     space:'宇宙', europe:'欧州', energy:'エネルギー',
   };
   export const themeLabel = (k) => THEME_LABELS[k] || k;
   ```
   最大集中・テーマ上限超過の**両方**で適用（現状 `maxLabel = theme` が生キー）。triggers.js 等で同種の生キー表示があれば併せて自然言語化。
2. **構成銘柄はティッカー表示**（フルネームでなく `p.symbol`）。現状 `themeMembers[].push({name: p.name…})` → `symbol` に変更。
3. **「他N件」で省略しない＝全件表示**。最大集中の構成銘柄、過大ポジ、テーマ上限超過いずれも `.slice()` で切らず全件チップ表示。
4. **過大ポジ／テーマ上限超過の右側値＝件数「N件」**（"全件表示"や"超過あり"という文言は使わない）。ピルは状態語（注意／超過）、右値は件数、明細は下のチップに全件。
5. **「目標超過pt」を用語解説に追加＆インライン補足**。過大ポジ明細は `<ticker> 目標X%→現Y%（+Zpt）`。pt の意味＝現ウェイト−目標ウェイト（%ポイント）。

---

## タスクC — ②クオンツ・リスク
1. **経緯/読み筋の物語キャプションは削除**。代わりに「**これは何？**」＝何を表すかの1行のみ残す（例「現PFのウェイトで過去の暴落を再現し、その期間の下落率を出したもの」）。
2. **イベント名から年を除去**（年月を別に出すため重複を消す）。例「関税ショック 2025」→「関税ショック」、「2022 利上げ弱気（秋の脚）」→「利上げ弱気（秋）」。`stress-events.json` の label はいじらず、**表示時に先頭/末尾の西暦4桁を除去**するか、`shortLabel` を導出。日付は別表示で **「YYYY年M月／YYYY年M〜M月」**（#489の `fmtEventPeriod` を流用）。
3. **リスク寄与 Top3 はティッカー表示**（`nameOfSymbol` のフルネームでなく `symbol`）。
4. **謎の "?" ヘルプアイコンを廃止**。年率ボラ・最大DD は値の**直下に意味を1行**で直接表記（"?" をタップさせない）。
5. **年率ボラ・最大DD の数値は右寄せ・同じ高さに整列**。各カードを「ラベル左／数値右（同一行・`justify-content:space-between` / `align-items:baseline`）＋説明を下段」に。`font-variant-numeric:tabular-nums`。2カードは `align-items:stretch` で等高。

---

## タスクD — ③地域の傾き
1. **ゲージ上下の説明文を削除**。現状 hero の `…ホームバイアス … 意図的なら問題なし、無意識なら是正の検討材料`（`buildRegionCard` 内）を撤去。
2. **ACWI は「到達目標」ではなく「参考線」**に格下げ。地域はルックスルー構成バー（日本／北米／欧州／新興国／現金等）で表示し、**日本バー上に世界株指数(ACWI)日本比率5%の細い縦の参考線**を置くだけ。注記は1行 `縦線=ACWI日本5%の位置。合わせる必要はなく世界平均に対する傾きの目安` 程度に短縮。
3. 用語（真の地域%・ホームバイアス）の定義は**末尾の用語解説**に集約（カード内に長文説明を置かない）。

---

## タスクE — 用語解説（タブ末尾・共有コンポーネント）
1. **配置**: 「地域の傾き」カードの**外**＝タブ末尾の独立ブロック（現状 `buildRiskGlossary` が末尾に単独 append 済み＝この配置を維持。カード内に入れない）。
2. **見出し文言**: `src/glossary.js` の `📘 用語解説（タップで開く）` → **`📘 用語解説`**（「（タップで開く）」を削除）。
   > ⚠ glossary.js は **Value タブと共有**。この変更は両タブに反映される（文言統一なので問題なし＝意図どおり）。
3. **用語追加**: 「目標超過pt」を `glossary-data.js` の risk カテゴリに追加（既出の真の地域%・ホームバイアス・年率ボラ・最大DD は維持）。テーマ名一覧（THEME_LABELS）は任意で用語解説末尾に併記してよい。

---

## 受け入れ条件（チェックリスト）
- [ ] **カード重複が再現しない**（タブ連打／価格更新を挟んでも各カード1枚）。
- [ ] テーマ名が**全箇所で自然言語**（`japan_theme` 等の生キーがどこにも出ない）。
- [ ] 構成銘柄・リスク寄与が**ティッカー表示**。
- [ ] 過大ポジ・テーマ上限超過・最大集中構成が**全件表示**（「他N件」省略なし）。右側値は**件数「N件」**。
- [ ] **目標超過pt** が用語解説にあり、過大ポジ明細が `目標X%→現Y%（+Zpt）`。
- [ ] クオンツ：物語キャプション無し／「これは何？」1行のみ／イベント名に年なし＋日付「YYYY年M月」／"?" アイコン廃止で値の下に直接説明／ボラ・最大DD は右寄せ・等高。
- [ ] 地域：上下の説明文なし／ACWI は参考線のみ／地域構成バー表示。
- [ ] 用語解説はタブ末尾の独立ブロック・見出し「📘 用語解説」（「（タップで開く）」なし）。
- [ ] 品質ゲート green／`?v=` 全 bump／色は CSS変数のみ・`!important` 禁止・`escapeHTML`（テーマ名・銘柄・イベント名）／`assets/*.css` に prettier 一括をかけない。

## 触ってはいけない範囲
- `risk-calc.js`／`region-calc.js`／`target-allocation.js` の**算出ロジック**（`japanHomeBias`・`computeTrueRegionExposure`・`computeThemeUsage`・`eventStress` 等）。本件は**表示層＋ラベル＋レンダーガード**のみ。
- `stress-events.json`／`region-*.json`／`target-allocation.json` のスキーマ。
- mf-holdings の load-bearing フィールド（`cat/cur/value/totals.imported/asOf`）・`dist/app.js`（CI自動ビルド）。

## ブランチ／PR／Issue
- ブランチ `feat/risk-polish-v6`、base `main`、squash。`Closes #<本Issue>`。
