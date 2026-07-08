# PM 要対応キュー

> Mulmo の設計レーン（read-only PM盤面モニタ）が拾った「要対応」項目を時系列で記録する。
> CI red で滞留中のPR・長期オープンの設計依存Issue・設計差し戻し（VS Code が Issue/PR コメントで設計矛盾を報告）を surfacing する場所。
> **判断が要るものは Toshio に委ねる**（Mulmo は勝手に設計変更しない）。コードPRのマージ・コード編集はしない。

---

## 2026-06-28（PM盤面モニタ）

**🔴 設計差し戻し / CI red**：なし（open PR は #516 auto-fix のみ・CI checks 未設定／green 扱い）。

**🟠 要判断（Toshio）**：デザイン統一 umbrella **Issue#515**（段階ロールアウト P1-P5）が **P1 のみ実装（PR#517）の時点で close 済**。残 P2-P5（カード/見出し・ピル/チップ/バッジ・表/配色・型スケール）の継続を **別Issue 起票で追跡するか** 要確認。→ Mulmo は勝手に設計変更しない。残フェーズを進めるなら handoff `2026-06-26-design-system-unification.md` §7 の P2 から新Issueを立てて VS Code に渡す。

**✅ 完了スタンプ（設計正本に反映・本docs PR）**
- デザイン統一 P1 トークン導入（非破壊）（PR#517 / Issue#515・2026-06-27）→ handoff `2026-06-26-design-system-unification.md` §7、Wiki upgrade-plan に「デザイン統一スプリント」節を新設。

**🟡 監視中**：Wait バックログ6件（#367/#306/#305/#304/#301/#220）変化なし。#516 は daily-issues 自動PR＝コード取り込みは VS Code owner（Mulmo は触らない）。

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

---

## 2026-06-29（PM盤面モニタ）

**🔴 設計差し戻し / CI red**：なし（open PR ゼロ・CI red なし）。

**✅ 完了スタンプ（設計正本に反映・Mulmo docs PR）**
- デザインシステム統一 **P2-P5 全完了**（PR#519/#520/#521/#522・Closes #515）→ handoff `2026-06-26-design-system-unification.md` §7。umbrella #515 close 済＝段階ロールアウト P1-P5 完結。
- レスポンシブ・レイアウト **R1-R3 全完了**（PR#526/#527/#528・Closes #525）→ handoff `2026-06-28-responsive-layout.md` §4。
- アクティブ投信バリュエーション **P3 完了**（PR#532・Closes #530）＝Value タブが fund-monthly PER を proxy より優先消費（ひふみ本体表示）→ handoff `2026-06-28-active-fund-valuation.md` §6。
- Wiki `investment-system-upgrade-plan.md` 後続スプリント節に上記を追記。

**✅ 前回要判断の解決**
- 2026-06-28 の要判断「umbrella #515 close後、残P2-P5を別Issue起票するか」→ **別Issue不要**で解決。VS Code 側が umbrella #515 を再オープンせず P2-P5 を直接実装し、P5（#522）で close。追跡の漏れなし。

**🟡 監視中**：Wait バックログ6件（#367/#306/#305/#304/#301/#220）変化なし。タブ順入替＋表示名 Value→Valuation（PR#524/#523・handoff無しの軽微UI）はマージ済・要対応なし。新規の要判断項目なし。

---

## 2026-07-07（PM盤面モニタ）

**🔴 設計差し戻し / CI red**：なし（open PR は #543 auto-fix のみ・CI green）。

**🟠 要対応（Mulmo設計レーン・Toshio確認）**
- **Briefing 生成ドリフト（Issue#540・#538 の根本原因）**：VS Code → Mulmo 申し送り。トレンド表のセル生成が レイアウトリファレンス（`docs/handoff/assets/2026-06-25-briefing-layout-reference.html`）から乖離（`.perf`→`.mkt`・短値→長文で overflow）。**アプリ側は PR#539 で防御済み・Issue はクローズ済**だが、根治は **Mulmo 側の Briefing 生成プロンプト（briefing skill / spec）をリファレンス準拠に是正**すること。→ 次回 briefing 生成前に skill/spec のトレンド表セル仕様を確認・是正するか Toshio 判断。**コードには触れない。**

