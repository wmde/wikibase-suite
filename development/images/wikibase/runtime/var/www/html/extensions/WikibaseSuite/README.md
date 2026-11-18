# WikibaseSuite extension

The WikibaseSuite extension provides the default behaviours, settings, and features bundled with the Wikibase image, including:

- **Instance setup:** database installation and updates, administrator creation, and migration of legacy configuration.
- **MediaWiki configuration:** instance settings, image defaults, and bundled extension loading.
- **A dashboard:** entity counts, creation shortcuts, and help links on [`Special:WikibaseDashboard`](./includes/SpecialWikibaseDashboard.php).
- **Navigation and appearance:** sidebar links, Vector 2022 adjustments, and a dashboard redirect for empty instances.
- **Version and metrics reporting:** installed versions on `Special:Version` and through the [Action API](./includes/ApiQueryWikibaseSuite.php), plus an aggregate Wikimedia-linked user count when available.
- **Service discovery:** QuickStatements and Query Service URLs supplied to WikibaseManifest when loaded.

The image entry point runs the setup scripts before Apache starts. MediaWiki loads the hooks, special page, and API module through [`extension.json`](./extension.json).

## 1. Prepare the instance

[`setup/setup.sh`](./setup/setup.sh) looks at the files in the mounted `/config` directory to decide what the instance needs before it can start:

- **New instance:** generate `InstanceSettings.php` and `LocalSettings.php`, install and update the database, create the administrator, then run integration setup and optional `/extra-install.sh`.
- **Existing instance:** use `InstanceSettings.php` and run MediaWiki's `update --quick` when `.last-update` does not match the image marker.

If a previous installation or migration was interrupted, setup resumes that work first, using the progress saved under `/config/.wikibase-image/`. Installation records each phase after it completes, so the interrupted phase may run again, including custom hooks. Setup credentials must remain available until installation finishes.

For older installations, setup runs a [configuration migration](./setup/migration/migrate.sh) to separate instance settings from custom settings. It converts the legacy generated `LocalSettings.php` into the current two-file layout, preserves a backup under `/config/backups/`, and stops if it finds an unrecognized layout or conflicting edits.

## 2. Load configuration when MediaWiki runs

Files under `/var/www/html/extensions/WikibaseSuite/` belong to the image; files under `/config/` persist in the user-owned mounted configuration directory.

The extension establishes the following configuration loading order in [`/var/www/html/extensions/WikibaseSuite/config/Settings.php`](./config/Settings.php). Both setup's MediaWiki maintenance commands and normal application requests use this order:

1. `/config/InstanceSettings.php` (required) — the instance's identity, database connection, and secrets. Setup generates this file during initial installation using the supplied environment variables.
2. [`/var/www/html/extensions/WikibaseSuite/config/DefaultSettings.php`](./config/DefaultSettings.php) — image defaults, which can use the instance values loaded above.
3. `/config/BeforeExtensions.php`, if present — custom settings that need to take effect before extensions load.
4. [`/var/www/html/extensions/WikibaseSuite/config/LoadExtensions.php`](./config/LoadExtensions.php) — bundled extensions and their configuration profiles, including this extension.
5. `/config/LocalSettings.php` — if present, custom settings and additional extensions, loaded last so earlier settings can be overridden here. Setup creates this file, though MediaWiki can run without it. The generated template also loads `/config/Extensions.php` if present as a provision, but this load block is optional and can be safely removed if not used.

Once the instance is installed, its saved configuration is authoritative: changing initial-setup environment variables will not overwrite it. See the image's [environment reference](../../../../../../README.md#2-set-the-environment-variables) for those inputs.

## 3. Record completion and return

After a successful installation, migration, or image update, setup copies the image's update marker to `/config/.last-update`. This lets the next startup recognize that the instance is already up to date. Completed installation or migration also removes its working state. Setup then returns control to the image entry point, which starts Apache.

If setup fails, it leaves its progress available for the next startup attempt. Restarting retries the work; it does not roll back database changes. Keep the state files and markers so setup can identify unfinished work, and inspect the container logs before attempting recovery. Preserve the configuration and database state before making recovery changes.

## Testing changes

Use `wbs-dev test wikibase wikibase-extensions wikibase-client` for configuration and extension behavior, and `wbs-dev test upgrade` for legacy migration. Add interruption/retry cases when changing saved state. Test selection and fixtures are described in the [test guide](../../../../../../../../tests/README.md).
