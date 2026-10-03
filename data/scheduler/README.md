# 自動供給バッチ（A3 quality / A4 ETF PER）

`valuations.json` の `quality` / `value` ブロックを週次で自動更新するバッチ群。
**Mulmo のワークスペース（手元）で実行する**前提。CI では動かさない（API キーを Secrets に置かないため）。

## スクリプト

| ファイル | 対象 | データソース | 更新ブロック |
|---|---|---|---|
| `quality-us.mjs` | 米国個別株（ETF 除外） | FMP stable API（優先）→ SEC EDGAR（フォールバック） | `quality` |
| `quality-jp.mjs` | 日本個別株（`.T`・ETF 除外） | EDINET DB API | `quality` |
| `etf-pe.mjs` | ETF 10銘柄（広域株式＋セクター/テーマ） | Yahoo `summaryDetail.trailingPE`（Worker `/yahoo` 経由） | `value`（perTrail＋perSource） |
| `target-gap.mjs` | 個別株（quality 持ち・HK 除外） | Yahoo `financialData.targetMeanPrice`（Worker `/yahoo` 経由） | `value.targetGapPct`（既存 value にマージ） |
| `hit-rate.mjs` | verdict-outcomes の horizon 経過 pending | Yahoo chart（対象＋ACWI・Worker `/yahoo` 経由） | `data/verdict-outcomes.json` の `proposedOutcome`/`resolvedAt` |

`quality-*` は純関数 `src/quality-calc.js` の `computeQuality()` で指標を算出。
`etf-pe.mjs` は ETF のファンド実績PER を `value.perTrail` に投入し `value.perSource:"fund-trailing"` を立てる
（FMP は ETF の PER を持たないため Yahoo 経由・予想PER/PEG は ETF では取得不能なので触らない。設計＝`docs/d3-etf-proxy-data-availability.md` §7）。
`target-gap.mjs` は `(targetMeanPrice / currentPrice − 1)` を %（整数）で `value.targetGapPct` に投入。
アナリスト未カバー（例 6016.T）は null 継続・ETF/HK は対象外（#427）。
いずれも `data/scheduler/writeback.mjs` の `writeBlocks()` で**該当ブロックだけ**を元フォーマット保持で書き換える（API キー不要・インデント幅は自動検出）。

> ⚠️ `etf-pe.mjs` の対象は広域株式（VT/VEA/VGK/ACWI）＋セクター/テーマ（SMH/XLF/XLV/XLP/DTCR/SHLD）の10銘柄のみ。
> シクリカル（COPX/REMX/XLE＝`cyclical` で na）・日本欠損 ETF（1629/1477/2516/200A.T＝percentile 判定維持）は対象外。

## API キーの渡し方（2 通り・どちらか）

**git にコミットしないこと。** `.gitignore` で config ファイルと環境変数は保護済み。

### 1. 環境変数（推奨・CI/手動どちらも）

```bash
FMP_API_KEY=xxxx        node data/scheduler/quality-us.mjs
EDINET_DB_API_KEY=xxxx  node data/scheduler/quality-jp.mjs
```

### 2. gitignore 済み設定ファイル

```jsonc
// data/scheduler/fmp-config.json     （.gitignore 済み）
{ "FMP_API_KEY": "xxxx" }

// data/scheduler/edinet-config.json  （.gitignore 済み）
{ "EDINET_DB_API_KEY": "xxxx" }
```

## CLI フラグ

| フラグ | 効果 |
|---|---|
| `--dry-run` | 取得・計算のみ。ファイル書き込み／コミットはしない |
| `--symbol AAPL` | 1 銘柄だけ処理（動作確認用） |

```bash
# 動作確認（書き込まない）
FMP_API_KEY=xxxx node data/scheduler/quality-us.mjs --dry-run --symbol AAPL
EDINET_DB_API_KEY=xxxx node data/scheduler/quality-jp.mjs --dry-run --symbol 6301.T

# 本実行（valuations.json 更新 → git commit & push まで）
FMP_API_KEY=xxxx node data/scheduler/quality-us.mjs
EDINET_DB_API_KEY=xxxx node data/scheduler/quality-jp.mjs
```

## 注意点

- **EDINET DB の USGAAP filer（例: コマツ 6301.T）は `gross_profit` が異常値**になるため、
  `src/edinet-normalize.js` が `accounting_standard === 'USGAAP'` の場合 `grossProfit=null` に変換する。
- JP バッチは `marketCap` を渡さないため `altmanZ` は null になる（許容）。
- FMP の新キーは `/stable/` エンドポイントのみ有効（v3 legacy は 401）。
- フロントからの取得は Worker 経由（`/fmp` `/edgar` `/edinet-db`）でキーを隠蔽するが、
  本バッチは手元実行のため直接 API を叩く（キーは環境変数 / gitignore 設定から読む）。

## 毎日の PER（GitHub Actions・並行運転中・#652 PR2）

`.github/workflows/per-daily.yml` が毎日 **計算のみ**（`--write` なし）で PER を算出し、Mulmo の確定値と自動で突き合わせる。
この段階では `data/valuations.json` を書き換えない（書き込みへの切り替えは 3 日連続一致の後・PR3）。

| ファイル | 内容 |
|---|---|
| `watchlist-per.mjs` | `valuations` の全銘柄の実績PER を Worker `/yahoo` から取得し、バンド内%タイルと status を計算（原本＝Mulmo ワークスペース版の移植・計算は不変）。`--out <file>` / `--write` / 銘柄指定 |
| `fund-per.mjs` | `fund-holdings.json`（ひふみ上位10・公開開示）の加重実績PER と coverage。`--out <file>` / `--write` |
| `fund-holdings.json` | ファンドの上位10銘柄（月次レポートの公開情報） |
| `per-compare.mjs` | shadow の結果と Mulmo の確定コミットの `valuations.json` を突き合わせ（`match` / `band-changed` / `mismatch-input` / `mismatch-logic` / `one-side-skip`） |
| `lib/per-calc.mjs` / `lib/json-format.mjs` / `lib/per-compare.mjs` | 純関数（`tests/per-calc.test.js` ほか） |

- 20:15 UTC `shadow`：計算 → artifact `per-shadow-<UTC日付>`（保持 7 日）。
- 01:30 UTC `compare`：前日 UTC 日付の artifact と突き合わせ → トラッキング Issue（ラベル `per-shadow`）に連続一致日数を記録、不一致日は差分表をコメント。
- 手元での確認（キー不要・書き込まない）：`node data/scheduler/watchlist-per.mjs --out /tmp/w.json AAPL`
