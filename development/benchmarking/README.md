# Wikibase Suite benchmarking

This directory defines reproducible, opt-in performance experiments for a
Wikibase Suite installation. It is deliberately separate from integration
tests: benchmarks may download sizable data, run for a long time, and retain
measurements, none of which belongs in the normal development or installation
path.

`results/` is a tracked empty directory whose per-run contents are ignored.
Each invocation should write its durable run artifacts beneath a uniquely named
subdirectory there; datasets and resumable importer state remain beside the
ignored corpus that produced them.

No benchmark data is committed to this repository. A benchmark run must record
the dataset release, checksum, selection recipe, loader version, Suite image
versions, host specification, Docker version, and the measurement results.

## Capacity profiles

[`profiles.json`](./profiles.json) records the host budgets the benchmark is
intended to characterize:

- `wikibase-suite-8gb`: the standard stack on a dedicated 8 GiB VPS;
- `qlever-4gb`: a later QLever-enabled profile on a dedicated 4 GiB VPS.

The host, rather than artificial summed container memory limits, is the
aggregate resource boundary. Record host available memory, swap activity, and
OOM events alongside service metrics.

## Initial scope

The first useful benchmark is a capacity experiment with a reproducible graph,
at several statement budgets. It should answer:

1. How do MariaDB, Elasticsearch, and Query Service memory and data volumes
   grow per source statement and visible RDF triple?
2. At what statement/triple volume does each host profile become constrained?
3. How long do writes and search/query indexing take to settle at each stage?

This is not presently a general load-testing system or a comparison of import
APIs. The current Action API importer is a correctness and restartability
baseline; report its duration, but do not treat it as an optimal-ingestion
claim. Importer optimization is deliberately deferred from the capacity work.
The benchmark must not add telemetry to a normal Suite installation.

## First 10k run

The extractor accepts a local `.json`/`.json.gz` dump or streams a compressed
HTTP(S) dump. It stops after its candidate window: it does **not** decompress or
persist the full dump. Use a dated dump URL, rather than `latest`, when creating
an artifact intended to be compared or shared.

```sh
python3 development/benchmarking/scripts/extract_wikidata_subset.py \
  --dump 'https://dumps.wikimedia.org/wikidatawiki/entities/20260907/wikidata-20260907-all.json.gz' \
  --output development/benchmarking/corpora/wikidata-20260907-portable-v3-10k-statements \
  --max-statements 10000 \
  --max-items 10000 \
  --scan-items 100000
```

The output has `entities.jsonl` and a `manifest.json`, including the source URL,
selection recipe, exact entity/property/statement counts, and output checksum.
`--max-statements` is the primary corpus-size control: it selects the largest
deterministic connected-item prefix whose self-contained claims remain within
that budget. `--max-items` bounds the traversal considered while finding that
prefix. Properties are derived from the retained claims so the corpus can be
loaded into an empty Wikibase without waiting to scan the property records near
the end of the full dump. The initial `portable-v1` profile excludes values
whose semantics require a Wikidata-global support entity (time calendar models,
quantity units and coordinate globes); it retains ordinary values, item links,
qualifiers and references. This makes a new local Wikibase corpus self-contained
rather than silently retaining invalid Wikidata URIs.

Start the target Suite normally, then import through its Action API. Credentials
are deliberately supplied at execution time, not stored in the corpus:

```sh
export WIKIBASE_BENCHMARK_API_URL='https://wikibase.example/w/api.php'
export WIKIBASE_BENCHMARK_USERNAME='Admin'
export WIKIBASE_BENCHMARK_PASSWORD='...'
python3 development/benchmarking/scripts/import_wikibase.py \
  --corpus development/benchmarking/corpora/wikidata-20260907-portable-v3-10k-statements
```

For a non-interactive run that should not place a password in shell history or
the environment, supply it on standard input instead:

```sh
read -rs WIKIBASE_BENCHMARK_PASSWORD
printf '\n'
printf '%s\n' "$WIKIBASE_BENCHMARK_PASSWORD" | \
  python3 development/benchmarking/scripts/import_wikibase.py \
    --password-stdin \
    --corpus development/benchmarking/corpora/wikidata-20260907-portable-v3-10k-statements
unset WIKIBASE_BENCHMARK_PASSWORD
```

For a disposable local HTTPS installation with a deliberately untrusted
certificate, add `--insecure` explicitly. The importer creates properties,
then item shells, then their claims. It persists `import-state.json` after each
successful edit, so rerunning the same command resumes it; `import-result.json`
records the duration and totals. Use `--limit 10` for a smoke run before the
full 10k import.

For safety, a new import refuses a Wikibase that already has items or
properties. This benchmark's normal import mode is intentionally an empty
instance; `--allow-existing` is only for an explicitly chosen shared-target
experiment. When that experiment could collide with existing labels, add a
distinct `--label-prefix 'Benchmark: '`.

To collect container metrics on a Linux Docker host while the import runs:

```sh
docker compose -f development/benchmarking/compose/docker-compose.metrics.yml up -d
```

This starts cAdvisor and Prometheus on the target Compose network.
cAdvisor supplies per-container memory, CPU, network, and filesystem/I/O
metrics; exact named-volume bytes should additionally be captured at every
checkpoint, because filesystem metrics alone cannot reliably distinguish an
application volume from container writable layers. The checkpoints are: empty
and settled; properties created; item shells created; statements written;
Elasticsearch settled; and Query Service settled. At the final checkpoint,
record the exact visible RDF graph size with `SELECT (COUNT(*) AS ?triples)
WHERE { ?subject ?predicate ?object }`.

