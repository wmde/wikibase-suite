#!/usr/bin/env python3
"""Corpus orchestration preserves stage boundaries and rejects changed sources."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/prepare_corpus.py"
SPEC = importlib.util.spec_from_file_location("prepare_corpus", SCRIPT)
CORPUS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CORPUS)


class CorpusPipelineTest(unittest.TestCase):
    def setUp(self):
        # The containerized launcher mounts the checkout, so its smoke fixture
        # must live under that mount at the same host path.
        fixture_parent = None
        if os.environ.get("WBS_CORPUS_SMOKE") == "1":
            fixture_parent = CORPUS.ROOT / ".wbs"
            fixture_parent.mkdir(exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=fixture_parent)
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.parquet = self.root / "statements.parquet"
        self.parquet.write_bytes(b"fixture")
        (self.root / "dump.json").write_text("[]")
        self.recipe = self.root / "recipe.json"
        self.recipe.write_text(json.dumps({
            "format": "wbs-scholarly-corpus-recipe/v1",
            "parquet": "statements.parquet", "dump": "dump.json",
            "snapshot_revision": "frozen", "parquet_sha256": hashlib.sha256(b"fixture").hexdigest(),
            "seed": "fixture", "limit": 1,
        }))

    def test_pipeline_uses_public_import_command_and_retains_recipe(self):
        output = self.root / "corpus"
        with patch.dict(CORPUS.os.environ, {"WBS_IMPORT_COMMAND": '["wbs", "import"]'}):
            with patch.object(CORPUS.subprocess, "run") as run:
                bundle = CORPUS.prepare_corpus(self.recipe, output)
        self.assertEqual(output / "bundle", bundle)
        commands = [call.args[0] for call in run.call_args_list]
        self.assertEqual(3, len(commands))
        self.assertIn("truthy-selector", commands[0])
        self.assertIn(str(output / "selection/qids.txt"), commands[1])
        self.assertEqual(["wbs", "import", "prepare"], commands[2][:3])
        self.assertEqual(self.recipe.read_bytes(), (output / "recipe.json").read_bytes())
        self.assertTrue((output / "corpus.json").exists())

    def test_checksum_failure_does_not_start_selection(self):
        self.parquet.write_bytes(b"changed")
        with patch.object(CORPUS.subprocess, "run") as run:
            with self.assertRaisesRegex(ValueError, "checksum"):
                CORPUS.prepare_corpus(self.recipe, self.root / "corpus")
            run.assert_not_called()

    def test_failed_stage_does_not_publish_completion_or_run_importer(self):
        output = self.root / "corpus"
        with patch.object(CORPUS.subprocess, "run", side_effect=subprocess.CalledProcessError(1, "docker")) as run:
            with self.assertRaises(subprocess.CalledProcessError):
                CORPUS.prepare_corpus(self.recipe, output)
            self.assertEqual(1, run.call_count)
        self.assertFalse((output / "corpus.json").exists())

    @unittest.skipUnless(os.environ.get("WBS_CORPUS_SMOKE") == "1", "opt-in Docker corpus smoke")
    def test_real_duckdb_materialization_and_wbs_bundle(self):
        subprocess.run([
            "docker", "build", "-f", str(CORPUS.BENCHMARK_ROOT / "Dockerfile.duckdb"),
            "-t", "wbs-benchmark-duckdb:1.4.0", str(CORPUS.BENCHMARK_ROOT),
        ], check=True)
        subprocess.run([
            "docker", "run", "--rm", "-i", "-v", f"{self.root}:/fixture",
            "wbs-benchmark-duckdb:1.4.0", "python", "-",
        ], input="""import duckdb
db = duckdb.connect()
db.execute(\"COPY (SELECT 100::BIGINT AS subject, 31::BIGINT AS property, 13442814::BIGINT AS object_id) TO '/fixture/statements.parquet' (FORMAT PARQUET)\")
""", text=True, check=True)
        entities = [
            {"id": "P31", "type": "property", "datatype": "wikibase-item"},
            {"id": "Q13442814", "type": "item"},
            {"id": "Q100", "type": "item", "claims": {"P31": [{
                "type": "statement", "rank": "normal", "mainsnak": {
                    "snaktype": "value", "property": "P31", "datatype": "wikibase-item",
                    "datavalue": {"type": "wikibase-entityid", "value": {
                        "entity-type": "item", "id": "Q13442814", "numeric-id": 13442814,
                    }},
                },
            }]}},
        ]
        (self.root / "dump.json").write_text("[\n" + ",\n".join(json.dumps(row) for row in entities) + "\n]\n")
        recipe = json.loads(self.recipe.read_text())
        recipe["parquet_sha256"] = hashlib.sha256(self.parquet.read_bytes()).hexdigest()
        self.recipe.write_text(json.dumps(recipe))
        development = CORPUS.ROOT / "development"
        output = self.root / "corpus"
        subprocess.run([
            str(development / "wbs-dev"),
            "benchmark", "corpus", "prepare", "--recipe", str(self.recipe), "--output", str(output),
        ], cwd=development, check=True)
        manifest = json.loads((output / "bundle/manifest.json").read_text())
        self.assertEqual(2, manifest["counts"]["item"])
        self.assertEqual(1, manifest["counts"]["property"])
        self.assertEqual(1, manifest["counts"]["statements"])
        self.assertEqual("Q100\n", (output / "selection/qids.txt").read_text())


if __name__ == "__main__":
    unittest.main()
