# Handoff: Wealth ネットワースのデータモデル再定義（パイプライン＋計算）

- **難易度**: hard（パイプライン＋load-bearing な計算の再定義）
- **分担**: 設計＝Mulmo（本 doc＋spec）／実装＝VS Code
- **正本**: `docs/wealth-networth-spec.md`（数値定義の唯一の正本・ユーザー確定済 2026-07-21）
- **★見た目（表示レイアウト）は本 handoff の対象外**。数値ロジックとデータ供給のみ。表示は別 handoff で後日。

## 実装ログ（VS Code が更新 / クローズは Mulmo）
- ステータス: dispatched
- [ ] P1 着手 / branch: `feat/mf-realestate-other-capture`
- [ ] P2 着手 / branch: `feat/networth-model-v6`
- [ ] Mac で fetch 実機確認（不動産・その他が取れるか）
- [ ] （Mulmo）完了確認

---

## 背景
Wealth の「総資産／運用資産／純資産」の**器（定義）が未整理**だった。ユーザーと壁打ちで数値モデルを確定（spec 参照）。要点：
- **総資産 = MF総資産（mfNetWorth）そのまま**（不動産もMF評価込み）。
- **運用資産 = 金融（現金−¥20M生活資金 ＋ 株/信用/投信/債券/FX/暗号/保険/年金）**。ポイント・その他・不動産は除外。
- **純資産 = MF総資産 −（不動産MF評価 − 現実不動産haircut）− 負債**。

## 現況（config/データを実査した結論）
不足は実質 **(a) 不動産(MF評価) (b) その他** の捕捉だけ。他は既存で揃う：
- `totals.mfNetWorth`（総資産）✅ / `totals.realAssetsTotal`（現実不動産・haircut）✅ / `totals.liabilitiesTotal`（負債）✅
- 年金・保険のカテゴリ値は `mf-history.json` の pension/insurance 列 ✅（保有スクレイプは除外だがBS内訳にあり）
- 不動産(MF)＝config `realEstate` ブロック（#580・**実機未確認**）。その他＝現状カテゴリ除外。

## P1：パイプライン（不動産MF評価・その他の捕捉）
対象：`scripts/fetch_mf.py`（`realEstate` ブロック）／`scripts/fetch_mf_history.py`（BSカテゴリ列）／`data/mf-import-config.json`。
1. **不動産(MF評価)を捕捉**：config `realEstate`（`/bs/portfolio` の不動産テーブル）を**実機で確認**し、MFの不動産合計（できれば物件別）を取得。`mf-holdings.json` の `totals` に **`realEstateMf`（number・MF不動産評価合計）** を追加出力（新規・任意フィールド＝取れた時のみ）。
2. **その他を捕捉**：`mf-history.json` のカテゴリ列に **`realEstate` と `other`** を追加（MFのBS CSVに存在するが現状ドロップしている）。列ズレは `columns` を実機に合わせる。
3. `mf-import-config.json` の該当 note/セレクタを実機に合わせて更新（コード変更でなく config で吸収する方針を維持）。
4. **チェックサム不変**：`imported == Σ(holdings.value)` は従来どおり（保有取込に不動産は入れない＝実物レイヤーは別）。realEstateMf は totals の付加情報。
- ★Mac でしか実機テストできない（MFログイン）。Windows で編集→push→Mac で `python3 scripts/fetch_mf.py run`（or 次バッチ）で確認。

## P2：計算（networth.js を spec の派生式へ）
対象：`src/networth.js`（`getMfTotals` 等）。
1. **総資産** = `mfNetWorth`（既存・そのまま）。
2. **運用資産** = 新定義。金融カテゴリ（現金・株・信用・投信・債券・FX・暗号・保険・年金）の合計 − 生活資金¥20M。
   - 年金・保険は holdings に無いので **mf-history の最新カテゴリ値**（pension/insurance）を足す必要がある（データ源を networth.js が読めるよう配線）。
   - ポイント・その他・不動産は除外。
3. **不動産補正** = `realEstateMf − realAssetsTotal`（realEstateMf 未取得時は 0＝補正なしで degrade）。
4. **純資産** = `mfNetWorth − 不動産補正 − liabilitiesTotal`。
   - ★旧 `netWorthComputed = imported + realAssetsTotal − liabilitiesTotal` は**廃止し本式に置換**。load-bearing なので消費側（wealth.js の netWorthCardHTML 等）と**同一 PR で**揃える。
5. 生活防衛資金 `EMERGENCY_FUND`（既存¥20M定数）を再利用。キャッシュ比率の定義は現行維持（別物）。

## 受け入れ条件
- [ ] `総資産 == mfNetWorth`（MFそのまま）。
- [ ] `運用資産 == 金融合計 − ¥20M`（年金・保険・暗号込み／ポイント・その他・不動産除く）。
- [ ] `純資産 == mfNetWorth − (不動産MF − 現実不動産) − 負債`。realEstateMf 未取得時は不動産補正0で計算継続（degrade・エラーにしない）。
- [ ] 既存の資産推移グラフ・キャッシュ比率・Risk/Value等の**運用アロケーション分母は不変**（実物・負債は文脈のみ・#577 §B 厳守）。
- [ ] 品質ゲート green（vitest 等）。数値検証テストを1本追加（合成データで派生式を assert）。

## 触ってはいけない範囲
- 運用アロケーション（Risk Exposure / Heatmap 等）の分母に**実物・負債・不動産を混ぜない**（#577 §B・load-bearing）。
- `imported`（Σ holdings）の意味と、保有取込に不動産を入れない方針。
- チェックサム照合（`imported == Σ holdings`）。
- 表示レイアウト（本 handoff は数値のみ・見た目は別 handoff）。

## ブランチ / PR / Issue
- P1: `feat/mf-realestate-other-capture` / P2: `feat/networth-model-v6`（P1 マージ後 or 並行）
- PR は **`Refs`**（クローズは Mulmo 完了確認後）。Issue は本 handoff を指す。
