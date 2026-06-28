# 全タブ デザイン統一 — 実装指示書（handoff）

> 設計=Mulmo / 実装=VS Code（Claude Code）。本書は **見た目（プレゼンテーション層）だけ** を統一するための設計指示。
> **★最重要：業務仕様（ロジック・計算・load-bearing なデータ/関数）は一切変えない。** 触ってよいのは CSS の token / component と、HTML の class 付与だけ。
> 視覚リファレンス：`docs/handoff/assets/2026-06-26-design-system.html`（トークン＆部品カタログ）／`docs/handoff/assets/2026-06-26-tabs-unified.html`（5タブ通し・本物のタブバーで切替）。

---

## 0. 背景・ゴール・スコープ

- **背景**：5タブ（Heatmap / Historical / Risk / Value / Briefing）を通しで見ると、特に Risk/Value/Briefing で「見出し色・アイコン有無・カードタイトル位置・改行・色・フォントサイズ」のポリシーがバラバラ。原因＝グローバルなコンポーネント設計が無く、タブごとに各自 CSS を再発明していた。
- **ゴール**：色トークンは既に統一済み（良い）。その上に **(a) 型スケール (b) 余白スケール (c) 共通カード＋見出し (d) 共通チップ/ピル/バッジ/セグメント/表 (e) 意味色の一本化** を載せ、全タブを同じ部品で組めるようにする。
- **スコープ（このhandoffで触る）**：`assets/01-base.css` / `assets/02-tables.css`（＋必要なら 03/04）と、各タブを描画する JS が吐く **class名のみ**（`src/risk-charts.js` / `src/valuation-tab.js` / `src/stock-list.js` / `src/glossary.js` 等）。
- **スコープ外**：Briefing タブの本文 HTML（自己生成・iframe 配信）。Briefing の CSS は `assets/*.css` ではなく生成側にあり、**Mulmo が別経路（briefing spec / reference）で同じトークン値に追従させる**（§6）。VS Code は Briefing 生成物に触らない。

---

## 1. ★絶対に壊さない（DO NOT TOUCH）— 業務仕様 / load-bearing

実装中、以下は **値・名前・挙動を変更しない**。デザイン統一は見た目だけ。

1. **ヒートマップの色計算と期間スケール**：`utils.js` の `getColor(pct, mode, scale)` と `positions.js` の `PERIODS`／期間別 `scale`。**「同じ+5%でも期間で濃さが違う」のは意図的な業務仕様**（短期の+5%は爆騰、長期の+5%は横ばい→期間ごとに正規化しないと長期セルが全部飽和して読めない）。**getColor のロジック・スケール値・呼び出しは変更禁止**。色の停止色（ランプ）を CSS 変数に「写経」してもよいが、**getColor が出す実際の色と1pxも変えないこと**（§5）。
2. **load-bearing なデータフィールド名**：`mf-holdings.json` の `cat/cur/value/totals.imported/asOf`、`valuations.json` の `valuations[sym].{perCurrent,bandLow,bandHigh,percentile,status,sectorMedian…}`、watchlist KV スキーマ。**rename 禁止**。
3. **計算・状態・配線**：含み損益/集中度/ルックスルー地域%/PER%タイル/リスク寄与 等の**算出ロジック**、`state.*`（`heatSortCol/heatSortDir/heatSeg/statsMasked` 等）、`data-action` 委譲、ソート comparator（antisymmetric）、KV/Worker 通信、IndexedDB キャッシュ。**一切変更しない**。
4. **機能CSSの挙動**：sticky ヘッダ／sticky 左列（symbol）／z-index 階層／セグメント別の列非表示（`.sl-table.seg-held` 等）／PTR／モーダル。**挙動は保ったままトークンだけ差し替える**。
5. **ビルド/CI**：`dist/app.js` は手commitしない（CI自動）。**`assets/*.css` に `prettier --write` を掛けない**（format script は `src/**/*.js` のみ。CSS全体再整形は巨大diff化＝禁止）。`!important` 禁止・色はCSS変数のみ・セレクタ3段まで（既存規約踏襲）。
6. **テーマ**：ライト/ダーク（`html[data-theme]` ＋ `prefers-color-scheme`）を維持。新トークンも必ず両テーマで定義。

> 迷ったら止めて報告。**「見た目が変わるのはOK、数値・計算・色マッピングが変わるのはNG」** が判断基準。

---

## 2. デザイントークン（`:root` に追加。light/dark 両方）

