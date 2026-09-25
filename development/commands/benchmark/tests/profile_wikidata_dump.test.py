#!/usr/bin/env python3
"""Regression test for the dump-profile artifact."""
from __future__ import annotations
import gzip
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
SPEC = importlib.util.spec_from_file_location("profile", ROOT / "development/commands/benchmark/scripts/profile_wikidata_dump.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

class ProfileTest(unittest.TestCase):
    def test_records_shape_distribution(self) -> None:
        values = [{"id": "Q1", "type": "item", "claims": {}}, {"id": "Q2", "type": "item", "claims": {"P1": [{"mainsnak": {"datatype": "string"}}, {"mainsnak": {"datatype": "string"}}]}}]
        with tempfile.TemporaryDirectory() as directory:
            dump = Path(directory) / "sample.json.gz"
            with gzip.open(dump, "wt", encoding="utf-8") as stream: json.dump(values, stream)
            result = MODULE.profile(str(dump))
        self.assertTrue(result["complete_dump"])
        self.assertEqual(2, result["items_profiled"])
        self.assertEqual(2, result["source_statements"])
        self.assertEqual(1, next(bucket["items"] for bucket in result["statement_buckets"] if bucket["name"] == "0"))
        self.assertEqual(1, next(bucket["items"] for bucket in result["statement_buckets"] if bucket["name"] == "2-4"))

if __name__ == "__main__": unittest.main()
