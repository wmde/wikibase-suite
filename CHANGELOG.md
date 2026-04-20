## 7.0.0 (2026-04-20)

Updates in concert with Wikibase image v7.0.0 (mw-1.45.3) release

- See `build/wikibase/CHANGELOG.md` for the paired Wikibase image changes in this release.

## 6.0.0 (2026-02-16)

Updates in concert with Wikibase image v6.0.0 (mw-1.45) release

- Moves wikibase and wikibase-jobrunner to wikibase/wikibase:6 source image spec
- Passes Deploy version reporting through to Wikibase image so it appears in Special:Version and action API

## 5.0.1 (2025-08-26)


### 🩹 Fixes

- bump wikbase container to 5

# 5.0.0 (2025-07-24)


### 💅 Refactors

- ⚠️  move callback to wikibase image


### 📖 Documentation

- suggest METADATA_CALLBACK settings

- notes about upgrade from 4 to 5


#### ⚠️  Breaking Changes

- ⚠️  move callback to wikibase image

## 4.2.1 (2025-07-11)


### 🩹 Fixes

- do not require METADATA_CALLBACK for now

## 4.2.0 (2025-07-03)


### 🚀 Features

- Adds a [Call Back](https://github.com/wmde/wikibase-release-pipeline/blob/main/deploy/README.md#call-back) feature to allow instances to share publicly available data to analyze the use of Wikibase and increase discoverability.


## 4.0.1 (2025-03-21)


### 🏡 Chore

- allow traefik updates within 3.x.x

# 4.0.0 (2025-03-20)

### 🚀 Features

- ⚠️ wikibase:4, based on MediaWiki 1.43
- ⚠️ wdqs-frontend:2, support user config
- ⚠️ Serve QuickStatements from subdirectory
- ⚠️ Update SPARQL endpoint URL
- User defined MediaWiki extensions

### 📖 Documentation

- Describe new features
- Clarifications

### 🏡 Chore

- ⚠️ Remove wdqs-proxy

#### ⚠️ Breaking Changes

- ⚠️ wikibase:4, based on MediaWiki 1.43
- ⚠️ wdqs-frontend:2, support user config
- ⚠️ Serve QuickStatements from subdirectory
- ⚠️ Remove wdqs-proxy
- ⚠️ Update SPARQL endpoint URL

## 3.0.4 (2025-02-24)

### 🩹 Fixes

- set traefik restart policy to 'unless-stopped'

### 📖 Documentation

- fix updating images section

- update docs to mention version tags

## 3.0.3 (2024-11-07)

### 🩹 Fixes

- Bump WDQS-Updater version to 2

## 3.0.2 (2024-10-28)

### 🩹 Fixes

- Provide Concept URI to WDQS

### 📖 Documentation

- Add some notes about WDQS-frontend

- Fix backup script volume names

## 3.0.1 (2024-10-09)

### 🩹 Fixes

- `*_PUBLIC_HOST` URLs default to `.example` TLD from `example.com` ([T372455](https://phabricator.wikimedia.org/T372455))
- Removes extra published ports for wikibase, quickstatements, and wdqs-frontend services ([T372455](https://phabricator.wikimedia.org/T372455))
- Wikibase waits for Elasticsearch service to be up ([T371162](https://phabricator.wikimedia.org/T371162))

### 📖 Documentation

- Do not use `--wait` in `docker compose up` in order to see logs
- Link to WDQS updater crash FAQ entry
- Corrected typos

### 🏡 Chore

- Adds default Traefik LetsEncrypt configuration for services
