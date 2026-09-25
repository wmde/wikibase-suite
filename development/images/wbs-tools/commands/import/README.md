# Bulk import

Bulk import creates a fresh Wikibase from prepared native item/property JSON.
Its initial scope preserves QIDs/PIDs, creates one canonical current revision
per entity, and supports an interrupted import being resumed. It does not merge
data into an existing user-maintained wiki or reproduce source revision history.

## Implementation status

The implementation is in development and is not yet supported for valuable
production data. The service-native PHP worker boots MediaWiki once and saves
complete entities through `WikibaseRepo::getEditEntityFactory()`, including
normal edit filters and storage hooks; it does not issue one HTTP request per
entity. The current contract is a fresh, otherwise quiescent Wikibase on the
Suite MediaWiki 1.46/MariaDB stack. Keep ordinary editing disabled during
loading. The import lock coordinates importer processes, not other clients.

The current recovery code protects entity revisions, but derived-service
reconciliation remains incomplete. The direct snapshot publisher is an
additional version-pinned prototype, not a supported replacement for the
service-native path.

## Prepare

WBS Tools includes the Python runtime. Allow enough temporary disk for the input
payload in SQLite plus the final NDJSON. Preparation uses bounded SQLite cache and streams the input;
it does not load the corpus or an ID mapping into RAM. This disk-backed approach
is a correctness baseline whose throughput must also be measured at large scale.

```sh
wbs import prepare \
  --input .wbs/import/entities.ndjson \
  --output .wbs/import/bundle
```

Input is one full Wikibase item/property JSON object per line, optionally gzip
compressed. This is **not RDF, Parquet, or a dataset-selection format**. Supply
actual property entities with their datatypes.

Preparation rejects duplicate IDs and missing Q/P references in claims,
qualifiers and references. Include the supporting items or prepare an explicitly
documented subset first; the loader does not trim claims to make them fit.
External URI values, including quantity units and calendar models, are preserved
as supplied and are not rewritten into local entities. Supported local IDs are
Q/P with positive signed 32-bit numeric values. Lexemes and redirects are outside
this initial contract. Language and datatype compatibility must be checked on
the target; unsupported content fails rather than being truncated.

Nonempty sitelinks require site configuration, which this first version does
not manage. Either prepare entities without them or explicitly use
`--omit-sitelinks`; the manifest counts removed links. Source page/revision
metadata is omitted. Other unknown entity-level fields are rejected.

The output contains properties first, followed by items, ordered by numeric ID.
The manifest records SHA-256, entity/statement counts, maximum IDs, source paths,
preparation time and transformation policy. It is published only after successful
preparation. Failed preparation leaves its output directory without a manifest;
use a new output directory after fixing the source. Preserve both files together.

## Validate and load

Start the destination Suite normally. The WBS launcher runs in its checkout's
root directory and mounts that checkout at the same host path inside WBS Tools.
Keep source data, bundles and state beneath that checkout (for example
`.wbs/import/`). External paths need an explicitly mounted tools container; the
standard launcher does not mount arbitrary host directories. Run from the
Suite's Compose directory, or supply
`--compose-file` (repeat for overlays) and `--project-name`. The Docker daemon
must be able to bind the supplied absolute host paths. Use a dedicated import
account with permission to create/edit entities and sufficient rate limits.

```sh
wbs import load \
  --bundle .wbs/import/bundle \
  --state-dir .wbs/import/state \
  --user Importer --validate-only

wbs import load \
  --bundle .wbs/import/bundle \
  --state-dir .wbs/import/state \
  --user Importer
```

Validation checks the checksum and deserializes the complete input using the
target's Wikibase libraries. It writes a validation report but does not create
entities or a checkpoint. It is not a substitute for a pilot save: edit filters,
database constraints and site configuration can still reject an entity.

The same `load` command resumes. `--limit N` pauses after N entities in that
invocation; `--checkpoint-every N` sets checkpoint/report frequency (default
100). Preserve the state directory on durable storage. Resume verifies source,
target, user and software identity, then seeks directly to the saved byte offset
after checking the whole-file checksum. Previously saved entities in the crash
window are accepted only if their content, revision author and import-session
marker match; they do not get another revision. Any conflict stops the run.
Changes to entities before the checkpoint are not comprehensively re-audited;
the quiescent-target requirement remains in force throughout loading and resume.

Resume currently protects entity revisions, **not exactly-once delivery of all
derived work**. A process killed between committing a revision and running its
deferred updates can leave missing derived updates/jobs. Replaying the entity
does not recreate those hooks. Before using this on valuable data, recovery must
include a tested reconciliation/rebuild procedure for derived tables, search and
change delivery. The checkpoint-loss test below does not simulate every such
failure boundary. This is an experimental loader, not yet a crash-safe production
import facility.

The only direct write to Wikibase schema is advancing `wb_id_counters` to reserve
the maximum source IDs. This prevents subsequent API-created entities from
colliding with imported IDs. It is a version-specific implementation detail to
review before supporting another Wikibase release. Entity content, revisions,
terms and change events go through Wikibase services.

