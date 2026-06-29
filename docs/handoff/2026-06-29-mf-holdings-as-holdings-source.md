# handoff: mf-holdings.json を保有の単一ソースにしてヒートマップ自動反映

- 起票: 2026-06-29 / Mulmo（投資コンサルmode・設計レーン）
- 対応 Issue: **#534**（SpaceX 手動追加 → 本設計に supersede）
- 実装: VS Code / **load-bearing 大改修につき Toshio 事前レビュー**
- ブランチ: `feat/mf-holdings-as-source` / PR は `Closes #534`

---

## 1. 背景 / ゴール
新規保有（SpaceX/NLR/今後の買い）のたびに `positions.json` へ手で足さないとヒートマップに出ない。この一周手作業をなくし、**MoneyForward が拾った保有を自動でヒートマップ（および Value / Risk）に反映**する。

**現状の配線（重要）**:
- 総資産（ステータスバー）＝ `src/networth.js` が **すでに `mf-holdings.json` を読んでいる**（totals.imported / cat 別集計）。
- 一方、**ヒートマップ/銘柄タイルは今も `positions.json`（KV・手動メンテ）を読む**。
- → 配線が「総資産＝mf / タイル＝positions」と割れている。`mf-holdings.json` は証券24銘柄すべてが `ySymbol`＋`avgCost`＋`price` を**完備**しており（NLR・SPCX 含む）、必要データは揃っている。**残りはタイル側を mf に繋ぐだけ。**

**ゴール**: 保有タイルを `mf-holdings.json` 由来に切り替え、新規保有が手作業ゼロで出る状態にする。

## 2. 対象ファイル（新規/変更）
- 【新規】`src/holdings-from-mf.js` … `buildPositionsFromMf(mf, fundDefs)` を提供。mf-holdings の証券行を**ヒートマップが期待する positions 形**（`symbol/name/cat/shares/price/avgCost/value/cur/ySymbol/isProxy`）に変換。
- 【変更】`src/render.js`（または保有配列の供給元）… positions.json 直読みを `buildPositionsFromMf()` の結果に差し替え。**`positions.json`/KV は取得失敗時のフォールバックとして残す**。
- 【変更】`src/funds.js` … 投信 proxy マップ（`FUND_DEFS`）を mf の `投資信託` 行に当てるための name→proxy 参照を export（既存ロジック流用）。
- 【参照のみ・変更不可】`src/networth.js` … 総資産はここが正。タイル側を mf に寄せることで**二重計上の解消**を確認（下記受け入れ条件）。

## 3. 変換ルール（buildPositionsFromMf の仕様）
1. **証券フィルタ**: `cat ∈ {米国株・ETF, 日本株・ETF, 投資信託}` のみ採用。`現金・預金` / `暗号資産` は**タイルに出さない**（総資産には networth.js 経由で算入済み）。
2. **投信の proxy**: `cat==投資信託`（ひふみ×3・オルカン）は mf に `ySymbol` 無し → `funds.js` の `FUND_DEFS` を**名前一致**で当て、`ySymbol`=proxy（例 ひふみ→`2516.T`、オルカン→`ACWI`）＋`isProxy:true`、表示名・通貨は mf の元名を使う。
3. **シンボル正規化**: mf 表記の揺れを吸収する小さな**オーバーライド表** `MF_SYMBOL_OVERRIDES`（例: `200A`→`200A.T`）。日本株 ETF で `.T` 欠落かつ数値/英数字コードのものは `.T` 付与。
4. **SPCX（SpaceX）**: ライブ価格で `SPCX` が**本当に SpaceX を指すか検証**（SPAC 系 ETF とティッカー衝突の懸念）。
   - 引ける → 通常銘柄。
   - 引けない/別物 → `isProxy` 扱いで mf の `price`（¥24,757）を初期値に手動価格フォールバック。**価格が 0 / 「…」で固定化しないこと。**
5. **shares 補完**: mf 証券は `shares` を持たない → `shares = round(value / price)`（heatmap の主用途は value=サイズと ySymbol=騰落取得なので近似で可）。
6. **同一シンボルの統合**: mf に同名2行があり得る（例「ひふみ投信」は**重複でなく正しい2保有**＝統合してよいのは表示タイルのみ。`value`/`shares` を合算して1タイル化。**集計値は2行とも算入**＝networth 側は触らない）。

## 4. 受け入れ条件（チェックリスト）
- [ ] SpaceX(SPCX)・NLR がヒートマップに自動表示される（手で positions に足さずに）。
- [ ] 投信（ひふみ×3・オルカン）が proxy 経由で従来どおり価格・騰落で表示される。
- [ ] 現金・暗号資産はタイルに出ない。
- [ ] **総資産の二重計上が起きない**：ステータスバー（networth.js の imported/netWorth/cashRatio）が改修前後で一致（mf が単一ソース化されることでむしろ整合）。
- [ ] ライブ価格取得不能銘柄が 0 / 「…」で固定化せず、proxy/手動でフォールバックする。
- [ ] load-bearing フィールド名（`cat`/`cur`/`value`/`totals.imported`/`asOf`）の変更なし。
- [ ] `mf-holdings.json` 取得失敗時は従来 positions.json へフォールバックして動作。
- [ ] 品質ゲート green（vitest/eslint/prettier/check:types/check:circular/e2e）、`index.html` の `?v=` 全 bump。

## 5. 触ってはいけない範囲
- `mf-holdings.json` のスキーマ（Mac mini パイプラインの出力・load-bearing）。
- `src/networth.js` の集計ロジック（総資産の正）。**読むだけ**。
- ひふみ投信2行を「重複」とみなして集計から消すこと（集計は2行とも正）。
- `assets/*.css` への `prettier --write`（巨大 diff 化）。`dist/app.js` の手 commit（CI 自動ビルド）。

## 6. 未確定の設計判断（VS Code 側で決めて良い・迷えば Issue にコメントで相談）
- 変換を **フロント読み込み時**に行うか、**取り込み時のビルドステップ**で `positions.json` を生成するか。→ 推奨は前者（フロントで `buildPositionsFromMf`、positions.json はフォールバック）。実装容易性で選んでよい。
- KV ベースの旧 positions 手動メンテ経路を**残すか撤去するか**。当面は**残す（フォールバック）**を推奨、撤去は別 Issue。

---
🤖 設計: Mulmo。実装・git・テストは VS Code。Mulmo はコードを書かずマージ後にモニタ＋完了スタンプのみ。
