# Release Guide

Prepare each release in a pull request containing the implementation, versions, and changelogs. Publish only after that pull request is reviewed and merged into `main`.

WBS and each image are versioned independently according to the [WBS version policy](../../docs/versions.md) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The primary release-preparation workflow is the `wbs-dev update` interview. It gathers supported upstream updates, proposes versions, and drafts changelogs for the products being released.

## Prepare a Release

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

   The generated changes are local and unstaged: the command does not commit, tag, or push. Review them with `git diff`, including upstream comparisons, compatibility implications, version proposals, and changelog wording.

3. Make any compatibility or documentation changes identified during review, then build and test the projects in scope. Use `wbs-dev test -h` and `wbs-dev build -h` to select appropriate targets.

4. Commit the release changes. If additional product commits changed the release contents, rerun `wbs-dev update` so that its version and changelog proposals include them, then review and commit the refreshed metadata.

5. Merge the pull request into `main` after review and CI pass.

The update command can be rerun safely while preparing the release. It reconstructs each draft from the latest published tag, replaces the generated `Changes` and `Dependency updates` sections, and preserves prose outside those sections. Keep manually maintained release commentary under a separate heading. For `wbs`, it also keeps `DEPLOY_VERSION` aligned.

## Publish a Release

Run **Create a WBS Release** in GitHub Actions:

1. Select `main` and the product to release.
2. Leave **Validate and preview the release without creating tags** checked, run the workflow, and review the result.
3. Clear that checkbox and run the workflow again to publish.

Publish required images before WBS. **All projects** performs that ordering and waits for the images before publishing WBS.

The workflow rebuilds and tests image releases before publishing them. It skips existing tags, so interrupted runs can be repeated. Never move a published tag; release a correction as a new version.
