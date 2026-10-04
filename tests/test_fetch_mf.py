#!/usr/bin/env python3
"""scripts/fetch_mf.py の build()/verify() 純ロジック検算（#466 / handoff §7）。

実機 DOM 走査（scrape）は Playwright + ライブ MF が要るため §7.4 手動 run で確認。
ここでは scrape が返す形（フラット行＋サマリ）を合成し、§7.2 分類・§7.3 種類別
チェックサムが合成値（実額ではない）で通る/外れたら落ちることを stdlib unittest で検証する。

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


# 合成 fixture 用の除外口座名（架空）。公開 config の exclude.accounts に加えて、
# テスト内だけで除外対象として扱う（実在の口座名を fixture に置かないため）。
TEST_EXCL_HOLDING_INST = "テスト社員持株会"
TEST_EXCL_IC_INST = "テスト交通系IC"


def _load_config():
    with open(os.path.join(ROOT, "data", "mf-import-config.json"), encoding="utf-8") as f:
        c = json.load(f)
    c["exclude"]["accounts"] = list(c["exclude"]["accounts"]) + [TEST_EXCL_HOLDING_INST, TEST_EXCL_IC_INST]
    return c


# ★合成値（実額ではない）。サマリ＝種類別合計（除外口座分を含む）。
NET = 500_000_000
SUM_EQ = 200_000_000
SUM_MF = 100_000_000
SUM_DEPO = 50_000_000
SUM_PENSION = 150_000_000  # 非取込（年金）。4種合計＝NET になるよう設定。

# 除外口座の保有（サマリには含まれるが imported からは落ちる）。
EXCL_HOLDING = 5_000_000  # テスト社員持株会（eq・持株会）
EXCL_IC = 10_000          # テスト交通系IC（depo・交通系）


def _fixture_rows():
    """scrape() が返すフラット行を合成値で組み立てる（種類別チェックサムが通る整合）。"""
    return [
        # eq: 取込（日本株 / 米国株）＋ 除外（持株会）
        {"kind": "eq", "institution": "サンプル証券", "rawCategory": "株式(現物)",
         "name": "サンプル日本株", "code": "1306", "shares": 100.0,
         "avgCost": 30000.0, "price": 34000.0, "value": SUM_EQ - EXCL_HOLDING - 30_000_000, "cur": "JPY"},
        {"kind": "eq", "institution": "サンプル証券", "rawCategory": "株式(現物)",
         "name": "サンプル米国株", "code": "AAA", "shares": 100.0,
         "avgCost": 150.0, "price": 200.0, "value": 30_000_000, "cur": "JPY"},
        {"kind": "eq", "institution": TEST_EXCL_HOLDING_INST, "rawCategory": "株式(現物)",
         "name": "テスト持株", "code": "", "shares": None,
         "avgCost": None, "price": None, "value": EXCL_HOLDING, "cur": "JPY"},
        # mf: 取込
        {"kind": "mf", "institution": "サンプル投信会社", "rawCategory": "投資信託",
         "name": "サンプル投信", "code": "", "shares": 1000.0,
         "avgCost": 50000.0, "price": 60000.0, "value": SUM_MF, "cur": "JPY"},
        # depo: 取込（現金 / 暗号資産）＋ 除外（交通系IC）
        {"kind": "depo", "institution": "テスト銀行", "rawCategory": "預金・現金",
         "name": "普通預金", "code": "", "shares": None,
         "avgCost": None, "price": None, "value": SUM_DEPO - EXCL_IC - 3_500_000, "cur": "JPY"},
        {"kind": "depo", "institution": "サンプル暗号資産取引所", "rawCategory": "暗号資産",
         "name": "ビットコイン", "code": "", "shares": None,
         "avgCost": None, "price": None, "value": 3_500_000, "cur": "JPY"},
        {"kind": "depo", "institution": TEST_EXCL_IC_INST, "rawCategory": "預金・現金",
         "name": "IC残高", "code": "", "shares": None,
         "avgCost": None, "price": None, "value": EXCL_IC, "cur": "JPY"},
    ]


def _fixture_summary():
    """内訳サマリ表（正規化キー）。種類別＝除外口座分を含む合計。

    MF は 2026-07 から depo の内訳サマリを『預金・現金』『暗号資産』の2行に分割
    （config summaryLabel がリスト化）。fixture も分割形に追従（#577 で更新）。
    """
    return {
        fetch_mf._norm("株式(現物)"): SUM_EQ,
        fetch_mf._norm("投資信託"): SUM_MF,
        fetch_mf._norm("預金・現金"): SUM_DEPO - 3_500_000,
        fetch_mf._norm("暗号資産"): 3_500_000,
        fetch_mf._norm("年金"): SUM_PENSION,
    }


IMPORTED_EXPECTED = (SUM_EQ - EXCL_HOLDING) + SUM_MF + (SUM_DEPO - EXCL_IC)


def _without_masked(holdings):
    """公開コピーで置き換わる値（institution・現金・預金の行の name）を除いたコピー（#687）。"""
    return [
        {k: v for k, v in h.items() if k != "institution" and not (k == "name" and h.get("cat") == "現金・預金")}
        for h in holdings
    ]


class TestBuild(unittest.TestCase):
    def setUp(self):
        self.c = _load_config()
        self.doc = fetch_mf.build(self.c, NET, _fixture_rows())

    def test_imported_excludes_excluded_accounts(self):
        self.assertEqual(self.doc["totals"]["imported"], IMPORTED_EXPECTED)
        # 取込は5件（持株会・交通系IC が落ちる）
        self.assertEqual(len(self.doc["holdings"]), 5)

    def test_excluded_accounts_listed(self):
        excl = set(self.doc["totals"]["excludedAccounts"])
        self.assertIn(TEST_EXCL_HOLDING_INST, excl)
        self.assertIn(TEST_EXCL_IC_INST, excl)

    def test_jp_us_symbol_resolution(self):
        by_name = {h["name"]: h for h in self.doc["holdings"]}
        self.assertEqual(by_name["サンプル日本株"]["cat"], "日本株・ETF")
        self.assertEqual(by_name["サンプル日本株"]["ySymbol"], "1306.T")
        self.assertEqual(by_name["サンプル米国株"]["cat"], "米国株・ETF")
        self.assertEqual(by_name["サンプル米国株"]["ySymbol"], "AAA")

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


class TestParseAmount(unittest.TestCase):
    """#480: parse_amount は int() を保護し、想定外文字でも例外を投げず 0 を返す。"""

    def test_normal(self):
        self.assertEqual(fetch_mf.parse_amount("1,234,567円"), 1234567)
        self.assertEqual(fetch_mf.parse_amount("¥200,000,000"), 200000000)

    def test_negative(self):
        self.assertEqual(fetch_mf.parse_amount("-500"), -500)

    def test_garbage_returns_zero_not_crash(self):
        # 旧バグ: "1234-567" で int() が ValueError → 無人クラッシュ
        self.assertEqual(fetch_mf.parse_amount("1,234-567"), 0)
        self.assertEqual(fetch_mf.parse_amount("abc"), 0)
        self.assertEqual(fetch_mf.parse_amount(""), 0)
        self.assertEqual(fetch_mf.parse_amount("－"), 0)  # 全角マイナス単独


class TestPushRetry(unittest.TestCase):
    """#490: push レース時の pull --rebase リトライ設定。"""

    def test_retries_configured(self):
        self.assertGreaterEqual(fetch_mf.PUSH_RETRIES, 2)

    def test_rebase_in_progress_is_false_when_clean(self):
        # 通常状態（rebase していない）では False
        self.assertFalse(fetch_mf._rebase_in_progress())


class TestKindByCat(unittest.TestCase):
    def test_mapping_from_config(self):
        m = fetch_mf._kind_by_cat_map(_load_config())
        self.assertEqual(m["日本株・ETF"], "eq")
        self.assertEqual(m["米国株・ETF"], "eq")
        self.assertEqual(m["投資信託"], "mf")
        self.assertEqual(m["現金・預金"], "depo")
        self.assertEqual(m["暗号資産"], "depo")


