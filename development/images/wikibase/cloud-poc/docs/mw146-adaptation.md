# WBStack MediaWiki 1.46 adaptation

This note explains the substantial differences between the Cloud package in
this POC and its source at
[`wbstack/mediawiki` revision `220017fe`](https://github.com/wbstack/mediawiki/tree/220017feecaf1332086d0efc4518796916ead509).
It is a review aid, not a claim that the package is production-ready or that
all Cloud integrations have been exercised.

The accompanying [semantic diff](mw146-adaptation.diff)
compares mapped source files while omitting whitespace-only changes. It has 14
adapted source files, two new support classes, five whitespace-only files, and
eight exact file matches. It does not include new packaging-only files such as
extension manifests, assets, Apache configuration, or `CloudSettings.php`.

## Structural packaging differences

The upstream image places Cloud configuration under `dist-persist/`, with one
small `LocalSettings.php` entry point and source files in
`dist-persist/wbstack/src/`. This POC packages that code in the standard
MediaWiki extension directory so it can be copied only by the `wikibase-cloud`
Docker target:

- `WBStackConfig` contains tenant lookup, configuration policy, static assets,
  and early initialization.
- `WBStackInternal` is a MediaWiki extension that declares Cloud's private API
  modules through `extension.json`. Upstream loaded and registered those PHP
  files directly.
- `CloudSettings.php`, selected through `MW_CONFIG_FILE`, resolves a tenant
  before loading Cloud policy. It replaces the upstream stub settings entry
  point.
- Assets move from `/w/resources/assets` to the packaged extension path. The
  configuration updates the corresponding URLs and ResourceLoader paths.

This is primarily a source-layout and loading-boundary change. It is still
behaviorally relevant: the private API modules load only when
`WBSTACK_LOAD_MW_INTERNAL=yes`, and the early `wbstackUpdate` interception
remains outside normal extension loading because it may need to run before a
tenant's MediaWiki schema is current.

## MediaWiki 1.43 to 1.46 adaptations

| Area | Change in this POC | Reason for review |
| --- | --- | --- |
| Page update hooks | Replaces legacy article/title hooks with `PageDeleteComplete`, `PageMoveComplete`, and `PageUndeleteComplete`; update keys use namespace plus DB key. | MediaWiki hook names and callback values changed. Verify Cloud's downstream page-update handling against real events. |
| Database configuration | Sets current scalar MySQL connection settings alongside Cloud's existing primary/replica topology. | The newer MediaWiki runtime expects these settings during connection setup. |
| OAuth | Uses OAuth's `getOAuthDB`, `StatusValue::getValue()`, and a local `virtual-oauth` mapping with shared-user settings. | These replace APIs and database assumptions from the 1.43 image. Real OAuth integration remains untested. |
| Wikibase configuration | Uses `enableMulLanguageCode` in place of the temporary MUL flags and resolves Wikibase paths from `$IP`. | Aligns with current Wikibase and MediaWiki configuration names/paths. |
| MediaWiki service APIs | Uses the title factory for the main page and namespaced `MediaWiki\\Html\\Html`. | Replaces older static/global APIs. |
| Skins | Does not load the removed legacy Modern skin; uses Vector 2022 as the POC default and retains MinervaNeue for MobileFrontend. | This deliberately narrows the old per-tenant skin behavior while running on the Suite 1.46 base. |
| Localization | Uses `$IP` and skips absent extension localization paths. | The packaged extension set and MediaWiki layout differ from the old image. This should be revisited if Cloud's final extension set changes. |

## Other implementation changes

- `Instance` centralizes the tenant domain used by internal APIs and falls back
  to the old global only where needed.
- `MaintenanceCommand` centralizes maintenance subprocess construction and
  escapes every command component. The search-index, site-stats, and schema
  update APIs use it instead of each assembling a shell command.
- The shallow `health.php` probe gains strict types and explicitly avoids
  tenant resolution. It remains compatible with Cloud's existing probe model.

## Review boundaries and open questions

- The two-tenant Compose fixture verifies that tenant resolution and fresh
  MediaWiki 1.46 setup work with static fixture data. It does not validate
  existing 1.43 tenant databases, Kubernetes deployment behavior, jobs, event
  delivery, real Platform API authorization, or OAuth.
- The pre-MediaWiki `wbstackUpdate` path is retained because its timing may be
  necessary for old tenant schemas. Whether a supported lifecycle hook can
  replace it remains open.
- The Cloud target intentionally uses the Suite 1.46 base. A 1.43-targeted
  Cloud image that keeps the unmigrated source is possible but was not tried.
