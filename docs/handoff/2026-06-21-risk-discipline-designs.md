# 設計スプリント（2026-06-21）: D-1 / D-5 / D-4 / D-6

> 設計=Mulmo。実装はこの doc を正本に VS Code が Issue 単位で着手（チャネル原則 §`mulmo-vscode-workflow.md`）。
> Wiki 正本「投資システム アップグレード計画」の残設計課題 D-1/D-4/D-5/D-6 を1本にまとめた設計集。確定したものから §を埋める。

---

## D-1 ストレスシナリオ（名前付き歴史イベント）

### 確定（2026-06-21・ユーザー）
- **①方式＝A 履歴 replay**：実保有 × 実履歴を、イベントの日付レンジで切って累積。既存エンジン（`alignReturnsByDate`＋`computePortfolioReturns`）流用・捏造ゼロ・手動メンテ無。古い大暴落（ベクトル方式）は次フェーズ。
- **②履歴の深さ＝4y（推奨・2-3yから補正）**：2024-08 円キャリー巻き戻し / 2025-01 DeepSeek / 2025 関税ショックに加え、2022弱気相場の尾・2023-03 SVB まで拾うには ~4y 必要（2-3y では届かない）。※recent中心で十分なら 3y。
- **③保有基準＝現ウェイト × 過去リターン**＝「今の PF が当時を再体験したら」。時間軸の保有変化は**意図的に無視**（実損益ではなく what-if）。欠損銘柄（イベント期間に価格無し＝後発IPO等）は**除外＆再正規化**し、**カバレッジ%を明示**。UIラベルは「現PFが当時を再体験したら」と明記し実損益と誤読させない。

### 仕様
- **イベントカタログ＝`data/stress-events.json`**（小さく curated）。各エントリ：
  ```json
  { "id": "yen-carry-2024", "label": "円キャリー巻き戻し", "from": "2024-07-31", "to": "2024-08-05", "note": "日銀利上げ→急速な円高・株安" }
  ```
  初期セット（4y内・peak→trough レンジは実装時に日次で微調整可）：
  - `tariff-2025` 関税ショック（2025-04 近辺）
  - `deepseek-2025` DeepSeek 半導体急落（2025-01-24〜27）
  - `yen-carry-2024` 円キャリー巻き戻し（2024-08-01〜05）
  - `svb-2023` SVB 破綻・地銀不安（2023-03-08〜13）※4y採用時のみ
  - `bear-2022` 2022 利上げ弱気（2022 のピーク→トラフ局面）※4y採用時のみ・カバレッジ低下に注意
- **算出＝`risk-calc.js` に純関数 `eventStress(seriesMap, weights, fromDate, toDate)`**：
  - `alignReturnsByDate(seriesMap)` で日付付きリターン取得 → `from`〜`to` の窓を抽出。
  - 窓内に価格がある銘柄のみで `computePortfolioReturns`（weights 自動正規化）→ 期間累積リターン（compound−1）を返す。
  - 返り値：`{ ret, coveragePct, missing: string[], usableFrom, usableTo }`。coveragePct＝(窓内データ有りウェイト合計 / 全ウェイト)。
- **データ源**：履歴キャッシュを 4y に拡張（Yahoo chart `range=5y` 取得は既存 `fetchSymbolHistory` 対応済）。`getAllHistorical` の depth を引き上げ。重い場合はストレス計算用に別キャッシュも可。
- **表示（Risk タブ・クオンツカードの下）**：イベント名｜PF期間下落%｜カバレッジ%（<90% は注意表示）。降順（下落大きい順）。「現PFが当時を再体験したら」の注記＋用語解説フッターに1行追加。

### 受け入れ基準
- [ ] `data/stress-events.json` のイベントごとに PF 期間下落%が出る（実履歴 replay・現ウェイト）。
- [ ] 窓内に価格が無い保有は除外・再正規化され、coveragePct が表示される。
- [ ] 履歴深さ拡張で既存の `1y` 系カード（ボラ/相関/最悪窓）が壊れない（後方互換）。
- [ ] `eventStress` に単体テスト（既知系列で累積値・カバレッジ検算）。
- [ ] computeVerdict 等 他ロジック無改変。

### スコープ外（次フェーズ）
- 仮想ショックベクトル方式（2008/2020 級を履歴無しで再現）。
- イベント別の銘柄寄与分解（どの保有が効いたか）。

