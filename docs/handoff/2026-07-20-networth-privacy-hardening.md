# ハンドオフ設計書：ネットワース系データのプライバシー・ハードニング

- 起票: Mulmo（設計） 2026-07-20
- 実装: VS Code
- 優先度: **P0（セキュリティ）**
- 関連: #577 系 / `data/mf-holdings.json` / `data/real-assets/` / `worker/`

## 実装ログ（VS Code が更新 / クローズは Mulmo 盤面モニタ）
- ステータス: **S1:dispatched**
- [ ] 着手 YYYY-MM-DD / branch: ______  ← 着手時に #589 へ `S2:in-progress` 付与＋着手コメント
- [ ] PR #____ open / CI: ______        ← PR open 時に `S3:in-review` 付与
- [ ] マージ YYYY-MM-DD
- [ ] （Mulmo）完了スタンプ＋pm-queue 記録＋#589 クローズ

> 実装 PR は `Closes #589` を**打たない**（`Refs #589`）。force-push は破壊的＝Toshio 事前確認・フルクローンで実行。詳細＝`docs/mulmo-vscode-workflow.md`「実装ステータスの見える化＆クローズ権限」。

## 問題
本リポジトリは **PUBLIC**。アプリはブラウザから `data/*.json` を GitHub Pages 経由で直接 fetch する設計のため、これらのファイルは公開配信される。ここに個人の財務・PII（純資産、負債の金融機関名・残高、不動産の物件情報・所在・賃料・在不在状況）が含まれており、公開状態は不適切。
※ GitHub Pro で private 化しても Pages サイト自体は公開のままで解決しない（サイト非公開は Enterprise 必要）。アプリが Pages URL を fetch する構造上、データは公開ファイルに置けない。

## ゴール
機微な財務/PII データを公開 Pages 配信から外し、PIN 認証 Worker(KV) 経由に移す（`positions` と同方式）。既に公開済みのファイルは削除し、git 履歴からもパージする。

## スコープ

### Phase 1（緊急・P0）
1. 公開リポから機微データを削除:
   - `data/real-assets/*.json` をリポジトリから削除。
   - `data/mf-holdings.json` から `liabilities` / `totals.liabilitiesTotal` / `totals.realAssetsTotal` / `totals.netWorthComputed` を除去。
   - 該当コミット（機微データ投入分）を対象に `git filter-repo`（or BFG）で **履歴のブロブをパージ** → force-push。※ main 保護の一時解除が要る場合あり。**破壊的操作＝実行前に Toshio 確認**（CLAUDE.md「確認してから実行」該当）。
2. アプリは機微データ欠如時に degrade（ネットワース3層は「非公開データ・未取得」表示）。既存の v4 degrade 経路を流用。

### Phase 2（本対応）
3. Worker に PIN 認証ルート `GET/PUT /networth`（KV）を新設し、mf-holdings 相当＋負債＋実物資産を KV で保持・配信。
4. `src/networth.js` は公開 `data/mf-holdings.json` ではなく Worker `/networth`（認証付き）から取得。
5. MF 取り込みパイプライン（`fetch_mf.py` / A'）は公開リポにコミットせず Worker 経由で KV に書く。実物資産の手入力正本も KV / 非公開ストアに移す。

## 受け入れ条件
1. 公開 URL（Pages・raw 両方）から負債内訳・不動産PII・純資産が取得できない。
2. git 履歴からも該当データが復元できない。
3. ネットワース表示は認証後にのみ機微データを出す（未認証/公開では非表示 or 総額のみ）。
4. 運用アロケーション（既存 #577 AC3）は不変。

## 注意
- 本 doc には具体的な金融機関名・残高・住所を **記載しない**（公開 doc のため）。実データは Mulmo 側メモリ参照。
- dispatch は Toshio が VS Code を起動して渡す（設計▶実装は一方通行）。
