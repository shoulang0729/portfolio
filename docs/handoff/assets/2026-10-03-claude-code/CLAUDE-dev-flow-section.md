## 開発フロー（Claude Code・2026-10-03〜）

このリポは **Claude Code が 設計 → 実装 → レビュー を役割の違うサブエージェントで回す**（`.claude/agents/`）。`/feature "<お題>"` で一括実行できる（`.claude/commands/feature.md`）。設計と実装の分離は役割で保つ（2026-07 の公開リポ露出の再発防止策の継続）。

1. **設計（architect）**: 要件を `docs/handoff/YYYY-MM-DD-<slug>.md` に書き、Issue を起票する。アプリのコードは書かない。
2. **実装（implementer）**: Issue と設計書のとおりに 1タスク=1ブランチ=1PR で実装する。設計書は変えない。PR に `Closes #<Issue>`。
3. **レビュー（reviewer）**: 品質ゲート＋差分精査＋公開リポ検査。問題なければ squash マージ。下記「マージ前の確認」の対象はマージせず `needs-toshio` を付けて止める。

### サイズ判定
着手前に PM（親セッション）が判定する。**S**＝見た目のみの小変更で、次のどれにも触れないもの：計算・状態（`state`）・data-action・ソート・データファイル（`data/**`）・KV・Worker・認証・`getColor`/期間スケール・D3 のサイズ計算・タブ/モジュール構成。S は architect を省略し、PM が受け入れ条件つきの簡潔な Issue を書いて implementer に渡す。**迷ったら M/L**（フルパイプライン）。

### マージ前の確認（Toshio）
次に触れる PR は reviewer がマージせず、`needs-toshio` を付けて Toshio の確認を待つ。それ以外は CI green ＋ reviewer 承認で自動マージしてよい。
- **セキュリティ**: `src/auth-*.js`、`worker/**` の認証・レート制限・CORS、PIN/パスキー、Secrets
- **資産データ**: `scripts/fetch_mf*.py`、`src/networth.js`・`src/wealth.js`、`data/real-assets/**`、KV の networth/positions、公開/非公開の境界
- **データ構造**: `data/*.json` のキー・形状、`data/mf-import-config.json` の schema、KV のデータ形状
- **開発体制**: `CLAUDE.md`、`.claude/**`、`.github/workflows/**`

### データの書き手（手で編集しない）
| ファイル | 書き手 |
|---|---|
| `data/mf-holdings.json`・`data/mf-history.json` | Mac mini の MF 取得バッチ（毎日） |
| `data/valuations.json`・`data/briefings/**` | Mulmo の日次バッチ（毎朝 05:00 CST） |
| `data/positions.json`・`data/portfolio-snapshot.json` | Worker（KV 同期・スナップショット） |

- これらは自動で main に直接コミットされる。形状を変える場合は「データ構造」扱い（Toshio 確認）とし、書き手側の対応を設計書に明記する。
- push 前の `git pull --rebase origin main` でこれらと衝突したら、**main 側を採用**する。
- **Briefing**：生成（`data/briefings/**` と `docs/briefing-generation-spec.md`）は Mulmo の担当。アプリの Briefing タブ（表示側）は Claude Code の担当。生成仕様の変更は Issue で提案する。

### クラウドから実行できないもの
- **Worker のデプロイ**：`worker/**` を含む PR がマージされたら、Toshio が Mac で `cd worker && npx wrangler deploy` ＋ curl 検証を行う（reviewer が報告する）。
- **Mac 実機の確認**：`scripts/fetch_mf*.py` など MF へのログインが要る処理は Claude Code では動作確認できない。PR に「Mac 実機確認要」と書き、Mac mini での確認後にマージする。

### 公開リポの原則
このリポは PUBLIC。個人の資産データ（物件・評価額・負債・ネットワース実額・口座情報）と秘密（APIキー・トークン・PIN/ハッシュ値）をコミットしない。テストデータは合成値にする。reviewer は差分ごとに検査する。

### git / gh
- ベースは必ず `main`。push 前に `git pull --rebase origin main`。マージは squash＋ブランチ削除。
- **gh CLI が無い環境（クラウドセッション等）**：Issue/PR/マージは PM（親）が GitHub MCP で代行する。サブエージェントは本文をドラフトファイルで渡し、git は commit まで（push は親）。
- main 直コミットは docs と設計書の「実装ログ」更新のみ。アプリ実装は必ず PR。
