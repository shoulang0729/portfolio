# ハンドオフ設計書：MF負債スクレイピング＋実物資産レイヤー

- 起票: Mulmo（設計） 2026-07-19
- 実装: VS Code エージェント
- オーナー: Toshio
- 関連: `mf-import-config.json` / `mf-holdings.json` / MF取り込みパイプライン（Claude for Chrome）

---

## 背景・課題

現行のMF取り込みは **資産カテゴリ allowlist のみ** をスクレイプしており、以下が欠落している：

1. **負債（住宅ローン等）が取り込まれていない。** `mf-holdings.json.totals.mfNetWorth`（=649,045,899）は総額のみで、個別ローン残高を保持しない。資産推移 `mf-history.json` の series 12列も全て資産系で **負債列ゼロ**。
2. **不動産が自宅1件しかMFに存在しない。** MF total を分解すると `財務資産561M + 自宅88M` にちょうど一致。**収益物件（レジデンスかかみ野・コンフォール野口）とその借入はMFに未登録** → MFの純資産すら実態を過小評価。

結果、アプリはユーザーの真のバランスシート（レバレッジ・純資産・通貨/金利エクスポージャー）を表示できない。

## 実測データ（2026-07-19 時点・確定分）

| 物件 | 種別 | 評価額 | 出所/確度 | ローン | 金利 | 銀行 |
|---|---|---|---|---|---|---|
| プラウド杉並高井戸サウス103 | 自宅・無収益 | 8,800万 | イエシルAI査定/低 | 残 **30,038,112円** | **1.175% 変動・元金均等** | 三菱UFJ(代々木上原) |
| レジデンスかかみ野 | 収益・賃貸 | 未確定 | 管理会社AI査定/低 | 未確定(2025金利変更あり=変動) | 未確定 | 岐阜(母経由書類) |
| コンフォール野口 | 収益・賃貸 | 未確定 | 管理会社AI査定/低 | 未確定 | 未確定 | 未確定 |

自宅ローン: 当初38,000,000円(2019/2借入・35年)、完済2054/2、次回利息分29,412円/月（年約35.3万）。

---

## スコープ（2本立て）

### A. MF負債スクレイピング（自動・パイプライン拡張）

**目的**: MoneyForward の負債セクションを取り込み、`mf-holdings.json` と `mf-history.json` に負債を反映する。

- **取得元**: `moneyforward.com/bs/portfolio` の負債ブロック（および必要なら `/bs/liability`）。
- **`mf-import-config.json` 拡張**:
  - `include` に負債を扱う新セクション `liabilities: { categories: ["ローン", ...], enabled: true }` を追加（allowlist方式は踏襲）。
  - `liabilityAccountMap`（口座名→物件/用途タグ）を新設。例: MUFG代々木上原→`自宅`。
  - `schema` を version 5 に上げる。
- **`mf-holdings.json` 出力拡張**:
  - 新フィールド `liabilities: [{ institution, name, tag, balance, rate?, rateType?, asOf }]`。
  - `totals` に `liabilitiesTotal` と `netWorthComputed = imported + realAssetsTotal - liabilitiesTotal` を追加（既存 `mfNetWorth` は生値として残す・比較用）。
- **`mf-history.json` 拡張**: series に `liabilities` 列を追加（後方互換: 過去分は null 許容）。
- **注意**: 金利(rate)はMF負債画面に出ない場合がある。出なければ balance のみ取得し、rate は実物資産レイヤー(B)側の手入力を正とする。二重管理を避けるため **rate の正本は B**。

### B. 実物資産レイヤー（手動・コレクション）

**目的**: MFに無い収益物件・不動産評価・確度・エクイティを、運用簿とは分離した参照専用レイヤーで持つ。

- **新コレクション `real-assets`**（`data/real-assets/`）。Mulmo側で schema 作成・レコード投入する（このハンドオフの対象外＝Mulmoが実施）。
- フィールド案: `id, name, type(自宅/収益/更地), value, valuationSource, valuationDate, confidence(高/中/低), loanBalance, loanRate, loanRateType, bank, annualRentGross?, annualRentNet?, equity(derived=value-loanBalance), notes`。
- **アプリ側の要件（VS Code実装）**:
  - ネットワース・ビューで「運用資産 / 実物資産 / 負債」を3層表示。
  - **実物資産・負債は運用アロケーション（リバランス/トリミングの分母）に絶対に含めない**（シグナル汚染防止）。総資産・純資産・通貨/地域ルックスルーの「文脈表示」にのみ使用。
  - AI査定は confidence タグとヘアカット（既定 -10〜20%可変）付きで表示。

## 受け入れ条件（AC）

1. MFの負債が `mf-holdings.json.liabilities` に取り込まれ、`liabilitiesTotal` が算出される。
2. ネットワース・ビューで運用/実物/負債の3層と純資産が表示される。
3. **運用アロケーションの数値（半導体%等）が、実物・負債の追加で一切変化しない**こと（回帰テスト）。
4. `mf-history.json` に負債列が追加され、既存の資産推移チャートが壊れない。

## 非スコープ / 留意

- 不動産の自動査定API連携はやらない（手動・四半期更新）。
- rate の正本は B（手入力）。A では balance のみ。
- 実装中に設計変更が要ると判断したら **手を止めて Mulmo に差し戻す**（ドリフト防止・一方通行）。
