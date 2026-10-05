# Handoff: Notion 移管・claude -p 化（#713）の前のリファクタリング計画（段階 1〜5）

- **Issue**: 段階ごとに起票（段階1＝棚卸し／段階2＝CLAUDE.md／段階3＝#705／段階4＝削除／段階5＝#306・#704・#703 ほか）。番号は §実装ログに記入
- **難易度**: 段階1・4＝easy〜medium／段階2・3＝medium／段階5＝hard（Worker 分割）
- **分担**: 設計＝architect（本 doc）／実装＝implementer／レビュー＝reviewer／Worker デプロイ＝Toshio または Mac セッション（Toshio 依頼時）／Secrets の削除＝Toshio
- **区分**: 確定（2026-10-05 Toshio 決定「#713 の前にすっきりさせる・PM 案の順番で進める」）。ただし §9「要 Toshio 判断」は既定値つきの設計案
- **Toshio 確認**: 段階ごとに異なる（§8 の表）。CLAUDE.md・`.github/workflows/**`・`worker/**` の認証/レート制限/CORS・`data/*.json` の形・`.claude/**` に触れる PR は `needs-toshio`

## 実装ログ（implementer が更新）
- [x] 前提: #717 マージ 2440000 / #719 マージ 864ee8a / #708 PR3（#721）マージ 81017f4（§1.3）。Worker デプロイ 2026-10-05（#717 にコメント）
- [x] 段階1 Issue なし（棚卸しは PM がチャットで実施）/ Toshio 判断 2026-10-05（フォーム）/ クローズ・統合の実施 2026-10-05
- [x] 段階2 Issue #722 / 実際の順番は docs 移設が先: PR2a #725（docs/design-system.md・docs/dev-guide.md）マージ 70cab45 / PR2b #726（CLAUDE.md）マージ 5927f37（Toshio 承認）
- [x] 付随: #727 / PR #728（`src/positions.js` のフォールバック保有を合成値に置換）マージ 21a373a（Toshio 承認・旧値の履歴は残す判断）
- [ ] 段階3 #705 / PR3a #____ マージ ____（squash の SHA ______）/ PR3b #____（blame-ignore）／ PR3c #____（CI）
- [ ] 段階4 Issue #____ / PR4a #____ / PR4b #____ / PR4c #____ / PR4d #____ / Secrets 削除（Toshio）____
- [ ] 段階5 Issue #____ / PR5a #____ / PR5b #____ / PR5c #____（#306・デプロイ ____）/ PR5d #____（#704）/ PR5e #____（#703）

---

## 1. 背景・ゴール

### 1.1 背景
- #713（Mulmo の判断と Briefing を `claude -p` の単発ジョブにし、PER のコミットを起動条件にする・Notion 移管の後）で、portfolio と Mulmo の境目が動く。境目を動かす前に、portfolio 側の「書いてあること」と「実際」を揃え、使っていないものを消し、構造を見通しやすくしておく。
- 現状のずれの例（2026-10-05 main 時点）:
  - CLAUDE.md（625 行）の「現在バージョン」は `20260529I` のまま（実際は `index.html` の `?v=20261005b`）。変更履歴表は 2026-05 で止まっている。
  - ディレクトリ構成に `docs/SPEC_cn.md`・`docs/DESIGN.md`（存在しない）が載り、Valuation/Risk/Wealth/Briefing/Order タブや約 60 の `src/*.js` の大半が載っていない。
  - 「スクリプト読込順」は旧来の `<script>` 列挙だが、実際は `src/app.js` を入口に esbuild で `dist/app.js`（ESM 1 本）にまとめ、`index.html` は `dist/app.js` と D3（CDN）だけを読む。
  - Worker のルート一覧に、#711・#716 で 410 にしたルート（`/portfolio/snapshot`・`/ai/{gemini,grok,deepseek,claude,models,context}`・`/notion/save`）が生きているように載る。`/fmp`・`/edgar`・`/edinet-db`・`/networth`・`/etf/constituents` が載っていない。Cron は `0 */6 * * *` と書かれているが実際は `0 1,8,15,22 * * *`（#717 で `20 20,21 * * *` が加わる）。
  - Worker Secrets の列挙に参照されなくなった名前がある。参照中の `FMP_API_KEY`・`EDINET_DB_API_KEY`・`SEC_USER_AGENT`・（#717 以降）`GITHUB_TOKEN`/`GH_DISPATCH_TOKEN` が無い。
  - 「スナップショット機能」節は #711 で撤去済みの機能。データの書き手の表の「`data/positions.json`・`data/portfolio-snapshot.json` ＝ Worker」は #711 以降は誤り（どこからも書かれていない）。
  - 「並列セッション運用」のモデル分担（Haiku/Sonnet/Opus）は 2026-10-03 の役割分担（architect/implementer/reviewer）以前のもの。
- src/・worker/src/ に CRLF と prettier 未整形のファイルがあり（`git ls-files --eol` で `i/crlf` が 29 ファイル。うち src 20・worker/src 1）、各 PR が「既存の警告」と注記し続けている（#705）。
- `worker/src/index.js` は 1,112 行で、プロキシ・KV・認証・注文表・Cron が同居している（#306）。`dist/app.js` は 386,437 B で上限 400,000 B に近い（#704）。

### 1.2 ゴール
1. 開いている Issue を「今やる／後で／閉じる」に仕分ける（段階1）。
2. CLAUDE.md を「短く・正確に」する。詳細は docs へ移し、CLAUDE.md からはリンクだけ（段階2）。
3. 改行コードと整形を一度で揃え、以後 CI で崩れないようにする（段階3）。
4. 使っていないコード・docs・設定・依存を消す（段階4）。
5. Worker を分割し、dist を軽くし、Order タブの軽い指摘を片づける。あわせて **Mulmo との境目（Mulmo が読む/書くファイル・呼ぶ API）を 1 枚に明文化**し、#713 の設計の入力にする（段階5）。

### 1.3 前提（着手条件）
- 次の 3 本がマージされてから段階2 以降を始める（CLAUDE.md の Worker・Cron・データの書き手の記述がこれらで変わるため）。
  - #717（Worker の Cron から per-daily を workflow_dispatch）
  - #719（古い「マネフォ取込」の削除・`/ai/openai` の 410）
  - #708 PR3（per-daily の時間帯。Mulmo 側の変更待ち・期限 2026-10-30）
