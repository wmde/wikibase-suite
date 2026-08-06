# Wikibase Suite (WBS) Query Service frontend Docker Image

Frontend for the [Wikidata Query Service (WDQS)](https://www.mediawiki.org/wiki/Wikidata_Query_Service).

To interact with the WDQS frontend, navigate to the URL corresponding to the port allocated for it. The full Wikibase Suite (WBS) configuration makes the frontend available at `http://localhost:8834` by default.

When writing queries using the frontend interface, click "Code" to view the corresponding URL.

For general instructions on using WDQS, building SPARQL queries, and additional resources, see:
- [Wikidata Query Service User Manual](https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual)
- [What is SPARQL](https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service)

> 💡 This image is part of [Wikibase Suite (WBS)](https://github.com/wmde/wikibase-suite/blob/main/README.md), which provides everything you need to run a Wikibase instance on your own server. For an integrated setup, see the [`docker-compose.yml` file in the full Wikibase Suite (WBS) configuration](https://github.com/wmde/wikibase-suite/blob/main/docker-compose.yml).

## Setup

### 1) Provision the supporting services and configuration

- **Memory**
    Allocate at least 2 GB of RAM to start WDQS.
- **MediaWiki/Wikibase instance**
    We recommend the [Wikibase Docker Image](https://hub.docker.com/r/wikibase/wikibase), which is the image used in our tests. Follow its setup instructions to get it running.
- **WDQS server**
    Use the [Query Service Docker Image](https://hub.docker.com/r/wikibase/wdqs).
- **WDQS updater**
    Use a second instance of the [Query Service Docker Image](https://hub.docker.com/r/wikibase/wdqs). See the [Query Service documentation](https://wikitech.wikimedia.org/wiki/Wikidata_Query_Service) to learn how to run it in updater mode.
- **Reverse proxy**
    If the WDQS frontend and Wikibase run on the same IP address, use a reverse proxy to route requests to the correct service based on the URL. The [`docker-compose.yml` file in the full Wikibase Suite (WBS) configuration](https://github.com/wmde/wikibase-suite/blob/main/docker-compose.yml) includes a reverse proxy setup using [Traefik](https://doc.traefik.io/traefik/).

### 2) Set the environment variables

Variables in **bold** are required.

| Variable                  | Default                      | Description                    |
| ------------------------- | ---------------------------- | -------------------------------|
| `LANGUAGE`                | "en"                         | Language to use in the UI      |
| **`WDQS_PUBLIC_URL`**     |                              | Hostname of the WDQS host      |
| **`WIKIBASE_PUBLIC_URL`** |                              | Public URL of the Wikibase API, for example `https://wikibase.example/w/api.php` |

## Features

### Local query examples

By default, the frontend loads query examples from the local Wikibase page `Project:SPARQL/examples`. Create that page on the Wikibase side and add examples with `<sparql>` blocks. On startup, an existing configuration that still points at Wikidata is migrated by removing that legacy setting; a deliberately configured non-Wikidata examples source is preserved.

## Internal filesystem layout

The following paths can be used to extend this image. See the [Dockerfile](./Dockerfile) for its source.

| Path                                         | Description                                |
| -------------------------------------------- | ------------------------------------------ |
| `/config/wdqs-frontend-config.json`          | Configuration file for the WDQS frontend.  |
| `/healthcheck.sh`                            | Verifies that the frontend is serving requests. |
| `/templates/nginx-default.conf.template`     | Nginx config template.                     |

## Releases

Official releases of this image can be found on [Docker Hub wikibase/wdqs-frontend](https://hub.docker.com/r/wikibase/wdqs-frontend).

See the [image changelog](./CHANGELOG.md) for release notes. Documentation at previous releases is preserved in the repository under the corresponding [`wdqs-frontend@…` tag](https://github.com/wmde/wikibase-suite/tags).

This image uses the shared tag format for WBS Docker Images. See [WBS Versions](../../docs/versions.md).

## Authors & contact

This image is maintained by the Wikibase Suite Team at [Wikimedia Germany (WMDE)](https://wikimedia.de).

If you have questions not covered above or need further help, use this [bug report form](https://phabricator.wikimedia.org/maniphest/task/edit/form/129/) to start a conversation with the engineering team.
