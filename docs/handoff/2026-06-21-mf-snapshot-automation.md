# 実装スペック: MoneyForward 資産スナップショット 自動更新（Mac mini ローカル・決定論）

> 設計=Mulmo / 実装=VS Code。設計は変えず、矛盾あれば止めて報告（`docs/mulmo-vscode-workflow.md`）。
> **2026-06-21 改訂**: クラウド GitHub Actions 版から **Mac mini ローカル launchd ＋ Playwright 永続プロファイル ＋ 決定論抽出** 版へ全面差し替え（理由＝§0）。

> ✅ **実装完了（2026-06-22・PR #462 / Issue#460 マージ済）**＝`scripts/fetch_mf.py`(setup/run・永続プロファイル・抽出・除外・v4整形・±1%検証・git push・通知)＋`com.toshio.mf-snapshot.plist`＋`README-mf-snapshot.md`＋config `fetch`。\n> ⏳ **残＝本人の実機作業2点**：①DOMセレクタ確定（暫定値→実画面で調整）②plistのパス/venv python を実環境へ。\n\n## 0. 設計の核（なぜこの形か）

過去に「Claude for Chrome（LLM）運び屋」は **commit を拒否**した。理由は正当で、ルーティンが「外部URLから取得した設定とライブWebページの内容を"従うべき命令"として扱え（限定ルールに従え）」という構造＝**プロンプトインジェクションの導線**だったため。LLM を判断者に置く限りこの穴は消えない。かつユーザーは **毎日承認したくない（完全自動が目的）**。

→ 結論：**LLM をデータ経路から外す**。
- **決定論 Python（Playwright）でDOMを機械的に抽出**＝LLM がページ内容を命令として解釈しない＝**injection 穴が原理的に消える**。`mf-import-config.json` は「従う命令」でなく **コードが食う"データ/パラメータ"**。
- **Mac mini（常時起動・residential IP）で動かす**＝クラウドの「データセンターIPブロック／cookie失効」問題が消える。**Playwright 永続プロファイル**にMFを1回ログインしておけば普通のブラウザ同様セッションが持続＝cookie入れ替えはほぼ不要（MFが切った時だけ手動再ログイン）。
- **承認ゼロ**：cron相当(launchd)で回り、チェックサムOKなら**黙って commit&push**。**不一致 or ログイン切れの時だけ通知**（成功は無通知）。

## 1. `data/mf-import-config.json` に `fetch` を追加（既存v4は不変）

`version/include/exclude/cash/categoryToCat/schema/checksum/commit` は**触らない**。取得パラメータだけ新設（**これは"命令"でなくコードが読むデータ**）：

```jsonc
{
  // ...既存v4は不変...
  "fetch": {
    "engine": "playwright-persistent",
    "userDataDir": "~/.mf-snapshot/profile",      // 永続ブラウザプロファイル(ログイン保持)
    "portfolioUrl": "https://moneyforward.com/bs/portfolio",
    "headless": true,                              // MFが弾くなら false に(launchdはGUIセッションで実行)
    "timeoutMs": 45000,
    "loginCheck": { "redirectContains": "sign_in" },  // この時はログイン切れ→通知して中止
    "selectors": {                                 // ※実DOM確認後に確定(TODO)
      "netWorth": ".heading-radius-box .amount",
      "accountSection": ".bs-detail .account, section.account",
      "accountName": ".account-name, h1.heading-normal",
      "row": "table tbody tr",
      "name": "td:nth-child(1)", "shares": "td:nth-child(2)",
      "avgCost": "td:nth-child(3)", "price": "td:nth-child(4)", "value": "td:last-child"
    }
  }
}
```

除外（`exclude.accounts` 部分一致／`マネックスCRYPT` 完全名／年金・保険・ポイントのカテゴリ除外）と `categoryToCat` は**既存仕様を流用**。

## 2. `scripts/fetch_mf.py`（決定論・永続プロファイル）

