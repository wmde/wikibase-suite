# WBStackInternal

This extension packages Wikibase Cloud's private MediaWiki control-plane APIs for MediaWiki 1.46. It handles wiki initialization, OAuth consumer management, search setup and indexing, site statistics, and tenant schema updates. Suite does not enable it.

See [`WBStackConfig`](../WBStackConfig/README.md) for tenant configuration and [ADR 25](../../../../docs/adr/0025-shared-wikibase-application-image.md) for the shared-image proposal and prototype validation.

## Runtime boundary

- `WBStackConfig` resolves WikiInfo before MediaWiki starts and loads this extension only when `WBSTACK_LOAD_MW_INTERNAL=yes`.
- `WBStackInternal` contains the ordinary private Action API modules. The one early `wbstackUpdate` interception remains in the configuration bootstrap so an old tenant schema can launch the updater before full MediaWiki initialization.
- Tenant subprocesses preserve `WBS_DOMAIN=<tenant>` and run through a shared `MaintenanceCommand` helper using MediaWiki 1.46 paths.
- `WBS_DOMAIN=maint` belongs to WBStackConfig's database-less maintenance profile; it is not a second internal-extension mode.
- `ApiBase::isInternal()` is metadata, not authorization. Cloud must retain its private backend role and network boundary.

## MediaWiki 1.46 migration

- Replaced the registration callback with normal extension registration; the early updater has one implementation in WBStackConfig.
- Replaced removed title and OAuth APIs with MediaWiki 1.46 services.
- Added an `Instance` boundary for tenant identity instead of directly coupling every API to the WBStack global.
- Centralized and escaped maintenance subprocess construction while preserving WBStack's commands and response shapes.
- Declared the MediaWiki 1.46 requirement and registered tenant-domain configuration in `extension.json`.

## Package questions

- `ApiBase::isInternal()` is metadata, not authorization; confirm that Cloud's backend role and network policy remain the effective access boundary.
- Exercise APIs which mutate content, create OAuth consumers, deliver Platform API events, or call Elasticsearch against their real Cloud dependencies.