class _FakeLoc:
    def __init__(self, texts):
        self._t = texts

    def count(self):
        return len(self._t)

    def nth(self, i):
        txt = self._t[i]

        class _C:
            def inner_text(self_inner):
                return txt

        return _C()


class _FakeTr:
    """tr.locator(sel) を模した最小スタブ。"""

    def __init__(self, by_selector):
        self._m = by_selector

    def locator(self, sel):
        return _FakeLoc(self._m.get(sel, []))


class TestCells(unittest.TestCase):
    """#469: 内訳サマリ行は category が <th>・円/% が <td> の混在。
    _cells は th と td を DOM 順で読む必要がある（td のみだと category が落ちる）。"""

    def test_summary_row_reads_th_and_td(self):
        tr = _FakeTr({"th, td": ["株式(現物)", "200,000,000円", "40.00%"]})
        self.assertEqual(fetch_mf._cells(tr), ["株式(現物)", "200,000,000円", "40.00%"])

    def test_asset_row_td_only_unchanged(self):
        # 保有テーブルのデータ行は td のみ＝列インデックス不変
        tr = _FakeTr({"th, td": ["", "サンプル銘柄", "1", "1,000,000"]})
        self.assertEqual(fetch_mf._cells(tr), ["", "サンプル銘柄", "1", "1,000,000"])


class TestLiabilities(unittest.TestCase):
    """#577 スコープA: attach_liabilities / _liab_tag / real_assets_total の純ロジック検算。

    scrape_liabilities の DOM 走査は実機（Mac mini headful）でのみ確認可能＝ここでは
    build 後の付与ロジックと v4 互換 degrade を検証する。
    """

    # ★合成データ（#589: 実残高・実金融機関の組は公開リポに置かない）
    LIAB_ROWS = [
        {"institution": "テスト銀行A", "name": "住宅ローン", "balance": 32_000_000},
        {"institution": "テスト銀行B", "name": "アパートローン", "balance": 55_000_000},
    ]
    # liabilityAccountMap は #589 Phase1 で公開 config から撤去（空）済み＝テストは合成マップを使う
    LIAB_MAP = {"テスト銀行A": "自宅", "テスト銀行B": "収益", "note": "テスト用"}

    def setUp(self):
        self.c = _load_config()
        self.c["liabilityAccountMap"] = dict(self.LIAB_MAP)
        self.doc = fetch_mf.build(self.c, NET, _fixture_rows())

    def test_attach_none_keeps_v4_shape(self):
        # 負債取得失敗（None）→ v5 フィールドを一切足さない（fail-soft・フロント degrade）
        doc = fetch_mf.attach_liabilities(self.c, dict(self.doc), None)
        self.assertNotIn("liabilities", doc)
        for k in ("liabilitiesTotal", "realAssetsTotal", "netWorthComputed"):
            self.assertNotIn(k, doc["totals"])

    def test_attach_success_adds_v5_fields(self):
        c = dict(self.c)
        c["realAssets"] = {"dir": "tests/fixtures/real-assets"}
        doc = fetch_mf.attach_liabilities(c, json.loads(json.dumps(self.doc)), self.LIAB_ROWS)
        self.assertEqual(doc["totals"]["liabilitiesTotal"], 87_000_000)
        # fixture: 80,000,000(valueAdopted) + 65,000,000(valueHowMa×0.65) + 10,000,000(value) = 155,000,000
        self.assertEqual(doc["totals"]["realAssetsTotal"], 155_000_000)
        self.assertEqual(
            doc["totals"]["netWorthComputed"],
            doc["totals"]["imported"] + 155_000_000 - 87_000_000,
        )
        # liabilityAccountMap による用途タグ（部分一致）
        by_inst = {l["institution"]: l for l in doc["liabilities"]}
        self.assertEqual(by_inst["テスト銀行A"]["tag"], "自宅")
        self.assertEqual(by_inst["テスト銀行B"]["tag"], "収益")
        for l in doc["liabilities"]:
            for k in ("institution", "name", "tag", "balance", "asOf"):
                self.assertIn(k, l)

    def test_attach_does_not_touch_holdings_or_asset_totals(self):
        # ★AC3: 負債付与で運用側（holdings / imported / mfNetWorth）が 1 円も動かない
        before = json.loads(json.dumps(self.doc))
        c = dict(self.c)
        c["realAssets"] = {"dir": "tests/fixtures/real-assets"}
        doc = fetch_mf.attach_liabilities(c, json.loads(json.dumps(self.doc)), self.LIAB_ROWS)
        self.assertEqual(doc["holdings"], before["holdings"])
        self.assertEqual(doc["totals"]["imported"], before["totals"]["imported"])
        self.assertEqual(doc["totals"]["mfNetWorth"], before["totals"]["mfNetWorth"])

    def test_verify_ignores_liabilities(self):
        # verify（資産チェックサム）は liabilities 付き doc でもそのまま通る
        c = dict(self.c)
        c["realAssets"] = {"dir": "tests/fixtures/real-assets"}
        doc = fetch_mf.attach_liabilities(c, json.loads(json.dumps(self.doc)), self.LIAB_ROWS)
        orig_notify = fetch_mf.notify
        fetch_mf.notify = lambda *a, **k: None
        try:
            fetch_mf.verify(self.c, doc, _fixture_rows(), _fixture_summary())
        finally:
            fetch_mf.notify = orig_notify

    def test_real_assets_total_absent_dir_is_zero(self):
        c = {"realAssets": {"dir": "tests/fixtures/no-such-dir"}}
        self.assertEqual(fetch_mf.real_assets_total(c), 0)

    def test_liab_tag_unmatched_is_empty(self):
        m = self.LIAB_MAP
        self.assertEqual(fetch_mf._liab_tag("どこかの銀行", "カーローン", m), "")
        # note キーはタグとして扱わない
        self.assertNotEqual(fetch_mf._liab_tag("テスト銀行A", "", m), m.get("note"))

    def test_public_config_has_no_pii_mapping(self):
        # ★#589 Phase2: 負債/不動産スクレイプは KV 配信前提で再有効化されたが、
        # 用途タグ・物件名の PII マッピングは引き続き公開 config に書かない（note 以外空）。
        cfg = _load_config()
        self.assertEqual([k for k in cfg["liabilityAccountMap"] if k != "note"], [])
        self.assertEqual([k for k in cfg["fetch"]["realEstate"]["nameMap"] if k != "note"], [])
        self.assertTrue(cfg["include"]["liabilities"]["enabled"])
        self.assertTrue(cfg["fetch"]["realEstate"]["enabled"])


class TestSanitizeForPublic(unittest.TestCase):
    """#589 Phase2: sanitize_for_public() が公開commit用コピーから機微フィールドを
    確実に除去することを検算する（完全版 doc に liabilities があっても漏れない）。"""

    def setUp(self):
        c = _load_config()
        c["liabilityAccountMap"] = {"テスト銀行A": "自宅", "note": "テスト用"}
        c["realAssets"] = {"dir": "tests/fixtures/real-assets"}
        doc = fetch_mf.build(c, NET, _fixture_rows())
        self.full_doc = fetch_mf.attach_liabilities(
            c, doc,
            [{"institution": "テスト銀行A", "name": "住宅ローン", "balance": 33_000_000}],
        )
        # 完全版には機微フィールドが実際に存在することを前提として確認
        self.assertIn("liabilities", self.full_doc)
        self.assertIn("liabilitiesTotal", self.full_doc["totals"])

    def test_removes_liabilities_and_sensitive_totals(self):
        pub = fetch_mf.sanitize_for_public(self.full_doc)
        self.assertNotIn("liabilities", pub)
        for k in ("liabilitiesTotal", "realAssetsTotal", "netWorthComputed"):
            self.assertNotIn(k, pub["totals"])

    def test_keeps_v4_fields_and_holdings_unchanged(self):
        # #687: institution だけは通し番号に置き換わる。それ以外の holdings の値は不変。
        pub = fetch_mf.sanitize_for_public(self.full_doc)
        self.assertEqual(_without_masked(pub["holdings"]), _without_masked(self.full_doc["holdings"]))
        self.assertEqual(pub["totals"]["imported"], self.full_doc["totals"]["imported"])
        self.assertEqual(pub["totals"]["mfNetWorth"], self.full_doc["totals"]["mfNetWorth"])
        self.assertEqual(pub["asOf"], self.full_doc["asOf"])

    def test_does_not_mutate_original(self):
        before = json.loads(json.dumps(self.full_doc))
        fetch_mf.sanitize_for_public(self.full_doc)
        self.assertEqual(self.full_doc, before)

    def test_serializes_to_json_without_pii_keys(self):
        # 直列化した文字列にも liabilities 関連キーが一切現れないこと（漏洩の最終防衛線）
        pub = fetch_mf.sanitize_for_public(self.full_doc)
        s = json.dumps(pub, ensure_ascii=False)
        for forbidden in ("liabilities", "liabilitiesTotal", "realAssetsTotal", "netWorthComputed"):
            self.assertNotIn(forbidden, s)


