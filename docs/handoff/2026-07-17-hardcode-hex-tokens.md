# Handoff: src/ ハードコード hex カラーを CSS 変数へ（#574）

- **Issue**: #574 `refactor: src/ 以下のハードコード hex カラーが設計規約違反`
- **難易度**: medium（半日〜1日）／pure refactor
- **起票**: codex-review（自動）→ Opus triage → 本 handoff で設計確定
- **分担**: 設計＝Mulmo（本 doc）／実装＝VS Code

---

## 1. 背景・ゴール

CLAUDE.md 設計規約「色は必ず CSS 変数で指定、ハードコード hex は NG（`assets/*.css` の変数定義以外）」に反し、複数の JS で hex 直書きが残っている。ダーク/ライト切替やテーマ変更でトークンに追従できず、規約違反かつ将来の配色変更が困難。

**ゴール**: ライブ（`src/_disabled/` を除く）4ファイルの hex 直書きを、`assets/01-base.css` に定義する CSS 変数へ寄せ、JS からは既存ヘルパ `cssVar()` で読む。

**★これは純粋リファクタ**：全 hex 値を **verbatim（現状値そのまま）** でトークン化する。**見た目は 1px も変えない**。ダーク専用の最適化値は今回入れず、別 Issue に切り出す（§6）。

### 実装パターン（既に確立済み・踏襲するだけ）
- CSS変数をJSで読む: `import { cssVar } from './utils.js'` → `cssVar('--xxx')`（`color.js` 定義、`getComputedStyle(:root).getPropertyValue`）。`heatmap.js`/`chart.js` が既にこの方式。
- テーマ切替→再描画: `src/init.js:41` の `matchMedia('(prefers-color-scheme: dark)')` change で全再描画 → `cssVar()` を都度読めばライト/ダーク自動追従。
- トークン正本: `assets/01-base.css` の `:root`（ライト）＋ `[data-theme="dark"]`/dark ブロック。既存例: `--accent`/`--tone-good/ok/warn/neu`/`--pos`/`--neg`/`--chart-grid`/`--cat-bg`/`--text/text2/text3`。
- 今回の新規トークンは **`:root` にのみ定義**（現状が単一値のため。dark ブロックは未宣言トークンを `:root` から継承する）。

---

## 2. 対象ファイル一覧

| ファイル | 状態 | 内容 |
|---|---|---|
| `assets/01-base.css` | 変更 | 新規トークン定義を `:root` に追加 |
| `src/risk-charts.js` | 変更 | カテゴリ配色 `PALETTE`（12色）＋ `UNKNOWN_COLOR` |
| `src/wealth.js` | 変更 | 資産種別配色（10色）＋総資産ライン＋現金比率チャート |
| `src/chart.js` | 変更 | MA 3本の線色＋価格線（US式 緑/赤） |
| `src/color.js` | 変更 | セル文字色・サブ文字色（コントラスト ink） |
| `index.html` | 変更 | `?v=` を全 bump（CSS/JS/SW） |

**対象外（触らない）**: `src/_disabled/history.js`・`src/_disabled/ai-tab.js`（無効化済み・出荷されない）。Issue 本文が挙げた「プロキシ注記」の hex は `valuation-tab.js` に現存せず（既にトークン化済み）＝対応不要。

---

## 3. 追加する CSS 変数（`assets/01-base.css` の `:root`）

```css
:root {
  /* ── categorical シリーズ配色（Risk ドーナツ等・Claude ウォームトーン基調）──
     ※ risk-charts.js の既存 PALETTE を verbatim 移設 */
  --series-1:  #cc785c;
  --series-2:  #6a8caf;
  --series-3:  #c2a36b;
  --series-4:  #7fa885;
  --series-5:  #a878a8;
  --series-6:  #d09a4e;
  --series-7:  #5f9ea0;
  --series-8:  #bd6b6b;
  --series-9:  #8a9a5b;
  --series-10: #9d8df1;
  --series-11: #d4a0b8;
  --series-12: #7ba6c9;
  --series-unknown: #9ca3af;

  /* ── Wealth 資産種別配色（種別ごとに意味づけされた固定色・verbatim）── */
  --asset-equity:        #cc785c;  /* 株式(現物) */
  --asset-fund:          #7ba0c4;  /* 投資信託 */
  --asset-pension:       #9c8fbc;  /* 年金 */
  --asset-cash:          #6fae86;  /* 預金・現金 */
  --asset-insurance:     #d9a441;  /* 保険 */
  --asset-crypto:        #c98a5e;  /* 暗号資産 */
  --asset-bond:          #b0b0b0;  /* 債券 */
  --asset-fx:            #8c8c8c;  /* FX */
  --asset-equity-margin: #e09070;  /* 株式(信用) */
  --asset-points:        #c9c2b8;  /* ポイント */

  /* ── チャート線色 ── */
  --chart-ma-fast: #5ac8fa;  /* 5日MA */
  --chart-ma-mid:  #2e90d8;  /* 200日MA */
  --chart-ma-slow: #1a5fa0;  /* 50週MA */
  /* 価格線＝iPhone Stocks 式（期間始値比・US式 上=緑/下=赤）。
     ★日本式の --pos(赤)/--neg(緑) とは意味が逆なので流用禁止。専用トークンにする。 */
  --chart-price-up:   #30D158;
  --chart-price-down: #FF453A;
  /* Wealth 現金比率チャートの塗り/線（総資産ラインは --accent を流用） */
  --chart-cash: #6fae86;

  /* ── セル文字色（輝度で選ぶコントラスト ink・テーマ非依存＝:root のみ）── */
  --ink-on-light:   #1C1C1E;
  --ink-on-dark:    #FFFFFF;
  --ink-on-light-2: rgba(0,0,0,0.55);
  --ink-on-dark-2:  rgba(255,255,255,0.82);
}
```

