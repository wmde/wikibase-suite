#!/usr/bin/env python3
"""Prepare and load a reproducible Wikibase bootstrap import (standard library only)."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import re
import sqlite3
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, Iterator

FORMAT = "wbs-bulk-import/v1"
ENTITY_ID = re.compile(r"([QP])([1-9][0-9]*)\Z")
FIELDS = {"id", "type", "labels", "descriptions", "aliases", "claims", "sitelinks", "datatype"}
METADATA = {"pageid", "ns", "title", "lastrevid", "modified"}


def numeric_id(value: str) -> int:
    match = ENTITY_ID.fullmatch(value)
    if not match or int(match[2]) > 2147483647:
        raise ValueError(f"Unsupported entity identifier: {value!r}")
    return int(match[2])


def read_entities(path: Path) -> Iterator[tuple[int, dict[str, Any]]]:
    """Read NDJSON or the one-entity-per-line format used by Wikidata JSON dumps."""
    opener = gzip.open if path.suffix == ".gz" else open
    array = closed = seen_entity = comma = False
    first = True
    with opener(path, "rt", encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, 1):
            line = line.strip()
            if not line:
                continue
            try:
                if first and line == "[":
                    array, first = True, False
                    continue
                first = False
                if closed:
                    raise ValueError("Data after the end of the JSON array")
                if array and line == "]":
                    if comma:
                        raise ValueError("Trailing comma in JSON array")
                    closed = True
                    continue
                if array and seen_entity and not comma:
                    raise ValueError("Missing comma between array entries")
                comma = array and line.endswith(",")
                entity = json.loads(line[:-1] if comma else line)
                if not isinstance(entity, dict):
                    raise ValueError("Expected one entity object per line")
                seen_entity = True
                yield line_number, entity
            except (ValueError, TypeError) as error:
                raise ValueError(f"{path}:{line_number}: {error}") from error
    if array and not closed:
        raise ValueError(f"{path}: incomplete JSON array")


def references(entity: dict[str, Any]) -> set[str]:
    """Require local Q/P links and all snak properties; external URI values stay external."""
    result: set[str] = set()

    def visit(value: Any) -> None:
        if isinstance(value, list):
            for child in value:
                visit(child)
        elif isinstance(value, dict):
            if "property" in value:
                prop = value["property"]
                if not isinstance(prop, str) or not prop.startswith("P"):
                    raise ValueError("Invalid snak property")
                numeric_id(prop)
                result.add(prop)
            if value.get("type") == "wikibase-entityid":
                target = value.get("value", {})
                identifier = target.get("id")
                kind = target.get("entity-type")
                if identifier is None and kind in ("item", "property"):
                    identifier = ("Q" if kind == "item" else "P") + str(target.get("numeric-id"))
                if not isinstance(identifier, str):
                    raise ValueError("Only Q/P entity-valued snaks are supported")
                number = numeric_id(identifier)
                if kind != ("item" if identifier.startswith("Q") else "property"):
                    raise ValueError("Entity value type does not match its identifier")
                if "numeric-id" in target and target["numeric-id"] != number:
                    raise ValueError("Inconsistent entity value identifiers")
                result.add(identifier)
            for child in value.values():
                visit(child)

    claims = entity.get("claims", {})
    if not isinstance(claims, dict):
        raise ValueError("claims must be an object")
    for prop, statements in claims.items():
        numeric_id(prop)
        if not prop.startswith("P") or not isinstance(statements, list):
            raise ValueError("Invalid statement group")
        result.add(prop)
        for statement in statements:
            if statement.get("mainsnak", {}).get("property") != prop:
                raise ValueError("Statement group and mainsnak property differ")
            visit(statement)
    return result


def prepare(inputs: list[Path], output: Path, omit_sitelinks: bool = False) -> dict[str, Any]:
    started = time.monotonic()
    output.mkdir(parents=True, exist_ok=False)
    counts = {"item": 0, "property": 0, "statements": 0, "omitted_sitelinks": 0}
    maxima = {"item": 0, "property": 0}
    # SQLite keeps duplicate detection, ordering and link closure independent of RAM size.
    # No complete corpus or QID mapping is held in Python memory.
    with tempfile.TemporaryDirectory(prefix="prepare-", dir=output) as temporary:
        with sqlite3.connect(str(Path(temporary) / "entities.sqlite")) as db:
            db.executescript("""
                PRAGMA journal_mode=OFF;
                PRAGMA synchronous=OFF;
                PRAGMA cache_size=-32768;
                CREATE TABLE entities(id TEXT PRIMARY KEY, kind TEXT, number INTEGER, payload TEXT);
                CREATE TABLE refs(id TEXT PRIMARY KEY);
            """)
            for path in inputs:
                for line, source in read_entities(path):
                    try:
                        unknown = source.keys() - FIELDS - METADATA
                        if unknown:
                            raise ValueError(f"Unsupported fields: {sorted(unknown)}")
                        entity = {key: value for key, value in source.items() if key in FIELDS}
                        identifier = entity.get("id", "")
                        number = numeric_id(identifier)
                        kind = "item" if identifier.startswith("Q") else "property"
                        if entity.get("type") != kind:
                            raise ValueError("Entity type and identifier differ")
                        if kind == "property" and not isinstance(entity.get("datatype"), str):
                            raise ValueError("Properties require a datatype")
                        if kind == "item" and "datatype" in entity:
                            raise ValueError("Items cannot have a property datatype")
                        if entity.get("sitelinks"):
                            if not omit_sitelinks:
                                raise ValueError("Sitelinks need target site configuration; use --omit-sitelinks explicitly")
                            counts["omitted_sitelinks"] += len(entity.pop("sitelinks"))
                        links = references(entity)
                        payload = json.dumps(entity, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
                        db.execute("INSERT INTO entities VALUES (?, ?, ?, ?)", (identifier, kind, number, payload))
                        db.executemany("INSERT OR IGNORE INTO refs VALUES (?)", ((link,) for link in links))
                        counts[kind] += 1
                        counts["statements"] += sum(len(group) for group in entity.get("claims", {}).values())
                        maxima[kind] = max(maxima[kind], number)
                    except (ValueError, TypeError, AttributeError, sqlite3.IntegrityError) as error:
                        raise ValueError(f"{path}:{line} ({source.get('id', '?')}): {error}") from error
                db.commit()
            if not counts["item"] and not counts["property"]:
                raise ValueError("The import contains no entities")
            missing = db.execute("SELECT refs.id FROM refs LEFT JOIN entities USING(id) WHERE entities.id IS NULL LIMIT 20").fetchall()
            if missing:
                raise ValueError("Missing referenced entities (first 20): " + ", ".join(row[0] for row in missing))
            db.execute("CREATE INDEX entity_order ON entities(kind DESC, number)")
            digest = hashlib.sha256()
            with (output / "entities.ndjson").open("xb") as stream:
                for (payload,) in db.execute("SELECT payload FROM entities ORDER BY kind DESC, number"):
                    encoded = (payload + "\n").encode("utf-8")
                    stream.write(encoded)
                    digest.update(encoded)
    manifest = {
        "format": FORMAT,
        "entities_file": "entities.ndjson",
        "sha256": digest.hexdigest(),
        "counts": counts,
        "max_ids": maxima,
        "id_policy": "preserve-in-empty-wiki",
        "references": "local-QP-closed; external-URIs-preserved",
        "inputs": [str(path.resolve()) for path in inputs],
        "prepare_seconds": round(time.monotonic() - started, 6),
    }
    # Manifest is the completion marker: failed preparation never publishes one.
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def load(args: argparse.Namespace) -> None:
    bundle = args.bundle.resolve()
    state = args.state_dir.resolve()
    if not (bundle / "manifest.json").is_file():
        raise ValueError("The bundle has no completed manifest")
    state.mkdir(parents=True, exist_ok=True)
    # The controller may live inside the WBS Tools image (/app), which the host
    # Docker daemon cannot bind-mount. Publish the exact packaged PHP asset into
    # the shared state directory and mount that immutable copy into Wikibase.
    script = Path(__file__).with_name("ImportEntities.php").read_bytes()
    runtime = state / "runtime" / hashlib.sha256(script).hexdigest()
    runtime.mkdir(parents=True, exist_ok=True)
    asset = runtime / "ImportEntities.php"
    if asset.exists():
        if asset.read_bytes() != script:
            raise ValueError(f"Importer runtime checksum mismatch: {asset}")
    else:
        with asset.open("xb") as stream:
            stream.write(script)
    command = ["docker", "compose"]
    if os.environ.get("ENV_FILE_PATH"):
        command += ["--env-file", os.environ["ENV_FILE_PATH"]]
    for compose_file in args.compose_file:
        command += ["-f", str(compose_file.resolve())]
    if args.project_name:
        command += ["--project-name", args.project_name]
    command += [
        "run", "--rm", "-T", "--no-deps",
        "--volume", f"{runtime}:/opt/wbs-bulk-import:ro",
        "--volume", f"{bundle}:/import:ro",
        "--volume", f"{state}:/import-state",
        args.service, "maintenance", "/opt/wbs-bulk-import/ImportEntities.php",
        "--bundle", "/import", "--state", "/import-state/checkpoint.json",
        "--user", args.user,
        "--checkpoint-every", str(args.checkpoint_every),
        "--commit-every", str(args.commit_every),
        "--save-mode", args.save_mode,
    ]
    if args.validate_only:
        command.append("--validate-only")
    if args.bootstrap:
        command.append("--bootstrap")
    if args.limit:
        command += ["--limit", str(args.limit)]
    subprocess.run(command, check=True)


def positive(value: str) -> int:
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("Must be positive")
    return number


def main() -> None:
    parser = argparse.ArgumentParser(prog=os.environ.get("WBS_IMPORT_PROG"), description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    prep = commands.add_parser("prepare", help="Validate and materialize a prepared JSON bundle")
    prep.add_argument("--input", type=Path, action="append", required=True)
    prep.add_argument("--output", type=Path, required=True)
    prep.add_argument("--omit-sitelinks", action="store_true")
    importer = commands.add_parser("load", help="Run the PHP importer in an existing Suite Compose installation")
    importer.add_argument("--bundle", type=Path, required=True)
    importer.add_argument("--state-dir", type=Path, required=True)
    importer.add_argument("--user", required=True, help="Existing local account to attribute revisions to")
    importer.add_argument("--compose-file", type=Path, action="append", default=[])
    importer.add_argument("--project-name")
    importer.add_argument("--service", default="wikibase")
    importer.add_argument("--checkpoint-every", type=positive, default=100)
    importer.add_argument("--commit-every", type=positive, default=1,
                          help="Commit and run deferred updates every N entities")
    importer.add_argument("--save-mode", choices=("edit-entity", "entity-store"), default="edit-entity",
                          help="entity-store is only for a fresh, locked bootstrap wiki")
    importer.add_argument("--bootstrap", action="store_true",
                          help="suppress RecentChanges during an isolated initial load; rebuild indexes afterward")
    importer.add_argument("--limit", type=positive)
    importer.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    try:
        if args.command == "prepare":
            print(json.dumps(prepare(args.input, args.output, args.omit_sitelinks), indent=2))
        else:
            load(args)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
