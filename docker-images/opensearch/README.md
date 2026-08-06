# Wikibase Suite (WBS) OpenSearch Docker Image

[OpenSearch](https://opensearch.org/) is a search engine based on the Lucene library.

This image contains the OpenSearch server with the
[org.wikimedia.search/opensearch-extra](https://central.sonatype.com/artifact/org.wikimedia.search/opensearch-extra)
and
[org.wikimedia.search.highlighter/cirrus-highlighter-opensearch-plugin](https://central.sonatype.com/artifact/org.wikimedia.search.highlighter/cirrus-highlighter-opensearch-plugin)
plugins for [Wikibase](https://wikiba.se).

This image is built from this [Dockerfile](./Dockerfile).

> 💡 This image is part of [Wikibase Suite (WBS)](https://github.com/wmde/wikibase-suite/blob/main/README.md), which provides everything you need to run a Wikibase instance on your own server. For an integrated setup, see the [`docker-compose.yml` file in the full Wikibase Suite (WBS) configuration](https://github.com/wmde/wikibase-suite/blob/main/docker-compose.yml).

## Setup

### 1) Provision the supporting services and configuration

- **MediaWiki/Wikibase instance**
    We recommend the [Wikibase Docker Image](https://hub.docker.com/r/wikibase/wikibase), which is the image used in our tests. Follow its setup instructions to get it running.

### 2) Set the environment variables

Add `ELASTICSEARCH_HOST` to the Wikibase container. This legacy variable name is retained so existing Wikibase configurations remain compatible.

## Releases

Official releases of this image can be found on [Docker Hub wikibase/opensearch](https://hub.docker.com/r/wikibase/opensearch).

See the [image changelog](./CHANGELOG.md) for release notes. Documentation at previous releases is preserved in the repository under the corresponding [`opensearch@…` tag](https://github.com/wmde/wikibase-suite/tags).

This image uses the shared tag format for WBS Docker Images. See [WBS Versions](../../docs/versions.md).

In addition to the standard tags, this image also publishes a tag that includes the bundled OpenSearch version.

| Tag | Example | Description |
| --- | --- | --- |
| os*OPENSEARCH-VERSION* | os1.3.20 | Points to the latest image release containing that OpenSearch version. |

## Authors & contact

This image is maintained by the Wikibase Suite Team at [Wikimedia Germany (WMDE)](https://wikimedia.de).

If you have questions not listed above or need help, use this [bug report
form](https://phabricator.wikimedia.org/maniphest/task/edit/form/129/) to start
a conversation with the engineering team.
