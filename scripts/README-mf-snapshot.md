# MF 資産スナップショット自動更新（Mac mini ローカル・決定論）

`scripts/fetch_mf.py` が MoneyForward ME のポートフォリオを**決定論的に DOM 抽出**し、
`data/mf-holdings.json`（v4）を更新して無人で commit & push します。**LLM は経路に存在しません**
（＝プロンプトインジェクション穴なし）。設計の根拠は `docs/handoff/2026-06-21-mf-snapshot-automation.md`。

- 承認ゼロ：成功は無通知でコミット。**通知が来るのは「ログイン切れ」か「チェックサム不一致」だけ**。
- 永続プロファイルで MF セッションを保持（1回ログイン→持続）。Mac mini の residential IP で cookie 失効を回避。

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
4. **セレクタ確定（重要・TODO）**: `data/mf-import-config.json` の `fetch.selectors` は暫定値です。
   初回は `python3 scripts/fetch_mf.py run` を手動実行し、`data/mf-holdings.json` の中身と
   `python3 -c "import json;d=json.load(open('data/mf-holdings.json'));print(d['totals'])"` で
   口座/金額が正しいか確認。ズレる場合は実画面の DevTools でセレクタを調べ `fetch.selectors` を修正
   （MF の構造変更時もここだけ直せばよい）。チェックサム不一致時は通知＋中止するので壊れたデータは push されません。
5. **（任意）Telegram 通知**: `~/Library/LaunchAgents/com.toshio.mf-snapshot.plist` の
   `TG_BOT_TOKEN`/`TG_CHAT` を設定（使わないなら `EnvironmentVariables` ブロックごと削除）。
   **トークンはリポジトリにコミットしない**（plist はホームの LaunchAgents にのみ置く）。
6. **launchd 登録**（毎日 09:00 JST）:
   ```sh
   # plist 内のパス（python3 / fetch_mf.py / ログ出力先）を自分の環境に合わせて編集してから
   cp scripts/com.toshio.mf-snapshot.plist ~/Library/LaunchAgents/
   mkdir -p ~/.mf-snapshot
   launchctl load ~/Library/LaunchAgents/com.toshio.mf-snapshot.plist
   ```
7. **動作確認**: `python3 scripts/fetch_mf.py run` を手動実行 → `data/mf-holdings.json` 更新と
   `git log -1` の push を確認。

---

## 運用・トラブルシュート

| 症状 | 対処 |
|---|---|
| 「ログイン切れ」通知 | `python3 scripts/fetch_mf.py setup` で再ログイン（MF がセッションを切った時だけ・稀） |
| 「口座ズレ / 総額ズレ」通知 | 除外漏れ or セレクタずれ。`fetch.selectors` / `exclude.accounts` を確認。データは push されていない |
| 「口座を1件も抽出できず」 | `fetch.selectors.accountSection` が実 DOM と不一致。DevTools で確認して修正 |
| MF が headless を弾く | `data/mf-import-config.json` の `fetch.headless` を `false` に（GUI セッションで headful 実行） |
| ログ | `~/.mf-snapshot/out.log` / `err.log` |

## 安全・前提
- **資格情報をログ/コミットに出さない**（cookie はプロファイル `~/.mf-snapshot/profile`、TG トークンは plist のみ。いずれもリポジトリ外）。
- 出力は既存 v4 スキーマ準拠（`src/networth.js` が読む load-bearing 5項目 `cat/cur/value/totals.imported/asOf` は不変）。
- 除外（口座部分一致＋`マネックスCRYPT` 完全名＋年金/保険/ポイントのカテゴリ除外）・`categoryToCat`・日本株 `.T`/米株ティッカー正規化は `mf-import-config.json` の既存仕様に従う。
- **ToS**: MF はスクレイピングを規約で禁止。自己責任・個人利用。アカウント停止リスクは残る。
- 既存 Chrome 運び屋ルーティン（`docs/routine_mf_snapshot.md`）はローカル自動が安定するまで併存（撤去はユーザー判断）。
