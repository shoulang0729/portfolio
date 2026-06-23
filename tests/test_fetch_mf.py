#!/usr/bin/env python3
"""scripts/fetch_mf.py の build()/verify() 純ロジック検算（#466 / handoff §7）。

実機 DOM 走査（scrape）は Playwright + ライブ MF が要るため §7.4 手動 run で確認。
ここでは scrape が返す形（フラット行＋サマリ）を合成し、§7.2 分類・§7.3 種類別
チェックサムが §7 実測参考値で通る/外れたら落ちることを stdlib unittest で検証する。

実行: python3 -m unittest tests/test_fetch_mf.py -v
依存なし（pytest 不要）。fetch_mf は playwright 未導入でも import 可（try/except 済）。
"""
import os
import sys
import json
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import fetch_mf  # noqa: E402


def _load_config():
    with open(os.path.join(ROOT, "data", "mf-import-config.json"), encoding="utf-8") as f:
        return json.load(f)


# §7 実測参考値（2026-06-22）。サマリ＝種類別合計（除外口座分を含む）。
NET = 585_034_186
SUM_EQ = 338_454_356
SUM_MF = 130_537_011
SUM_DEPO = 73_515_659
SUM_PENSION = 42_527_160  # 非取込（年金）。4種合計＝NET になるよう設定。

# 除外口座の保有（サマリには含まれるが imported からは落ちる）。
EXCL_NTT = 5_000_000      # NTTデータ社員持株会（eq・持株会）
EXCL_SUICA = 15_659       # ようたのSuica（depo・交通系）


def _fixture_rows():
    """scrape() が返すフラット行を §7 参考値に合わせて合成。"""
    return [
        # eq: 取込（日本株 / 米国株）＋ 除外（持株会）
        {"kind": "eq", "institution": "マネックス証券", "rawCategory": "株式(現物)",
         "name": "ファーストリテイリング", "code": "9983", "shares": 100.0,
         "avgCost": 30000.0, "price": 34000.0, "value": SUM_EQ - EXCL_NTT - 30_000_000, "cur": "JPY"},
        {"kind": "eq", "institution": "マネックス証券", "rawCategory": "株式(現物)",
         "name": "アップル", "code": "AAPL", "shares": 100.0,
         "avgCost": 150.0, "price": 200.0, "value": 30_000_000, "cur": "JPY"},
        {"kind": "eq", "institution": "NTTデータ社員持株会", "rawCategory": "株式(現物)",
         "name": "NTTデータ持株", "code": "", "shares": None,
         "avgCost": None, "price": None, "value": EXCL_NTT, "cur": "JPY"},
        # mf: 取込
        {"kind": "mf", "institution": "ひふみ投信", "rawCategory": "投資信託",
         "name": "ひふみ投信", "code": "", "shares": 1000.0,
         "avgCost": 50000.0, "price": 60000.0, "value": SUM_MF, "cur": "JPY"},
        # depo: 取込（現金 / 暗号資産）＋ 除外（Suica）
        {"kind": "depo", "institution": "三井住友銀行", "rawCategory": "預金・現金",
         "name": "普通預金", "code": "", "shares": None,
         "avgCost": None, "price": None, "value": SUM_DEPO - EXCL_SUICA - 3_500_000, "cur": "JPY"},
        {"kind": "depo", "institution": "bitFlyer", "rawCategory": "暗号資産",
         "name": "ビットコイン", "code": "", "shares": None,
         "avgCost": None, "price": None, "value": 3_500_000, "cur": "JPY"},
        {"kind": "depo", "institution": "ようたのSuica", "rawCategory": "預金・現金",
         "name": "Suica残高", "code": "", "shares": None,
         "avgCost": None, "price": None, "value": EXCL_SUICA, "cur": "JPY"},
    ]


def _fixture_summary():
    """内訳サマリ表（正規化キー）。種類別＝除外口座分を含む合計。"""
    return {
        fetch_mf._norm("株式(現物)"): SUM_EQ,
        fetch_mf._norm("投資信託"): SUM_MF,
        fetch_mf._norm("預金・現金・暗号資産"): SUM_DEPO,
        fetch_mf._norm("年金"): SUM_PENSION,
    }


IMPORTED_EXPECTED = (SUM_EQ - EXCL_NTT) + SUM_MF + (SUM_DEPO - EXCL_SUICA)


