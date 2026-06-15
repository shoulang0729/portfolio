# Briefing 生成スペック（クラウド生成プロンプト貼り付け用）

> **用途**: 週次 Briefing HTML を生成するクラウド側ルーティン（MulmoClaude）のプロンプトに、この章を**そのまま貼る**ための確定仕様。
> repo 側の `docs/investment-system-architecture.md` は内部メモで生成は駆動しない。**生成挙動を変えたいときはクラウドのプロンプトを直すこと。**
> **リファレンス実装** = `data/briefings/2026-06-13.html`（この仕様を満たした実物。構造・class・CSS はこれをそのまま踏襲する）。

---

## 0. 出力の基本

- **自己完結のモバイル HTML 1ファイル**。`data/briefings/YYYY-MM-DD.html` に保存し、`data/briefings/index.json` に号を追記（過去号を消さず**蓄積**する）。
- アプリ配色トークンを内蔵（`--bg/--surface/--surface2/--border/--text/--text2/--accent/--up/--down/--stance`）。`:root` ＋ `@media (prefers-color-scheme:dark)` ＋ `html[data-theme="light"|"dark"]` の3系統を定義（リファレンス実装の `<style>` をそのまま使う）。
- 色は**日本市場慣例**：`--up`＝赤（上昇/含み益）、`--down`＝緑（下落/含み損）。
- `index.json` 例:
  ```json
  { "updated": "YYYY-MM-DD",
    "issues": [ { "date": "YYYY-MM-DD", "title": "Briefing YYYY/MM/DD", "path": "data/briefings/YYYY-MM-DD.html" } ] }
  ```

## 1. ヘッダー（`<header>`）

- **大見出し `<h1>Briefing</h1>` は出さない**（アプリのタブで明示済み・重複）。
- `.date` は**日付のみ**：`YYYY/MM/DD（曜）週次`。**スタンスはここに出さない**（→ §1 トレンド先頭へ）。
- `.nav`（ピル）はセクション順と一致：`トレンド / マクロ / ヘルスチェック / PER / メンター / トリガー / 来週`。

## 2. セクション構成（順序・番号・nav を常に一致）

| # | id | 見出し |
|---|-----|--------|
| 1 | s1 | **トレンド** |
| 2 | s2 | マクロ |
| 3 | s3 | ヘルスチェック |
| 4 | s4 | PERアナリシス |
| 5 | s5 | メンター |
| 6 | s6 | トリガー＆アクション |
| 7 | s7 | 来週の注目イベント |

---

## §1 トレンド ★最重要・回帰しやすいので厳守

**資産の「金額・比率」は §1 に一切出さない**（総資産＝アプリの stats バー／キャッシュ＝stats バーの「投資用キャッシュ」／現預金内訳＝Exposure タブに集約済み）。

### ❌ §1 に入れてはいけない（過去に生成器が何度も復活させた）
- `<div class="total">…</div>`（¥570M 等の**総資産/運用資産総額**）。**いかなる総額数値も出さない**。
- `<div class="cashline">…</div>`（**キャッシュ比率・現金預金など、金額/比率の行は一切載せない**）。
- 現預金・暗号資産の金額内訳行、比率値の後ろの括弧書き（例 `（運用資産の14.3%）`）。

