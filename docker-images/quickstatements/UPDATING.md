# Updating QuickStatements (`wikibase/quickstatements`)

[Back to the release guide](../../development/docs/release.md#1-update-images-from-upstream-sources-optional)

QuickStatements is built from pinned QuickStatements and MagnusTools development commits rather than a published release.

Use this guide when the release refreshes those commits.

## 1. Update the sources

```bash
./wbs-dev update-sources quickstatements
```

The command updates both commits and the MagnusTools archive checksum.

## 2. Review

Compare both commit ranges. Check user workflows, OAuth, Wikibase API, configuration, and runtime changes.

## 3. Determine the impact

- **Patch:** a narrow compatible correction.
- **Minor:** the default for a compatible source refresh.
- **Major:** incompatible configuration, authentication, API, or user action.

[Continue with testing](../../development/docs/release.md#3-test-and-fix)