class TestQty(unittest.TestCase):
    """#673 注文表 PR4: build() が shares のある行に qty を出し、無い行はキーを省く。
    sanitize_for_public() は qty を残す。既存フィールド・チェックサムは不変。値は合成値。"""

    def _rows(self):
        return [
            {"kind": "eq", "institution": "テスト証券", "rawCategory": "株式(現物)",
             "name": "テスト米国株", "code": "AAA", "shares": 81.0,
             "avgCost": 10.0, "price": 20.0, "value": 1_000, "cur": "JPY"},
            {"kind": "mf", "institution": "テスト証券", "rawCategory": "投資信託",
             "name": "テスト投信", "code": "", "shares": 1234.5,
             "avgCost": 10.0, "price": 20.0, "value": 2_000, "cur": "JPY"},
            {"kind": "eq", "institution": "テスト証券", "rawCategory": "株式(現物)",
             "name": "テスト日本株", "code": "1306", "shares": None,
             "avgCost": None, "price": None, "value": 3_000, "cur": "JPY"},
            # shares キー自体が無い行（depo 等・列マップに shares が無いテーブル）
            {"kind": "depo", "institution": "テスト銀行", "rawCategory": "預金・現金",
             "name": "普通預金", "code": "", "avgCost": None, "price": None,
             "value": 4_000, "cur": "JPY"},
        ]

    def setUp(self):
        self.c = _load_config()
        self.doc = fetch_mf.build(self.c, 10_000, self._rows())
        self.by_name = {h["name"]: h for h in self.doc["holdings"]}

    def test_qty_emitted_when_shares_present(self):
        self.assertEqual(self.by_name["テスト米国株"]["qty"], 81.0)
        self.assertEqual(self.by_name["テスト投信"]["qty"], 1234.5)
        self.assertIsInstance(self.by_name["テスト米国株"]["qty"], (int, float))

    def test_qty_key_absent_when_shares_missing(self):
        self.assertNotIn("qty", self.by_name["テスト日本株"])
        self.assertNotIn("qty", self.by_name["普通預金"])

    def test_existing_fields_unchanged(self):
        h = self.by_name["テスト米国株"]
        for k in ("institution", "cat", "name", "value", "cur", "asOf", "ySymbol", "avgCost", "price"):
            self.assertIn(k, h)
        self.assertEqual(self.doc["totals"]["imported"], 10_000)

    def test_sanitize_for_public_keeps_qty(self):
        pub = fetch_mf.sanitize_for_public(self.doc)
        by_name = {h["name"]: h for h in pub["holdings"]}
        self.assertEqual(by_name["テスト米国株"]["qty"], 81.0)
        self.assertNotIn("qty", by_name["テスト日本株"])
        self.assertEqual(_without_masked(pub["holdings"]), _without_masked(self.doc["holdings"]))

    def test_reference_fixture_qty_and_verify_still_passes(self):
        # 既存 fixture（shares あり/なし混在）でも qty が付き、チェックサムは従来どおり通る
        doc = fetch_mf.build(self.c, NET, _fixture_rows())
        by_name = {h["name"]: h for h in doc["holdings"]}
        self.assertEqual(by_name["サンプル米国株"]["qty"], 100.0)
        self.assertNotIn("qty", by_name["普通預金"])
        fetch_mf.verify(self.c, doc, _fixture_rows(), _fixture_summary())  # SystemExit が出なければ通過


# fixture の金融機関名（架空）。公開コピーに残ってはいけない文字列。
_FIXTURE_INSTITUTIONS = ("サンプル証券", "サンプル投信会社", "テスト銀行", "サンプル暗号資産取引所")
_FIXTURE_EXCLUDED = (TEST_EXCL_HOLDING_INST, TEST_EXCL_IC_INST)


class TestSanitizeInstitution(unittest.TestCase):
    """#687 PR1: 公開コピーから口座名・金融機関名を除く（Toshio 決定 Q2＝架空の通し番号）。
    完全版（KV 送信用）は実名のまま。値はすべて合成値・架空名。"""

    def setUp(self):
        self.c = _load_config()
        self.full_doc = fetch_mf.build(self.c, NET, _fixture_rows())
        self.before = json.loads(json.dumps(self.full_doc))
        self.pub = fetch_mf.sanitize_for_public(self.full_doc)

    def test_excluded_accounts_emptied_key_kept(self):
        self.assertIn("excludedAccounts", self.pub["totals"])
        self.assertEqual(self.pub["totals"]["excludedAccounts"], [])

    def test_institution_numbered_in_order_same_name_same_number(self):
        # fixture の取込順: サンプル証券×2 → サンプル投信会社 → テスト銀行 → サンプル暗号資産取引所
        self.assertEqual(
            [h["institution"] for h in self.pub["holdings"]],
            ["口座1", "口座1", "口座2", "口座3", "口座4"],
        )

    def test_institution_key_kept_on_every_row(self):
        self.assertEqual(len(self.pub["holdings"]), len(self.full_doc["holdings"]))
        for h in self.pub["holdings"]:
            self.assertIn("institution", h)

    def test_numbering_deterministic_within_run(self):
        self.assertEqual(fetch_mf.sanitize_for_public(self.full_doc), self.pub)

    def test_no_real_names_in_public_json(self):
        s = json.dumps(self.pub, ensure_ascii=False)
        for name in _FIXTURE_INSTITUTIONS + _FIXTURE_EXCLUDED:
            self.assertNotIn(name, s)

    def test_full_doc_unchanged(self):
        # KV に送る完全版は実名のまま（institution・excludedAccounts とも）
        self.assertEqual(self.full_doc, self.before)
        self.assertEqual(set(self.full_doc["totals"]["excludedAccounts"]), set(_FIXTURE_EXCLUDED))
        self.assertEqual(
            {h["institution"] for h in self.full_doc["holdings"]}, set(_FIXTURE_INSTITUTIONS)
        )

    def test_imported_and_checksum_same_before_after(self):
        self.assertEqual(self.pub["totals"]["imported"], self.full_doc["totals"]["imported"])
        self.assertEqual(self.pub["totals"]["imported"], IMPORTED_EXPECTED)
        self.assertEqual(self.pub["totals"]["mfNetWorth"], self.full_doc["totals"]["mfNetWorth"])
        # チェックサムは institution を使わない＝公開コピーでも同じ結果で通る
        fetch_mf.verify(self.c, self.full_doc, _fixture_rows(), _fixture_summary())
        fetch_mf.verify(self.c, self.pub, _fixture_rows(), _fixture_summary())

    def test_single_cash_row_name_is_cat_label(self):
        by_inst = {h["institution"]: h for h in self.pub["holdings"]}
        self.assertEqual(by_inst["口座3"]["cat"], "現金・預金")
        self.assertEqual(by_inst["口座3"]["name"], "現金・預金")  # 1行だけなら番号なし
        self.assertNotIn("普通預金", json.dumps(self.pub, ensure_ascii=False))

    def test_multiple_cash_rows_numbered_others_kept(self):
        # 合成値・架空名。現金・預金が3行（うち1行は USD）＋投信の行は name が institution と同じ
        doc = {
            "asOf": "2026-10-04",
            "totals": {"mfNetWorth": 100, "imported": 60, "excludedAccounts": []},
            "holdings": [
                {"institution": "テスト銀行A", "cat": "現金・預金", "name": "テスト銀行A 普通", "value": 10, "cur": "JPY"},
                {"institution": "テスト投信口座", "cat": "投資信託", "name": "テスト投信口座", "value": 20, "cur": "JPY"},
                {"institution": "テスト銀行B", "cat": "現金・預金", "name": "外貨預金（テスト）", "value": 10, "cur": "USD"},
                {"institution": "テスト証券", "cat": "日本株・ETF", "name": "テスト日本株", "value": 10, "cur": "JPY",
                 "ySymbol": "1306.T"},
                {"institution": "テスト銀行A", "cat": "現金・預金", "name": "テスト銀行A 定期", "value": 10, "cur": "JPY"},
            ],
        }
        before = json.loads(json.dumps(doc))
        pub = fetch_mf.sanitize_for_public(doc)
        self.assertEqual(
            [h["name"] for h in pub["holdings"]],
            ["現金・預金1", "テスト投信口座", "現金・預金2", "テスト日本株", "現金・預金3"],
        )
        # cat / cur / value は不変（アプリの集計キー）
        for a, b in zip(pub["holdings"], doc["holdings"]):
            for k in ("cat", "cur", "value"):
                self.assertEqual(a[k], b[k])
        self.assertEqual(doc, before)  # KV 完全版は変わらない
        lines, ok = fetch_mf.dry_run_report(doc, pub, None)
        self.assertTrue(ok)
        self.assertIn("汎用ラベルでない現金・預金の name=0行", lines[-1])

    def test_dry_run_ng_when_cash_name_left(self):
        leaked = json.loads(json.dumps(self.pub))
        for h in leaked["holdings"]:
            if h["cat"] == "現金・預金":
                h["name"] = "普通預金"
        lines, ok = fetch_mf.dry_run_report(self.full_doc, leaked, None)
        self.assertFalse(ok)
        self.assertIn("汎用ラベルでない現金・預金の name=1行", lines[-1])

    def test_doc_without_excluded_or_holdings_is_safe(self):
        pub = fetch_mf.sanitize_for_public({"asOf": "2026-10-04", "totals": {"imported": 0}})
        self.assertNotIn("excludedAccounts", pub["totals"])
        self.assertNotIn("holdings", pub)


