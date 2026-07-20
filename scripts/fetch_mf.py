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

★#589 Phase2（docs/handoff/2026-07-20-networth-privacy-hardening.md）: 負債/実物資産込みの
完全版は push_networth_to_worker() で PIN 認証つき Worker PUT /networth(KV) へ送るだけで、
公開リポには sanitize_for_public() で機微フィールドを除去したコピー（v4 互換形）だけを commit
する。環境変数 MF_WORKER_URL / MF_PIN_HASH が未設定でも fail-soft（notify のみ）で公開 commit
フローは止まらない。
"""
import os
import re
import sys
import json
import time
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
    # msg にはサマリ/口座名などページ由来値が入りうるため、AppleScript 文字列へ
    # 直挿しせず argv 経由で渡す（" や改行による破壊・注入を防ぐ・#481）。
    subprocess.run(
        ["osascript",
         "-e", "on run argv",
         "-e", 'display notification (item 1 of argv) with title "MF snapshot"',
         "-e", "end run",
         msg],
        check=False,
    )


# ── パース ───────────────────────────────────────────────────────────────────
def parse_amount(t):
    """『¥1,234,567』『1,234,567 円』等 → int（円）。符号は保持。空/非数は 0。

    parse_num と対称に int() を保護する（#480）。想定外文字（中黒ダッシュ等が
    途中に混じった "1234-567" 等）でも例外を投げず 0 を返す（無人運用での無音
    クラッシュ防止）。
    """
    s = re.sub(r"[^\d-]", "", t or "")
    try:
        return int(s) if s and s != "-" else 0
    except ValueError:
        return 0


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
    """行 (tr) のセルテキスト配列を DOM 順・0 始まりで返す（#469）。

    内訳サマリ表は category 名が <th>（行見出し）・円/% が <td> の混在のため
    th と td の両方を DOM 順で読む。保有テーブル(eq/mf/depo)のデータ行は td のみ
    （th 無し）なので列インデックスは不変。
    """
    cells = tr.locator("th, td")
    return [cells.nth(i).inner_text().strip() for i in range(cells.count())]


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


# ── 負債スクレイピング（#577 スコープA・fail-soft） ─────────────────────────────
def scrape_liabilities(page, c):
    """/bs/liability の負債行を抽出する。成功時 rows=[{institution,name,balance}]、
    失敗時 None（notify 済み）。

    ★fail-soft（config fetch.liabilities.onFailure）: 負債の取得失敗・0行・
    チェックサム不一致は notify して None を返すだけ。資産スナップショットの
    commit は止めない（呼び出し側は None なら v4 互換形のまま出力する）。
    DOM は実機未確認（2026-07-19）＝セレクタ/列は config だけで調整できる。
    """
    lc = c.get("fetch", {}).get("liabilities")
    inc = c.get("include", {}).get("liabilities", {})
    if not lc or not inc.get("enabled"):
        return None
    try:
        f = c["fetch"]
        page.goto(lc["url"], timeout=f["timeoutMs"], wait_until="networkidle")
        page.wait_for_timeout(f.get("settleMs", 5000))
        if f["loginCheck"]["redirectContains"] in page.url:
            notify("負債: ログイン切れで /bs/liability を開けず。負債はスキップ。")
            return None
        total = _net_from_text(_txt_body(page), lc["totalRegex"])
        cats = inc.get("categories", [])
        cols = lc["table"]["cols"]
        rows = []
        tables = page.locator(lc["table"]["selector"])
        for i in range(tables.count()):
            trs = tables.nth(i).locator("tbody tr")
            for j in range(trs.count()):
                cells = _cells(trs.nth(j))
                name = _at(cells, cols.get("name"))
                bal = parse_amount(_at(cells, cols.get("balance")))
                inst = _at(cells, cols.get("institution"))
                if not name or bal <= 0:
                    continue  # 空行/見出し/完済(0円)をスキップ
                if cats and not any(k in name or k in inst for k in cats):
                    continue  # 負債側 allowlist（部分一致・config include.liabilities）
                rows.append({"institution": inst, "name": name, "balance": bal})
        if not rows:
            notify("負債: 行を1件も抽出できず。fetch.liabilities.table（セレクタ/列マップ）の実機確認を。負債はスキップ。")
            return None
        s = sum(r["balance"] for r in rows)
        tol = lc.get("checksum", {}).get("tolerancePct", 1.0)
        if total and not _within(s, total, tol):
            notify(f"負債: チェックサム不一致 Σ{s:,} vs 負債総額{total:,}（±{tol}%超）。負債はスキップ。")
            return None
        if not total:
            print("[liab] 負債総額が本文から読めず。行合計をそのまま採用（照合スキップ）", file=sys.stderr)
        return rows
    except Exception as e:  # 負債は資産を巻き込まない（fail-soft）
        notify(f"負債: 取得中に例外 {type(e).__name__}: {e}。負債はスキップ。")
        return None


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
        key = "株式(現物)_JP" if is_jp else "株式(現物)_US"
        return cat_map.get(key, "その他")  # config 編集でキー欠落時も KeyError にしない（#482）
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


# ── 不動産評価額スクレイピング（#580 スコープA'・fail-soft） ────────────────────
def scrape_real_estate(page, c):
    """/bs/portfolio の不動産テーブルから物件ごとの評価額（HowMa連携値）を抽出する。

    scrape() 直後（＝portfolio ページ表示中・負債ページ遷移前）に呼ぶこと。追加 goto 無し。
    nameMap（双方向部分一致）でマッチした行の value 列を採用。
    戻り値 {fileId: 評価額}。無効/失敗/0件は None（notify 済み・fail-soft: 既存 valueHowMa 維持）。
    """
    rc = c.get("fetch", {}).get("realEstate", {})
    if not rc.get("enabled"):
        return None
    name_map = {k: v for k, v in rc.get("nameMap", {}).items() if k != "note"}
    if not name_map:
        # #589 Phase1 で公開 config から物件名マップ（PII）を撤去済み＝意図した空。
        # 非公開ストアのマップが用意されるまで静かにスキップ（毎日の誤通知を防ぐ）。
        return None
    try:
        cols = rc["table"]["cols"]
        out = {}
        tables = page.locator(rc["table"]["selector"])
        for i in range(tables.count()):
            trs = tables.nth(i).locator("tbody tr")
            for j in range(trs.count()):
                cells = _cells(trs.nth(j))
                name = _at(cells, cols.get("name"))
                val = parse_amount(_at(cells, cols.get("value")))
                if not name or val <= 0:
                    continue
                for mf_name, fid in name_map.items():
                    if (mf_name in name or name in mf_name) and fid not in out:
                        out[fid] = val
        if not out:
            notify("不動産: 物件マッチ0件。fetch.realEstate（セレクタ/nameMap）の実機確認を。valueHowMa は維持。")
            return None
        return out
    except Exception as e:  # 不動産は資産・負債を巻き込まない（fail-soft）
        notify(f"不動産: 取得中に例外 {type(e).__name__}: {e}。valueHowMa は維持。")
        return None


def update_real_assets(c, re_vals):
    """data/real-assets/<id>.json の valueHowMa だけを field-level merge で更新する（#580）。

    掛目・ローン等の手入力項目は保持（valueHowMa 以外は書かない）。
    前回比±guardPct%超は異常値として維持＋通知。値が同じならファイルを触らない。
    戻り値: 更新したファイル数。
    """
    if not re_vals:
        return 0
    rel = c.get("realAssets", {}).get("dir", "data/real-assets")
    d = os.path.join(ROOT, *rel.split("/"))
    guard = c.get("fetch", {}).get("realEstate", {}).get("guardPct", 50)
    updated = 0
    for fid, val in re_vals.items():
        path = os.path.join(d, f"{fid}.json")
        if not os.path.isfile(path):
            notify(f"不動産: {fid}.json が data/real-assets/ に無く更新できず（valueHowMa は維持）。")
            continue
        try:
            with open(path, encoding="utf-8") as f:
                rec = json.load(f)
        except Exception as e:
            notify(f"不動産: {fid}.json の読込に失敗 {type(e).__name__}: {e}（valueHowMa は維持）。")
            continue
        old = rec.get("valueHowMa")
        if isinstance(old, (int, float)) and old > 0 and abs(val - old) / old * 100.0 > guard:
            notify(f"不動産: {rec.get('name', fid)} の新値 {val:,} が前回 {int(old):,} 比 ±{guard}% 超（異常値扱い・維持）。")
            continue
        if old == val:
            continue  # 変化なし＝無駄な diff/commit を作らない
        rec["valueHowMa"] = val
        with open(path, "w", encoding="utf-8") as f:
            json.dump(rec, f, ensure_ascii=False, indent=2)
            f.write("\n")
        updated += 1
    return updated


# ── v5: 負債・実物資産の付与（#577。verify 後に付与＝資産チェックサムに影響しない） ──
def real_assets_total(c):
    """data/real-assets/ の採用値（valueAdopted、無ければ valueHowMa×haircut、
    さらに無ければ value）を合算する。コレクション未着地/読めないレコードは 0 扱い
    （#577 A' は Mulmo の schema/レコード投入待ち）。"""
    rel = c.get("realAssets", {}).get("dir", "data/real-assets")
    d = os.path.join(ROOT, *rel.split("/"))
    if not os.path.isdir(d):
        return 0
    total = 0
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".json"):
            continue
        try:
            with open(os.path.join(d, fn), encoding="utf-8") as fp:
                j = json.load(fp)
        except Exception:
            continue  # 壊れたレコードは合算しない（採用値の過大計上より欠落を選ぶ）
        for r in j if isinstance(j, list) else [j]:
            if not isinstance(r, dict):
                continue
            v = r.get("valueAdopted")
            if not isinstance(v, (int, float)):
                hw, hc = r.get("valueHowMa"), r.get("haircut")
                if isinstance(hw, (int, float)):
                    v = hw * (hc if isinstance(hc, (int, float)) else 1.0)
                elif isinstance(r.get("value"), (int, float)):
                    v = r["value"]
                else:
                    v = 0
            total += int(round(v))
    return total


