# Updating OpenSearch (`wikibase/opensearch`)

[Back to the release guide](../../docs/release.md#1-review-image-update-policies)

OpenSearch and its Wikimedia plugins form a compatibility set selected for the CirrusSearch version in Wikibase.

Use this guide when the release refreshes that compatibility set.

## Automated update

OpenSearch does not yet have an automated source provider in `wbs-dev update`. The command can prepare its version and changelog, but it must not recommend or apply upstream source versions until the repository defines how to identify a compatible OpenSearch, `opensearch-extra`, and Cirrus highlighter set for the selected CirrusSearch version.

## Manual update

Prepare the compatibility set manually:

1. Read the current OpenSearch and plugin versions from [`build.env`](./build.env).
2. Use the [CirrusSearch compatibility documentation](https://www.mediawiki.org/wiki/Extension:CirrusSearch) to identify the supported OpenSearch series for the CirrusSearch version bundled with Wikibase.
3. Select an exact [OpenSearch Docker Image tag](https://hub.docker.com/r/opensearchproject/opensearch/tags) in that series.
4. Select published `opensearch-extra` and Cirrus highlighter artifacts compatible with that exact OpenSearch version using the repository links in `build.env`.
5. Update `OPENSEARCH_VERSION`, `OPENSEARCH_IMAGE_URL`, `OPENSEARCH_PLUGIN_WIKIMEDIA_EXTRA`, and `OPENSEARCH_PLUGIN_WIKIMEDIA_HIGHLIGHTER` together.
6. Review all upstream release information and the resulting `build.env` diff before building or testing the image.

## Review

Check CirrusSearch and Elastica compatibility, index compatibility, reindexing, JVM requirements, and removed settings.

## Dependencies not updated automatically

The selected OpenSearch release is itself the image's runtime base; its operating system and JVM are supplied by that upstream image rather than pinned separately here. In addition to the compatibility-set review above, inspect the selected OpenSearch image's release and security information, confirm support for every published architecture, and verify the image health check and installed plugin loading.

[Continue with testing](../../docs/release.md#3-test-and-fix)
