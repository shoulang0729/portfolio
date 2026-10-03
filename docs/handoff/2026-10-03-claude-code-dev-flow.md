# Claude Code 開発体制への移行（第一次）

## 実装ログ（実装者が更新）
- ステータス: 実装済み・Toshio 確認待ち
- [x] 着手 2026-10-03 / branch: chore/649-claude-code-dev-flow
- [ ] PR #____ open / CI: ______
- [ ] Toshio 確認・マージ YYYY-MM-DD

---

## 1. 背景とゴール
- これまでの開発体制は「設計＝Mulmo（MulmoClaude）／実装＝VS Code（Mac）／取り込み＝VS Code、完了確認＝Mulmo の盤面モニタ」だった（`docs/mulmo-vscode-workflow.md`）。
- **2026-10-03 Toshio 決定**：設計と実装を **Claude Code on the web に一本化**する。76-Club（2026-08-18〜）と同じ型で、設計と実装の分離は **サブエージェントの役割（architect / implementer / reviewer）で保つ**。
- Mulmo は開発から外れる。**Briefing の生成と日次のデータ更新（`data/valuations.json`・`data/briefings/**`）は Mulmo が当面継続**する（データ更新スクリプトの移管は別途「第1.5次」）。
- ゴール：このリポに Claude Code 用の役割定義と `/feature` を置き、CLAUDE.md を新体制に改定し、二重の実装者になる自動修正 bot を止める。**これを Claude Code での最初の一本（試運転）とする。**

## 2. 2026-10-03 の決定事項
- マージ前の確認：**セキュリティ・資産データ・データ構造（＋開発体制ファイル）に触れる PR だけ Toshio が確認**。それ以外は CI green ＋ reviewer 承認で自動マージ。
- 自動修正 bot（`.github/workflows/daily-issues.yml`）：**停止**（Claude Code が実装担当になると実装者が二重になるため。8月以降 #611/#594 を毎日独断で実装し、マージ 0 件だった）。
- #611 と bot PR #645：クローズ済み（前提消滅）。
- mulmo-custom リポも同じ体制に移す（別 Issue）。

## 3. 対象ファイル
| 区分 | パス | 内容 |
|---|---|---|
| 新規 | `.claude/agents/architect.md` | `docs/handoff/assets/2026-10-03-claude-code/architect.md` を**そのまま**配置 |
| 新規 | `.claude/agents/implementer.md` | 同 `implementer.md` をそのまま配置 |
| 新規 | `.claude/agents/reviewer.md` | 同 `reviewer.md` をそのまま配置 |
| 新規 | `.claude/commands/feature.md` | 同 `feature.md` をそのまま配置 |
| 変更 | `CLAUDE.md` | 下記 4.2 |
| 削除 | `.github/workflows/daily-issues.yml` | bot 停止 |
| 新規 | GitHub ラベル `needs-toshio` | reviewer が Toshio 確認待ちに付ける |

## 4. 変更手順
### 4.1 役割定義の配置
`docs/handoff/assets/2026-10-03-claude-code/` の4ファイルを上表のとおり `.claude/` 配下にコピーする。**文面は変えない**（変えたい点があれば PR 本文に提案として書く）。

### 4.2 CLAUDE.md の改定
1. 3行目の「開発フロー（必読）」注記を次に差し替える：
   `> **開発フロー（必読）**: このリポは Claude Code が 設計（architect）→ 実装（implementer）→ レビュー（reviewer）で開発します。着手前に本ファイル「開発フロー（Claude Code・2026-10-03〜）」節を読んでください。`
2. `docs/handoff/assets/2026-10-03-claude-code/CLAUDE-dev-flow-section.md` の本文を、**「## プロジェクト概要」の直前**に節としてそのまま挿入する。
3. 「## Claude Code 自律実行ルール」の表：
   - 「自動 PR」行を削除する。
   - 「PR 操作」行を「PR を作成する。マージは reviewer が『マージ前の確認』に従って行う」に変える。
   - 「Worker デプロイ」行を「クラウド環境からは実行しない。マージ後に Toshio が Mac で deploy する（reviewer が報告）」に変える。
4. 「### 並列起動時の必須ルール」の 2 を「**1 Task = 1 ブランチ = 1 PR = 1 Issue**。実装 PR は `Closes #XX`（同じ Issue を複数 PR で分割する場合は最後の PR のみ `Closes`、他は `Refs`）」に変える（Mulmo 盤面モニタがクローズする旧ルールの撤廃）。
5. 「### テスト」の `daily-issues.yml` の行を削除する。
6. それ以外の節（プロジェクト概要・データソース・設計規約など）は**今回は変えない**（古い記述の棚卸しは別 Issue）。

### 4.3 bot の停止
`.github/workflows/daily-issues.yml` を削除する。

### 4.4 ラベル
`needs-toshio`（色は任意・説明「Toshio のマージ前確認待ち」）を作成する。

## 5. 受け入れ条件
- [ ] `.claude/agents/` に3ファイル、`.claude/commands/feature.md` が存在し、assets と内容が一致する。
- [ ] CLAUDE.md に「開発フロー（Claude Code・2026-10-03〜）」節があり、4.2 の 1・3・4・5 が反映されている。
- [ ] CLAUDE.md に「Mulmo 盤面モニタがクローズする」「VS Code が実装」「`daily-issues.yml` の自動 PR をマージする」趣旨の記述が残っていない（`docs/` 配下の過去文書は対象外）。
- [ ] `daily-issues.yml` が削除され、GitHub Actions の一覧に出ない。
- [ ] ラベル `needs-toshio` が存在する。
- [ ] 品質ゲート（`npm test` / `npm run lint` / `npm run check:types` / `npm run check:circular`）PASS。
- [ ] **この PR は「開発体制」の変更なので reviewer はマージせず `needs-toshio` を付ける**（Toshio が確認してマージ）。

## 6. 触ってはいけない範囲
- アプリのコード（`src/**`・`assets/**`・`worker/**`・`scripts/**`・`tests/**`・`index.html`）。
- 他のワークフロー（`test.yml`・`e2e.yml`・`build-dist.yml`・`mf-freshness.yml`）。
- `.claude/settings.json`・`.claude/hooks/**`・`.claude/skills/**`・`.claude/codex-review-prompt.md`。
- `data/**`。

## 7. PR 分割
1 PR（関連する体制変更をまとめる）。ブランチ例：`chore/claude-code-dev-flow`。

## 8. 試運転の進め方（Toshio 向け）
1. Claude Code on the web で portfolio リポを開く（76-Club と同じ GitHub 連携）。
2. 「Issue #<この Issue> を実装して」と依頼する（`/feature` はまだ配置前なので使わない）。
3. PR が `needs-toshio` 付きで止まったら、差分を確認してマージする。
4. 以後のお題は `/feature "<やりたいこと>"` で回す。
