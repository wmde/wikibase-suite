# Release Guide

Prepare each release in a pull request containing the implementation, versions, and changelogs. Publish only after that pull request is reviewed and merged into `main`.

WBS and each image are versioned independently according to the [WBS version policy](../../docs/versions.md), and all follow the [Semantic Versioning](https://semver.org/spec/v2.0.0.html) standard.

The `wbs-dev update` command interviews the operator about supported upstream updates, uses the repository's [versioning and commit policy](./versioning-and-commits.md) to propose release versions, and generates changelog drafts.

## Release workflow

The starting point for a release is the unreleased development work already completed for the selected products. Before releasing, consider whether to also update images from upstream sources. An image update may accompany other changes or be the purpose of the release, and may require repository changes to keep the product compatible.

### 1. Review image update policies

Before running the update interview, review the guides for images in scope:

- [Wikibase (`wikibase`)](../images/wikibase/UPDATING.md)
- [Query Service (`wdqs`)](../images/wdqs/UPDATING.md)
- [Query Service frontend (`wdqs-frontend`)](../images/wdqs-frontend/UPDATING.md)
- [QuickStatements (`quickstatements`)](../images/quickstatements/UPDATING.md)
- [OpenSearch (`opensearch`)](../images/opensearch/UPDATING.md)

### 2. Complete the product changes

Ensure that the intended development work and any compatibility changes required by image updates are complete. When WBS is in scope, update its selected image major versions and any required operating or migration documentation. For WBS tools, follow the [product-specific preparation guide](../images/wbs-tools/UPDATING.md).

### 3. Test and fix

After all intended changes are in place:

```bash
wbs-dev test
```

Fix failures and rerun the tests before continuing.

### 4. Commit the changes

Commit all release changes according to the [versioning and commit policy](./versioning-and-commits.md).

### 5. Prepare upstream updates, versions, and changelogs

```bash
wbs-dev update <project...|all>
```

For supported images, the command first offers current upstream candidates and comparison links. It then assembles upstream and Wikibase Suite changelog sections, proposes a semantic version, and asks for final confirmation before writing anything. The result is local and unstaged: the command does not commit, tag, or push. Review it with `git diff`.

The command can be rerun after testing or additional commits. It reconstructs the draft from the latest published tag, replaces the generated `Changes` and `Dependency updates` sections, and preserves prose outside those sections. Keep manually maintained release commentary under a separate heading. For `wbs`, the command also keeps `DEPLOY_VERSION` aligned.

### 6. Review and merge

Review and amend the generated versions and changelogs as needed. Commit the release metadata and merge the reviewed pull request into `main` after CI passes.

### 7. Publish

Run **Create a WBS Release** in GitHub Actions:

1. Select `main` and the product to release.
2. Leave **Validate and preview the release without creating tags** checked, run the workflow, and review the result.
3. Clear that checkbox and run the workflow again to publish.

Publish required images before WBS. **All projects** performs that ordering and waits for the images before publishing WBS.

The workflow rebuilds and tests image releases before publishing them. It skips existing tags, so interrupted runs can be repeated. Never move a published tag; release a correction as a new version.
