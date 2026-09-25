#!/usr/bin/env python3
"""Tests for the reproducible Truthy scholarly selection contract."""

from __future__ import annotations

import argparse
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[4]
SCRIPT = ROOT / "development/commands/benchmark/scripts/select_truthy_scholarly_qids.py"
SPEC = importlib.util.spec_from_file_location("truthy_selection", SCRIPT)
assert SPEC and SPEC.loader
SELECTION = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SELECTION)


class TruthyScholarlySelectionTest(unittest.TestCase):
    def test_queries_direct_scholarly_items_and_records_truthy_estimate(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "selection"
            arguments = argparse.Namespace(parquet="hf://dataset/statements.parquet", snapshot_revision="2026-03-26", parquet_sha256="abc", output=output,
                                           limit=2, seed="stable", duckdb="duckdb", duckdb_python=False)
            calls: list[tuple[str, bool]] = []

            def duckdb(_arguments: argparse.Namespace, sql: str, json_output: bool = False) -> str:
                calls.append((sql, json_output))
                if json_output:
                    return json.dumps([{"eligible_items": 45_000_000, "selected_items": 2,
                                        "selected_truthy_statements": 17, "mean_truthy_statements_per_selected_item": 8.5,
                                        "duckdb_version": "v1-test"}])
                (output / "qids.txt").write_text("Q100\nQ200\n")
                return ""

            with patch.object(SELECTION.shutil, "which", return_value="/usr/bin/duckdb"), patch.object(SELECTION, "run_duckdb", side_effect=duckdb):
                manifest = SELECTION.select(arguments)
            self.assertEqual("direct P31=Q13442814 scholarly article", manifest["selection"]["scope"])
            self.assertEqual(17, manifest["statistics"]["selected_truthy_statements"])
            self.assertTrue(any("property = 31 AND object_id = 13442814" in sql for sql, _ in calls))
            self.assertEqual(["Q100", "Q200"], (output / "qids.txt").read_text().splitlines())

    def test_refuses_unpinned_selection_output(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "selection"; output.mkdir()
            arguments = argparse.Namespace(parquet="test.parquet", snapshot_revision="r", parquet_sha256="abc", output=output, limit=1, seed="s", duckdb="duckdb", duckdb_python=False)
            with self.assertRaisesRegex(ValueError, "existing selection"):
                SELECTION.select(arguments)


if __name__ == "__main__":
    unittest.main()
