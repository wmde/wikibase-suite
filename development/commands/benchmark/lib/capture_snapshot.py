#!/usr/bin/env python3
"""Capture a point-in-time resource snapshot for a Wikibase Suite benchmark.

The collector intentionally uses the Docker CLI rather than a daemon-specific
library. It records current container memory/CPU counters and exact byte totals
for named Docker volumes used by services in the selected capacity profile.
Continuous peaks and host pressure remain Prometheus' responsibility; this
script makes the repeatable, stage-by-stage baseline and growth data durable.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[4]
PROFILES = ROOT / "development/commands/benchmark/profiles.json"


def command(*arguments: str) -> str:
    """Run a read-only Docker command and return its standard output."""
    completed = subprocess.run(
        arguments,
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return completed.stdout


def byte_count(value: str) -> int | None:
    """Parse Docker's binary-size display, such as ``471.9MiB``."""
    match = re.fullmatch(r"([0-9]+(?:\.[0-9]+)?)\s*([kMGTPE]?i?B)", value.strip())
    if not match:
        return None
    amount, unit = match.groups()
    multipliers = {
        "B": 1,
        "kB": 1_000,
        "MB": 1_000**2,
        "GB": 1_000**3,
        "TB": 1_000**4,
        "PB": 1_000**5,
        "EB": 1_000**6,
        "KiB": 1024,
        "MiB": 1024**2,
        "GiB": 1024**3,
        "TiB": 1024**4,
        "PiB": 1024**5,
        "EiB": 1024**6,
    }
    return round(float(amount) * multipliers[unit])


def container_stats(container_id: str) -> dict[str, Any]:
    raw = command(
        "docker", "stats", "--no-stream", "--format", "{{json .}}", container_id
    )
    statistics = json.loads(raw)
    memory_used = statistics.get("MemUsage", "").split(" / ", 1)[0]
    return {
        "name": statistics.get("Name"),
        "cpu_percent": statistics.get("CPUPerc"),
        "memory_usage_bytes": byte_count(memory_used),
        "memory_limit": statistics.get("MemUsage", "").partition(" / ")[2],
        "memory_percent": statistics.get("MemPerc"),
        "network_io": statistics.get("NetIO"),
        "block_io": statistics.get("BlockIO"),
        "pids": statistics.get("PIDs"),
    }


def volume_bytes(volume: str) -> int:
    """Use a disposable read-only mount to measure the named volume exactly."""
    output = command(
        "docker",
        "run",
        "--rm",
        "--volume",
        f"{volume}:/data:ro",
        "alpine:3.22",
        "sh",
        "-c",
        "du -sk /data | cut -f1",
    ).strip()
    return int(output) * 1024


def prometheus_query(endpoint: str, expression: str) -> dict[str, Any]:
    """Return Prometheus' raw instant-vector response for an expression."""
    url = f"{endpoint.rstrip('/')}/api/v1/query?{urlencode({'query': expression})}"
    with urlopen(url, timeout=10) as response:  # noqa: S310 - local CLI endpoint
        payload = json.load(response)
    if payload.get("status") != "success":
        raise RuntimeError(f"Prometheus query failed: {payload}")
    return payload["data"]


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument(
        "--profile",
        default="wikibase-suite-8gb",
        help="Capacity profile from development/commands/benchmark/profiles.json.",
    )
    result.add_argument(
        "--project",
        default="wbs-deploy",
        help="Docker Compose project name for the Suite target.",
    )
    result.add_argument(
        "--checkpoint",
        required=True,
        help="Short stage label, for example empty-settled or statements-written.",
    )
    result.add_argument(
        "--output",
        type=Path,
        required=True,
        help="JSON file to create in the caller's ignored evidence directory.",
    )
    result.add_argument(
        "--prometheus-url",
        default=os.environ.get("WBS_BENCHMARK_PROMETHEUS_URL", "http://localhost:9090"),
        help="Optional Prometheus endpoint; use an empty value to skip its instant metrics.",
    )
    return result


def main() -> int:
    args = parser().parse_args()
    profiles = json.loads(PROFILES.read_text(encoding="utf-8"))["profiles"]
    if args.profile not in profiles:
        available = ", ".join(sorted(profiles))
        raise ValueError(
            f"Unknown profile {args.profile!r}; choose one of: {available}."
        )
    profile = profiles[args.profile]
    wanted_services = set(profile["services"])
    storage_services = set(profile["storage_services"])
    container_ids = command(
        "docker",
        "ps",
        "--filter",
        f"label=com.docker.compose.project={args.project}",
        "--format",
        "{{.ID}}",
    ).splitlines()
    inspected = (
        json.loads(command("docker", "inspect", *container_ids))
        if container_ids
        else []
    )

    services: dict[str, Any] = {}
    volumes: dict[str, Any] = {}
    for container in inspected:
        labels = container.get("Config", {}).get("Labels", {})
        service = labels.get("com.docker.compose.service")
        if service not in wanted_services:
            continue
        container_id = container["Id"]
        services[service] = container_stats(container_id)
        if service not in storage_services:
            continue
        for mount in container.get("Mounts", []):
            if mount.get("Type") != "volume" or not mount.get("RW"):
                continue
            name = mount.get("Name")
            if not isinstance(name, str):
                continue
            entry = volumes.setdefault(
                name,
                {"bytes": volume_bytes(name), "services": [], "destinations": []},
            )
            entry["services"].append(service)
            entry["destinations"].append(mount.get("Destination"))

    missing = sorted(wanted_services - set(services))
    metrics: dict[str, Any] = {}
    if args.prometheus_url:
        expressions = {
            "host_available_memory_bytes": "node_memory_MemAvailable_bytes",
            "host_swap_free_bytes": "node_memory_SwapFree_bytes",
            "host_swap_total_bytes": "node_memory_SwapTotal_bytes",
            "container_memory_working_set_bytes": "container_memory_working_set_bytes",
        }
        for name, expression in expressions.items():
            try:
                metrics[name] = {
                    "expression": expression,
                    "result": prometheus_query(args.prometheus_url, expression),
                }
            except (
                Exception
            ) as error:  # Snapshot data remains useful without Prometheus.
                metrics[name] = {"expression": expression, "error": str(error)}

    payload = {
        "format": "wbs-benchmark-snapshot/v1",
        "captured_at": datetime.now(UTC).isoformat(),
        "checkpoint": args.checkpoint,
        "profile": args.profile,
        "profile_definition": profile,
        "compose_project": args.project,
        "services": services,
        "missing_profile_services": missing,
        "volumes": volumes,
        "prometheus": metrics,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(
        f"Wrote {args.checkpoint} snapshot for {len(services)} services to {args.output}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
