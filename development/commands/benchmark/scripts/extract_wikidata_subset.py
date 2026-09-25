#!/usr/bin/env python3
"""Build a reproducible, relationship-preserving Wikibase benchmark corpus.

The source may be a local Wikidata JSON dump or a HTTP(S) URL to a *dated*
compressed dump. Input is processed sequentially; the full decompressed dump is
never written to disk. The resulting corpus contains only selected items plus a
derived property catalog, so it is suitable for imports into a fresh Wikibase.
"""

from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
import io
import json
import shutil
import sqlite3
import sys
import tempfile
from collections import deque
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Generator, Iterable, TextIO
from urllib.parse import urlparse
from urllib.request import Request, urlopen

Entity = dict[str, Any]

# Wikidata values can embed absolute Wikidata entity URIs (for example, a time
# calendar model, quantity unit or coordinate globe). Those identifiers do not
# exist in an independent Wikibase, so the first portable corpus deliberately
# keeps only datatypes whose values can be copied or whose item IDs we rewrite.
# A later corpus profile can explicitly seed and map the required support items.
PORTABLE_DATATYPES = {
    "external-id",
    "monolingualtext",
    "string",
    "url",
    "wikibase-item",
}


@contextmanager
def open_dump(source: str) -> Generator[TextIO, None, None]:
    """Open a plain or gzip-compressed local/remote dump as UTF-8 text."""
    parsed = urlparse(source)
    if parsed.scheme in {"http", "https"}:
        request = Request(
            source,
            headers={
                "User-Agent": "WikibaseSuiteBenchmark/1.0 (https://github.com/wmde/wikibase-suite)"
            },
        )
        binary: io.BufferedIOBase = urlopen(request)  # noqa: S310 - explicit CLI input
        close_binary = True
    else:
        binary = open(source, "rb")
        close_binary = True

    try:
        if source.endswith(".gz"):
            with gzip.GzipFile(fileobj=binary) as compressed:
                with io.TextIOWrapper(compressed, encoding="utf-8") as text:
                    yield text
        else:
            with io.TextIOWrapper(binary, encoding="utf-8") as text:
                yield text
    finally:
        if close_binary:
            binary.close()


def stream_json_array(stream: TextIO) -> Generator[Entity, None, None]:
    """Yield values from Wikidata's JSON array incrementally.

    The entity dump uses an array wrapper and may end each entity with a comma.
    ``json.load`` would require roughly the whole decompressed dump in memory,
    so maintain only the unread tail between decoder calls.
    """
    decoder = json.JSONDecoder()
    buffer = ""
    position = 0
    started = False
    done = False

    while not done:
        chunk = stream.read(1024 * 1024)
        eof = not chunk
        buffer += chunk

        while True:
            while position < len(buffer) and buffer[position].isspace():
                position += 1
            if not started:
                if position == len(buffer):
                    break
                if buffer[position] != "[":
                    raise ValueError("Expected a JSON array at the start of the dump.")
                started = True
                position += 1
                continue
            while position < len(buffer) and (
                buffer[position].isspace() or buffer[position] == ","
            ):
                position += 1
            if position == len(buffer):
                break
            if buffer[position] == "]":
                done = True
                break
            try:
                value, position = decoder.raw_decode(buffer, position)
            except json.JSONDecodeError:
                if eof:
                    raise ValueError(
                        "The dump ended before its JSON array was complete."
                    ) from None
                break
            if not isinstance(value, dict):
                raise ValueError("Expected every Wikidata dump record to be an object.")
            yield value

        if done:
            return
        if position:
            buffer = buffer[position:]
            position = 0
        if eof:
            if buffer.strip():
                raise ValueError("The dump ended before its JSON array was complete.")
            return


def entity_id(value: Any) -> str | None:
    if not isinstance(value, dict):
        return None
    identifier = value.get("id")
    return identifier if isinstance(identifier, str) else None


def snaks_from_claim(claim: dict[str, Any]) -> Iterable[dict[str, Any]]:
    mainsnak = claim.get("mainsnak")
    if isinstance(mainsnak, dict):
        yield mainsnak
    for qualifier_values in claim.get("qualifiers", {}).values():
        if isinstance(qualifier_values, list):
            yield from (snak for snak in qualifier_values if isinstance(snak, dict))
    for reference in claim.get("references", []):
        if not isinstance(reference, dict):
            continue
        for reference_values in reference.get("snaks", {}).values():
            if isinstance(reference_values, list):
                yield from (snak for snak in reference_values if isinstance(snak, dict))


