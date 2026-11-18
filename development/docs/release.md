# Release guide

Prepare each release in a pull request containing the implementation, versions, and changelogs. Publish only after that pull request is reviewed and merged into the branch selected for release.

WBS and each image are versioned independently according to the [WBS version policy](../../docs/reference/versions.md) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The primary release-preparation workflow is the `wbs-dev update` interview. It gathers supported upstream updates, proposes versions, and drafts changelogs for the products being released.

## Prepare a release

1. Complete and commit the intended product changes according to the [versioning and commit policy](./versioning-and-commits.md).

2. Run the update interview for the projects being released, or for all projects:

   ```bash
   wbs-dev update <project...>
   wbs-dev update all
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

3. Make any compatibility or documentation changes identified during review, then build and test the projects in scope. Use `wbs-dev test -h` and `wbs-dev build -h` to select appropriate targets.

   Each image's `docker-bake.hcl` is its authoritative build and release manifest. From an image directory, `docker buildx bake` performs a native local build and loads it into Docker; use `docker buildx bake --print` to inspect the fully evaluated definition. `wbs-dev build` composes shared cache, builder, publication, and optional `--platform` policy around the same manifest.

4. Commit the release changes. If additional product commits changed the release contents, rerun `wbs-dev update` so that its version and changelog proposals include them, then review and commit the refreshed metadata.

5. Merge the pull request into the branch selected for release after review and CI pass.

The update command can be rerun safely while preparing the release. It reconstructs each draft from the latest published tag, replaces the generated `Changes` and `Dependency updates` sections, and preserves prose outside those sections. Keep manually maintained release commentary under a separate heading.

## Publish a release

Run **Create a Release** in Actions with space-separated targets such as `wikibase quickstatements`, `wbs`, or `all`. **Dry run** performs preflight only and defaults to off.

Both paths follow **preflight → build → test → publish → Git tags**, sharing preflight, build tooling, tests, and publication code. Actions distributes builds and tests across runners. Publication copies the tested images without rebuilding. Image Git tags no longer trigger builds; `wbs@…` still triggers installer publication.

From `development/`, the equivalent local release is:

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
