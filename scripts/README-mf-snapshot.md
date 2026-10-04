# MF 資産スナップショット自動更新（Mac mini ローカル・決定論）

`scripts/fetch_mf.py` が MoneyForward ME のポートフォリオを**決定論的に DOM 抽出**し、
`data/mf-holdings.json`（v4）を更新して無人で commit & push します。**LLM は経路に存在しません**
（＝プロンプトインジェクション穴なし）。設計の根拠は `docs/handoff/2026-06-21-mf-snapshot-automation.md`。

- 承認ゼロ：成功は無通知でコミット。**通知が来るのは「ログイン切れ」「チェックサム不一致」「再試行しても取得に失敗」「networth KV 送信失敗」「非公開設定の不備で中止」だけ**。
- 実行時刻は**毎日 05:00（Mac のローカル時刻＝CST）**。launchd `com.toshio.mf-snapshot` が `fetch_mf.py run` を叩く。
- **再試行**（#685）: ブラウザの起動失敗・EAGAIN・Playwright の TimeoutError（ページ表示・表の出現待ち）だけは、
  ブラウザを閉じてから最大 3 回まで取得をやり直す（待ち 30 秒 → 120 秒）。ログイン切れ・チェックサム不一致・
  抽出 0 件は再試行せずその場で中止。検証・書き込み・commit/push・KV 送信は取得が成功した後に 1 回だけ。
  stderr（`err.log`）に `mf-snapshot: attempt 1/3 failed: … — retry in 30s` / `attempt 2/3 succeeded` が出る。
- **待ち条件**（#685）: ページは `domcontentloaded` で開き、`fetch.dom.tables` のセレクタ（負債は
  `fetch.liabilities.table.selector`）の表が現れるまで `fetch.timeoutMs` 待ってから `fetch.settleMs` 待って読む
  （以前の `networkidle` 待ちはやめた）。
- **鮮度の見張り**: GitHub Actions `mf-freshness.yml` が毎朝 08:40 CST に `asOf` を確かめ、当日の取込が無ければ
  Issue（ラベル `stale-mf-holdings`）を立てる。Mac 側の通知が見落とされても GitHub で気づける。
- **通知の届け先**: plist に `TG_BOT_TOKEN`/`TG_CHAT` が無いと、通知は stderr と **macOS の通知センターだけ**になる
  （現在の運用は Telegram を設定していない＝実質の見張りは上記の鮮度 Issue）。
- 永続プロファイルで MF セッションを保持（1回ログイン→持続）。Mac mini の residential IP で cookie 失効を回避。
- **除外リストは非公開設定が正本**（#687）: 除外する口座の実名は Mac mini の `~/.mf-snapshot/private-config.json`
  （リポ外）にだけ置き、`run` の起動時に公開 config へ重ねる。公開 `data/mf-import-config.json` の `exclude.accounts` は常に空。
  非公開設定が無い・壊れているときは**ブラウザを起動する前に中止して通知**（exit 6）。下の「非公開設定」節の手順で作成して再実行する。

---

## ワンタイム・セットアップ（Mac mini）

1. **リポジトリを clone**（git push 認証は既存のものを使用）。例:
   ```sh
   git clone https://github.com/shoulang0729/portfolio.git ~/github/portfolio
   cd ~/github/portfolio
   ```
2. **Playwright を導入**（chromium のみ）:
   ```sh
   pip3 install playwright
   python3 -m playwright install chromium
   ```
   > `fetch_mf.py` を実行する python は **playwright を入れた python と同一**にすること
   > （`which python3` の結果を控え、plist の ProgramArguments に使う）。
3. **初回ログイン（永続プロファイル保存）**:
   ```sh
   python3 scripts/fetch_mf.py setup
   ```
   開いたブラウザで MF にログイン（2FA 含む）→ ターミナルで Enter。`~/.mf-snapshot/profile` に保存される。
4. **セレクタ確定（重要・TODO）**: `data/mf-import-config.json` の `fetch.dom` は暫定値です。
   初回は `python3 scripts/fetch_mf.py run` を手動実行し、`data/mf-holdings.json` の中身と
   `python3 -c "import json;d=json.load(open('data/mf-holdings.json'));print(d['totals'])"` で
   口座/金額が正しいか確認。ズレる場合は実画面の DevTools でセレクタを調べ `fetch.dom` を修正
   （MF の構造変更時もここだけ直せばよい）。チェックサム不一致時は通知＋中止するので壊れたデータは push されません。
