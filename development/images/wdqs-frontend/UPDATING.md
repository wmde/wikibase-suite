# Updating Wikibase Suite (WBS) Query Service frontend

[Back to the release guide](../../docs/release.md#prepare-a-release)

Use this guide when the release refreshes the Query Service frontend.

## Automated update

The recommended workflow is:

```bash
wbs-dev update wdqs-frontend
```

The command:

1. Resolves the latest commit from the Wikidata Query GUI `main` branch.
2. Presents the current-to-proposed commit range with a Wikimedia GitLab comparison link.
3. Asks whether to include the update.
4. Updates `WDQSQUERYGUI.commit` in [`docker-bake.hcl`](./docker-bake.hcl), drafts the changelog, asks the operator to confirm the image version, and leaves every change unstaged for review with `git diff`.

The command confirms that the branch exists, but it cannot establish compatibility with the image's local patches or configuration.

## Manual update

The same update can be prepared manually:

1. Read `WDQSQUERYGUI.commit` from [`docker-bake.hcl`](./docker-bake.hcl).
2. Resolve the head of `refs/heads/main` from the [Wikidata Query GUI repository](https://gitlab.wikimedia.org/repos/wmde/wikidata-query-gui).
3. Compare the pinned and proposed commits in Wikimedia GitLab.
4. Set `WDQSQUERYGUI.commit` to the proposed full commit hash and review the resulting diff.

## Review

Compare the commits and confirm that query behavior, configuration, and the local patches remain compatible.

## Choosing a version

Query GUI is pinned by commit rather than by an upstream release version, so determine the image version from the diff. Keep the current image major unless there is a clear breaking change—for example, a changed endpoint or a new, changed, or removed required configuration or environment variable. Apply the shared versioning policy to compatible presentation and behavior changes.

## Dependencies not updated automatically

`wbs-dev update` does not select the Node build image or nginx runtime image in [`docker-bake.hcl`](./docker-bake.hcl). When reviewing them:

- The pinned Query GUI source does not declare a Node engine or version file. Confirm a Node update by running its locked `npm ci` and Grunt build through this image rather than assuming compatibility from metadata.
- Node is used only to build the static frontend. Review build warnings and the generated output when changing it.
- For nginx updates, retain a Debian-based variant compatible with the Dockerfile's `apt` installation of `jq`, and verify the nginx configuration, entrypoint templating, static assets, health check, and every published architecture.

[Continue with release preparation](../../docs/release.md#prepare-a-release)
