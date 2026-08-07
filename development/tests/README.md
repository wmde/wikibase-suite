# Integration test suites

Run tests through the repository's `wbs-dev` container. Use `wbs-dev test --help` for the current command reference.

```bash
# Run every suite sequentially
wbs-dev test

# Run one suite
wbs-dev test repo-client

# Run one spec within a suite's environment
wbs-dev test extensions --spec extensions/babel.spec.ts

# Start a suite's services and leave them running
wbs-dev test queryservice --setup
```

Test runs build the local images once before starting the selected suites. Use `--skip-build` when the required images were built separately, as they are in CI. CI sets `WBS_TEST_IMAGE_REGISTRY` and `WBS_TEST_IMAGE_TAG` to use the images built for that workflow run.

## Suites

| Suite | Coverage and additional services |
| --- | --- |
| `repo` | Core Wikibase repository behavior; runs up to three WDIO workers |
| `extensions` | Bundled MediaWiki and Wikibase extensions; runs up to three WDIO workers |
| `repo-client` | Repository/client federation and change dispatch |
| `queryservice` | WDQS, updater, and WDQS frontend through the `queryservice` Compose profile |
| `quickstatements` | QuickStatements through the `quickstatements` Compose profile |
| `opensearch` | OpenSearch-backed search through the `opensearch` Compose profile |
| `pingback` | Metadata callback behavior using its suite-specific fixture |
| `installer` | Complete installer journey, including bootstrap selection, web configuration, deployment health, and administrator login |

Each suite is defined by `tests/<suite>/<suite>.conf.ts`. It combines the published deployment Compose file with the shared test override and any suite-specific override. Test results are written beneath the suite's `results` directory; CI uploads them only after a failure.

## Coverage notes

## Wikibase

- [ ] Create an item using the UI
  - [ ] Add a statement
  - [ ] Add a qualifier
  - [ ] Add a reference
- [ ] Create a property using the UI
  - [ ] add a statement
  - [ ] add a qualifier
  - [ ] add a reference

## Wikibase & WDQS/WDQS-frontend

- [x] Create an item on Wikibase and verify it can be found on Query Service (including the label, etc.)
- [x] Delete an item on Wikibase and verify that the item is no longer there on the query service
- [x] Create an item with a statement and verify that querying using prefixes works correctly (`wdt:P1`, etc.. )

## Wikibase client & repo

- [x] Create an item on repo with sitelink to client
- [x] Create an item on repo and verify that client can reference it using wikitext
- [ ] Verify that changes on repo are dispatched to client ( TODO figure out all use-cases )
  - [x] Sitelink created
  - [x] Item delete
  - [ ] TODO ...
- [x] Create an item on repo and verify that client can use it using Lua (Scribunto)

## Scribunto

- [x] Verify Lua module can be executed
- [x] Verify Lua module can be executed within time limit

## OpenSearch

- [x] Create item with an alias and search by item alias
- [x] Case-insensitive search should work through Wikibase

## Environment and local overrides

Put local overrides in `development/local.env`. Defaults come from the root `.env.example`, `tests/test-services.env`, and `tests/test-runner.env`.

- `WIKIBASE_URL`, `WIKIBASE_CLIENT_URL`, `QUICKSTATEMENTS_URL`, and `WDQS_URL`: service URLs used from the test network.
- `MW_SCRIPT_PATH`: path to `index.php`, `api.php`, and related endpoints; defaults to `/w`.
- `WIKIBASE_PROPERTY_STRING`, `WIKIBASE_PROPERTY_URL`, etc.: Property ID of a property with datatype `string`, `url`, etc. – if not set, a new property of this type will be created each time the tests are run. (This will fail unless anonymous users are allowed to create properties on the wiki, so setting `WIKIBASE_PROPERTY_STRING` correctly is recommended.)
- `WBS_TEST_HEADED`: set to `true` to run tests in a headed browser. Follow the test execution at http://localhost:7900/?autoconnect=1&resize=scale.
- `WBS_TEST_MAX_INSTANCES`: global ceiling for WebdriverIO workers and Selenium sessions. Set it to `1` in `development/local.env` when parallel suites exhaust local CPU or memory. It can lower, but never raise, a suite's configured worker count.
- `MAX_INSTANCES`: fallback worker count for suites without an explicit setting. Prefer `WBS_TEST_MAX_INSTANCES` when limiting local resource usage.
- `TEST_LOG_LEVEL`, `MOCHA_OPTS_TIMEOUT`, and `WAIT_FOR_TIMEOUT`: runner logging and timeout controls.

## Write more tests

### Choose where the test belongs

- Add a `*.spec.ts` browser test under `tests/<suite>/`. Use the suite whose services and configuration match the behavior under test.
- Put reusable browser interactions in `tests/_helpers/pages/` and other shared test logic in `tests/_helpers/`. Keep behavior specific to one test in its spec.
- Put suite-specific MediaWiki configuration, SQL, fixture extensions, and Compose overrides beside the specs in `tests/<suite>/`.
- Change shared runner lifecycle code in `tests/_setup/` only when the behavior should apply to every suite.
- Put reusable TypeScript declarations in `tests/_types/`.

An existing suite automatically discovers a new spec only when its `<suite>.conf.ts` `specs` patterns include the new path. When a change needs a different combination of Compose profiles or overrides, add a suite directory with a matching `<suite>.conf.ts` and include it in the CI test matrix.

### Conventions

- Name spec files after the feature or service behavior they cover. Use Mocha `describe` and `it` descriptions that state the observable behavior.
- Read service URLs and credentials from `testEnv.vars`; do not hard-code local ports, hostnames, or credentials.
- Create unique test data when practical and do not rely on spec execution order. The `repo` suite can run several WDIO workers concurrently.
- Prefer page objects for repeated UI flows and WebdriverIO expectations or `browser.waitUntil` for asynchronous behavior. Use a fixed `browser.pause` only when no observable condition is available, and explain why in the spec.
- Keep assertions in the spec so the behavior being verified remains visible; helpers should primarily arrange state or expose reusable interactions.
- Run the smallest relevant spec while iterating, then its complete suite before submitting the change. Test commands build the local images unless `--skip-build` is given.

The `installer` suite includes bootstrap selection checks and one complete user-facing installation journey. Its fast supporting contracts verify the command interfaces, existing-configuration precedence, that CLI configuration completes before lifecycle operations begin, and the web/worker Docker-socket isolation boundary. The central browser test runs the root `install` command in the supported local mode, completes the web form, verifies the submitted `.env` values, boots the complete deployment, waits for its services and configured health checks, finalizes the installer, and logs into Wikibase using the administrator credentials entered in the form.

This exercises the supported `--local` path. It does not cover public DNS matching, public certificate issuance, firewall configuration, or reachability from outside the Docker host; those remain separate deployment concerns.

Because it installs the complete current checkout, the normal test command builds all local images before running this suite. CI provides the equivalent images from its parallel build jobs and uses `--skip-build` with a workflow-specific tag.

When working on the browser tests, consult the documentation of the following libraries:

- [WebdriverIO](https://webdriver.io/docs/api) for controlling the browser (`browser`, `$`, `waitUntil`, …)
- [Mocha](https://mochajs.org/) as the general testing framework (`describe`, `it`, `before`, …)
- [`expect`](https://webdriver.io/docs/api/expect-webdriverio/) for assertions (`toBe`, `toEqual`, …)