```python
#!/usr/bin/env python3
"""MoneyForward ME → data/mf-holdings.json(v4)。Mac mini ローカル実行・LLMなし。
- 永続プロファイルで認証(1回ログイン→持続)。ログイン切れは通知して中止(コミットしない)。
- チェックサム ±1% 不一致は書かず通知して中止。
- 成功時のみ git add/commit/push(main)。承認不要。

使い方:
  python fetch_mf.py setup   # 初回: headfulでブラウザを開く→手でMFログイン(2FA)→プロファイル保存
  python fetch_mf.py run     # 定常: launchdが毎日叩く
"""
import os, re, sys, json, subprocess, datetime, urllib.request
from playwright.sync_api import sync_playwright

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, "data", "mf-import-config.json")
OUT    = os.path.join(ROOT, "data", "mf-holdings.json")

def cfg(): 
    with open(CONFIG, encoding="utf-8") as f: return json.load(f)

def notify(msg):
    """失敗時のみ呼ぶ。Telegram(env TG_BOT_TOKEN/TG_CHAT)あれば送る。無ければ stderr＋macOS通知。"""
    tok, chat = os.environ.get("TG_BOT_TOKEN"), os.environ.get("TG_CHAT")
    if tok and chat:
        try:
            urllib.request.urlopen(f"https://api.telegram.org/bot{tok}/sendMessage",
                data=json.dumps({"chat_id": chat, "text": f"[MF snapshot] {msg}"}).encode(),
                timeout=10)
            return
        except Exception: pass
    print(f"[NOTIFY] {msg}", file=sys.stderr)
    subprocess.run(["osascript","-e",f'display notification "{msg}" with title "MF snapshot"'], check=False)

# --- 認証つきブラウザ(永続プロファイル) ---
def with_page(c, headless, fn):
    f = c["fetch"]; udd = os.path.expanduser(f["userDataDir"])
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(udd, headless=headless)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        try: return fn(page)
        finally: ctx.close()

def do_setup(c):
    def _open(page):
        page.goto(c["fetch"]["portfolioUrl"])
        input("MF にログイン(2FA含む)し終えたら Enter…")  # 手動・1回だけ
    with_page(c, headless=False, fn=_open)
    print("プロファイル保存完了。以後 run は自動。")

# --- 抽出(決定論・DOMセレクタ) ※実画面で要確定(TODO) ---
def scrape(page, c):
    f = c["fetch"]
    page.goto(f["portfolioUrl"], timeout=f["timeoutMs"], wait_until="networkidle")
    if f["loginCheck"]["redirectContains"] in page.url:
        notify("ログイン切れ。`python fetch_mf.py setup` で再ログインして。")
        sys.exit(2)
    net = parse_amount(page.locator(f["selectors"]["netWorth"]).first.inner_text())
    accounts = []   # [{institution, accountTotal, rows:[{name,shares,avgCost,price,value,cur,code,rawCategory}]}]
    # selectors で口座セクション→行を機械抽出(TODO実装)
    return net, accounts

def parse_amount(t): return int(re.sub(r"[^\d-]","",t or "0") or 0)

# --- 整形(除外/分類/シンボル/レコード化)・検証・出力 は handoff 旧版§2と同じ ---
def build(c, net, accounts): ...      # v4スキーマ(asOf/totals{mfNetWorth,imported,excludedAccounts}/holdings[])
def verify(c, doc, accounts): ...     # ±1% 不一致→ notify して sys.exit(3)。コミットしない
def normalize_symbol(r): 
    code=str(r.get("code","")).strip(); return f"{code}.T" if re.fullmatch(r"\d{4}",code) else code

def git_commit_push():
    today = datetime.date.today().isoformat()
    subprocess.run(["git","-C",ROOT,"add","data/mf-holdings.json"], check=True)
    if subprocess.run(["git","-C",ROOT,"diff","--cached","--quiet"]).returncode == 0:
        print("変更なし"); return
    subprocess.run(["git","-C",ROOT,"commit","-m",f"data: refresh MF holdings snapshot ({today})"], check=True)
    subprocess.run(["git","-C",ROOT,"pull","--rebase","origin","main"], check=True)
    subprocess.run(["git","-C",ROOT,"push","origin","main"], check=True)   # Macの既存git認証で無人push

def do_run(c):
    net, accounts = with_page(c, headless=c["fetch"]["headless"], fn=lambda pg: scrape(pg, c))
    doc = build(c, net, accounts)
    verify(c, doc, accounts)                 # 失敗時 exit(>=2)＝コミットしない
    with open(OUT,"w",encoding="utf-8") as f: json.dump(doc, f, ensure_ascii=False, indent=2)
    git_commit_push()
    print(f"OK imported={doc['totals']['imported']:,} holdings={len(doc['holdings'])}")

if __name__ == "__main__":
    c = cfg()
    {"setup": do_setup, "run": do_run}.get(sys.argv[1] if len(sys.argv)>1 else "run", do_run)(c)
```

## 3. launchd（毎日09:00 JST） `scripts/com.toshio.mf-snapshot.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.toshio.mf-snapshot</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/shoulang/.mf-snapshot/venv/bin/python</string>  <!-- ★venvのpython(システムpython直は使わない) -->
    <string>/Users/shoulang/github/portfolio/scripts/fetch_mf.py</string>
    <string>run</string>
  </array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/Users/toshio/.mf-snapshot/out.log</string>
  <key>StandardErrorPath</key><string>/Users/toshio/.mf-snapshot/err.log</string>
  <!-- TG通知を使うなら -->
  <key>EnvironmentVariables</key><dict>
    <key>TG_BOT_TOKEN</key><string>__set_or_omit__</string>
    <key>TG_CHAT</key><string>__set_or_omit__</string>
  </dict>
