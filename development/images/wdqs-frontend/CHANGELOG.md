# 2.2.1 (2026-09-03)

## Dependency updates

- Wikidata Query GUI main ([Diff](https://gitlab.wikimedia.org/repos/wmde/wikidata-query-gui/-/compare/3647637ca5bfcb5162137c9a4fe2cd2eb87b9a8c...176149abd58c475f8670965fa6f695ca10274a56)).

# 2.2.0 (2026-08-12)

## Changes

- Serves the Query GUI's ES modules with a browser-compatible JavaScript media type.

## Dependency updates

- Wikidata Query GUI main ([Diff](https://gitlab.wikimedia.org/repos/wmde/wikidata-query-gui/-/compare/35a3c0c39b7c9e555fcba77032de9eef4694d722...3647637ca5bfcb5162137c9a4fe2cd2eb87b9a8c)).

# 2.1.1 (2026-07-14)

- Loads query examples from the local Wikibase `Project:SPARQL/examples` page instead of Wikidata, migrating the previous Wikidata configuration when present.
- Removes the hardcoded Wikidata tools and Query Builder navbar links.
- Adds an image-owned health check for the frontend service.
- Uses the locked WDQS Query GUI dependency set so the query execution icon renders correctly.

## 2.1.0 (2026-02-16)

### 🚀 Features

Updates in concert with Wikibase image v6.0.0 (mw-1.45) release

- WDQS Query GUI updated from 7638030 to dd58b26 (see https://gerrit.wikimedia.org/r/plugins/gitiles/wikidata/query/gui/+/7638030f312c21cc5a4fccd05e16d6ffffdd9220..dd58b265363e654ab2c8a6ec553aced2637fec18)

Analysis revealed localization updates, routine maintenance, and feature additions, with no breaking changes detected.

# 2.0.0 (2025-03-20)

### 🚀 Features

-  ⚠️ Support user configuration file

### 📖 Documentation

- Prepare Deploy 4 release
- Update Dockerhub readme

### 🏡 Chore

-  ⚠️ Remove wdqs-proxy interaction in WBS Deploy
-  ⚠️ Update environment variable names

### 🎨 Styles

- Add Wikibase logo

#### ⚠️ Breaking Changes

-  ⚠️ Support user configuration file
-  ⚠️ Remove wdqs-proxy interaction in WBS Deploy
-  ⚠️ Update environment variable names

## 1.0.2 (2024-10-28)

### 📖 Documentation

- WBS specific usage of WDQS frontend

## **wdqs-frontend@1.0.1** (2024-10-09)

### 📖 Documentation

- Switch from `.example.com` to `.example`

### 🩹 Fixes

- Link to Query Builder now points to the source code repository ([#664](https://github.com/wmde/wikibase-suite/issues/664))