class TestBuild(unittest.TestCase):
    def setUp(self):
        self.c = _load_config()
        self.doc = fetch_mf.build(self.c, NET, _fixture_rows())

    def test_imported_excludes_excluded_accounts(self):
        self.assertEqual(self.doc["totals"]["imported"], IMPORTED_EXPECTED)
        # 取込は5件（持株会・Suica が落ちる）
        self.assertEqual(len(self.doc["holdings"]), 5)

    def test_excluded_accounts_listed(self):
        excl = set(self.doc["totals"]["excludedAccounts"])
        self.assertIn("NTTデータ社員持株会", excl)
        self.assertIn("ようたのSuica", excl)

    def test_jp_us_symbol_resolution(self):
        by_name = {h["name"]: h for h in self.doc["holdings"]}
        self.assertEqual(by_name["ファーストリテイリング"]["cat"], "日本株・ETF")
        self.assertEqual(by_name["ファーストリテイリング"]["ySymbol"], "9983.T")
        self.assertEqual(by_name["アップル"]["cat"], "米国株・ETF")
        self.assertEqual(by_name["アップル"]["ySymbol"], "AAPL")

    def test_crypto_split_and_cash(self):
        by_name = {h["name"]: h for h in self.doc["holdings"]}
        self.assertEqual(by_name["ビットコイン"]["cat"], "暗号資産")
        self.assertNotIn("ySymbol", by_name["ビットコイン"])  # 証券以外はシンボル無し
        self.assertEqual(by_name["普通預金"]["cat"], "現金・預金")

    def test_all_jpy_and_load_bearing_fields(self):
        # load-bearing 5項目（front src/networth.js が読む）＋ name は必須
        for h in self.doc["holdings"]:
            for k in ("cat", "cur", "value", "asOf", "name"):
                self.assertIn(k, h)
            self.assertEqual(h["cur"], "JPY")
        for k in ("mfNetWorth", "imported", "excludedAccounts"):
            self.assertIn(k, self.doc["totals"])


class TestVerify(unittest.TestCase):
    def setUp(self):
        self.c = _load_config()
        self.rows = _fixture_rows()
        self.summary = _fixture_summary()
        self.doc = fetch_mf.build(self.c, NET, self.rows)
        # notify は macOS 通知/subprocess を起こすのでテスト中は無効化
        self._orig_notify = fetch_mf.notify
        fetch_mf.notify = lambda *a, **k: None

    def tearDown(self):
        fetch_mf.notify = self._orig_notify

    def test_passes_with_reference_values(self):
        # 例外（SystemExit）が出なければ全チェック通過
        fetch_mf.verify(self.c, self.doc, self.rows, self.summary)

    def test_type_checksum_mismatch_aborts(self):
        bad = dict(self.summary)
        bad[fetch_mf._norm("株式(現物)")] = SUM_EQ + 50_000_000  # 種類サマリを大きくズラす
        with self.assertRaises(SystemExit):
            fetch_mf.verify(self.c, self.doc, self.rows, bad)

    def test_missing_summary_aborts(self):
        bad = dict(self.summary)
        del bad[fetch_mf._norm("投資信託")]  # サマリ欠落
        with self.assertRaises(SystemExit):
            fetch_mf.verify(self.c, self.doc, self.rows, bad)

    def test_networth_mismatch_aborts(self):
        doc_bad = fetch_mf.build(self.c, NET + 100_000_000, self.rows)  # 資産総額だけ過大
        with self.assertRaises(SystemExit):
            fetch_mf.verify(self.c, doc_bad, self.rows, self.summary)

    def test_internal_sum_mismatch_aborts(self):
        doc_bad = json.loads(json.dumps(self.doc))
        doc_bad["totals"]["imported"] += 1  # imported != Σ holdings
        with self.assertRaises(SystemExit):
            fetch_mf.verify(self.c, doc_bad, self.rows, self.summary)


class TestKindByCat(unittest.TestCase):
    def test_mapping_from_config(self):
        m = fetch_mf._kind_by_cat_map(_load_config())
        self.assertEqual(m["日本株・ETF"], "eq")
        self.assertEqual(m["米国株・ETF"], "eq")
        self.assertEqual(m["投資信託"], "mf")
        self.assertEqual(m["現金・預金"], "depo")
        self.assertEqual(m["暗号資産"], "depo")


if __name__ == "__main__":
    unittest.main()