The profile is separate from the target installation. It starts cAdvisor and
Prometheus on the target Compose network
(`wbs-deploy_default` by default). Set `WBS_BENCHMARK_NETWORK` if the target
uses another project name. Prometheus is exposed on port `9090` by default. The
profile is designed for Linux/VPS hosts; Docker Desktop's VM boundary makes
host-level cAdvisor readings less representative.

## Dataset strategy

Use two complementary datasets rather than making synthetic data stand in for
production-shaped data.

### Canonical: a frozen Wikidata subset

The preferred calibration corpus is a reviewed subset of a dated Wikidata JSON
dump. Wikibase's JSON entity format is the native representation used by its
API and dumps, so it preserves the data-model features that matter here:
properties, item-valued statements, qualifiers, references, ranks, labels and
descriptions. The current extractor proves the portable, connected import path;
it is not yet a representative Wikidata sampler because it traverses one
connected component. Do not use its results as general Wikidata-capacity
evidence until a stratified recipe is added.

The eventual corpus-publishing process should:

1. start from an explicitly dated, CC0 Wikidata dump;
2. use a checked-in selection recipe and a fixed random seed;
3. sample multiple deterministic windows through the dump, then retain each
   selected item's graph dependencies needed by claims, qualifiers and
   references;
4. publish compressed artifacts and a manifest with counts and SHA-256 hashes
   outside this repository; and
5. produce nested statement-budgeted subsets from the same ordered corpus,
   rather than unrelated random samples.

The proposed initial size ladder is `10k`, `50k`, and `250k` source statements.
Each level uses the same dated dump, seed, and graph-aware ordering, then records
its exact resulting item and property counts. Report both entity counts and
statement/claim counts: `items` alone is not a useful proxy for graph size.

Topic-based samples (for example, a connected geographic or scholarly graph)
are preferable to arbitrary ID ranges because they retain meaningful
relationships. The corpus must be frozen and downloaded from a release URL;
the public Wikidata API and Query Service are not a load source for benchmark
runs.

### Control: deterministic synthetic graph

A small generator provides this control now. It creates valid Wikibase entities
with configurable property count, statements per item, item links, qualifier
density and reference density. This makes boundary and regression experiments
cheap, but it must never be presented as representative of user data:

```sh
python3 development/benchmarking/scripts/generate_synthetic_corpus.py \
  --output development/benchmarking/corpora/synthetic-v1-10k-statements \
  --max-statements 10000
```

Use the same statement budget for a small source-derived Wikidata corpus and a
synthetic control. Their resulting Query Service triple counts, volume growth,
and settle times show how far the control diverges before it is used for larger
capacity sweeps.

## Loader and snapshots

The first benchmark measures one explicit loader implementation at a time. It
must create properties before dependent entities, map source IDs to locally
assigned IDs, be restartable, and emit a durable run report. A browser-driven
or ad-hoc API loop is not a credible million-entity loader.

Two later modes should share the same corpus manifest:

- **Import mode** measures an empty Suite plus the supported loader. This is
  important user-facing evidence.
- **Snapshot mode** restores a versioned database-volume snapshot. It gives
  fast, repeatable query/profile experiments without repeatedly paying the
  import cost.

Snapshots are disposable benchmark artifacts, never installation fixtures or
repository contents.

## Measurements

Every run should write machine-readable JSON plus a human-readable summary to
an ignored results directory. At minimum record:

- elapsed wall-clock time for setup, import, index/update catch-up and each
  workload phase;
- entity and statement totals before and after each phase;
- request latency distribution and error rate for a named workload;
- peak and sampled CPU, memory, network and block I/O by service; and
- host CPU, memory, storage, OS, Docker and image digests.

For an initial local/VM observability layer, a separate Compose profile uses
cAdvisor, Node Exporter, and Prometheus. cAdvisor supplies container CPU,
memory, network and block-I/O metrics; Node Exporter adds host available-memory,
swap, filesystem and CPU pressure. Grafana is optional presentation, not a
prerequisite for collecting results. The profile must be opt-in because its
collectors need host/Docker mounts and themselves change the workload slightly.

Capture a JSON checkpoint before import and at each settled stage. It records
current service resource use plus exact bytes for the MariaDB, Elasticsearch,
and Query Service data volumes. It also saves raw Prometheus instant vectors
for host available memory, swap and cAdvisor working-set memory; Prometheus
retains the continuous series between checkpoints:

```sh
python3 development/benchmarking/scripts/capture_snapshot.py \
  --checkpoint empty-settled \
  --output development/benchmarking/results/local-10k/empty-settled.json
```

Use a real Linux VPS for capacity evidence. On Docker Desktop or OrbStack the
collectors observe Docker's VM rather than the macOS host, so those snapshots
remain useful for development comparison but not for an 8 GiB host threshold.

## Suggested repository shape

```text
development/benchmarking/
  README.md                 # this contract and operating notes
  datasets/                 # recipes and small manifests only, no corpus data
  workloads/                # versioned API/SPARQL/edit workload definitions
  scripts/                  # fetch, verify, load, run, and report commands
  compose/                  # optional profiling profile and Prometheus config
  results/                  # gitignored local output
```

The next implementation step is a narrow spike: choose one frozen,
graph-connected Wikidata subset at a `10k` statement budget; define its
manifest; and prove a restartable, server-owned import path. Only after that is
credible should we add 50k/250k artifacts, snapshot restoration, or workload
latency testing.