def linked_items(entity: Entity) -> set[str]:
    linked: set[str] = set()
    claims = entity.get("claims", {})
    if not isinstance(claims, dict):
        return linked
    for claim_values in claims.values():
        if not isinstance(claim_values, list):
            continue
        for claim in claim_values:
            if not isinstance(claim, dict):
                continue
            for snak in snaks_from_claim(claim):
                datavalue = snak.get("datavalue")
                if not isinstance(datavalue, dict):
                    continue
                if datavalue.get("type") != "wikibase-entityid":
                    continue
                identifier = entity_id(datavalue.get("value"))
                if identifier and identifier.startswith("Q"):
                    linked.add(identifier)
    return linked


def stable_order(identifier: str, seed: str) -> tuple[str, str]:
    digest = hashlib.sha256(f"{seed}:{identifier}".encode()).hexdigest()
    return digest, identifier


def catalog_candidates(
    source: str,
    database: Path,
    scan_items: int,
) -> int:
    connection = sqlite3.connect(database)
    connection.execute(
        "CREATE TABLE candidates (id TEXT PRIMARY KEY, ordinal INTEGER NOT NULL, entity TEXT NOT NULL, links TEXT NOT NULL)"
    )
    count = 0
    with open_dump(source) as stream:
        for entity in stream_json_array(stream):
            identifier = entity.get("id")
            if entity.get("type") != "item" or not isinstance(identifier, str):
                continue
            connection.execute(
                "INSERT INTO candidates VALUES (?, ?, ?, ?)",
                (
                    identifier,
                    count,
                    json.dumps(entity, ensure_ascii=False, separators=(",", ":")),
                    json.dumps(sorted(linked_items(entity))),
                ),
            )
            count += 1
            if count >= scan_items:
                break
            if count % 1000 == 0:
                connection.commit()
                print(f"Catalogued {count:,} candidate items...", file=sys.stderr)
    connection.commit()
    connection.close()
    return count


def select_connected_items(
    database: Path,
    maximum_items: int,
    seed_entity: str | None,
    seed: str,
) -> list[str]:
    connection = sqlite3.connect(database)
    candidates = {
        identifier: set(json.loads(links))
        for identifier, links in connection.execute("SELECT id, links FROM candidates")
    }
    connection.close()
    candidate_ids = set(candidates)
    graph = {
        identifier: links & candidate_ids for identifier, links in candidates.items()
    }
    for identifier, links in list(graph.items()):
        for linked in links:
            graph[linked].add(identifier)

    def component(root: str) -> set[str]:
        seen = {root}
        queue = deque([root])
        while queue:
            current = queue.popleft()
            for linked in graph[current]:
                if linked not in seen:
                    seen.add(linked)
                    queue.append(linked)
        return seen

    selected_component: set[str]
    if seed_entity and seed_entity in graph:
        selected_component = component(seed_entity)
        if len(selected_component) < maximum_items:
            print(
                f"Seed {seed_entity} only reaches {len(selected_component):,} candidates; selecting the largest component instead.",
                file=sys.stderr,
            )
        else:
            return breadth_first_subset(graph, seed_entity, maximum_items, seed)

    remaining = set(graph)
    largest: set[str] = set()
    while remaining:
        current = min(remaining, key=lambda identifier: stable_order(identifier, seed))
        current_component = component(current)
        remaining -= current_component
        if len(current_component) > len(largest):
            largest = current_component
    if len(largest) < maximum_items:
        raise ValueError(
            f"The largest connected component has {len(largest):,} items; scan more than the current candidate window."
        )
    root = min(largest, key=lambda identifier: stable_order(identifier, seed))
    return breadth_first_subset(graph, root, maximum_items, seed)


def breadth_first_subset(
    graph: dict[str, set[str]], root: str, target_items: int, seed: str
) -> list[str]:
    selected = [root]
    seen = {root}
    queue = deque([root])
    while queue and len(selected) < target_items:
        current = queue.popleft()
        for linked in sorted(
            graph[current], key=lambda identifier: stable_order(identifier, seed)
        ):
            if linked in seen:
                continue
            seen.add(linked)
            selected.append(linked)
            queue.append(linked)
            if len(selected) == target_items:
                break
    if len(selected) != target_items:
        raise ValueError("The selected component was smaller than requested.")
    return selected


