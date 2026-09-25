# 25) Add a bulk-import capability {#adr_0025}

Date: 2026-09-25

## Status

proposed; command integration implemented, import capability in development

## Context

Suite needs a reliable way to initialize a fresh Wikibase from a large prepared
entity dataset. The scholarly-article hosting investigation made this need
concrete: ordinary edit-based loading can take days at that scale, and no tested
bulk-import workflow currently establishes practical throughput and complete
post-import behavior.

Bulk import is an operator capability within the WBS Tools foundation established
by [ADR 22](0022-wbs-tools-foundation.md). It accepts caller-supplied data; dataset
selection and performance experiments have separate ownership in [ADR 26](0026-reproducible-suite-capacity-benchmarks.md).

## Decision

Implement `wbs import` under `development/images/wbs-tools/commands/import/`:

- `prepare` validates native item/property JSON and produces a checksummed,
  property-first bundle with a durable manifest.
- `load` validates, publishes and resumes that bundle, with progress and rate
  reporting suitable for estimating completion time.

The TypeScript command integrates with WBS Tools. Existing Python preparation
and orchestration and PHP maintenance workers live under the command directory.
The tools image packages the runtime dependencies; the PHP worker runs in the
target Wikibase environment. A language rewrite is not required by this design.

Initial scope is a fresh, importer-owned, otherwise quiescent wiki. Preserve
QIDs/PIDs and one canonical current MediaWiki revision per entity. Source page
history, merging into an edited wiki, and dataset selection are outside that
scope. Required outcomes include normal API/RDF reads, subsequent edits and ID
allocation, correct terms/search, and functioning query-service/update delivery.

The service-native implementation is the correctness reference. Alternative
persistence strategies must satisfy the same post-import and recovery contract.
Derived indexes may be built after publication, but a completed operational
import must include tested reconciliation and readiness procedures. Those
procedures remain incomplete in the current implementation.

## Consequences

An operator can use bulk import independently of benchmarking. Development
benchmarks invoke the same command interface and retain their own measurements.
The future scholarly import is an application of this capability, not a special
importer implementation. Product support waits on correctness, recovery and
scale evidence; command integration alone does not establish readiness.

## Work in progress and resumption

The service-native path supports prepared bundles, checkpoints and revision
replay checks. An isolated snapshot publisher creates current MediaWiki rows
directly, but remains per-entity work and lacks a durable publish ledger, schema
fingerprint and complete reconciliation. It is not exposed by `wbs import load`.

Local Apple-silicon Docker trials measured approximately 47 entities/s through
the service-native batched path. Direct publication reached 122/s without terms,
and 42/s on a smaller fixture using official term writers. These are not equivalent
finished imports or Linux capacity claims. Detailed measurements live in the
[import benchmark notes](../../commands/benchmark/bulk-import/README.md).

Next, reproduce a fixed-bundle trial on a provisioned Linux VPS. Compare a normal
deployment with a quiescent maintenance-only setup; both still bootstrap
MediaWiki. Verify API/RDF, normal edits, terms, recovery and derived-service
rebuilds. If sustained throughput remains inadequate, investigate a staged,
set-based database load against the same contract. Do not infer whole-stack
capacity from these publication rates.
