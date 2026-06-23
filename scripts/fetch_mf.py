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
⚠ DOM 構造は data/mf-import-config.json の fetch.dom（資産種類別テーブル＋列インデックスマップ）。
  handoff §7（2026-06-22 実機 headful で確定）。headless はブロックされるため headless:false 固定。
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


def _norm(s):
    """ラベル照合用に空白を畳む（全角コロン等はそのまま）。"""
    return re.sub(r"\s+", "", s or "")


def _cells(tr):
    """行 (tr) の td テキスト配列を 0 始まりで返す。"""
    tds = tr.locator("td")
    return [tds.nth(i).inner_text().strip() for i in range(tds.count())]


def _at(cells, idx):
    """列インデックス安全アクセス。idx が None / 範囲外なら空文字。"""
    if idx is None or idx < 0 or idx >= len(cells):
        return ""
    return cells[idx]


def _net_from_text(text, pattern):
    """本文テキストから資産総額を正規表現で取得（§7.1・DOM class 非依存）。"""
    m = re.search(pattern, text or "")
    return parse_amount(m.group(1)) if m else 0


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


# ── 抽出（決定論・資産種類別テーブル / handoff §7.1 で実機確定） ──────────────────
def _scrape_summary(page, spec):
    """内訳サマリ表 → {正規化カテゴリ名: 円}。種類別チェックサムの照合専用。

    table-bordered で table-{接尾辞} が無いもの（3列: カテゴリ名/円/％）。
    """
    out = {}
    tables = page.locator(spec["selector"])
    lc, ac = spec["labelCol"], spec["amountCol"]
    for i in range(tables.count()):
        trs = tables.nth(i).locator("tbody tr")
        for j in range(trs.count()):
            cells = _cells(trs.nth(j))
            label = _norm(_at(cells, lc))
            amt = parse_amount(_at(cells, ac))
            if label and amt and label not in out:
                out[label] = amt
    return out


def _scrape_table(page, t):
    """1 種類テーブル（eq/mf/depo）→ rows。列インデックスマップ（§7.1）で抽出。

    rows = [{ kind, institution, rawCategory, name, code, shares, avgCost, price, value, cur }]
    """
    cols = t["cols"]
    kind = t["kind"]
    base_cat = t["rawCategory"]
    crypto_kw = t.get("cryptoKeywords", [])
    crypto_cat = t.get("cryptoRawCategory")
    out = []
    tables = page.locator(t["selector"])
    for i in range(tables.count()):
        trs = tables.nth(i).locator("tbody tr")
        for j in range(trs.count()):
            cells = _cells(trs.nth(j))
            if not cells:
                continue
            name = _at(cells, cols.get("name"))
            value = parse_amount(_at(cells, cols.get("value")))
            if not name or value == 0:
                continue  # 小計/空行/見出し行をスキップ
            raw_cat = base_cat
            if crypto_cat and any(k in name for k in crypto_kw):
                raw_cat = crypto_cat  # depo 内の暗号資産を name で分岐（§7.2）
            out.append({
                "kind": kind,
                "institution": _at(cells, cols.get("institution")),
                "rawCategory": raw_cat,
                "name": name,
                "code": _at(cells, cols.get("code")),
                "shares": parse_num(_at(cells, cols.get("shares"))),
                "avgCost": parse_num(_at(cells, cols.get("avgCost"))),
                "price": parse_num(_at(cells, cols.get("price"))),
                "value": value,
                "cur": "JPY",  # /bs/portfolio は全て円換算表示（§7.2）
            })
    return out


def scrape(page, c):
    """ポートフォリオ画面から (mfNetWorth, rows, summary) を機械抽出する（§7.1）。

    rows    = フラットな保有行リスト（各行が institution と kind/rawCategory を持つ）。
    summary = 内訳サマリ表 {正規化カテゴリ名: 円}（種類別チェックサム用・取込対象外）。
    """
    f = c["fetch"]
    dom = f["dom"]
    page.goto(f["portfolioUrl"], timeout=f["timeoutMs"], wait_until="networkidle")
    page.wait_for_timeout(f.get("settleMs", 5000))  # SPA 描画待ち（headful 固定）

    # ログイン切れ判定（sign_in へリダイレクト）→ 通知して中止
    if f["loginCheck"]["redirectContains"] in page.url:
        notify("ログイン切れ。`python scripts/fetch_mf.py setup` で再ログインして。")
        sys.exit(2)

    body = _txt_body(page)
    net = _net_from_text(body, dom["netWorthRegex"])
    summary = _scrape_summary(page, dom["summaryTable"])

    rows = []
    for t in dom["tables"]:
        rows.extend(_scrape_table(page, t))
    return net, rows, summary


def _txt_body(page):
    """ページ本文テキスト（資産総額の正規表現抽出に使う）。"""
    try:
        return page.locator("body").inner_text()
    except Exception:
        return ""


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