def snak_is_supported(snak: dict[str, Any], selected_items: set[str]) -> bool:
    if snak.get("datatype") not in PORTABLE_DATATYPES:
        return False
    datavalue = snak.get("datavalue")
    if not isinstance(datavalue, dict) or datavalue.get("type") != "wikibase-entityid":
        return True
    identifier = entity_id(datavalue.get("value"))
    return identifier is not None and identifier in selected_items


def filter_claim(
    claim: dict[str, Any], selected_items: set[str]
) -> dict[str, Any] | None:
    mainsnak = claim.get("mainsnak")
    if not isinstance(mainsnak, dict) or not snak_is_supported(
        mainsnak, selected_items
    ):
        return None
    filtered = copy.deepcopy(claim)
    qualifiers: dict[str, list[dict[str, Any]]] = {}
    for property_id, values in filtered.get("qualifiers", {}).items():
        retained = [
            snak
            for snak in values
            if isinstance(snak, dict) and snak_is_supported(snak, selected_items)
        ]
        if retained:
            qualifiers[property_id] = retained
    if qualifiers:
        filtered["qualifiers"] = qualifiers
    else:
        filtered.pop("qualifiers", None)
        filtered.pop("qualifiers-order", None)

    references = []
    for reference in filtered.get("references", []):
        if not isinstance(reference, dict):
            continue
        reference_snaks: dict[str, list[dict[str, Any]]] = {}
        for property_id, values in reference.get("snaks", {}).items():
            retained = [
                snak
                for snak in values
                if isinstance(snak, dict) and snak_is_supported(snak, selected_items)
            ]
            if retained:
                reference_snaks[property_id] = retained
        if reference_snaks:
            retained_reference = copy.deepcopy(reference)
            retained_reference["snaks"] = reference_snaks
            references.append(retained_reference)
    if references:
        filtered["references"] = references
    else:
        filtered.pop("references", None)
    return filtered


def compact_entity(entity: Entity, selected_items: set[str]) -> Entity:
    claims: dict[str, list[dict[str, Any]]] = {}
    for property_id, values in entity.get("claims", {}).items():
        if not isinstance(values, list):
            continue
        retained = [
            filtered
            for claim in values
            if isinstance(claim, dict)
            if (filtered := filter_claim(claim, selected_items)) is not None
        ]
        if retained:
            claims[property_id] = retained
    return {
        "id": entity["id"],
        "type": "item",
        "labels": entity.get("labels", {}),
        "descriptions": entity.get("descriptions", {}),
        "aliases": entity.get("aliases", {}),
        "claims": claims,
    }


def property_catalog(entities: Iterable[Entity]) -> dict[str, str]:
    catalog: dict[str, str] = {}
    for entity in entities:
        for claim_values in entity.get("claims", {}).values():
            for claim in claim_values:
                for snak in snaks_from_claim(claim):
                    property_id = snak.get("property")
                    datatype = snak.get("datatype")
                    if not isinstance(property_id, str) or not isinstance(
                        datatype, str
                    ):
                        raise ValueError(
                            f"Cannot derive a datatype for property {property_id!r}."
                        )
                    existing = catalog.setdefault(property_id, datatype)
                    if existing != datatype:
                        raise ValueError(
                            f"Property {property_id} has inconsistent datatypes: {existing} and {datatype}."
                        )
    return catalog


def source_entities_for_ids(
    database: Path, identifiers: list[str]
) -> dict[str, Entity]:
    """Load source entities in a selected traversal order from the temporary catalog."""
    connection = sqlite3.connect(database)
    rows = connection.execute(
        "SELECT id, entity FROM candidates WHERE id IN ({})".format(
            ",".join("?" for _ in identifiers)
        ),
        identifiers,
    ).fetchall()
    connection.close()
    return {identifier: json.loads(entity) for identifier, entity in rows}


def compacted_entities(
    source_entities: dict[str, Entity], selected_ids: list[str]
) -> list[Entity]:
    selected_items = set(selected_ids)
    return [
        compact_entity(source_entities[identifier], selected_items)
        for identifier in selected_ids
    ]


def statement_count(entities: Iterable[Entity]) -> int:
    return sum(
        len(values)
        for entity in entities
        for values in entity.get("claims", {}).values()
        if isinstance(values, list)
    )


