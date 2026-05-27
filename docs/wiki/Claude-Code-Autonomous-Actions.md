# Claude Code 自律実行アクション一覧

このプロジェクトで Claude Code が**承認なし**で自律実行してよい操作の一覧です。

---

## 自律実行OK

### コードレビュー対応
- CodeRabbit 等のレビューコメントを読んで修正し、コメントに返信する

### テスト対応
- テストを実行し、失敗があれば修正する
- 対応内容を Issue にコメントする

### PR・ブランチ操作
- PR を作成・マージする
- マージ済みブランチを削除する
- `daily-issues.yml` が自動生成した PR をマージする

### 依存パッケージ
- `npm install <pkg> --save-dev` で devDependency を追加する

### バージョン管理
- `?v=YYYYMMDDX` のバージョン文字列を更新する（リリース定型作業）

### Issue 管理
- Issue を作成・クローズする

### GitHub Actions（軽微な修正）
- タイムアウト値・トリガー条件など軽微な CI 設定の修正

---

## 承認が必要（確認してから実行）

| 操作 | 理由 |
|---|---|
| `git push --force` / `git reset --hard` | 履歴破壊リスク |
| main/master ブランチの削除 | 回復不能 |
| Secrets・認証情報の変更 | セキュリティ影響 |
| `CLAUDE.md` / `.claude/settings.json` の変更 | Claude Code の挙動に直結 |
| GitHub Actions ワークフローの大幅な変更 | CI/CD 全体への影響 |
