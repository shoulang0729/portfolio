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


class TestParseAmount(unittest.TestCase):
    """#480: parse_amount は int() を保護し、想定外文字でも例外を投げず 0 を返す。"""

    def test_normal(self):
        self.assertEqual(fetch_mf.parse_amount("1,234,567円"), 1234567)
        self.assertEqual(fetch_mf.parse_amount("¥338,454,356"), 338454356)

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
        tr = _FakeTr({"th, td": ["株式(現物)", "338,454,356円", "57.85%"]})
        self.assertEqual(fetch_mf._cells(tr), ["株式(現物)", "338,454,356円", "57.85%"])

    def test_asset_row_td_only_unchanged(self):
        # 保有テーブルのデータ行は td のみ＝列インデックス不変
        tr = _FakeTr({"th, td": ["", "NTTデータグループ", "1", "4,400,412"]})
        self.assertEqual(fetch_mf._cells(tr), ["", "NTTデータグループ", "1", "4,400,412"])


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
        # ★#589 Phase1: 公開 config の liabilityAccountMap / realEstate.nameMap は note 以外空・
        # 負債/不動産スクレイプは無効化（Phase2 の KV 移行まで）
        cfg = _load_config()
        self.assertEqual([k for k in cfg["liabilityAccountMap"] if k != "note"], [])
        self.assertEqual([k for k in cfg["fetch"]["realEstate"]["nameMap"] if k != "note"], [])
        self.assertFalse(cfg["include"]["liabilities"]["enabled"])
        self.assertFalse(cfg["fetch"]["realEstate"]["enabled"])


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


if __name__ == "__main__":
    unittest.main()