- 段階1 は前提なしで今すぐ始めてよい（コードに触れない）。
- #708 PR3 が Mulmo 待ちで遅れる場合の扱いは §9 Q1（既定: 段階2 は PR3 を待たずに始め、PR3 が CLAUDE.md の per-daily の行だけを自分で直す）。

---

## 2. 全段階に共通の約束（load-bearing・触ってはいけない範囲）

### 2.1 変えないもの
| 対象 | 理由・使い手 |
|---|---|
| `data/**` の中身とキー・形状（`valuations.json` のインデント 1 スペース、`briefings/index.json` の形を含む） | 自動の書き手（Mac mini の MF 取込・Mulmo・Actions 4 本）と Mulmo が読む。本計画では **data/** に一切触れない**（段階3 の改行の正規化も `data/**` は対象外） |
| `data/scheduler/*.mjs` のファイル名・CLI 引数（`--write`・`--json`・`--check`・`--out`）・出力形式 | Actions（per-daily・weekly・kv-resync・fund-holdings）と Mulmo の手順が呼ぶ |
| `src/edgar-normalize.js`・`src/edinet-normalize.js` の**パスと export 名** | `data/scheduler/quality-us.mjs`・`quality-jp.mjs` が `../../src/...` で import している（アプリからは import されていない）。移動・改名しない |
| Worker の URL（`portfolio-proxy.shoulang.workers.dev`）・CORS 判定（`Origin: https://shoulang0729.github.io`）・ルートのパス・メソッド・レスポンスの形・ステータス | `data/scheduler/lib/worker-client.mjs`・`kv-resync.mjs`・Mulmo（`curl GET /watchlist`・`/yahoo`）・アプリ・`scripts/order-plan.mjs` が使う |
| `GET/PUT /watchlist` の JSON 配列形状（オブジェクトなら 400） | `kv-resync.mjs`・Mulmo |
| `/order-sheet`・`/order-sheet/plan`・`/order-sheet/events` の契約（rev 楽観ロック・PIN） | アプリ Order タブ・`scripts/order-plan.mjs`・対話中の Claude・Mulmo（#676 提案） |
| 410 にしたルート（`/portfolio/snapshot`・`/ai/*`・`/notion/save`） | 古いキャッシュのアプリが呼んでも 404 ではなく 410 を返す約束。消すかは §9 Q9 |
| KV のキー名と形（`positions`・`networth`・`watchlist`・`order:plan`・`order:log`・`auth:*`・`prices:cache`・`yahoo:crumb`・構成銘柄キャッシュ） | アプリ・Worker・Cron |
| `docs/briefing-generation-spec.md` | Mulmo の正本。変更が要れば Issue で提案のみ |
| `docs/handoff/**` | 記録。原則消さない・書き換えない（各 doc の実装ログ欄の追記は可） |
| CLAUDE.md の見出し「サイズ判定」「マージ前の確認」「データの書き手」「クラウドから実行できないもの」「公開リポの原則」 | `.claude/agents/*.md`・`.claude/commands/feature.md` が見出し名で参照している |
| `dist/app.js` を main にコミットする運用（`build-dist.yml`）と GitHub Pages の配信元 | Pages は main のルートから配信し、`index.html` が `dist/app.js` を読む。変えるなら §9 Q11 |

### 2.2 公開リポ
- 設計書・Issue・PR・CLAUDE.md・docs に実額・口座名・物件・負債・秘密の値を書かない。Secrets は**名前だけ**。KV の中身・`order:plan` の値を例示に使わない（例は合成値）。
- `wrangler.toml` の `NOTION_DB_ID` は値がすでに公開ファイルにある。消す場合も値を docs に転記しない。

### 2.3 進め方
- 1 PR＝1 目的。段階をまたいで 1 PR にしない。段階内の PR は §3〜§7 の順。
- 動作を変えない段階（2・3・4 の大半・5c）は「前後で同じ」を受け入れ条件で機械的に確かめる（テスト・バンドル比較・ルートの応答表）。
- `?v=` の bump は実行時の挙動が変わる PR だけ（4a は不要、5d・5e は要）。bump が要る PR は並行させない。
- PR に `dist/app.js` を含めない（`build-dist.yml` が main で作る）。

---

## 3. 段階1: 棚卸しの整理

### 3.1 状況
- 済み（2026-10-05）: #16・#660・#367・#709 クローズ。#715・#720 は残す（認証の残り）。
- 2026-10-05 時点の open Issue（PR を除く）: #720・#718・#715・#713・#708・#707・#706・#705・#704・#703・#676・#665・#647・#594・#306・#305・#304・#301・#220。

### 3.2 仕分け（提案）
| Issue | 提案 | 理由 |
|---|---|---|
| #718 | そのまま（#719 マージで自動クローズ） | — |
| #708 | そのまま（PR3 で Closes） | — |
| #713 | 残す（本計画の後に設計） | 本計画のゴール |
| #720・#715 | 残す（別々のまま）。段階5c（Worker 分割）の**後**に着手を推奨（§9 Q8） | 決めることが違う（#715 は workflows も絡む）。分割の後なら差分が小さく、衝突しない |
| #705 | 段階3 で対応 | — |
| #306・#704・#703 | 段階5 で対応 | — |
| #707（履歴の書き換え） | 残す。**段階3 との順番を決める**（§9 Q4） | filter-repo で全コミットの SHA が変わるため、段階3 の `.git-blame-ignore-revs` の SHA を書き換え後に取り直す必要がある。force push は open PR が 0 のときに行うので、段階の切れ目に置くのがよい |
| #665・#647 | 残す（本計画の外）。**#713 の前に直すことを推奨** | どちらも valuations→KV のデータ経路の潜在/実在バグ（#647 は `data/scheduler/lib/kv-sync.mjs` の `normValuation` が今も 3 項目だけを比べている）。#713 でこの経路の上に `claude -p` ジョブを載せる前に片づけたい。書き手のロジックなので Toshio 確認要 |
| #594 | 残す（Wait・本計画の外） | 資産データの数値モデル。リファクタとは独立 |
| #676 | **#713 に統合してクローズ**（§9 Q2） | Briefing 生成が注文表に追従する提案。Briefing の生成が `claude -p` に移る #713 で設計し直すのが自然 |
| #706 | **クローズ**（運用メモを `docs/routine_mf_snapshot.md` の「トラブル時」に 3 行で移す＝段階4c） | コード変更がない Mac の運用メモ。Issue として残しても実装者が動けない |
| #301 | **クローズ**（不要） | スナップショット履歴の案。スナップショットは #711 で撤去済み、資産推移は Wealth タブ（`data/mf-history.json`）で実現済み |
| #304 | **クローズ**（実現済み） | 目標配分は `data/target-allocation.json`＋`src/target-allocation.js`（適正サイズ v1）と Order タブで実現。残りの「カテゴリ別ドリフト表」が欲しければ新しい Issue |
| #220 | **#305 に統合してクローズ** | #305 の後続（look-through の構成銘柄数）。単独では進められない |
| #305 | 残す（Wait）か、`/etf/constituents` ごと閉じるか（§9 Q10） | Worker の `fetchEtfConstituents()` は常に `null` を返す未完成のスタブで、アプリからの呼び出しも無い |

### 3.3 手順
1. Toshio が §9 Q2・Q10 と上表のクローズ案を決める。
2. PM が決定どおりにクローズ／統合する。クローズ時は理由と移し先（#713・#305・docs）をコメントに書く（state_reason＝`completed` か `not_planned`）。
3. 段階2〜5 の Issue を起票する（`refactor` ラベル）。#705・#306・#704・#703 は既存 Issue に本設計書のパスをコメントで足す（新規起票しない）。

### 3.4 受け入れ条件
- [ ] 上表の各 Issue が「残す／クローズ／統合」のどれかになり、クローズしたものに理由のコメントがある。
- [ ] 段階2〜5 の Issue（または既存 Issue へのコメント）が本設計書のパスを指している。

### 3.5 Toshio 確認: **要**（クローズ・統合の判断）。リスク: 低（Issue は再オープンできる）。

---

## 4. 段階2: CLAUDE.md の全面更新

### 4.1 方針
- 目標 **200 行前後**（現在 625 行）。CLAUDE.md は「毎回読む前提で、間違うと事故になること」だけを持つ。手順・規約の詳細は docs に移してリンクする。
- 正本を 1 か所にする（同じ表を 2 か所に書かない）:
  - Worker のルート一覧の正本 ＝ `worker/src/index.js` 冒頭のコメント（段階5 の分割後は `worker/src/routes.js` の表）。CLAUDE.md はカテゴリの要約と「正本はここ」だけ。
  - データの書き手の正本 ＝ CLAUDE.md「データの書き手」（エージェントが参照するので CLAUDE.md に置く）。
  - 設計規約（色・タイポ・スペーシング・コーディング規約・アンチパターン）の正本 ＝ 新設 `docs/design-system.md`。
  - 開発ツール・よくある作業・並列運用の注意 ＝ 新設 `docs/dev-guide.md`。
- 変更履歴の表は**消す**（正本は git log と PR）。「現在バージョン」は「`index.html` の `?v=` を見る」に変える（数字を CLAUDE.md に書かない＝古くならない）。
- 段階4 で消す予定のもの（`src/_disabled/`・AI 相談タブ・`history.js` の有効化手順）は CLAUDE.md に**書かない**。そうすれば段階4 の PR が CLAUDE.md に触れずに済む。

### 4.2 新しい CLAUDE.md の構成（この順・見出し名は固定）
1. 冒頭の注記（開発フロー必読）— 現行のまま。
2. **開発フロー（Claude Code・2026-10-03〜）** — 現行の節を維持。中の小見出し「サイズ判定」「マージ前の確認（Toshio）」「データの書き手（手で編集しない）」「クラウドから実行できないもの」「Mac セッション」「公開リポの原則」「git / gh」は**名前を変えない**。内容の更新点:
   - データの書き手の表:
     - `data/positions.json`・`data/portfolio-snapshot.json` の行 → 「書き手なし（#711 で Worker の書き込みを停止・凍結）。扱いは段階4 §6.6」。
     - `per-daily.yml` の行 → #717/#708 PR3 後の実態（Worker Cron が夏 20:20・冬 21:20 UTC に workflow_dispatch・予備 schedule・当日分があれば何もしない・コミット `data: daily PER <UTC日付>`）。#717 の PR 本文「CLAUDE.md の追従」の文言を使う。
     - KV `watchlist` の行を追加 → 「アプリ（`PUT /watchlist`）と Actions `kv-resync.yml`（`data/scheduler/kv-resync.mjs`・valuations の push と日次）」。
     - KV `positions`・`networth` の行を追加 → 「アプリ（PIN 必須の PUT）」。
   - Mac セッション: 現行の内容を維持（2026-10-04 の取り決め）。文の重複だけ削る。
   - git / gh: 現行を維持。「PR に `dist/app.js` を含めない」を 1 行足す。
3. **プロジェクト概要**（10 行以内）: 何のアプリか・本番 URL・リポ・タブ（Heatmap／Historical Heatmap〔保有＋ウォッチ・#452〕／Valuation／Risk／Wealth／Briefing／Order）・データの流れの 1 行要約（MF 取込→`data/mf-*.json`、Mulmo と Actions→`valuations.json`・`briefings/`、価格は Worker 中継で Finnhub→Yahoo）。
4. **構成**（ツリーではなく層ごとの表、20 行以内）: `index.html`＋`src/app.js`（入口）→ esbuild → `dist/app.js`（main で `build-dist.yml` が自動コミット・Pages が配信）／`src/` をカテゴリで（認証 `auth-*`・データ取得 `data-*`/`forex`/`cache`/`historical-cache`/`idb`・タブ別の描画〔`heatmap`/`stock-list`/`valuation-tab`/`risk-*`/`wealth`/`briefing`/`order-sheet*`〕・計算 `*-calc`・共通 `utils`/`fmt`/`color`/`state`/`config`）／`worker/src/`／`scripts/`（Mac mini の MF 取込・`order-plan.mjs`）／`data/scheduler/`（Actions の日次・週次・月次）／`tests/`・`e2e/`／`docs/`（`handoff/` は記録）。ファイル単位の列挙はしない（古くなる）。
5. **Worker**（15 行以内）: ルートのカテゴリ（市場データ中継・KV データ・注文表・認証・410 済み）と「正本は `worker/src/index.js` 冒頭」／Cron の表（式・内容）／参照中の Secrets・vars の**名前**（§4.3 で確認して列挙）／レート制限は `worker/src/rate-limit.md`／注文表の運用は `docs/order-sheet-ops.md`。
6. **主要な設計ルール（要点だけ）**（15 行以内）: data-action 委譲・`escapeHTML`・色は CSS 変数（ハードコード hex 禁止）・`!important` 禁止・ソート comparator は antisymmetric・`PERIODS` が期間の唯一の定義元・`?v=` は全箇所を同じ値に bump（命名規則 1 行）。詳細は `docs/design-system.md`・`docs/dev-guide.md`。
7. **品質ゲート**（5 行）: `npm test`・`npm run lint`・`npm run check:types`・`npm run check:circular`・`npm run build`（CI と同じ）・E2E は `npm run test:e2e`。詳細は `docs/dev-guide.md`。
8. **Claude Code 自律実行ルール**: 表を残す（「確認してから実行」も残す）。CodeRabbit の行は §9 Q5 次第。
9. **並列作業の注意**（10 行以内）: 「ベースは main」「1 Task＝1 ブランチ＝1 PR＝1 Issue、分割時は最後だけ Closes」「push 前 `pull --rebase`」「`?v=` bump する PR は並行しない」「サブエージェントで gh/npm が拒否されたら commit まで」。モデル分担表（Haiku/Sonnet/Opus）と過去事故の経緯は消す（必要なら `docs/dev-guide.md` に要約）。

### 4.3 書く前に確かめる事実（implementer が main で確認して書く。推測で書かない）
- Cron の式: `worker/wrangler.toml` の `[triggers] crons`。
- 参照中の Secrets・vars: `grep -n "env\.[A-Z_]*" worker/src/*.js` の結果だけを載せる（2026-10-05 時点の想定: `FINNHUB_API_KEY`・`FMP_API_KEY`・`EDINET_DB_API_KEY`・`SEC_USER_AGENT`・`ALLOWED_ORIGIN`・#717 後の `GITHUB_TOKEN`/`GH_DISPATCH_TOKEN`。#719 後に `OPENAI_API_KEY` は消える）。
- ルートのカテゴリ: `worker/src/index.js` の `fetch()` の分岐。
- タブ: `index.html` の `data-tab`。
- 現行の Actions: `.github/workflows/*.yml` の一覧と schedule。

### 4.4 PR 分割
- **PR2a**（`docs/claude-md-refresh`）: 先に `docs/design-system.md`・`docs/dev-guide.md` を新設（CLAUDE.md の該当節を**文言を変えずに移す**＋古い記述だけ直す）。CLAUDE.md は触らない。Toshio 確認: 不要（docs のみ）。
- **PR2b**（`chore/claude-md-refresh`）: CLAUDE.md を §4.2 の構成に書き直す。PR 本文に「消した/移した節 → 行き先」の対応表を付ける。Toshio 確認: **要**（開発体制）。
- 2 本に分けるのは、移した内容のレビュー（2a）と CLAUDE.md の書き直しのレビュー（2b）を分けるため。

### 4.5 受け入れ条件
- [ ] CLAUDE.md が 250 行以下。
- [ ] §4.2 の固定見出しがすべて残り、`.claude/agents/*.md`・`.claude/commands/feature.md` から参照される見出し名と一致する（`grep` で確認）。
- [ ] CLAUDE.md に次が**無い**: `20260529`、`SPEC_cn.md`、`DESIGN.md`（`docs/design-system.md` は可）、`0 */6 * * *`、`/portfolio/snapshot` を有効なルートとして書いた行、`スナップショット保存`、`/notion/save`・`/ai/claude` 等を有効なルートとして書いた行、Haiku/Sonnet/Opus の分担表、`_disabled`。
- [ ] CLAUDE.md の Cron・Secrets・タブ・ワークフローの記述が §4.3 の確認結果と一致する（PR 本文に確認コマンドと結果を貼る。Secrets は名前だけ）。
- [ ] CLAUDE.md・`docs/design-system.md`・`docs/dev-guide.md` 内の相対リンクがすべて存在するファイルを指す。
- [ ] 実額・口座名・秘密の値が無い。
- [ ] コード（`src/**`・`worker/**`・`index.html` 等）に差分が無い。

### 4.6 Toshio 確認: PR2a 不要／PR2b **要**。リスク: 中。エージェントが CLAUDE.md の見出し名に依存しているので、見出しを変えると architect/implementer/reviewer の判断が崩れる（→ 受け入れ条件で固定）。消しすぎて必要な注意が失われる（→ 対応表で行き先を示す）。

---

## 5. 段階3: 整形の統一（#705）

### 5.1 対象と範囲
- 改行コード: リポ全体（ただし `data/**` は自動の書き手のファイルなので結果的に変化 0 であることを確かめる。2026-10-05 時点の CRLF は `src` 20・`tests` 2・`worker/src` 1・`assets` 2・`README.md`・`package.json`・`package-lock.json`・`.clinerules` の 29 ファイルで、`data/**` には無い）。
- prettier: `npm run format` の範囲（`src/**/*.js`・`worker/src/**/*.js`）だけ。`tests/`・`e2e/`・`data/scheduler/`・`scripts/` への拡大は本段階ではしない（差分を抑える。拡大は後日の別 Issue）。

### 5.2 PR 分割と手順
- **PR3a**（`chore/705-normalize-format`・2 コミット・squash される）:
  1. `.gitattributes` を次にする（既存の `*.snap` 行は残す）:
     ```
     * text=auto eol=lf
     *.png binary
     *.jpg binary
     *.ico binary
     *.snap text eol=lf
     ```
     → `git add --renormalize .` → コミット「改行コードを LF に統一」。
  2. `.prettierignore`（`dist/`・`data/`・`node_modules/`）を追加 → `npm run format` → コミット「prettier で一括整形（ロジック変更なし）」。
  - `?v=` は bump しない（実行時の挙動は同じ）。
- **PR3b**（`chore/705-blame-ignore`）: PR3a の squash コミットの SHA を `.git-blame-ignore-revs` に書く（コメント行で「#705 改行と整形の一括変更」）。squash で SHA が変わるので PR3a のマージ後にしか書けない。`docs/dev-guide.md` に「ローカルでは `git config blame.ignoreRevsFile .git-blame-ignore-revs`」を 1 行足す。
- **PR3c**（`ci/705-prettier-check`）: `package.json` に `"format:check": "prettier --check 'src/**/*.js' 'worker/src/**/*.js'"` を足し、`.github/workflows/test.yml` の lint の次に `npm run format:check` を 1 行足す（§9 Q3）。

### 5.3 時機
- open の PR（アプリのコードに触れるもの）が 0 本のときに PR3a を作り、その日のうちにマージする。作業中の PR があると全面的に衝突する。
- 自動コミット（MF 取込・PER・Mulmo・build-dist）は `data/**`・`dist/**` だけを書くので衝突しない。
- #707（履歴の書き換え）との順番は §9 Q4。既定: **#707 が先なら**そのまま段階3。**段階3 が先なら**、#707 の実施手順に「filter-repo 後に `.git/filter-repo/commit-map` で `.git-blame-ignore-revs` の SHA を新しい SHA に置き換えるコミットを入れる」を足す（`docs/handoff/2026-10-04-history-rewrite.md` に追記。#707 側の担当）。

### 5.4 受け入れ条件
- [ ] PR3a 後、`git ls-files --eol | grep 'i/crlf'` が 0 件。
- [ ] PR3a 後、`npx prettier --check 'src/**/*.js' 'worker/src/**/*.js'` が成功。
- [ ] **意味が変わっていない**ことの機械的な確認（PR 本文に結果を貼る）: PR3a の前後で
  - `npx esbuild src/app.js --bundle --format=esm --external:d3 --minify` の出力が同一（sha256 一致）。
  - `npx esbuild worker/src/index.js --bundle --format=esm --minify` の出力が同一。
  - 一致しない場合は差分の箇所を PR 本文に列挙し、整形以外の変化でないことを示す。
