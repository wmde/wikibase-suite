# Wikibase Suite QLever Wikidata Proxy image

This image packages the Wikimedia Foundation's
[WDQS Proxy](https://gitlab.wikimedia.org/repos/wikidata-platform/wdqs/wdqs-proxy)
as a compatibility layer in front of QLever. It forwards read-only SPARQL
requests to QLever and, while the upstream label-service branch is selected,
rewrites the WDQS-specific `SERVICE wikibase:label` syntax to standard SPARQL.

The image builds the exact upstream source commit recorded in
[`docker-bake.hcl`](./docker-bake.hcl) on its target architecture. Its runtime
layout and Java invocation match the upstream [Blubber production variant](https://gitlab.wikimedia.org/repos/wikidata-platform/wdqs/wdqs-proxy/-/blob/label_service_mark2/.pipeline/blubber.yaml).
The selected branch is intentionally the Foundation's in-progress label-service
work; `wbs-dev update` can advance the pin after review and validation. BuildKit
caches Maven dependencies separately per architecture. The upstream project is
GPL-2.0-only and its license is included in the image at
`/usr/share/licenses/wdqs-proxy/LICENSE`.

## Runtime configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `QUARKUS_REST_CLIENT_DOWNSTREAM_SPARQL_ENDPOINT_URL` | `http://qlever:7001` | Internal QLever endpoint used after query rewriting. |
| `QUERY_REWRITER_INJECT_STANDARD_PREFIXES` | `true` | Supplies standard WDQS vocabulary prefixes such as `wikibase`, `bd`, `rdfs`, `schema`, and `skos`. |
| `QUERY_REWRITER_INJECT_WIKIDATA_PREFIXES` | `false` | Disabled because Suite instances must not silently map `wd:` and `wdt:` to Wikidata. |
| `QUERY_REWRITER_MW_SPARQL_ENABLED` | `false` | Disables the Wikidata-specific mwapi rewrite. |
| `QUERY_REWRITER_PATH_SEARCH_ENABLED` | `false` | Disables QLever path-search policy until it is intentionally supported in Suite. |
| `QUERY_REWRITER_FEDERATION_ENABLED` | `false` | Disables the proxy's additional allowlist check, not federation itself. QLever enforces the endpoint allowlist. |
| `EVENTGATE_ENABLED` | `false` | Enables upstream query telemetry. Leave disabled unless an EventGate endpoint and an explicit data-handling policy have been configured. |
| `QUARKUS_REST_CLIENT_EVENTGATE_ENDPOINT_URL` | — | Required only when `EVENTGATE_ENABLED=true`; destination for upstream EventGate query telemetry. |

The selected upstream proxy branch currently registers EventGate telemetry for
every SPARQL request but has no switch to disable it. This image carries the
small patch in [`build/disable-eventgate-by-default.patch`](./build/disable-eventgate-by-default.patch)
until that capability is available upstream. When disabled, the proxy does not
post query text or request metadata to EventGate.

Federated `SERVICE` queries pass through to QLever. Configure permitted targets
with the QLever image's `QLEVER_SERVICE_ALLOWED_IRI_PREFIXES` setting, which
defaults to `https://query.wikidata.org/`. In the pinned upstream
[`QueryRewriterService`](https://gitlab.wikimedia.org/repos/wikidata-platform/wdqs/wdqs-proxy/-/blob/b675070a5dbd828beaa33cd65ab1df5f29e407a1/src/main/java/org/wikimedia/wdqs/service/QueryRewriterService.java#L88),
enabling `QUERY_REWRITER_FEDERATION_ENABLED` together with
`QUERY_REWRITER_FEDERATION_ALLOWLIST_PATH` installs a second policy check using
an upstream JSON allowlist of exact endpoint URLs. Suite currently keeps the
policy in QLever so operators have one allowlist to configure.

## Internal filesystem layout

| Path | Description |
| --- | --- |
| `/lib`, `/app`, `/quarkus`, `/quarkus-run.jar` | Upstream Quarkus application built from the Bake-pinned source; the same root layout as its Blubber production variant. |
| `/usr/share/licenses/wdqs-proxy/LICENSE` | Upstream GPL-2.0-only license text. |
| `/usr/local/bin/entrypoint.sh` | Runtime launcher. |

## Releases

This is an experimental compatibility image. It follows the shared image
versioning and release process; see the [image changelog](./CHANGELOG.md).