既存の色トークン（`--bg/--surface*/--border*/--text*/--accent/--pos/--neg`）は**そのまま**。以下を追加する。

```css
:root{
  /* 意味色（良い/注意/警告/中立）— 全タブ共通。verdict/severity はこれを使う */
  --tone-good:#4f8a4d; --tone-ok:#b88a2e; --tone-warn:#c2603f; --tone-neu:#8a8178;
  /* 型スケール＝6サイズだけ（役割で固定。ad-hoc px を全廃） */
  --fs-hero:24px;  /* 資産hero・最大数値 */
  --fs-lg:18px;    /* 値・銘柄ティッカー・stat */
  --fs-md:15px;    /* カード見出し */
  --fs-base:13px;  /* 本文 */
  --fs-sm:11px;    /* ラベル・キャプション・表・ピル */
  --fs-xs:9.5px;   /* 脚注・出典・極小バッジ */
  /* ウェイトは 400/600/800 の3段に集約（500/700は段階的に寄せる） */
  /* 余白・角丸・影 */
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:20px; --sp-6:24px;
  --r-card:14px; --r-pill:999px; --r-chip:8px;
  --shadow-card:0 2px 10px rgba(0,0,0,.04);
}
html[data-theme="dark"]{
  --tone-good:#7aa978; --tone-ok:#d8b25a; --tone-warn:#dd7a55; --tone-neu:#a99e92;
}
```

- **意味色の一本化**：現状 Risk は `--vg-*` と `--down/--warn/--neg` を混用、Value は `--vg-*`。→ **`--tone-*` に一本化**。`--vg-good/ok/warn/neu` が既にある場合は **`--tone-*` を正とし `--vg-*` は `--tone-*` を指すエイリアスに**（既存参照を壊さない）。`--pos`(赤=上)/`--neg`(緑=下) は**価格方向専用**として残し、verdict/severity には使わない。
- **テキスト色は3つだけ運用**：`--text`(本文)/`--text2`(補助)/`--text3`(脚注)。新規にテキスト色を増やさない。

---

## 3. 共通コンポーネント（目標CSS）

各タブはこの部品だけで組む。**新規 class を作り、既存の一品物 class を段階的にこれへ寄せる**（§4 マッピング）。

### 3.1 カード `.card` ＋ 見出し `.card-ttl`（★最重要の統一点）
```css
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-card);
  padding:var(--sp-4);margin-bottom:10px;box-shadow:var(--shadow-card);}
.card-ttl{display:flex;align-items:center;gap:9px;font-size:var(--fs-md);font-weight:800;
  margin:0 0 13px;padding-bottom:11px;border-bottom:1px solid var(--border);}
.card-ttl .tic{width:28px;height:28px;border-radius:8px;background:var(--surface2);
  display:flex;align-items:center;justify-content:center;color:var(--accent);flex:none;}
.card-ttl .tag{margin-left:auto;font-size:var(--fs-xs);font-weight:600;color:var(--text3);
  background:var(--surface2);border-radius:var(--r-pill);padding:3px 10px;}
```
- 見出しは **アイコン箱(28px)＋名前(15/800)＋右に任意タグ** を全タブ共通に。番号バッジは使わない。
- アイコンは自前 SVG スプライト（`<symbol>`＋`<use>`、`.ic{stroke-width:1.7;...}`）。**既存の `.ric`(Risk) と Briefing の `.ic`/`.tic` を `.ic`/`.card-ttl .tic` に統一**。

### 3.2 アイコン基底
```css
.ic{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;
  stroke-linecap:round;stroke-linejoin:round;flex:none;}
.ic-sm{width:14px;height:14px;}
```
推奨アイコン割当：Heatmap=grid / Historical=history / Risk=shield / Value=gauge / Briefing 各カード=list(サマリ)・pulse(トレンド)・globe(マクロ)・users(メンター)。