class TestDryRun(unittest.TestCase):
    """#687 PR1: run --dry-run は取得→build→verify まで行い、書き出し・update_real_assets・
    KV 送信・git・履歴取得を呼ばない。表示は件数と一致判定だけ（実名・金額なし）。"""

    def setUp(self):
        import tempfile
        self.c = _load_config()
        self.calls = []
        self._orig = {}
        for name in ("with_page", "update_real_assets", "push_networth_to_worker",
                     "git_commit_push", "_run_history_script", "notify", "OUT"):
            self._orig[name] = getattr(fetch_mf, name)
        fetch_mf.with_page = lambda c, headless, fn: (NET, _fixture_rows(), _fixture_summary(), None, None)
        for name in ("update_real_assets", "push_networth_to_worker", "git_commit_push", "_run_history_script"):
            setattr(fetch_mf, name, (lambda n: lambda *a, **k: self.calls.append(n))(name))
        fetch_mf.notify = lambda msg, *a, **k: self.calls.append("notify")
        self.tmp = tempfile.TemporaryDirectory()
        fetch_mf.OUT = os.path.join(self.tmp.name, "mf-holdings.json")

    def tearDown(self):
        for name, v in self._orig.items():
            setattr(fetch_mf, name, v)
        self.tmp.cleanup()

    def _run(self):
        import io
        import contextlib
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            fetch_mf.do_run(self.c, dry_run=True)
        return buf.getvalue()

    def _write_prev(self, doc):
        with open(fetch_mf.OUT, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False)

    def test_no_side_effects(self):
        out = self._run()
        self.assertEqual(self.calls, [])
        self.assertFalse(os.path.exists(fetch_mf.OUT))  # 書き出していない
        self.assertIn("[dry-run] OK", out)

    def test_prev_output_not_rewritten(self):
        prev = fetch_mf.build(self.c, NET, _fixture_rows())
        self._write_prev(prev)
        with open(fetch_mf.OUT, encoding="utf-8") as f:
            before = f.read()
        self._run()
        with open(fetch_mf.OUT, encoding="utf-8") as f:
            self.assertEqual(f.read(), before)
        self.assertEqual(self.calls, [])

    def test_output_has_no_names_or_amounts(self):
        self._write_prev(fetch_mf.build(self.c, NET, _fixture_rows()))
        out = self._run()
        for name in _FIXTURE_INSTITUTIONS + _FIXTURE_EXCLUDED:
            self.assertNotIn(name, out)
        for amount in (IMPORTED_EXPECTED, NET, EXCL_HOLDING):
            self.assertNotIn(str(amount), out)
            self.assertNotIn(f"{amount:,}", out)

    def test_matches_prev_with_real_names(self):
        self._write_prev(fetch_mf.build(self.c, NET, _fixture_rows()))
        out = self._run()
        self.assertIn("holdings=5 excludedAccounts=2", out)
        self.assertIn("取込対象の金融機関の集合: 一致", out)
        self.assertIn("除外口座の集合: 一致", out)
        self.assertIn("以内", out)
        self.assertIn("→ OK", out)

    def test_report_mismatch_and_numbered_prev(self):
        doc = fetch_mf.build(self.c, NET, _fixture_rows())
        pub = fetch_mf.sanitize_for_public(doc)
        lines, ok = fetch_mf.dry_run_report(doc, pub, pub)  # 直近出力が通し番号化済み
        self.assertTrue(ok)
        self.assertIn("取込対象の金融機関の集合: 比較不可（直近出力が通し番号化済み）", lines)
        self.assertIn("除外口座の集合: 比較不可（直近出力が通し番号化済み）", lines)
        prev = json.loads(json.dumps(doc))
        prev["totals"]["imported"] = int(doc["totals"]["imported"] * 1.5)
        prev["holdings"][0]["institution"] = "テスト別銀行"
        prev["totals"]["excludedAccounts"] = [TEST_EXCL_IC_INST]
        lines, _ = fetch_mf.dry_run_report(doc, pub, prev)
        self.assertTrue(any("取込対象の金融機関の集合: 不一致" in l for l in lines))
        self.assertTrue(any("除外口座の集合: 不一致" in l for l in lines))
        self.assertTrue(any("超" in l for l in lines))
        lines, _ = fetch_mf.dry_run_report(doc, pub, None)
        self.assertTrue(any("省略" in l for l in lines))

    def test_report_ng_when_public_copy_leaks(self):
        doc = fetch_mf.build(self.c, NET, _fixture_rows())
        leaked = json.loads(json.dumps(doc))  # 未サニタイズ＝実名入り
        lines, ok = fetch_mf.dry_run_report(doc, leaked, None)
        self.assertFalse(ok)
        self.assertIn("NG", lines[-1])

    def test_public_check_ng_exits_4_without_side_effects(self):
        orig = fetch_mf.sanitize_for_public
        fetch_mf.sanitize_for_public = lambda d: json.loads(json.dumps(d))  # 除去されない退行を模擬
        try:
            with self.assertRaises(SystemExit) as cm:
                self._run()
        finally:
            fetch_mf.sanitize_for_public = orig
        self.assertEqual(cm.exception.code, 4)
        self.assertEqual(self.calls, [])
        self.assertFalse(os.path.exists(fetch_mf.OUT))

    def test_notify_prefixed_during_dry_run_only(self):
        import io
        import contextlib
        fetch_mf.notify = self._orig["notify"]  # 本物の notify（Telegram なし・osascript はモック）
        orig_run, orig_env = fetch_mf.subprocess.run, dict(os.environ)
        fetch_mf.subprocess.run = lambda *a, **k: None
        os.environ.pop("TG_BOT_TOKEN", None)
        os.environ.pop("TG_CHAT", None)
        bad_summary = _fixture_summary()
        bad_summary[fetch_mf._norm("投資信託")] += 50_000_000  # 種類ズレ → verify が notify して exit 3
        fetch_mf.with_page = lambda c, headless, fn: (NET, _fixture_rows(), bad_summary, None, None)
        err = io.StringIO()
        try:
            with contextlib.redirect_stderr(err), self.assertRaises(SystemExit) as cm:
                self._run()
            self.assertEqual(cm.exception.code, 3)
            self.assertIn("[NOTIFY] [dry-run] 種類ズレ", err.getvalue())
            self.assertEqual(fetch_mf._NOTIFY_PREFIX, "")  # 終了後は元に戻る
            err2 = io.StringIO()
            with contextlib.redirect_stderr(err2):
                fetch_mf.notify("テスト通知")
            self.assertIn("[NOTIFY] テスト通知", err2.getvalue())
            self.assertNotIn("[dry-run]", err2.getvalue())
        finally:
            fetch_mf.subprocess.run = orig_run
            os.environ.clear()
            os.environ.update(orig_env)
        self.assertEqual(self.calls, [])