def _liab_tag(institution, name, account_map):
    """liabilityAccountMap（口座名 部分一致）→ 物件/用途タグ。未マッチは空文字。"""
    for k, v in account_map.items():
        if k == "note":
            continue
        if k in (institution or "") or k in (name or ""):
            return v
    return ""


def attach_liabilities(c, doc, liab_rows):
    """負債取得成功時のみ v5 フィールドを doc に付与する（失敗時 None＝v4 互換形のまま）。

    netWorthComputed = imported + realAssetsTotal − liabilitiesTotal（handoff 2026-07-19）。
    既存 mfNetWorth（MF 画面の資産グロス生値）は比較用にそのまま残す。
    """
    if liab_rows is None:
        return doc
    m = c.get("liabilityAccountMap", {})
    today = doc["asOf"]
    doc["liabilities"] = [
        {
            "institution": r["institution"],
            "name": r["name"],
            "tag": _liab_tag(r["institution"], r["name"], m),
            "balance": r["balance"],
            "asOf": today,
        }
        for r in liab_rows
    ]
    lt = sum(r["balance"] for r in liab_rows)
    ra = real_assets_total(c)
    doc["totals"]["liabilitiesTotal"] = lt
    doc["totals"]["realAssetsTotal"] = ra
    doc["totals"]["netWorthComputed"] = doc["totals"]["imported"] + ra - lt
    return doc


