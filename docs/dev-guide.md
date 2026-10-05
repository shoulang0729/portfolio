# 開発ガイド（開発ツール・ビルドと配信・よくある作業・並列作業の注意）

> CLAUDE.md から移した詳細（#722・`docs/handoff/2026-10-05-refactor-before-migration.md` §4）。開発フロー・Toshio 確認・データの書き手は [CLAUDE.md](../CLAUDE.md) が正本。設計規約は [docs/design-system.md](./design-system.md)。
> 外部（Mulmo・Actions・Mac）との境目（書く/読むデータ・呼ぶ Worker API・時刻・リポ外からの import）は [docs/interfaces.md](./interfaces.md)。

## 1. 開発ツール

### テスト
```bash
npm test               # vitest 単発実行（CI 相当）
npm run test:watch     # ウォッチモード
npm run test:coverage  # カバレッジレポート生成
```
- テストファイルは `tests/` 以下（例: `tests/fmt.test.js` は `fmtJPYInt`, `fmtPctInt`, `fmtShares`, `escapeHTML`, `getColor` の純関数テスト）
- GitHub Actions `.github/workflows/test.yml` が push/PR 時に自動実行（`npm test` → `npm run lint` → `npm run check:types` → `npm run check:circular` → `npm run build` → `dist/app.js` のサイズ監視）

### リント・フォーマット
```bash
npm run lint        # ESLint（src/ と scripts/）
npm run lint:fix    # 自動修正
npm run format      # Prettier 整形（src/**/*.js と worker/src/**/*.js）
```
- `eslint.config.js`: ESLint v9 flat config
- `.prettierrc`: シングルクォート・印刷幅 120
- 整形の確認: `npx prettier --check 'src/**/*.js' 'worker/src/**/*.js'`
- blame から一括整形を除く: ローカルでは `git config blame.ignoreRevsFile .git-blame-ignore-revs`（GitHub の blame は自動で無視する）
- `assets/*.css` に `prettier --write` を掛けない

### 型チェック
```bash
npm run check:types  # tsc --noEmit（opt-in 方式、// @ts-check 付きファイルのみ）
```

### E2E テスト
```bash
# 初回のみ: Playwright ブラウザのインストール
npx playwright install --with-deps chromium
# または
npm run test:e2e:setup

npm run test:e2e     # Playwright（chromium・http-server で配信）
```
- テストは `e2e/`。CI は `.github/workflows/e2e.yml`（push/PR）。クラウドのセッションでは CI で確認する。

### 循環参照検出
```bash
npm run check:circular  # madge
```

### 未使用依存検出
```bash
npm run check:deps  # depcheck（false positive は .depcheckrc.json で除外）
```

### ビルド
```bash
npm run build        # esbuild でバンドル（D3 は external として除外）
npm run build:watch  # ウォッチモード
```
- `src/app.js` を入口に esbuild で `dist/app.js`（ESM 1 本）にまとめる
- D3.js は esbuild の external 指定（バンドルに含めない）。`index.html` が CDN から読む（cdnjs → jsdelivr → bootcdn の順にフォールバック）

## 2. ビルドと配信・バージョン

- GitHub Pages は main のルートから配信する。`index.html` は `dist/app.js` と D3（CDN）だけを読む。
- `dist/app.js` は main への push で `.github/workflows/build-dist.yml` が自動ビルドしてコミットする。**PR に `dist/app.js` を含めない**（手でコミットしない）。
- CI（`test.yml`）が `dist/app.js` のサイズを監視している（上限はワークフロー内の `BLOAT_GUARD_LIMIT`）。

### バージョンを上げる
`src/**`・`assets/**`・`index.html` を変えたら、`index.html` 内の `?v=YYYYMMDDX` を新しい値に全置換する。CSS・JS・SW 登録 URL（`./sw.js?v=...`）合わせて全箇所を同じ値に揃える。
- **命名規則**: `?v=YYYYMMDDX`。英字は同日複数リリース時に a, b, c… → … → z → A, B, C… と順に振る。
- `sw.js` の `CACHE` 名は SW 登録 URL の `?v=` から自動生成されるため、`sw.js` 本体の更新は不要（Issue#15 対応）。
- 現在の値は `index.html` を見る（CLAUDE.md には書かない）。

## 3. データ取得の仕組み（価格）

### Finnhub（優先）
- APIキー: Cloudflare Worker Secret `FINNHUB_API_KEY`（フロントには露出しない・Worker の `/finnhub` が中継）
- シンボル変換: `toFinnhubSymbol(ySymbol)` — `9983.T` → `TYO:9983`、US株はそのまま
- ライブ価格: `fetchFinnhubQuote(fSymbol)` — `dp`（日次騰落率）・`c`（現在値）を返す
- 履歴データ: `fetchFinnhubCandles(fSymbol, fromTs, toTs)` — 日足 OHLCV
- 無料枠: 60リクエスト/分

