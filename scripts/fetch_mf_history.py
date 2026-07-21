#!/usr/bin/env python3
"""MF 資産推移 (/bs/history/csv) を data/mf-history.json にマージ蓄積する。

- CSV は毎回「口座開設来の全期間」を返す（直近＝日次・過去＝月末の混在）。文字コード cp932。
- 認証は fetch_mf.py と同じ永続プロファイル（~/.mf-snapshot/profile）を再利用。
  ページ描画は不要で、ログイン済みコンテキストの request API に Cookie が載る。
- 既存 data/mf-history.json と日付キーで union マージ（MF 最新で上書き）。
  → MF が将来古い月を切り捨てても、こちらに貯めた過去は残る。
- 決定論・LLM 非経路（fetch_mf.py と同じ設計思想）。トークン等は出力しない。

使い方:
  python3 scripts/fetch_mf_history.py          # 取得→マージ→書き出し→commit&push
  python3 scripts/fetch_mf_history.py --no-git # 取得→マージ→書き出しのみ（push しない）
"""
import csv
import io
import json
import os
import subprocess
import sys

try:
    from playwright.sync_api import sync_playwright
except Exception:  # pragma: no cover
    sync_playwright = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, "data", "mf-import-config.json")
OUT = os.path.join(ROOT, "data", "mf-history.json")
CSV_URL = "https://moneyforward.com/bs/history/csv"

# CSV 列見出し（cp932）→ JSON キー。MF の列順・表記に一致させる。
COLMAP = {
    "日付": "date",
    "合計（円）": "total",
    "預金・現金（円）": "cash",
    "株式(現物)（円）": "equity",
    "株式(信用)（円）": "equityMargin",
    "投資信託（円）": "fund",
    "債券（円）": "bond",
    "暗号資産（円）": "crypto",
    "FX（円）": "fx",
    "保険（円）": "insurance",
    "年金（円）": "pension",
    "ポイント（円）": "points",
    "不動産（円）": "realEstate",
    "その他（円）": "other",
}
NUM_KEYS = [v for k, v in COLMAP.items() if v != "date"]


def _load_cfg():
    with open(CONFIG, encoding="utf-8") as f:
        return json.load(f)


def _to_int(s):
    s = (s or "").replace(",", "").strip()
    return int(s) if s.lstrip("-").isdigit() else 0


def _norm_date(s):
    return (s or "").strip().replace("/", "-")


def fetch_csv(cfg):
    """永続プロファイルの Cookie 付きで /bs/history/csv を取得し cp932 デコード。"""
    if sync_playwright is None:
        print("Playwright 未導入。`pip3 install playwright && python3 -m playwright install chromium`", file=sys.stderr)
        sys.exit(4)
    udd = os.path.expanduser(cfg["fetch"]["userDataDir"])
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(udd, headless=False)
        try:
            r = ctx.request.get(CSV_URL, timeout=cfg["fetch"].get("timeoutMs", 45000))
            if r.status != 200:
                raise RuntimeError(f"CSV 取得失敗 status={r.status}（ログイン切れの可能性→ fetch_mf.py setup）")
            body = r.body()
        finally:
            ctx.close()
    return body.decode("cp932")


def parse(text):
    """CSV → {date: {date,total,...}}。列見出しで対応付け（列順変更に耐性）。"""
    rows = {}
    rdr = csv.reader(io.StringIO(text))
    header = next(rdr, None)
    if not header:
        return rows
    idx = {h.strip(): i for i, h in enumerate(header)}
    if "日付" not in idx or "合計（円）" not in idx:
        raise RuntimeError(f"CSV 見出しが想定外: {header}")
    for rec in rdr:
        if not rec:
            continue
        def get(name):
            i = idx.get(name)
            return rec[i] if i is not None and i < len(rec) else ""
        d = _norm_date(get("日付"))
        if not d:
            continue
        row = {"date": d}
        for jp, key in COLMAP.items():
            if key == "date":
                continue
            row[key] = _to_int(get(jp))
        rows[d] = row
    return rows


def merge(existing, new):
    """日付キーで union（MF 最新で上書き）→ 日付昇順のリスト。

    ★CSV に無いキー（liabilities 等・#577）は既存行から保護する：
    new の行で丸ごと置き換えると、過去に刻んだ負債列が毎回消えるため
    {**old, **new} で CSV 列だけ上書きする。
    """
    by = {r["date"]: r for r in existing if r.get("date")}
    for d, r in new.items():
        by[d] = {**by.get(d, {}), **r}
    return [by[d] for d in sorted(by.keys())]


def stamp_liabilities(series):
    """mf-holdings.json（fetch_mf.py が直前に更新）の liabilitiesTotal を
    同じ日付の行に刻む（#577）。過去分はキー無し＝null 許容。

    日付が一致する行が無い場合は何もしない（古い行に刻むと日付がズレるため）。
    負債が未取得（v4 互換形）なら何もしない。
    """
    try:
        with open(os.path.join(ROOT, "data", "mf-holdings.json"), encoding="utf-8") as f:
            h = json.load(f)
    except Exception:
        return
    lt = (h.get("totals") or {}).get("liabilitiesTotal")
    as_of = h.get("asOf")
    if not isinstance(lt, int) or not as_of:
        return
    for r in reversed(series):
        if r.get("date") == as_of:
            r["liabilities"] = lt
            return
    print(f"[liab] 履歴に {as_of} の行が無く負債列を刻めず（次回 CSV 反映後に自動解消）", file=sys.stderr)


def _git(*args, check=True):
    return subprocess.run(["git", "-C", ROOT, *args], check=check)


def git_push(last_date):
    _git("add", "data/mf-history.json")
    if _git("diff", "--cached", "--quiet", check=False).returncode == 0:
        print("変更なし（履歴は最新）")
        return
    _git("commit", "-m", f"data: refresh MF asset history ({last_date})")
    _git("pull", "--rebase", "origin", "main", check=False)
    _git("push", "origin", "main")
    print("push 完了")


def main():
    do_git = "--no-git" not in sys.argv
    cfg = _load_cfg()
    text = fetch_csv(cfg)
    new = parse(text)
    if not new:
        print("履歴 CSV が空 or パース失敗", file=sys.stderr)
        sys.exit(3)
    existing = []
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            existing = json.load(f).get("series", [])
    series = merge(existing, new)
    stamp_liabilities(series)  # #577: 当日行に負債残高を刻む（過去分は null 許容＝キー無し）
    out = {
        "source": "moneyforward.com/bs/history/csv",
        "unit": "JPY",
        "columns": ["date"] + NUM_KEYS + ["liabilities"],
        "updatedAt": series[-1]["date"] if series else "",
        "count": len(series),
        "series": series,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    lo = series[0]["date"] if series else "-"
    hi = series[-1]["date"] if series else "-"
    print(f"OK history rows={len(series)} range={lo}..{hi} -> {OUT}")
    if do_git:
        git_push(hi)


if __name__ == "__main__":
    main()
