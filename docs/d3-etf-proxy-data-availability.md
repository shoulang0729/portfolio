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

---

## 7. 確定設計（Mulmo・2026-06-21）→ VS Code 実装スペック（A4）
> §6 の事実を受けてユーザーと確定。**実装はここから VS Code 担当（A4）**。設計は自己判断で変えず、矛盾あれば止めて報告。

### 7.0 結論
ETF verdict は **Yahoo `summaryDetail.trailingPE` を `perTrail` に投入し、`perFwd=null`／`peg=null` のまま走らせる**。
forward/holdings ベースの精緻化は **データが無いので今フェーズでは追わない**（欠損は無理に埋めない＝次フェーズ）。

### 7.1 確定した3判断（ユーザー・2026-06-21）
- **Q1＝情報レイヤー扱い**：ETF の割安/割高は **表示するが、§5 の売り発議を自動で立てない**。proxy＋低 confidence バッジを付す。
- **Q2＝純 trailing で統一**：手動 forward seed を**廃止**。**SMH の NVDA seed（perFwd 20.6/perTrail 31.3/peg 0.46）を撤去**し、Yahoo trailing 44.5 で評価（→ rich_real 寄りになるが、Q1 により売りシグナル化しない）。メンテゼロを優先。
- **Q3＝欠損 ETF**：当初「na」と決めたが、**実データ検証（VS Code差し戻し・2026-06-21）で前提が崩れた**ため §7.2A で再確定。

### 7.2A 差し戻し再確定（2026-06-21・VS Code 指摘 → ユーザー再決定）
**事実**：当初 §7 が「シクリカル・欠損 ETF は na のまま不変」「`cyclical=true` 維持」と書いたが、実データでは**いずれも na ではなかった**。`cyclical=true` は valuations.json 全体で 6301.T の1箇所のみ。下記 ETF は **旧%タイルシステムの `perCurrent`＋`bandLow/High` を保持**し、percentile ゾーンで cheap/fair/rich に分類されていた（＝percentile は実在バンド由来の正当値・捏造ではない）。

これを受けた**再確定**：
- **判断1：シクリカル（COPX/REMX/XLE）→ na 化する**。理由＝PER% はシクリカルに逆張り（不況減益→PER高→偽の割高。現に XLE pct100→rich は誤判定）。設計§③「シクリカルは商品価格デックで見る」通り。**`value.cyclical=true` を3銘柄に付与**（データのみ・コード変更なし）。
- **判断2：日本欠損 ETF（1629.T/1477.T/2516.T/200A.T）→ percentile 判定を維持**（na にしない）。理由＝seeded PER バンドがあり根拠あり・perFwd=null で広域株 ETF と同じ「%タイル駆動・低confidence」に着地・**一貫性優先**。na 化は逆に不整合＋コード改修を要するため不採用。「無理に埋めない・次フェーズ」方針とも整合（既存挙動を残すだけ＝何も足さない）。
- 2800.HK は非保有（Value タブ非表示）。同じ broad-equity 扱い（percentile 維持）でよい。

### 7.2 ETF 区分と扱い（最終・7.2A 反映済）
| 区分 | 銘柄 | perTrail | perFwd | verdict |
|------|------|----------|--------|---------|
| 広域株式 | VT / VEA / VGK / ACWI | Yahoo trailing | null | %タイル3段階 |
| セクター/テーマ株式 | SMH / XLF / XLV / XLP / DTCR / SHLD | Yahoo trailing | null | %タイル3段階 |
| シクリカル/コモディティ | COPX / REMX / XLE | — | — | **na（`value.cyclical=true` を新規付与）** |
| 日本欠損（seededバンド有） | 1629.T / 1477.T / 2516.T / 200A.T（＋非保有2800.HK） | null（Yahoo欠損） | null | **percentile判定を維持・低confidence**（変更なし） |
| ※ETFでない | LITE（Lumentum＝個別株） | 個別株扱い | — | 既存ロジック |

### 7.3 verdict は **コード変更不要**（既存ロジックで意図どおり退化する）
`classifyVerdict()` は perFwd=null だと rising/falling 分岐が自然に無効化され、ETF はこう落ちる（確認済）：
- %タイル ≤30 → `cheap_real`（🟢本物の割安）／ 31–69 → `fair`（🟡フェア）／ ≥70 → `rich_real`（🔴本物の割高）
- → **3段階に単純化される。これは仕様どおり**。computeVerdict には手を入れない。

