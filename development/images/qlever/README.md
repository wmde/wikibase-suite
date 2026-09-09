# Wikibase Suite QLever image

This version-pinned wrapper supplies the QLever server and static-index builder
for a Wikibase integration. Pair it with the
[`qlever-updater`](../qlever-updater/README.md) image to synchronize Wikibase
changes.

`server` is the default command. `index` rebuilds the static index from the
QLever-ready `wikibase.nq` file in `/data`, using the bundled `Qleverfile`.
Advanced deployments can mount a replacement `Qleverfile` at
`/etc/qlever/Qleverfile`.

If no index exists, `server` builds an empty index once. This is suitable for a
new, empty wiki whose future edits the updater will observe. It is not a safe
way to adopt QLever for an existing populated wiki.

`Qleverfile` controls index construction, including `STXXL_MEMORY`. The server
command controls live serving separately: `-m` is total query memory, `-c` is
the cache limit, `-e` caps an individual result, and `-k` caps cached results.
They are complementary lifecycle settings, not duplicate configuration.

## Runtime configuration

The following environment variables control the default `server` command:

| Variable | Default | Meaning |
| --- | --- | --- |
| `QLEVER_THREADS` | `2` | Query-server worker threads. |
| `QLEVER_QUERY_MEMORY` | `256M` | Total memory available to query evaluation. |
| `QLEVER_CACHE_MEMORY` | `64M` | Query cache memory limit. |
| `QLEVER_MAX_RESULT_SIZE` | `32M` | Maximum size of one query result. |
| `QLEVER_MAX_CACHED_RESULTS` | `100` | Maximum number of cached results. |

On first start, the QLever wrapper generates its private mutation token in
`/data/qlever-access-token`. The updater reads that token from the same
query-data volume; operators do not configure or copy it through `.env`.

## Internal filesystem layout

| Path | Description |
| --- | --- |
| `/data` | Persistent QLever index, update state, and internal mutation token. |
| `/data/wikibase.nq` | QLever-ready N-Quads input used by `index`. |
| `/etc/qlever/Qleverfile` | Bundled index-build configuration. |

## Releases

This image follows the shared image versioning and release process. See the
[image changelog](./CHANGELOG.md) and
[WBS Versions](../../../docs/reference/versions.md).
