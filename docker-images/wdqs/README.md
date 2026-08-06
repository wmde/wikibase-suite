# Wikibase Suite (WBS) Query Service Docker Image

The [Wikidata Query Service (WDQS)](https://www.mediawiki.org/wiki/Wikidata_Query_Service) provides a way for tools to access Wikibase data, via a SPARQL API. It is based on [Blazegraph](https://github.com/blazegraph/database/wiki/Main_Page).

> 💡 This image is part of [Wikibase Suite (WBS)](https://github.com/wmde/wikibase-suite/blob/main/README.md), which provides everything you need to run a Wikibase instance on your own server. For an integrated setup, see the [`docker-compose.yml` file in the full Wikibase Suite (WBS) configuration](https://github.com/wmde/wikibase-suite/blob/main/docker-compose.yml).

## Setup

### 1) Provision the supporting services and configuration

- **Memory**
    Allocate at least 2 GB of RAM to start WDQS.
- **MediaWiki/Wikibase instance**
    We recommend the [Wikibase Docker Image](https://hub.docker.com/r/wikibase/wikibase), which is the image used in our tests. Follow its setup instructions to get it running.
- **WDQS server**
    Run one instance of this image with `/runBlazegraph.sh` to start the WDQS daemon. Send `GET` requests containing your SPARQL query to `http://wdqs:9999/bigdata/namespace/wdq/sparql?query={SPARQL}`.
- **WDQS updater**
    Run a second instance of this image with `/runUpdate.sh` to poll changes from Wikibase.
- **Reverse proxy**
    Use a reverse proxy for public-facing setups. By default, WDQS exposes endpoints and methods that may reveal internal details or functionality. The [`docker-compose.yml` file in the full Wikibase Suite (WBS) configuration](https://github.com/wmde/wikibase-suite/blob/main/docker-compose.yml) includes a Traefik proxy that limits the functionality WDQS exposes.

### 2) Set the environment variables

Variables in **bold** are required.

| Variable                   | Default    | Description                                                                                                                                                                                                                                                               |
| -------------------------  | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`WIKIBASE_HOST`**        | "wikibase" | Hostname to reach the Wikibase service, e.g. the docker network internal hostname                                                                                                                                                                                         |
| **`WIKIBASE_CONCEPT_URI`** | ""         | Concept URI, required for `/runUpdate.sh` only, the identifying prefix to entities in this knowledge graph, e.g. the public URL of the Wikibase host.                                                                                                                     |
| **`WDQS_HOST`**            | "wdqs"     | WDQS hostname (this service)                                                                                                                                                                                                                                              |
| **`WDQS_PORT`**            | "9999"     | WDQS port (this service)                                                                                                                                                                                                                                                  |
| `WIKIBASE_SCHEME`          | "http"     | URL scheme used to reach the Wikibase service, e.g. http to reach a local wikibase on the same docker network                                                                                                                                                             |
| `WDQS_ENTITY_NAMESPACES`   | "120,122"  | Wikibase namespaces to load data from                                                                                                                                                                                                                                     |
| `WIKIBASE_MAX_DAYS_BACK`   | "90"       | Maximum number of days updater can reach back in time from now                                                                                                                                                                                                            |
| `MEMORY`                   | ""         | Memory limit for Blazegraph                                                                                                                                                                                                                                               |
| `HEAP_SIZE`                | "1g"       | Heap size for Blazegraph                                                                                                                                                                                                                                                  |
| `BLAZEGRAPH_EXTRA_OPTS`    | ""         | Extra options to be passed to Blazegraph; they must be prefixed with `-D`. Example: `-Dhttps.proxyHost=http://my.proxy.com -Dhttps.proxyPort=3128`. See [the WDQS User Manual](https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual#Configurable_properties). |

## Upgrading

When upgrading between WDQS versions, the data stored in `/wdqs/data` may not be compatible with the newer version. When testing the new image, if no data appears to have been loaded into the Query Service, you'll need to reload the data.

If all changes still appear in RecentChanges, removing `/wdqs/data` and restarting the service should reload all data.

However, RecentChanges are periodically purged of older entries, as determined by the MediaWiki configuration [\$wgRCMaxAge](https://www.mediawiki.org/wiki/Manual:$wgRCMaxAge).

If you can't use RecentChanges, you'll need to reload from an RDF dump:

- [Make an RDF dump from your Wikibase repository using the dumpRdf.php maintenance script.](https://doc.wikimedia.org/Wikibase/master/php/docs_topics_rdf-binding.html)
- [Load the RDF dump into the Query Service](https://github.com/wikimedia/wikidata-query-rdf/blob/master/docs/getting-started.md#load-the-dump)

## Features

### Empty-store updater initialization

Before starting, `/runUpdate.sh` checks whether WDQS contains any entities. When WDQS is empty, it initializes the updater checkpoint from the beginning of the UTC day containing the oldest available RecentChanges entry in the configured Wikibase entity namespaces. This allows a freshly installed or previously affected instance to leave a restart loop and import all entities still represented in RecentChanges. If there are no retained RecentChanges entries, it initializes the checkpoint at the beginning of the current UTC day.

The initialization is guarded: if WDQS contains an entity, or if either service check fails or returns an unexpected response, the updater starts normally without changing its checkpoint. Entities no longer represented in RecentChanges require a full reload as described in [Upgrading](#upgrading).

## Internal filesystem layout

The following paths can be used to extend this image. See the [Dockerfile](./Dockerfile) for its source.

| Path                         | Description                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `/wdqs/allowlist.txt`        | SPARQL endpoints allowed for federation                                                        |
| `/wdqs/RWStore.properties`   | Properties for the service                                                                     |
| `/templates/mwservices.json` | Template for MediaWiki services (populated and placed into `/wdqs/mwservices.json` at runtime) |

## Releases

Official releases of this image can be found on [Docker Hub wikibase/wdqs](https://hub.docker.com/r/wikibase/wdqs).

See the [image changelog](./CHANGELOG.md) for release notes. Documentation at previous releases is preserved in the repository under the corresponding [`wdqs@…` tag](https://github.com/wmde/wikibase-suite/tags).

This image uses the shared tag format for WBS Docker Images. See [WBS Versions](../../docs/versions.md).

In addition to the standard tags, this image also publishes a tag that includes the bundled WDQS version.

| Tag | Example | Description |
| --- | --- | --- |
| wdqs*WDQS-VERSION* | wdqs0.3.156 | Points to the latest image release containing that WDQS version. |

## Authors & contact

This image is maintained by the Wikibase Suite Team at [Wikimedia Germany (WMDE)](https://wikimedia.de).

If you have questions not listed above or need help, use this [bug report form](https://phabricator.wikimedia.org/maniphest/task/edit/form/129/) to start a conversation with the engineering team.
