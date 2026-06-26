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

---

## 2026-06-25（PM盤面モニタ）

**🔴 設計差し戻し / CI red**：なし（open PR は #478 auto-fix のみ・statusCheckRollup 空）。

**✅ 完了スタンプ（設計正本に反映）**
- Risk タブ 信号機リデザイン（PR#489 / Issue#488）→ handoff `2026-06-25-risk-traffic-light-redesign.md`
- セクター中央値ベンチマーク本実装（PR#499 / Issue#493）→ handoff `2026-06-24-sector-average-benchmark.md`
- 日本株ファンダ＆セクター中央値本実装（PR#500 / Issue#497）→ VS Code 自己スタンプ済（spike doc）
- Value 詳細 目安ゲージ rev2（PR#477→#495）／MF 堅牢化（PR#486/#487/#491）→ VS Code 自己スタンプ済
- Wiki `investment-system-upgrade-plan.md` に後続スプリント節を追記。

**🟡 監視中**：前回ベースラインの Wait バックログ6件（#367/#306/#305/#304/#301/#220）に変化なし。新規の長期オープンIssue・要判断項目なし。

---

## 2026-06-25（PM盤面モニタ・2回目）

**🔴 設計差し戻し / CI red**：なし（open PR は #478 auto-fix のみ）。

**✅ 完了スタンプ（設計正本に反映・Mulmo docs PR）**
- Risk 信号機リデザイン 仕上げv6（PR#503 / Issue#502）→ handoff `2026-06-25-risk-polish-v6.md`
- Value タブ 仕上げポリッシュ A〜G（PR#505 / Issue#504）→ handoff `2026-06-25-value-tab-polish.md`
- Wiki `investment-system-upgrade-plan.md` の後続スプリント節に2件追記。

**🟡 監視中**：Wait バックログ6件（#367/#306/#305/#304/#301/#220）変化なし。要判断項目なし。

---

## 2026-06-26（PM盤面モニタ）

**🔴 設計差し戻し / CI red**：なし（open PR ゼロ・前回の #478 auto-fix も解消済）。

**✅ 完了スタンプ（設計正本に反映・Mulmo docs PR）**
- Value「詳細指標」トグルをアコーディオン行に（PR#513 / Issue#512）→ handoff `2026-06-25-value-detail-toggle-accordion.md`
- Value 詳細 後始末：凡例二重マーカー＋トグル視認性（PR#508）＋同業中央値破線 gradient 化（PR#511・修正C）/ Issue#507 → handoff `2026-06-25-value-legend-toggle-fix.md`
- Risk 地域カード 円グラフ復活＋アイコン（PR#510 / Issue#509）→ VS Code 自己スタンプ済（`2026-06-25-risk-region-restore.md`）
- Wiki `investment-system-upgrade-plan.md` の後続スプリント節に4件追記。

**🟡 監視中**：Wait バックログ6件（#367/#306/#305/#304/#301/#220）変化なし。要判断項目なし。
