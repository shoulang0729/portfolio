# Mulmo ▶ VS Code 開発フロー（このリポジトリの作り方）

このドキュメントは **VS Code 上の AI コーディングエージェント（Claude Code 等）が最初に読む** ためのものです。
このリポジトリ（portfolio アプリ）が「誰の指示で・どういう流れで」開発されているかを説明します。

---

## 登場人物

- **Mulmo（MulmoClaude）** = オーナー Toshio の手元で動く上流アシスタント。
  要件整理・調査・設計・実装方針の決定を担当する「設計者」。コードは原則書かない。
  知識ベース（Wiki／メモリ）と投資システムの全体像を持っている。
- **VS Code のエージェント（あなた）** = 下流の「実装者」。
  Mulmo が作った設計書・指示書を受け取り、実際のコーディング・git 操作・テスト・デバッグを担当する。

## 基本原則：設計 ▶ 実装は一方通行

```
Toshio → Mulmo（設計・指示書）→ VS Code（実装）→ PR → Toshio レビュー
```

- 流れは **設計 ▶ 実装の一方向**。あなた（実装者）が設計そのものを勝手に変えない。
- 実装中に「設計を変えた方がいい」と気づいたら、**自己判断で変更せず一旦手を止めて報告**する。
  設計変更は Mulmo に戻して指示書を更新し、新版を受け取ってから再開する（これがドリフト防止の要）。
- あなたの成果物は **差分（PR）**。Toshio が差分を目視レビューして取り込む。

---

## 最初に読むもの（この順番で）

1. **その回の指示書** — `docs/handoff/<YYYY-MM-DD>-<feature-slug>.md`
   そのタスク専用のエントリポイント。背景・対象ファイル・手順・受け入れ条件・触ってはいけない範囲が書いてある。
2. **リポの常設ルール（毎回必読）**
   - `CLAUDE.md` — プロジェクト規約・エージェント向け運用ルール
   - `.claude/codex-review-prompt.md` — レビュー観点
3. **触る範囲の正本**（指示書が都度指定する）
   - 例: Briefing → `docs/briefing-generation-spec.md` / MF 取り込み → `mf-import-config.json` の `schema`

## 守ること（要点・詳細は CLAUDE.md / AGENTS.md）

- **1 Task = 1 ブランチ = 1 PR = 1 Issue**。ベースは必ず `main`、push 前に `git pull --rebase`。
- **squash マージのみ＋ブランチ auto-delete**。feature ブランチは残さない。
- バージョン: `index.html` の `?v=YYYYMMDDX` を CSS / JS / SW 全部揃えて bump。`dist/app.js` は CI 自動ビルド（手 commit 不可）。
- 品質ゲートを green に: `vitest` / `eslint` / `prettier` / `check:types` / `check:circular` / `e2e`。
- data-action 委譲・`escapeHTML` 必須・色は CSS 変数のみ・`!important` 禁止。
- **`assets/*.css` に `prettier --write` を掛けない**（全体再整形で巨大 diff 化する）。
- load-bearing なフィールド名は変更しない（例: mf-holdings の `cat` / `cur` / `value` / `totals.imported` / `asOf`）。
- 勝手にやらない（要確認）: force push / `reset --hard` / main 削除 / Secrets / `CLAUDE.md` / `.claude` 設定 / ワークフロー大改修。

## Mulmo ↔ VS Code のやり取りチャネル原則

**「生き続けるもの → docs / 消費されるもの → Issue」**

| チャネル | 寿命 | 使う場面 |
|---|---|---|
| `docs/` のMarkdownファイル | 永続 | アーキテクチャ・設計制約・API仕様・調査結果の長期参照 |
| GitHub Issue | 完了で閉じる | 調査依頼・実装タスク・バグ報告・「やること」の依頼と完了確認 |

**運用パターン:**

1. Mulmo が `docs/` に設計コンテキスト（背景・方針・制約）を書く
2. Mulmo が Issue を起票し、関連 doc へリンク（「背景は doc 参照」）
3. VS Code が Issue コメントに調査結果・完了報告を書いて Issue をクローズ
4. 結果を長期参照したい場合のみ doc に転記

**やりがちなアンチパターン:**

- 仕様書に調査依頼と結果記入欄を同居させる → 完了が見えない・PR との連携ができない
- すべてを Issue のコメントで済ませる → 設計の背景が流れて消える

---

## 困ったとき

- 指示書と既存コードが矛盾する、正本が見つからない、設計判断が要る → **止めて Toshio に確認**。
  推測で実装を進めて PR を膨らませない。