class TestMainArgs(unittest.TestCase):
    """#687 レビュー M1: 打ち間違い・未知オプションで本番 run（書き出し・KV・commit/push）に入らない。"""

    def setUp(self):
        self.calls = []
        self._orig = {n: getattr(fetch_mf, n) for n in ("do_run", "do_setup", "cfg")}
        fetch_mf.do_run = lambda c, dry_run=False: self.calls.append(("run", dry_run))
        fetch_mf.do_setup = lambda c: self.calls.append(("setup",))
        fetch_mf.cfg = lambda: {}

    def tearDown(self):
        for n, v in self._orig.items():
            setattr(fetch_mf, n, v)

    def _main(self, *args):
        fetch_mf.main(["fetch_mf.py", *args])

    def test_valid_commands(self):
        self._main()
        self._main("run")
        self._main("run", "--dry-run")
        self._main("--dry-run")  # 単独でも dry-run（本番には入らない）
        self._main("--dry-run", "run")
        self._main("setup")
        self.assertEqual(
            self.calls,
            [("run", False), ("run", False), ("run", True), ("run", True), ("run", True), ("setup",)],
        )

    def test_invalid_args_exit_2_without_running(self):
        import io
        import contextlib
        bad = [
            ("--dryrun",), ("--dry_run",), ("-n",), ("run", "--dry"), ("run", "--force"),
            ("dry-run",), ("rnu",), ("run", "extra"), ("setup", "--dry-run"),
        ]
        for args in bad:
            with self.subTest(args=args):
                err = io.StringIO()
                with contextlib.redirect_stderr(err), self.assertRaises(SystemExit) as cm:
                    self._main(*args)
                self.assertEqual(cm.exception.code, 2)
                self.assertIn("本番処理はしていない", err.getvalue())
        self.assertEqual(self.calls, [])


class TestPushNetworthToWorker(unittest.TestCase):
    """#589 Phase2: push_networth_to_worker() の fail-soft 挙動を検算する。
    実ネットワーク呼び出しはしない（urllib.request.urlopen をモック）。"""

    def setUp(self):
        self.notified = []
        self._orig_notify = fetch_mf.notify
        fetch_mf.notify = lambda msg, *a, **k: self.notified.append(msg)
        self._orig_env = dict(os.environ)

    def tearDown(self):
        fetch_mf.notify = self._orig_notify
        os.environ.clear()
        os.environ.update(self._orig_env)

    def test_missing_env_notifies_and_returns_false(self):
        os.environ.pop("MF_WORKER_URL", None)
        os.environ.pop("MF_PIN_HASH", None)
        result = fetch_mf.push_networth_to_worker({"asOf": "2026-07-21"})
        self.assertFalse(result)
        self.assertTrue(any("MF_WORKER_URL" in m for m in self.notified))

    def test_success_returns_true_and_sends_pin_header(self):
        os.environ["MF_WORKER_URL"] = "https://example.invalid"
        os.environ["MF_PIN_HASH"] = "deadbeef"
        captured = {}

        class _FakeResponse:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        def _fake_urlopen(req, timeout=None):
            captured["url"] = req.full_url
            captured["method"] = req.get_method()
            captured["pin_hash"] = req.get_header("X-pin-hash")
            return _FakeResponse()

        orig_urlopen = fetch_mf.urllib.request.urlopen
        fetch_mf.urllib.request.urlopen = _fake_urlopen
        try:
            result = fetch_mf.push_networth_to_worker({"asOf": "2026-07-21"})
        finally:
            fetch_mf.urllib.request.urlopen = orig_urlopen

        self.assertTrue(result)
        self.assertEqual(captured["url"], "https://example.invalid/networth")
        self.assertEqual(captured["method"], "PUT")
        self.assertEqual(captured["pin_hash"], "deadbeef")
        self.assertEqual(self.notified, [])

    def test_non_200_notifies_and_returns_false(self):
        os.environ["MF_WORKER_URL"] = "https://example.invalid"
        os.environ["MF_PIN_HASH"] = "deadbeef"

        class _FakeResponse:
            status = 500

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        orig_urlopen = fetch_mf.urllib.request.urlopen
        fetch_mf.urllib.request.urlopen = lambda req, timeout=None: _FakeResponse()
        try:
            result = fetch_mf.push_networth_to_worker({"asOf": "2026-07-21"})
        finally:
            fetch_mf.urllib.request.urlopen = orig_urlopen

        self.assertFalse(result)
        self.assertTrue(any("HTTP 500" in m for m in self.notified))

    def test_exception_notifies_and_returns_false(self):
        os.environ["MF_WORKER_URL"] = "https://example.invalid"
        os.environ["MF_PIN_HASH"] = "deadbeef"

        def _raise(req, timeout=None):
            raise OSError("network down")

        orig_urlopen = fetch_mf.urllib.request.urlopen
        fetch_mf.urllib.request.urlopen = _raise
        try:
            result = fetch_mf.push_networth_to_worker({"asOf": "2026-07-21"})
        finally:
            fetch_mf.urllib.request.urlopen = orig_urlopen

        self.assertFalse(result)
        self.assertTrue(any("network down" in m for m in self.notified))


