# Testing

Run the fast development-tooling tests and browser-based integration suites through the repository's `wbs-dev` container. Use `wbs-dev test --help` for the current command reference.

## Current Test Suites

| Test Suite | Type | What It Covers |
| --- | --- | --- |
| `wbs-dev-tools` | Tooling | The `wbs-dev` CLI, development commands, and shared development libraries. |
| `repo` | Integration | Core Wikibase repository behavior; runs up to three WDIO workers. |
| `extensions` | Integration | Bundled MediaWiki and Wikibase extensions; runs up to three WDIO workers. |
| `repo-client` | Integration | Repository/client federation and change dispatch. |
| `queryservice` | Integration | WDQS, updater, and WDQS frontend through the `queryservice` Compose profile. |
| `quickstatements` | Integration | QuickStatements through the `quickstatements` Compose profile. |
| `opensearch` | Integration | OpenSearch-backed search through the `opensearch` Compose profile. |
| `pingback` | Integration | Metadata callback behavior using its suite-specific fixture. |
| `wbs-tools` | Integration | WBS Tools lifecycle, including bootstrap selection, web configuration, deployment health, and administrator login. |

Integration suite settings live in `tests/<suite>/<suite>.conf.ts`. Each combines the published deployment Compose file with the shared test override and any suite-specific override. Test results are written beneath the suite's `results` directory; CI uploads them after a failure.

## Run Tests

```bash
# Run every test target sequentially
wbs-dev test

# Run the WBS DevTools test suite
wbs-dev test wbs-dev-tools

# Run one integration suite
wbs-dev test repo-client

# Run multiple suites
wbs-dev test repo queryservice

# Run one spec within a suite's environment
wbs-dev test extensions --spec extensions/babel.spec.ts

# Start a suite's services and leave them running
wbs-dev test queryservice --setup
```

## Write Tests

### Conventions

- Name spec files after the feature or service behavior they cover. Use Mocha `describe` and `it` descriptions that state the observable behavior.
- Read service URLs and credentials from `testEnv.vars`; do not hard-code local ports, hostnames, or credentials.
- Create unique test data when practical and do not rely on spec execution order. The `repo` suite can run several WDIO workers concurrently.
- Prefer page objects for repeated UI flows and WebdriverIO expectations or `browser.waitUntil` for asynchronous behavior. Use a fixed `browser.pause` only when no observable condition is available, and explain why in the spec.
- Keep assertions in the spec so the behavior being verified remains visible; helpers should primarily arrange state or expose reusable interactions.
- Run the smallest relevant spec while iterating, then its complete suite before submitting the change. Test commands build the local images unless `--skip-build` is given.

### Choose Where the Test Belongs

- Add a `*.spec.ts` browser test under `tests/<suite>/`. Use the suite whose services and configuration match the behavior under test.
- Put reusable browser interactions in `tests/_helpers/pages/` and other shared test logic in `tests/_helpers/`. Keep behavior specific to one test in its spec.
- Put suite-specific MediaWiki configuration, SQL, fixture extensions, and Compose overrides beside the specs in `tests/<suite>/`.
- Change shared runner lifecycle code in `tests/_setup/` only when the behavior should apply to every suite.
- Put reusable TypeScript declarations in `tests/_types/`.

An existing suite automatically discovers a new spec only when its `<suite>.conf.ts` `specs` patterns include the new path. When a change needs a different combination of Compose profiles or overrides, add a suite directory with a matching `<suite>.conf.ts` and include it in the CI test matrix.

### WBS Tools Suite

The `wbs-tools` suite is the dedicated end-to-end suite for the WBS Tools image and its installer lifecycle. In contrast, `wbs-dev-tools` tests the development CLI and its supporting libraries.

It runs the selected WBS Tools image against a temporary WBS checkout and covers:

- **Bootstrap and CLI contracts:** release selection, supported options, configuration behavior, and lifecycle ordering.
- **Installer access and isolation:** access-code handling and the separation between the browser-facing container and Docker access.
- **Complete installation:** the supported local browser flow, generated configuration, service health, installer finalization, and administrator sign-in.

It exercises the supported `--local` path. Public DNS matching, certificate issuance, firewall configuration, and reachability from outside the Docker host remain separate deployment concerns.

Run it with `wbs-dev test wbs-tools`.

### WBS DevTools Tests

The `wbs-dev-tools` suite uses Mocha to test the development tooling rather than a browser environment.

- Put CLI contract tests in `development/wbs-dev.spec.ts`.
- Put command tests beside their command implementation under `development/commands/**/*.spec.ts`.
- Put shared development-library tests under `development/lib/**/*.spec.ts`.

Run the suite with `wbs-dev test wbs-dev-tools`.

## Test Configuration Notes

Most local development needs no configuration. `wbs-dev test` builds local images before running integration suites; use `--skip-build` only when those images were built separately.

### Common Local Adjustments

- **Watch a browser run:** Use `wbs-dev test SUITE --headed` for one run, or set `WBS_TEST_HEADED=true` in `development/local.env` to keep browser windows visible. Follow the run at http://localhost:7900/?autoconnect=1&resize=scale.
- **Use fewer resources:** Set `WBS_TEST_MAX_INSTANCES=1` in `development/local.env` when parallel browser workers exhaust local CPU or memory. It can lower, but never raise, a suite's configured concurrency.

### Advanced Configuration

`development/local.env` overrides the test defaults. The root `.env.example`, [`test-services.env`](./test-services.env), and [`test-runner.env`](./test-runner.env) define service URLs, credentials, test-property IDs, runner timeouts, logging, and other test-system settings. Most contributors do not need to change them.

CI uses `--skip-build` and supplies `WBS_TEST_IMAGE_REGISTRY` and `WBS_TEST_IMAGE_TAG` to select its workflow images. These settings are normally not needed for local development.

## Further Reading

When working on the browser tests, consult the documentation of the following libraries:

- [WebdriverIO](https://webdriver.io/docs/api) for controlling the browser (`browser`, `$`, `waitUntil`, …)
- [Mocha](https://mochajs.org/) as the general testing framework (`describe`, `it`, `before`, …)
- [`expect`](https://webdriver.io/docs/api/expect-webdriverio/) for assertions (`toBe`, `toEqual`, …)
