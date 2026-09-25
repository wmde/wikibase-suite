# Suite benchmarking

`wbs-dev benchmark` owns reproducible development experiments: preparing frozen
datasets, measuring importer throughput, and collecting resources on a running
Suite. Run `wbs-dev benchmark --help` for the command groups. The containerized
development environment supplies the runtimes; Python implementations live here
alongside their TypeScript command registration.

Whole-stack performance experiments start with an already-populated, settled
installation. A corpus may have been loaded earlier through `wbs import`, or
restored from a snapshot. The performance measurement itself does not import it.
Resource collection can be enabled independently on an existing installation.
Named query/update workloads and automated scaling runs remain to be implemented.

The architecture and next steps are recorded in
[ADR 26](../../docs/adr/0026-reproducible-suite-capacity-benchmarks.md).

## Prepare a benchmark corpus

Copy [the scholarly recipe example](datasets/recipes/scholarly-example.json)
beside your local input files and replace its source revision and SHA-256. Paths
inside a recipe are relative to that recipe. Use a dated Wikidata JSON dump and
a matching Truthy Parquet snapshot. The example is a template, not a pinned
dataset or a representative sampling recipe.
The selector expects numeric `subject`, `property`, and `object_id` columns from
the Truthy statements dataset, not an arbitrary RDF Parquet layout.

From the repository root, with `development/` on PATH:

```sh
wbs-dev benchmark corpus prepare \
  --recipe development/commands/benchmark/corpora/sources/scholarly.json \
  --output development/commands/benchmark/corpora/scholarly-1k
```

This verifies the local Parquet checksum, runs the pinned DuckDB helper to
select direct `P31=Q13442814` article IDs, materializes entity JSON from the dump,
and invokes `wbs import prepare`. The output holds the recipe, QID selection,
materialization manifest, generic import bundle, and final `corpus.json` marker.
The DuckDB Dockerfile and dataset Compose file supply only the selection helper.

The recipe's `limit` counts selected articles. Shallow direct Q/P support
entities increase the final entity count. Selected claims are retained, with
support entities providing local link closure; this is a documented graph
scenario, not yet a statistically representative Wikidata sample. Materializing
it scans the full JSON dump, so preparation can be expensive even for a small
selection. Failed preparation retains partial evidence; use a new output path
after correcting the cause. Preparation is not included in importer throughput.

Additional corpus tools:

- `corpus profile`: stream a dump to record entity-shape distributions.
- `corpus extract`: produce a small connected reference corpus.
- `corpus synthetic`: produce a deterministic synthetic control.

Each has `--help`. The connected and synthetic tools use the earlier benchmark
corpus schema, not the native prepared-bundle schema. Their small Action API
reference loader remains in `scripts/import_wikibase.py`; they cannot yet be
passed directly to `wbs import load`. The scholarly preparation path produces
the generic import bundle used by the throughput runner.

## Measure import throughput

Use a fresh, otherwise quiescent target Suite and an existing import account:

```sh
wbs-dev benchmark import \
  --bundle development/commands/benchmark/corpora/scholarly-1k/bundle \
  --state-dir development/commands/benchmark/corpora/scholarly-1k/import-state \
  --output development/commands/benchmark/results/import-1k \
  --user Importer --compose-file docker-compose.yml --project-name wbs-deploy
```

For preparation and a trial in one command, replace `--bundle` with
`--recipe PATH --corpus-dir NEW_DIRECTORY`. Corpus preparation completes before
the timed import phase. Existing bundles let you repeat trials without repeating
selection or materialization. Use a fresh target and new state for a fresh rate;
reusing state measures a resumed import.

See [import-trial details](bulk-import/README.md) for comparison options, results,
and the boundary between publication and derived-service readiness.

## Collect resources on a populated Suite

On the target Linux Docker host:

```sh
wbs-dev benchmark metrics start --network wbs-deploy_default
wbs-dev benchmark snapshot \
  --project wbs-deploy --checkpoint settled \
  --output development/commands/benchmark/results/baseline/settled.json

# Exercise the instance with a separately defined workload, then capture a checkpoint.
wbs-dev benchmark snapshot \
  --project wbs-deploy --checkpoint after-workload \
  --output development/commands/benchmark/results/baseline/after-workload.json
wbs-dev benchmark metrics stop
```

`metrics status` shows collector services. Prometheus is available on port 9090
by default; `metrics start --port PORT` changes it. Pass `snapshot
--prometheus-url URL` when using a different endpoint. In the development
container the default URL reaches the Docker host; direct Python execution uses
localhost. Stopping collectors preserves their named-volume data.

cAdvisor and Node Exporter provide container/host CPU, memory, I/O and swap
series; Prometheus retains seven days. Snapshots store point-in-time counters,
profile service coverage, named-volume sizes and selected instant metrics.
Continuous time series are currently retained in Prometheus, not exported into
the results directory. Two snapshots cannot establish peak query memory or
latency. Durable range export and a named workload runner are next work.

[`profiles.json`](profiles.json) defines service sets and proposed host budgets.
Its 8 GiB standard-stack and 4 GiB QLever profiles are initial hypotheses, not
recommended RAM sizes or measured limits. Select a matching `--profile`, inspect
missing services in the snapshot, and record the host's actual specification.
Use Linux for sizing evidence; Docker Desktop collectors see the Linux VM.

## Paths and evidence

CLI-relative paths resolve from the repository root. The standard launchers
mount the checkout; keep large inputs, corpus artifacts and importer state under
the ignored `corpora/` directory, and per-run evidence under ignored `results/`.
External disks/paths require an explicit mount at the same path in the tools
container and on the Docker host. No datasets or measurements belong in Git.

For capacity comparisons, record the baseline manifest, image versions, actual
host resources, service configuration, workload, concurrency, latency/errors,
and measured RDF triple count. Source statements and entity counts are input
descriptors, not RDF triple counts. Measure visible triples after query-service
convergence. The representative recipe proposes a tolerance; the scale ladder
and expansion model still need calibration.

Source ownership:

- `command.ts`: development CLI registration and runtime boundaries.
- `scripts/`, `datasets/`: corpus construction, recipes and manifests.
- `bulk-import/`: throughput orchestration using the WBS import interface.
- `lib/`, `compose/`, `profiles.json`: resource collection.
- `tests/`: corpus correctness tests; throughput tests live with their scenario.

## Resume here

No whole-stack capacity result exists yet. First reproduce a documented import
trial on a Linux VPS, with correctness/rebuild checks owned by the importer.
Separately, define the baseline sizes and representative scholarly query/update
workloads, then implement a run record and durable time-series export. Passive
collection on an existing populated instance can proceed before the full
scholarly corpus is loadable. The complete scholarly import is a future use of
`wbs import`; it does not depend on running benchmarks.

## Development checks

Run `wbs-dev test wbs-dev-tools` for CLI contracts. Python correctness tests are
under `tests/` and `bulk-import/tests/`. The opt-in end-to-end corpus smoke uses
tiny generated Parquet/JSON inputs and the real containerized command:

```sh
WBS_CORPUS_SMOKE=1 python3 development/commands/benchmark/tests/prepare_corpus.test.py \
  CorpusPipelineTest.test_real_duckdb_materialization_and_wbs_bundle
```

That test requires host Python 3.11+ and Docker and builds the pinned DuckDB
helper. Importer persistence checks belong to the WBS import command's tests.
