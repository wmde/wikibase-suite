#!/usr/bin/env python3
"""Regression test for the streaming Wikidata subset extractor."""

from __future__ import annotations

import gzip
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
EXTRACTOR = ROOT / "development/benchmarking/scripts/extract_wikidata_subset.py"


def item(identifier: str, target: str | None = None) -> dict[str, object]:
    claims: dict[str, list[dict[str, object]]] = {}
    if target:
        claims = {
            "P1": [
                {
                    "type": "statement",
                    "rank": "normal",
                    "mainsnak": {
                        "snaktype": "value",
                        "property": "P1",
                        "datatype": "wikibase-item",
                        "datavalue": {
                            "type": "wikibase-entityid",
                            "value": {
                                "id": target,
                                "entity-type": "item",
                                "numeric-id": 1,
                            },
                        },
                    },
                }
            ]
        }
    return {
        "id": identifier,
        "type": "item",
        "labels": {"en": {"language": "en", "value": identifier}},
        "descriptions": {},
        "aliases": {},
        "claims": claims,
    }


class ExtractWikidataSubsetTest(unittest.TestCase):
    def test_extracts_a_connected_subset_from_a_gzip_dump(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            dump = root / "sample.json.gz"
            with gzip.open(dump, "wt", encoding="utf-8") as stream:
                json.dump(
                    [item("Q1", "Q2"), item("Q2", "Q3"), item("Q3", "Q1"), item("Q4")],
                    stream,
                )
            output = root / "corpus"
            subprocess.run(
                [
                    sys.executable,
                    str(EXTRACTOR),
                    "--dump",
                    str(dump),
                    "--output",
                    str(output),
                    "--max-statements",
                    "3",
                    "--max-items",
                    "3",
                    "--scan-items",
                    "4",
                    "--seed-entity",
                    "Q1",
                ],
                check=True,
            )
            manifest = json.loads(
                (output / "manifest.json").read_text(encoding="utf-8")
            )
            self.assertEqual(
                {"items": 3, "properties": 1, "statements": 3}, manifest["counts"]
            )
            self.assertEqual("Q1", manifest["selection"]["root_item"])
            self.assertEqual("P1", manifest["properties"][0]["source_id"])
            imported_ids = {
                json.loads(line)["id"]
                for line in (output / "entities.jsonl")
                .read_text(encoding="utf-8")
                .splitlines()
            }
            self.assertEqual({"Q1", "Q2", "Q3"}, imported_ids)

    def test_caps_retained_statements_not_source_items(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            dump = root / "sample.json.gz"
            with gzip.open(dump, "wt", encoding="utf-8") as stream:
                json.dump(
                    [item("Q1", "Q2"), item("Q2", "Q3"), item("Q3", "Q1")],
                    stream,
                )
            output = root / "corpus"
            subprocess.run(
                [
                    sys.executable,
                    str(EXTRACTOR),
                    "--dump",
                    str(dump),
                    "--output",
                    str(output),
                    "--max-statements",
                    "1",
                    "--max-items",
                    "3",
                    "--scan-items",
                    "3",
                    "--seed-entity",
                    "Q1",
                ],
                check=True,
            )
            manifest = json.loads(
                (output / "manifest.json").read_text(encoding="utf-8")
            )
            self.assertEqual(1, manifest["counts"]["statements"])
            self.assertEqual(2, manifest["counts"]["items"])


if __name__ == "__main__":
    unittest.main()
