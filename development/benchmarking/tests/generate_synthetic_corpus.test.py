#!/usr/bin/env python3
"""Regression test for the deterministic synthetic control corpus."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
GENERATOR = ROOT / "development/benchmarking/scripts/generate_synthetic_corpus.py"


class GenerateSyntheticCorpusTest(unittest.TestCase):
    def test_writes_the_requested_statement_budget(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "corpus"
            subprocess.run(
                [
                    sys.executable,
                    str(GENERATOR),
                    "--output",
                    str(output),
                    "--max-statements",
                    "13",
                    "--properties",
                    "3",
                    "--statements-per-item",
                    "5",
                ],
                check=True,
            )
            manifest = json.loads(
                (output / "manifest.json").read_text(encoding="utf-8")
            )
            self.assertEqual(
                {"items": 3, "properties": 3, "statements": 13}, manifest["counts"]
            )


if __name__ == "__main__":
    unittest.main()
