# Handoff（2026-06-24）: 同業他社（セクター）平均との比較 ―― データ源の調査・設計スパイク

> 設計=Mulmo。**これは実装前の調査(spike)タスク**。まず「どのデータ源でセクター中央値が取れるか／カバレッジ・コスト・コンプラ」を検証し、結果を Issue にコメント＋本 doc を更新してから本実装へ進む（生き続ける結論は doc、依頼は Issue）。
> **目的**: Value 詳細の目安バー（handoff `2026-06-24-value-term-cards-and-info.md`）に **「対・同業他社の中央値」の破線**を後乗せする。バー側の差し込み口（`peer` 位置・`.vg-peer` 破線）は先行実装済み/予定。ここでは**その値をどう供給するか**を決める。

## 背景／ゴール
- ユーザー指摘: 「指標は単体だと良いか悪いか分からない。**同業平均との比較**が欲しい」。
- 既に入っている比較は ①自分の過去（%タイル/PERバンド）②対ACWI ③vs WACC ④対アナリスト目標。**足りないのは『対・同業他社』**。
- ゴール: 主要指標（最低 PER・EV/EBITDA・粗利/資産・FCF利回り 等）について、銘柄ごとに**同業の中央値**を持ち、目安バーに破線で重ねる。**render 時に外部 API を叩かない**（バッチで先に計算してファイル化）。

## 検証すべきデータ源（候補と論点）
| 候補 | 取得方法 | 長所 | 懸念（要検証） |
|---|---|---|---|
| **Finnhub `/stock/peers` ＋ `/stock/metric`** | 銘柄→peer ティッカー一覧→各peerのmetric→中央値を自前計算 | 既存の主データ源・Worker proxy 済・APIキー隠蔽済 | **日本株(.T)のpeers/metricカバレッジ**が薄い恐れ。1銘柄あたりN+1コール＝**レート(60/分)圧迫**→バッチ必須。metricの定義整合（peTTM等） |
| **セクター/業種 ETF を proxy** | 銘柄の業種→代表ETFのPER等を「業種平均」の近似に | 1コールで軽い・常に取れる | 粒度が粗い（業種≠厳密な同業）。EV/EBITDAやFCF利回りはETFで出ない指標あり |
| **Bigdata.com MCP / WebSearch** | 業種中央値を調査して定数化 | 定性背景・最新値 | **アプリ実行時には使えない**（MCPはMulmo側のみ）。半自動の手動更新運用になる。鮮度・再現性が落ちる |
| **静的リファレンス表（手当て）** | 主要業種×主要指標の中央値を `data/sector-medians.json` に半年ごと更新 | 実装が最も軽い・決定論 | 鮮度は四半期〜半期遅れ。更新運用が要る |

> 推奨の初期仮説（検証で覆ってよい）: **Finnhub peers→metric を日次/週次バッチで中央値計算→`valuations.json`（or 新 `sector-medians.json`）に格納**。日本株カバレッジが弱ければ、**業種ETF proxy or 静的表にフォールバック**するハイブリッド。

## スパイクで答えを出すこと（受け入れ条件＝調査）
- [ ] 保有＋ウォッチの代表5–6銘柄（**米株・日本株・ETF を混ぜる**）で Finnhub `/stock/peers` と `/stock/metric` を実際に叩き、**peers件数・metricの埋まり具合・日本株での可否**を表で記録（Issue コメント）。
- [ ] 取れる指標を確定（PER・EV/EBITDA・粗利/資産・FCF利回り のうちどれが peer 比較可能か）。**取れない指標は破線を出さない**方針で良いか判断。
- [ ] コスト見積り: 全追跡銘柄×peers のコール数／レート制限内に収まる**バッチ頻度**（日次batch相乗り or 週次）を提案。
- [ ] **格納スキーマ案**を確定（例: `valuations[sym].sectorMedian = { per, evEbitda, grossProf, fcfYield, asOf, source, n }`。`source`=finnhub-peers|etf-proxy|static、`n`=サンプル数）。**load-bearing な既存フィールド名は変えない**。
- [ ] フォールバック設計（Finnhub不可時にETF proxy/静的表へ）と、**鮮度の見せ方**（バーの破線に `同業(n=8)` 等のラベル／古い時は控えめ表示）。
- [ ] 結論を本 doc に追記し、**本実装の別 Issue を起票**（バッチ計算＋スキーマ＋フロント描画）。

## 触ってはいけない / 注意
- render 時に外部 API を叩かない（必ずバッチ→ファイル）。`mf-holdings`/`positions`/`valuations` の **load-bearing フィールド名は不変**（追加はOK・改名NG）。
- Finnhub APIキーは Worker Secret（フロント露出禁止）。バッチも Worker or 既存パイプライン経由。
- 「中央値」を使う（平均は外れ値に弱い）。サンプル数 n<3 のときは**破線を出さない**（誤誘導防止）。