# ── 公開コミット用サニタイズ（#589 Phase2） ─────────────────────────────
# 完全版（liabilities 込み・Worker /networth KV 送信用）から機微フィールドを
# 除去したコピーを作る。公開リポ（data/mf-holdings.json）にはこちらだけを書く。
_SANITIZE_TOTALS_FIELDS = ("liabilitiesTotal", "realAssetsTotal", "netWorthComputed")


def sanitize_for_public(doc):
    """機微フィールド（liabilities 配列 / totals の負債・実物資産・計算純資産）を
    除いた deep copy を返す（v4 互換形）。引数 doc は変更しない。"""
    public_doc = json.loads(json.dumps(doc))
    public_doc.pop("liabilities", None)
    totals = public_doc.get("totals", {})
    for k in _SANITIZE_TOTALS_FIELDS:
        totals.pop(k, None)
    return public_doc


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
        # summaryLabel は文字列 or 文字列リスト（MF が内訳サマリ行を分割した種類は複数ラベルを合算）。
        labels = t.get("summaryLabel", "")
        if isinstance(labels, str):
            labels = [labels]
        keys = [_norm(l) for l in labels]
        imported_labels.update(keys)
        missing = [labels[i] for i, k in enumerate(keys) if summary.get(k) is None]
        if missing:
            notify(f"サマリ欠落: 種類『{'/'.join(missing)}』の内訳サマリ値が読めず。DOM 変化を疑う。")
            sys.exit(3)
        want_total = sum(summary[k] for k in keys)
        excl_kind = sum(r["value"] for r in rows
                        if r.get("kind") == kind
                        and _account_excluded(r.get("institution", ""), exclude_accounts))
        want = want_total - excl_kind  # サマリは除外口座分を含むので差し引く
        got = sum(h["value"] for h in holdings if kind_by_cat.get(h["cat"]) == kind)
        if not _within(got, want, tol):
            notify(f"種類ズレ: {'/'.join(labels)} 取込{got:,} vs (サマリ−除外){want:,}（±{tol}%超）。")
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


