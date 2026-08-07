# 19) Publish multi-platform images {#adr_0019}

Date: 2026-08-03

## Status

Proposed

## Context

Wikibase Suite currently publishes and tests AMD64 images. We want to publish combined AMD64/ARM64 image manifests once every distributed image is verified on both architectures.

The current tooling is partially prepared:

- `wbs-dev build` forwards normal Buildx arguments, including a single `--platform=linux/arm64` target.
- Registry caches are scoped by the requested platform set.
- The shared CI setup action can opt into QEMU without adding emulation overhead to normal AMD64 jobs.
- The AMD64-only Wikimedia Composer images used by Wikibase and QuickStatements run as AMD64 intermediate stages and copy portable PHP dependencies into the target image.

## Decision

Publish `linux/amd64` and `linux/arm64` variants through the shared `wbs-dev` build path. GitHub Actions should provide only the builder, emulation or native nodes, credentials, and requested platforms rather than implement a separate build path.

This decision remains open until these steps are completed:

1. Give CI an ARM64 Buildx node or enable QEMU.
2. Build and push `linux/amd64,linux/arm64` manifests instead of using the single-platform `--load` path.
3. Verify that all final base images support both architectures and smoke-test every distributed ARM64 image.
4. Decide whether ARM64 needs the full browser test matrix or a smaller smoke suite.

## Consequences

Until this ADR is accepted, AMD64 remains the only published and tested architecture. Local single-platform builds remain supported after multi-platform publication.