- [ ] `data/**` の差分が 0。`dist/app.js` を PR に含めない。
- [ ] 品質ゲート green（vitest・eslint・check:types・check:circular・build・e2e）。
- [ ] PR3b: `.git-blame-ignore-revs` に PR3a の main 上の SHA があり、GitHub の blame でその行の変更が無視される。
- [ ] PR3c: prettier 未整形のファイルを含む PR で CI が落ちる（ブランチで確認したら戻す）。

### 5.5 Toshio 確認
- PR3a: **要**（`worker/src/index.js` の認証・CORS・レート制限のコードの行に整形が入るため、形式上「セキュリティ」に触れる。中身はバンドル一致で確認済みであることを reviewer が添える）。Worker の再デプロイは**不要**（バンドルが同一なら挙動は同じ。一致しない場合のみデプロイ要）。
- PR3b: 不要。PR3c: **要**（`.github/workflows/**`）。
- リスク: 中。全ファイルの blame が汚れる（→ PR3b）。並行 PR と衝突する（→ 時機）。prettier の版で整形が揺れる（→ `package-lock.json` の prettier の版で固定・CI も同じ版）。

---

## 6. 段階4: 使っていないコード・docs の削除

### 6.1 PR4a: `src/_disabled/` の削除（フロント）
- 削除: `src/_disabled/`（`ai-tab.js`・`ai-system-prompt.js`・`05-ai-tab.css`・`history.js`）。資産推移は Wealth タブで実現済み、AI 相談は Worker 側が 410（#716）。
- 追従: `index.html` 32 行目のコメント、`eslint.config.js`・`tsconfig.json`・`vitest.config.js` の `src/_disabled/**` の除外指定。
- `docs/ai-system-prompt.md` もこの PR で削除する（AI タブ専用。ほかから参照されていないことを grep で確認）。
- `?v=` bump 不要（バンドルに入っていなかった）。Toshio 確認: 不要。

