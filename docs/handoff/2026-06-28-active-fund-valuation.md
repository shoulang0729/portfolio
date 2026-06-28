# アクティブ投信のバリュエーション（ひふみ等）— 月次上位10加重PERで本体評価

> 設計=Mulmo。データパイプライン（取り込み＋計算）は **Mulmo 所有のスケジューラ**（workspace `data/scheduler/`）で実装し `valuations.json` に書き戻す。**Value タブの表示（消費側）だけ VS Code が実装**（Issue化）。

## 0. 問題
- ひふみ等のアクティブ投信は `isProxy:true` で**プロキシ指数ETFのPER**を表示している（ひふみ投信/MS→2516.T グロース250、XO→ACWI）。
- これは不適切：ひふみは大型寄りのアクティブで、グロース250（東証グロース小型成長）とは中身が別物。「割安16%タイル」はグロース250が叩かれてるだけで**ひふみ本体の割安さではない**。
- 当面の誤読防止＝proxyラベル明記（Issue #529）。**本命＝ファンド本体の数値で評価**。

## 1. データ事実（調査済み 2026-06-28）
- ひふみ月次レポート（rheos）＝**組入上位10銘柄（銘柄名・コード・業種・組入比率）**＋資産構成（株式%）を開示。[ソース](https://hifumi.rheos.jp/fund/toushin/latest_report/)
- **ポートフォリオの集計PER/PBRは非開示**（本家・ウエルスアドバイザーとも）。全銘柄開示は決算時の運用報告書（年1〜2回）のみ。
- → 「毎月1数字読むだけ」は不可。**現実解＝月次の上位10（コード＋比率が開示済み）から加重PERを計算**（実際の主力銘柄ベース＝指数プロキシより断然マシ。ただしカバー率＝上位10≒NAVの約3割）。

## 2. スキーマ（valuations.json に**追加のみ**・既存 load-bearing 不変）
ファンドは**プロキシETFのキーでなく、ファンド自身のキー**で持つ（`funds.js` の `symbol`：`ひふみ投信`/`ひふみMS`/`ひふみXO`）。
```jsonc
"valuations": {
  "ひふみ投信": {
    "perCurrent": 18.2,            // 上位10加重PER（Σ(per_i×w_i)/Σw_i）
    "coverage": 0.31,             // 上位10の組入比率合計（NAV比）
    "source": "fund-monthly-top10",
    "asOf": "2026-06",            // 月次レポートの基準月
    "components": [{"code":"7203.T","name":"トヨタ","w":0.045,"per":11.8}, /* …top10 */],
    // 任意：バンドがあれば%タイル/判定。無ければ verdict は出さない（粗い部分PERに強い断定をしない）
    "bandLow": null, "bandHigh": null, "percentile": null, "status": "na"
  }
}
```
- 既存の `perCurrent/bandLow/bandHigh/percentile/status/sectorMedian` 等のフィールド名は**不変**。`coverage/source/asOf/components` を追加。
- プロキシETF（2516.T/ACWI）の既存エントリは**そのまま残す**（実ETFとしても使う）。

## 3. パイプライン（Mulmo 実装・workspace `data/scheduler/`）
- **入力（月次・半手動）**：`data/scheduler/fund-holdings.json`
  ```jsonc
  [{ "fund":"ひふみ投信", "fundSymbol":"ひふみ投信", "asOf":"2026-06",
     "top":[{"code":"7203.T","name":"トヨタ","weight":0.045}, /* …上位10 */] }]
  ```
  月次レポートPDFの上位10（コード＋比率）を取り込む。**月次ingest**（PDF入手→上位10をパース/OCR→このファイル更新）。note/MF 取り込みと同型の半自動。コードは Yahoo 形式（東証は `7203.T`、米株はそのまま）。
- **計算**：`data/scheduler/fund-per.mjs --write`
  - 各 `code` の **Yahoo 実績PER（trailingPE）** を `/yahoo` プロキシで取得（`watchlist-per.mjs` と同方式・レート制限なし）。
  - `perCurrent = Σ(per_i × weight_i) / Σ(weight_i)`（PER取得不可の銘柄は分母からも除外し coverage に反映）。`coverage = Σ(取れた weight_i)`。
  - `valuations[fundSymbol]` を `github/portfolio/data/valuations.json` に**追加で**書き戻す（source/asOf/components/coverage 付き）。
  - **PERは価格で日々動く**ので**日次再計算OK**（保有リストは月次更新・PERは毎日。日次バッチ③Aの watchlist-per の隣で実行が自然）。
- **スケジュール**：日次バッチに `fund-per.mjs` を追加（保有リストが無い月初までは前月リスト流用）。月次 ingest は別タスク or 手動。

## 4. Value タブ（消費側・VS Code 実装＝別Issue）
ファンド保有のバリュエーション選択の**優先順位**：
1. `valuations[fundSymbol]` に `source:"fund-monthly-top10"` があれば**それを使う**。ラベル「**月次上位10ベース（カバー率NN%・YYYY-MM）**」。`coverage<0.5` なので**強い割安/割高の断定はしない**（PER数値＋カバー率を出し、verdict は控えめ or 非表示）。
2. 無ければ従来の**プロキシETF**（ラベル「proxy: グロース250 / ACWI」＝Issue #529）。
3. それも無ければ「参考・PER対象外」。
- ティッカー/銘柄名表示はファンド名（`canonicalName`）。

## 5. ★壊さない
- valuations の既存フィールド名・watchlist-per・getColor/scale・state・KV は不変。**追加キー/追加フィールドのみ**。
- ファンドの proxy マッピング（funds.js）は残す（フォールバックに使う）。
- `assets/*.css` prettier 禁止・`dist` 手commit禁止。

## 6. フェーズ
- **P1（完了）**：proxyラベル明記（#529・VS Code）。
- **P2（Mulmo）**：`fund-holdings.json` スキーマ確定＋初回 ingest（ひふみ3本の今月上位10）＋`fund-per.mjs` 実装＋日次バッチ組込み＝`valuations[ひふみ*]` を生成。
- **P3（VS Code・別Issue）**：Value タブが §4 の優先順位で fund-monthly を消費＋ラベル。
- 将来：カバレッジ向上（決算期は全銘柄で真の加重PER）/ 他アクティブ投信へ展開。

— 設計：MulmoClaude（2026-06-28）。
