# Wikibase Suite QLever Updater image

This companion to the [`qlever`](../qlever/README.md) image continuously
synchronizes Wikibase entity RDF into QLever using entity-owned named graphs.
It is the incremental query synchronizer; it does not build or serve a QLever
index.

The default command polls Recent Changes, persists its cursor in `/data`, and
replaces one entity graph at a time. This makes replay safe after an updater
restart. The full-bootstrap command writes QLever-ready source data for an
index build.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `WIKIBASE_URL` | `http://wikibase` | Internal Wikibase URL for the API and entity RDF. |
| `WIKIBASE_RDF_BASE` | `WIKIBASE_URL` | Canonical public base URL used in RDF subjects. |
| `WIKIBASE_ENTITY_NAMESPACES` | discovered from MediaWiki | Optional comma-separated entity namespace IDs for a full export; use for custom entity types that cannot be discovered from their content model. |
| `QLEVER_URL` | `http://query:7001` | Internal QLever Graph Store endpoint. |
| `QLEVER_ACCESS_TOKEN` | internal | Set by the image entrypoint from the shared query-data volume. Do not configure it through `.env`. |

The updater stores its cursor and health state in `/data`, which must persist
with the QLever index. It replaces an entity's complete named graph for each
change, making replays safe.

## Internal filesystem layout

| Path | Description |
| --- | --- |
| `/data` | Shared QLever index data, updater cursor, health state, and mutation token. |
| `/updater` | Updater and bootstrap programs. |

## Releases

This image follows the shared image versioning and release process. See the
[image changelog](./CHANGELOG.md) and
[WBS Versions](../../../docs/reference/versions.md).
