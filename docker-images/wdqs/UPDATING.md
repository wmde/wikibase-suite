# Updating Query Service (`wikibase/wdqs`)

[Back to the release guide](../../development/docs/release.md#1-update-images-from-upstream-sources-optional)

Use this guide when the release refreshes Query Service.

## 1. Select and apply an update

Read `WDQS_VERSION` from [`build.env`](./build.env), find newer [`query-service-parent-*` tags](https://github.com/wikimedia/wikidata-query-rdf/tags), and compare the current and proposed versions. Confirm that the matching distribution and checksum exist in the [Wikimedia package registry](https://gitlab.wikimedia.org/repos/wmf-packages/-/packages), then update `WDQS_VERSION`.

Prefer a version already exercised in Wikidata production. Ask the upstream maintainers when storage or `RWStore.properties` compatibility is unclear.

## 2. Review

Check for incompatible API, configuration, Java, Blazegraph, storage, or data reload requirements.

## 3. Determine the impact

- **Patch:** a compatible corrective, security, or performance update.
- **Minor:** backward-compatible functionality.
- **Major:** incompatible APIs, configuration, stored data, or operator actions.

[Continue with testing](../../development/docs/release.md#3-test-and-fix)