### 3.3 ピル / チップ / バッジ
```css
.pill{display:inline-flex;align-items:center;gap:4px;font-size:var(--fs-xs);font-weight:700;border-radius:var(--r-pill);padding:2px 9px;}
.pill.good{background:color-mix(in srgb,var(--tone-good) 15%,transparent);color:var(--tone-good);}
.pill.ok  {background:color-mix(in srgb,var(--tone-ok)   15%,transparent);color:var(--tone-ok);}
.pill.warn{background:color-mix(in srgb,var(--tone-warn) 15%,transparent);color:var(--tone-warn);}
.pill.neu {background:var(--surface2);color:var(--text2);}
.pill.up  {background:color-mix(in srgb,var(--pos) 15%,transparent);color:var(--pos);}
.pill.down{background:color-mix(in srgb,var(--neg) 15%,transparent);color:var(--neg);}
.chip{display:inline-flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--r-chip);padding:4px 9px;font-size:var(--fs-sm);}
.badge{display:inline-flex;align-items:center;gap:3px;font-size:var(--fs-xs);font-weight:700;border-radius:var(--r-pill);padding:2px 8px;}
.badge.good/.ok/.warn{ background:color-mix(... 16% ...); color:var(--tone-*); }
```
- Risk `.rpill`／Value `.vc-*`/`.vg-badge`／各 `.htag` は意味的に同じ → 上記へ寄せる（color-mix の割合は 15〜16% に統一）。

### 3.4 セグメント（lens / 表示切替）
```css
.seg{display:inline-flex;gap:4px;flex-wrap:wrap;}
.seg button{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-pill);
  color:var(--text2);font-size:var(--fs-sm);font-weight:600;padding:5px 13px;cursor:pointer;}
.seg button.on{background:var(--accent);border-color:var(--accent);color:#fff;}
```
- Value の `.val-lens/.val-seg` と Historical の `.heat-seg/.heat-seg-pill` を `.seg` に統一（**状態管理 state は変えず class だけ寄せる**）。

### 3.5 表 `table.t`
```css
table.t th{font-size:var(--fs-xs);color:var(--text2);font-weight:700;...border-bottom:1px solid var(--border);}
table.t td{font-size:var(--fs-sm);font-weight:700;...border-bottom:1px solid var(--border2);}
```
- `.sl-table`/`.wl-table` は **sticky・列固定・列非表示の挙動を保ったまま**、フォントサイズ等を上記トークンへ。z-index は現状の階層を壊さない範囲で統一（`.sl-table th` と `.wl-table thead th` の z 値ズレだけ揃える）。

---

## 4. 既存クラスの移行マッピング（class を寄せるだけ・挙動不変）

| 既存 | 寄せ先 | 備考 |
|---|---|---|
| `.risk-card` / `.risk-overview` / `.risk-quant`（radius 12px, pad 14-16） | `.card`（radius 14, pad 16） | 見た目微変はOK |
| `.risk-card-title` ＋ `.ric` ＋ `.rtag` | `.card-ttl` ＋ `.tic`(icon) ＋ `.tag` | アイコン箱化 |
| `.val-row`（radius 13） ＋ `.val-head`（アイコン無し） | `.card` ＋ `.card-ttl`（**Valueにもアイコン追加**） | 銘柄ティッカーは `.card-ttl` 内 or 直下に `--fs-lg` |
| `.rpill` / `.vc-*`(verdict) / `.vg-badge` / `.htag` | `.pill` / `.chip` / `.badge` | 意味色は `--tone-*` |
| `.val-lens/.val-seg` / `.heat-seg/.heat-seg-pill` | `.seg` | state不変 |
| 各所の ad-hoc font-size(px) | `--fs-*` 6種へ | 役割で割当 |
| `--vg-*` 参照 | `--tone-*`（vg は alias 化） | 既存参照を壊さない |

> **値が大きく動くカードタイトル（Value 銘柄22px → 18px 等）は見た目が変わるが、ユーザー了承済み**。

---

## 5. Heatmap / Historical の配色（ランプ=デザイン / スケール=業務仕様）

- **デザインが持つ**：カラーランプ（5段グラデ停止色＝濃緑↔薄緑↔白↔薄赤↔濃赤、light/dark）＋タイル形（`.tl{border-radius:4px;...}`）＋「背景に対する文字色コントラスト」規則（`getCellTextColor` 既存）。**Historical の % セルは Heatmap と同じランプのタイルにする**（背景濃淡＝騰落の大きさ）。凡例バー（`.legend-bar` の gradient）も同じ停止色。
- **業務仕様が持つ（DO NOT TOUCH）**：期間ごとの正規化 `scale`（何%で振り切るか）と `getColor(pct,'change',scale)`。**1日の+5%と3年の+5%で濃さが違うのは意図的・正しい。getColor・scale は変更しない。**
- 実装上の注意：ランプ停止色を CSS 変数（例 `--heat-1..--heat-5`）に集約してもよいが、**`getColor` が現状出している色と完全一致させること**（リファクタで色がズレたら業務仕様の破壊とみなす）。`.legend-bar` の gradient と Historical タイルの配色は同一ソースを参照する形が理想。