5. **（任意）Telegram 通知**: `~/Library/LaunchAgents/com.toshio.mf-snapshot.plist` の
   `TG_BOT_TOKEN`/`TG_CHAT` を設定（使わないなら `EnvironmentVariables` ブロックごと削除）。
   **トークンはリポジトリにコミットしない**（plist はホームの LaunchAgents にのみ置く）。
6. **launchd 登録**（毎日 05:00・Mac のローカル時刻＝CST）:
   ```sh
   # plist 内のパス（python3 / fetch_mf.py / ログ出力先）を自分の環境に合わせて編集してから
   cp scripts/com.toshio.mf-snapshot.plist ~/Library/LaunchAgents/
   mkdir -p ~/.mf-snapshot
   launchctl load ~/Library/LaunchAgents/com.toshio.mf-snapshot.plist
   ```
7. **非公開設定を作る**（下の「非公開設定（除外リスト）」節）。無いと `run` は中止される。
8. **動作確認**: `python3 scripts/fetch_mf.py run` を手動実行 → `data/mf-holdings.json` 更新と
   `git log -1` の push を確認。
9. **試運転（`--dry-run`）**: `python3 scripts/fetch_mf.py run --dry-run` は取得・検証までを行い、
   `data/` への書き込み・commit/push・networth の KV 送信・履歴取得を**しない**。出力は件数と一致判定だけで、
   金額・口座名は出さない（#687）。例:
   ```text
   [dry-run] verify=passed rows=N holdings=N excludedAccounts=N liabilities=N realEstate=skipped
   [dry-run] 取込対象の金融機関の集合: 一致
   [dry-run] 除外口座の集合: 一致
   [dry-run] imported: 直近出力の ±1.0% 以内
   [dry-run] 公開コピー検査: 通し番号でない institution=0行 実名の残る institution=0行 汎用ラベルでない現金・預金の name=0行 excludedAccounts=0件 liabilities=なし → OK
   [dry-run] OK（書き出し・KV 送信・commit/push はしていない）
   ```
   比較の相手は同じ作業ツリーの `data/mf-holdings.json`（直近の本番出力）。それがすでに公開用の通し番号形式なら、
   2 つの集合は「比較不可」と出る。公開コピー検査が NG なら exit 4。dry-run 中の通知には先頭に `[dry-run]` が付く。
   `--dry-run` 単独でも同じ。未知の引数・打ち間違いは exit 2 で止まり、本番処理には入らない。
   feature ブランチの確認は main とは別の作業ツリーで、必ずこのモードで行う（`run` を feature ブランチで実行しない）。
   `--dry-run` も非公開設定を重ねて動く（無い・壊れていれば同じく exit 6 で中止）。

---

## 非公開設定（除外リスト・#687）

除外する口座の実名は**公開リポに置かない**。Mac mini のリポ外ファイルにだけ置き、`fetch_mf.py run`（`--dry-run` を含む）と
`check-config` が起動時に公開 config へ重ねる。`setup` と `fetch_mf_history.py` は使わない（無くても動く）。

- 置き場所: `~/.mf-snapshot/private-config.json`（環境変数 `MF_PRIVATE_CONFIG` があればそちらを優先）。
- 形（**許可するキーはこれだけ**。他のキーがあれば中止）。例はすべて架空名:
  ```json
  {
    "version": 1,
    "exclude": {
      "accounts": ["テスト交通系IC", "テスト社員持株会", "=テスト暗号口座"]
    },
    "liabilityAccountMap": { "テスト銀行A": "自宅" }
  }
  ```
  - `exclude.accounts`（必須・1件以上）: 文字列の配列。**`=` で始まる要素は完全一致**（例の `=テスト暗号口座` は
    「テスト暗号口座」だけを除外し「テスト暗号口座証券」は除外しない）。それ以外は部分一致（「テスト交通系IC」は
    「家族のテスト交通系IC」も除外する）。取込対象の口座名と部分一致で衝突する口座には必ず `=` を付ける。
  - `liabilityAccountMap`（任意）: 口座/金融機関名（部分一致）→ 用途タグ。結果は KV の完全版にだけ載る。
