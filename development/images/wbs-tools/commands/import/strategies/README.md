# Import strategies

All strategies consume the same prepared `wbs-bulk-import/v1` bundle and produce
a durable run record. They differ only in how a fresh Wikibase receives its one
current entity state. This separation lets us compare throughput and correctness
without changing the sampled dataset, IDs, or downstream rebuild procedure.

## 1. Service-native importer — implemented

`../ImportEntities.php` is the baseline importer. It creates one current
MediaWiki page/revision per entity through Wikibase services. Its two save modes
are `edit-entity` (ordinary edit wrapper) and `entity-store` (controlled fresh
wiki bootstrap). `--bootstrap` suppresses normal RecentChanges publication and
the deployment can defer Cirrus updates, but persistence remains one
`PageUpdater` save per entity.

This is the implementation exposed by `wbs import load` and the correctness
reference for the other strategies. Its current scope is fresh, quiescent wikis.

## 2. Snapshot publisher — incomplete prototype

The prototype validates and canonicalizes entities with Wikibase PHP code, then
writes current MediaWiki rows directly. It still performs per-entity database
work; it is not a proven set-based SQL bulk loader. Durable staging and batched
publication with recovery are future requirements. It does not import source
history.

Before adoption, it must satisfy this contract:

- it runs only on an empty, importer-owned wiki;
- it refuses an unrecognized MediaWiki/Wikibase schema version;
- it records the source hash, schema fingerprint, generated IDs and batch
  boundaries so a failure can be diagnosed or resumed safely;
- it must produce the same API/RDF entity view as strategy 1 and permit a
  subsequent ordinary `wbeditentity` edit;
- Elasticsearch and QLever/updater state are rebuilt after publication, never
  incrementally trusted during it.

The required page/revision/content/slot invariants are derived from a
service-native reference import and tested in a disposable MariaDB stack.
The prototype can additionally use the official Wikibase term-store writers;
term lookup and any remaining index invariants must still be proven before this
strategy can publish anything outside a test wiki.
The current implementation and its deliberately incomplete prototype contract
are in [`../snapshot-publisher/`](../snapshot-publisher/README.md).

## 3. Custom live storage backend — deferred

A replacement `EntityStore`/entity-revision lookup could expose staged data
before MediaWiki revisions exist. That is a different Wikibase storage model:
normal API reads, RDF, edits, deletes, maintenance and upgrades would all depend
on it. It is not the first large-import optimization because it creates a much
larger compatibility surface than strategy 2.

## Common validation contract

Every strategy receives a prepared bundle and records separately:

1. prepared-bundle validation;
2. authoritative current-state publication;
3. Elasticsearch rebuild;
4. QLever/updater rebuild and convergence;
5. API, RDF, search, query-service and normal-edit validation.

This avoids calling an import fast merely because derived work was deferred.