---

## D-5 リバースDCF・目標株価乖離（A6）

### 確定（2026-06-21・推奨ロック）
- **①リバースDCF＝実装する・1段(Gordon)**。`impliedGrowth = (wacc − fcfYield) / (1 + fcfYield)`。入力は**既存の `value.fcfYield` ＋ WACC（米8%/日6%・確定済）だけ**＝外部データ追加ゼロ。対象は fcfYield を持つ**個別株のみ**（ETF/シクリカルは除外＝quality と同じ）。
  - verdict ドライバ「**期待過多**」：impliedGrowth が妥当域（例: 名目GDP+α、または過去FCF成長/アナリスト成長）を超えたらフラグ。
  - 注：1段Gordon は粗い近似。表示は「市場が織り込む長期FCF成長率 ~X%」＋低確度の注記付き。2段DCF精緻化は次フェーズ。
- **②targetGapPct＝Yahoo `financialData.targetMeanPrice` を試す（#427 で可用性確認中）**。取れれば全銘柄自動 `targetGapPct=(targetMean−price)/price`。取れなければ主要銘柄の手動 seed 継続（現 MSFT/AAPL 方式）。

### 仕様
- 純関数 `impliedGrowth(fcfYield, wacc)`（`src/reverse-dcf.js` or `src/valuations.js`）。verdict drivers に閾値判定を追加（computeVerdict 本体は無改変・driver 追加のみ）。
- targetMeanPrice 取得は quality 系バッチに相乗り（#427 の結果次第）→ `value.targetGapPct` 更新。
- Value タブ バリュレンズに impliedGrowth 列＋targetGap 列。

### 受け入れ基準
- [ ] fcfYield+WACC を持つ個別株に impliedGrowth（織り込み成長率%）が出る。
- [ ] 妥当域超で「期待過多」ドライバが付く。
- [ ] targetGap は #427 の可用性次第で自動 or seed（どちらでも壊れない）。

### スコープ外（次フェーズ）
- 2段DCF（高成長N年→逓減→終価）。ETF への適用。アナリスト epsRev 連動。
- **依存**: #427（Yahoo アナリスト目標株価の可用性）。

## D-4 的中率（verdict 答え合わせ）運用フロー（A5/5b）

### 現状
`data/verdict-outcomes.json`（手動ログ）＋`src/verdict-outcomes.js` の `computeHitRate()` は在る（PR#400）。**欠けているのは pending→hit/miss の判定ルール**（今は人が勘で記入）。ログが**発議(action)と verdict(割安割高)を混在**させている。

### 確定（2026-06-21・推奨ロック）
- **①スコープ＝発議(action) と verdict を別建て採点**。各 outcome に `kind: 'action' | 'verdict'`。発議＝Claude の判断の質（②売り遅れ対策の本丸）、verdict＝エンジンの判定精度。
- **②物差し＝対ベンチ相対（ACWI）**＝地合いノイズを除去：
  - 発議：売り→対ACWI**アンダーパフォーム**で hit / 買い→**アウトパフォーム**で hit。
  - verdict：cheap→対ACWI**アウトパフォーム** / rich→**アンダーパフォーム**で hit。
- **③horizon＋自動提案**：発議＝**21営業日(≈1ヶ月)**、verdict＝**126営業日(≈6ヶ月)**。horizon 経過で**バッチが履歴から対ACWI相対リターンを計算し hit/miss を自動提案**（`proposedOutcome`）。人が必要時 `outcome` を上書き＝**手動が優先**。採点漏れを防ぐ。

### 仕様
- **`data/verdict-outcomes.json` スキーマ拡張**（後方互換）：各 entry に `kind` / `horizonDays` / `benchmark:"ACWI"` / `proposedOutcome` / `resolvedAt`。既存の手動 `outcome` は不変・優先。
- **`src/verdict-outcomes.js`**：純関数 `resolveOutcome(entry, pfReturnInWindow, benchReturnInWindow)`（対ベンチ相対で hit/miss 判定）＋`computeHitRate()` を**kind 別に分離**（`actionHitRate` / `verdictHitRate`）。
- **バッチ（日次 or 週次）**：pending かつ horizon 経過の entry に、履歴キャッシュから対ACWI相対リターンを計算し `proposedOutcome` を埋める。`outcome` が手動設定済みなら触らない。
- Value タブ 総合の的中率表示を action / verdict 別に。

