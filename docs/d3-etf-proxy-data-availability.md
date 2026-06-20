# D-3 ETF verdict proxy — データ可用性 調査依頼

> **開発フロー**: 設計=Mulmo / 実装=VS Code の一方通行。本書は Mulmo が作成。
> VS Code は **§5 の調査だけ** 実施し、結果を §6 に追記して報告（実装はまだしない）。
> 設計の正本＝Wiki「投資システム アップグレード計画」§③/⑤・A4・D-3。

作成 2026-06-20 / 対象リポジトリ `github/portfolio`

---

## 1. ひとことで
ETF に verdict（割安/割高/罠の6分類）を持たせる **proxy ルール** を設計したい。
その前提として「ETF のファンド単位バリュエーション指標が **FMP で機械取得できるか**」を実データで確認する。

## 2. 背景（なぜ詰まっているか）
`computeVerdict()`（`src/valuations.js`）は **個別株専用**。入力は
`percentile + perTrail + perFwd + peg + debtHeavy` ＝ 企業1社の PER 系の数字。

ETF は「銘柄の詰め合わせ」で単一 PER が存在しないため、現状 valuations.json では
ETF が軒並み **na（判定不能）** になっている：

| ETF | perFwd | percentile | verdict |
|-----|--------|-----------|---------|
| SMH | 20.6（NVDA値を手動投入 PR#392） | 98 | 判定可（rich_fake） |
| VGK | null | 96 | **na** |
| VEA | null | 100 | **na** |
| ILF | null | 69 | **na** |
| XLV | null | 89 | **na** |
| DTCR | null | 29 | **na** |

SMH だけ NVDA の数字を手で入れて穴を塞いだ＝これが「proxy」の起源。だが**1個の場当たり対応**でルール化されていない。
ETF は PF の相当部分を占めるため、Value タブのスコアカードが**お金の乗っている場所で空く**。

これが A4（ETF verdict 精緻化）＝ VS Code の quality バッチが「ETF の value/quality に何を書くか」の
**ルール待ちで手が止まっている**ブロッカー。

## 3. 本命の設計案
**「ETF 発行体が公表するファンド単位の加重 PER」を proxy に使う**（筆頭銘柄1本を当てる SMH→NVDA 方式より正確）。
ETF を種類で分けて扱いを変える：

| 区分 | 例 | 方針 |
|------|-----|------|
| 広域株式 | VT / VEA / VGK / ACWI | ファンド/指数の公表 PER を直接投入 |
| セクター/テーマ株式 | SMH / XLF / XLV / XLP / DTCR / LITE / SHLD | ファンド公表 PER を proxy 投入 |
| シクリカル/コモディティ | COPX / REMX / XLE | **proxy対象外**（`cyclical=true`→na・商品価格デックで見る） |
| 債券/現金 | — | スコープ外 |

## 4. 詰めるべき論点（§5 の調査結果を見て確定する）
- **trailing か forward か**：verdict は perTrail と perFwd の両方で「増益で割安が見せかけか（rising/falling）」を判定する。forward が無いと判定の半分が効かない。
- **赤字構成銘柄の歪み**：テーマ系（DTCR 等）は赤字企業を含み、加重 PER が低く出る/na になる。信頼度が落ちる。
- **透明性**：proxy は ETF 本体の実力ではない近似値 → ラベル明示＋判定確度を下げる（`computeConfidence` への波及を確認）。
- **継承する項目**：value（PER/PEG）だけか、quality も持たせるか。handoff では「ETF は個別財務無し＝quality算出不可・proxy設計が決まるまで null」で保留中。

---

## 5. 調査タスク（VS Code 実施・実装はしない）
`#412` で追加した Worker `/fmp` route を使ってOK。**調査のみ・valuations.json は書き換えない。**

1. **FMP の ETF 系エンドポイント**（`etf-info` / `etf-holdings` / `etf-sector-weightings` 等）で、
   ファンド単位の **PER** が取れるか。取れるなら：
   - trailing P/E か / forward P/E か / 両方か
   - peg・price-to-book など他指標も来るか
   - 値の as-of（更新頻度・四半期遅延か直近か）
2. 下記 ETF を実際に叩き、PER が返るか欠損かを一覧化：
   - 広域株式：**VT / VEA / VGK / ACWI**
   - セクター/テーマ株式：**SMH / XLF / XLV / XLP / DTCR / LITE / SHLD**
   - ※コモディティ/シクリカル（COPX / REMX / XLE）は proxy 対象外＝確認不要
   - 非米（参考・FMP対象外の可能性）：2800.HK / ASHR / 3033.HK / 1615.T / 1629.T / 1477.T / 2516.T / 200A.T
3. forward P/E が FMP で取れない場合、原指数の forward PE（MSCI/S&P系）を
   無料 or 既存手段で取得する現実的な方法はあるか（無ければ「trailing のみで設計」も選択肢）。
4. ETF のトップ構成銘柄＋比率（`etf-holdings`）は取れるか
   ＝筆頭/上位N加重 proxy のフォールバック案の実現可能性確認のため。

### アウトプット要件
- 「取れる指標／取れない指標」を表で。
- 実際に返ったサンプル値を 2〜3 銘柄分（**SMH / VT / DTCR** あたり）生で貼る。
- 簡潔に。コードより「何が取れて何が取れないか」の事実を優先。

---

## 6. 調査結果（VS Code 記入欄）
<!-- ここに調査結果を追記してください。記入後、Mulmo が設計を確定します。 -->

- FMP ETF エンドポイントで取れる指標：
- trailing / forward：
- 銘柄別 PER 可用性（VT / VEA / VGK / ACWI / SMH / XLF / XLV / XLP / DTCR / LITE / SHLD）：
- 原指数 forward PE の取得可否：
- etf-holdings（トップ構成＋比率）の可否：
- サンプル値（SMH / VT / DTCR）：
- 所感・詰まり：