**✅ 完了スタンプ（設計正本に反映・Mulmo docs PR）**
- Risk 集中度の一貫化 **①最大集中カードのテーマ別キャップ統一**（PR#547 / Issue#544）＋**②③テーマ集中(strict)/地域ホーム偏り(lenient)のレンズ分離統一**（PR#548 / Issue#545）→ handoff `2026-07-06-risk-concentration-coherence.md` に実装完了スタンプ。日本ホーム許容の警告閾値＝総資産35%（本人確認済み）。
- 保有の単一ソース化（mf-holdings → ヒートマップ自動反映・PR#542 / Issue#534）→ handoff `2026-06-29-mf-holdings-as-holdings-source.md` に実装完了スタンプ。SpaceX/NLR 手動追加を廃止。
- Wiki `investment-system-upgrade-plan.md` に「Risk 集中度の一貫化」「保有の単一ソース化」節を追記。
- 補記：PR#541（実装者は元Issue コメントで報告する規約追記）・PR#539（Briefing トレンド表 overflow 解消）もマージ済。

**🟡 監視中**：Wait バックログ6件（#367/#306/#305/#304/#301/#220）変化なし。#220 は20日超未更新だが `Wait` 付き意図的バックログ＝要対応ではない。open PR #543 は auto-fix（取り込み owner=VS Code）。

---

## 2026-07-08（PM盤面モニタ）

**🔴 設計差し戻し / CI red**：なし（open PR は #555 auto-fix〔checks なし〕・#539 Briefing 修正〔CI green〕のみ）。

**🟠 要判断（Mulmo設計レーン・Toshio 確認）**
- **themeCaps 値の再設計が設計正本なしでマージ（Issue#546 / PR#553）**：ドローダウン寄与法・コア3テーマで cap 値を見直し（日本フォーカス/半導体 cap=13% 等）。直前の2レンズ handoff（`2026-07-07-risk-two-lens-redesign.md`）は「cap 値は触ってはいけない」前提だったが、**cap 値そのものの再設計が別途実施**された。cap 値＝集中トリムの閾値＝**投資方針判断**なので、①ドローダウン寄与法の妥当性・②コア3テーマの選定・③各 cap 値を Mulmo 設計正本で事後追認/正本化するか、Toshio 判断。実装は完了・CI green・矛盾報告なし＝緊急ではないが、方針の物差しなので追認しておきたい。

**✅ 完了スタンプ（設計正本に反映・Mulmo docs PR）**
- Risk 集中表示 **2レンズ並置リデザイン＋テーマ改称「日本フォーカス」**（PR#551 / Issue#550）＋**表示ポリッシュ**（PR#554 / Issue#552）→ handoff `2026-07-07-risk-two-lens-redesign.md` に実装完了スタンプ。テーマ集中(赤・vs cap)と国ホーム偏り(緑・28%・許容35%)を同格並置＝%単独での日本比率誤読を解消。
- themeCaps 値の再設計（PR#553 / Issue#546）も同 handoff に関連実装として記録（追認は上記 要判断）。
- Wiki `investment-system-upgrade-plan.md` に上記3件を追記。

**🟡 監視中**：Wait バックログ6件（#367/#306/#305/#304/#301/#220）変化なし＝いずれも `Wait` 付き意図的バックログ（要対応ではない）。#367 は17日・#306/#305/#304/#301 は26日・#220 は31日未更新。open PR #555 は auto-fix（取り込み owner=VS Code）。

**✅ 前回未処理の解決（Briefing 生成ドリフト・Issue#540 根治）**
- 7/06 申し送りの根治＝**Mulmo 側 生成プロンプトのリファレンス準拠是正を完了**（Toshio 指示で着手）。切り分け結果：
  - **`briefing` SKILL.md line 82＝既に是正済み**（§2 は `table.perf` 明示・`.mkt` を §2 で使わない・#538/#540 明記）。追加変更不要。
  - **`briefing-generation-spec.md` §2＝地合い表の構造/class が未指定でドリフトの余地があった** → **§2 に「地合い表は必ず `table.perf`（地合い/直近/水準・短値のみ）・長い散文は表外 `.movers`・§2 で `table.mkt` を使わない（#538/#540）」を明文化＋自己点検チェックリストに1項目追加**（本 PR）。
- これで レイアウト正本（spec）と生成プロンプト（SKILL）が両方リファレンス準拠に揃い、`.mkt` 誤用による overflow の再発を生成側でブロック。アプリ側（PR#539）と合わせ二重防御。**根治完了・監視終了。**
