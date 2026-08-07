# 8.0.0 (2026-07-20)

## Changes

- Configures OAuth to use the MediaWiki 1.46-compatible local user source
- Adds PluggableAuth, WSOAuth, and related config to enabled Wikimedia OAuth logins option

## Dependency updates

- MediaWiki from 1.45.4 to 1.46.0 ([Release notes](https://www.mediawiki.org/wiki/Release_notes/1.46)).
- Wikibase REL1_46 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/Wikibase/+log/a5025e70d1694e365ddc4c8f5b87f901558a4c58..beac6f2208f9ccd824e7ddbe0c5cf79445f71df1)).
- Babel REL1_46 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/Babel/+log/90afc691d37369e2968fd69aab7c2b3a3d871bde..921d538763ed4bc084519f41fad4d7306c979fbd)).
- cldr REL1_46 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/cldr/+log/2cbb47613782e93865169d20d5a3ae7bc3128609..b65931db807edfe24238830d75c0bec0825d4e10)).
- CirrusSearch REL1_46 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/CirrusSearch/+log/08efc46e58467c6cdd16f15040f9a0b40d558193..4bd99abfc1f9f8b50c8eb24b68c296afbd57e9c4)).
- Elastica REL1_46 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/Elastica/+log/8ee2c285217fd37690d977d9e655ddedf4c5910d..b03db3803b4af48c092462c8872ffa38f6d0fe8a)).
- Echo REL1_46 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/Echo/+log/5f3d5683bc45cef8c1c92b12db1f810af7f3d8ff..6b3af80c5052a338ae947f1aec1935c87d1f7bae)).
- EntitySchema REL1_46 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/EntitySchema/+log/abbed839ce80d809e40858fd1127cd9ce93f528e..bbf6d21dd67bb96fc628040295c0ca276a2e8d93)).
- OAuth REL1_46 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/OAuth/+log/ed73b89e60983f438ad2e638d75c6c3103bbf6c6..7ea998c0a5db9e89cef2c6aa5b8c8cefae1d1a36)).
- UniversalLanguageSelector REL1_46 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/UniversalLanguageSelector/+log/1ac7c58b4ac4a083b39a33c613733beafbe87700..62f29f154efc8f79f33c2b1a0bc4a81a6786db5f)).
- WikibaseCirrusSearch REL1_46 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/WikibaseCirrusSearch/+log/b5a764f3380ca0d2b17055f55e3e745b12e4852b..be1b8cbaf6abe37278b01d5d36ebe02e5d7f0e0f)).
- WikibaseManifest REL1_46 ([Diff](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/extensions/WikibaseManifest/+log/8da5151dc999f2922ccb2f76d25ecbbf8afe1d85..8290c98d766d8d52a7e7ec0fe1ce3a2d6cd76731)).
- WikibaseLocalMedia master ([Diff](https://github.com/ProfessionalWiki/WikibaseLocalMedia/compare/d1214734112b03754fc6e73651dc118f84ebf33a...ddc6c87292429b662644cdc7c24402b12336377a)).
- WikibaseEdtf master ([Diff](https://github.com/ProfessionalWiki/WikibaseEdtf/compare/27fe77907bb16060a87e4896de0a97fefe3a97f5...e94c2fcdbcb91124978ac20f6d912d8cdd2ecaae)).

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
