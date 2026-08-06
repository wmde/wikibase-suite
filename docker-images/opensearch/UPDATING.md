# Updating OpenSearch (`wikibase/opensearch`)

[Back to the release guide](../../development/docs/release.md#1-update-images-from-upstream-sources-optional)

OpenSearch and its Wikimedia plugins form a compatibility set selected for the CirrusSearch version in Wikibase. They are updated manually.

Use this guide when the release refreshes that compatibility set.

## 1. Select and apply an update

Use the [CirrusSearch compatibility documentation](https://www.mediawiki.org/wiki/Extension:CirrusSearch) to choose the supported OpenSearch series. Select an [OpenSearch Docker Image tag](https://hub.docker.com/r/opensearchproject/opensearch/tags) and compatible `opensearch-extra` and Cirrus highlighter artifacts linked from [`build.env`](./build.env), then update all four variables together.

## 2. Review

Check CirrusSearch and Elastica compatibility, index compatibility, reindexing, JVM requirements, and removed settings.

## 3. Determine the impact

- **Patch:** a compatible update requiring no reindexing or configuration change.
- **Minor:** backward-compatible functionality or configuration.
- **Major:** an incompatible series, index, configuration, or required migration.

[Continue with testing](../../development/docs/release.md#3-test-and-fix)