### 6.2 PR4b: Worker の不要コード・コメント
- 対象（#717・#719 マージ後の main で確認）:
  - `worker/src/index.js` 冒頭のコメント（ルート一覧・環境変数・Cron）を実態に合わせる（#719 後の `/ai/openai` 410、`/fmp`・`/edgar`・`/edinet-db`・`/networth` を含む）。
  - 参照されなくなった関数・定数・import（#711・#716・#719 で呼び出し元が無くなったもの）。`npx eslint worker/src --rule 'no-unused-vars: error'` と目視で特定。
  - 410 のルート自体は残す（§2.1）。
  - `/etf/constituents` と `worker/src/etf-constituents.js` は §9 Q10 の結果に従う（既定: 残す）。
- テスト（`tests/worker*.test.js`）は既存の期待を変えない。消した関数の単体テストだけ消す。
- Toshio 確認: 関数を消さずコメントだけなら不要、関数・ルートの実装を消すなら **要**（worker）。デプロイ: 実行コードが変わる場合のみ要。

### 6.3 PR4c: docs の整理
| ファイル | 扱い（既定） | 理由 |
|---|---|---|
| `docs/mulmo-vscode-workflow.md` | 削除 | 2026-10-03 で廃止と冒頭に明記済み |
| `docs/pm-queue.md` | 削除 | Mulmo 盤面モニタの記録。体制廃止 |
| `docs/multi-agent-orchestration.md` | 削除 | Haiku 委任ガイド。役割分担で置き換え済み |
| `docs/issue-priority-plan-2026-06-15.md` | 削除 | 2026-06 時点の優先度表。段階1 で置き換え |
| `docs/wiki/Claude-Code-Autonomous-Actions.md` | 削除 | CLAUDE.md「自律実行ルール」と重複 |
| `docs/investment-architecture.md`＋`docs/assets/investment-architecture.*` と `docs/investment-system-architecture.md` | 残す（#713 で書き直す）。冒頭に「2026-06 時点・#713 で改訂予定」と 1 行 | 2 本が重複しているが、境目が動く #713 で 1 本にまとめるのが手戻りが少ない |
| `docs/d3-etf-proxy-data-availability.md` | `docs/handoff/assets/` へ移す（記録として残す） | Mulmo 体制の調査依頼書 |
| `docs/routine_japan_1700.md`・`docs/routine_us_0600.md` | §9 Q6（今も動いているか） | 2026-05 以来更新なし |
| `docs/routine_mf_snapshot.md` | 残す。#706 の運用メモ（UCSS ヘルパーのゾンビ・対処の選択肢）を「トラブル時」に 3 行で追記 | 段階1 で #706 をクローズする受け皿 |
| `README.md` | 更新（`docs/SPEC_cn.md` への切れたリンクを消し、CLAUDE.md・`docs/dev-guide.md` へ導く） | — |
| `docs/briefing-generation-spec.md`・`docs/mulmo-data-scripts-asis.md`・`docs/wealth-networth-spec.md`・`docs/order-sheet-ops.md`・`docs/order-sheet/`・`docs/routine_mf_discovery.md`・`docs/frontend-gotchas.md`・`docs/handoff/**` | 残す | 正本・Mulmo の参照・記録 |
- 受け入れ: 削除・移動したファイルへのリンクが CLAUDE.md・README・`docs/`（`docs/handoff/**` を除く）・`.claude/**`・`src/`・`worker/`・`scripts/`・`data/scheduler/` に残っていない（`docs/handoff/**` 内の古いリンクは記録なので直さない）。
- Toshio 確認: 不要（docs）。ただし §9 Q6 の決定後に作る。