`--save-mode edit-entity` is the default and applies the ordinary Wikibase edit
wrapper. `--save-mode entity-store` is an experimental comparison mode for a
fresh, importer-owned and locked wiki only. It still creates standard MediaWiki
pages and revisions and dispatches Wikibase's `entityUpdated` event, but bypasses
request-oriented permission, rate-limit, token, conflict, edit-filter,
temporary-user and watchlist work. Do not use it on a shared or normally edited
wiki; every enabled mode must pass the post-import API, search and RDF checks.

`--commit-every N` is a service-native comparison knob. It batches database
commit/deferred-update drains while retaining ordinary Wikibase page/revision
writes; the checkpoint is always flushed before it is recorded. The default is
`1` for the conservative recovery baseline. Larger values need the same
crash-window, API/RDF and normal-edit verification as a new persistence strategy.

`--bootstrap` is a separate, initial-load-only option. It marks the one canonical
revision for each entity as silent, preventing normal RecentChanges publication.
Pair it with `WBS_DISABLE_CIRRUS_UPDATES=1` in the Wikibase service configuration to
avoid per-entity Cirrus jobs, then re-enable the setting and run CirrusSearch's
bulk index builder. It does not remove the page/revision save lifecycle or the
Wikibase change-notification hook; do not claim QLever/updater suppression until
that service's concrete hook and a full rebuild/validation path are tested.

For an authoritative-storage throughput measurement, use the disposable
`tests/integration/docker-compose.no-derived-services.yml` profile. It starts
only Wikibase and MariaDB: no Elasticsearch/Cirrus and no QLever/updater service.
The integration harness selects it with `--without-derived-services`; its checks
intentionally stop at API/RDF/current-state correctness, because search and query
services have not been constructed in that profile.

## Implementation and checks

`command.ts` registers the WBS commands. `bulk_import.py` owns preparation and
load orchestration; `ImportEntities.php` runs inside the target Wikibase image.
WBS Tools packages both runtime files beside the compiled command and stages a
content-addressed PHP copy in the shared state directory for the Docker daemon
to mount. The snapshot publisher remains an isolated development experiment and
is not exposed by `wbs import load`.

From a source checkout, build the changed WBS Tools image once with
`wbs-dev build wbs-tools`, then use `development/wbs import --help` from the
repository root (or `wbs` with `development/` on PATH). The launcher reuses an
existing local image, so rebuild after changing this implementation.

The Python controller can also be run directly during development with Python
3.11+ and Docker. Its arguments match the WBS command. Integration tests below
require Python on the host or a suitably mounted development container.
Pass `--tools-image IMAGE` to the integration harness to exercise the packaged
`wbs import load` path, including the staged PHP asset and nested Docker mounts.

```sh
python3 development/images/wbs-tools/commands/import/tests/bulk_import.test.py
python3 development/images/wbs-tools/commands/import/tests/integration/integration.py

# Local generic prepared-JSON lifecycle smoke → Wikibase/OpenSearch import,
# recovery and search indexing.
BULK_TEST_IMAGE=wikibase/wikibase:latest \
BULK_TEST_SEARCH_IMAGE=wikibase/opensearch:latest \
python3 development/images/wbs-tools/commands/import/tests/integration/integration.py --entity-count 1000
```

The integration test creates its own uniquely named Docker Compose project,
database, Wikibase and OpenSearch. It checks preserved links, one revision per
entity, partial-run resume, replay after a simulated checkpoint loss, checksum
and nonempty-target rejection, edits, fresh ID allocation, RDF export and search
reflecting a later edit. It removes only its disposable
project and volumes when finished, retaining reports in the printed temporary
directory. `--keep` retains the project for debugging. Set `BULK_TEST_IMAGE` and
`BULK_TEST_SEARCH_IMAGE` to test other already-built images. Defaults are
`wikibase/wikibase:8.1.0` and `wikibase/opensearch:1`. Prefer native-architecture
builds for local tests; emulation can exceed the test's startup/indexing timeouts.

`--entity-count N` creates a generic prepared-JSON fixture before starting the
disposable Suite stack. Its retained `smoke-result.json` contains the steady
state creation rate and post-import edit-to-search visibility time; both are
local development observations, not production performance evidence.

### Prototype verification — 2026-09-19

Automated Python checks passed, as did PHP syntax validation and the
three-entity end-to-end test above. The latter
used MariaDB 10.11 and local ARM64 images (MediaWiki 1.46):

- Wikibase: `sha256:de6e8af8a96ba1beb5d34fd714edb84ce8fd860144dfd0fff070636e1844535a`
- OpenSearch: `sha256:55629808011a3f51041eb0a0aa37b63458e48727668dde51629e32fb6c375a7e`

These are local Docker image IDs, not published registry digests. This establishes
small-fixture behavior on those builds, not release-image compatibility,
large-corpus correctness, full crash recovery, or a measured throughput target.
