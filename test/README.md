# Browser test suites

Run tests through the repository's build-tools container. See
[DEVELOPMENT.md](../DEVELOPMENT.md#test) for the command reference.

```bash
# Run every suite sequentially
./nx test

# Run one suite
./nx test -- repo_client

# Run one spec within a suite's environment
./nx test -- repo --spec specs/repo/extensions/babel.ts

# Start a suite's services and leave them running
./nx test -- queryservice --setup
```

Tests use locally built `wikibase/*:latest` images by default. Build changed
images before testing them. CI sets `WBS_TEST_IMAGE_REGISTRY` and
`WBS_TEST_IMAGE_TAG` to use the images built for that workflow run.

## Suites

| Suite | Coverage and additional services |
| --- | --- |
| `repo` | Core Wikibase repository and extensions; runs up to three WDIO workers |
| `repo_client` | Repository/client federation and change dispatch |
| `queryservice` | WDQS, updater, and WDQS frontend through the `queryservice` Compose profile |
| `quickstatements` | QuickStatements through the `quickstatements` Compose profile |
| `elasticsearch` | Elasticsearch-backed search through the `elasticsearch` Compose profile |
| `pingback` | Metadata callback behavior using its suite-specific fixture |

Each suite is defined by `test/suites/<suite>/<suite>.conf.ts`. It combines the
published deployment Compose file with the shared test override and any
suite-specific override. Test results are written beneath the suite's `results`
directory; CI uploads them only after a failure.

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

## Elasticsearch

- [x] Create item with an alias and search by item alias
- [x] Case-insensitive search should work through Wikibase

## Environment and local overrides

Put local overrides in the repository-root `local.env`. Defaults come from
`deploy/.env.example`, `test/test-services.env`, and `test/test-runner.env`.

- `WIKIBASE_URL`, `WIKIBASE_CLIENT_URL`, `QUICKSTATEMENTS_URL`, and `WDQS_URL`: service URLs used from the test network.
- `MW_SCRIPT_PATH`: path to `index.php`, `api.php`, and related endpoints; defaults to `/w`.
- `WIKIBASE_PROPERTY_STRING`, `WIKIBASE_PROPERTY_URL`, etc.: Property ID of a property with datatype `string`, `url`, etc. – if not set, a new property of this type will be created each time the tests are run. (This will fail unless anonymous users are allowed to create properties on the wiki, so setting `WIKIBASE_PROPERTY_STRING` correctly is recommended.)
- `HEADED_TESTS`: set to `true` to run tests in a headed browser. Follow the test execution at http://localhost:7900/?autoconnect=1&resize=scale.
- `MAX_INSTANCES`: default WDIO worker count and Selenium session limit. Individual suites may override it.
- `TEST_LOG_LEVEL`, `MOCHA_OPTS_TIMEOUT`, and `WAIT_FOR_TIMEOUT`: runner logging and timeout controls.

## Write more tests

When working on the browser tests, you’ll want to consult the documentation of the following libraries we use:

- [WebdriverIO](https://webdriver.io/docs/api) for controlling the browser (`browser`, `$`, `waitUntil`, …)
- [Mocha](https://mochajs.org/) as the general testing framework (`describe`, `it`, `before`, …)
- [`expect`](https://webdriver.io/docs/api/expect-webdriverio/) for assertions (`toBe`, `toEqual`, …)
