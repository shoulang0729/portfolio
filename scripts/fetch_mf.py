#!/usr/bin/env python3
"""MoneyForward ME → data/mf-holdings.json (v4)。Mac mini ローカル実行・LLM なし（#460）。

設計（docs/handoff/2026-06-21-mf-snapshot-automation.md §0）:
- 決定論 Python(Playwright)で DOM を機械抽出。LLM がページ内容を「命令」として解釈しない
  ＝プロンプトインジェクション穴が原理的に消える。mf-import-config.json は『コードが食うデータ』。
- 永続プロファイルで認証（1回ログイン→持続）。residential IP（Mac mini）で cookie 失効回避。
- ログイン切れ or チェックサム不一致だけ通知して中止（コミットしない）。成功時のみ無人 commit&push。

使い方:
  python fetch_mf.py setup   # 初回: headful でブラウザを開く→手で MF ログイン(2FA)→プロファイル保存
  python fetch_mf.py run     # 定常: launchd が毎日叩く（無人）

⚠ 資格情報（cookie・TG トークン等）はログ/コミットに出さない。
⚠ selectors は data/mf-import-config.json の fetch.selectors。初回 setup で実 DOM に合わせて確定する。
"""
import os
import re
import sys
import json
import subprocess
import datetime
import urllib.request

try:
    from playwright.sync_api import sync_playwright
except ImportError:  # setup 前など Playwright 未導入時に親切なメッセージ
    sync_playwright = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, "data", "mf-import-config.json")
OUT = os.path.join(ROOT, "data", "mf-holdings.json")


def cfg():
    with open(CONFIG, encoding="utf-8") as f:
        return json.load(f)


def notify(msg):
    """失敗時のみ呼ぶ。Telegram(env TG_BOT_TOKEN/TG_CHAT)があれば送る。無ければ stderr＋macOS 通知。"""
    tok, chat = os.environ.get("TG_BOT_TOKEN"), os.environ.get("TG_CHAT")
    if tok and chat:
        try:
            urllib.request.urlopen(
                f"https://api.telegram.org/bot{tok}/sendMessage",
                data=json.dumps({"chat_id": chat, "text": f"[MF snapshot] {msg}"}).encode(),
                timeout=10,
            )
            return
        except Exception:
            pass
    print(f"[NOTIFY] {msg}", file=sys.stderr)
    subprocess.run(
        ["osascript", "-e", f'display notification "{msg}" with title "MF snapshot"'],
        check=False,
    )


# ── パース ───────────────────────────────────────────────────────────────────
def parse_amount(t):
    """『¥1,234,567』『1,234,567 円』等 → int（円）。符号は保持。空/非数は 0。"""
    s = re.sub(r"[^\d-]", "", t or "")
    return int(s) if s and s != "-" else 0


def parse_num(t):
    """小数を含む数値（取得単価/基準価額/株数）→ float or None。"""
    s = re.sub(r"[^\d.\-]", "", t or "")
    try:
        return float(s) if s and s not in ("-", ".") else None
    except ValueError:
        return None


def _txt(loc):
    """Playwright Locator → テキスト（無ければ空文字）。"""
    try:
        if loc.count() == 0:
            return ""
        return loc.first.inner_text().strip()
    except Exception:
        return ""


# ── 認証つきブラウザ（永続プロファイル） ──────────────────────────────────────
def with_page(c, headless, fn):
    if sync_playwright is None:
        print("Playwright 未導入。`pip install playwright && python -m playwright install chromium`", file=sys.stderr)
        sys.exit(4)
    udd = os.path.expanduser(c["fetch"]["userDataDir"])
    os.makedirs(udd, exist_ok=True)
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(udd, headless=headless)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        try:
            return fn(page)
        finally:
            ctx.close()


def do_setup(c):
    """初回: headful でブラウザを開き、手動ログイン（2FA）後 Enter でプロファイル保存。"""
    def _open(page):
        page.goto(c["fetch"]["portfolioUrl"])
        input("MF にログイン(2FA含む)し終えたら Enter…")  # 手動・1回だけ
    with_page(c, headless=False, fn=_open)
    print("プロファイル保存完了。以後 run は自動。")