# ── Worker /networth(KV) 送信（#589 Phase2・fail-soft） ─────────────────────
# 完全版 doc（liabilities/realAssetsTotal/netWorthComputed 込み）を PIN 認証つき
# Worker PUT /networth に送る。公開リポへの commit（sanitize 済み v4 形）とは
# 完全に独立＝ここが失敗しても git_commit_push は必ず実行される（fail-soft）。
def push_networth_to_worker(doc):
    """Worker PUT /networth(KV) へ完全版 doc を送信する。

    環境変数:
      MF_WORKER_URL — Worker のベース URL（例: https://portfolio-proxy.<account>.workers.dev）
      MF_PIN_HASH   — PUT /positions と同じ PIN ハッシュ（SHA-256 hex 文字列）。
                      X-Pin-Hash ヘッダーにそのまま使う（生の PIN ではない）。
    どちらか未設定、または送信失敗時は notify のみで False を返す（公開 commit フローは止めない）。
    """
    worker_url = os.environ.get("MF_WORKER_URL")
    pin_hash = os.environ.get("MF_PIN_HASH")
    if not worker_url or not pin_hash:
        notify("networth: MF_WORKER_URL/MF_PIN_HASH が未設定のため Worker 送信をスキップ（公開 commit は継続）。")
        return False
    try:
        body = json.dumps(doc).encode("utf-8")
        req = urllib.request.Request(
            f"{worker_url.rstrip('/')}/networth",
            data=body,
            method="PUT",
            headers={"Content-Type": "application/json", "X-Pin-Hash": pin_hash},
        )
        with urllib.request.urlopen(req, timeout=15) as res:
            if res.status != 200:
                notify(f"networth: Worker PUT /networth が HTTP {res.status} を返却。")
                return False
        return True
    except Exception as e:
        notify(f"networth: Worker PUT /networth 送信失敗 {type(e).__name__}: {e}。公開 commit は継続。")
        return False


# ── 出力＆無人 commit/push（成功時のみ・承認不要） ─────────────────────────────
def _git(*args, check=False):
    return subprocess.run(["git", "-C", ROOT, *args], check=check)


def _rebase_in_progress():
    """rebase 進行中か（.git/rebase-merge・rebase-apply の有無で判定）。"""
    gitdir = os.path.join(ROOT, ".git")
    return any(os.path.isdir(os.path.join(gitdir, d)) for d in ("rebase-merge", "rebase-apply"))


PUSH_RETRIES = 3  # push がレース（ref ロック）で弾かれた時の再試行回数


def git_commit_push(extra_paths=()):
    """成功時のみ無人 commit&push。失敗は原状復帰して通知（#479 H2 / #490）。

    - commit は data/mf-holdings.json（＋#580 で更新した data/real-assets/）に
      パス限定（事前ステージの巻き込み防止・#482 L3）。
    - pull --rebase / push は staged 有無に関わらず実行＝前回 push 失敗で宙吊りの
      ローカル commit も回収する。
    - **push がレース（ref ロック）で弾かれたら pull --rebase からリトライ**して
      transient な競合を自動吸収する（#490）。
    - pull --rebase のコンフリクトは自動解決しない。rebase 進行中のときだけ
      `rebase --abort` し、notify して exit(5)。
    """
    today = datetime.date.today().isoformat()
    paths = ["data/mf-holdings.json", *extra_paths]
    _git("add", *paths, check=True)
    if _git("diff", "--cached", "--quiet").returncode != 0:
        _git("commit", "--only", *paths,
             "-m", f"data: refresh MF holdings snapshot ({today})", check=True)
    else:
        print("ステージ変更なし（未push commit があれば push のみ実施）")

    for attempt in range(1, PUSH_RETRIES + 1):
        # 最新 origin に追従（成功する限りリトライ間で取り直す）
        if _git("pull", "--rebase", "origin", "main").returncode != 0:
            if _rebase_in_progress():
                _git("rebase", "--abort")  # コンフリクトは自動マージしない
            notify("git pull --rebase に失敗（コンフリクト等）。ローカル commit は残置・手動対応を。")
            sys.exit(5)
        if _git("push", "origin", "main").returncode == 0:
            return  # 成功（Mac の既存 git 認証で無人 push）
        # push 失敗＝レースで origin が動いた可能性 → バックオフして pull からやり直す
        print(f"push 競合（{attempt}/{PUSH_RETRIES}）。pull --rebase からリトライ")
        time.sleep(2 * attempt)

    notify(f"git push が {PUSH_RETRIES} 回競合して未push。ローカル commit は残置・次回 run で再試行。手動 push も可。")
    sys.exit(5)


