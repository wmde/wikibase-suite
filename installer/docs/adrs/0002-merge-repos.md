# Move Wikibase Suite Deploy Into Wikibase Suite

This is the working transition document for moving Wikibase Suite Deploy out of `wmde/wikibase-release-pipeline` and into `wmde/wikibase-suite`, beside the installer formerly developed in `wmde/wbs-deploy-setup`.

Last updated: 2026-06-16

## Goal

Make the product boundary clear:

- `wmde/wikibase-suite` owns the deployable Wikibase Suite product: Docker Compose configuration, user-facing documentation, changelog, migration guidance, and the installer.
- `wmde/wikibase-release-pipeline` owns build, test, publish, and release tooling for Wikibase Suite Docker images.

After the move, the old `wikibase-release-pipeline/deploy` location should no longer own Deploy source code or documentation. It should keep only a short redirect notice at `deploy/README.md` for users who follow old links.

## Why This Move Is Happening

`wikibase-release-pipeline` is primarily build, test, and release-pipeline tooling for Wikibase Suite Docker images. Deploy consumes those images from Docker Hub or another registry, but it does not need to live beside the image build pipeline.

Deploy is a user-facing product: a deployable configuration for creating a Wikibase instance with companion services, plus documentation and tooling for setup, maintenance, and operations.

The installer belongs in `wikibase-suite` because it is part of the Deploy product experience: it guides users through configuring and launching the Wikibase Suite stack.

Deploy still has two ongoing relationships with `wikibase-release-pipeline`:

- The release pipeline uses Deploy configuration as the basis for integration tests.
- Deploy consumes image tags produced by the release pipeline.

Both relationships should continue after Deploy moves. The release-pipeline test harness should use Deploy configuration from `wikibase-suite`, and Deploy should continue to use published image tags rather than depending on the build-pipeline repository layout.

## Current Wikibase Suite Repository Shape

`wikibase-suite` now keeps Wikibase Suite deploy configuration at the repository root and the installer implementation in `installer/`:

```text
.env.example
CHANGELOG.md
config/
docker-compose.yml
docs/
install
installer/
package.json
README.md
```

The deploy files have been flattened out of the originally imported `deploy/` directory. `update-from-sources.sh` was used during the transition to pull ongoing Deploy and installer changes, but was removed once those sources were fully merged into this repository.

## Completed Work

- [x] Create the transition repository.
- [x] Select `wmde/wikibase-suite` as the new product repository.
- [x] Import Deploy from `wmde/wikibase-release-pipeline/deploy`.
- [x] Import the installer from `wmde/wbs-deploy-setup`.
- [x] Preserve upstream links during transition so both source projects can still receive active changes.
- [x] Add `update-from-sources.sh` for pulling ongoing Deploy and installer changes.
- [x] Rename the imported installer directory from `install/` to `installer/`.
- [x] Flatten imported Deploy files into the repository root, including moving `deploy/docs/` to root `docs/`.
- [x] Update installer runtime paths for the final repository layout.
- [x] Move the Docker Compose installation flow into the root README as the public installation path.
- [x] Fold useful installation content into the root `README.md` and keep installer implementation documentation under `installer/`.
- [x] Update repo-local internal document links that pointed at `wikibase-release-pipeline/deploy`.
- [x] Rename product metadata from `deploy` to `wikibase-suite` in root `package.json`.
- [x] Add an initial migration document for existing Deploy users moving from the old `wikibase-release-pipeline/deploy` checkout to `wikibase-suite`.
- [x] Manually compare current `wikibase-release-pipeline` Deploy documentation against flattened `wikibase-suite` documentation after source synchronization ended.
- [x] Remove `update-from-sources.sh` after source synchronization ended.
- [x] Finish the migration guide at `docs/migrating-from-wikibase-suite-deploy-to-wikibase-suite.md`; it keeps the core flow of cloning `wmde/wikibase-suite`, copying the existing `.env` and `config/` directory from the old `wikibase-release-pipeline/deploy` checkout, stopping services from the old checkout, and starting services from the new checkout. It warns existing users not to run the installer, explains that the Docker Compose project name remains `wbs-deploy` so existing containers and volumes can continue to be found, separates repository-location migration from updating to a newer version, links backup guidance, explains how to verify that existing volumes are being used, mentions `.env` secrets/file attributes/hidden files, includes recovery guidance if fresh volumes are created unexpectedly, and mentions certificate data and Traefik/Let's Encrypt volumes.
- [x] Create a transition branch from current `main` in `wmde/wikibase-release-pipeline`.
- [x] Remove old Deploy source from `wmde/wikibase-release-pipeline`, leaving only `deploy/README.md`; remove all other tracked files under `deploy/`, including compose files, `.env.example`, `package.json`, `CHANGELOG.md`, `config/`, and `docs/`.
- [x] Update release-pipeline docs and public-facing links so `wmde/wikibase-release-pipeline` is described as image build, test, publish, and release tooling, not the Deploy product home. This includes `README.md`, `DEVELOPMENT.md`, `docs/versioning.md`, `build/*/README.md`, and `build/*/dockerhub.md`. Remove or replace references to `deploy/README.md`, `deploy/docs/*`, `deploy/config/*`, `deploy/docker-compose.yml`, `deploy/package.json`, and `Wikibase Suite Deploy` as the old repo-local product location. Write the redirect notice at `deploy/README.md` in `wmde/wikibase-release-pipeline/deploy/README.md`.
- [x] Update release-process notes so Wikibase Suite releases are handled separately from image releases and tagged in the new repository location.