# ── 抽出（決定論・DOM セレクタ） ※実画面でセレクタ確定が必要（config.fetch.selectors） ──
def scrape(page, c):
    """ポートフォリオ画面から (mfNetWorth, accounts) を機械抽出する。

    accounts = [{ institution, category, accountTotal, rows:[{
        name, code, shares, avgCost, price, value, cur, rawCategory }] }]
    ※ セレクタは実 DOM 確認後に config で確定する（TODO）。構造が変わったら config だけ直す。
    """
    f = c["fetch"]
    sel = f["selectors"]
    page.goto(f["portfolioUrl"], timeout=f["timeoutMs"], wait_until="networkidle")

    # ログイン切れ判定（sign_in へリダイレクト）→ 通知して中止
    if f["loginCheck"]["redirectContains"] in page.url:
        notify("ログイン切れ。`python scripts/fetch_mf.py setup` で再ログインして。")
        sys.exit(2)

    net = parse_amount(_txt(page.locator(sel["netWorth"])))

    accounts = []
    sections = page.locator(sel["accountSection"])
    for i in range(sections.count()):
        sec = sections.nth(i)
        institution = _txt(sec.locator(sel["accountName"]))
        if not institution:
            continue
        category = _txt(sec.locator(sel["accountCategory"]))
        account_total = parse_amount(_txt(sec.locator(sel["accountTotal"])))
        rows = []
        trs = sec.locator(sel["row"])
        for j in range(trs.count()):
            tr = trs.nth(j)
            name = _txt(tr.locator(sel["name"]))
            value = parse_amount(_txt(tr.locator(sel["value"])))
            if not name or value == 0:
                continue
            rows.append({
                "name": name,
                "code": _txt(tr.locator(sel["code"])),
                "shares": parse_num(_txt(tr.locator(sel["shares"]))),
                "avgCost": parse_num(_txt(tr.locator(sel["avgCost"]))),
                "price": parse_num(_txt(tr.locator(sel["price"]))),
                "value": value,
                "cur": _txt(tr.locator(sel["cur"])) or "JPY",
                # rawCategory は口座セクションのカテゴリを継承（MF はカテゴリ別に口座を並べる）
                "rawCategory": category,
            })
        accounts.append({
            "institution": institution,
            "category": category,
            "accountTotal": account_total,
            "rows": rows,
        })
    return net, accounts


# ── 整形（除外/分類/シンボル/レコード化）→ v4 スキーマ ──────────────────────────
def _account_excluded(institution, exclude_accounts):
    """口座/金融機関の除外判定。部分一致。ただし『マネックスCRYPT』は完全名のみ
    （『マネックス証券』との衝突回避・config 注記）。"""
    for e in exclude_accounts:
        if e == "マネックスCRYPT":
            if institution == e:
                return True
        elif e in institution:
            return True
    return False


_STOCK_CATS = ("日本株・ETF", "米国株・ETF")


def _resolve_cat(raw_category, row, cat_map):
    """rawCategory → cat。株式(現物) は市場（4桁コード=日本 / それ以外=米国）で日米分岐。"""
    if raw_category == "株式(現物)":
        code = str(row.get("code", "")).strip()
        is_jp = bool(re.fullmatch(r"\d{4}", code)) or code.endswith(".T")
        return cat_map["株式(現物)_JP"] if is_jp else cat_map["株式(現物)_US"]
    return cat_map.get(raw_category, "その他")


def normalize_symbol(row, cat):
    """日本株/ETF=<code>.T、米国株/ETF=ティッカー。証券以外は None。"""
    if cat not in _STOCK_CATS:
        return None
    code = str(row.get("code", "")).strip()
    if re.fullmatch(r"\d{4}", code):
        return f"{code}.T"
    return code or None


