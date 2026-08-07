# Updating the Wikibase Suite (WBS) Tools Docker Image (`wikibase/wbs-tools`)

[Back to the release guide](../../docs/release.md#2-complete-the-product-changes)

WBS tools is repository-owned code and has no upstream source pins or source-update interview. Its version and changelog are generated from conventional commits with `wbs-dev update wbs-tools`.

## Review

Review the application, dependencies, and Node runtime changes since the latest `wbs-tools@<version>` tag. Check compatibility with the mounted WBS checkout, the `wbs` command, generated configuration, Docker, Git, and the installer.

The WBS Tools Docker Image can be published independently. WBS selects its compatible major tag, so minor and patch tools releases become available to normal installations without a WBS release. A new tools major version requires a WBS release to select it.

## Dependencies not updated automatically

`wbs-dev update` does not select the Node base image used for both stages of the [`Dockerfile`](./Dockerfile). When reviewing it:

- Keep the build and runtime stages on the same supported Node major and keep that major aligned with the repository's Node engine and type definitions.
- Confirm that Corepack can install the pinned pnpm version and that production dependencies build and run on the selected Alpine release.
- Rebuild and test the CLI, installer server, Docker and Compose invocation, Git operations, and every published architecture after changing the base image.

[Continue with testing](../../docs/release.md#3-test-and-fix)
