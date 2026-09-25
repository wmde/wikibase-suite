#!/usr/bin/env python3
"""Profile a dated Wikidata JSON dump for benchmark-corpus selection.

The profile is a compact, durable input to a later stratified selector.  It
streams the dump and stores aggregate entity-shape distributions only; it does
not retain dump entities or claim that source statements equal RDF triples.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_wikidata_subset import linked_items, open_dump, stream_json_array


BUCKETS = (("0", 0, 0), ("1", 1, 1), ("2-4", 2, 4), ("5-9", 5, 9),
           ("10-24", 10, 24), ("25-99", 25, 99), ("100+", 100, None))


def statement_count(entity: dict[str, Any]) -> int:
    return sum(len(values) for values in entity.get("claims", {}).values() if isinstance(values, list))


def bucket_for(count: int) -> str:
    for name, lower, upper in BUCKETS:
        if count >= lower and (upper is None or count <= upper):
            return name
    raise AssertionError(count)


def profile(source: str, limit: int | None = None) -> dict[str, Any]:
    items = 0
    statements = 0
    buckets: Counter[str] = Counter()
    qualifiers = references = linked = 0
    datatypes: Counter[str] = Counter()
    with open_dump(source) as stream:
        for entity in stream_json_array(stream):
            if entity.get("type") != "item":
                continue
            count = statement_count(entity)
            items += 1
            statements += count
            buckets[bucket_for(count)] += 1
            linked += len(linked_items(entity))
            for values in entity.get("claims", {}).values():
                if not isinstance(values, list):
                    continue
                for claim in values:
                    if not isinstance(claim, dict):
                        continue
                    qualifiers += sum(len(v) for v in claim.get("qualifiers", {}).values() if isinstance(v, list))
                    for reference in claim.get("references", []):
                        if isinstance(reference, dict):
                            references += sum(len(v) for v in reference.get("snaks", {}).values() if isinstance(v, list))
                    snak = claim.get("mainsnak", {})
                    if isinstance(snak, dict) and isinstance(snak.get("datatype"), str):
                        datatypes[snak["datatype"]] += 1
            if limit and items >= limit:
                break
    return {
        "format": "wbs-benchmark-dump-profile/v1",
        "created_at": datetime.now(UTC).isoformat(),
        "source": source,
        "complete_dump": limit is None,
        "items_profiled": items,
        "source_statements": statements,
        "mean_source_statements_per_item": statements / items if items else 0,
        "statement_buckets": [{"name": n, "min": lo, "max": hi, "items": buckets[n], "fraction": buckets[n] / items if items else 0} for n, lo, hi in BUCKETS],
        "feature_totals": {"qualifier_snaks": qualifiers, "reference_snaks": references, "linked_items": linked},
        "main_snak_datatypes": dict(sorted(datatypes.items())),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dump", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--limit-items", type=int, help="Development-only partial profile; never use it as a representative recipe input.")
    args = parser.parse_args()
    if args.limit_items is not None and args.limit_items < 1:
        raise ValueError("--limit-items must be positive.")
    if args.output.exists():
        raise ValueError(f"Refusing to replace existing profile {args.output}.")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(profile(args.dump, args.limit_items), indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