class TestPushNetworthDiagnostics(unittest.TestCase):
    """#684 A1: HTTPError/URLError の診断ログと User-Agent の明示を検算する（合成値のみ）。"""

    PIN = "SYNTHETIC_PIN_HASH"
    AMOUNT = 98765432  # 合成金額

    def setUp(self):
        import io
        self.notified = []
        self._orig_notify = fetch_mf.notify
        fetch_mf.notify = lambda msg, *a, **k: self.notified.append(msg)
        self._orig_env = dict(os.environ)
        self._orig_urlopen = fetch_mf.urllib.request.urlopen
        self._orig_stderr = sys.stderr
        self.stderr = io.StringIO()
        sys.stderr = self.stderr
        os.environ["MF_WORKER_URL"] = "https://worker.example.invalid/"
        os.environ["MF_PIN_HASH"] = self.PIN
        self.captured = {}

    def tearDown(self):
        sys.stderr = self._orig_stderr
        fetch_mf.urllib.request.urlopen = self._orig_urlopen
        fetch_mf.notify = self._orig_notify
        os.environ.clear()
        os.environ.update(self._orig_env)

    def _doc(self):
        return {"asOf": "2026-10-04", "totals": {"imported": self.AMOUNT, "netWorthComputed": self.AMOUNT}}

    def _raise_http(self, code, reason, headers, body):
        import io
        import email.message
        import urllib.error

        msg = email.message.Message()
        for k, v in headers.items():
            msg[k] = v

        def _fake(req, timeout=None):
            self.captured["ua"] = req.get_header("User-agent")
            self.captured["url"] = req.full_url
            raise urllib.error.HTTPError(req.full_url, code, reason, msg, io.BytesIO(body))

        fetch_mf.urllib.request.urlopen = _fake

    def _assert_no_secrets(self):
        out = "\n".join(self.notified) + "\n" + self.stderr.getvalue()
        for bad in (self.PIN, str(self.AMOUNT), f"{self.AMOUNT:,}", "X-Pin-Hash", "netWorthComputed"):
            self.assertNotIn(bad, out)

    def test_http_403_cloudflare_text_body(self):
        self._raise_http(
            403,
            "Forbidden",
            {"Server": "cloudflare", "CF-RAY": "0000000000000000-XXX", "Content-Type": "text/plain; charset=UTF-8"},
            b"error code: 1010",
        )
        result = fetch_mf.push_networth_to_worker(self._doc())
        self.assertFalse(result)
        self.assertEqual(len(self.notified), 1)
        m = self.notified[0]
        self.assertIn("networth KV 送信失敗: HTTP 403 Forbidden", m)
        self.assertIn("server=cloudflare", m)
        self.assertIn("cf-ray=0000000000000000-XXX", m)
        self.assertIn('body="error code: 1010"', m)
        self.assertIn("host=worker.example.invalid/networth", m)
        self.assertIn(m, self.stderr.getvalue())  # ログ（stderr）にも同じ 1 行
        self._assert_no_secrets()

    def test_request_has_explicit_user_agent(self):
        self._raise_http(403, "Forbidden", {}, b"")
        fetch_mf.push_networth_to_worker(self._doc())
        self.assertEqual(self.captured["ua"], fetch_mf.WORKER_USER_AGENT)
        self.assertTrue(self.captured["ua"].startswith("portfolio-mf-snapshot/1 (+"))

    def test_html_body_extracts_only_code_and_title(self):
        body = (
            b"<!DOCTYPE html><html><head><title>Access denied | worker.example.invalid used Cloudflare</title>"
            b"</head><body><p>secret-ish page text SHOULD_NOT_APPEAR</p><span>Error code: 1010</span></body></html>"
        )
        self._raise_http(
            403, "Forbidden", {"Server": "cloudflare", "cf-mitigated": "challenge", "Content-Type": "text/html"}, body
        )
        fetch_mf.push_networth_to_worker(self._doc())
        m = self.notified[0]
        self.assertIn("cf-mitigated=challenge", m)
        self.assertIn("error code: 1010", m)
        self.assertIn("title: Access denied", m)
        self.assertNotIn("SHOULD_NOT_APPEAR", m)
        self._assert_no_secrets()

    def test_long_body_truncated_to_160(self):
        self._raise_http(500, "Internal Server Error", {"Content-Type": "application/json"}, b"x" * 2000)
        fetch_mf.push_networth_to_worker(self._doc())
        m = self.notified[0]
        snippet = m.split('body="', 1)[1].split('"', 1)[0]
        self.assertEqual(len(snippet), 160)

    def test_url_error_reports_class_and_reason(self):
        import urllib.error

        def _fake(req, timeout=None):
            raise urllib.error.URLError("proxy refused")

        fetch_mf.urllib.request.urlopen = _fake
        result = fetch_mf.push_networth_to_worker(self._doc())
        self.assertFalse(result)
        self.assertEqual(len(self.notified), 1)
        m = self.notified[0]
        self.assertIn("URLError", m)
        self.assertIn("reason=proxy refused", m)
        self.assertIn("host=worker.example.invalid/networth", m)
        self._assert_no_secrets()


class TestUpdateRealAssets(unittest.TestCase):
    """#580 スコープA': update_real_assets の field-level merge / ±guard% / fail-soft 検算。

    scrape_real_estate の DOM 走査は実機のみ＝ここでは更新ロジックを一時ディレクトリで検証する。
    """

    REC = {
        "id": "property-a",
        "name": "テスト物件A（合成データ）",
        "valueHowMa": 80_000_000,
        "haircut": 1.0,
        "loanBalance": 12_345_678,
        "notes": "手入力メモ",
    }

    def setUp(self):
        import tempfile

        self._td = tempfile.TemporaryDirectory()
        self.root = self._td.name
        d = os.path.join(self.root, "data", "real-assets")
        os.makedirs(d)
        self.path = os.path.join(d, "property-a.json")
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self.REC, f, ensure_ascii=False)
        self.c = {"realAssets": {"dir": "data/real-assets"}, "fetch": {"realEstate": {"guardPct": 50}}}
        self._orig_root = fetch_mf.ROOT
        self._orig_notify = fetch_mf.notify
        fetch_mf.ROOT = self.root
        self.notified = []
        fetch_mf.notify = lambda msg, *a, **k: self.notified.append(msg)

    def tearDown(self):
        fetch_mf.ROOT = self._orig_root
        fetch_mf.notify = self._orig_notify
        self._td.cleanup()

    def _read(self):
        with open(self.path, encoding="utf-8") as f:
            return json.load(f)

    def test_updates_value_howma_only(self):
        n = fetch_mf.update_real_assets(self.c, {"property-a": 90_000_000})
        self.assertEqual(n, 1)
        rec = self._read()
        self.assertEqual(rec["valueHowMa"], 90_000_000)
        # field-level merge: 他フィールド（掛目/ローン/メモ）は保持
        for k in ("haircut", "loanBalance", "notes", "name", "id"):
            self.assertEqual(rec[k], self.REC[k])

    def test_guard_blocks_abnormal_jump(self):
        # 前回比 +50% 超（80M → 140M）は異常値扱い＝維持＋通知
        n = fetch_mf.update_real_assets(self.c, {"property-a": 140_000_000})
        self.assertEqual(n, 0)
        self.assertEqual(self._read()["valueHowMa"], 80_000_000)
        self.assertTrue(any("±50%" in m for m in self.notified))

    def test_missing_file_notifies_and_keeps_going(self):
        n = fetch_mf.update_real_assets(self.c, {"no-such-id": 1_000_000, "property-a": 90_000_000})
        self.assertEqual(n, 1)  # 欠落は通知だけで他は更新
        self.assertTrue(any("no-such-id" in m for m in self.notified))

    def test_same_value_does_not_rewrite(self):
        before = os.path.getmtime(self.path)
        n = fetch_mf.update_real_assets(self.c, {"property-a": 80_000_000})
        self.assertEqual(n, 0)
        self.assertEqual(os.path.getmtime(self.path), before)  # ファイル未接触＝無駄 commit なし

    def test_none_is_noop(self):
        self.assertEqual(fetch_mf.update_real_assets(self.c, None), 0)



# ── #685 B2/B3: 再試行・待ち条件・dry-run（Playwright はモック・合成値のみ） ──────────
import io  # noqa: E402
import errno  # noqa: E402
import tempfile  # noqa: E402
import contextlib  # noqa: E402


class _FakeCtx:
    def __init__(self, log, close_raises=False):
        self.log = log
        self.pages = ["page"]
        self.close_raises = close_raises

    def close(self):
        self.log.append("close")
        if self.close_raises:
            raise fetch_mf.PlaywrightError("close failed")


