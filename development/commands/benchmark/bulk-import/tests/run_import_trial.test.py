#!/usr/bin/env python3
"""Regression tests for bulk-import trial evidence creation; Docker is not required."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[5]
SCRIPT = ROOT / "development/commands/benchmark/bulk-import/run_import_trial.py"
SPEC = importlib.util.spec_from_file_location("bulk_import_trial", SCRIPT)
assert SPEC and SPEC.loader
PILOT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PILOT)


class BulkImportTrialTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.bundle = self.root / "bundle"
        self.bundle.mkdir()
        entities = self.bundle / "entities.ndjson"
        entities.write_text('{"id":"Q1","type":"item"}\n', encoding="utf-8")
        (self.bundle / "manifest.json").write_text(json.dumps({
            "format": "wbs-bulk-import/v1", "sha256": hashlib.sha256(entities.read_bytes()).hexdigest()
        }), encoding="utf-8")

    def test_runs_loader_and_preserves_events(self) -> None:
        state = self.root / "state"
        output = self.root / "results"
        original_argv = sys.argv
        sys.argv = [str(SCRIPT), "--bundle", str(self.bundle), "--state-dir", str(state),
                    "--output", str(output), "--user", "Importer", "--skip-snapshots"]

        def run(command, check=False, **_kwargs):
            if check:
                state.mkdir(exist_ok=True)
                (state / "checkpoint.json.20260919T120000-abcdef01.events.ndjson").write_text('{"phase":"revisions-loaded"}\n')
            return subprocess.CompletedProcess(command, 0)

        try:
            with patch.object(PILOT, "host_evidence", return_value={"host": "test"}), patch.object(PILOT.subprocess, "run", side_effect=run):
                self.assertEqual(0, PILOT.main())
        finally:
            sys.argv = original_argv
        run = json.loads((output / "run.json").read_text())
        self.assertEqual("completed", run["status"])
        self.assertEqual(["checkpoint.json.20260919T120000-abcdef01.events.ndjson"], [event["file"] for event in run["loader_events"]])
        self.assertTrue((output / run["loader_events"][0]["file"]).is_file())

    def test_refuses_bundle_with_bad_checksum_before_invoking_docker(self) -> None:
        (self.bundle / "entities.ndjson").write_text("changed\n")
        original_argv = sys.argv
        sys.argv = [str(SCRIPT), "--bundle", str(self.bundle), "--state-dir", str(self.root / "state"),
                    "--output", str(self.root / "results"), "--user", "Importer", "--skip-snapshots"]
        try:
            with patch.object(PILOT.subprocess, "run") as run:
                with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                    PILOT.main()
                run.assert_not_called()
        finally:
            sys.argv = original_argv


if __name__ == "__main__":
    unittest.main()
