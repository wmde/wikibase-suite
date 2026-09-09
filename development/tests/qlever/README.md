# QLever development bootstrap fixture

This document describes the development/test synchronizer fixture. Full export
and static indexing are deliberately not part of the root Suite Compose runtime
until Wikibase Suite has a supported user-facing bootstrap workflow.

`entity_graph_dump.php` bootstraps QLever with one named graph per entity. It
requests bounded chunks from the authenticated Wikibase QLever export endpoint,
stores each completed chunk durably, and resumes an interrupted export from its
last completed chunk.
`updater.php` polls Wikibase Recent Changes and performs **entity RDF
replacement** with Graph Store `PUT`: it replaces that entity's complete
N-Triples snapshot in its named graph. It does not replace anything in
Wikibase itself. QLever exposes the union of these graphs to ordinary WDQS
queries, so the existing frontend continues to work.

## Bootstrap cutover

The bootstrap records the latest Wikibase Recent Changes cursor before it
starts exporting. After QLever has indexed the dump and starts, the updater
replays every later change. An edit that happens while export or indexing is
being built is therefore not lost; replaying a snapshot already present in the
export is idempotent. Use the normal
`query-bootstrap` then `query-indexer` one-shots from the development test
overlay to perform the cutover.

The updater writes its cursor atomically to `qlever-updater-state.json`, its
health to `qlever-updater-health.json`, and observable endpoint progress to the
`urn:wikibase-suite:qlever-updater-state` graph. A failed request leaves the
cursor unchanged and uses bounded exponential retry; the next attempt safely
replaces the same entity graph again.

On startup it also verifies that the stored cursor is still within Wikibase's
Recent Changes retention window. It refuses to advance silently if history has
expired; run `reconcile_entity_graphs.php --all --repair` (then bootstrap to
establish a fresh cursor) before resuming. This makes a retention gap an
actionable failure rather than invisible stale query data.

Bootstrap is an exclusive operation. Normal `docker compose up` reuses an
existing QLever index. The export creates a shared lock only for the initial
index or an explicitly forced bootstrap; a live
updater acknowledges it and pauses, and the indexer removes it only after the
replacement index succeeds. This keeps the updater paused across both dump and
indexing, so it cannot write updates that a replacement index would erase. Do
not remove that lock manually: if indexing fails, fix it and rerun the indexer
(or repeat the full bootstrap) before allowing updates to resume. In normal
operation, stop `query-updater` and `query` before starting the dump/index
pair, then start QLever followed by the updater. To force a full bootstrap,
set `BOOTSTRAP_FORCE=true` for `query-bootstrap`; the successful dump marks the
indexer rebuild as required. The indexer clears QLever's derived persisted
update file before rebuilding, so old deltas cannot be replayed over the new
static index.

If the export one-shot is interrupted, rerun it with `BOOTSTRAP_FORCE=true`.
Its durable checkpoint makes that invocation resume at the first incomplete
chunk; do not delete the checkpoint or chunk directory when recovering.

```sh
docker compose -f docker-compose.yml -f development/tests/qlever/docker-compose.override.yml \
  run --rm query-bootstrap
docker compose -f docker-compose.yml -f development/tests/qlever/docker-compose.override.yml \
  run --rm query-indexer
```

The development fixture uses the versioned `wikibase/qlever` and
`wikibase/qlever-updater` images. The Query Service image contains the tested
default index configuration at `/etc/qlever/Qleverfile`. For an experiment
that needs a different index recipe, mount a replacement at that same path for
the `query-indexer` invocation. For native local images, build both through
the existing Bake command:

```sh
cd development
BUILD_CACHE_REGISTRY='' ./wbs-dev build qlever
BUILD_CACHE_REGISTRY='' ./wbs-dev build qlever-updater
```

The empty cache-registry setting lets Buildx use Docker's local image store.

The updater uses the Docker-internal Wikibase URL to fetch API and RDF data,
but `WIKIBASE_RDF_BASE` for the RDF subjects. The latter must be the public,
canonical Wikibase URL; in the local POC it is `https://wikibase.test`.

## Scope and limitations

This is the default Suite query-service path. Its correctness source is the
persisted Recent Changes cursor, not an event stream. Recent Changes reads the
committed MediaWiki change record and lets the updater replay safely after an
interruption; full entity-graph replacement makes that replay idempotent.
The named-graph boundary is deliberately chosen so statement, qualifier,
reference, value-node, and generated property-vocabulary RDF are replaced
together without a global `DELETE WHERE`. That prevents one changed entity
from deleting RDF associated with another entity.

Do not make MediaWiki EventStreams/EventBus a default dependency. Self-hosted
EventStreams introduces Kafka, and EventBus delivery is not atomic with a
MediaWiki edit transaction, so neither can replace Recent Changes as the
correctness source. A future stream consumer may be an optional latency
accelerator only; it must retain Recent Changes catch-up and periodic
reconciliation.

Schedule `reconcile_entity_graphs.php --all --repair` at an interval suitable
for the installation's write rate and Recent Changes retention, and monitor
the updater health file/state graph. Exercise the expired-history recovery
procedure before production rollout. The updater already persists and replays
a durable Recent Changes cursor and handles continuation across large
backlogs. Do not reintroduce filtered delete operations; this QLever version
has exhibited persisted-update corruption from them.

## Local verification

Use `wbs install --from-source` to build and start the native images. It
generates `.wbs/local-images.override.yml`; include that generated override in
subsequent manual Compose commands:

```sh
docker compose -p wbs-deploy \
	-f docker-compose.yml \
	-f .wbs/local-images.override.yml up -d
```

When testing a rebuilt updater image, recreate only that service; `--no-deps`
is important because QLever's normal dependency chain includes the static-index
one-shot services:

```sh
docker compose -p wbs-deploy \
	-f docker-compose.yml \
	-f .wbs/local-images.override.yml \
  up -d --no-deps --force-recreate query-updater
```

After QLever's static index has been built, edit an entity. Within the polling
interval, querying QLever for the entity's direct RDF or statement RDF should
return the new graph only. QLever persists the successful delta to
`wikibase.update-triples`, so the result survives a QLever restart.

Use the graph verifier to compare QLever's complete entity graph with the
current Wikibase RDF snapshot (the verifier normalizes QLever's harmless
blank-node labels and integer datatype canonicalization):

```sh
docker compose -p wbs-deploy \
	-f docker-compose.yml \
	-f .wbs/local-images.override.yml \
  exec -T query-updater verify_entity_graph.php Q1 P25
```

For a scheduled sampled reconciliation, use the same comparison with `--repair`.
It is safe to retry: repair replaces only the selected entity graphs with their
current Wikibase snapshots.

```sh
docker compose -p wbs-deploy \
	-f docker-compose.yml \
	-f .wbs/local-images.override.yml \
  exec -T query-updater reconcile_entity_graphs.php --repair Q1 P25
```

Use `--all --repair` for a full convergence sweep. It checks every current
entity and removes entity graphs that no longer exist in Wikibase.