def build(c, net, accounts):
    """v4 スキーマ {asOf, totals{mfNetWorth,imported,excludedAccounts}, holdings[]} を生成。"""
    today = datetime.date.today().isoformat()
    include = set(c["include"]["categories"])
    exclude_accounts = c["exclude"]["accounts"]
    cat_map = c["categoryToCat"]
    cash_in = c.get("cash", {}).get("includeInPositions", True)

    holdings = []
    excluded = []
    for acct in accounts:
        inst = acct["institution"]
        if _account_excluded(inst, exclude_accounts):
            if inst not in excluded:
                excluded.append(inst)
            continue
        for r in acct["rows"]:
            raw = r.get("rawCategory", "")
            if raw not in include:  # allowlist（年金/保険/ポイント等は落ちる）
                continue
            if raw == "預金・現金" and not cash_in:
                continue
            cat = _resolve_cat(raw, r, cat_map)
            rec = {
                "institution": inst,
                "cat": cat,
                "name": r["name"],
                "value": r["value"],
                "cur": r.get("cur") or "JPY",
                "asOf": today,
            }
            ysym = normalize_symbol(r, cat)
            if ysym:
                rec["ySymbol"] = ysym
            if r.get("avgCost") is not None:
                rec["avgCost"] = r["avgCost"]
            if r.get("price") is not None:
                rec["price"] = r["price"]
            holdings.append(rec)

    imported = sum(h["value"] for h in holdings)
    return {
        "asOf": today,
        "totals": {
            "mfNetWorth": net,
            "imported": imported,
            "excludedAccounts": excluded,
        },
        "holdings": holdings,
    }


# ── 検証（チェックサム ±1%）。不一致は書かず・コミットせず・通知して中止 ──────────────
def _within(a, b, tol_pct):
    """a ≈ b を ±tol_pct% で判定（b 基準。b=0 は a=0 のみ許容）。"""
    if b == 0:
        return a == 0
    return abs(a - b) / abs(b) * 100.0 <= tol_pct


def verify(c, doc, accounts):
    tol = c.get("checksum", {}).get("tolerancePct", 1.0)
    holdings = doc["holdings"]
    imported = doc["totals"]["imported"]

    # (1) imported == Σ value 厳密一致
    s = sum(h["value"] for h in holdings)
    if s != imported:
        notify(f"内部不整合: imported={imported:,} != Σholdings={s:,}")
        sys.exit(3)

    # (2) 取込口座ごとに Σ(holdings.value) ≈ MF 口座合計 ±tol%
    by_inst = {}
    for h in holdings:
        by_inst[h["institution"]] = by_inst.get(h["institution"], 0) + h["value"]
    excluded = set(doc["totals"]["excludedAccounts"])
    for acct in accounts:
        inst = acct["institution"]
        if inst in excluded:
            continue
        got = by_inst.get(inst, 0)
        want = acct.get("accountTotal", 0)
        if want and not _within(got, want, tol):
            notify(f"口座ズレ: {inst} 取込{got:,} vs MF表示{want:,}（±{tol}%超）。除外漏れ/読取ミスを疑う。")
            sys.exit(3)

    # (3) mfNetWorth − Σ(除外口座 MF 表示) ≈ imported ±tol%
    excl_total = sum(a.get("accountTotal", 0) for a in accounts if a["institution"] in excluded)
    expect = doc["totals"]["mfNetWorth"] - excl_total
    if not _within(imported, expect, tol):
        notify(f"総額ズレ: imported={imported:,} vs (純資産−除外)={expect:,}（±{tol}%超）。")
        sys.exit(3)


# ── 出力＆無人 commit/push（成功時のみ・承認不要） ─────────────────────────────
def git_commit_push():
    today = datetime.date.today().isoformat()
    subprocess.run(["git", "-C", ROOT, "add", "data/mf-holdings.json"], check=True)
    if subprocess.run(["git", "-C", ROOT, "diff", "--cached", "--quiet"]).returncode == 0:
        print("変更なし（commit せず）")
        return
    subprocess.run(
        ["git", "-C", ROOT, "commit", "-m", f"data: refresh MF holdings snapshot ({today})"],
        check=True,
    )
    subprocess.run(["git", "-C", ROOT, "pull", "--rebase", "origin", "main"], check=True)
    subprocess.run(["git", "-C", ROOT, "push", "origin", "main"], check=True)  # Mac の既存 git 認証で無人 push


def do_run(c):
    net, accounts = with_page(c, headless=c["fetch"]["headless"], fn=lambda pg: scrape(pg, c))
    if not accounts:
        notify("口座を1件も抽出できず。selectors（config.fetch.selectors）の確認が必要。")
        sys.exit(3)
    doc = build(c, net, accounts)
    verify(c, doc, accounts)  # 失敗時 exit(>=2)＝コミットしない
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")
    git_commit_push()
    print(f"OK imported={doc['totals']['imported']:,} holdings={len(doc['holdings'])}")


if __name__ == "__main__":
    conf = cfg()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "run"
    {"setup": do_setup, "run": do_run}.get(cmd, do_run)(conf)