---

## 6. Briefing の扱い（別経路・VS Codeは触らない）

- Briefing 本文 HTML は Mulmo の `briefing` スキルが自己生成し iframe 配信。CSS は `assets/*.css` に**無い**。
- 本デザインシステムの**トークン値（色・型6サイズ・card-ttl）と完全一致**させる責任は Mulmo 側（`docs/briefing-generation-spec.md` ＋ reference HTML）。VS Code は Briefing 生成物・spec に触らない。
- ＝ 4つのアプリタブ（Heatmap/Historical/Risk/Value）を `assets/*.css` で統一すれば、Briefing は別途 Mulmo が同じ値で追従し、結果 5タブが揃う。

---

## 7. 段階ロールアウト（1フェーズ = 1 PR = 1 Issue）

手戻りと巨大diffを避けるため、**フェーズ分割**。各フェーズは品質ゲート green を確認してマージ。

- **P1 トークン導入（非破壊）**：§2 のトークンを `:root`/dark に追加。`--vg-*` を `--tone-*` の alias 化。**この時点で見た目は原則不変**（既存 px を即置換しない）。受け入れ＝全タブ目視で回帰なし。 ✅**実装完了（PR#517 / Issue#515・2026-06-27）**＝§2 のデザイントークン（意味色 `--tone-*`・型6サイズ・余白/角丸/影）を `:root`＋dark に導入、非破壊。`assets/01-base.css`／`index.html` 改修。※umbrella Issue#515（段階ロールアウト P1-P5）は本PRで close 済＝P2-P5 は別Issue起票で継続の見込み（要確認はpm-queue参照）。
- **P2 カード＋見出し統一**：§3.1/3.2。Risk/Value のカードタイトルを `.card-ttl`（アイコン箱）へ。Value にアイコン追加。
- **P3 ピル/チップ/バッジ/セグメント統一**：§3.3/3.4。意味色を `--tone-*` に。
- **P4 表＋Heatmap/Historical 配色**：§3.5/§5。Historical の % セルを Heatmap ランプのタイルへ（getColor 出力をタイル背景に）。**getColor/scale 不変**。
- **P5 型スケール適用**：ad-hoc font-size を `--fs-*` 6種へタブ単位で置換。最後に未使用 px を掃除。

各 PR：`index.html` の `?v=` を全 bump（CSS/JS/SW 揃える）。`dist/app.js` は手commitしない。

---

## 8. 受け入れ条件・品質ゲート・触ってはいけない範囲

**受け入れ条件（チェックリスト）**
- [ ] 5タブを通しで見て、見出し（アイコン箱＋名前）・色・フォント・カード・余白が揃っている（リファレンス `tabs-unified` と整合）。
- [ ] フォントサイズは `--fs-*` 6種のみ／テキスト色は `--text/2/3` の3種のみ。
- [ ] 意味色は `--tone-*`、価格方向のみ `--pos/--neg`。
- [ ] **Heatmap/Historical の色が getColor 出力と一致（期間スケール挙動が回帰していない）**。
- [ ] ライト/ダーク両方で破綻なし・コントラスト4.5:1以上。
- [ ] 品質ゲート green：`vitest` / `eslint` / `prettier`(src のみ) / `check:types` / `check:circular` / `e2e`。
- [ ] `index.html` の `?v=` 全bump。

**触ってはいけない範囲**（再掲・§1）：getColor/scale・load-bearingフィールド名・計算/state/data-action/ソート/KV/Worker・機能CSSの挙動・`assets/*.css` への prettier・`dist/app.js` 手commit・`!important`。

**要確認（勝手にやらない）**：force push/reset --hard/main削除/Secrets/CLAUDE.md/.claude/ワークフロー大改修。

---

## 9. 視覚リファレンス
- トークン＆部品カタログ：`docs/handoff/assets/2026-06-26-design-system.html`
- 5タブ通し（タブバーで切替・Historicalはヒートマップ配色タイル）：`docs/handoff/assets/2026-06-26-tabs-unified.html`

— 設計：MulmoClaude（2026-06-26）。実装は本書のフェーズ順で。設計変更が要るときは口頭パッチせず Mulmo に戻して本書を更新→新版を渡す。
