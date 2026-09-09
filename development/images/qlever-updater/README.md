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

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `WIKIBASE_URL` | `http://wikibase` | Internal Wikibase URL for the API and entity RDF. |
| `WIKIBASE_RDF_BASE` | `WIKIBASE_URL` | Canonical public base URL used in RDF subjects. |
| `WIKIBASE_ENTITY_NAMESPACES` | discovered from MediaWiki | Optional comma-separated entity namespace IDs for incremental Recent Changes polling; use for custom entity types that cannot be discovered from their content model. |
| `QLEVER_URL` | `http://query:7001` | Internal QLever Graph Store endpoint. |
| `QLEVER_ACCESS_TOKEN` | internal | Set by the image entrypoint from the shared query-data volume. Do not configure it through `.env`. |
| `QLEVER_EXPORT_TOKEN_FILE` | `/data/qlever-export-token` | Shared internal credential for the Wikibase QLever export endpoint. Created owner-writable and readable only by the bundled Wikibase web-server group. |
| `QLEVER_EXPORT_CHUNK_SIZE` | `100` | Entities requested in each resumable full-export chunk (maximum `500`). |

The updater stores its cursor and health state in `/data`, which must persist
with the QLever index. It replaces an entity's complete named graph for each
change, making replays safe.

## Internal filesystem layout

| Path | Description |
| --- | --- |
| `/data` | Shared QLever index data, updater cursor, health state, and internal credentials. |
| `/data/qlever-export-checkpoint.json` | Durable full-export cursor, high-water change cursor, and completed-chunk count. |
| `/data/qlever-export-chunks/` | Completed N-Quads chunks retained to allow an interrupted export to resume. |
| `/updater` | Updater and bootstrap programs. |

## Releases

This image follows the shared image versioning and release process. See the
[image changelog](./CHANGELOG.md) and
[WBS Versions](../../../docs/reference/versions.md).
