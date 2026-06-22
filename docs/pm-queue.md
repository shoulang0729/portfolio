# PM 要対応キュー

> Mulmo の設計レーン（read-only PM盤面モニタ）が拾った「要対応」項目を時系列で記録する。
> CI red で滞留中のPR・長期オープンの設計依存Issue・設計差し戻し（VS Code が Issue/PR コメントで設計矛盾を報告）を surfacing する場所。
> **判断が要るものは Toshio に委ねる**（Mulmo は勝手に設計変更しない）。コードPRのマージ・コード編集はしない。

---

## 2026-06-22（初回ベースライン）

**🔴 設計差し戻し / CI red**：なし。

**🟡 監視中（Wait ラベル・意図的バックログ・判断不要）**
- #367 ソースコードレビュー（脆弱性・矛盾・高度化提案） — `security,bug,enhancement,Wait`
- #306 refactor: Cloudflare Worker を route/service/provider 単位に分割 — `Wait,hard,refactor`
- #305 feat: ETF/投信の look-through 構成銘柄取得パイプラインを実データ化（=B2系） — `enhancement,Wait,hard`
- #304 feat: Target Allocation とリバランス提案（=能動target・案B） — `enhancement,Wait,hard`
- #301 feat: Portfolio Timeline スナップショット履歴と変化分析 — `enhancement,Wait,hard`
- #220 [Risk Exposure] サマリーバー「対象N銘柄」を look-through 構成銘柄数に — `enhancement,Wait,hard`
  - いずれも `Wait` 付き＝着手保留中の設計依存バックログ。緊急度なし。次フェーズ（D-6 案B / B2 look-through 実データ化）の検討対象。

**ℹ️ 自動運用（対応不要）**
- #455 [Auto] Daily issues fix 2026-06-21 — `daily-issues.yml` 自動生成PR。取り込み owner=VS Code。
