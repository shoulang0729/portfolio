# Handoff（2026-06-25）: 日本株のファンダ＆セクター中央値 データ源の調査スパイク

> 設計=Mulmo。**実装前の調査(spike)**。「どのデータ源で日本株(.T)の①個別ファンダ②セクター中央値が取れるか」を実測し、結論を Issue コメント＋本 doc に追記してから本実装を別 Issue に起票する（生き続ける結論は doc、依頼は Issue）。
> **位置づけ**: セクター中央値 Phase1（#493）は **Finnhub＝米国上場株のみ**で、日本株(.T)は peers/metric が全形式で空（#492 実測）。本タスクは**その日本株の穴**を埋めるデータ源を探す（Phase2 の前提調査）。

## 背景／ゴール
- ユーザー保有（`src/positions.js`）＝**米国上場 17・日本株(.T) 9**。外国株の多くは米国上場で Finnhub がカバー済み＝**実際の穴は日本株9銘柄**（＋ETF/投信は構造上 peer 無し）。
- Value 詳細の目安バーは、日本株では「対・同業中央値」破線が出ない縮退状態。ここを埋めたい。
- ゴール: 日本株について **①個別ファンダ（PER・EV/EBITDA・粗利率・PBR 等）②同業/セクター中央値** を、**render 時に外部 API を叩かずバッチ→ファイル**で供給できるか見極める。
- 将来、非米国上場の外国株（欧州 .L/.AS、香港 .HK 等）を持った場合も同じ穴になるため、**データ源は「非米国上場ジェネリック」に拡張できる形**で設計する。

## 検証すべきデータ源（候補と論点）
| 候補 | 取得 | 長所 | 懸念（要検証） |
|---|---|---|---|
| **Yahoo Finance quoteSummary**（既存 Worker `/yahoo` proxy） | `summaryDetail`(trailingPE/forwardPE/priceToSales/dividendYield) ・`defaultKeyStatistics`(pegRatio/enterpriseToEbitda/priceToBook/profitMargins) ・`financialData`(grossMargins/returnOnEquity/freeCashflow 等) | アプリ既存経路・**日本株の個別ファンダはほぼ取れる見込み**・US も同経路で統一可 | **peer リストが無い**（個別値は出るがセクター中央値の母集団が作れない）。モジュール毎の欠損・通貨/単位差 |
| **JPセクターETF/TOPIX-17 をproxy** | 業種→対応セクターETF(例 NEXT FUNDS TOPIX-17)のPER等を業種平均の近似に | 1コールで軽い・決定論寄り | 粒度が粗い（業種≠厳密同業）。EV/EBITDA・粗利率はETFで出ない指標あり。指標が PER/PBR 程度に限られる |
| **静的リファレンス表 `data/sector-medians.json`** | 主要業種×主要指標の中央値を半期手動更新（JP分） | 実装最軽・決定論・全指標カバー可 | 鮮度は四半期〜半期遅れ。更新運用が要る（誰が・いつ） |
| **EDINET / JPX**（公式開示） | 有報・適時開示から算出 | 一次情報・無料 | 取得/解析が重い・四半期遅延・ROI 低（スコープ外候補） |
| **Bigdata.com / WebSearch**（Mulmo側） | 業種中央値を調査して定数化 | 最新の定性背景 | **アプリ実行時に使えない**＝半自動更新運用。鮮度・再現性が落ちる |

> 初期仮説（覆ってよい）: **個別ファンダ＝Yahoo quoteSummary**（日本株でも取れる前提を実測で確認）＋ **セクター中央値＝静的表 or JPセクターETF proxy のハイブリッド**。Yahoo は個別値は出るが peer 母集団を作れないのが肝。

## スパイクで答えを出すこと（受け入れ条件＝調査）
- [ ] **日本株9銘柄**（`positions.js` の .T 全部）で Yahoo `quoteSummary`（`summaryDetail,defaultKeyStatistics,financialData`）を実測し、**どの指標が埋まるか**を表で記録（trailingPE/forwardPE/enterpriseToEbitda/priceToBook/grossMargins/profitMargins/dividendYield 等の充足）。Worker `/yahoo` 経由でレート/CORS も確認。
- [ ] **セクター中央値の作り方**を1つ決める: (a)JPセクターETF/TOPIX-17 proxy で取れる指標と粒度を実測、(b)静的表の運用案（業種定義・更新頻度・誰が）。どちらが MVP に妥当か判断。
- [ ] **Phase1 スキーマと整合**: `valuations[sym].sectorMedian = {per,evEbitda,grossMargin,pb,n,source,asOf}` を**そのまま使い**、JP は `source:"yahoo+etf-proxy"` or `"static"`、ETF proxy は `n` を擬似値か null で扱う方針を決める（load-bearing 不変・追加のみ）。
- [ ] **個別ファンダの取り込み口**: Yahoo 由来の JP 個別ファンダ（PER 等）を `valuations` の既存フィールド（`value.*`/`perCurrent` 等）に**どう載せるか**（既存 valuations パイプラインとの重複/優先順位）。手動シード優先の原則を壊さない。
- [ ] コスト・頻度: 9銘柄×数モジュール＝軽い → 既存 quality/valuations バッチに相乗りで可かを確認。**週次で十分**。
- [ ] 結論を本 doc に追記し、**本実装を別 Issue 起票**（JP個別ファンダ取込＋JPセクター中央値＋バー描画の縮退解除）。

## 触ってはいけない / 注意
- render 時に外部 API を叩かない（必ずバッチ→ファイル）。`positions`/`valuations`/`mf-holdings` の **load-bearing フィールド名は不変**（追加 OK・改名 NG）。
- Yahoo は非公式・モジュール欠損あり＝**取れない指標は破線/値を出さない**縮退を守る。手動シード（valuations.json 手入力）を勝手に上書きしない。
- 「中央値」を使う（平均は外れ値に弱い）。n<3（or ETF proxy で母集団不明）のときの**破線の出し方**を明示（`同業(proxy)` 等ラベルで質を伝える）。
- Finnhub/Yahoo キー・プロキシ経路の前提は CLAUDE.md 準拠。

## ブランチ／PR／Issue
- 調査は実装最小（spike ブランチ可）。**結論は本 doc 追記＋ Issue コメント**。
- 本実装は別 Issue（`feat/jp-sector-median`）として後続起票。Phase1（#493・米株）とはデータ源が別なので**独立に進められる**。
