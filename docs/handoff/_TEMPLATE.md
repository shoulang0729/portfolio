# Handoff: <タイトル>（#<Issue番号>）

- **Issue**: #NNN `<Issueタイトル>`
- **難易度**: easy / medium / hard
- **分担**: 設計＝Mulmo（本 doc）／実装＝VS Code

## 実装ログ（VS Code が更新 / クローズは Mulmo 盤面モニタ）
- ステータス: S1:dispatched
- [ ] 着手 YYYY-MM-DD / branch: ______  ← 着手時に Issue へ `S2:in-progress` 付与＋着手コメント
- [ ] PR #____ open / CI: ______        ← PR open 時に `S3:in-review` 付与
- [ ] マージ YYYY-MM-DD
- [ ] （Mulmo）完了スタンプ＋pm-queue 記録＋Issue クローズ

> 実装 PR は `Closes #NNN` を**打たない**（`Refs #NNN`）。クローズは Mulmo が盤面モニタで完了確認後に実施。詳細＝`docs/mulmo-vscode-workflow.md`「実装ステータスの見える化＆クローズ権限」。

---

## 1. 背景・ゴール
<何を・なぜ>

## 2. 対象ファイル一覧
| ファイル | 状態 | 内容 |
|---|---|---|
| `path` | 新規/変更 | ... |

## 3. 変更手順（ファイル単位）
<ファイルごとの具体指示>

## 4. 受け入れ条件（チェックリスト）
- [ ] 品質ゲート green：vitest / eslint / prettier / check:types / check:circular / e2e
- [ ] `index.html` の `?v=` を全 bump（UI 変更時）
- [ ] data-action 委譲・escapeHTML・色は CSS 変数のみ・`!important` 禁止
- [ ] <期待する画面・データ挙動を1文で>

## 5. 触ってはいけない範囲（load-bearing / 既存挙動）
- <load-bearing フィールド名・DO NOT TOUCH>

## 6. ブランチ / PR / Issue
- ブランチ: `<type>/<slug>`（base=`main`）
- PR: `<title>`
- **`Refs #NNN`**（`Closes` は打たない・クローズは Mulmo）
