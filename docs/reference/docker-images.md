# Wikibase Suite (WBS) Docker Images

Wikibase Suite (WBS) uses the following published Docker images. These images are tested together by WBS, but they can also be used independently.

- [Wikibase](../../development/images/wikibase/README.md)
- [OpenSearch](../../development/images/opensearch/README.md)
- [QLever image](../../development/images/qlever/README.md)
- [QLever Updater image](../../development/images/qlever-updater/README.md)
- [Query Service frontend](../../development/images/wdqs-frontend/README.md)
- [Legacy WDQS Query Service](../../development/images/wdqs/README.md)
- [QuickStatements](../../development/images/quickstatements/README.md)

The Dockerfiles and supporting build inputs are maintained under [`development/images`](../../development/images). See [Wikibase Suite development](../../development/README.md) if you need to build customized images.

The QLever images are currently an evaluation POC. They are not yet the
released migration path for an existing WDQS installation; see the
[QLever evaluation ADR](../../development/docs/adr/0025-evaluate-qlever-query-service.md)
for the defined scope and remaining work.

For an explanation of how the images are versioned and how they relate to WBS versions, see [WBS Versions](./versions.md).
