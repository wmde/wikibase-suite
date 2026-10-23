# Updating Wikibase Suite (WBS) Wikibase

[Back to the release guide](../../docs/release.md#prepare-a-release)

Use this guide when the release refreshes MediaWiki or bundled extensions.

## Automated update

To move to a new MediaWiki release line, change only `MEDIAWIKI.ref` in [`docker-bake.hcl`](./docker-bake.hcl) to its branch (for example, `refs/heads/REL1_47`). For a maintenance update, leave the ref unchanged. Then run:

```bash
wbs-dev update wikibase
```

The command:

1. Uses the configured `MEDIAWIKI.ref` to select the MediaWiki source branch.
2. Asks whether to refresh MediaWiki and its extensions from that branch.
3. Resolves the branch head, reads `MW_VERSION` from `includes/Defines.php` at that exact commit, and updates `MEDIAWIKI.commit` and `MEDIAWIKI.version` together. The changelog links version changes to release notes and commit changes to a source diff.
4. Resolves every bundled Wikimedia extension to the latest commit on the selected MediaWiki `REL` branch without asking for each extension separately.
5. Resolves the configured community extensions from their development branches.
6. Presents current-to-proposed commit ranges, drafts the changelog, asks the operator to confirm the image version, and leaves every change unstaged for review with `git diff`.

MediaWiki, image dependencies, image version, and tag policy live in [`docker-bake.hcl`](./docker-bake.hcl). Bundled extension sources and commits live in [`build/extensions.json`](./build/extensions.json), which is also consumed by the image build. The TypeScript provider updates both files together. The command confirms that the configured branch exists, but it cannot establish compatibility with local patches or the OpenSearch image.

The image builds from a pinned MediaWiki source checkout. Its bundled extensions, skins, and vendor submodules are fetched from GitHub mirrors. The `version` field supplies release metadata and the `mw` image tag; the updater derives it from the pinned source, so operators do not edit it separately. `repo` and `commit` select the exact build source, while `ref` tells the updater which branch to refresh.

A release branch can advance after its latest tagged tarball without changing `MW_VERSION`. Before publishing, compare the pinned commit and bundled submodule revisions with the latest release tag; the `mw` image tag reports the source version, not equivalence to the official tarball.

## Manual update

The same update can be prepared manually:

1. Find the available [MediaWiki releases](https://releases.wikimedia.org/mediawiki/) and decide whether to remain on the current release line or move to another.
2. Set `MEDIAWIKI.ref` in [`docker-bake.hcl`](./docker-bake.hcl) to the corresponding `REL<major>_<minor>` branch—for example, `refs/heads/REL1_47`.
3. Resolve that branch head and update `MEDIAWIKI.commit`; read `MW_VERSION` from `includes/Defines.php` at the resolved commit and set `MEDIAWIKI.version` to the same value.
4. Resolve the head of the same branch for every Wikimedia-maintained extension in `build/extensions.json` and update its `source.commit` value.
5. Resolve the configured branch heads for WikibaseLocalMedia, WikibaseEdtf, and WikibaseInWikitext and update their `source.commit` values.
6. Review the MediaWiki release notes and every resulting commit range before building or testing the image.

## Review

Review the MediaWiki release notes, community-extension changes, local patches, and OpenSearch compatibility.

## Choosing a version

Treat the MediaWiki release line as a compatibility boundary. Although the second number in a MediaWiki version such as 1.46 occupies the semantic-version minor position, moving to a new line—for example, from 1.45 to 1.46—can and usually does include breaking changes for this image, so normally use a new Wikibase image major version. Within the same MediaWiki line, treat a maintenance release such as 1.46.4 to 1.46.5 as a Wikibase image minor update. Also use a minor update for backward-compatible features added locally, including a new bundled extension. Other dependency-only updates that do not change MediaWiki are usually patch updates. Any actual incompatible change still requires a major update.

## Dependencies not updated automatically

`wbs-dev update` does not select the PHP runtime or Composer build image in [`docker-bake.hcl`](./docker-bake.hcl). When reviewing them:

- Confirm that the PHP version satisfies the selected MediaWiki release's `composer.json` requirement and the requirements of the bundled extensions. MediaWiki 1.46 requires PHP 8.3 or later; do not infer that the same range applies to another MediaWiki line.
- Keep the PHP image's Debian variant compatible with the system packages and PHP extensions installed by the [`Dockerfile`](./Dockerfile).
- Treat the Wikimedia Composer image as a build dependency. Confirm that it can install the selected MediaWiki and extension dependency set; it is an AMD64-only intermediate stage and must continue to produce portable dependencies for the final image.
- Review upstream PHP, MediaWiki, and Composer image support and security information before changing a pin, then build and test every published architecture.

[Continue with release preparation](../../docs/release.md#prepare-a-release)
