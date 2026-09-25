# Snapshot publisher prototype

`SnapshotPublishEntities.php` is the first direct current-state publisher for a
fresh Wikibase. It is intentionally isolated from `../ImportEntities.php`:
the latter remains the service-native importer and correctness baseline.

The prototype uses Wikibase PHP to deserialize and canonicalize each entity,
then writes one current MediaWiki page, text blob, content record, revision and
main slot directly. It does not import source history or invoke `PageUpdater`,
RecentChanges, entity-change notifications, Cirrus, QLever or updater work.

It is **not production-ready**. It is pinned to the observed MediaWiki 1.46
MariaDB storage layout and has no resume/recovery state yet. By default it
does not publish Wikibase term tables or other derived local indexes.
`--rebuild-terms` uses Wikibase's official item/property term-store writers to
populate the normalized term tables during publication; it still does not run
Cirrus, QLever or updater work. API entity reads, RDF export, term lookup and a
subsequent ordinary `wbeditentity` edit are necessary but not sufficient
compatibility checks.

## Prototype contract

Only run this on a disposable, fresh, importer-owned wiki:

```sh
php maintenance/run.php /opt/wbs-bulk-import/snapshot-publisher/SnapshotPublishEntities.php \
  --bundle /import/bundle --user Importer --batch-size 1000 \
  --rebuild-terms \
  --expected-mediawiki 1.46.0 --allow-unsafe-snapshot-prototype
```

The required acknowledgement and exact `MW_VERSION` gate are deliberate. Do
not point it at a user wiki, a partly populated Wikibase, or a different
MediaWiki/Wikibase image.

## Initial evidence

On the disposable Wikibase+MariaDB profile, a 1,002-entity prepared bundle was
published at 155.1 entities/s. A 10,002-entity bundle completed at 122.3
entities/s in 81.8 seconds. `wbgetentities`, `Special:EntityData/Q100.ttl` and
a subsequent normal API edit of Q100 all succeeded. The comparable
service-native batched path measured about 47 entities/s locally.

With `--rebuild-terms`, a clean 1,002-entity run completed at 42.3 entities/s;
the official term writers accounted for 11.2 of 23.7 seconds. It produced
2,001 item-term rows and one property-term row. The non-Cirrus
`wbsearchentities` API found the imported labels, and an ordinary API edit
remained successful afterward. This is a correctness checkpoint, not yet a
scale result.

## Before this becomes an import-trial candidate

1. Add a schema fingerprint and a durable, batch-level publish ledger.
2. Prove that `--rebuild-terms` gives correct term lookup and special-page
   behavior at scale, and identify any remaining derived local indexes.
3. Add a disposable integration test covering crash recovery, API/RDF, normal
   edits, ID allocation, term behavior and no unintended RecentChanges.
4. Add the explicit Elasticsearch and QLever/updater full-rebuild phases, then
   measure their convergence separately from publication.
5. Repeat at 10,000+ entities and on the target Linux host before estimating
   large-import duration.
