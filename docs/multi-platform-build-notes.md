# Multi-platform build status

The build pipeline currently publishes and tests AMD64 images. It now keeps
BuildKit cache records separate by platform and has the required hooks for a
future ARM64 build, but multi-platform publishing is not enabled yet.

## What is ready

- Application and build-tools registry caches are scoped by the requested
  platform, such as `linux-amd64`, `linux-arm64`, or
  `linux-amd64_linux-arm64`.
- The shared environment setup action can register QEMU for requested non-native
  platforms through its optional `qemu_platforms` input. Existing workflows do
  not set that input, so normal AMD64 CI pays no emulation setup cost.
- Docker Desktop provides emulation for local non-native builds. Other Docker
  installations may require QEMU/binfmt registration.
- The Wikimedia Composer builder images are AMD64-only. The Wikibase and
  QuickStatements Dockerfiles therefore run those intermediate stages as AMD64;
  they copy portable PHP dependencies into the target-platform final image.
- Build commands accept normal `docker buildx build` arguments, including a
  single target platform:

  ```bash
  ./nx build wdqs --platform=linux/arm64
  ```

## What remains

Before publishing a combined AMD64/ARM64 image:

1. Enable QEMU for ARM64 in the image-build workflow, or attach a native ARM64
   Buildx node.
2. Request both target platforms and push the manifest list to a registry. The
   current local path uses `--load`, which is intended for a single-platform
   image and is not the multi-platform publication path.
3. Confirm that every final base image still publishes both architectures.
4. Build every distributed image and smoke-test each ARM64 result. In particular,
   verify that the Composer stages have not introduced architecture-specific
   artifacts.
5. Decide whether the full browser suite should run under ARM64, or whether a
   smaller ARM64 smoke suite plus the existing AMD64 integration matrix provides
   the right confidence and runtime.

The final multi-platform workflow should continue to use the repository's
`./nx build` entry point. GitHub-specific steps should only provide the builder,
emulation, credentials, and requested platforms.
