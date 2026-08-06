# Release Guide

Prepare each release in a pull request containing the implementation, versions, and changelogs. Publish only after that pull request is reviewed and merged into `main`.

WBS and each image are versioned independently according to the [WBS version policy](../../docs/versions.md), and all follow the [Semantic Versioning](https://semver.org/spec/v2.0.0.html) standard.

The `./wbs-dev update-versions` command uses the repository's [versioning and commit policy](./versioning-and-commits.md) to determine the next release version and generate changelog entries.

## Release workflow

The starting point for a release is the unreleased development work already completed for the selected products. Before releasing, consider whether to also update images from upstream sources. An image update may accompany other changes or be the purpose of the release, and may require repository changes to keep the product compatible.

### 1. Update images from upstream sources (optional)

To update one or more images from upstream sources, follow the corresponding guides:

- [Wikibase (`wikibase`)](../../docker-images/wikibase/UPDATING.md)
- [Query Service (`wdqs`)](../../docker-images/wdqs/UPDATING.md)
- [Query Service frontend (`wdqs-frontend`)](../../docker-images/wdqs-frontend/UPDATING.md)
- [QuickStatements (`quickstatements`)](../../docker-images/quickstatements/UPDATING.md)
- [OpenSearch (`opensearch`)](../../docker-images/opensearch/UPDATING.md)

### 2. Complete the product changes

Ensure that the intended development work and any compatibility changes required by image updates are complete. When WBS is in scope, update its selected image major versions and any required operating or migration documentation. For WBS tools, follow the [product-specific preparation guide](../../docker-images/wbs-tools/UPDATING.md).

### 3. Test and fix

After all intended changes are in place:

```bash
./wbs-dev test
```

Fix failures and rerun the tests before continuing.

### 4. Commit the changes

Commit all release changes according to the [versioning and commit policy](./versioning-and-commits.md).

### 5. Generate versions and changelogs

```bash
./wbs-dev update-versions <project...|all>
```

This makes local working-tree changes only: it does not stage, commit, tag, or push anything. Review the result with `git diff`. For `wbs`, it also keeps `DEPLOY_VERSION` aligned. An existing higher version is not reduced, and a manually written unreleased changelog entry is preserved.

### 6. Review and merge

Review and amend the generated versions and changelogs as needed. Commit the release metadata and merge the reviewed pull request into `main` after CI passes.

### 7. Publish

Run **Create a WBS Release** in GitHub Actions:

1. Select `main` and the product to release.
2. Leave **Validate and preview the release without creating tags** checked, run the workflow, and review the result.
3. Clear that checkbox and run the workflow again to publish.

Publish required images before WBS. **All projects** performs that ordering and waits for the images before publishing WBS.

The workflow rebuilds and tests image releases before publishing them. It skips existing tags, so interrupted runs can be repeated. Never move a published tag; release a correction as a new version.
