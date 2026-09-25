#!/usr/bin/env python3
"""Run one prepared bulk-import trial and preserve its test evidence.

A completed bundle is the normal input. Alternatively a pinned corpus recipe
can prepare a bundle before measurement begins. Preparation and publication
have separate artifacts and timings.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[4]
BULK_IMPORTER = ROOT / "development/images/wbs-tools/commands/import/bulk_import.py"
SNAPSHOTTER = ROOT / "development/commands/benchmark/lib/capture_snapshot.py"
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from prepare_corpus import import_command, prepare_corpus


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def json_object(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Cannot read JSON object {path}: {error}") from error
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return value


def command_output(*arguments: str) -> str | None:
    """Capture optional diagnostic metadata without hiding a failed import."""
    completed = subprocess.run(
        arguments, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT
    )
    return completed.stdout.strip() if completed.returncode == 0 else None


def host_evidence() -> dict[str, Any]:
    return {
        "platform": platform.platform(),
        "machine": platform.machine(),
        "python": sys.version,
        "docker_version": command_output("docker", "version", "--format", "{{json .}}"),
        "git_revision": command_output("git", "-C", str(ROOT), "rev-parse", "HEAD"),
        "git_status": command_output("git", "-C", str(ROOT), "status", "--short"),
    }


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def snapshot(arguments: argparse.Namespace, checkpoint: str, output: Path) -> None:
    command = [
        sys.executable,
        str(SNAPSHOTTER),
        "--profile", arguments.profile,
        "--project", arguments.project_name,
        "--checkpoint", checkpoint,
        "--output", str(output),
        "--prometheus-url", arguments.prometheus_url,
    ]
    subprocess.run(command, check=True)


def importer_command(arguments: argparse.Namespace) -> list[str]:
    command = [
        *import_command(),
        "load",
        "--bundle", str(arguments.bundle),
        "--state-dir", str(arguments.state_dir),
        "--user", arguments.user,
        "--checkpoint-every", str(arguments.checkpoint_every),
        "--project-name", arguments.project_name,
        "--service", arguments.service,
        "--save-mode", arguments.save_mode,
        "--commit-every", str(arguments.commit_every),
    ]
    for compose_file in arguments.compose_file:
        command.extend(("--compose-file", str(compose_file)))
    if arguments.validate_only:
        command.append("--validate-only")
    if arguments.bootstrap:
        command.append("--bootstrap")
    if arguments.limit:
        command.extend(("--limit", str(arguments.limit)))
    return command


def event_artifacts(state_dir: Path, output: Path) -> list[dict[str, str]]:
    """Copy append-only loader events into the immutable trial directory."""
    artifacts: list[dict[str, str]] = []
    for event in sorted(state_dir.glob("checkpoint.json.*.events.ndjson")):
        destination = output / event.name
        shutil.copy2(event, destination)
        artifacts.append({"file": destination.name, "sha256": sha256(destination)})
    return artifacts


def positive(value: str) -> int:
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be positive")
    return number


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(prog="wbs-dev benchmark import", description=__doc__)
    source = result.add_mutually_exclusive_group(required=True)
    source.add_argument("--bundle", type=Path, help="Existing prepared import bundle.")
    source.add_argument("--recipe", type=Path, help="Prepare a scholarly corpus before measuring import.")
    result.add_argument("--corpus-dir", type=Path, help="New corpus directory, required with --recipe.")
    result.add_argument("--state-dir", required=True, type=Path)
    result.add_argument("--output", required=True, type=Path,
                        help="New, empty directory below development/commands/benchmark/results/.")
    result.add_argument("--user", required=True)
    result.add_argument("--compose-file", action="append", default=[], type=Path)
    result.add_argument("--project-name", default="wbs-deploy")
    result.add_argument("--service", default="wikibase")
    result.add_argument("--profile", default="wikibase-suite-8gb")
    result.add_argument("--checkpoint-every", default=100, type=positive)
    result.add_argument("--commit-every", default=1, type=positive)
    result.add_argument("--save-mode", choices=("edit-entity", "entity-store"), default="edit-entity")
    result.add_argument("--bootstrap", action="store_true")
    result.add_argument("--limit", type=positive, help="Deliberately stop after N entities.")
    result.add_argument("--validate-only", action="store_true")
    result.add_argument("--skip-snapshots", action="store_true",
                        help="Only for environments where Docker metrics cannot run.")
    result.add_argument("--prometheus-url", default=os.environ.get("WBS_BENCHMARK_PROMETHEUS_URL", "http://localhost:9090"))
    return result


def main() -> int:
    arguments = parser().parse_args()
    if bool(arguments.recipe) != bool(arguments.corpus_dir):
        raise ValueError("--recipe and --corpus-dir must be supplied together")
    arguments.state_dir = arguments.state_dir.resolve()
    arguments.output = arguments.output.resolve()
    arguments.compose_file = [path.resolve() for path in arguments.compose_file]
    if arguments.output.exists() and not arguments.output.is_dir():
        raise ValueError(f"Trial output is not a directory: {arguments.output}")
    if arguments.output.exists() and any(arguments.output.iterdir()):
        raise ValueError(f"Refusing to replace trial artifacts in {arguments.output}")
    if arguments.recipe:
        arguments.bundle = prepare_corpus(arguments.recipe, arguments.corpus_dir)
    arguments.bundle = arguments.bundle.resolve()
    manifest_path = arguments.bundle / "manifest.json"
    entities_path = arguments.bundle / "entities.ndjson"
    manifest = json_object(manifest_path)
    if manifest.get("format") != "wbs-bulk-import/v1" or not entities_path.is_file():
        raise ValueError("--bundle must be a completed wbs-bulk-import/v1 bundle")
    if sha256(entities_path) != manifest.get("sha256"):
        raise ValueError("Bundle checksum mismatch; prepare a new bundle before running a trial")
    arguments.output.mkdir(parents=True, exist_ok=True)
    arguments.state_dir.mkdir(parents=True, exist_ok=True)

    run = {
        "format": "wbs-bulk-import-trial/v1",
        "status": "started",
        "started_at": utc_now(),
        "bundle": {"path": str(arguments.bundle), "manifest": manifest},
        "loader": {
            "script_sha256": sha256(BULK_IMPORTER),
            "checkpoint_every": arguments.checkpoint_every,
            "commit_every": arguments.commit_every,
            "save_mode": arguments.save_mode,
            "bootstrap": arguments.bootstrap,
            "limit": arguments.limit,
            "validate_only": arguments.validate_only,
            "service": arguments.service,
            "compose_files": [str(path) for path in arguments.compose_file],
            "project_name": arguments.project_name,
        },
        "host": host_evidence(),
        "snapshots": [],
        "loader_events": [],
    }
    run_path = arguments.output / "run.json"
    write_json(run_path, run)
    try:
        if not arguments.skip_snapshots:
            empty = arguments.output / "empty-settled.json"
            snapshot(arguments, "empty-settled", empty)
            run["snapshots"].append(empty.name)
            write_json(run_path, run)
        subprocess.run(importer_command(arguments), check=True)
        run["loader_events"] = event_artifacts(arguments.state_dir, arguments.output)
        if not arguments.skip_snapshots and not arguments.validate_only:
            loaded = arguments.output / "revisions-loaded.json"
            snapshot(arguments, "revisions-loaded", loaded)
            run["snapshots"].append(loaded.name)
        run["status"] = "completed"
        run["completed_at"] = utc_now()
        write_json(run_path, run)
    except Exception as error:
        run["loader_events"] = event_artifacts(arguments.state_dir, arguments.output)
        run["status"] = "failed"
        run["failed_at"] = utc_now()
        run["error"] = str(error)
        write_json(run_path, run)
        raise
    print(f"Wrote durable import-trial evidence to {arguments.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