def _scrape_all(page, c):
    """資産（従来 scrape）→ 不動産（同一ページ）→ 負債（別ページ・fail-soft）の順に
    同一認証コンテキストで取得する。不動産は portfolio ページ表示中に読む必要があるため
    負債（/bs/liability への遷移）より前。"""
    net, rows, summary = scrape(page, c)
    re_vals = scrape_real_estate(page, c)  # 失敗時 None（notify 済み・#580）
    liab = scrape_liabilities(page, c)  # 失敗時 None（notify 済み・資産は続行）
    return net, rows, summary, liab, re_vals


def do_run(c):
    """無人 run。想定外例外も必ず notify して中止する（無音失敗を作らない・#479 H1）。"""
    try:
        net, rows, summary, liab, re_vals = with_page(c, headless=c["fetch"]["headless"], fn=lambda pg: _scrape_all(pg, c))
        if not rows:
            notify("保有行を1件も抽出できず。fetch.dom（種類別テーブルのセレクタ/列マップ §7.1）を確認。")
            sys.exit(3)
        doc = build(c, net, rows)
        verify(c, doc, rows, summary)  # 失敗時 exit(>=2)＝コミットしない
        ra_updated = update_real_assets(c, re_vals)  # #580: attach より前＝当日 totals に新値を反映
        doc = attach_liabilities(c, doc, liab)  # verify 後＝資産チェックサムに影響しない（#577）＝完全版（KV送信用）
        pushed = push_networth_to_worker(doc)  # #589 Phase2: 完全版を Worker KV へ（fail-soft・失敗しても続行）
        public_doc = sanitize_for_public(doc)  # 公開 commit 用（機微フィールド除去・v4互換）
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(public_doc, f, ensure_ascii=False, indent=2)
            f.write("\n")
        git_commit_push(("data/real-assets",) if ra_updated else ())
        liab_note = f" liabilities={doc['totals'].get('liabilitiesTotal', 0):,}" if "liabilities" in doc else ""
        ra_note = f" realAssetsUpdated={ra_updated}" if ra_updated else ""
        kv_note = f" kvPushed={pushed}"
        print(f"OK imported={doc['totals']['imported']:,} holdings={len(doc['holdings'])}{liab_note}{ra_note}{kv_note}")
        # 保有取得成功後に履歴も非致命的に取得（失敗しても保有処理は成功扱い）
        _run_history_script()
    except SystemExit:
        raise  # notify 済みの意図的 exit（2/3/5）はそのまま伝播
    except Exception as e:
        notify(f"想定外エラーで中止: {type(e).__name__}: {e}")
        sys.exit(1)


def _run_history_script():
    """資産推移 CSV 取得スクリプトを非致命的に呼び出す。
    失敗しても保有処理の成功ステータスは変えない（例外を握りつぶして stderr に1行出すだけ）。
    """
    try:
        history_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fetch_mf_history.py")
        result = subprocess.run(
            [sys.executable, history_script],
            check=False,
            capture_output=False,
        )
        if result.returncode != 0:
            print(f"[history] fetch_mf_history.py exited with code {result.returncode}", file=sys.stderr)
    except Exception as e:
        print(f"[history] fetch_mf_history.py の起動に失敗（無視）: {e}", file=sys.stderr)


if __name__ == "__main__":
    conf = cfg()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "run"
    {"setup": do_setup, "run": do_run}.get(cmd, do_run)(conf)