</dict></plist>
```
> ※パス `/Users/toshio/...` は実環境に合わせる。launchd はログイン中GUIセッションで走る（headful が要るなら `headless:false`）。

## 4. ワンタイム・セットアップ（ユーザー作業・手順書化）

実装と一緒に `scripts/README-mf-snapshot.md` を作り、下記を記載：
1. Mac mini に `github/portfolio` を clone（git push 認証は既存のものを使用）。
2. **専用 venv を作る**（macOS はシステム python に直 pip 不可＝PEP668）。`python3` が無ければ先に `xcode-select --install`：
   ```bash
   python3 -m venv ~/.mf-snapshot/venv
   ~/.mf-snapshot/venv/bin/pip install --upgrade pip playwright
   ~/.mf-snapshot/venv/bin/python -m playwright install chromium
   ```
3. `~/.mf-snapshot/venv/bin/python scripts/fetch_mf.py setup` → 開いたブラウザで MF にログイン（2FA）→ Enter（プロファイル保存）。
   ※以降 `run` も同じ venv python で叩く（launchd plist も venv python を指す＝§3）。
4. （任意）Telegram 通知を使うなら plist の `TG_*` を設定。
5. `cp scripts/com.toshio.mf-snapshot.plist ~/Library/LaunchAgents/ && launchctl load ~/Library/LaunchAgents/com.toshio.mf-snapshot.plist`。
6. 動作確認：`python scripts/fetch_mf.py run` を手動実行→ mf-holdings.json 更新＆push を確認。

## 5. 認証・運用・リスク
- **再ログイン**：永続プロファイルでセッション持続。MF が切った時だけ `setup` で再ログイン（通知が来る）。毎回の cookie 入れ替え不要。
- **承認ゼロ**：成功は無通知で commit。**通知が来るのは「ログイン切れ」か「チェックサム不一致」だけ**。
- **injection 安全**：LLM 不在。config は命令でなくデータ。MFページ内容は数値抽出のみで解釈しない。
- **ToS**：MF はスクレイピング規約違反。自己責任・個人利用。アカウント停止リスクは残る。
- **headless 検知**：MF が headless を弾く場合 `headless:false`（GUIセッションで headful 実行）。
- **資格情報をログ/コミットに出さない**（TGトークン・cookie等）。

## 6. 受け入れ基準 / スコープ外
**受け入れ基準**
- [ ] `python fetch_mf.py setup` で永続プロファイルにMFログインが保存され、以後 `run` が無人で動く。
- [ ] 出力が既存 v4 スキーマ準拠（load-bearing 5項目 `cat/cur/value/totals.imported/asOf`）。
- [ ] 除外（口座 partial＋マネックスCRYPT完全名＋年金/保険/ポイント）・`categoryToCat`・日本株`.T`/米株ティッカー正規化が既存仕様通り。
- [ ] チェックサム ±1% 不一致 → 書かず・コミットせず・通知。
- [ ] ログイン切れ → 書かず・通知（再ログイン促す）。
- [ ] 成功時のみ commit&push（`pull --rebase` 後）・**承認不要**・残骸ブランチ作らず main 直。
- [ ] launchd plist＋セットアップ README 同梱。資格情報を出力しない。

**スコープ外（次フェーズ）**
- 既存 Chrome 運び屋ルーティン（`docs/routine_mf_snapshot.md`）の撤去可否はユーザー判断（当面は併存→ローカル自動が安定したら撤去）。
- Mulmo PM モニタで `mf-holdings.json` の鮮度監視（N日更新なし→アラート）＝別タスクで追加可。
- cookie/プロファイルの自動リフレッシュ（現状は稀な手動再ログイン）。

---

> 🚀 **無人運用 稼働開始（2026-06-25）**＝Mac mini に launchd `com.toshio.mf-snapshot`(毎朝09:00 JST) 登録済み・git remote を SSH化(`git@github.com`・PAT不要/無期限)・`ssh -T` 認証OK・launchd経由の実走で取得→SSH push 成功(origin `40a587e` asOf 2026-06-25 / imported 530,893,757 / 49)。**MF取込は Mac mini 1本に統一・承認ゼロで毎朝自動更新。** 前提＝Mac miniはログイン状態で常時起動(headful)。
> 🎉 **実機検証 完了（2026-06-23）**＝Mac mini ローカル run が抽出→種類別チェックサム通過→commit→push 成功。origin/main `b09fdd1`＝asOf 2026-06-23 / mfNetWorth 585,034,186 / imported 540,500,188 / 49 holdings。残＝launchd登録（無人化）＋無人push認証のkeychainキャッシュ。
> ✅ **§7改修 実装完了（2026-06-23・PR #467 / Closes #466）**＝scrape/build/verify を資産種類別テーブル方式に刷新・`fetch.dom`列マップ・headless:false・種類別checksum・テスト11件green・CodeRabbit実バグ(summaryセレクタ自己矛盾)修正込み。残＝Mac miniで run の実機確認(§7.4)。

## 7. 実DOM確定 & 改修指示（2026-06-22・実機headfulで確認）★scrape/build/verify を作り直す

初回 run が「口座を1件も抽出できず」で停止（＝安全に未push）。実機 headful で MF `/bs/portfolio` を確認した結果、**当初想定（口座セクション単位）が誤りで、実構造は「資産種類別テーブル＋保有金融機関は列」**だった。下記に作り直す。

### 7.1 確定した DOM 構造
- **headless はブロックされる**（空ページ）。→ `fetch.headless = false` に固定（launchd は GUI ログインセッションで headful 実行）。`settleMs`≈5000 待つ。
- **資産総額**：本文テキストに `資産総額： 585,034,186円`。→ 正規表現 `資産総額[：:]\s*([0-9,]+)` で取得（DOM class に依存しない）。
- **内訳サマリ表**＝`table.table-bordered` で **table-{depo,eq,mf,pns…} 接尾辞が無い**もの（3列：カテゴリ名／円／％）。**種類別チェックサムに使う**（例：株式(現物)=338,454,356円）。
- **保有テーブル（処理対象）**：列は0始まりインデックス。
  | テーブル | `selector` | kind | 列マップ |
  |---|---|---|---|
  | 預金・現金・暗号資産 | `table.table-bordered.table-depo` | `depo` | name=0(種類・名称), value=1(残高), institution=2 |
  | 株式(現物) | `table.table-bordered.table-eq` | `eq` | code=0, name=1, shares=2, avgCost=3, price=4(現在値), value=5(評価額), institution=9 |
  | 投資信託 | `table.table-bordered.table-mf` | `mf` | name=0, shares=1, avgCost=2, price=3(基準価額), value=4(評価額), institution=8 |
- **無視/除外**：`table.table-condensed`（カレンダー部品・多数）＝完全無視。`table-pns`（保険/年金/ポイント）＝**年金/保険/ポイント除外ルールに合致＝スキップ**。内訳サマリ表＝保有として取り込まない（照合専用）。
- 行は `tbody tr`。各セルは `td:nth(i)` の inner_text。金額は `[^\d-]` 除去で整数化。

### 7.2 cat / シンボル / 通貨
- **cat**：`depo`→ 名称に ビットコイン/イーサリアム/暗号 を含めば`暗号資産`、他は`現金・預金`。`eq`→ code が4桁数字なら`日本株・ETF`＋`ySymbol="<code>.T"`、英字ティッカーなら`米国株・ETF`＋`ySymbol=ティッカー`、code空（持株会等）は institution 除外で大半が落ちる。`mf`→`投資信託`（code無し・name基準）。
- **通貨**：`/bs/portfolio` の 評価額/残高 は**すべて円換算表示**。→ `cur="JPY"` で統一（value は円）。`imported=Σ(円)` と整合。
- **institution**：各行の 保有金融機関 列。`exclude.accounts` の部分一致（`マネックスCRYPT` は完全名）で行ごとに除外判定。

### 7.3 checksum 改修（口座別→種類別）
MF のこのページに**口座別合計は無い**ので、当初の「口座ごと±1%」は**種類別±1%**に置換：
- (1) `imported == Σ(holdings.value)` 厳密一致。
- (2') **種類別**：Σ(`table-eq` 取込行) ≈ サマリ「株式(現物)」値 ±1%、Σ(`table-mf`) ≈ 「投資信託」±1%、Σ(取込`depo`) ≈ 「預金・現金・暗号資産」±1%（除外口座=Suica等を引いた値で照合）。
- (3) `mfNetWorth(資産総額) − Σ(除外分: 年金/保険/ポイント＋持株会等除外口座) ≈ imported` ±1%。
- いずれか外れたら **書かず・push せず・通知**（既存どおり）。
- 参考実測（2026-06-22）：資産総額 585,034,186 / 株式(現物) 338,454,356 / 投資信託 130,537,011 / 預金・現金・暗号資産 73,515,659。

### 7.4 受け入れ基準（追加）
- [ ] `headless:false` で MF が描画され、`table-eq/table-mf/table-depo` から保有が抽出される。
- [ ] `table-pns`/`table-condensed`/内訳サマリは取り込まない。
- [ ] institution は行の 保有金融機関 列から取得し、除外判定が効く（持株会/Suica/相対契約 等が落ちる）。
- [ ] 種類別チェックサム（7.3）が通り、外れたら未push＋通知。
- [ ] v4 スキーマ・load-bearing 5項目は不変。