- 作成・更新の手順（Mac mini）:
  ```sh
  mkdir -p ~/.mf-snapshot
  # エディタで ~/.mf-snapshot/private-config.json を作る（中身はチャット・Issue・PR に貼らない）
  chmod 600 ~/.mf-snapshot/private-config.json
  python3 scripts/fetch_mf.py check-config
  ```
  `check-config` はブラウザも通信も使わず、重ね合わせ結果の**件数だけ**を表示する（実名は出さない）:
  ```text
  private=default exclude.accounts=N（完全一致N） liabilityAccountMap=N public.exclude.accounts=0 OK
  ```
  続けて `python3 scripts/fetch_mf.py run --dry-run` で件数と `imported` を確かめる。
- バックアップ: パスワード管理ツールなど**リポ外**に置く。Mac mini を作り直したら同じ形で作り直す。
- **中止する条件**（どれか1つでブラウザを起動せず exit 6・通知。書き出し・KV 送信・commit はしない）:
  ファイルが無い／JSON として読めない／許可外のキーがある／`exclude.accounts` が無い・空・文字列以外・`=` だけの要素・前後に空白のある要素がある／
  `liabilityAccountMap` が object でない・値が文字列でない／**公開 config の `exclude.accounts` が空でない**（実名が公開側に戻った退行）。
  通知には実名を出さない（パスの種類・件数・落ちた条件だけ）。対処は Mac mini で非公開設定を作成・修正して再実行
  （`check-config` → `launchctl kickstart -k gui/$(id -u)/com.toshio.mf-snapshot`）。公開側には何も書かれていないので revert は不要。
- グループ/他人に読み権限があると警告だけ通知する（取込は続ける）。`chmod 600` にする。

---

## 運用・トラブルシュート

| 症状 | 対処 |
|---|---|
| 「取得が 3 回とも一時的な失敗で中止」通知 | `err.log` の `attempt n/3 failed` 行で例外（TimeoutError / EAGAIN / net::ERR_* 等）を確認。表待ちのタイムアウトが続く場合は `fetch.dom` のセレクタずれの可能性。Mac の再起動やプロキシ（UCSS）の状態を確認し、`launchctl kickstart -k gui/$(id -u)/com.toshio.mf-snapshot` で再実行 |
| 「ログイン切れ」通知 | `python3 scripts/fetch_mf.py setup` で再ログイン（MF がセッションを切った時だけ・稀） |
| 「口座ズレ / 総額ズレ」通知 | 除外漏れ or セレクタずれ。`fetch.dom` / 非公開設定の `exclude.accounts` を確認。データは push されていない |
| 「非公開設定の不備で取込を中止」通知（exit 6） | 通知の理由（見つからない・JSON が読めない・許可外のキー 等）を見て、Mac mini で `~/.mf-snapshot/private-config.json` を作成・修正（上の「非公開設定」節）→ `python3 scripts/fetch_mf.py check-config` が OK → `launchctl kickstart -k gui/$(id -u)/com.toshio.mf-snapshot` で再実行 |
| 「口座を1件も抽出できず」 | `fetch.dom`（種類別テーブルのセレクタ/列マップ）が実 DOM と不一致。DevTools で確認して修正 |
| MF が headless を弾く | `data/mf-import-config.json` の `fetch.headless` を `false` に（GUI セッションで headful 実行） |
| ログ | `~/.mf-snapshot/out.log` / `err.log` |

## 安全・前提
- **資格情報をログ/コミットに出さない**（cookie はプロファイル `~/.mf-snapshot/profile`、TG トークンは plist のみ。いずれもリポジトリ外）。
- 出力は既存 v4 スキーマ準拠（`src/networth.js` が読む load-bearing 5項目 `cat/cur/value/totals.imported/asOf` は不変）。
- 除外（口座部分一致＋非公開設定の `=` 始まりは完全一致＋年金/保険/ポイントのカテゴリ除外）・`categoryToCat`・日本株 `.T`/米株ティッカー正規化は `mf-import-config.json` の既存仕様に従う。
- **ToS**: MF はスクレイピングを規約で禁止。自己責任・個人利用。アカウント停止リスクは残る。
- 既存 Chrome 運び屋ルーティン（`docs/routine_mf_snapshot.md`）はローカル自動が安定するまで併存（撤去はユーザー判断）。
