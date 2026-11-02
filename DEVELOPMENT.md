# Development

This document is for people developing and testing this repository, including the Wikibase Suite Docker images and the deployment configuration in `deploy`.

## Overview

This repository contains the Wikibase Suite toolset used for [building](./build), [testing](./test), and [publishing](.github/workflows) Wikibase Suite images and the Docker Compose deployment configuration in [deploy](./deploy).

## Quick reference

### Build

```bash
# Build all Wikibase Suite images
$ ./nx build

# Build only the MediaWiki/Wikibase containers
$ ./nx build wikibase

# Build WDQS from fresh base images without reading cached layers
# (additional arguments are forwarded to `docker buildx build`)
$ ./nx build wdqs --no-cache --pull

# Update upstream commit hashes for wikibase
$ ./nx run wikibase:update-commits

# Update upstream commit hashes for all images
$ ./nx update-commits
```

### Test

```
# Show help for the test CLI, including the various options available. WDIO command line options are also supported (see https://webdriver.io/docs/testrunner/)
$ ./nx test -- --help

# Runs all test suites (defined in `test/suites`)
$ ./nx test

# Runs the `repo` test suite
$ ./nx test -- repo

# Runs the `repo` test suite with a specific spec file (paths to spec files are rooted in the `test` directory)
$ ./nx test -- repo --spec specs/repo/special-item.ts

# Start with a headed browser
$ ./nx test -- repo --headed

# Run the Query Service suite
$ ./nx test -- queryservice

# Start and leave up the test environment for a given test suite without running tests
$ ./nx test -- repo --setup
```

### Deployment configuration

For installation and maintenance of a Wikibase Suite instance, use the [Wikibase Suite documentation](./deploy/README.md). For a quick developer/tester run of the deployment configuration checked out in this repository:

```bash
$ cd deploy
$ docker compose up --wait
```

## Development setup

Development requires Git and a current Docker installation with the Compose and
Buildx plugins. Host installations of Node.js, pnpm, Nx, Python, and the linters
are not required.

Every `./nx` command builds or loads the `wbs-build-tools` image and runs Nx in
that container. The repository is mounted into the container, while image builds
and test services use the host Docker daemon. This is the same entry point used
by CI.

The first command may take longer while the build-tools image and workspace
dependencies are prepared. Subsequent commands use Docker's local BuildKit cache.
CI additionally imports and exports platform-scoped cache records in GHCR.

Optional local overrides belong in `local.env`, which `./nx` creates when it is
missing.

To rebuild the build-tools image without reading cached layers and refresh its
base image:

```bash
$ WBS_BUILD_TOOLS_NO_CACHE=true ./nx lint
```

To rebuild both the build-tools image and a product image from fresh base images:

```bash
$ WBS_BUILD_TOOLS_NO_CACHE=true ./nx build wikibase --no-cache --pull
```

To take advantage of the git hooks we've included, you'll need to configure git to use the `.githooks/` directory.

```bash
$ git config core.hooksPath .githooks
```

## Testing

Tests are organized in suites, which can be found in `test/suites`. Each suite runs a series of specs (tests) found in the `test/specs` directory. Which specs run by default in each suite are specified in the `.conf.ts` file in each suite directory under the `specs` key.

Local test suites run against the most recently built local Docker images, using
the `:latest` tag by default. CI supplies the registry and run-specific image tag.
Each suite starts only the optional service profiles it needs; for example,
Query Service, Elasticsearch, and QuickStatements are not started for the core
repo suite.

