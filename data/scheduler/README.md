# quality 自動供給バッチ（A3）

`valuations.json` の `quality` ブロックを週次で自動更新するバッチ群。
**Mulmo のワークスペース（手元）で実行する**前提。CI では動かさない（API キーを Secrets に置かないため）。

## スクリプト

| ファイル | 対象 | データソース |
|---|---|---|
| `quality-us.mjs` | 米国個別株（ETF 除外） | FMP stable API（優先）→ SEC EDGAR（フォールバック） |
| `quality-jp.mjs` | 日本個別株（`.T`・ETF 除外） | EDINET DB API |

いずれも純関数 `src/quality-calc.js` の `computeQuality()` で指標を算出し、
`data/valuations.json` の該当シンボルの `quality` フィールドだけを上書きする。

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
