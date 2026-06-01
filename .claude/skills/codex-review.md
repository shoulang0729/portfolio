# Codex コードレビュー → Issue 化スキル

ユーザーが `/codex-review` を実行したとき、または「コードレビューして」「Codex でレビュー」などと指示したときに、このスキルを実行する。

## 概要

Codex CLI (`codex exec review`) でソースコードをレビューし、発見事項を GitHub Issue として登録する。
Codex が使用量制限に達した場合は Claude Code（自分）が直接レビューを実施する。

---

## 実行手順

### Step 1: 既存 Open Issues を取得

```bash
gh issue list --state open --limit 100 --json number,title > /tmp/open-issues.json
```

重複登録を防ぐために使用する。

### Step 2: Codex でレビュー実行

```bash
codex exec review --config 'sandbox_permissions=["disk-full-read-access"]' \
  "$(cat .claude/codex-review-prompt.md)"
```

**失敗した場合（usage limit・エラー）**: Claude Code が `.claude/codex-review-prompt.md` の観点に従って直接レビューを実施する。

### Step 3: 出力をパース

Codex（または自分）の出力から、以下の JSON 配列を抽出する:

```json
[
  {
    "title": "bug: getElementById に null チェックが漏れている",
    "priority": "high",
    "category": "bug",
    "file": "src/app.js",
    "line": 42,
    "body": "## 問題\n...\n## 提案\n...",
    "labels": ["bug", "medium"]
  }
]
```

JSON が不完全な場合はテキストを解析して同等の構造を作る。

### Step 4: 重複チェック

各 finding のタイトルを `/tmp/open-issues.json` の既存 Issue タイトルと比較し、類似度が高いものはスキップする（同じファイル・同じ問題の場合）。

### Step 5: Issue 登録

優先度 high → medium → low の順に `gh issue create` で登録する。

```bash
gh issue create \
  --title "<title>" \
  --body "<body>" \
  --label "<labels>"
```

### Step 6: 結果サマリー

登録した Issue の一覧（番号・タイトル・優先度）をユーザーに報告する。

---

## スコープ（引数なしのデフォルト）

- **対象**: `src/` 以下の全 JS ファイル
- **除外**: `src/_disabled/`, `dist/`, `tests/`, `e2e/`
- **引数あり**: 指定されたファイルまたはディレクトリのみ対象

## ラベル選択ガイド

| カテゴリ | ラベル |
|----------|--------|
| バグ・クラッシュ | `bug` + 難易度 |
| セキュリティ (XSS等) | `bug`, `security` |
| パフォーマンス | `perf` + 難易度 |
| リファクタリング | `refactor` + 難易度 |
| UI/アクセシビリティ | `enhancement` + `needs-ui-review` |
| 軽微な改善 | `enhancement`, `easy` |
