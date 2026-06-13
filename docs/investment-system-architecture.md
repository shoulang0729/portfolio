# 投資システム アーキテクチャ（2026/06 改訂）

MulmoClaude を頭脳とした投資運用システムの設計。本リポジトリ（portfolioアプリ）が担う部分を中心にまとめる。運用の本体は MulmoClaude Wiki `investment-system-architecture.md` を参照。

## 3本柱

| 柱 | 内容 | 本repoの担当 |
|---|---|---|
| 1 データ | Claude for Chrome が MF→`data/mf-holdings.json` を更新 | データ供給元。Heatmap がこれを読む |
| 2 壁打ち | MulmoClaude本体（Telegram/web UI）に一本化 | アプリの旧AI壁打ちタブ(`src/_disabled/`)は復活させない |
| 3 週次 | Mulmoが Briefing(モバイルHTML) を生成・配信 | アプリに「Briefing」タブを新設 |

## 柱1：mf-holdings.json

- ルール: `data/mf-import-config.json`（allowlist＋口座denylist＋現金含む＋チェックサム1%）。
- 出力: `data/mf-holdings.json` = 履歴なしフラット配列（毎回まるごと上書き安全）。
- `portfolio-snapshot.json` は **直接編集しない**（`performance` 履歴が壊れる）。
- 手順書: `docs/routine_mf_discovery.md`（初回口座棚卸し）/ `docs/routine_mf_snapshot.md`（定常）。
- 取込対象4口座（2026/06）: SMBC信託 / マネックス証券 / bitFlyer / ひふみ投信。

### mf-holdings.json スキーマ（例）
```json
{
  "asOf": "ISO8601", "source": "moneyforward/claude-for-chrome", "configVersion": 2,
  "totals": { "mfNetWorth": 0, "imported": 0, "excludedAccounts": 0 },
  "holdings": [
    { "account": "マネックス証券", "cat": "米国株・ETF", "name": "アップル",
      "symbol": "AAPL", "ySymbol": "AAPL", "shares": 186,
      "avgCost": 208.92, "price": 308.33, "value": 9072672, "cur": "USD" }
  ]
}
```

## 柱3：Briefing タブ（実装メモ）

- 置き場所: `data/briefings/YYYY-MM-DD.html`（自己完結モバイルHTML）＋ `data/briefings/index.json`（号の一覧: date/title/path）。
- タブ実装: `tabs.js` に「Briefing」を追加。新モジュールで `index.json` を fetch → 最新号を `<iframe>` で表示 → 下に過去号リンク一覧。
- HTML はアプリ配色（`--accent #cc785c` 等）に合わせ、ライト/ダーク追従。サンプル: MulmoClaude artifacts の briefing-v3。
- 構成（順序確定）: **1 資産サマリ / 2 マクロ / 3 ヘルスチェック / 4 PERアナリシス / 5 メンター / 6 トリガー＆アクション / 7 来週**。`<section id="sN">`・`<b>N</b>`・上部 `.nav` の番号/ラベル/順序は常にこの並びで一致させる。
  - **§1 資産サマリ（#310→拡充）**: 運用資産総額・現預金/暗号資産の内訳行は**載せない**（stats バー／Exposure と重複）。§1 に載せるのは ①キャッシュ比率（後ろの算式カッコ説明は**付けない**）②**運用資産の期間騰落**（1週/1月/3月/1年のミニ表）③**今週の主役 Top3**（値上がり▲／重し▼、保有＋ウォッチから）④Claudeのインサイト。②③は保有＋ウォッチの概算で、`.note` に「週次自動版で算出」と明記。
  - **§2 マクロ**: ドル円・VIX の各期間セルは**実数値（指数水準/レート）で表示**（％ではなく）。セルの色（up=赤/down=緑）は現在値への騰落方向を維持。株価指数は騰落%、債券は bp のまま。
  - **§4 PERアナリシス**: 保有銘柄に加え**ウォッチリスト銘柄も評価対象に含める**（「👁 ウォッチリスト（監視中）」サブ見出しで保有と区別）。
  - **§5 メンター**（旧§3を後方移動）= じっちゃま・中島聡・**ゆな先生・藤沢数希（後者2名はnote、mh-*と同型ingest予定）**。トリガー＆アクションの直前に置く。
- **タブが5個になるため、タブバーをスマホ最適化**（アイコン＋短ラベル、必要なら横スクロール）。
- 生成 = **土曜朝**の MulmoClaude 週次タスク。publish = **ホストにGit push認証(PAT)常設**して無人commit（確定）。

## 廃止・宿題

- 日次2本の Notion ルーティン（`docs/routine_japan_1700.md` / `routine_us_0600.md`）は **廃止**（トークン節約）。PER割高割安ノウハウは Briefing #5 と壁打ちに継承。
- 現金二重計上: `src/manual-assets.js` の現金ハードコードを撤去（mf-holdingsに現金を含めるため）。
- 旧 `portfolio-snapshot.json` 依存の下流（日次ルーティン廃止後の整理、Heatmapのデータ源整理）は段階移行。
