#!/usr/bin/env python3
"""scripts/fetch_mf_history.py の merge()/stamp_liabilities() 純ロジック検算（#577）。

CSV 取得（Playwright）は実機のみ。ここでは
- merge が CSV に無いキー（liabilities）を既存行から保護すること
- stamp_liabilities が「日付一致行のみ」に刻むこと（日付ズレ防止）
を stdlib unittest で検証する。

実行: python3 -m unittest tests/test_fetch_mf_history.py -v
"""
import os
import sys
import json
import tempfile
import unittest
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import fetch_mf_history  # noqa: E402


class TestMergePreservesExtraKeys(unittest.TestCase):
    def test_csv_overwrite_keeps_liabilities(self):
        # 既存行に負債列が刻まれている。CSV 再取得（同日付・負債列なし）で消えてはいけない。
        existing = [
            {"date": "2026-07-18", "total": 100, "cash": 10, "liabilities": 12_345_678},
            {"date": "2026-07-17", "total": 99, "cash": 9},
        ]
        new = {"2026-07-18": {"date": "2026-07-18", "total": 101, "cash": 11}}
        out = fetch_mf_history.merge(existing, new)
        by = {r["date"]: r for r in out}
        self.assertEqual(by["2026-07-18"]["total"], 101)  # CSV 列は最新で上書き
        self.assertEqual(by["2026-07-18"]["liabilities"], 12_345_678)  # 保護
        self.assertNotIn("liabilities", by["2026-07-17"])  # 過去分は null 許容＝キー無し

    def test_new_dates_appended_sorted(self):
        existing = [{"date": "2026-07-17", "total": 1}]
        new = {"2026-07-19": {"date": "2026-07-19", "total": 3}, "2026-07-18": {"date": "2026-07-18", "total": 2}}
        out = fetch_mf_history.merge(existing, new)
        self.assertEqual([r["date"] for r in out], ["2026-07-17", "2026-07-18", "2026-07-19"])


class TestStampLiabilities(unittest.TestCase):
    def _with_holdings(self, holdings_doc, series):
        """mf-holdings.json を一時ファイルに差し替えて stamp_liabilities を実行。"""
        with tempfile.TemporaryDirectory() as td:
            data_dir = os.path.join(td, "data")
            os.makedirs(data_dir)
            with open(os.path.join(data_dir, "mf-holdings.json"), "w", encoding="utf-8") as f:
                json.dump(holdings_doc, f)
            with mock.patch.object(fetch_mf_history, "ROOT", td):
                fetch_mf_history.stamp_liabilities(series)
        return series

    def test_stamps_matching_date_only(self):
        series = [{"date": "2026-07-18", "total": 1}, {"date": "2026-07-19", "total": 2}]
        doc = {"asOf": "2026-07-19", "totals": {"liabilitiesTotal": 12_345_678}}
        self._with_holdings(doc, series)
        self.assertEqual(series[1]["liabilities"], 12_345_678)
        self.assertNotIn("liabilities", series[0])

    def test_no_matching_date_leaves_series_untouched(self):
        # 対応日の行が無い＝どの行にも刻まない（古い行に刻むと日付がズレるため）
        series = [{"date": "2026-07-18", "total": 1}]
        doc = {"asOf": "2026-07-19", "totals": {"liabilitiesTotal": 12_345_678}}
        self._with_holdings(doc, series)
        self.assertNotIn("liabilities", series[0])

    def test_v4_holdings_without_liabilities_is_noop(self):
        series = [{"date": "2026-07-19", "total": 1}]
        doc = {"asOf": "2026-07-19", "totals": {"mfNetWorth": 1, "imported": 1}}
        self._with_holdings(doc, series)
        self.assertNotIn("liabilities", series[0])


if __name__ == "__main__":
    unittest.main()
