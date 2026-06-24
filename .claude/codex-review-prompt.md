あなたはこのリポジトリのコードレビュアーです。以下の観点で `src/` 以下の JS ファイルをレビューし、問題点を JSON 形式で出力してください。

## プロジェクト概要

Finnhub API + Yahoo Finance API を使ったポートフォリオ可視化 Web アプリ（バニラ JS + D3.js）。
Cloudflare Worker がバックエンドプロキシ。PIN/パスキー認証あり。IndexedDB でキャッシュ。

## レビュー観点（優先度順）

1. **bug** — null 参照・未定義アクセス・NaN 伝播・race condition・非同期エラー処理漏れ
2. **security** — XSS（innerHTML への未エスケープ展開）・APIキー露出・CSRF リスク
3. **performance** — 不要な再描画・N+1 的な処理・同期ブロック・メモリリーク
4. **ux** — モバイル対応不備・aria 属性漏れ・エラーが無音でユーザーに伝わらない
5. **quality** — デッドコード・重複ロジック・設計規約違反

## 除外対象

- `src/_disabled/` — 無効化中コード
- `dist/` — 自動生成バンドル
- テストコードの問題（テストは別途対応）
- すでに修正済みの既知バグ（escapeHTML 適用済み箇所など）

## 設計規約（違反をチェックする）

- `innerHTML` へのユーザー入力展開は必ず `escapeHTML()` を通す
- `document.getElementById(...)` の戻り値は null チェック必須
- API キーはフロントに書かない（Worker 経由のみ）
- `data-action` イベント委譲を使う（インライン `onclick=` 禁止）
- CSS 変数以外のハードコード hex 禁止

## 出力スキーマ（中間表現）

各指摘を以下の形で表現する（この JSON が Issue 化の元データ。最終的に下記「実行手順」で Issue にする）。

```
{
  "title": "[カテゴリ]: [ファイル名] [具体的な問題]",
  "priority": "high | medium | low",
  "category": "bug | security | performance | ux | quality",
  "file": "src/example.js",
  "line": 123,
  "body": "## 問題\n[何が・なぜ問題か。影響/再現を1〜2行]\n\n## 該当\nsrc/example.js:123 のコード片\n\n## 提案\n[最小修正の方針]",
  "labels": ["bug", "medium", "codex-review"]
}
```

### ラベルの付け方（**実在ラベルのみ**・存在しないラベルは付けない）

- **カテゴリ→ラベル**: `bug`→`bug` / `security`→`security` / `performance`→`perf` / `ux`→`enhancement` / `quality`→`refactor`
- **難易度**（必須・1つ）: `easy`（30分〜2h）/ `medium`（半日〜1日）/ `hard`（複数日・要調査）
- **全件に必ず `codex-review` を付ける**（起票分を束ねて triage するため）
- `priority`（high/medium/low）は**難易度とは別物**。並び順・トリアージ用でラベルにはしない

## 実行手順（Issue 化まで Codex が行う）

1. **重複チェック**: 先に `gh issue list --state open --limit 50` を確認し、**既出の指摘は新規起票しない**。
   - 特に #367 は「ソースレビュー: 脆弱性・矛盾」の常設バケット。同種の既知指摘はそこへ**コメント追記**で足し、Issue を乱発しない。
2. **起票対象は `priority` が high / medium のみ**。low は起票せず、最後のサマリに列挙するだけ。
3. 各対象を `gh issue create --title <title> --body <body> --label <labels>` で起票（ラベルは上記マッピング＋ `codex-review`）。
4. **最後に必ずサマリを出力**（人が一覧できる形・コミュニケーションの起点）:

   ```
   ## Codex レビュー結果（YYYY-MM-DD）
   対象: src/ 配下 N ファイル / 指摘 M 件（起票 X 件・low 据置 Y 件）

   | # / 状態 | pri | cat | file:line | title |
   |---|---|---|---|---|
   | #NNN | high | security | src/a.js:12 | ... |
   | (low据置) | low | quality | src/b.js:5 | ... |
   | (既出#367へ追記) | med | bug | src/c.js:3 | ... |
   ```

- 根拠のある問題のみ。推測・スタイル好みは含めない。確信が持てない指摘は priority=low に落とす
- 最大 20 件。high → medium → low の順
- `body` の該当箇所は `file:line` を明記（Opus が追跡できるように）

> このサマリ表を Opus に貼れば、`codex-review` ラベルで対応要否を判断し、不要なものは duplicate / wontfix で閉じる（CLAUDE.md の運用どおり「有用な指摘のみ着手」）。
