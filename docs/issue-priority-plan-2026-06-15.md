# Issue Priority Plan (2026-06-15)

## Scope
Open issues in `shoulang0729/portfolio` were reviewed and prioritized by:
- security impact
- user impact (data loss / auth risk / breakage)
- estimated effort labels (`easy`/`medium`/`hard`)
- current workflow intent (`Wait`)

## Priority Buckets

### P0 (Do now)
- #350: 機密情報の localStorage/sessionStorage 保存を避ける
- #351: Briefing iframe のURL検証とサニタイズを実施する
- #352: デフォルトPINのハードコードを廃止する
- #353: npm audit で脆弱性を棚卸しして解消する
- #354: Workerログの機密情報出力を抑制する

### P1 (Next)
- #344: bug: ウォッチリストの銘柄が全消え → スナップショットから復元待ち
- #336: Briefing 再構成: §1サマリ集約・来週イベント統合・PER保有%タイル表化

### P2 (Planned / Wait)
- #306: Worker 分割リファクタ
- #305: look-through 実データ化
- #304: Target Allocation / リバランス提案
- #301: Portfolio Timeline
- #220: Risk Exposure look-through 改善
- #193: スナップショット自動保存 + 自動分析
- #16: Worker レート制限 perf 調整

## Execution Order (1-3)
1. Stabilize auth baseline: #352, #354
2. Close major security gaps: #350, #351
3. Dependency risk sweep: #353
4. User data resilience: #344
5. Product/UX enhancement: #336

## Operational Notes
- `Wait` labeled issues are intentionally deferred into P2.
- Security-labeled issues are tracked in P0 by default.
- If scope expands, split each P0 into separate PRs to reduce merge risk.