### 6.4 PR4d: ルートの不要ファイル・依存
- 削除（既定）: `.clinerules`（Cline 時代の規則・CLAUDE.md と重複）、`.fix-manifest.json`（自動修正 bot〔2026-10-03 停止〕の記録）、`open-issues.json`（Issue 一覧の古いダンプ）。各ファイルの参照元を grep で確認（`.claude/skills/codex-review.md` が `.clinerules` 等を参照していれば、その扱いは §9 Q5 で決めるまでファイルを残す）。
- 未使用の devDependencies: `npm run check:deps` の結果のうち、`grep` でも使われていないと確認できたものだけ外す（`.depcheckrc.json` の ignores は見直す）。CLAUDE.md の「d3 はインストールしない」と `package.json` の `d3` devDependency が矛盾しているので、`d3` が tests で使われているかを確かめ、どちらかに揃える（tests が使っていれば残し、`docs/dev-guide.md` の記述を直す）。
- `.coderabbit.yaml`・`.claude/skills/codex-review.md`・`.claude/codex-review-prompt.md`: §9 Q5 の決定まで触らない（`.claude/**` は開発体制）。
- Toshio 確認: 不要（`.claude/**` に触れない限り）。

### 6.5 Worker Secrets（削除は Toshio が Mac で行う。コードの変更は無い）
#717・#719 マージ後の main で `grep -n "env\.[A-Z_]*" worker/src/*.js` を取り直し、参照の無い Secret・vars を Issue に**名前だけ**列挙する。2026-10-05 時点の見込み:
| 名前 | 参照 | 既定の扱い |
|---|---|---|
| `GEMINI_API_KEY`・`GROK_API_KEY`・`DEEPSEEK_API_KEY`・`ANTHROPIC_API_KEY` | なし（#716） | 削除してよい |
| `OPENAI_API_KEY` | #719 後なし | 削除してよい |
| `NOTION_API_KEY` | なし（#716） | **#713 の決定まで残す**（Notion 移管で Worker から使う可能性） |
| `NOTION_DB_ID`（`wrangler.toml` の vars） | なし | #713 の決定まで残す。消すなら `wrangler.toml` の変更（worker・Toshio 確認） |
| `GITHUB_TOKEN` | #711 で一度参照 0 → #717 で per-daily の起動に再利用 | 残す |
- 手順: Toshio が Mac で `cd worker && npx wrangler secret delete <NAME>`（Mac セッションには任せない＝CLAUDE.md の禁止事項）。削除の前後で `npx wrangler secret list` の名前だけを確認し、Issue に「削除した名前」を書く。