## Remaining Work

### Docs

- [ ] Confirm that the root README installation instructions are the correct public installation path in this new merged location.
- [ ] Confirm that docs send new installations to the root `README.md` installation section, and have clear note for those with existing installations to migrate `docs/migrating-from-wikibase-suite-deploy-to-wikibase-suite.md` before updating.
- [ ] Document Wikibase Suite release process, see "Document Wikibase Suite Release Process" ref. below

### Wikibase Release Pipeline Tests

- [ ] Update the release-pipeline integration test harness to use Deploy configuration from `wmde/wikibase-suite` instead of reading from a local `deploy/` directory. Known dependencies are `test/setup/make-test-settings.ts`, which reads `../deploy/.env.example` and `../deploy/docker-compose.yml`; `test/suites/docker-compose.override.yml`, which mounts `../../deploy/config/traefik-dynamic.yml`; `test/specs/repo/wikibase-suite-versions.ts`, which reads `deploy/package.json` and checks Deploy version parity; and `lint.sh`, which excludes `deploy/config/extensions`. Preferred starting point: CI checks out `wmde/wikibase-suite` as a sibling or known workspace path, and local tests use an environment variable such as `WIKIBASE_SUITE_PATH`. Decide the CI checkout path, whether local tests fail clearly when `WIKIBASE_SUITE_PATH` is not set and no sibling checkout exists, whether release-pipeline tests still assert `DEPLOY_VERSION`/Wikibase Suite version parity, and whether tests should only assert runtime/API consistency if the version API still exposes a deploy/suite version.

### Final Clean-up

- [ ] Remove or update lint/test exclusions that only existed because Deploy lived in `wmde/wikibase-release-pipeline`.

### Finalize and Announce Release

- [ ] Prepare public install-link updates for GitHub, Docker Hub, and any other places that currently link to `wikibase-release-pipeline/deploy`.
- [ ] Coordinate merging the release-pipeline transition branch (https://github.com/wmde/wikibase-release-pipeline/pull/931) with communication about the new Deploy and installer location.
- [ ] Announce the new repository location when the final repository shape, release process, test harness, and documentation links are ready.
- [ ] Decide whether contributor-facing transition docs and ADRs should stay under `installer/docs/adrs/`, move to another location, or be split between product and release-engineering docs.

## Ref. Document Wikibase Suite Release Process

Image releases and Wikibase Suite releases are separate release processes. Releasing images remains part of `wmde/wikibase-release-pipeline`. Releasing Wikibase Suite happens in `wmde/wikibase-suite`.

The branch and tag model is:

- `main` is the latest stable public install channel. Public installation docs point to `raw/main/install`.
- `dev` is the integration branch for the next release.
- Semantic version tags such as `7.0.0` are immutable release snapshots.

The initial Wikibase Suite release process is manual:

1. Prepare release changes on `dev` or a release branch, including the version number and changelog update.
2. Keep the branch open for review until approved.
3. Merge the tested release changes to `main`.
4. Tag the new Wikibase Suite version on `main` after merge.

A release script may be added later, but the move does not depend on one.
