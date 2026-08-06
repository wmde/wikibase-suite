# Updating Wikibase (`wikibase/wikibase`)

[Back to the release guide](../../development/docs/release.md#1-update-images-from-upstream-sources-optional)

Use this guide when the release refreshes MediaWiki or bundled extensions.

## 1. Update sources

For a MediaWiki update, set `MEDIAWIKI_VERSION` in [`build.env`](./build.env) to the target [published version](https://releases.wikimedia.org/mediawiki/), then run:

```bash
./wbs-dev update-sources wikibase
```

Use the latest stable maintenance release in the target MediaWiki release line. Moving to a new release line is a deliberate Wikibase major update.

The command updates the matching extension branches and the configured community-extension commits. It can also be run without changing MediaWiki for an extension-only refresh. Source definitions live in `development/commands/prepare/source-providers.ts`; the URLs in `build.env` remain review references.

## 2. Review

Review the MediaWiki release notes, community-extension changes, local patches, and OpenSearch compatibility.

## 3. Determine the impact

- **Patch:** a compatible MediaWiki maintenance or corrective update.
- **Minor:** backward-compatible bundled functionality.
- **Major:** a new MediaWiki line or another incompatible change.

[Continue with testing](../../development/docs/release.md#3-test-and-fix)