class _FakePlaywright:
    """sync_playwright() の代替。launch の振る舞いを試行ごとに台本で決める。"""

    def __init__(self, launch_script, log, close_raises=False):
        self.launch_script = launch_script
        self.log = log
        self.close_raises = close_raises
        self.chromium = self

    def __call__(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def launch_persistent_context(self, udd, headless=False):
        self.log.append("launch")
        action = self.launch_script.pop(0) if self.launch_script else None
        if isinstance(action, BaseException):
            raise action
        return _FakeCtx(self.log, self.close_raises)


class _RetryBase(unittest.TestCase):
    def setUp(self):
        self.c = _load_config()
        self.tmp = tempfile.TemporaryDirectory()
        self.c["fetch"]["userDataDir"] = os.path.join(self.tmp.name, "profile")
        self.notified = []
        self.sleeps = []
        self.log = []
        self._saved = {
            "notify": fetch_mf.notify,
            "sync_playwright": fetch_mf.sync_playwright,
            "_scrape_all": fetch_mf._scrape_all,
            "sleep": fetch_mf.time.sleep,
        }
        fetch_mf.notify = lambda msg, *a, **k: self.notified.append(msg)
        fetch_mf.time.sleep = lambda sec: self.sleeps.append(sec)

    def tearDown(self):
        fetch_mf.notify = self._saved["notify"]
        fetch_mf.sync_playwright = self._saved["sync_playwright"]
        fetch_mf._scrape_all = self._saved["_scrape_all"]
        fetch_mf.time.sleep = self._saved["sleep"]
        self.tmp.cleanup()

    def _install(self, launch_script=(), scrape_script=(), close_raises=False):
        fetch_mf.sync_playwright = _FakePlaywright(list(launch_script), self.log, close_raises)
        script = list(scrape_script)

        def _fake_scrape_all(page, c):
            self.log.append("scrape")
            action = script.pop(0) if script else "ok"
            if isinstance(action, BaseException):
                raise action
            if callable(action):
                return action()
            return ("NET", ["row"], {}, None, None)

        fetch_mf._scrape_all = _fake_scrape_all

    def _run_quiet(self, fn, *a, **k):
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            out = fn(*a, **k)
        return out, err.getvalue()


class TestFetchRetry(_RetryBase):
    def test_constants(self):
        self.assertEqual(fetch_mf.FETCH_ATTEMPTS, 3)
        self.assertEqual(tuple(fetch_mf.FETCH_RETRY_WAITS), (30, 120))

    def test_a_timeout_then_success_no_notify(self):
        self._install(scrape_script=[fetch_mf.PlaywrightTimeoutError("Page.goto: Timeout 45000ms exceeded."), "ok"])
        result, err = self._run_quiet(fetch_mf.fetch_with_retry, self.c)
        self.assertEqual(result, ("NET", ["row"], {}, None, None))
        self.assertEqual(self.log.count("launch"), 2)
        self.assertEqual(self.sleeps, [30])
        self.assertEqual(self.notified, [])
        self.assertIn("attempt 1/3 failed: ", err)
        self.assertIn("TimeoutError (Page.goto: Timeout 45000ms exceeded.)", err)
        self.assertIn("retry in 30s", err)
        self.assertIn("attempt 2/3 succeeded", err)

    def test_first_try_success_is_silent(self):
        self._install()
        _, err = self._run_quiet(fetch_mf.fetch_with_retry, self.c)
        self.assertEqual(err, "")
        self.assertEqual(self.log, ["launch", "scrape", "close"])
        self.assertEqual(self.notified, [])

    def test_b_eagain_three_times_gives_up_with_one_notify(self):
        self._install(launch_script=[OSError(errno.EAGAIN, "Resource temporarily unavailable")] * 3)
        with self.assertRaises(SystemExit) as cm:
            self._run_quiet(fetch_mf.fetch_with_retry, self.c)
        self.assertEqual(cm.exception.code, 1)
        self.assertEqual(self.log.count("launch"), 3)
        self.assertEqual(self.sleeps, [30, 120])
        self.assertEqual(len(self.notified), 1)
        self.assertIn("3 回", self.notified[0])
        # OSError(EAGAIN) は Python が BlockingIOError として生成する
        self.assertIn("BlockingIOError", self.notified[0])

    def test_b_blocking_io_error_is_transient(self):
        self._install(launch_script=[BlockingIOError(errno.EAGAIN, "Resource temporarily unavailable"), None])
        result, _ = self._run_quiet(fetch_mf.fetch_with_retry, self.c)
        self.assertEqual(result[1], ["row"])
        self.assertEqual(self.log.count("launch"), 2)

    def test_b_playwright_launch_error_spawn_eagain_is_transient(self):
        e = fetch_mf.PlaywrightError("BrowserType.launch_persistent_context: spawn EAGAIN")
        self._install(launch_script=[e, None])
        result, _ = self._run_quiet(fetch_mf.fetch_with_retry, self.c)
        self.assertEqual(result[1], ["row"])
        self.assertEqual(self.log.count("launch"), 2)
        self.assertEqual(self.notified, [])

    def test_target_closed_is_transient(self):
        self._install(scrape_script=[fetch_mf.PlaywrightError("Target page, context or browser has been closed"), "ok"])
        result, _ = self._run_quiet(fetch_mf.fetch_with_retry, self.c)
        self.assertEqual(result[1], ["row"])

    def test_c_login_expired_aborts_without_retry(self):
        def _login_exit():
            fetch_mf.notify("ログイン切れ。`python scripts/fetch_mf.py setup` で再ログインして。")
            raise SystemExit(2)

        self._install(scrape_script=[_login_exit])
        with self.assertRaises(SystemExit) as cm:
            self._run_quiet(fetch_mf.fetch_with_retry, self.c)
        self.assertEqual(cm.exception.code, 2)
        self.assertEqual(self.log, ["launch", "scrape", "close"])
        self.assertEqual(self.sleeps, [])
        self.assertEqual(len(self.notified), 1)
        self.assertIn("ログイン切れ", self.notified[0])

    def test_non_transient_errors_not_retried(self):
        for exc in (
            ValueError("boom"),
            fetch_mf.PlaywrightError("locator.inner_text: Element is not attached"),
            OSError(errno.ENOENT, "missing"),
        ):
            self.log.clear()
            self._install(scrape_script=[exc])
            with self.assertRaises(type(exc)):
                self._run_quiet(fetch_mf.fetch_with_retry, self.c)
            self.assertEqual(self.log.count("launch"), 1, repr(exc))
        self.assertEqual(self.sleeps, [])
        self.assertEqual(self.notified, [])

    def test_e_close_called_after_each_attempt(self):
        t = fetch_mf.PlaywrightTimeoutError("Timeout 45000ms exceeded.")
        self._install(scrape_script=[t, t, t])
        with self.assertRaises(SystemExit):
            self._run_quiet(fetch_mf.fetch_with_retry, self.c)
        self.assertEqual(self.log, ["launch", "scrape", "close"] * 3)

    def test_e_close_failure_is_ignored_and_retry_continues(self):
        self._install(scrape_script=[fetch_mf.PlaywrightTimeoutError("Timeout"), "ok"], close_raises=True)
        result, _ = self._run_quiet(fetch_mf.fetch_with_retry, self.c)
        self.assertEqual(result[1], ["row"])
        self.assertEqual(self.log.count("close"), 2)


_RUN_PATCHED = ("update_real_assets", "push_networth_to_worker", "git_commit_push", "_run_history_script", "OUT",
                "_fetch_once", "_load_previous_output")


class _RunBase(_RetryBase):
    """do_run の検証・書き込み・commit/push・KV 送信がループの外で 1 回だけであることを確かめる。"""

    def setUp(self):
        super().setUp()
        self.calls = []
        self.out = os.path.join(self.tmp.name, "mf-holdings.json")
        for name in _RUN_PATCHED:
            self._saved[name] = getattr(fetch_mf, name)
        fetch_mf.OUT = self.out
        fetch_mf.update_real_assets = lambda c, v: self.calls.append("update_real_assets") or 0
        fetch_mf.push_networth_to_worker = lambda doc: self.calls.append("push") or True
        fetch_mf.git_commit_push = lambda extra=(): self.calls.append("commit")
        fetch_mf._run_history_script = lambda: self.calls.append("history")
        fetch_mf._load_previous_output = lambda path=None: None  # dry-run の直近出力比較は省略（#687）

    def tearDown(self):
        for name in _RUN_PATCHED:
            setattr(fetch_mf, name, self._saved[name])
        super().tearDown()

    def _set_fetch(self, script):
        script = list(script)

        def _fake_fetch_once(c):
            self.calls.append("fetch")
            action = script.pop(0)
            if isinstance(action, BaseException):
                raise action
            return action

        fetch_mf._fetch_once = _fake_fetch_once

    def _good(self):
        return (NET, _fixture_rows(), _fixture_summary(), None, None)

    def _bad_summary(self):
        bad = _fixture_summary()
        bad[fetch_mf._norm("投資信託")] = SUM_MF * 2
        return bad


class TestDoRunRetryScope(_RunBase):
    def test_retry_then_side_effects_once(self):
        self._set_fetch([fetch_mf.TransientFetchError("TimeoutError (x)"), self._good()])
        with contextlib.redirect_stdout(io.StringIO()):
            self._run_quiet(fetch_mf.do_run, self.c)
        self.assertEqual(self.calls, ["fetch", "fetch", "update_real_assets", "push", "commit", "history"])
        self.assertTrue(os.path.exists(self.out))
        self.assertEqual(self.notified, [])

    def test_d_checksum_mismatch_not_retried(self):
        self._set_fetch([(NET, _fixture_rows(), self._bad_summary(), None, None)])
        with self.assertRaises(SystemExit) as cm:
            self._run_quiet(fetch_mf.do_run, self.c)
        self.assertEqual(cm.exception.code, 3)
        self.assertEqual(self.calls, ["fetch"])
        self.assertFalse(os.path.exists(self.out))
        self.assertEqual(len(self.notified), 1)

    def test_zero_rows_not_retried(self):
        self._set_fetch([(NET, [], _fixture_summary(), None, None)])
        with self.assertRaises(SystemExit) as cm:
            self._run_quiet(fetch_mf.do_run, self.c)
        self.assertEqual(cm.exception.code, 3)
        self.assertEqual(self.calls, ["fetch"])


class TestDryRunRetryScope(_RunBase):
    """#685: dry-run でも取得は再試行の経路を通り、検証まで行って副作用を呼ばない（表示は #687 形式）。"""

    def test_dry_run_skips_write_commit_kv_and_hides_amounts(self):
        self._set_fetch([self._good()])
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self._run_quiet(fetch_mf.do_run, self.c, dry_run=True)
        self.assertEqual(self.calls, ["fetch"])
        self.assertFalse(os.path.exists(self.out))
        text = out.getvalue()
        self.assertIn("[dry-run] OK", text)
        self.assertIn("[dry-run] verify=passed rows=7 holdings=5 excludedAccounts=2", text)
        self.assertIn("liabilities=skipped realEstate=skipped", text)
        for amount in (NET, SUM_EQ, SUM_MF, SUM_DEPO):
            self.assertNotIn(f"{amount:,}", text)
            self.assertNotIn(str(amount), text)
        self.assertNotIn("サンプル証券", text)
        self.assertEqual(self.notified, [])

    def test_dry_run_still_verifies(self):
        self._set_fetch([(NET, _fixture_rows(), self._bad_summary(), None, None)])
        with self.assertRaises(SystemExit) as cm:
            self._run_quiet(fetch_mf.do_run, self.c, dry_run=True)
        self.assertEqual(cm.exception.code, 3)
        self.assertEqual(self.calls, ["fetch"])


class _EmptyLoc:
    def count(self):
        return 0

    def inner_text(self):
        return ""

    def nth(self, i):
        return self

    def locator(self, sel):
        return self


class _WaitPage:
    """scrape()/scrape_liabilities() の待ち条件だけを記録する合成ページ。"""

    def __init__(self, url="https://example.invalid/bs/portfolio", selector_raises=None, redirect_on_wait=None):
        self.url = url
        self.calls = []
        self.selector_raises = selector_raises
        self.redirect_on_wait = redirect_on_wait

    def goto(self, url, timeout=None, wait_until=None):
        self.calls.append(("goto", url, timeout, wait_until))

    def wait_for_selector(self, selector, timeout=None, state=None):
        self.calls.append(("wait_for_selector", selector, timeout, state))
        if self.redirect_on_wait:
            self.url = self.redirect_on_wait
        if self.selector_raises:
            raise self.selector_raises

    def wait_for_timeout(self, ms):
        self.calls.append(("wait_for_timeout", ms))

    def locator(self, sel):
        return _EmptyLoc()


class TestWaitCondition(unittest.TestCase):
    """#685 B3: networkidle → domcontentloaded＋表の出現待ち（セレクタ・待ち時間は config）。"""

    def setUp(self):
        self.c = _load_config()
        self.f = self.c["fetch"]
        self.notified = []
        self._orig_notify = fetch_mf.notify
        fetch_mf.notify = lambda msg, *a, **k: self.notified.append(msg)

    def tearDown(self):
        fetch_mf.notify = self._orig_notify

    def test_source_has_no_networkidle_wait(self):
        with open(os.path.join(ROOT, "scripts", "fetch_mf.py"), encoding="utf-8") as fp:
            self.assertNotIn('wait_until="networkidle"', fp.read())

    def test_portfolio_waits_for_config_tables(self):
        page = _WaitPage()
        fetch_mf.scrape(page, self.c)
        want_sel = ", ".join(t["selector"] for t in self.f["dom"]["tables"])
        self.assertEqual(page.calls[0], ("goto", self.f["portfolioUrl"], self.f["timeoutMs"], "domcontentloaded"))
        self.assertEqual(page.calls[1], ("wait_for_selector", want_sel, self.f["timeoutMs"], "attached"))
        self.assertEqual(page.calls[2], ("wait_for_timeout", self.f["settleMs"]))

    def test_selector_timeout_propagates_as_transient(self):
        page = _WaitPage(selector_raises=fetch_mf.PlaywrightTimeoutError("Timeout 45000ms exceeded."))
        with self.assertRaises(fetch_mf.PlaywrightTimeoutError) as cm:
            fetch_mf.scrape(page, self.c)
        self.assertTrue(fetch_mf._is_transient(cm.exception))

    def test_login_redirect_before_wait_is_login_expired(self):
        page = _WaitPage(url="https://example.invalid/sign_in")
        with self.assertRaises(SystemExit) as cm:
            fetch_mf.scrape(page, self.c)
        self.assertEqual(cm.exception.code, 2)
        self.assertNotIn("wait_for_selector", [x[0] for x in page.calls])
        self.assertTrue(any("ログイン切れ" in m for m in self.notified))

    def test_login_redirect_during_wait_is_login_expired(self):
        page = _WaitPage(
            selector_raises=fetch_mf.PlaywrightTimeoutError("Timeout"),
            redirect_on_wait="https://example.invalid/sign_in",
        )
        with self.assertRaises(SystemExit) as cm:
            fetch_mf.scrape(page, self.c)
        self.assertEqual(cm.exception.code, 2)

    def test_liabilities_waits_for_config_table(self):
        lc = self.f.get("liabilities")
        if not lc or not self.c.get("include", {}).get("liabilities", {}).get("enabled"):
            self.skipTest("liabilities disabled in config")
        page = _WaitPage()
        self.assertIsNone(fetch_mf.scrape_liabilities(page, self.c))  # 0 行＝fail-soft
        self.assertEqual(page.calls[0], ("goto", lc["url"], self.f["timeoutMs"], "domcontentloaded"))
        self.assertEqual(page.calls[1], ("wait_for_selector", lc["table"]["selector"], self.f["timeoutMs"], "attached"))

    def test_liabilities_timeout_stays_fail_soft(self):
        lc = self.f.get("liabilities")
        if not lc or not self.c.get("include", {}).get("liabilities", {}).get("enabled"):
            self.skipTest("liabilities disabled in config")
        page = _WaitPage(selector_raises=fetch_mf.PlaywrightTimeoutError("Timeout"))
        self.assertIsNone(fetch_mf.scrape_liabilities(page, self.c))
        self.assertEqual(len(self.notified), 1)
        self.assertIn("負債", self.notified[0])


if __name__ == "__main__":
    unittest.main()