### 6.6 `data/positions.json`・`data/portfolio-snapshot.json`（凍結中のファイル）
- #711 以降どこからも書かれていない。読み手: `src/watchlist.js`（KV が空のときの `portfolio-snapshot.json` へのフォールバック）、`tests/constituents-coverage.test.js`（`positions.json` の銘柄が構成銘柄データにあるか）、`e2e/helpers.js`（ルートを abort）、外部の AI ツール（raw URL・CLAUDE.md の旧記述）。Mulmo が読んでいるかは未確認。
- 本計画では**変えない**（データ構造）。§9 Q7 で Toshio が「凍結のまま残す／Mulmo に確認して削除」を決める。削除する場合は別 Issue（データ構造・Toshio 確認・Mulmo への申し送り・`watchlist.js` のフォールバックとテストの差し替えを同じ PR で）。

### 6.7 受け入れ条件（段階4 共通）
- [ ] 品質ゲート green（vitest・eslint・check:types・check:circular・build・e2e）。
- [ ] 消したファイル・関数への参照が残っていない（grep の結果を PR 本文に）。
- [ ] `dist/app.js` のサイズが増えていない（PR4a・4b は同じか減る）。
- [ ] `data/**` の差分が 0。
- [ ] PR4b: `tests/worker*.test.js` の既存テストの期待値を変えていない。

### 6.8 リスク
- 低〜中。消したものを外部（Mulmo・Mac の手順）が使っていた場合に壊れる → 削除前に `docs/mulmo-data-scripts-asis.md`・`scripts/README-mf-snapshot.md`・`.github/workflows/**` を grep。Worker の Secrets は一度消すと値の再入手が要る → 既定で `NOTION_*` は残す。

---

## 7. 段階5: 構造改善

