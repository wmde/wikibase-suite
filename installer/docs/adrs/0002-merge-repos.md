# Wikibase Suite

This repository is the working transition home for moving Wikibase Suite Deploy out of
`wmde/wikibase-release-pipeline` and placing it beside the installer currently developed in `wmde/wbs-deploy-setup`. The intended product boundary is a focused Wikibase Suite repository containing the deployable configuration, installation tooling, and user-facing documentation for running a Wikibase Suite instance.

## Why this move is happening

`wikibase-release-pipeline` is primarily build, test, and release-pipeline tooling for
Wikibase Suite Docker images. Deploy consumes those images from Docker Hub or another
registry, but it does not need to live beside the image build pipeline.

Deploy still has two ongoing relationships with `wikibase-release-pipeline`:

- The release pipeline uses Deploy configuration as the basis for integration tests.
- Deploy consumes image tags produced by the release pipeline.

Both relationships can continue after Deploy moves. The release-pipeline test harness
should pull Deploy configuration from this repository, and Deploy should continue to use
published image tags rather than depending on the build-pipeline repository layout.

The installer belongs here because it is part of the Deploy product experience: it guides
users through configuring and launching the Wikibase Suite stack.

## Current repository shape

This repository now keeps Wikibase Suite deploy configuration at the repository root and
the installer implementation in `installer/`:

```text
.env.example
config/
docker-compose.yml
docs/
install
installer/
README.md
update-from-sources.sh
```

`update-from-sources.sh` remains in place during the transition, but the deploy files have
been flattened out of the imported `deploy/` directory.

```sh
./update-from-sources.sh
```

## Transition checklist

### Initial Setup

- [x] Create the transition repository.
- [x] Import Deploy from `wmde/wikibase-release-pipeline/deploy` into `deploy/`.
- [x] Import the installer from `wmde/wbs-deploy-setup` into `installer/`.
- [x] Preserve upstream links during transition so both source projects can still receive
  active changes.
- [x] Add a source-update script for pulling ongoing Deploy and installer changes.
- [x] Rename the imported installer directory from `install/` to `installer/`.
- [ ] Continue running `update-from-sources.sh` until the upstream Deploy and installer
  changes are settled.
- [x] Flatten `deploy/` into the repository root once source synchronization from
  `wikibase-release-pipeline/deploy` is no longer needed, including moving
  `deploy/docs/` to root `docs/`.
- [x] Update installer runtime paths for the final repository layout: root paths should point to the repository root, installer paths should point to `installer/`, cloning should target `wikibase-suite`, and local checkout detection should work from the new layout.

### Documentation Updates

- [x] Move the manual Deploy installation flow out of the root README and into its own
  documentation page as the alternate installation path.
- [x] Fold the useful content from `installer/README.md` into `docs/installation.md`, making the installer the recommended installation path and linking manual installation as the alternate path from the root README.
- [x] Update repo-local internal document links that may point at `wikibase-release-pipeline/deploy`
- [ ] In a transition branch of `wikibase-release-pipeline`, replace the old `deploy/` content with a short
	`deploy/README.md` notice that points users to the new repository.
- [x] Document migration for existing Deploy users moving from the old `wikibase-release-pipeline/deploy` checkout to the new `wikibase-suite` repository.

### Release Process Updates

- [x] Rename product from "deploy" to "wikibase-suite" in `package.json`
- [ ] Update the `wikibase-release-pipeline` release process so Deploy releases are
  derived from and tagged on the new repository location.
- [ ] Update the `wikibase-release-pipeline` integration test harness to pull Deploy
  configuration from this repository instead of reading from a local `deploy/` directory.

### Release

- [ ] Update public install instructions and any other references to the old Deploy
  location.
- [ ] Coordinate the merge of the release-pipeline transition branch with communication
  about the new Deploy and installer location.
- [ ] Announce the new repository location when the final repository shape, release
  process, and documentation links are ready.

## Open Questions

- Does the Installer need its own `package.json` so it can be versioned independent of WBS versions? If not do we move WBS versions (presumably always and only PATCH or MINOR updates) when we make Installer updates.
- Does the `wikibase-suite` repo want its own versioning scripts, tests, or GitHub Actions / release workflow?
- Installer CLI ergonomics/naming is it called `installer` or `wbs` (preferred), and if `wbs` is the installer ran as `wbs install <--args>`. And should we reconsider the root directory name for all of that including the Installer Web UI to be something other than `installer/`?
- Where should Deploy and installer development documentation live after the move? This includes ADRs, implementation notes, and other contributor-facing documentation for both the Deploy configuration and the installer. One option is to keep this material in `wikibase-release-pipeline` when it mainly concerns release engineering, CI, or image-pipeline integration. Another option is to carry relevant development documentation into this repository so product decisions and implementation context stay beside the user-facing Deploy and installer code. If it stays here, we need to decide where it belongs and how to separate contributor-facing docs from user-facing documentation.
