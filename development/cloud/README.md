# Cloud Compose proof of concept

This is a local two-tenant Compose fixture for the `wikibase-cloud` image
target. It adapts the existing WBStack MediaWiki Compose contract: a shared
MediaWiki container resolves each request domain through `api.svc` and then
uses that tenant's database and settings.

The target derives from the normal Wikibase image build. Its Cloud-only
runtime payload is under
[`development/images/wikibase/runtime-cloud/`](../images/wikibase/runtime-cloud/):
the MediaWiki 1.46-compatible WBStack configuration resolver and its internal
control-plane extension. It uses MediaWiki's bundled Vector skin with
`vector-2022` as the default, rather than Cloud's legacy Modern skin.

`CloudSettings.php` is selected through `MW_CONFIG_FILE`. On each MediaWiki
initialization it resolves the request domain—or `WBS_DOMAIN` for CLI work—via
the Platform API and applies that tenant's Cloud policy. Tenant information is
cached in APCu for up to ten seconds.

Before starting it, map both test hosts to localhost:

```
127.0.0.1 cloud1.wikibase.test cloud2.wikibase.test
```

Build the local Cloud image, then start the fixture:

```
docker buildx bake -f development/images/wikibase/docker-bake.hcl --load wikibase-cloud
docker compose -f development/cloud/compose.yml up --build
```

After the one-shot `bootstrap` service completes, visit:

- `http://cloud1.wikibase.test:5440/wiki/Main_Page`
- `http://cloud2.wikibase.test:5440/wiki/Main_Page`

The fixture creates fresh MediaWiki 1.46 schemas for two static tenants. It
does not yet exercise migration from WBStack's MediaWiki 1.43 database dumps,
Kubernetes, Query Service, or production job handling.

## Image and deployment contract

The `wikibase-cloud` target adds Cloud runtime integration and policy; the
shared image already packages every extension loaded by that policy. The
normal WBS setup is bypassed because the target selects `CloudSettings.php`
itself. Neither the Cloud build target nor its runtime payload is copied into
the normal `wikibase` target.

The current Cloud Helm chart should be able to use this image without an
entrypoint or probe change: it starts the normal web workload, probes
`/w/health.php`, supplies the Platform API, database, Redis, search, mail,
captcha, and logging variables consumed by the Cloud policy, and enables
`WBSTACK_LOAD_MW_INTERNAL=yes` only for the backend deployment.

Cloud's enabled extension set is broader than the WBS defaults. Per-wiki
configuration controls ConfirmAccount, InviteSignup, ThatSrc, WikibaseLexeme,
and OpenSearch. Missing packaged extensions are image errors, rather than
being silently skipped.

## Findings and follow-up

[Cloud image POC findings](CLOUD-IMAGE-POC-FINDINGS.md) is the living record
of architecture findings, open questions, and proposed WBS follow-up work.