### 7.4 confidence も **基本コード変更不要**（自然に「低」へ）
`computeConfidence()` は `hasPer = perTrail!=null && perFwd!=null` を要求するため、**perFwd=null の ETF は hasPer=false → score が伸びず大半が「低」判定**になる（例: SMH pct98 でも score≈1.0=低）。狙いどおり。
- ただし **proxy 由来であることを UI に明示**したい（confidence「低」だけだと理由が伝わらない）。→ 7.5 のフラグでバッジ表示。

### 7.5 必要な実装（A4 の作業）
1. **新規バッチ `data/scheduler/etf-pe.mjs` で ETF trailingPE を投入**（承認済・2026-06-21）：既存 `data/scheduler/` に price バッチが無い（quality-us/jp/writeback のみ・watchlist-per.mjs は不在）ため、**新規バッチを新設**。対象 ETF（7.2 の上2区分＝10銘柄）の `value.perTrail` を Yahoo `summaryDetail.trailingPE`（Worker `/yahoo` 経由）から更新。`perFwd`/`peg` は触らない（null のまま）。trailing は株価で日々動くが、ファンダ的更新頻度は週次で十分。
2. **proxy フラグ追加**：`value.perSource: "fund-trailing"`（上2区分 ETF のみ）を立てる。Value タブで verdict chip 横に **「proxy」バッジ＋confidenceは既存の「低」** を表示。ツールチップ＝「ETFのファンド実績PER。予想PER不在のため%タイル基準の粗い判定」。
3. **§5 トリガー連携（②売りルール）**：`evaluateTriggers()` で **`type:'valuation'` かつ `side:'sell'` のトリガーは、ETF（proxy銘柄）では `active` に上げず `watching` に降格**。
   - ⚠️ **`type:'concentration'`（テーマ上限超過）は ETF でも従来どおり `active` に上げる**（PF リスク由来＝§4/§5 の正当な売り。ETF の自前バリュエーションとは別物）。混同しないこと。
   - 実装：`evaluateTriggers(symbol, ctx)` の ctx に `isEtf`（or proxy 判定）を渡し、valuation+sell 分岐で `if (ctx.isEtf) { watching.push(...); continue; }`。
4. **SMH の手動 seed 撤去**：`valuations.json` の SMH から perFwd/peg の NVDA proxy 値を外し、perTrail を Yahoo 実値（44.5）に。`value.perSource:"fund-trailing"` を付与。
5. **シクリカル na 化（判断1）**：`valuations.json` の **COPX / REMX / XLE に `value.cyclical=true` を付与**（→ classifyVerdict が na＝「シクリカル(別物差し)」を返す）。データのみ・コード変更なし。
6. **日本欠損 ETF（判断2）＝何もしない**：1629.T/1477.T/2516.T/200A.T（＋2800.HK）は **既存の percentile 判定を維持**。perTrail も cyclical も付与しない。confidence は既存ロジックで自然に「低」。

### 7.6 受け入れ基準
- [ ] 対象 ETF（VT/VEA/VGK/ACWI/SMH/XLF/XLV/XLP/DTCR/SHLD）に perTrail が入り、Value タブで %タイル3段階 verdict＋「proxy」バッジ＋confidence「低」が出る。
- [ ] SMH が NVDA seed 撤去後も壊れず、trailing ベースで rich_real 系に表示（売り発議は立たない）。
- [ ] ETF の valuation 売りトリガーが `watching` 止まり、concentration 売りトリガーは従来どおり `active`。
- [ ] **COPX/REMX/XLE は `cyclical=true` 付与で na（シクリカル別物差し）に変わる**（旧 fair/fair/rich から変化）。
- [ ] **日本欠損 ETF（1629/1477/2516/200A.T）は percentile 判定のまま不変**（rich/cheap 等を維持・低confidence）。
- [ ] 個別株 9 銘柄の既存挙動・既存テスト不変。新ロジックにテスト追加。
- [ ] computeVerdict / computeConfidence のコードは変更しない（データ付与とトリガー/バッチ/UIのみ）。

### 7.7 スコープ外（次フェーズ・無理に埋めない）
- forward PER / 原指数 fwd PE の取得（有料・将来）。
- etf-holdings ベースの上位N加重 proxy（B2 / #201 実装後に再評価）。
- 欠損 ETF（HK/日本）の静的手当て。
- ETF の quality ブロック（個別財務が無いので算出不可・null 継続）。

### 7.8 完了後
本ドキュメント §7 の各項目に実装 PR 番号を追記し、Wiki「投資システム アップグレード計画」A4/D-3 を Mulmo が更新する。
