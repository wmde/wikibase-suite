# Updating Query Service (`wikibase/wdqs`)

[Back to the release guide](../../docs/release.md#1-review-image-update-policies)

Use this guide when the release refreshes Query Service.

## Automated update

The recommended workflow is:

```bash
wbs-dev update wdqs
```

The command:

1. Discovers the latest newer [`query-service-parent-*` tag](https://github.com/wikimedia/wikidata-query-rdf/tags).
2. Confirms that the matching distribution and checksum exist in the [Wikimedia package registry](https://gitlab.wikimedia.org/repos/wmf-packages/-/packages).
3. Presents the current-to-proposed tag comparison and asks whether to include the update.
4. Updates `WDQS_VERSION`, drafts the changelog, asks the operator to confirm the image version, and leaves every change unstaged for review with `git diff`.

Prefer a version already exercised in Wikidata production. Ask the upstream maintainers when storage or `RWStore.properties` compatibility is unclear.

## Manual update

The same update can be prepared manually:

1. Read the current `WDQS_VERSION` from [`build.env`](./build.env) and inspect newer [`query-service-parent-*` tags](https://github.com/wikimedia/wikidata-query-rdf/tags).
2. Select a release and compare its tag with `query-service-parent-<WDQS_VERSION>`.
3. Confirm that `service-<version>-dist.tar.gz` and its `.md5` checksum are available from the Wikimedia package registry path used by the [`Dockerfile`](./Dockerfile).
4. Set `WDQS_VERSION` to the selected version and review the resulting diff.

## Review

Check for incompatible API, configuration, Java, Blazegraph, storage, or data reload requirements.

## Choosing a version

The upstream Query Service version does not reliably indicate whether an update is breaking for this image, and major image releases have rarely been necessary. Review the upstream diff and keep the current image major unless there is a clear incompatibility in APIs, required configuration or environment variables, stored data, or operator actions. Apply the shared versioning policy to compatible changes.

## Dependencies not updated automatically

`wbs-dev update` does not select the Java or Debian images in [`build.env`](./build.env). When reviewing them:

- Keep Java 8 until Query Service's startup scripts no longer depend on the removed `PrintGCDateStamps` option, or verify and test the corresponding script changes as part of the update. Review Query Service and Blazegraph compatibility before changing the JRE.
- The JRE is copied from an Ubuntu-based Eclipse Temurin image into the Debian runtime. Confirm that this remains supported by the selected Temurin image and works on every published architecture.
- Debian Bookworm remains an intentionally conservative runtime and fetcher base. Before moving to another Debian release, verify the required `bash`, `gettext`, `curl`, certificate, user-management, and archive-fetching behavior and run the Query Service integration tests. A Debian update is not required merely because a newer stable release exists.

[Continue with testing](../../docs/release.md#3-test-and-fix)
