# 26) Establish reproducible Suite benchmarks {#adr_0026}

Date: 2026-09-25

## Status

proposed; corpus and import tools implemented, capacity experiments incomplete

## Context

Suite development needs repeatable evidence about CPU, memory, storage, query
latency and update convergence as graph size and concurrent activity grow. The
scholarly-article hosting investigation motivates this work, but the capability
should support comparisons across datasets, Suite versions and host sizes.

Import throughput and running-system capacity answer different questions.
Practical import is necessary to provision very large baselines, while resource
collection and workload measurement can operate on any existing baseline.

## Decision

Own this capability under `development/commands/benchmark/`, exposed through
`wbs-dev benchmark`. Keep the existing Python implementations behind thin
TypeScript command registration in the development environment.

The command has three responsibilities:

1. **Corpus preparation:** frozen source recipes, deterministic selection,
   native JSON materialization, manifests and graph-size calibration. Dataset
   selection belongs here. Generic bundle preparation uses `wbs import prepare`.
2. **Import experiments:** invoke `wbs import load` against a fixed bundle and
   retain publication/recovery/resource evidence. An optional recipe prepares
   the input first, with preparation separate from import timing.
3. **Running-system measurement:** collect resources and, in a later step, run
   named workloads against an already-populated, settled Suite. Importing and
   restoring a baseline are separate setup operations.

The implemented entry points are `corpus`, `import`, `metrics start/stop/status`,
and `snapshot`. Resource collection alone is observability, not a complete
performance benchmark. No generic shell-workload runner or placeholder capacity
command is presented as a finished benchmark. A public operator monitoring
command can be considered separately when its use and contract are established.

Corpora and results remain durable local artifacts outside Git. Each performance
run must identify its baseline, actual host resources, image/configuration
versions, visible RDF graph size, workload and concurrency, latency/errors,
and continuous resource measurements. Initial profile budgets are hypotheses,
not sizing recommendations. Source entity/statement counts are not RDF counts;
measure visible triples after convergence and calibrate the intended size ladder.

## Consequences

Benchmarking has one development-command owner. [Bulk import](0025-bulk-import-capability.md)
has its own operator-command owner and knows nothing about benchmark corpus
selection. A complete scholarly import can run independently of benchmarks.

Baselines may come from earlier imports or restored snapshots. Resource
collection can start before a large importer is ready. Reproducible workload
experiments still require defined traffic, concurrency and service readiness;
passive snapshots cannot establish peak query memory or acceptable latency.

## Work in progress and resumption

Available: connected/synthetic corpus tools, a dump-shape profiler, a proposed
representative sampling recipe, Truthy scholarly selection and JSON
materialization, import trials, Linux collectors and resource snapshots.
The scholarly selector currently samples direct `P31=Q13442814` articles and
adds shallow support entities; it is not yet a representative sampling solution.

No whole-stack capacity result exists. Prometheus currently retains continuous
series locally for seven days; durable range export and a named workload runner
are still required. Query/update workloads, latency/convergence thresholds and
the target RDF scale ladder remain open decisions.

Resume with two concrete tracks: reproduce importer throughput on Linux as
described in ADR 25; define a frozen baseline and realistic scholarly workloads
for running-system measurement. Then add a run manifest and time-series export,
measure idle and concurrent-load behavior, and compare actual 64/128 GiB-class
hosts or other explicitly chosen budgets. Select host sizes as experiments,
not conclusions inherited from the initial profiles.

The [command README](../../commands/benchmark/README.md) documents current usage
and implementation ownership. Import observations belong in the
[throughput scenario](../../commands/benchmark/bulk-import/README.md).
