#!/usr/bin/env python3
"""Materialize a closed Wikibase JSON source from selected Wikidata item IDs.

The selection is intentionally separate from materialization. For example, a
Truthy-Parquet query may create a fixed scholarly QID list and estimated source
statement total; this tool then obtains the complete native Wikibase JSON for
those selected items from a dated local dump. Directly referenced Q/P entities
are retained as minimal local support entities so the resulting import has no
unresolved local entity values without recursively pulling all of Wikidata into
the corpus.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import shutil
import sqlite3
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterator


ENTITY_ID = re.compile(r"([QP])([1-9][0-9]*)\Z")
METADATA = {"pageid", "ns", "title", "lastrevid", "modified"}
ENTITY_FIELDS = {"id", "type", "labels", "descriptions", "aliases", "claims", "sitelinks", "datatype"}


def numeric_id(identifier: str) -> int:
    match = ENTITY_ID.fullmatch(identifier)
    if not match or int(match.group(2)) > 2147483647:
        raise ValueError(f"Unsupported Q/P identifier: {identifier!r}")
    return int(match.group(2))


def read_qids(path: Path) -> list[str]:
    """Read one QID per line, preserving the fixed selection order."""
    selected: list[str] = []
    seen: set[str] = set()
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        identifier = line.strip()
        if not identifier:
            continue
        if not identifier.startswith("Q"):
            raise ValueError(f"{path}:{number}: target selections must be QIDs")
        numeric_id(identifier)
        if identifier in seen:
            raise ValueError(f"{path}:{number}: duplicate selected QID {identifier}")
        seen.add(identifier)
        selected.append(identifier)
    if not selected:
        raise ValueError("The QID selection is empty")
    return selected


def stream_dump(path: Path) -> Iterator[dict[str, Any]]:
    """Read the line-oriented array format of an official Wikidata JSON dump."""
    opener = gzip.open if path.suffix == ".gz" else open
    opened = closed = comma = seen = False
    with opener(path, "rt", encoding="utf-8") as stream:
        for number, line in enumerate(stream, 1):
            line = line.strip()
            if not line:
                continue
            if not opened:
                if line != "[":
                    raise ValueError(f"{path}:{number}: expected JSON array start")
                opened = True
                continue
            if closed:
                raise ValueError(f"{path}:{number}: content after JSON array")
            if line == "]":
                if comma:
                    raise ValueError(f"{path}:{number}: trailing comma")
                closed = True
                continue
            if seen and not comma:
                raise ValueError(f"{path}:{number}: missing comma between entities")
            comma = line.endswith(",")
            try:
                value = json.loads(line[:-1] if comma else line)
            except json.JSONDecodeError as error:
                raise ValueError(f"{path}:{number}: invalid JSON: {error}") from error
            if not isinstance(value, dict):
                raise ValueError(f"{path}:{number}: expected entity object")
            seen = True
            yield value
    if not opened or not closed:
        raise ValueError(f"{path}: incomplete JSON array")


def direct_references(entity: dict[str, Any]) -> set[str]:
    """Return Q/P IDs in claims, qualifier snaks and reference snaks."""
    result: set[str] = set()

    def visit(value: Any) -> None:
        if isinstance(value, list):
            for child in value:
                visit(child)
        elif isinstance(value, dict):
            property_id = value.get("property")
            if property_id is not None:
                if not isinstance(property_id, str) or not property_id.startswith("P"):
                    raise ValueError("Invalid snak property")
                numeric_id(property_id)
                result.add(property_id)
            if value.get("type") == "wikibase-entityid":
                target = value.get("value")
                if not isinstance(target, dict) or not isinstance(target.get("id"), str):
                    raise ValueError("Only explicit Q/P entity values are supported")
                identifier = target["id"]
                numeric_id(identifier)
                if target.get("entity-type") != ("item" if identifier.startswith("Q") else "property"):
                    raise ValueError("Entity value type does not match its identifier")
                result.add(identifier)
            for child in value.values():
                visit(child)

    claims = entity.get("claims", {})
    if not isinstance(claims, dict):
        raise ValueError("claims must be an object")
    for property_id, claims_for_property in claims.items():
        if not isinstance(property_id, str) or not property_id.startswith("P") or not isinstance(claims_for_property, list):
            raise ValueError("Invalid statement group")
        numeric_id(property_id)
        result.add(property_id)
        for claim in claims_for_property:
            if not isinstance(claim, dict):
                raise ValueError("Invalid statement")
            visit(claim)
    return result


def compact(entity: dict[str, Any], role: str) -> dict[str, Any]:
    """Keep all target data, but make reference support intentionally shallow."""
    identifier = entity.get("id")
    entity_type = entity.get("type")
    if not isinstance(identifier, str) or entity_type not in {"item", "property"}:
        raise ValueError("Invalid Wikidata entity")
    numeric_id(identifier)
    if entity_type != ("item" if identifier.startswith("Q") else "property"):
        raise ValueError("Entity ID and type disagree")
    if role == "target":
        unknown = entity.keys() - ENTITY_FIELDS - METADATA
        if unknown:
            raise ValueError(f"Target {identifier} has unsupported fields: {sorted(unknown)}")
        return {name: value for name, value in entity.items() if name in ENTITY_FIELDS}
    result = {name: entity[name] for name in ("id", "type", "labels", "descriptions", "aliases") if name in entity}
    if entity_type == "property":
        datatype = entity.get("datatype")
        if not isinstance(datatype, str):
            raise ValueError(f"Property support entity {identifier} has no datatype")
        result["datatype"] = datatype
    return result


def checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def materialize(dump: Path, qids: Path, output: Path) -> dict[str, Any]:
    if dump.suffix not in {".json", ".gz"}:
        raise ValueError("--dump must be a local .json or .json.gz Wikidata entity dump")
    selected = read_qids(qids)
    selected_set = set(selected)
    selected_order = {identifier: ordinal for ordinal, identifier in enumerate(selected)}
    output.mkdir(parents=True, exist_ok=False)
    with tempfile.TemporaryDirectory(prefix="wbs-materialize-", dir=output) as temporary:
        database_path = Path(temporary) / "selection.sqlite"
        with sqlite3.connect(database_path) as database:
            database.executescript("""
                PRAGMA journal_mode=OFF;
                PRAGMA synchronous=OFF;
                CREATE TABLE targets (id TEXT PRIMARY KEY, ordinal INTEGER NOT NULL, payload TEXT NOT NULL);
                CREATE TABLE needed (id TEXT PRIMARY KEY);
                CREATE TABLE support (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
            """)
            database.executemany("INSERT INTO needed VALUES (?)", ((identifier,) for identifier in selected))
            # First complete scan: retain selected items exactly and discover all
            # entities their claims directly require.
            for entity in stream_dump(dump):
                identifier = entity.get("id")
                if identifier not in selected_set:
                    continue
                target = compact(entity, "target")
                database.execute("INSERT INTO targets VALUES (?, ?, ?)", (
                    identifier, selected_order[identifier], json.dumps(target, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
                ))
                database.executemany("INSERT OR IGNORE INTO needed VALUES (?)", ((reference,) for reference in direct_references(target)))
            database.commit()
            target_count = database.execute("SELECT COUNT(*) FROM targets").fetchone()[0]
            if target_count != len(selected):
                present = {row[0] for row in database.execute("SELECT id FROM targets")}
                missing = [identifier for identifier in selected if identifier not in present]
                raise ValueError("Selected QIDs not found in dump (first 20): " + ", ".join(missing[:20]))
            # Second complete scan: materialize each direct reference as a shallow
            # local support entity. This avoids recursively importing its own graph.
            needed = {row[0] for row in database.execute("SELECT id FROM needed")}
            for entity in stream_dump(dump):
                identifier = entity.get("id")
                if not isinstance(identifier, str) or identifier in selected_set:
                    continue
                if identifier not in needed:
                    continue
                support = compact(entity, "support")
                database.execute("INSERT INTO support VALUES (?, ?)", (
                    identifier, json.dumps(support, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
                ))
            database.commit()
            missing = database.execute("SELECT needed.id FROM needed LEFT JOIN targets ON needed.id = targets.id LEFT JOIN support ON needed.id = support.id WHERE targets.id IS NULL AND support.id IS NULL LIMIT 20").fetchall()
            if missing:
                raise ValueError("Referenced Q/P IDs not found in dump (first 20): " + ", ".join(row[0] for row in missing))
            raw = output / "entities.ndjson"
            digest = hashlib.sha256()
            counts = {"target_items": 0, "support_items": 0, "support_properties": 0, "target_statements": 0}
            with raw.open("xb") as stream:
                # Properties must precede dependent items for an understandable raw artifact.
                rows = database.execute("SELECT id, payload FROM support WHERE id LIKE 'P%' ORDER BY CAST(SUBSTR(id, 2) AS INTEGER)")
                for identifier, payload in rows:
                    line = (payload + "\n").encode("utf-8")
                    stream.write(line); digest.update(line); counts["support_properties"] += 1
                rows = database.execute("SELECT id, payload FROM support WHERE id LIKE 'Q%' ORDER BY CAST(SUBSTR(id, 2) AS INTEGER)")
                for identifier, payload in rows:
                    line = (payload + "\n").encode("utf-8")
                    stream.write(line); digest.update(line); counts["support_items"] += 1
                for identifier, payload in database.execute("SELECT id, payload FROM targets ORDER BY ordinal"):
                    entity = json.loads(payload)
                    line = (payload + "\n").encode("utf-8")
                    stream.write(line); digest.update(line)
                    counts["target_items"] += 1
                    counts["target_statements"] += sum(len(group) for group in entity.get("claims", {}).values())
    manifest = {
        "format": "wbs-wikidata-materialization/v1",
        "created_at": datetime.now(UTC).isoformat(),
        "dump": {"path": str(dump.resolve()), "sha256": checksum(dump)},
        "selection": {"path": str(qids.resolve()), "sha256": checksum(qids), "target_order": "selection-file"},
        "support_policy": "direct-QP-references-as-shallow-entities; target-item-claims-preserved",
        "entities_file": "entities.ndjson",
        "entities_sha256": digest.hexdigest(),
        "counts": counts,
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dump", required=True, type=Path, help="Dated local Wikidata entities .json or .json.gz dump.")
    parser.add_argument("--qids", required=True, type=Path, help="Frozen selected scholarly QIDs, one per line.")
    parser.add_argument("--output", required=True, type=Path, help="New raw-materialization directory.")
    arguments = parser.parse_args()
    manifest = materialize(arguments.dump, arguments.qids, arguments.output)
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
