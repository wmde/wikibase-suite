#!/usr/bin/env python3
"""Prepared-input contract tests; no MediaWiki or Docker needed."""

import gzip
import argparse
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "bulk_import.py"
SPEC = importlib.util.spec_from_file_location("bulk_import", SCRIPT)
BULK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BULK)


def item(identifier="Q2", target=None):
    entity = {"id": identifier, "type": "item", "labels": {"en": {"language": "en", "value": identifier}}}
    if target:
        entity["claims"] = {"P31": [{"type": "statement", "rank": "normal", "mainsnak": {
            "snaktype": "value", "property": "P31", "datatype": "wikibase-item",
            "datavalue": {"type": "wikibase-entityid", "value": {
                "entity-type": "item", "id": target, "numeric-id": int(target[1:])}}}}]}
    return entity


class PreparedImportTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.source = self.root / "source.ndjson"

    def prepare(self, entities, **kwargs):
        self.source.write_text("".join(json.dumps(entity) + "\n" for entity in entities))
        return BULK.prepare([self.source], self.root / "bundle", **kwargs)

    def test_deterministic_property_first_order_and_preserved_content(self):
        article = item("Q100", "Q2")
        article["lastrevid"] = 123
        manifest = self.prepare([article, item(), {"id": "P31", "type": "property", "datatype": "wikibase-item"}])
        rows = [json.loads(line) for line in (self.root / "bundle/entities.ndjson").read_text().splitlines()]
        self.assertEqual(["P31", "Q2", "Q100"], [row["id"] for row in rows])
        self.assertEqual(article["claims"], rows[-1]["claims"])
        self.assertNotIn("lastrevid", rows[-1])
        self.assertEqual({"item": 100, "property": 31}, manifest["max_ids"])
        self.assertEqual(1, manifest["counts"]["statements"])
        self.assertEqual(manifest["sha256"], BULK.prepare([self.source], self.root / "second")["sha256"])

    def test_rejects_duplicate_ids_without_publishing_manifest(self):
        with self.assertRaisesRegex(ValueError, "UNIQUE"):
            self.prepare([item(), item()])
        self.assertFalse((self.root / "bundle/manifest.json").exists())

    def test_rejects_missing_properties_and_referenced_items(self):
        with self.assertRaisesRegex(ValueError, "Missing referenced entities"):
            self.prepare([item("Q100", "Q2")])

    def test_rejects_inconsistent_entity_value(self):
        article = item("Q100", "Q2")
        article["claims"]["P31"][0]["mainsnak"]["datavalue"]["value"]["numeric-id"] = 3
        with self.assertRaisesRegex(ValueError, "Inconsistent"):
            self.prepare([article])

    def test_sitelink_removal_is_explicit_and_counted(self):
        entity = item()
        entity["sitelinks"] = {"enwiki": {"site": "enwiki", "title": "Test", "badges": []}}
        manifest = self.prepare([entity], omit_sitelinks=True)
        self.assertEqual(1, manifest["counts"]["omitted_sitelinks"])
        self.assertNotIn("sitelinks", json.loads((self.root / "bundle/entities.ndjson").read_text()))

    def test_rejects_unknown_content_instead_of_silently_dropping_it(self):
        entity = item()
        entity["future_data"] = [1, 2]
        with self.assertRaisesRegex(ValueError, "Unsupported fields"):
            self.prepare([entity])

    def test_reads_gzipped_line_oriented_dump(self):
        path = self.root / "dump.json.gz"
        with gzip.open(path, "wt") as stream:
            stream.write("[\n" + json.dumps(item()) + ",\n" + json.dumps(item("Q3")) + "\n]\n")
        manifest = BULK.prepare([path], self.root / "bundle")
        self.assertEqual(2, manifest["counts"]["item"])

    def test_truncated_dump_cannot_publish_a_partial_success(self):
        self.source.write_text("[\n" + json.dumps(item()) + ",\n")
        with self.assertRaisesRegex(ValueError, "incomplete JSON array"):
            BULK.prepare([self.source], self.root / "bundle")
        self.assertFalse((self.root / "bundle/manifest.json").exists())

    def test_missing_array_separator_is_rejected(self):
        self.source.write_text("[\n" + json.dumps(item()) + "\n" + json.dumps(item("Q3")) + "\n]\n")
        with self.assertRaisesRegex(ValueError, "Missing comma"):
            BULK.prepare([self.source], self.root / "bundle")

    def test_load_mounts_packaged_worker_from_shared_state(self):
        self.prepare([item()])
        state = self.root / "state with spaces"
        args = argparse.Namespace(
            bundle=self.root / "bundle", state_dir=state, compose_file=[],
            project_name="test", service="wikibase", user="Importer",
            checkpoint_every=100, commit_every=10, save_mode="entity-store",
            validate_only=True, bootstrap=True, limit=None,
        )
        with patch.object(BULK.subprocess, "run") as run:
            BULK.load(args)
        command = run.call_args.args[0]
        assets = list(state.glob("runtime/*/ImportEntities.php"))
        self.assertEqual(1, len(assets))
        self.assertEqual(SCRIPT.with_name("ImportEntities.php").read_bytes(), assets[0].read_bytes())
        self.assertIn(f"{assets[0].parent}:/opt/wbs-bulk-import:ro", command)
        self.assertNotIn(f"{SCRIPT.parent}:/opt/wbs-bulk-import:ro", command)
        self.assertIn("--validate-only", command)
        self.assertIn("--bootstrap", command)
        assets[0].write_text("corrupt")
        with patch.object(BULK.subprocess, "run") as run:
            with self.assertRaisesRegex(ValueError, "runtime checksum mismatch"):
                BULK.load(args)
            run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