### 受け入れ基準
- [ ] kind 別の的中率（actionHitRate / verdictHitRate）が出る。
- [ ] horizon 経過 pending に対ACWI相対で `proposedOutcome` が自動付与される。
- [ ] 手動 `outcome` は自動提案に上書きされない（手動優先）。
- [ ] 既存ログ・既存 computeHitRate の後方互換。

### スコープ外（次フェーズ）
- 発議の非価格要素（集中是正・希薄化回避など定性判断）の自動採点＝当面は手動補正に委ねる（proposedOutcome は価格ベースの参考値）。

## D-6 テーマ枠 × 地域枠の再設計

### 前提補正（mf-holdings 正本で裏取り・2026-06-21）
当初の「VGK/ILF/ハンセンをテーマ扱い＝地域二重計上」という課題設定は現保有では大半が不成立：
- **VGK（欧州）・2800.HK（香港）は未保有**（target-allocation の枠定義・valuations の採点対象のみ。positions.json にも mf-holdings.json にも現物なし）。
- **実在の地域チルトは ILF（中南米）のみ**＝しかも設定上は**コア枠**（テーマではない）。
- **二重計上の最大要因は欧州でなく日本**：ACWI 内の日本5% ＋ 1306(TOPIX) ＋ ひふみ ＋ 日本個別（小松/セイコー/ファストリ）＋ NEXT FUNDS（銀行/商社/半導体）が積み上がり、地域軸で見ると**日本が三〜四重**。

### 確定（2026-06-21・ユーザー）
- **主目的＝真の地域配分の可視化**（能動的な地域 target 管理＝案B は次フェーズ）。
- **筆頭ユースケース＝日本の真の% を可視化**し、意図的なホームバイアスかを確認（D-6 の主記題に据える）。
- **方式＝段階導入**：案A（地域タグ・即可視化）→ 案C 限定（**ACWI/ひふみXO の2本だけルックスルー按分**＝真の地域% の約8割を捕捉）。VGK/2800 は**将来枠プレースホルダのみ**。

### 仕様
- **データ**：
  - `data/region-map.json`（or target-allocation に `region` フィールド）：各保有/ファンドの主地域タグ（`japan` / `north_america` / `europe` / `em_latam` / `em_asia` / `china_hk` / `global` / `commodity_cash`）。単一国ファンド・個別株は直接タグ。
  - `data/region-weights.json`：ルックスルー対象（ACWI＝オルカン proxy、ひふみXO＝ACWI proxy、ひふみ投信＝日本中心）の地域構成比（**静的・四半期更新・鮮度注記**）。例 ACWI＝US63/JP5/Europe15/EM12/other5、ひふみ投信≈日本95。
- **計算＝`src/region-calc.js` 純関数 `computeTrueRegionExposure(holdings, regionMap, regionWeights)`**：
  - 各保有を**金額**で地域に配賦。直接タグ＝全額その地域。ルックスルー対象＝region-weights で按分。
  - 出力：地域別 真エクスポージャ額・%。
- **表示（Risk タブ「地域エクスポージャ（ルックスルー）」セクション）**：地域｜真%｜（任意：ACWIベンチ%）。
  - **筆頭カード＝「日本 真% ｜ ACWIベンチ5% ｜ ホームバイアス +Xpt」**。意図的な傾けか一目で分かる。

### 受け入れ基準
- [ ] ACWI/ひふみを按分した**真の地域%**が Risk タブに出る（直接タグ＋ルックスルー2本の合算）。
- [ ] 日本の真% がベンチ（ACWI 5%）比＋ホームバイアス pt で表示。
- [ ] VGK/2800 は未保有時 region 枠定義のみ（0%・将来買い増し時に自動で地域に乗る）。
- [ ] region-weights は静的更新（鮮度日付を UI に注記）。computeVerdict 等 他ロジック無改変。

### スコープ外（次フェーズ）
- 案B（能動的な地域 target/乖離管理・第4軸）。
- HSI の本土株 vs 香港地場の精密按分（公式 factsheet が PDF バイナリ＝手動）。
- 月次の factsheet 自動追従（当面は四半期手動更新で可）。