def select_statement_budget(
    database: Path, ordered_ids: list[str], maximum_statements: int
) -> list[str]:
    """Choose the largest connected prefix whose retained claims fit the budget.

    Each trial recomputes the self-contained claim set because adding a later
    item can make an earlier item-to-item claim valid. That makes the final
    statement count monotonic and the selection deterministic.
    """
    source_entities = source_entities_for_ids(database, ordered_ids)
    counts: dict[int, int] = {}

    def count_prefix(size: int) -> int:
        if size not in counts:
            counts[size] = statement_count(
                compacted_entities(source_entities, ordered_ids[:size])
            )
        return counts[size]

    if count_prefix(1) > maximum_statements:
        raise ValueError(
            "The selected root item alone exceeds --max-statements; choose a larger budget or another seed."
        )
    lower, upper = 1, len(ordered_ids)
    while lower < upper:
        midpoint = (lower + upper + 1) // 2
        if count_prefix(midpoint) <= maximum_statements:
            lower = midpoint
        else:
            upper = midpoint - 1
    return ordered_ids[:lower]


def write_corpus(
    output: Path,
    source: str,
    scan_items: int,
    seed: str,
    selected_ids: list[str],
    database: Path,
    maximum_statements: int,
) -> None:
    output.mkdir(parents=True, exist_ok=True)
    entities = compacted_entities(
        source_entities_for_ids(database, selected_ids), selected_ids
    )
    properties = property_catalog(entities)

    entity_path = output / "entities.jsonl"
    digest = hashlib.sha256()
    retained_statements = 0
    with entity_path.open("w", encoding="utf-8") as stream:
        for entity in entities:
            encoded = (
                json.dumps(entity, ensure_ascii=False, separators=(",", ":")) + "\n"
            )
            stream.write(encoded)
            digest.update(encoded.encode())
            retained_statements += sum(
                len(values) for values in entity["claims"].values()
            )

    metadata = {
        "format": "wbs-benchmark-corpus/v1",
        "created_at": datetime.now(UTC).isoformat(),
        "source": source,
        "selection": {
            "candidate_items_scanned": scan_items,
            "item_count": len(entities),
            "maximum_statements": maximum_statements,
            "root_item": selected_ids[0],
            "seed": seed,
            "selection_order": "deterministic breadth-first traversal of one connected component",
            "value_profile": "portable-v1",
        },
        "counts": {
            "items": len(entities),
            "properties": len(properties),
            "statements": retained_statements,
        },
        "files": {"entities.jsonl": {"sha256": digest.hexdigest()}},
        "properties": [
            {"source_id": identifier, "datatype": datatype}
            for identifier, datatype in sorted(properties.items())
        ],
    }
    (output / "manifest.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dump",
        required=True,
        help="Local path or dated HTTP(S) Wikidata JSON dump URL.",
    )
    parser.add_argument(
        "--output", required=True, type=Path, help="Directory for the generated corpus."
    )
    parser.add_argument(
        "--max-statements",
        type=int,
        default=10_000,
        help="Maximum retained Wikibase statements; the generated corpus records its exact lower total.",
    )
    parser.add_argument(
        "--max-items",
        type=int,
        default=10_000,
        help="Maximum connected-item search prefix used to satisfy --max-statements.",
    )
    parser.add_argument(
        "--scan-items",
        type=int,
        default=100_000,
        help="Number of dump items to inspect before selecting one connected component.",
    )
    parser.add_argument(
        "--seed", default="wbs-benchmark-v1", help="Stable selection seed."
    )
    parser.add_argument(
        "--seed-entity",
        default="Q42",
        help="Preferred component root, if large enough.",
    )
    return parser.parse_args()


def main() -> int:
    args = arguments()
    if (
        args.max_statements < 1
        or args.max_items < 1
        or args.scan_items < args.max_items
    ):
        raise ValueError(
            "--max-statements and --max-items must be positive, and --scan-items must be at least --max-items."
        )
    if args.output.exists() and any(args.output.iterdir()):
        raise ValueError(f"Output directory {args.output} is not empty.")

    temporary = Path(tempfile.mkdtemp(prefix="wbs-benchmark-candidates-"))
    try:
        database = temporary / "candidates.sqlite"
        actual_candidates = catalog_candidates(args.dump, database, args.scan_items)
        if actual_candidates < args.max_items:
            raise ValueError(
                f"Only {actual_candidates:,} items were found before the dump ended; cannot select {args.max_items:,}."
            )
        ordered = select_connected_items(
            database, args.max_items, args.seed_entity, args.seed
        )
        selected = select_statement_budget(database, ordered, args.max_statements)
        write_corpus(
            args.output,
            args.dump,
            actual_candidates,
            args.seed,
            selected,
            database,
            args.max_statements,
        )
        print(
            f"Wrote {len(selected):,} connected items within a {args.max_statements:,}-statement budget to {args.output}"
        )
    finally:
        shutil.rmtree(temporary, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