def _row_imported(c, r):
    """この行を holdings に取り込むか（build と verify で共有する単一判定）。

    除外口座でなく・rawCategory が allowlist にあり・現金除外設定に抵触しない行のみ True。
    """
    if _account_excluded(r.get("institution", ""), c["exclude"]["accounts"]):
        return False
    raw = r.get("rawCategory", "")
    if raw not in set(c["include"]["categories"]):  # 年金/保険/ポイント等は落ちる
        return False
    if raw == "預金・現金" and not c.get("cash", {}).get("includeInPositions", True):
        return False
    return True


def build(c, net, rows):
    """v4 スキーマ {asOf, totals{mfNetWorth,imported,excludedAccounts}, holdings[]} を生成。

    rows = scrape() のフラット行（各行が institution と rawCategory を持つ・§7.1）。
    """
    today = datetime.date.today().isoformat()
    cat_map = c["categoryToCat"]

    holdings = []
    excluded = []
    for r in rows:
        inst = r.get("institution", "")
        if _account_excluded(inst, c["exclude"]["accounts"]):
            if inst and inst not in excluded:
                excluded.append(inst)
            continue
        if not _row_imported(c, r):
            continue
        cat = _resolve_cat(r.get("rawCategory", ""), r, cat_map)
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


def _kind_by_cat_map(c):
    """holdings の cat → 種類(kind) 逆引き。config（tables + categoryToCat）から生成。"""
    m = c["categoryToCat"]
    out = {}
    for t in c["fetch"]["dom"]["tables"]:
        kind = t["kind"]
        raws = [t["rawCategory"]]
        if t.get("cryptoRawCategory"):
            raws.append(t["cryptoRawCategory"])
        for raw in raws:
            if raw == "株式(現物)":  # 市場で日米に分岐するため両 cat を紐付け
                for k in ("株式(現物)_JP", "株式(現物)_US"):
                    if k in m:
                        out[m[k]] = kind
            elif raw in m:
                out[m[raw]] = kind
    return out


def verify(c, doc, rows, summary):
    """種類別チェックサム（§7.3）。不一致は書かず・コミットせず・通知して中止。"""
    tol = c.get("checksum", {}).get("tolerancePct", 1.0)
    exclude_accounts = c["exclude"]["accounts"]
    tables = c["fetch"]["dom"]["tables"]
    holdings = doc["holdings"]
    imported = doc["totals"]["imported"]
    net = doc["totals"]["mfNetWorth"]
    kind_by_cat = _kind_by_cat_map(c)

    # (1) imported == Σ value 厳密一致
    s = sum(h["value"] for h in holdings)
    if s != imported:
        notify(f"内部不整合: imported={imported:,} != Σholdings={s:,}")
        sys.exit(3)

    # (2') 種類別: Σ(取込 kind) ≈ サマリ「種類」値 − Σ(除外 kind) ±tol%
    imported_labels = set()
    for t in tables:
        kind = t["kind"]
        label = t.get("summaryLabel", "")
        key = _norm(label)
        imported_labels.add(key)
        want_total = summary.get(key)
        if want_total is None:
            notify(f"サマリ欠落: 種類『{label}』の内訳サマリ値が読めず。DOM 変化を疑う。")
            sys.exit(3)
        excl_kind = sum(r["value"] for r in rows
                        if r.get("kind") == kind
                        and _account_excluded(r.get("institution", ""), exclude_accounts))
        want = want_total - excl_kind  # サマリは除外口座分を含むので差し引く
        got = sum(h["value"] for h in holdings if kind_by_cat.get(h["cat"]) == kind)
        if not _within(got, want, tol):
            notify(f"種類ズレ: {label} 取込{got:,} vs (サマリ−除外){want:,}（±{tol}%超）。")
            sys.exit(3)

    # (3) mfNetWorth − Σ(非取込サマリ種類) − Σ(除外口座 holdings) ≈ imported ±tol%
    #     非取込＝年金/保険/ポイント等。総額行（amt==net）はサマリから除く。
    non_imported = sum(amt for lbl, amt in summary.items()
                       if lbl not in imported_labels and amt != net)
    excl_holdings = sum(r["value"] for r in rows
                        if _account_excluded(r.get("institution", ""), exclude_accounts))
    expect = net - non_imported - excl_holdings
    if not _within(imported, expect, tol):
        notify(f"総額ズレ: imported={imported:,} vs (純資産−非取込−除外)={expect:,}（±{tol}%超）。")
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
    net, rows, summary = with_page(c, headless=c["fetch"]["headless"], fn=lambda pg: scrape(pg, c))
    if not rows:
        notify("保有行を1件も抽出できず。fetch.dom（種類別テーブルのセレクタ/列マップ §7.1）を確認。")
        sys.exit(3)
    doc = build(c, net, rows)
    verify(c, doc, rows, summary)  # 失敗時 exit(>=2)＝コミットしない
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")
    git_commit_push()
    print(f"OK imported={doc['totals']['imported']:,} holdings={len(doc['holdings'])}")


if __name__ == "__main__":
    conf = cfg()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "run"
    {"setup": do_setup, "run": do_run}.get(cmd, do_run)(conf)
