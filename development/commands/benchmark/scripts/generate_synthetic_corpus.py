#!/usr/bin/env python3
"""Generate a deterministic, portable Wikibase benchmark control corpus.

This is a control workload, not a claim about real Wikidata distributions. It
uses the same corpus format as the Wikidata extractor so the same importer and
checkpoint process can compare synthetic and source-derived data at an exact
statement budget.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def property_catalog(count: int) -> list[dict[str, str]]:
    return [
        {
            "source_id": f"P{index}",
            "datatype": "wikibase-item" if index % 2 == 0 else "string",
        }
        for index in range(1, count + 1)
    ]


def claim(
    property_id: str,
    datatype: str,
    target_item: str,
    ordinal: int,
    qualifier_every: int,
    reference_every: int,
) -> dict[str, Any]:
    if datatype == "wikibase-item":
        datavalue: dict[str, Any] = {
            "type": "wikibase-entityid",
            "value": {
                "id": target_item,
                "entity-type": "item",
                "numeric-id": int(target_item[1:]),
            },
        }
    else:
        datavalue = {"type": "string", "value": f"Synthetic value {ordinal}"}
    value: dict[str, Any] = {
        "type": "statement",
        "rank": "normal",
        "mainsnak": {
            "snaktype": "value",
            "property": property_id,
            "datatype": datatype,
            "datavalue": datavalue,
        },
    }
    if qualifier_every and ordinal % qualifier_every == 0:
        value["qualifiers"] = {
            "P1": [
                {
                    "snaktype": "value",
                    "property": "P1",
                    "datatype": "string",
                    "datavalue": {"type": "string", "value": "Synthetic qualifier"},
                }
            ]
        }
    if reference_every and ordinal % reference_every == 0:
        value["references"] = [
            {
                "snaks": {
                    "P1": [
                        {
                            "snaktype": "value",
                            "property": "P1",
                            "datatype": "string",
                            "datavalue": {
                                "type": "string",
                                "value": "Synthetic reference",
                            },
                        }
                    ]
                }
            }
        ]
    return value


def entity(identifier: int, claims: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    return {
        "id": f"Q{identifier}",
        "type": "item",
        "labels": {
            "en": {"language": "en", "value": f"Synthetic benchmark item {identifier}"}
        },
        "descriptions": {"en": {"language": "en", "value": "Synthetic benchmark item"}},
        "aliases": {},
        "claims": claims,
    }


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--max-statements", type=int, default=10_000)
    parser.add_argument("--properties", type=int, default=20)
    parser.add_argument("--statements-per-item", type=int, default=10)
    parser.add_argument("--qualifier-every", type=int, default=10)
    parser.add_argument("--reference-every", type=int, default=20)
    return parser.parse_args()


def main() -> int:
    args = arguments()
    if min(args.max_statements, args.properties, args.statements_per_item) < 1:
        raise ValueError(
            "--max-statements, --properties and --statements-per-item must be positive."
        )
    if args.output.exists() and any(args.output.iterdir()):
        raise ValueError(f"Output directory {args.output} is not empty.")
    args.output.mkdir(parents=True, exist_ok=True)
    properties = property_catalog(args.properties)
    datatype_by_property = {
        entry["source_id"]: entry["datatype"] for entry in properties
    }
    item_count = (
        args.max_statements + args.statements_per_item - 1
    ) // args.statements_per_item
    entities: list[dict[str, Any]] = []
    statement_ordinal = 0
    for item_number in range(1, item_count + 1):
        claims: dict[str, list[dict[str, Any]]] = {}
        for _ in range(args.statements_per_item):
            if statement_ordinal >= args.max_statements:
                break
            property_id = properties[statement_ordinal % len(properties)]["source_id"]
            target = f"Q{(item_number % item_count) + 1}"
            claims.setdefault(property_id, []).append(
                claim(
                    property_id,
                    datatype_by_property[property_id],
                    target,
                    statement_ordinal + 1,
                    args.qualifier_every,
                    args.reference_every,
                )
            )
            statement_ordinal += 1
        entities.append(entity(item_number, claims))

    entity_path = args.output / "entities.jsonl"
    digest = hashlib.sha256()
    with entity_path.open("w", encoding="utf-8") as stream:
        for value in entities:
            encoded = (
                json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n"
            )
            stream.write(encoded)
            digest.update(encoded.encode())
    manifest = {
        "format": "wbs-benchmark-corpus/v1",
        "created_at": datetime.now(UTC).isoformat(),
        "source": "synthetic deterministic control corpus",
        "selection": {
            "maximum_statements": args.max_statements,
            "statements_per_item": args.statements_per_item,
            "qualifier_every": args.qualifier_every,
            "reference_every": args.reference_every,
            "value_profile": "portable-v1",
        },
        "counts": {
            "items": item_count,
            "properties": len(properties),
            "statements": statement_ordinal,
        },
        "files": {"entities.jsonl": {"sha256": digest.hexdigest()}},
        "properties": properties,
    }
    (args.output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Wrote {statement_ordinal:,} synthetic statements to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