### 7.1 PR5a: Mulmo との境目の明文化（docs・#713 の入力）
- 新設 `docs/interfaces.md`（「portfolio が外部に約束していること」）。表で:
  1. **Mulmo が書くもの**: `data/valuations.json`（判断の書き戻し・どのキーを書くか）・`data/briefings/**`（`index.json` の形は `docs/briefing-generation-spec.md`）。
  2. **Mulmo が読むもの**: `data/valuations.json`・`data/mf-holdings.json`・`data/target-allocation.json` など（**Mulmo への確認で埋める**。分からない行は「未確認」と書く）。
  3. **Mulmo・Actions・Mac が呼ぶ Worker API**: `GET /yahoo`（Origin ヘッダ）・`GET/PUT /watchlist`（配列）・`/finnhub`・`/fmp`・`/edgar`・`/edinet-db`（`data/scheduler`）・`/order-sheet*`（`scripts/order-plan.mjs`・Claude・#676 で Mulmo）。
  4. **Actions の書き手と時刻**（per-daily・weekly・kv-resync・fund-holdings・build-dist）と push 禁止時間帯（Mulmo の 21:00〜22:30 UTC。#708 の取り決め）。
  5. **リポ外からの import**: `data/scheduler/*` → `src/edgar-normalize.js`・`src/edinet-normalize.js`。
- この表を、段階5 の各 PR の「壊していないこと」の確認リストに使う。#713 の設計はこの表のどの行を動かすかで書く。
- Toshio 確認: 不要（docs）。ただし 2. の「Mulmo が読むもの」は Toshio 経由で Mulmo に確認を依頼する（§9 Q12）。

### 7.2 PR5b: Worker の振る舞いを固定するテスト（分割の前）
- `tests/worker-routes-contract.test.js`（新規）: KV・fetch をモックした env で、**全ルート × 主要メソッド**（GET/PUT/POST/OPTIONS・未対応メソッド）について、ステータス・CORS ヘッダ（許可 Origin と不許可 Origin）・PIN 必須ルートの PIN なし/誤り/正しい の結果・410 ルート・404 を表にして期待する。`scheduled()` は 3 つの cron 式（既存・#717・`event.cron` なし）で呼ばれる処理（モックの呼び出し）を期待する。
- 値は合成値（PIN ハッシュはテスト用のダミー）。
- Worker のコードは変えない。Toshio 確認: 不要（tests のみ）。

### 7.3 PR5c: Worker の分割（#306）
- **機械的な移動だけ**。関数の本体は変えない（import/export の追加と、`index.js` からの呼び出しの付け替えだけ）。挙動の変更・名前の変更・整理は別 PR。
- 新しい配置（既存の `order-plan.js`・`order-sheet-calc.js`・`etf-constituents.js`・#717 の `us-dst.js` は**動かさない**。tests の import を壊さないため）:
  | ファイル | 中身 |
  |---|---|
  | `worker/src/index.js` | `export default { fetch, scheduled }`。OPTIONS・CORS・レート制限・ルート表での振り分け・404。**100 行程度** |
  | `worker/src/routes.js` | ルート表 `[{ path, handler, rateLimited }]`（410 のパス集合を含む）。**ルート一覧の正本**（冒頭コメントもここへ移す） |
  | `worker/src/http.js` | `jsonRes`・`errRes`・CORS ヘッダの組み立て |
  | `worker/src/auth.js` | PIN ハッシュの照合（`X-Pin-Hash`）・パスキー（`/auth/*` のハンドラ） |
  | `worker/src/routes-market.js` | `/yahoo`（crumb を含む）・`/finnhub`・`/fmp`・`/edgar`・`/edinet-db`・`/forex`・`/prices/cache`・`/etf/constituents` |
  | `worker/src/routes-kv.js` | `/watchlist`・`/positions`・`/networth` |
  | `worker/src/routes-order-sheet.js` | `/order-sheet`・`/order-sheet/plan`・`/order-sheet/events` |
  | `worker/src/cron.js` | `scheduled()` の中身（価格キャッシュ・注文表の約定・#717 の per-daily dispatch） |
- `wrangler.toml` の `main = "src/index.js"` は変えない。
- 受け入れ条件:
  - [ ] PR5b のテストが**変更なしで** green。既存の `tests/worker*.test.js` も変更なし（import 先の変更が要る場合は import 行だけ）で green。
  - [ ] `worker/src/index.js` が 150 行以下。
  - [ ] 移した関数の本体が移動前と一致する（PR 本文に「関数名 → 移動先」の表。reviewer は `git diff --color-moved=zebra` で移動以外の変更が無いことを確認）。
  - [ ] `npx wrangler deploy --dry-run --outdir /tmp/x`（クラウドで可能なら）または esbuild でバンドルが作れる。
  - [ ] madge で `worker/src` に循環参照が無い（`npx madge --circular worker/src/`）。
- Toshio 確認: **要**（worker の認証・CORS・レート制限のコードが移動する）。マージ後に**Worker のデプロイ要**（Mac セッション可）。デプロイ後の確認: `curl` で `GET /`（200）・`GET /watchlist`（200・配列）・`GET /positions` を PIN なし（401/403 の現行値）・`GET /portfolio/snapshot`（410）・不許可 Origin の CORS。翌日の per-daily・kv-resync・weekly の Actions が成功していること。失敗時は `npx wrangler rollback`。

### 7.4 PR5d: dist のサイズ削減（#704）
- 既定（§9 Q11）: `package.json` の `build` に `--minify --sourcemap=linked` を足す。`build-dist.yml` は `dist/app.js` と `dist/app.js.map` をコミットする。`sw.js` のプリキャッシュは `dist/app.js` のまま（map は devtools を開いたときだけ読まれる）。
- `test.yml` の `BLOAT_GUARD_LIMIT` を minify 後のサイズに合わせて下げる（実測値＋30% を目安。PR 本文に実測を書く）。
- dynamic import（タブの遅延読込）は今回はしない（SW のキャッシュ一覧と Pages の配信の変更が要るため）。必要になったら別 Issue。
- `index.html` の `?v=` を bump。CSP（`script-src 'self'`）に影響が無いことを確認。
- 受け入れ: e2e green、本番相当の手元確認（`npx http-server`）で全タブが表示できる、`dist/app.js` が 400,000 B から大きく減る（目安 半分以下）。
- Toshio 確認: **要**（`.github/workflows/**`・build 設定）。

