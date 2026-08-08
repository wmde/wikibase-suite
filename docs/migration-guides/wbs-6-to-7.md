# Upgrading Wikibase Suite (WBS) from 6 to 7

This guide explains how to upgrade Wikibase Suite (WBS) from version 6 to 7 while preserving the existing installation and Docker volumes. It updates MediaWiki and the bundled extensions within the MediaWiki 1.45 release line.

> [!WARNING]
> On startup, the Wikibase Docker Image automatically applies the MediaWiki database schema updates. Do not remove `config/LocalSettings.php` or any Docker volumes as part of this upgrade.

## Prepare

1. If you have not already, [log in to your server and change to your WBS directory](../README.md#access-your-wbs-server).

2. Read the `CHANGELOG` entries for the target WBS release and images changed by this upgrade:

   - [WBS 7.0.0](https://github.com/wmde/wikibase-release-pipeline/blob/deploy%407.0.0/deploy/CHANGELOG.md#700-2026-04-20)
   - [Wikibase Docker Image changelog](https://github.com/wmde/wikibase-suite/blob/main/docker-images/wikibase/CHANGELOG.md)

3. If you modified tracked files such as `deploy/docker-compose.yml` or `deploy/config/Extensions.php`, commit those changes before switching versions.

4. Back up your data and configuration. See [Backing Up and Restoring](../backup-and-restore.md). The backup procedure stops WBS; continue directly with the migration.

## Migrate

1. While still in your WBS directory, ensure the services are stopped by running.

   ```sh
   docker compose down
   ```

2. Move to the repository root, fetch and check out WBS 7.0.0.

   ```sh
   cd ..
   git remote update
   git checkout deploy@7.0.0
   cd deploy
   ```

3. Reapply any tracked customizations you still need. Keep the WBS 7 files as the base rather than restoring the old files wholesale.

   This upgrade requires no new `.env` values. Preserve `deploy/.env` unchanged.

4. WBS 7 disables anonymous writes and self-service account creation by default for new installations. Existing installations retain their current anonymous-access behavior during an upgrade.

   To adopt the new defaults, add the following immediately after `# Add configuration values below which should be set after extensions are loaded` in `deploy/config/LocalSettings.php`:

   ```php
   $wgGroupPermissions['*']['edit'] = false;
   $wgGroupPermissions['*']['createpage'] = false;
   $wgGroupPermissions['*']['createtalk'] = false;
   $wgGroupPermissions['*']['writeapi'] = false;
   $wgGroupPermissions['*']['createaccount'] = false;
   ```

   Skip this step to retain the existing anonymous-access behavior.

5. WikibaseEdtf remains bundled but is no longer loaded by default. If the wiki uses the EDTF data type, uncomment this line in `deploy/config/Extensions.php`:

   ```php
   wfLoadExtension( 'WikibaseEdtf' );
   ```

6. If you installed extensions specifically for this instance, follow [Updating Extensions](../update-extensions.md).

7. Pull the new images and start WBS.

   ```sh
   docker compose pull
   docker compose up -d
   docker compose ps
   ```

8. If the wiki uses `mul` values, wait for the upgraded services to become healthy, then recreate and repopulate the Elasticsearch index.

   WBS 7 enables the `mul` language code. Existing content will not appear in typeahead results for `mul` values until the index is recreated and repopulated.

   ```sh
   docker compose exec wikibase php extensions/CirrusSearch/maintenance/UpdateSearchIndexConfig.php --startOver
   docker compose exec wikibase php extensions/CirrusSearch/maintenance/ForceSearchIndex.php --skipLinks --indexOnSkip
   docker compose exec wikibase php extensions/CirrusSearch/maintenance/ForceSearchIndex.php --skipParse
   ```

   Reindexing may take a significant amount of time on a large wiki. If the wiki does not use `mul` values, this step can be deferred until that functionality is needed.
