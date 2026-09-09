# 25) Evaluate QLever as the default Query Service {#adr_0025}

Date: 2026-09-08

## Status

proposed

## Context

Wikibase Suite currently packages the Blazegraph-based Wikidata Query Service
(WDQS). QLever is a promising replacement, but adopting it changes both the
static-index lifecycle and how Wikibase changes reach the query service.

This evaluation is motivated by the [WikiCite](https://meta.wikimedia.org/wiki/WikiCite/Shared_Citations)
initiative and the Wikidata scholarly-articles corpus. A historical analysis
put scholarly articles at about 40% of Wikidata items, while representing a
much smaller share of Query Service traffic. The concrete current initiative,
the [WikiCite/WDQS graph split](https://meta.wikimedia.org/wiki/WikiCite/WDQS_graph_split/en),
separates that scope at the Query Service layer; it does not move content out
of Wikidata. The community is also discussing a separate
[WikiCite sister project](https://meta.wikimedia.org/wiki/WikiCite_(3)). This
ADR treats independent WikiCite operation as a plausible future Wikibase
hosting scenario, not an approved migration.

Its decision lens is total cost of ownership: server footprint, query
behaviour, operational burden, and a sustainable path for future Wikibase
deployments. Earlier Wikimedia work gives us reason to test whether QLever can
improve performance and memory efficiency relative to Blazegraph at large
scale. For smaller installations, the hypothesis is that a QLever-based
complete stack could lower the practical host baseline from the commonly
provisioned 8 GB class to 4 GB, without giving up a capable, future-looking
Query Service. These are evaluation hypotheses, not sizing promises.

Wikimedia's QLever direction pairs QLever with a Kafka RDF-streaming consumer
and a larger bulk-index pipeline. WBS needs to evaluate whether QLever can
instead replace Blazegraph without adopting that full Wikidata streaming stack.

## Decision

Evaluate QLever as the prospective default Query Service for Wikibase Suite in
two phases. Do not declare QLever a released replacement for WDQS until both
phases provide sufficient operational and scale evidence.

### Evaluation questions

The POC must establish whether QLever is a viable replacement for Blazegraph in
the WBS stack without the full Wikidata streaming architecture. In particular,
it will evaluate whether the stack can:

- serve the expected Wikibase RDF query workload with a practical resource
  envelope;
- synchronize ordinary edits correctly, including replay after interruption;
- establish a complete, recoverable baseline for an existing wiki; and
- justify moving from the commonly provisioned 8 GB host class toward a 4 GB
  starting point for smaller installations, while identifying the limits of
  that claim.

### Phase 1: validate the lean QLever stack

Build and evaluate a version-pinned `qlever` server/index image and a separate
`qlever-updater` integration image. The updater will use a persisted Recent
Changes cursor, fetch the current RDF snapshot for each changed entity, and
replace that entity's named graph. Snapshot replacement makes replay safe after
an updater interruption without requiring EventStreams, EventBus, Kafka,
Airflow, or equivalent infrastructure.

The images will share persistent index and updater state, including an internal
QLever mutation token. The initial POC will cover updates, replay, deletion,
qualifiers, references, and quantity values. An empty index will be supported
only for a new, empty wiki; an existing wiki will require a separately invoked
full baseline export and index.

### Phase 2: make full indexing scalable and migratable

Replace the initial API-per-entity full bootstrap with a QLever-specific
Wikibase extension. The extension will expose an authenticated, bounded,
entity-framed RDF export endpoint. The QLever-side integration image will own
export chunks, checkpoints, index construction, and replay; WBS will compose
the services and eventually provide a guided migration workflow.

This phase will define a recovery policy for expired Recent Changes retention,
prove interruption/resume behaviour, and extend benchmarks beyond a small
fixture. Benchmark observations and raw monitor captures will remain in the
team `qlever-benchmark` workspace rather than become release-sizing promises.

## Consequences

This decision commits WBS to gathering the evidence needed to decide whether
QLever should replace Blazegraph; it does not itself adopt QLever as the
released default. A successful POC gives us grounds to make that later product
decision with evidence about correctness, operations, and cost of ownership.

Until then, the QLever images, Compose wiring, and reindex tooling remain
explicitly experimental. WBS must retain the legacy WDQS path and must not
present the POC migration procedure or preliminary hardware observations as a
supported production commitment.

## References

- [T291903: Evaluate QLever as a time-lagging SPARQL backend to offload Blazegraph](https://phabricator.wikimedia.org/T291903)
- [T281854: Baseline measurements for splitting scholarly articles from Wikidata](https://phabricator.wikimedia.org/T281854)
- [T359062: Assess Wikidata dump-import hardware](https://phabricator.wikimedia.org/T359062)
- [Wikidata Query Service architecture redesign](https://wikitech.wikimedia.org/wiki/Wikidata_Query_Service/WDQS_Architecture_re-design)
- [MediaWiki EventStreams](https://www.mediawiki.org/wiki/EventStreams)
- [MediaWiki EventBus source documentation](https://github.com/wikimedia/mediawiki-extensions-EventBus)