## ブランチ／PR／Issue
- 調査は実装不要（コード変更最小・あれば spike ブランチ）。**結論は本 doc 追記＋ Issue コメント**。
- 本実装は別 Issue（`feat/sector-median-benchmark`）として後続で起票。

---

## 調査結果（2026-06-25 / 実測スパイク・#492）

**経路**: Worker `/finnhub` proxy（`/stock/peers`・`/stock/metric?metric=all`）。`/private/tmp/peer_median.py` で peer 中央値を実計算。

### 代表銘柄の実測（peers 件数・metric 充足・中央値可否）
| ticker | 種別 | peers | metric keys | 中央値計算 |
|---|---|---|---|---|
| AAPL | 米株 | **12** | 133 | ✅ peer 12/12 充足 |
| NVDA | 米株 | **11** | 133 | ✅ peer 11/11 充足 |
| 9983.T（TYO:9983） | 日本株 | **0** | **0** | ❌ |
| 6301.T（TYO:6301） | 日本株 | **0** | **0** | ❌ |
| 7203.T トヨタ（TYO:/.T/.TYO/TSE:/裸 全形式） | 日本株 | **0** | **0** | ❌（形式問題ではない） |
| SMH / ACWI | ETF | **0** | – | ❌（ETF は構造上 peer 無し） |
| TM（トヨタ US ADR） | 米国ADR | 9 | 131 | ✅ |
| ASML（ADR） | 米国ADR | 3 | 133 | ✅ |

### 結論
1. **Finnhub の peers/metric は米株（と米国上場 ADR）専用。日本株(.T)は peers も metric も全形式で空**＝Finnhub 現プランに日本株ファンダ無し。シンボル変換の問題ではない（トヨタを5形式で確認）。
2. **米株は peer 中央値が綺麗に出る**（実測）:
   - AAPL: peTTM 中央値 **35.6**（self 35.7）/ evEbitda **25.3**（27.6）/ grossMargin **40.8**（47.9）/ pb **7.5**
   - NVDA: peTTM 中央値 **61.1**（self **30.3**＝同業より割安）/ evEbitda **53.3**（29.2）/ grossMargin **57.3**（74.2）
3. **peer 比較できる指標（米株）**: `peTTM` / `evEbitdaTTM` / `grossMarginTTM` / `pbQuarterly`。
   FCF 利回りの直接 % は無いが `currentEv/freeCashFlowTTM`・`pfcfShareTTM`（P/FCF）で代替可。**取れない指標は破線を出さない**方針で OK。

### コスト・バッチ頻度
- 1 銘柄 = `peers` 1 + `metric` ×N（N≈11）≒ **12 コール**。保有の米個別株は AAPL/AMZN/GOOGL/MSFT/PLTR/TSLA の **6 銘柄 → ≒72 コール**。
- Finnhub 無料 60/分 をわずかに超える → **スロットル（〜2分に分割）or peer 重複の dedupe** で収まる。
- セクター中央値は動きが遅い → **週次バッチ推奨**（既存 quality バッチ/Worker に相乗り）。日次相乗りでも可だが不要。

### 格納スキーマ案（確定提案・load-bearing 不変・追加のみ）
```jsonc
valuations[sym].sectorMedian = {
  "per": 35.6, "evEbitda": 25.3, "grossMargin": 40.8, "pb": 7.5,
  "n": 12,                      // サンプル数。n<3 の指標は出力しない
  "source": "finnhub-peers",    // finnhub-peers | etf-proxy | static
  "asOf": "2026-06-25"
}
```

### フォールバック設計（日本株・ETF は Finnhub 空）
- **MVP 推奨＝グレースフル縮退**: 日本株・ETF は **peer 破線を出さない**（バーの他比較①〜④はそのまま）。データが無いものを無理に出さない。
- 次点: `data/sector-medians.json`（業種×指標の中央値・半期手動）を後フェーズで。日本株を埋めたくなったら。
- 限定的: 流動性ある **米国 ADR がある外国株のみ ADR 代理**（TM 等）。手動マッピング・ROI 低 → 初期スコープ外。

### 鮮度の見せ方
- 破線ラベルに `同業(n=12)`。`source` バッジ（finnhub/static）。`asOf` が古い時は控えめ表示。

### 推奨ロードマップ
- **Phase 1（本実装 Issue）**: Finnhub peers→metric を**週次バッチ**で米個別株のみ中央値化 → `valuations[sym].sectorMedian` 格納 → Value 詳細バーに **米株のみ peer 破線**を描画。日本株/ETF は破線なし（縮退）。
- **Phase 2（別途）**: 日本株を `sector-medians.json` 静的表で補完するか判断。

→ 本実装は別 Issue を起票（`feat/sector-median-benchmark`）。
