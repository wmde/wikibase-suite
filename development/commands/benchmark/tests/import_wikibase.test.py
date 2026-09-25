#!/usr/bin/env python3
"""Regression tests for Action API corpus rewriting."""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
IMPORTER_PATH = ROOT / "development/commands/benchmark/scripts/import_wikibase.py"
SPEC = importlib.util.spec_from_file_location("benchmark_importer", IMPORTER_PATH)
assert SPEC and SPEC.loader
IMPORTER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(IMPORTER)


class ImportWikibaseTest(unittest.TestCase):
    def test_rewrites_properties_and_item_values_to_local_ids(self) -> None:
        source = {
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
                                "id": "Q2",
                                "entity-type": "item",
                                "numeric-id": 2,
                            },
                        },
                    },
                }
            ]
        }
        claims = IMPORTER.rewrite_claims({"claims": source}, {"P1": "P9", "Q2": "Q7"})
        snak = claims["P9"][0]["mainsnak"]
        self.assertEqual("P9", snak["property"])
        self.assertEqual("Q7", snak["datavalue"]["value"]["id"])
        self.assertEqual(7, snak["datavalue"]["value"]["numeric-id"])

    def test_limited_subset_removes_claims_to_omitted_items(self) -> None:
        entities = [
            {
                "id": "Q1",
                "type": "item",
                "claims": {
                    "P1": [
                        {
                            "mainsnak": {
                                "snaktype": "value",
                                "property": "P1",
                                "datatype": "wikibase-item",
                                "datavalue": {
                                    "type": "wikibase-entityid",
                                    "value": {"id": "Q2", "entity-type": "item"},
                                },
                            }
                        }
                    ]
                },
            },
            {"id": "Q2", "type": "item", "claims": {}},
        ]
        subset = IMPORTER.closed_smoke_subset(entities, 1)
        self.assertEqual({}, subset[0]["claims"])

    def test_terms_can_prefix_labels_for_an_existing_target(self) -> None:
        result = IMPORTER.terms(
            {
                "id": "Q42",
                "labels": {"en": {"language": "en", "value": "Example"}},
            },
            "Benchmark: ",
        )
        self.assertEqual("Benchmark: Example (Q42)", result["labels"]["en"]["value"])

    def test_terms_limit_wikidata_values_to_wikibase_field_sizes(self) -> None:
        result = IMPORTER.terms(
            {
                "labels": {"en": {"language": "en", "value": "l" * 300}},
                "descriptions": {"en": {"language": "en", "value": "d" * 500}},
            }
        )
        self.assertEqual(250, len(result["labels"]["en"]["value"]))
        self.assertEqual(400, len(result["descriptions"]["en"]["value"]))

    def test_terms_omit_languages_unsupported_by_the_target_wiki(self) -> None:
        result = IMPORTER.terms(
            {
                "labels": {
                    "ak": {"language": "ak", "value": "Akan"},
                    "en": {"language": "en", "value": "English"},
                }
            },
            supported_languages={"en"},
        )
        self.assertEqual({"en"}, set(result["labels"]))

    def test_rewrite_snak_limits_long_string_values(self) -> None:
        snak = {
            "snaktype": "value",
            "property": "P1",
            "datatype": "external-id",
            "datavalue": {"type": "string", "value": "x" * 500},
        }
        result = IMPORTER.rewrite_snak(snak, {"P1": "P9"})
        self.assertEqual(400, len(result["datavalue"]["value"]))


if __name__ == "__main__":
    unittest.main()
