# Wikibase Suite QLever Updater image

This companion to the [`qlever`](../qlever/README.md) image continuously
synchronizes Wikibase entity RDF into QLever using entity-owned named graphs.
It is the incremental query synchronizer; it does not build or serve a QLever
index.

The default command polls Recent Changes, persists its cursor in `/data`, and
replaces one entity graph at a time. This makes replay safe after an updater
restart. The full-bootstrap command requests bounded RDF chunks from the
Wikibase QLever export endpoint, resumes from completed chunks after an
interruption, and writes QLever-ready source data for an index build.

## Foundation RDF transformation

The updater is a Java application built around Wikimedia Foundation's
[`Munger`](https://gitlab.wikimedia.org/repos/wikidata-platform/wdqs/wdqs-common/-/blob/v0.1.0/src/main/java/org/wikidata/query/rdf/tool/rdf/Munger.java),
from Foundation WDQS Common.
It uses the Munger for both full export and incremental entity replacement, so
the RDF that QLever receives follows the Foundation's WDQS representation.

The Foundation release tag and immutable source revision are recorded in
[`docker-bake.hcl`](./docker-bake.hcl). The image consumes the corresponding
published `wdqs-common` JAR and packages the updater with its required RDF
runtime closure. It deliberately excludes Kafka, Jetty, Blazegraph, and other
streaming-updater dependencies. The QLever integration suite exercises the
transformation through full export and incremental updates.

For troubleshooting, the same transform is available as a command:

```sh
docker compose exec -T wdqs-qlever-updater \
  java -jar /updater/wdqs-qlever-updater.jar transform Q1 https://example.test < entity.nt
```

It reads N-Triples from standard input and writes the transformed N-Triples to
standard output.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `WIKIBASE_URL` | `http://wikibase` | Internal Wikibase URL for the API and entity RDF. |
| `WIKIBASE_RDF_BASE` | `WIKIBASE_URL` | Canonical public base URL used in RDF subjects. |
| `WIKIBASE_ENTITY_NAMESPACES` | discovered from MediaWiki | Optional comma-separated entity namespace IDs for incremental Recent Changes polling; use for custom entity types that cannot be discovered from their content model. |
| `QLEVER_URL` | `http://qlever:7001` | Internal QLever Graph Store endpoint. |
| `QLEVER_ACCESS_TOKEN` | internal | Set by the image entrypoint from the shared query-data volume. Do not configure it through `.env`. |
| `QLEVER_EXPORT_TOKEN_FILE` | `/data/qlever-export-token` | Shared internal credential for the Wikibase QLever export endpoint. Created owner-writable and readable only by the bundled Wikibase web-server group. |
| `QLEVER_EXPORT_CHUNK_SIZE` | `100` | Entities requested in each resumable full-export chunk (maximum `500`). |
| `JAVA_TOOL_OPTIONS` | `-Xms16m -Xmx128m` | JVM memory settings for the updater; override only for a deliberately larger export workload. |

The updater stores its cursor and health state in `/data`, which must persist
with the QLever index. It replaces an entity's complete named graph for each
change, making replays safe.

## Internal filesystem layout

| Path | Description |
| --- | --- |
| `/data` | Shared QLever index data, updater cursor, health state, and internal credentials. |
| `/data/qlever-export-checkpoint.json` | Durable full-export cursor, high-water change cursor, and completed-chunk count. |
| `/data/qlever-export-chunks/` | Completed N-Quads chunks retained to allow an interrupted export to resume. |
| `/data/qlever-bootstrap.lock` | Excludes concurrent exporters and pauses the updater until indexing succeeds. The indexer removes this marker. |
| `/data/qlever-update.lock` | Advisory lock serializing incremental writes with export and cursor publication. Its presence alone does not indicate a held lock. |
| `/updater` | Java updater JAR and its entrypoint. |

## Releases

This image follows the shared image versioning and release process. See the
[image changelog](./CHANGELOG.md) and
[WBS Versions](../../../docs/reference/versions.md).
