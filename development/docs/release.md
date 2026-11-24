# Release guide

Prepare and review changes, versions, and changelogs in pull requests to `main`. Advance `release/wbs-X` only when the selected changes are ready to ship. Run **Create a Release** only from that release branch for both WBS and image releases.

WBS and each image are versioned independently according to the [WBS version policy](../../docs/reference/versions.md) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Prepare a release

1. Complete and commit the intended product changes according to the [versioning and commit policy](./versioning-and-commits.md).

2. Run `wbs-dev update` for the projects you intend to release. Prepare the versions and changelogs in the feature PR or in a separate release preparation PR based on `main`.

   ```bash
   wbs-dev update wikibase       # Wikibase image
   wbs-dev update wbs            # Wikibase Suite
   wbs-dev update wikibase wbs   # Both
   ```

   The command presents supported upstream update candidates and the information needed to assess them. It then proposes semantic versions and generates changelog drafts. Review the relevant image updating guides as you make those decisions and inspect the resulting changes:

   - [Wikibase (`wikibase`)](../images/wikibase/UPDATING.md)
   - [Query Service (`wdqs`)](../images/wdqs/UPDATING.md)
   - [Query Service frontend (`wdqs-frontend`)](../images/wdqs-frontend/UPDATING.md)
   - [QuickStatements (`quickstatements`)](../images/quickstatements/UPDATING.md)
   - [OpenSearch (`opensearch`)](../images/opensearch/UPDATING.md)
   - [WBS tools (`wbs-tools`)](../images/wbs-tools/UPDATING.md)

   For Wikibase, change only `MEDIAWIKI.ref` in its `docker-bake.hcl` when moving to a new MediaWiki release line. The updater resolves the commit and reads the version from that source; leave the ref unchanged for maintenance updates.

   The generated changes are local and unstaged: the command does not commit, tag, or push. Review them with `git diff`, including upstream comparisons, compatibility implications, version proposals, and changelog wording.

   WBS release identity and its exact WBS Tools image are recorded in the checked-in `.wbs/version` manifest. Preparing WBS Tools asks whether the current WBS release should adopt the proposed image; accepting also prepares the corresponding WBS patch, while declining keeps the products independent.

3. Review the generated changes and run the relevant tests. Rerun `wbs-dev update` if additional product commits change what will ship. Commit the release metadata and merge the PR into `main` after review and CI pass.

The update command can be rerun safely while preparing the release. It reconstructs each draft from the latest published tag, replaces the generated `Changes` and `Dependency updates` sections, and preserves prose outside those sections. Keep manually maintained release commentary under a separate heading.

## Promote changes to a release branch

Choose the reviewed `main` commit for the release. Advance the branch for the relevant WBS major series, such as `release/wbs-8`, once the changes, versions, and changelogs are ready to ship.

- If the release should include all changes from `main` through the chosen commit, fast-forward the release branch when possible. For a promotion pull request, use a branch pointing at the chosen commit as the head and the release branch as the base. Review the full diff and use a merge commit to preserve the history from `main`.
- If the release needs only selected changes, cherry-pick those commits from `main` into a backport pull request targeting the release branch. Check the versions and changelogs against that release line, then merge after review and CI pass.

## Publish a release

In GitHub Actions, open **Create a Release** and select the `release/wbs-X` branch you just prepared. The workflow checks the branch during preflight, including dry runs.

Enter space-separated targets such as `wikibase quickstatements`, `wbs`, or `all`. Enable **Dry run** for preflight, review the results, then run again with **Dry run** cleared to publish.

Both paths follow **preflight → build → test → publish → Git tags**, sharing preflight, build tooling, tests, and publication code. Actions distributes builds and tests across runners. Publication copies the tested images without rebuilding. Image Git tags no longer trigger builds; `wbs@…` still triggers installer publication.

For a local release, check out the promoted `release/wbs-X` commit and run the equivalent command from `development/`.

```sh
wbs-dev release wikibase quickstatements
wbs-dev release                         # all projects, including WBS
wbs-dev release all --preflight         # checks only
wbs-dev release wikibase -- --no-cache --pull
```

Local releases build the full test stack once, run all suites, then publish only selected targets. Options after `--` pass through the existing build wrapper to Docker Bake; release controls output tags and platforms. Already released project versions are skipped.

Images are staged under a unique attempt tag in `wikibase` on Docker Hub by default. Use `--staging-registry ghcr.io/OWNER/wikibase` to stage elsewhere and `--registry REGISTRY/NAMESPACE` to change the destination. Registry credentials and Git push access must be available **inside the development container**; a host Docker login alone is insufficient. Preflight and publication can also run on the host with `pnpm exec tsx wbs-dev.ts release … --preflight` or `--publish`; integration tests normally run inside the development container.

Local releases default to `linux/amd64`. Use `--platform linux/amd64,linux/arm64` with a builder and runtime capable of both architectures; each architecture is tested. Actions uses both when `WBS_RELEASE_ARM64=true`, otherwise AMD64. Registry staging avoids requiring a local multi-platform image store.

After tests pass, the local command prints a `--publish` command for retrying publication from the same images. Actions can rerun failed publication jobs. This stage trusts its caller's completed tests; it does not search earlier runs or store test receipts. Existing version tags must match the source digest and are never overwritten. `update` remains a separate preparation command.

If image publication succeeded and only the Docker Hub descriptions need to be refreshed, run **Publish Image Documentation** in GitHub Actions. Select the branch with the intended READMEs and any workflow fixes. This updates the descriptions for all images without building images or creating tags.
