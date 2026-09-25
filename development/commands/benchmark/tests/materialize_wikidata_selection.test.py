#!/usr/bin/env python3
"""Tests for turning frozen QID selections into a closed raw JSON input."""

from __future__ import annotations

import gzip
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
SCRIPT = ROOT / "development/commands/benchmark/scripts/materialize_wikidata_selection.py"
SPEC = importlib.util.spec_from_file_location("materialize", SCRIPT)
assert SPEC and SPEC.loader
MATERIALIZE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MATERIALIZE)
PREPARE_SPEC = importlib.util.spec_from_file_location(
    "bulk_prepare", ROOT / "development/images/wbs-tools/commands/import/bulk_import.py"
)
assert PREPARE_SPEC and PREPARE_SPEC.loader
BULK_PREPARE = importlib.util.module_from_spec(PREPARE_SPEC)
PREPARE_SPEC.loader.exec_module(BULK_PREPARE)


def item(identifier: str, claims: dict[str, object] | None = None) -> dict[str, object]:
    return {"id": identifier, "type": "item", "labels": {"en": {"language": "en", "value": identifier}},
            "claims": claims or {}}


def entity_value(identifier: str) -> dict[str, object]:
    return {"type": "statement", "rank": "normal", "mainsnak": {"snaktype": "value", "property": "P31",
            "datatype": "wikibase-item", "datavalue": {"type": "wikibase-entityid", "value": {
                "id": identifier, "numeric-id": int(identifier[1:]), "entity-type": "item"}}}}


class MaterializeWikidataSelectionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def write_dump(self, values: list[dict[str, object]]) -> Path:
        path = self.root / "dump.json.gz"
        with gzip.open(path, "wt", encoding="utf-8") as stream:
            stream.write("[\n")
            for index, value in enumerate(values):
                stream.write(json.dumps(value) + (",\n" if index + 1 < len(values) else "\n"))
            stream.write("]\n")
        return path

    def test_preserves_target_claims_and_makes_references_shallow(self) -> None:
        target = item("Q100", {"P31": [entity_value("Q2")]})
        support = item("Q2", {"P31": [entity_value("Q5")]})
        property_entity = {"id": "P31", "type": "property", "datatype": "wikibase-item", "labels": {"en": {"language": "en", "value": "instance of"}}, "claims": {}}
        dump = self.write_dump([support, property_entity, target])
        qids = self.root / "qids.txt"; qids.write_text("Q100\n")
        manifest = MATERIALIZE.materialize(dump, qids, self.root / "raw")
        rows = [json.loads(line) for line in (self.root / "raw/entities.ndjson").read_text().splitlines()]
        self.assertEqual(["P31", "Q2", "Q100"], [row["id"] for row in rows])
        self.assertNotIn("claims", rows[1])
        self.assertEqual({"P31": [entity_value("Q2")]}, rows[2]["claims"])
        self.assertEqual(1, manifest["counts"]["target_statements"])
        bundle = BULK_PREPARE.prepare([self.root / "raw/entities.ndjson"], self.root / "bundle")
        self.assertEqual({"item": 100, "property": 31}, bundle["max_ids"])

    def test_rejects_missing_selected_qid_without_completion_manifest(self) -> None:
        dump = self.write_dump([item("Q2")])
        qids = self.root / "qids.txt"; qids.write_text("Q100\n")
        with self.assertRaisesRegex(ValueError, "not found"):
            MATERIALIZE.materialize(dump, qids, self.root / "raw")
        self.assertFalse((self.root / "raw/manifest.json").exists())

    def test_rejects_reference_absent_from_dump(self) -> None:
        dump = self.write_dump([item("Q100", {"P31": [entity_value("Q2")]})])
        qids = self.root / "qids.txt"; qids.write_text("Q100\n")
        with self.assertRaisesRegex(ValueError, "Referenced Q/P IDs"):
            MATERIALIZE.materialize(dump, qids, self.root / "raw")


if __name__ == "__main__":
    unittest.main()