### ✅ §1 の構成（この順・この要素だけ）
```html
<section id="s1">
  <div class="sec-title"><b>1</b> トレンド</div>
  <div class="card">
    <!-- 先頭＝結論ヘッドライン。スタンスはここに置く（ヘッダーには出さない） -->
    <div class="trend-stance">スタンス <span class="stance">⚠ 黄信号（…）</span></div>

    <!-- 今週の地合い：行＝主要指数（S&P500・日経平均 等）、列＝月〜金の5列固定 -->
    <table class="perf">
      <thead><tr><th>今週の地合い</th><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th></tr></thead>
      <tbody>
        <tr><td>S&amp;P500</td><td>…</td><td class="down">…</td><td class="down">…</td><td class="up">…</td><td class="up">…</td></tr>
        <tr><td>日経平均</td><td>…</td><td class="up">…</td><td class="down">…</td><td class="down">…</td><td class="up">…</td></tr>
      </tbody>
    </table>

    <!-- 今週の主役 Top3（保有＋ウォッチから） -->
    <div class="movers">
      <div class="mv-col"><div class="mv-h up">今週の主役 ▲</div>
        <div class="mv"><span>銘柄</span><span class="up">+x%</span></div> …3件</div>
      <div class="mv-col"><div class="mv-h down">今週の重し ▼</div>
        <div class="mv"><span>銘柄</span><span class="down">-x%</span></div> …3件</div>
    </div>

    <div class="insight"><span class="ilabel">💡 Claudeのインサイト：</span>…</div>
    <div class="note">※今週の地合い・主役は概算。総資産・現預金・キャッシュ比率は stats バー／Exposure で確認。</div>
  </div>
</section>
```
- **今週の地合いは必ず月〜金の5列**。**非営業日は「休」**と明示（祝日・休場）。値は質的表現（「小動き」「急落 -1.6%」等）でも可。
- 行は主要指数を複数（最低 **S&P500 ＋ 日経平均**）。

---

## §2 マクロ
- 指標テーブル（`table.mkt`）：日経平均・TOPIX・ダウ・S&P500・Nasdaq100・ハンセン・米10年債・**ドル円**・**VIX**。列＝1週/1月/3月/6月/1年。
- **ドル円・VIX は各期間セルを「実数値（指数水準/レート）」で表示**（％ではない）。セルの色（`up`/`down`）は**現在値への騰落方向**。
- 株価指数は騰落%、債券は bp のまま。`.lv` に現在値（例「現在 160.6」）。
- 末尾 `.note` に概算である旨。

## §3 ヘルスチェック
- 集中リスクを `.flag`（テーマ集中・コモディティ・地域偏重 等）＋ `.lab`（hi/mid/ok）で列挙。
- `.insight`（売り発議）でこちらから出す売りシグナル。

## §4 PERアナリシス
- **保有銘柄**：`⚠ 割高・注意（保有）` / `◎ 割安・妥当（保有）` を `.subh`＋`.flag` で。
- **ウォッチリスト銘柄も評価対象に含める**：`.subh` =「ウォッチリスト（監視中）」。**絵文字（👁 等）は使わない**——細線 SVG アイコンか無しでミニマルに（リファレンス実装は `.subh-ic` の line-eye SVG）。
- `.insight` で相対割安の受け皿等。

## §5 メンター（旧§3。トリガーの直前に置く）
- `.ment`（who＋claim）：じっちゃま（広瀬隆雄）／中島聡／ゆな先生／藤沢数希（後者2名は note 取り込み後に自動反映）。
- `.insight` で3者の共通解＋自分の保有とのギャップ。

## §6 トリガー＆アクション
- `.act`（dot＋本文）で具体的な発注/指値/条件を列挙。

## §7 来週の注目イベント
- `.ev`（日付＋内容、米国時間は `.us` 併記）。`.insight` で最大の波乱要因。`.note` で日付の注記。

---

## アプリ側クローム（参考・repo で管理済み／生成HTMLとは別）
クラウド生成は §1〜§7 の HTML だけを作る。下記はアプリの `src/briefing.js`＋CSS 側で確定済み（生成側は触らない）：
- 上部ツールバー：**号タイトル/日付ラベルは出さない**。白い背景バンドなし。生成ボタンは塗りでなく**ゴースト＋細線 SVG アイコン**（絵文字 💬 は使わない）。
- 最新号は iframe 表示、過去号は下にリンク一覧（`index.json` に蓄積されれば自動表示）。

## チェックリスト（生成後に自己点検）
- [ ] §1 に `.total` や金額/比率の行が**無い**
- [ ] スタンスが**ヘッダーではなく §1 先頭**にある
- [ ] 今週の地合いが**月〜金5列**・非営業日「休」・**S&P500＋日経**の2行以上
- [ ] ドル円・VIX が実数値表示（色＝騰落方向）
- [ ] §4 にウォッチリスト枠あり・見出しに絵文字なし
- [ ] セクション順/番号/nav が `トレンド…来週` で一致、`<h1>` なし、`.date` は日付のみ
- [ ] `index.json` に当号を追記（過去号を消さない）
