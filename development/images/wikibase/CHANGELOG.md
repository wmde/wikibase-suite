# Next

- Adds ConfirmAccount to the bundled extensions and enables account-request approval by default.

# 8.0.0 (2026-07-20)

- Upgrades MediaWiki from 1.45.4 to 1.46.0.
- Updates Wikibase, Babel, cldr, CirrusSearch, Elastica, Echo, EntitySchema, OAuth, UniversalLanguageSelector, WikibaseCirrusSearch, and WikibaseManifest to the latest commits in their respective MediaWiki 1.46-compatible branches.
- Updates WikibaseLocalMedia and Wikibase EDTF to their latest upstream commits (not version bound).
- Configures OAuth to use the MediaWiki 1.46-compatible local user source.

# 7.1.0 (2026-07-14)

- Adds WikibaseInWikitext so administrators can write local query service examples with `<sparql>` tags.
- Adds an image-owned health check that reports healthy when MediaWiki is serving requests.

# 7.0.2 (2026-07-08)

- Upgrades to MediaWiki 1.45.4 due to a critical security update.

# 7.0.1 (2026-04-23)

- Fixes a `7.0.0` regression in the opt-in metadata callback that caused Wikibase startup to fail for instances with `METADATA_CALLBACK=true`.

# 7.0.0 (2026-04-20)

Updates MediaWiki and bundled extensions within the 1.45 release line and adds several new default capabilities to the Wikibase image.

- MediaWiki updated from 1.45.0 to 1.45.3 (see https://github.com/wikimedia/mediawiki/compare/1.45.0...1.45.3 and https://www.mediawiki.org/wiki/Release_notes/1.45).
- Bundled extension versions were updated to current MediaWiki 1.45-compatible code in `development/images/wikibase/build.env`.
- Enables `mul` language code by default.
  - BREAKING CHANGE: Upgrading standalone Wikibase image users must re-index Elasticsearch to see `mul` results in Typeahead searches. See the [CirrusSearch documentation](https://www.mediawiki.org/wiki/Extension:CirrusSearch) for how to recreate and reindex.
- Enables Wikidata-style statement grouping for item identifiers and property constraints by default.
- Adds Echo, DiscussionTools, and the required Linter extension to the default image configuration.
- Keeps anonymous read access enabled, but disables anonymous writes and anonymous self-service account creation by default in the bundled image configuration.
- Refactors bundled LocalSettings loading so image-managed bootstrap logic lives in dedicated image files while preserving supported operator override points in generated `LocalSettings.php`.
- Wikibase EDTF remains bundled in the image but is no longer loaded by default. Installations that require EDTF should explicitly load `WikibaseEdtf` in local configuration.
- Fixes `composer.local.json` permissions in the image build.

# 6.0.0 (2026-02-16)

Upgrades to MediaWiki from 1.44 to 1.45 including updates to compatible packaged extensions

- MediaWiki updated from 1.44.0 to 1.45.0 (see https://www.mediawiki.org/wiki/MediaWiki_1.45 and https://github.com/wikimedia/mediawiki/compare/1.44.0...1.45.0)
- Bundled extension pins updated from REL1_44 to REL1_45-compatible commits in build/wikibase/build.env.
- OAuth same-domain patch updated for MW 1.45 compatibility in build/wikibase/mediawiki-extensions-OAuth-same-domain.patch.
- "repo" suite E2E specs were stabilized for MW 1.45, and an OAuth consumer creation smoke test was added.
- Adds version reporting of Wikibase Image, Deploy, and the Build Tools (git SHA) to Special:Version page and action API.

Analysis revealed breaking changes expected for a MediaWiki major-version upgrade.

# 5.0.0 (2025-07-24)


### 💅 Refactors

- ⚠️  move callback to wikibase image


### 📦 Build

- depth 1 checkouts in wikibase-image build


### 🏡 Chore

- ⚠️  bump mediawiki to 1.44.0


#### ⚠️  Breaking Changes

- ⚠️  move callback to wikibase image
- ⚠️  bump mediawiki to 1.44.0

## 4.1.2 (2026-07-22)


### 🩹 Fixes

- Update MediaWiki to 1.43.9 and refresh WMF-maintained extensions on REL1_43

## 4.1.1 (2025-07-17)


### 🏡 Chore

- bump mediawiki to 1.43.3, update extensions

## 4.1.0 (2025-06-13)


### 🚀 Features

- Add operating system dependencies for Mediawiki extensions

## 4.0.1 (2025-04-29)


### 🏡 Chore

- mediawiki 1.43.1

# 4.0.0 (2025-03-20)

### 🩹 Fixes

- OAuth consumers (e.g. QuickStatements) on same domain

### 📖 Documentation

- Prepare Deploy 4 release
- Update Dockerhub readme

### 🏡 Chore

-  ⚠️ Bump MediaWiki to 1.43

#### ⚠️ Breaking Changes

-  ⚠️ Bump MediaWiki to 1.43

## 3.0.3 (2025-02-24)

### 🏡 Chore

- bump mediawiki to 1.42.4

- bump mediawiki extensions

- bump php to 8.3.16

- bump to mediawiki 1.42.5

## 3.0.2 (2024-10-28)

### 🏡 Chore

- bump mediawiki to 1.42.3, bump extensions

## 3.0.1 (2024-10-09)

### 📖 Documentation

- Link to MediaWiki bundled extensions
- Switch from `.example.com` to `.example`

### 🏡 Chore

- Removes re-installation of extensions already packaged with MediaWiki (ConfirmEdit, Nuke, Scribunto, SyntaxHighlight_Geshi, VisualEditor)
- Updates Wikibase EDTF extension