### 7.5 PR5e: Order タブの軽い指摘 3 件（#703）
- #703 本文の 3 件（不足額が無いときの文言・伏字の正規表現を金額だけに・申告中の GET の並走を抑止）。表示と取得の順序だけで、`POST /order-sheet/events` の内容・KV の形は変えない。
- テスト: `renderFunding` の不足額なし・`maskDollarText` の注記中の指値・busy 中にタブを戻ったときに GET しないこと、を単体テストで。
- `?v=` bump。Toshio 確認: 不要（表示のみ。`order:plan` の書き込みに触れない。触れる必要が出たら止めて報告）。
- 段階3 の後ならいつでもよい（5c・5d と独立）。

### 7.6 段階5 の順番とリスク
- 順番: 5a → 5b → 5c → （5d・5e は 5c と独立。`?v=` bump があるので 5d と 5e は順に）。
- リスク: 高（5c）。Worker は Mulmo・Actions・アプリの全部が通る一点で、分割の誤りは翌朝のデータ更新を止める → 5b の契約テスト、関数本体を変えない移動、デプロイ直後の curl 確認、翌日の Actions の確認、rollback 手順。#720・#715（認証の変更）は 5c のマージ後に始める（§9 Q8）。

---

## 8. まとめ表（段階 × PR × Toshio 確認 × デプロイ）
| 段階 | PR | 内容 | Toshio 確認 | Worker デプロイ | `?v=` |
|---|---|---|---|---|---|
| 1 | — | Issue の仕分け | 要（判断） | — | — |
| 2 | 2a | `docs/design-system.md`・`docs/dev-guide.md` 新設 | 不要 | — | — |
| 2 | 2b | CLAUDE.md 書き直し | **要** | — | — |
| 3 | 3a | LF 統一＋prettier 一括 | **要**（worker の行に触れる） | 不要（バンドル一致時） | 不要 |
| 3 | 3b | `.git-blame-ignore-revs` | 不要 | — | — |
| 3 | 3c | CI に prettier check | **要**（workflows） | — | — |
| 4 | 4a | `src/_disabled/`・`docs/ai-system-prompt.md` 削除 | 不要 | — | 不要 |
| 4 | 4b | Worker の不要コード・コメント | コードを消すなら**要** | コードを消すなら要 | — |
| 4 | 4c | docs の整理・README | 不要 | — | — |
| 4 | 4d | ルートの不要ファイル・devDeps | 不要（`.claude/**` を除く） | — | — |
| 4 | — | Secrets の削除 | Toshio が実施 | — | — |
| 5 | 5a | `docs/interfaces.md` | 不要（Mulmo 確認は Toshio 経由） | — | — |
| 5 | 5b | Worker 契約テスト | 不要 | — | — |
| 5 | 5c | Worker 分割（#306） | **要** | **要** | — |
| 5 | 5d | minify＋sourcemap（#704） | **要** | — | 要 |
| 5 | 5e | Order タブ 3 件（#703） | 不要 | — | 要 |

---

## 9. 要 Toshio 判断（既定値つき）
1. **Q1 #708 PR3 が遅れたとき**: 既定＝段階2 は #717・#719 のマージ後に始め、PR3 を待たない。PR3 が CLAUDE.md の per-daily の 1 行を自分で直す（PR3 はどのみち Toshio 確認）。
2. **Q2 #676 を #713 に統合してクローズしてよいか**: 既定＝統合。
3. **Q3 CI に prettier check を足すか**（PR3c）: 既定＝足す（範囲は `src`・`worker/src` のみ）。
4. **Q4 #707（履歴の書き換え）と段階3 の順番**: 既定＝段階3 を先に行い、#707 の手順に `.git-blame-ignore-revs` の SHA の付け替えを足す。#707 の実施日が近いなら #707 を先に。
5. **Q5 CodeRabbit・codex-review をまだ使っているか**: 使っていなければ `.coderabbit.yaml`・`.claude/skills/codex-review.md`・`.claude/codex-review-prompt.md` を段階4 で削除し、CLAUDE.md の自律実行ルールの CodeRabbit の行も消す（`.claude/**` なので Toshio 確認）。既定＝使っていない前提で質問し、回答まで触らない。
6. **Q6 `docs/routine_japan_1700.md`・`docs/routine_us_0600.md` のルーティンは今も動いているか**: 動いていなければ削除。既定＝回答まで残す。
7. **Q7 凍結中の `data/positions.json`・`data/portfolio-snapshot.json`**: 既定＝凍結のまま残し、#713 の設計で扱う（Mulmo が読んでいるかを先に確認）。
8. **Q8 #720・#715 と Worker 分割の順番**: 既定＝分割（5c）を先。認証の変更が急ぐなら #720 を先にして 5c を後ろへ。
9. **Q9 410 にしたルートをいつ消すか**: 既定＝本計画では消さない（古いキャッシュのアプリへの約束）。#713 の後に見直す。
10. **Q10 `/etf/constituents`（常に null を返すスタブ・アプリから呼び出し無し）と #305**: 既定＝#305 を残し（#220 を統合）、スタブも残す。look-through をやらないと決めるなら、#305 クローズ＋段階4b でルートと `etf-constituents.js` を削除（このルートは 404 ではなく 410 にする）。
11. **Q11 dist の扱い**: 既定＝main にコミットする運用は維持し、minify＋linked sourcemap にする。Pages を Actions のデプロイに変えて dist をコミットしない案は、Pages の設定と workflows の大きな変更なので本計画ではしない。
12. **Q12 Mulmo への確認**: `docs/interfaces.md` の「Mulmo が読むもの」と「`data/portfolio-snapshot.json` を読んでいるか」を Mulmo に確認してもらう（Toshio が依頼を渡す）。
13. **Q13 Secrets の削除**: §6.5 の表の「削除してよい」を Toshio が Mac で実施するか。既定＝`NOTION_*` 以外は削除。

---

## 10. ブランチ / PR / Issue
- ベースは常に `main`。ブランチ名は各 PR の節に記載。
- Issue: 段階1・2・4・5（5a/5b 用の親）を新規起票。段階3 は #705、5c は #306、5d は #704、5e は #703 を使う。
- PR の Closes: 段階2 は PR2b が Closes（2a は Refs）。段階3 は PR3c が `Closes #705`（3a・3b は Refs）。段階4 は最後の PR が Closes。段階5 は 5c が `Closes #306`、5d が `Closes #704`、5e が `Closes #703`、5a・5b は段階5 の Issue を Refs、親 Issue は 5e（または最後の PR）で Closes。
