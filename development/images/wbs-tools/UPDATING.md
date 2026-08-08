# Maintaining Wikibase Suite (WBS) Tools

[Back to the release guide](../../docs/release.md#2-complete-the-product-changes)

WBS Tools is currently published for the Installer. Its shared configuration and lifecycle implementation also provides the internal `wbs configure`, `install`, `up`, `down`, `status`, and `reset` commands. Treat those commands as an unpublished foundation for possible future operational workflows, not as a supported end-user interface. See [ADR 22](../../docs/adr/0022-wbs-tools-foundation.md).

## Develop and test

The source is divided by responsibility: `commands/` defines workflows, `cli/` contains terminal interaction, `web/` contains the Installer server and client, and `lib/` contains shared configuration and lifecycle behavior.

From `development/`, run the Installer with live reload or use mock mode for UI work that must not write configuration or start services:

```bash
wbs-dev installer-dev web
wbs-dev installer-dev web --mock
wbs-dev installer-dev web --mock failure
```

Run its integration suite:

```bash
wbs-dev test wbs-tools
```

To exercise a complete installation with locally built tools and product images, run `./install --from-source` from the repository root.

## Review and release

WBS Tools is repository-owned code and has no upstream source pins or source-update interview. `wbs-dev update wbs-tools` derives its version and changelog from conventional commits.

Review changes since the latest `wbs-tools@X.Y.Z` tag. Verify the Installer, generated configuration, the mounted WBS checkout, host scripts, Docker and Compose integration, Git operations, and the internal lifecycle commands.

### Version and image selection

The release inputs are:

| Input | Purpose | Release action |
| --- | --- | --- |
| `package.json` `version` | Source of the image version, release tag, Docker tags, and changelog version. | Updated by `wbs-dev update wbs-tools`. |
| Bootstrap `WBS_TOOLS_IMAGE` default in the root `install` script | Selects the tools image before a WBS checkout exists. | Change only when the next WBS release adopts a new tools major. |
| Checkout `WBS_TOOLS_IMAGE` default in `scripts/_versions.sh` | Selects the compatible tools image after control passes to the WBS checkout. | Keep it aligned with the bootstrap default for that WBS release. |
| Docker build argument `WBS_TOOLS_VERSION` | Writes `org.opencontainers.image.version` into the image. | Supplied automatically from `package.json`; do not edit it manually. |
| Runtime override `WBS_TOOLS_IMAGE` | Selects a different image for development or verification. | Do not persist an override in a normal release. |

Publishing `X.Y.Z` also updates the mutable `X.Y` and `X` Docker tags. The OCI version label records the exact version inside the image, but the runtime does not inspect that label and the image does not self-update from it.

A WBS command uses the `WBS_TOOLS_IMAGE` selected by its checkout. It immediately uses the image when it exists locally and pulls it only when missing; it does not contact the registry to discover a newer minor or patch release. A fresh install or missing local image therefore receives the current image behind the selected major tag, while an existing cached image remains unchanged.

### WBS compatibility contract

Compatibility is currently declared in one direction: each WBS checkout selects a WBS Tools major through `scripts/_versions.sh`. The WBS Tools package and image do not declare a supported WBS version or version range, and the OCI labels record only the tools version.

Therefore, a minor or patch tools release must remain compatible with every supported WBS release that selects its major tag. Identify those WBS releases and verify their host scripts, configuration, and installation lifecycle before publishing. If a change cannot preserve that compatibility, release a new tools major and coordinate a WBS release that selects it; do not publish the change under the existing major.

## Dependencies not updated automatically

`wbs-dev update` does not select the Node base image used by the [`Dockerfile`](./Dockerfile). When changing it:

- Keep build and runtime stages on the same supported Node major, aligned with the repository Node engine and type definitions.
- Confirm that Corepack installs the pinned pnpm version and production dependencies work on the selected Alpine release.
- Test the CLI, Installer server, Docker and Compose invocation, Git operations, and every published architecture.

[Continue with testing](../../docs/release.md#3-test-and-fix)
