#!/usr/bin/env python3
"""Prepare a scholarly benchmark bundle from a pinned local-source recipe."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

BENCHMARK_ROOT = Path(__file__).resolve().parents[1]
ROOT = BENCHMARK_ROOT.parents[2]


def import_command() -> list[str]:
    """Use the ordinary WBS import command supplied by the development CLI."""
    configured = os.environ.get("WBS_IMPORT_COMMAND")
    if configured:
        command = json.loads(configured)
        if not isinstance(command, list) or not command or not all(isinstance(arg, str) for arg in command):
            raise ValueError("WBS_IMPORT_COMMAND must be a JSON array of command arguments")
        return command
    # Direct Python execution remains useful for tests and implementation work.
    return [sys.executable, str(ROOT / "development/images/wbs-tools/commands/import/bulk_import.py")]


def prepare_corpus(recipe_path: Path, output: Path) -> Path:
    recipe_path = recipe_path.resolve()
    output = output.resolve()
    recipe_bytes = recipe_path.read_bytes()
    recipe = json.loads(recipe_bytes)
    if recipe.get("format") != "wbs-scholarly-corpus-recipe/v1":
        raise ValueError("Expected a wbs-scholarly-corpus-recipe/v1 recipe")
    for key in ("parquet", "snapshot_revision", "parquet_sha256", "dump", "seed"):
        if not isinstance(recipe.get(key), str) or not recipe[key].strip():
            raise ValueError(f"Recipe requires a non-empty {key}")
    limit = recipe.get("limit")
    if type(limit) is not int or limit < 1:
        raise ValueError("Recipe limit must be a positive article count")
    parquet = (recipe_path.parent / recipe["parquet"]).resolve()
    dump = (recipe_path.parent / recipe["dump"]).resolve()
    if not parquet.is_file() or not dump.is_file():
        raise ValueError("Recipe parquet and dump must name existing local files")
    digest = hashlib.sha256()
    with parquet.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != recipe["parquet_sha256"].lower():
        raise ValueError("Parquet checksum does not match the pinned recipe")
    # Bind the existing source directory rather than copying the large input.
    source_dir = parquet.parent
    if output.exists():
        raise ValueError(f"Refusing to replace corpus directory {output}")
    output.mkdir(parents=True)
    (output / "recipe.json").write_bytes(recipe_bytes)
    compose = BENCHMARK_ROOT / "compose/docker-compose.datasets.yml"
    subprocess.run([
        "docker", "compose", "-f", str(compose), "run", "--rm", "--build", "-T",
        "--volume", f"{source_dir}:/source:ro", "truthy-selector",
        "--parquet", f"/source/{parquet.name}",
        "--snapshot-revision", recipe["snapshot_revision"],
        "--parquet-sha256", recipe["parquet_sha256"],
        "--limit", str(limit), "--seed", recipe["seed"], "--output", "/data/selection",
    ], check=True, env={**os.environ, "WBS_BENCHMARK_DATA_DIR": str(output)})
    subprocess.run([
        sys.executable, str(BENCHMARK_ROOT / "scripts/materialize_wikidata_selection.py"),
        "--dump", str(dump), "--qids", str(output / "selection/qids.txt"),
        "--output", str(output / "raw"),
    ], check=True)
    bundle = output / "bundle"
    subprocess.run([
        *import_command(), "prepare", "--input", str(output / "raw/entities.ndjson"),
        "--output", str(bundle), "--omit-sitelinks",
    ], check=True)
    (output / "corpus.json").write_text(json.dumps({
        "format": "wbs-benchmark-corpus/v1",
        "recipe_sha256": hashlib.sha256(recipe_bytes).hexdigest(),
        "source_recipe": str(recipe_path),
        "bundle": "bundle",
        "selection": "selection/manifest.json",
        "materialization": "raw/manifest.json",
    }, indent=2) + "\n", encoding="utf-8")
    return bundle


def main() -> None:
    parser = argparse.ArgumentParser(prog="wbs-dev benchmark corpus prepare", description=__doc__)
    parser.add_argument("--recipe", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path, help="New corpus directory; must not exist.")
    args = parser.parse_args()
    print(f"Prepared bundle: {prepare_corpus(args.recipe, args.output)}")


if __name__ == "__main__":
    main()