> ダーク上書きは今回入れない。`--ink-on-*` は「セル背景の輝度」で選ばれるためアプリのテーマとは独立（両テーマ共通が正しい）。

---

## 4. 変更手順（ファイル単位）

### 4-1. `src/risk-charts.js`（L299-313）
- `const PALETTE = [ '#cc785c', … , '#7ba6c9' ];` を
  `const PALETTE = ['--series-1', …, '--series-12'].map(cssVar);` に置換。
  - または各参照箇所で `cssVar(PALETTE[i])` にする。**PALETTE を使う描画箇所を確認し、描画時に `cssVar()` 評価されるようにする**（モジュール読込時に一度だけ評価するとテーマ切替に追従しないので注意。`init.js` の再描画で `renderRiskCharts` が再実行される経路なら、関数内で `cssVar()` する形が安全）。
- `const UNKNOWN_COLOR = '#9ca3af';` → 参照箇所で `cssVar('--series-unknown')`。
- `cssVar` は `utils.js` から import 済みか確認（未 import なら追加）。

### 4-2. `src/wealth.js`（L19-28, 286, 370-371）
- 資産種別配列の `color: '#xxxxxx'` を、種別キーに対応する `cssVar('--asset-<key>')` に置換（`equity→--asset-equity`, `equityMargin→--asset-equity-margin` 等）。**描画時評価**にする。
- L286 総資産ライン `.attr('stroke', '#cc785c')` → `.attr('stroke', cssVar('--accent'))`（値同一）。
- L370-371 現金比率チャート `'#6fae86'` × 2 → `cssVar('--chart-cash')`。

### 4-3. `src/chart.js`（L37-39, 377）
- `_buildMAStyles` の `color: '#5ac8fa'/'#2e90d8'/'#1a5fa0'` → `cssVar('--chart-ma-fast')/('--chart-ma-mid')/('--chart-ma-slow')`。`_buildMAStyles` は描画関数内で呼ばれるため関数内評価でOK。
- L377 `const lineColor = (lastPrice >= fp) ? '#30D158' : '#FF453A';` → `cssVar('--chart-price-up') : cssVar('--chart-price-down')`。

### 4-4. `src/color.js`（L20, 24）
- `getCellTextColor`: `return _lum(c) > 0.35 ? '#1C1C1E' : '#FFFFFF';`
  → `return _lum(c) > 0.35 ? cssVar('--ink-on-light') : cssVar('--ink-on-dark');`
- `getCellTextColorSub`: `'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.82)'`
  → `cssVar('--ink-on-light-2') : cssVar('--ink-on-dark-2')`
- **`_lum()>0.35` の分岐ロジックは触らない**（返す値だけ変数化）。`cssVar` は同ファイル定義なのでそのまま使える。

### 4-5. `index.html`
- `?v=YYYYMMDDX` を CSS/JS/SW すべて揃えて bump。

---

## 5. 受け入れ条件（チェックリスト）
- [ ] 品質ゲート green：vitest / eslint / prettier / check:types / check:circular / e2e
- [ ] `src/`（`_disabled/` 除く）に、文字列リテラルの hex カラー（`'#RRGGBB'`）が **1件も残っていない**（`rg "['\"]#[0-9a-fA-F]{3,8}['\"]" src -g '*.js' -g '!_disabled/**'` が空）
- [ ] `index.html` の `?v=` を全 bump
- [ ] **見た目がライト/ダークとも従来と完全一致**（Heatmap 文字色・Risk ドーナツ・株価チャート MA/価格線・Wealth スタック/総資産線/現金比率が変化なし）
- [ ] テーマ切替（OS のダーク切替）後、各チャートが正しい色で再描画される（`cssVar` の描画時評価が効いている）
- [ ] `data-action` 委譲・escapeHTML・**色は CSS 変数のみ**・`!important` 禁止 を維持

## 6. 触ってはいけない範囲（load-bearing / 既存挙動）
- `getColor`（`fmt.js`）と Heatmap の濃淡ランプ／期間 `scale`（＝業務仕様・DO NOT TOUCH）。
- `getCellTextColor*` の **`_lum()>0.35` 輝度分岐ロジック**（返す色の literal だけ変数化）。
- `--pos`/`--neg`（日本式 赤/緑）の意味と値。**価格線を `--pos/--neg` に流用しない**（US式で逆）。
- `assets/*.css` に `prettier --write` を掛けない（巨大 diff 化）。format script は `src/**/*.js` のみ。
- `dist/app.js` は CI 自動ビルド＝手 commit 禁止。
- **全 hex 値は verbatim**。ダーク専用値の導入・配色最適化は本 Issue の対象外。必要なら別 Issue「チャート配色のダークモード最適化」に切り出す。
- `PALETTE` をモジュール top-level で `cssVar()` 一括評価して定数化しない（テーマ切替に追従しなくなる）。描画関数内で評価する。

## 7. ブランチ / PR / Issue
- ブランチ: `refactor/hardcode-hex-tokens`（base=`main`）
- PR: `refactor: ハードコード hex カラーを CSS 変数へ寄せる`
- `Closes #574`