_Note: Builds are currently not performed automatically by tests. Make sure you have built against current changes before running tests. See [Build](#build) above._

You can run the tests in the Docker container locally exactly as they are run in CI by using `./nx test`.

## Example usage of `./nx test`

```bash
# See all`./nx test` CLI options
./nx test --help

# Run all test suites
./nx test -- all

# Only run a single suite (e.g., repo)
./nx test -- repo

# Only run a specific file within the setup for any test suite (e.g., repo and the Babel extension)
./nx test -- repo --spec specs/repo/extensions/babel.ts
```

There are also a few special options, useful when writing tests or in setting up and debugging the test runner:

```bash
# '--setup`: starts the test environment for the suite and leaves it running, but does not run any specs
./nx test -- repo --setup

# Sets test timeouts to 1 day so they don't time out while debugging with `await browser.debug()` calls
# However, this can have undesirable effects during normal test runs, so only use for actual debugging
# purposes.
./nx test -- repo --debug
```

WDIO test runner CLI options are also supported. See https://webdriver.io/docs/testrunner .

## Variables for testing some other instance

In order to test your own instances of the services, make sure to change the following environment variables to point at the services that should be tested:

```bash
WIKIBASE_URL=http://wikibase
WIKIBASE_CLIENT_URL=http://wikibase-client
QUICKSTATEMENTS_URL=http://quickstatements
WDQS_URL=http://query
MW_ADMIN_NAME=
MW_ADMIN_PASS=
MW_SCRIPT_PATH=/w
```

For more information on testing, see the [README](./test/README.md).

## Release and Publish Process

### Overview

Releasing WBS has three stages: prepare, review, and publish. In preparation, we branch from freshly updated `main`, move to the target MediaWiki version, refresh related upstream component versions, and run a local build/test loop until the update set is stable. We then derive WBS version bumps and changelog drafts from commit history, refine that output into final release notes, and open a release PR for team review. After approval and merge, publishing is coordinated with the Developer Advocate so announcement timing and release timing line up, then `Create Release` is run on `main` to create/push tags and trigger DockerHub image publishing.

### Release Flow

1. Prepare the release implementation changes (substantive release work):

   - create a release branch from a freshly updated `main`
     ```bash
     git checkout main
     git pull
     git checkout -b <release-branch-name>
     ```
   - update `MEDIAWIKI_VERSION` in `build/wikibase/build.env` to the target MediaWiki version
   - run `./nx update-commits` to refresh upstream commit pins across the build images (including Wikibase, WDQS, WDQS frontend, and QuickStatements) for the selected MediaWiki line:
     ```bash
     ./nx update-commits
     ```
   - build and test locally:
     ```bash
     ./nx build
     ./nx test
     ```
   - fix any breakages caused by the MediaWiki bump or dependency updates, then repeat build/test until green

2. Derive target versions locally:

   ```bash
   ./nx release version
   ```

3. Derive and refine changelog entries for each changed project:

   ```bash
   ./nx release changelog <version-from-package-json> -p <project-name> --git-commit=false --git-tag=false
   ```

   Generated changelog entries are a starting draft. Review and refine them so they accurately reflect the changes since the last release, and are useful for consolidation into release announcements.

4. Update `DEPLOY_VERSION` in `deploy/docker-compose.yml` to exactly match the version specified in `deploy/package.json`. _As a safeguard CI fails on the version reporting test if there is any divergence._

5. Once the version/changelog changes are finalized, push the release branch to GitHub and open a new PR with target branch of `main`. Once the CI tests pass on that PR, tag the "wikibase-suite" team as reviewers.

6. Once PR is reviewed and approved, merge to `main`.

7. All releases should be announced to the community before finalized, coordinate timing with the Developer Advocate BEFORE completing Step 8 below so the announcement follows the publish closely.

8. Run `Create Release` on `main`:
   - run [Create a WBS Release Action](https://github.com/wmde/wikibase-release-pipeline/actions/workflows/create_release.yml) after the release PR has been finalized, reviewed, approved, and merged
   - `dry_run=true` to audit tags only.
   - `dry_run=false` to create and push missing tags.
   - workflow behavior:
     - derives tags from committed `package.json` values (`<name>@<version>`)
     - creates only tags that do not already exist on `origin`
     - pushes tags one by one so each tag emits its own push event
   - does not run `nx release`, infer/rewrite versions, or generate changelogs
   - publishing behavior:
     - image tags (for example `wikibase@1.2.3`) trigger DockerHub publish workflows
     - `deploy@X.Y.Z` tags do not trigger DockerHub image publishing
