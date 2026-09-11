# WBStackConfig

This prototype package contains the configuration currently embedded in `wbstack/mediawiki`: it resolves a request domain through `getWikiForDomain`, translates its WikiInfo response into MediaWiki settings, and does so early enough for web requests and tenant-specific maintenance commands.

Suite does not load this package in its normal mode. `PLATFORM_API_BACKEND_HOST` currently selects it automatically for the prototype; an explicitly selected provider can instead use `WIKIBASE_CONFIG_BOOTSTRAP` and `WIKIBASE_CONFIG_PROVIDER`.

See [ADR 25](../../../../docs/adr/0025-shared-wikibase-application-image.md) for the shared-image proposal, prototype evidence, and remaining architectural decisions.

## Responsibilities

`WBStackConfig` owns tenant resolution, LocalSettings policy, cache and database topology, extension selection, hooks, localization, logging, and the pre-MediaWiki `wbstackUpdate` interception. `WBStackInternal` is a separate extension containing the private control-plane APIs and is loaded only when `WBSTACK_LOAD_MW_INTERNAL=yes`.

`bootstrap.php` is the early entry point. The package cannot be only a normally loaded extension while its provider and update interception must run before LocalSettings and extension registration.

## Branch history

The preceding commit packages WBStack's PHP and assets from `wbstack/mediawiki` revision `220017feecaf1332086d0efc4518796916ead509` without migrating that code. The current uncommitted changes migrate the packaged code to MediaWiki 1.46. This keeps the packaging decision and the compatibility diff reviewable separately.

## Migration notes

- The complete Cloud LocalSettings policy remains in place. The target uses MediaWiki 1.46's bundled Vector, Timeless, and MinervaNeue skins; its fallback default is Vector 2022.
- Tenant database settings now populate MediaWiki 1.46's scalar connection settings as well as the existing primary/replica topology.
- OAuth uses a local `virtual-oauth` database domain, updated APIs, and per-tenant schema migration.
- Page save, delete, move, and undelete event hooks use the MediaWiki 1.46 hook interfaces.
- Footer rendering uses the namespaced HTML API, and packaged styling and branding use extension-owned paths.
- The image includes PHP Redis and `pcntl`; Cloud configuration raises its PHP memory limit to `256M` without changing Suite's `100M` default.
- A static `WBS_DOMAIN=maint` profile builds localization cache files without a tenant database.
- `/w/health.php` satisfies Cloud's shallow Kubernetes probe without resolving a tenant. Suite retains its deeper `/healthcheck.sh` check.
- The shared Apache configuration includes Cloud's RDF entity, statement, value, reference, and property redirects.

## Package questions

- Package any remaining Cloud extension set, then remove presence guards for code the image promises to contain.
- Confirm whether the early `wbstackUpdate` interception must precede LocalSettings, as noted in `bootstrap.php`, or can use a supported MediaWiki lifecycle API.
- Exercise tenant policy which is currently skipped when an expected extension or the Modern skin is absent.
