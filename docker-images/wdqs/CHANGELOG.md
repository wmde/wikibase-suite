# 2.1.1 (2026-07-14)

### 🩹 Fixes

- Initialize the updater checkpoint for empty WDQS stores from Wikibase RecentChanges, avoiding the WDQS updater restart loop ([T354266](https://phabricator.wikimedia.org/T354266)).

# 2.1.0 (2026-02-16)

Updates in concert with Wikibase image v6.0.0 (mw-1.45) release

- WDQS updated from 0.3.142 to 0.3.156 (see https://github.com/wikimedia/wikidata-query-rdf/compare/query-service-parent-0.3.142...query-service-parent-0.3.156)

Analysis revealed bug fixes and feature additions, with no breaking changes detected.

## 2.0.2 (2025-03-20)

### 🩹 Fixes

- EXPOSE 9999 via Dockerfile

### 📖 Documentation

- Replace wdqs-proxy with Traefik in Readme
- Prepare Deploy 4 release
- Update Dockerhub readme

## 2.0.1 (2025-01-22)

### 🩹 Fixes

- injected standard prefixes reference wikidata

## 2.0.0 (2024-10-28)

### 🚀 Features

- ⚠️ require concept uri via environment variable

### 🩹 Fixes

- drop privileges during docker build

### 📖 Documentation

- WBS specific usage of WDQS frontend

#### ⚠️ Breaking Changes

- ⚠️ require concept uri via environment variable

## 1.0.1 (2024-10-09)

### 📖 Documentation

- Switch from `.example.com` to `.example`
- Add comments in "Updater keeps restarting" FAQ entry
- Correct typos
