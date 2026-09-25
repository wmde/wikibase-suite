# Wikibase Suite (WBS) Development

This directory contains the build, test, update, and release tooling for Wikibase Suite. It is for contributors and advanced users building customized images; installing and operating published WBS releases is documented from the [repository root](../README.md). For all development documentation, see the [development documentation index](./docs/README.md).

## Getting started

1. Install Git and a supported Docker environment: Docker Engine 22.0 or later, Docker Compose 2.10 or later, and the Buildx plugin. Node.js, pnpm, Python, and the repository linters do not need to be installed on the host.

   Confirm that each Docker component is available:

   ```bash
   docker --version
   docker compose version
   docker buildx version
   ```

2. Add the checkout's `wikibase-suite/development` directory to your shell's `PATH`. This makes both `wbs-dev` and the development version of `wbs` available from any working directory:

   ```bash
   export PATH="$PATH:/path/to/wikibase-suite/development"
   ```

   Add that line, with the absolute path to your checkout, to your shell configuration to keep it across sessions. Without changing `PATH`, run commands as `./wbs-dev` and `./wbs` from `wikibase-suite/development`, or as `development/wbs-dev` and `development/wbs` from the repository root.

3. For manual testing, map the local Suite domains in `/etc/hosts`:

   ```text
   127.0.0.1 wikibase.test query.wikibase.test
   ```

4. Get familiar with the two command interfaces:

   ```bash
   wbs-dev -h
   wbs -h
   ```

   Use `wbs-dev` to build, test, lint, prepare updates, and make releases. Use `wbs` to configure and operate a Suite instance from the checkout. Every subcommand has its own help, for example `wbs-dev test -h` or `wbs up -h`.

## Development cycle

Make changes in the checkout, then use the relevant `wbs-dev` commands to build, test, and lint them:

```bash
wbs-dev build all
wbs-dev test all
wbs-dev lint
```

The command help describes the available projects, test suites, and options. Commit completed work according to the [versioning and commit policy](./docs/versioning-and-commits.md).

Every image directory contains an authoritative `docker-bake.hcl`. Running `docker buildx bake` there builds and loads the native local image with its `latest` tag, while `docker buildx bake --print` shows the resolved definition without building. Use `wbs-dev build` when you want the shared cache, CI publication, parallelism, or optional platform handling.

The WBS DevTools image follows the same convention with `development/docker-bake.hcl`: run `docker buildx bake` from `development/` for a direct local build. The `wbs-dev` launcher uses that manifest too, adding the shared cache policy and rebuilding only when its image inputs change.

`wbs-dev build --list=json` and `wbs-dev test --list=json` expose the same convention-based target lists used by CI. Omit `=json` for a human-readable list.

With no targets in an interactive terminal, `build` and `test` present a target picker; press `a` to toggle every target. Non-interactive calls require explicit target names or `all`.

WBS Tools is the one workspace-aware exception: its direct Bake build asks you to approve read access to the shared `development/` lockfile and package metadata. Confirm the Buildx prompt, or use `wbs-dev build wbs-tools`, which grants that exact path automatically.

To run and manually test a complete Suite built from the checkout, use its normal lifecycle commands:

```bash
wbs up --build
```

If `.env` is absent or incomplete, `wbs up` directs you to run `wbs install`. Use `wbs reset` when you need to reset the local instance; see the [reset documentation](../docs/operate/reset.md) for exactly what it can remove.

When an image or WBS itself is ready for release preparation, run the update interview for the relevant projects or for all projects:

```bash
wbs-dev update <project...>
wbs-dev update all
```

The command checks supported upstream dependencies, proposes release versions, and generates changelog drafts as unstaged changes for review. For more information on using `wbs-dev update` in addition to the full release workflow see the [release guide](./docs/release.md).

## Benchmarking and bulk import

`wbs-dev benchmark` owns corpus preparation, importer throughput experiments and
resource collection on existing Suite installations. See the
[benchmark command guide](commands/benchmark/README.md) for the working commands
and the remaining workload/capacity work.

`wbs import prepare/load` is the separate operator capability for loading a
fresh Wikibase. Its implementation and correctness tests live in
[WBS Tools' import command](images/wbs-tools/commands/import/README.md).
It remains in development; full recovery and derived-service reconciliation
must be completed before production support.

Architecture and resumption points: [bulk import ADR](docs/adr/0025-bulk-import-capability.md)
and [benchmark ADR](docs/adr/0026-reproducible-suite-capacity-benchmarks.md).

## Developing the browser installer

The installer begins with a host-side bootstrap script that checks the environment, obtains the selected WBS checkout and tools image, and then delegates configuration and installation to the containerized WBS Tools application. See the [WBS Tools image overview](./images/wbs-tools/README.md) for its scope and architecture.

For browser UI development, `wbs-dev` provides a dedicated local harness. It starts the installer from the current checkout with live reload, without requiring an already running Suite instance:

```bash
wbs-dev installer-dev web
```

This uses local test domains and the normal host launch scripts, so completing the installer performs a real local Suite installation.

For UI and UX work that should not write configuration or start Suite services, use mock mode:

```bash
wbs-dev installer-dev web --mock
```

Mock mode uses the same live development server, makes the progress steps clickable, and runs normal form validation. Starting installation emits an accelerated, realistic installation log through the completed screen, but does not write configuration, signal the host launch scripts, or start Suite services.

## Local overrides

Put optional development-tooling overrides in `development/local.env`; `wbs-dev` creates the file when it is missing. Test defaults come from the root `.env.example`, `development/tests/test-services.env`, and `development/tests/test-runner.env`.

Two particularly useful test overrides are:

- `WBS_TEST_MAX_INSTANCES`

  Some integration suites use up to three parallel browser workers and Selenium instances to run efficiently in GitHub Actions. If tests are slow or exhaust CPU or memory on your machine, set this to `1`. The setting can reduce, but never increase, a suite's configured concurrency.

- `WBS_TEST_HEADED`

  Browser tests run headlessly by default for speed. Set this to `true`, or pass `--headed` to `wbs-dev test`, to watch them run. Each test suite prints the URL to open in your browser, which is also a useful way to see what that suite exercises.

See the [integration test guide](./tests/README.md) for test suites, exploratory test environments, and other test-specific configuration.

## Further documentation

- [Contributor guide](../CONTRIBUTING.md)
- [Development documentation](./docs/README.md)
- [WBS Tools image](./images/wbs-tools/README.md)
- [Documentation terminology](./docs/terminology.md)
- [Architecture Decision Records](./docs/adr/index.md)
