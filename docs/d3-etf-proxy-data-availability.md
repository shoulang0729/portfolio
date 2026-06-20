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

調査日: 2026-06-21 / 取得経路: Worker `/yahoo` プロキシ → Yahoo Finance `v10/finance/quoteSummary?modules=summaryDetail`

### FMP ETF エンドポイントで取れる指標

| エンドポイント | 状態 | PE系 | 備考 |
|---|---|---|---|
| `/stable/profile` | ✅ 取得可 | **なし** | price / beta / marketCap / isEtf のみ。PE フィールド自体が存在しない |
| `/stable/key-metrics-ttm` | 🔒 Premium ブロック | 含む可能性 | 現プランで "Premium Qu…" エラー |
| `/stable/ratios` | 🔒 Premium ブロック | 含む可能性 | 同上 |
| `/stable/financial-ratios-ttm` | ⚠️ 空配列 | — | エラーではなく `[]` |
| `/stable/etf-info` | ⚠️ 空配列 | — | 全 ETF で空 |
| `/stable/etf-holdings` | ⚠️ 空配列 | — | 全 ETF で空 |
| `/stable/etf-valuation` | ⚠️ 空配列 | — | 全 ETF で空 |
| `/stable/etf-sector-weightings` | ⚠️ 空配列 | — | 全 ETF で空 |
| `/api/v3/*` `/api/v4/*` | ❌ Legacy 廃止 | — | 2025/8 以前のユーザー専用 |

**結論: FMP（現プラン）では ETF の PER は取得不可。**  
ETF 専用エンドポイント群がすべて空配列を返すため、プラン問題というより FMP 自体が ETF のファンドレベル PER を保持していない可能性が高い。

### trailing / forward

| 指標 | FMP | Yahoo Finance |
|---|---|---|
| trailing P/E | ❌ 取れない | **✅ 取れる**（`summaryDetail.trailingPE`） |
| forward P/E | ❌ 取れない | ❌ 取れない（ETF では空 `{}`） |
| P/B / PEG | ❌ 取れない | ❌ 取れない（空） |

**→ trailing のみで設計が現実解。**

### 銘柄別 PER 可用性（Yahoo Finance `summaryDetail.trailingPE`）

| ETF | trailingPE | forwardPE | 備考 |
|---|---|---|---|
| VT | 22.5 | N/A | |
| VEA | 18.6 | N/A | |
| VGK | 17.8 | N/A | |
| ACWI | 23.3 | N/A | |
| SMH | 44.5 | N/A | |
| XLF | 16.9 | N/A | |
| XLV | 24.1 | N/A | |
| XLP | 25.1 | N/A | |
| DTCR | 22.1 | N/A | |
| SHLD | 29.3 | −6.4 | forwardPE は異常値（赤字企業混在） |
| LITE | — | — | ETF ではなく個別株（Lumentum Holdings Inc.） |
| ASHR | 17.4 | N/A | |
| 3033.HK | 18.4 | N/A | |
| 1615.T | 17.7 | N/A | |
| 2800.HK | **N/A** | N/A | Yahoo でも欠損 |
| 1629.T / 1477.T / 2516.T / 200A.T | N/A | N/A | FMP profile も空配列 |

対象 ETF（LITE 除く）は **13/14 で trailingPE が自動取得可能。**

### 原指数 forward PE の取得可否

**現実的な無料手段はない。** MSCI/S&P が公表する指数レベルの forward PE は有料データ。  
Yahoo Finance でも ETF の forwardPE フィールドは空（SHLD の −6.4 は赤字企業混在による異常値）。  
→ **`perFwd` は ETF では null 固定で設計する。**

### etf-holdings（トップ構成 + 比率）の可否

FMP の `/stable/etf-holdings` は空配列。Worker の `/etf/constituents` ルートは「構成銘柄が見つかりません」（B2 アダプタ未実装）。  
→ **現時点では取得不可。B2（Issue #201）実装後に再評価。**

### サンプル値（SMH / VT / DTCR）

**SMH（VanEck Semiconductor ETF）**
```json
{
  "trailingPE":  { "raw": 44.497772, "fmt": "44.50" },
  "forwardPE":   {},
  "totalAssets": { "raw": 67822489600, "fmt": "67.82B" },
  "yield":       { "raw": 0.0018, "fmt": "0.18%" },
  "navPrice":    { "raw": 659.73, "fmt": "659.73" }
}
```

**VT（Vanguard Total World Stock ETF）**
```json
{
  "trailingPE":  { "raw": 22.508926, "fmt": "22.51" },
  "forwardPE":   {},
  "totalAssets": { "raw": 95332884480, "fmt": "95.33B" },
  "yield":       { "raw": 0.0159, "fmt": "1.59%" },
  "navPrice":    { "raw": 157.59, "fmt": "157.59" }
}
```

**DTCR（Global X Data Center & Digital Infrastructure ETF）**
```json
{
  "trailingPE":  { "raw": 22.132208, "fmt": "22.13" },
  "forwardPE":   {},
  "totalAssets": { "raw": 2144204160, "fmt": "2.14B" },
  "yield":       { "raw": 0.0074, "fmt": "0.74%" },
  "navPrice":    { "raw": 31.80, "fmt": "31.80" }
}
```

### 所感・詰まり

- FMP は想定外に ETF バリュエーションが薄い。Premium プランに上げても etf-info 系が空のままなら無意味になる可能性がある
- Yahoo Finance の `summaryDetail.trailingPE` が **既存 Worker 無料・追加インフラなし** で 13/14 を取れるのは想定より良好な結果
- `perTrail` のみ投入して `perFwd=null` で verdict を走らせる設計が最もコスパが良いと判断。Mulmo 側で `computeVerdict` の片側 null 時の挙動（rising/falling 判定が効かなくなる件）を設計に織り込んでほしい
- 2800.HK と日本 ETF 4本（1629.T / 1477.T / 2516.T / 200A.T）は Yahoo でも PE 欠損。コモディティ扱いと同様に `cyclical=true` 相当で na にするか、静的値を手当てするか要判断
