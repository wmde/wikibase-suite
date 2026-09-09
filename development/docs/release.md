# Release guide

Prepare each release in a pull request containing the implementation, versions, and changelogs. Publish only after that pull request is reviewed and merged into `main`.

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
   - [WDQS (`wdqs`)](../images/wdqs/UPDATING.md)
   - [WDQS Frontend (`wdqs-frontend`)](../images/wdqs-frontend/UPDATING.md)
   - [QLever (`qlever`)](../images/qlever/UPDATING.md)
   - [QLever Updater (`qlever-updater`)](../images/qlever-updater/UPDATING.md)
   - [QuickStatements (`quickstatements`)](../images/quickstatements/UPDATING.md)
   - [OpenSearch (`opensearch`)](../images/opensearch/UPDATING.md)
   - [WBS tools (`wbs-tools`)](../images/wbs-tools/UPDATING.md)

   The generated changes are local and unstaged: the command does not commit, tag, or push. Review them with `git diff`, including upstream comparisons, compatibility implications, version proposals, and changelog wording.

   WBS release identity and its exact WBS Tools image are recorded in the checked-in `.wbs/version` manifest. Preparing WBS Tools asks whether the current WBS release should adopt the proposed image; accepting also prepares the corresponding WBS patch, while declining keeps the products independent.

3. Make any compatibility or documentation changes identified during review, then build and test the projects in scope. Use `wbs-dev test -h` and `wbs-dev build -h` to select appropriate targets.

   Each image's `docker-bake.hcl` is its authoritative build and release manifest. From an image directory, `docker buildx bake` performs a native local build and loads it into Docker; use `docker buildx bake --print` to inspect the fully evaluated definition. `wbs-dev build` composes shared cache, builder, publication, and optional `--platform` policy around the same manifest.

4. Commit the release changes. If additional product commits changed the release contents, rerun `wbs-dev update` so that its version and changelog proposals include them, then review and commit the refreshed metadata.

5. Merge the pull request into `main` after review and CI pass.

The update command can be rerun safely while preparing the release. It reconstructs each draft from the latest published tag, replaces the generated `Changes` and `Dependency updates` sections, and preserves prose outside those sections. Keep manually maintained release commentary under a separate heading.

## Publish a release

Run **Create a WBS Release** in GitHub Actions:

1. Select `main` and the product to release.
2. Leave **Validate and preview the release without creating tags** checked, run the workflow, and review the result.
3. Clear that checkbox and run the workflow again to publish.

Publish required images before WBS. **All projects** performs that ordering and waits for the images before publishing WBS.

Create Release runs the complete build and test gate once before creating any release tags. Each resulting image-tag workflow then builds and publishes only that image instead of repeating the complete matrix. Release tags should therefore be created through Create Release rather than pushed manually. Existing tags are skipped, so interrupted runs can be repeated. Never move a published tag; release a correction as a new version.

When ARM64 releases are enabled, image releases are built natively for AMD64 and ARM64 and published as one OCI image index. Each architecture is pushed by digest first; the release tags resolved from the image's `docker-bake.hcl` are created only after the required builds succeed.

The `WBS_RELEASE_ARM64` Actions repository variable controls the rollout without changing the manifests or release tooling:

- `true` builds and tests both architectures, then publishes a multi-platform release.
- Any other value builds, tests, and publishes AMD64 only. This is the temporary production fallback.

Set it under **Repository settings → Secrets and variables → Actions → Variables**. Pull-request and `main` CI remain AMD64-only regardless of this release setting; use the manually dispatched **Build and Test** workflow for one-off ARM64 confidence runs.
