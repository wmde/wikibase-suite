# Cloud Compose POC

This is a local two-tenant Compose fixture for the `wikibase-cloud` image
target. It adapts the existing WBStack MediaWiki Compose contract: a shared
MediaWiki container resolves each request domain through `api.svc` and then
uses that tenant's database and settings.

Related documents:

- [ADR 25: Shared Wikibase application image for Suite and Cloud](../../../docs/adr/0025-shared-wikibase-application-image.md)
  covers the POC's proposal, objectives, architecture, and remaining questions.
- [The MediaWiki 1.46 adaptation review](docs/mw146-adaptation.md) compares the
  WBStack-derived runtime code packaged into the `wikibase-cloud` image with
  its recorded upstream revision. It includes a [semantic diff](docs/mw146-adaptation.diff).

## Build and run the fixture

Before starting it, map both test hosts to localhost:

```
127.0.0.1 cloud1.wikibase.test cloud2.wikibase.test
```

Build the local Cloud image with either Docker Bake directly:

```
docker buildx bake -f development/images/wikibase/docker-bake.hcl --load wikibase-cloud
```

or the WBS development command, which achieves the same:

```
wbs-dev build wikibase --load wikibase-cloud
```

Then start the fixture:

```
docker compose -f development/images/wikibase/cloud-poc/compose.yml up --build
```

After the one-shot `bootstrap` service completes, visit:

- `http://cloud1.wikibase.test:5440/wiki/Main_Page`
- `http://cloud2.wikibase.test:5440/wiki/Main_Page`

The fixture creates fresh MediaWiki 1.46 schemas for two static tenants. It is
for local POC use; its scope and remaining integration work are recorded in the
ADR.
