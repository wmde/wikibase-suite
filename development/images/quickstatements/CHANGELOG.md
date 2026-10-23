# 1.2.3 (2026-10-23)

## Changes

- Restores QuickStatements' original Toolforge static asset URLs now that the resources are available again. Remove the local asset preparation and the English-only ToolTranslate snapshot, restoring the pre-1.2.2 translation behavior.

# 1.2.2 (2026-10-21)

## Changes

- Bundle the static files QuickStatements previously loaded from Toolforge so its interface starts while Toolforge is unavailable. This image currently bundles English interface translations only; ToolTranslate lists 47 languages for QuickStatements, so restoring the others requires a follow-up.

## Dependency updates

- PHP base image from 8.3.8 to 8.3.36 (Apache, Debian Bookworm). *PHP 8.3.36 includes fixes for the critical vulnerabilities CVE-2026-109618 and CVE-2026-109619* ([PHP security advisory](https://www.php.net/archive/2026.php#2026-10-21-5)).
- MagnusTools master ([Diff](https://codeberg.org/magnusmanske/magnustools/compare/b5686e6b4bc8f95095eea295031718a9186d1510...ec79940688576567b12b90373cc091715e3dea06)).
- QuickStatements master ([Diff](https://github.com/magnusmanske/quickstatements/compare/5daef4bcb4a99eea27b3a3ccc10cae21e6c746f9...558474da79766d8c7f9d7d0e727194f3cc9ade3a)).

# 1.2.1 (2026-09-03)

## Dependency updates

- MagnusTools master ([Diff](https://codeberg.org/magnusmanske/magnustools/compare/7d9b415bfab0ae624e17676be1e9d763f340b315...b5686e6b4bc8f95095eea295031718a9186d1510)).

# 1.2.0 (2026-08-06)

- Updates QuickStatements to its latest upstream commit, adding full lexeme support, `LAST_FORM` and `LAST_SENSE`, automatic import-format detection, and interface improvements alongside fixes.
- Updates MagnusTools to its latest upstream commit, including compatibility, security, API retry, and modernization work.
- No breaking changes were identified.

## 1.1.0 (2026-02-16)

Updates in concert with Wikibase image v6.0.0 (mw-1.45) release

- QuickStatements updated from c4b2c6b to 1764ac7 (see https://github.com/magnusmanske/quickstatements/compare/c4b2c6b...1764ac7)
- magnustools updated from 5b8cea4 to 40a4b1d (see https://codeberg.org/magnusmanske/magnustools/compare/5b8cea4..40a4b1d)

Analysis revealed bug fixes and features added but no breaking changes.

## 1.0.2 (2025-03-20)

### 📖 Documentation

- Prepare Deploy 4 release
- Update Dockerhub readme

## 1.0.1 (2024-10-09)

### 📖 Documentation

- Switch from `.example.com` to `.example`
