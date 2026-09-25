#!/usr/bin/env python3
"""Select a deterministic scholarly-article pilot from a Truthy Parquet snapshot.

This selector intentionally makes a narrow, inspectable first definition:
items with a direct ``P31=Q13442814`` (scholarly article) truthy statement. It
is not a complete taxonomic definition of all scholarly works, and it does not
claim that truthy rows equal the RDF triples produced by a local Wikibase.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


SCHOLARLY_ARTICLE_QID = 13_442_814
INSTANCE_OF_PID = 31


def sql_string(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def selection_ctes(parquet: str, seed: str, limit: int) -> str:
    """The CTE is repeated in output and statistics queries by design."""
    source = sql_string(parquet)
    seed_value = sql_string(":" + seed)
    return f"""
WITH scholarly AS (
  SELECT DISTINCT subject
  FROM read_parquet({source})
  WHERE property = {INSTANCE_OF_PID} AND object_id = {SCHOLARLY_ARTICLE_QID}
), selected AS (
  SELECT subject
  FROM scholarly
  ORDER BY hash(CAST(subject AS VARCHAR) || {seed_value})
  LIMIT {limit}
)
"""


def qid_query(parquet: str, seed: str, limit: int) -> str:
    return selection_ctes(parquet, seed, limit) + f"""
SELECT 'Q' || CAST(subject AS VARCHAR) AS qid
FROM selected
ORDER BY hash(CAST(subject AS VARCHAR) || {sql_string(':' + seed)});
"""


def statistics_query(parquet: str, seed: str, limit: int) -> str:
    source = sql_string(parquet)
    return selection_ctes(parquet, seed, limit) + f"""
, selected_statement_counts AS (
  SELECT statements.subject, COUNT(*) AS truthy_statements
  FROM read_parquet({source}) AS statements
  INNER JOIN selected USING (subject)
  GROUP BY statements.subject
)
SELECT
  (SELECT COUNT(*) FROM scholarly) AS eligible_items,
  (SELECT COUNT(*) FROM selected) AS selected_items,
  COALESCE(SUM(truthy_statements), 0) AS selected_truthy_statements,
  COALESCE(AVG(truthy_statements), 0) AS mean_truthy_statements_per_selected_item,
  (SELECT version()) AS duckdb_version
FROM selected_statement_counts;
"""


def run_duckdb_cli(binary: str, sql: str, json_output: bool = False) -> str:
    command = [binary]
    if json_output:
        command.append("-json")
    command.extend(("-c", sql))
    completed = subprocess.run(command, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return completed.stdout


def run_duckdb_python(sql: str, json_output: bool = False) -> str:
    """Use the Python package in the disposable bootstrap image."""
    try:
        import duckdb  # type: ignore[import-not-found]
    except ImportError as error:
        raise RuntimeError("DuckDB Python package is unavailable; use the bootstrap Compose service or --duckdb CLI") from error
    connection = duckdb.connect()
    try:
        # The bootstrap image installs httpfs at build time. Local Parquet needs
        # no extension; remote hf:// input needs it but should not install it at
        # each benchmark invocation.
        if "LOAD httpfs" in sql:
            connection.execute("LOAD httpfs")
            sql = sql.replace("LOAD httpfs; ", "", 1)
        result = connection.execute(sql)
        if not json_output:
            return ""
        row = result.fetchone()
        columns = [description[0] for description in result.description]
        return json.dumps([dict(zip(columns, row))])
    finally:
        connection.close()


def run_duckdb(arguments: argparse.Namespace, sql: str, json_output: bool = False) -> str:
    if arguments.duckdb_python:
        return run_duckdb_python(sql, json_output)
    return run_duckdb_cli(arguments.duckdb, sql, json_output)


def httpfs_setup(parquet: str) -> str:
    """Avoid an extension download when a local Parquet file is supplied."""
    return "INSTALL httpfs; LOAD httpfs; " if "://" in parquet else ""


def checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def select(arguments: argparse.Namespace) -> dict[str, Any]:
    if arguments.limit < 1:
        raise ValueError("--limit must be positive")
    if arguments.output.exists():
        raise ValueError(f"Refusing to replace existing selection directory {arguments.output}")
    if not arguments.duckdb_python and shutil.which(arguments.duckdb) is None:
        raise RuntimeError(f"DuckDB executable not found: {arguments.duckdb}")
    arguments.output.mkdir(parents=True)
    qids = arguments.output / "qids.txt"
    try:
        # DuckDB's httpfs extension is needed for hf:// sources. Do not try to
        # download it when a local Parquet snapshot has already been staged.
        output_sql = httpfs_setup(arguments.parquet) + "COPY (" + qid_query(arguments.parquet, arguments.seed, arguments.limit).rstrip(";\n") + ") TO " + sql_string(str(qids)) + " (HEADER false);"
        run_duckdb(arguments, output_sql)
        values = [line.strip() for line in qids.read_text(encoding="utf-8").splitlines() if line.strip()]
        if len(values) != arguments.limit or len(values) != len(set(values)) or any(not value.startswith("Q") for value in values):
            raise RuntimeError("DuckDB did not produce the requested unique QID selection")
        raw_statistics = run_duckdb(
            arguments,
            httpfs_setup(arguments.parquet) + statistics_query(arguments.parquet, arguments.seed, arguments.limit),
            json_output=True,
        )
        rows = json.loads(raw_statistics)
        if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict):
            raise RuntimeError("DuckDB did not return one statistics object")
        statistics: dict[str, Any] = rows[0]
        manifest = {
            "format": "wbs-truthy-scholarly-selection/v1",
            "created_at": datetime.now(UTC).isoformat(),
            "source": {
                "parquet": arguments.parquet,
                "snapshot_revision": arguments.snapshot_revision,
                "parquet_sha256": arguments.parquet_sha256,
                "statement_semantics": "one Wikidata truthy statement per Parquet row; not local Wikibase RDF triples",
            },
            "selection": {
                "scope": "direct P31=Q13442814 scholarly article",
                "property": "P31",
                "value": "Q13442814",
                "seed": arguments.seed,
                "order": "DuckDB hash(CAST(subject AS VARCHAR) || ':' || seed)",
                "limit": arguments.limit,
            },
            "statistics": statistics,
            "qids_file": {"name": qids.name, "sha256": checksum(qids), "count": len(values)},
            "next_step": "Materialize this exact QID list from the same dated Wikidata JSON entity dump before preparing a Wikibase import bundle.",
        }
        (arguments.output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        return manifest
    except Exception:
        # No manifest means the selection is not a valid durable artifact.
        (arguments.output / "manifest.json").unlink(missing_ok=True)
        raise


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--parquet", required=True,
                        help="Pinned local path or hf:// Parquet URL for Truthy statements.")
    result.add_argument("--snapshot-revision", required=True,
                        help="Immutable source release date or Hugging Face revision recorded in the manifest.")
    result.add_argument("--parquet-sha256", required=True,
                        help="SHA-256 of the exact Parquet file (for Hugging Face Xet, its X-Linked-ETag).")
    result.add_argument("--output", required=True, type=Path)
    result.add_argument("--limit", type=int, default=100_000)
    result.add_argument("--seed", default="wbs-scholarly-pilot-v1")
    result.add_argument("--duckdb", default="duckdb", help="DuckDB CLI executable.")
    result.add_argument("--duckdb-python", action="store_true",
                        help="Use the DuckDB Python package; used by the disposable bootstrap Compose service.")
    return result


def main() -> int:
    arguments = parser().parse_args()
    manifest = select(arguments)
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
