# data/real-assets/ — 実物資産（不動産）レイヤー

不動産の評価額・掛目・紐づくローンを1物件1JSONで持つ、**リポジトリ内の素のデータ**（MulmoClaudeの「コレクション」ではない）。`scripts/fetch_mf.py` の `real_assets_total()` がこのディレクトリの `*.json` を読み、`totals.realAssetsTotal` / `netWorthComputed` を算出する。アプリの Wealth タブ（ネットワース3層）が表示する。

## レコード形状（1物件=1 .json）
| キー | 意味 |
|---|---|
| `id` | ファイル名と一致するslug |
| `name` / `type`(自宅/収益/更地) / `region` | 基本情報 |
| `valueHowMa` | HowMa等のAI査定額（円）。※#580で MoneyForward スクレイプにより自動更新予定 |
| `haircut` | 掛目（都市部/確度中〜高=1.0、地方/確度低=0.65） |
| `annualRentGross` | 年間家賃（表面・収益物件のみ） |
| `loanBank` / `loanBalance` / `loanRate` / `loanRateType` / `loanOrigDate` | 借入 |
| `confidence` / `valuationSource` / `valuationDate` / `notes` | 補足 |

## 計算ルール（fetch_mf.py 側）
- 採用評価額 = `valueHowMa × haircut`（地方AI過大の是正）
- `realAssetsTotal` = Σ 採用評価額
- `netWorthComputed` = `imported`(運用資産) + `realAssetsTotal` − `liabilitiesTotal`
- **★運用アロケーション（リバランス/トリミング）の分母には絶対に含めない**（handoff 2026-07-19 §B）

## 編集
- 掛目・ローン・家賃などの手入力項目は、このJSONを直接編集（Mulmoが管理）。
- `valueHowMa` は #580 実装後は MoneyForward から自動更新（fail-soft: 失敗時は既存値を維持）。
