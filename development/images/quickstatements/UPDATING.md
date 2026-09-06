# Updating Wikibase Suite (WBS) QuickStatements

[Back to the release guide](../../docs/release.md#prepare-a-release)

QuickStatements is built from pinned QuickStatements and MagnusTools development commits rather than published releases. QuickStatements uses MagnusTools directly but does not declare a matching MagnusTools version or commit, so the image treats the latest commit from each development branch as one update candidate.

Use this guide when the release refreshes those commits.

## Automated update

The recommended workflow is:

```bash
wbs-dev update quickstatements
```

The command:

1. Resolves the latest commits from the QuickStatements and MagnusTools `master` branches.
2. Presents both current-to-proposed commit ranges with comparison links as one update candidate.
3. Asks whether to include the paired update.
4. Downloads the proposed MagnusTools archive and calculates its SHA-256 checksum after confirmation.
5. Updates the QuickStatements and MagnusTools commits and archive checksum together in [`docker-bake.hcl`](./docker-bake.hcl).
6. Drafts the changelog, asks the operator to confirm the image version, and leaves every change unstaged for review with `git diff`.

The command confirms that both branches and the MagnusTools archive are available, but it cannot determine whether their latest commits remain compatible. Complete the review below before releasing the image.

## Manual update

The same update can be prepared manually:

1. Resolve the head of `refs/heads/master` from the [QuickStatements repository](https://github.com/magnusmanske/quickstatements) and the [MagnusTools repository](https://codeberg.org/magnusmanske/magnustools).
2. Set `QUICKSTATEMENTS.commit` and `MAGNUSTOOLS.commit` in [`docker-bake.hcl`](./docker-bake.hcl) to those full commit hashes.
3. Download `https://codeberg.org/magnusmanske/magnustools/archive/<MAGNUSTOOLS_COMMIT>.tar.gz` and calculate its SHA-256 checksum using `sha256sum` or `shasum -a 256`.
4. Set `MAGNUSTOOLS.archive_sha256` to that checksum.
5. Review the resulting `docker-bake.hcl` diff before building or testing the image.

## Review

Compare both commit ranges, including any interaction between the two repositories. Check user workflows, OAuth, Wikibase API, configuration, PHP dependencies, and runtime changes.

## Choosing a version

QuickStatements source updates are usually small and remain compatible with the current image major version. Keep that major unless the upstream diff or an image change clearly breaks the existing contract—for example, by changing required configuration or environment variables, authentication, API behavior, or user workflows. Apply the shared versioning policy to compatible changes.

## Dependencies not updated automatically

`wbs-dev update` does not select the PHP runtime or Composer build image in [`docker-bake.hcl`](./docker-bake.hcl). When reviewing them:

- Confirm that the PHP runtime satisfies the pinned QuickStatements `composer.json` requirement and supports the PHP extensions installed by the [`Dockerfile`](./Dockerfile). The currently pinned QuickStatements source requires PHP 8.1 or later; recheck the upstream file when the source pin changes.
- Confirm that the Composer image can install the pinned QuickStatements dependency set. It is an AMD64-only intermediate stage and must continue to produce portable dependencies for the final image.
- Keep the PHP image's Debian variant compatible with the packages installed by the Dockerfile, and build and test every published architecture after changing either image.

[Continue with release preparation](../../docs/release.md#prepare-a-release)
