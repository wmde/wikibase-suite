# Updating Wikibase (`wikibase/wikibase`)

[Back to the release guide](../../docs/release.md#1-review-image-update-policies)

Use this guide when the release refreshes MediaWiki or bundled extensions.

## Automated update

The recommended workflow is:

```bash
wbs-dev update wikibase
```

The command:

1. Discovers the latest stable maintenance release in the current MediaWiki line and the newest newer stable release line, when available.
2. Asks whether to update MediaWiki, refresh extensions without changing MediaWiki, or skip Wikibase.
3. Links a proposed MediaWiki update to the release notes for that line, which contain the changes for each maintenance release.
4. Resolves every bundled Wikimedia extension to the latest commit on the selected MediaWiki `REL` branch without asking for each extension separately.
5. Resolves the configured community extensions from their development branches.
6. Presents current-to-proposed commit ranges, drafts the changelog, asks the operator to confirm the image version, and leaves every change unstaged for review with `git diff`.

Source definitions live in `development/commands/update/sources/wikibase.ts`; the URLs in [`build.env`](./build.env) remain review references. The command confirms that releases and branches exist, but it cannot establish compatibility with local patches or the OpenSearch image.

## Manual update

The same update can be prepared manually:

1. Find the available [MediaWiki releases](https://releases.wikimedia.org/mediawiki/) and decide whether to use the latest maintenance release in the current line, move to a newer stable line, or leave `MEDIAWIKI_VERSION` unchanged.
2. Set `MEDIAWIKI_VERSION` in [`build.env`](./build.env) when changing MediaWiki.
3. Derive the extension branch as `REL<major>_<minor>` from that version—for example, MediaWiki 1.46 uses `REL1_46`.
4. Resolve the head of that branch for every Wikimedia-maintained extension listed in `build.env` and update its corresponding `*_COMMIT` variable.
5. Resolve the configured branch heads for WikibaseLocalMedia, WikibaseEdtf, and WikibaseInWikitext and update their commit variables.
6. Review the MediaWiki release notes and every resulting commit range before building or testing the image.

## Review

Review the MediaWiki release notes, community-extension changes, local patches, and OpenSearch compatibility.

## Choosing a version

Treat the MediaWiki release line as a compatibility boundary. Although the second number in a MediaWiki version such as 1.46 occupies the semantic-version minor position, moving to a new line—for example, from 1.45 to 1.46—can and usually does include breaking changes for this image, so normally use a new Wikibase image major version. Within the same MediaWiki line, treat a maintenance release such as 1.46.4 to 1.46.5 as a Wikibase image minor update. Also use a minor update for backward-compatible features added locally, including a new bundled extension. Other dependency-only updates that do not change MediaWiki are usually patch updates. Any actual incompatible change still requires a major update.

## Dependencies not updated automatically

`wbs-dev update` does not select the PHP runtime or Composer build image in [`build.env`](./build.env). When reviewing them:

- Confirm that the PHP version satisfies the selected MediaWiki release's `composer.json` requirement and the requirements of the bundled extensions. MediaWiki 1.46 requires PHP 8.3 or later; do not infer that the same range applies to another MediaWiki line.
- Keep the PHP image's Debian variant compatible with the system packages and PHP extensions installed by the [`Dockerfile`](./Dockerfile).
- Treat the Wikimedia Composer image as a build dependency. Confirm that it can install the selected MediaWiki and extension dependency set; it is an AMD64-only intermediate stage and must continue to produce portable dependencies for the final image.
- Review upstream PHP, MediaWiki, and Composer image support and security information before changing a pin, then build and test every published architecture.

[Continue with testing](../../docs/release.md#3-test-and-fix)