### Yahoo Finance（フォールバック）
- Finnhub が失敗した場合に自動切り替え（投資信託プロキシなど未収録銘柄向け）
- フォールバック順: Worker経由（`/yahoo`）→ query1直接 → query2直接 → corsproxy.io → allorigins
- `fetchViaProxy(url)`（`src/data-yahoo.js`）経由で取得

### データ取得フロー
```
fetchLivePrice(ySymbol)
  → fetchFinnhubQuote(TYO:XXXX or AAPL)
  → [失敗時] fetchViaProxy(Yahoo Finance chart API)

fetchSymbolHistory(ySymbol, range)
  → fetchFinnhubCandles(TYO:XXXX, fromTs, toTs)
  → [失敗時] fetchViaProxy(Yahoo Finance chart API, range=1y/5y/10y)
```
- 為替レート（USD 建て銘柄の JPY 換算用）は `src/forex.js` が Worker の `/forex` から取得する。

## 4. よくある作業パターン

### 保有銘柄の出どころ
- 保有の単一ソースは `data/mf-holdings.json`（Mac mini の MF 取込が毎日書く・#534）。起動時に `src/holdings-from-mf.js` が positions に変換する。取得できないときは KV（`GET /positions`・PIN 必須）にフォールバックする。
- `data/mf-holdings.json` は手で編集しない（CLAUDE.md「データの書き手」）。`src/positions.js` の `positions` 配列は最後のフォールバックで、保有の更新に使わない。

### 新しいソート列を追加する（統合 Historical タブ）
1. `src/stock-list.js` の `sortHeatItems()` に case を追加（comparator は antisymmetric・null 末尾）
2. `renderHeatmapList()` のテーブルヘッダーに `makeTh('ラベル', 'col-id', 'center', state.heatSortCol, state.heatSortDir, 'heatSort')` を追加
3. 行の `<td data-col="col-id">` を追加（保有専用なら watch 行は `–`）

### Finnhub が取れない銘柄への対処
- `fetchFinnhubQuote` が null を返すと自動で Yahoo Finance にフォールバック
- 東証シンボルで取れない場合は `toFinnhubSymbol` の変換ロジックを確認
- 投資信託は `isProxy: true` + `ySymbol` に代替インデックスを指定して対処（`src/funds.js`）

### 注文表（Order タブ・KV `order:plan`）
- 運用手順（初回投入・約定の反映・見直し・壊れた `order:plan` の復旧）は [docs/order-sheet-ops.md](./order-sheet-ops.md)。plan の実値はリポに置かない（`scripts/order-plan.mjs` はリポ内のファイルを拒否）。

## 5. 並列作業の注意（詳細）

CLAUDE.md「並列作業の注意」の背景。役割（architect / implementer / reviewer）の分担は CLAUDE.md「開発フロー」が正本。

### 並列起動時の必須ルール
1. **ベースブランチは必ず `main`**。他 Agent のブランチをベースにしない（過去事故: 別 Agent のブランチをベースにした結果、元の PR が宙に浮いた）
2. **1 Task = 1 ブランチ = 1 PR = 1 Issue**。実装 PR は `Closes #XX`（同じ Issue を複数 PR で分割する場合は最後の PR のみ `Closes`、他は `Refs`）
3. **push 前に必ず `git pull --rebase origin main`**（コンフリクト解消責任は各 Agent）
4. **動作変更がある Task は CI を待ってからマージ**（E2E は CI でしか実行できない）

### サブエージェントの権限制限への備え
サブエージェントは `gh` / `npm` / `npx` の実行が許可なしで拒否されることがある。
- Agent は実装と commit（環境によっては push）まで完了で OK。PR 作成・マージは親が行う
- Agent への指示書末尾に「権限制限で進めない場合は実装と commit だけ完了させて報告」を明記

### Closes 競合への備え
複数 Agent が同じ Issue を `Closes` で指すと、最初のマージで Issue が close され、後続 PR の `Closes` は no-op になる。
- 同 Issue を分割実装する場合: **最後の PR のみ `Closes`**、他は `Refs`
- 各 Agent に明示的に「あなたの担当範囲はこの Issue だけ」と指示

### E2E fail の段階解消
E2E が CI を blocking すると後続全 PR が止まる。既存バグで E2E が落ち始めたら、根本修正を待たず段階的に解除する。
1. 根本原因を調査し、Issue に記録
2. 修正可能なものは即 PR（例: CSP ホワイトリスト追加）
3. 残りの失敗テストは `test.describe.skip` で一時無効化 + 「skip 解除条件 = Issue #XX」コメント
4. 別 Issue で根本修正、修正完了後に skip 解除

### `?v=` の bump の管理
- bump が必要な Task は同時並列起動しない（順次）
- bump 不要な Task（テスト追加・ドキュメントのみ）は並列 OK
- `dist/app.js` は Build Dist Workflow が作るので手でコミットしない
