# Upgrading Wikibase Suite (WBS) from 2 to 3

This guide explains how to upgrade Wikibase Suite (WBS) from version 2 to 3 while preserving the existing installation and Docker volumes. It upgrades the Wikibase Docker Image from MediaWiki 1.41.2 to MediaWiki 1.42.5 and updates the Query Service and routing configuration.

> [!WARNING]
> On startup, the Wikibase Docker Image automatically applies the MediaWiki database schema updates. Do not remove `config/LocalSettings.php` or any Docker volumes as part of this upgrade.

## Prepare

1. If you have not already, [log in to your server and change to your WBS directory](../README.md#access-your-wbs-server).

2. Read the `CHANGELOG` entries for the target WBS release and images changed by this upgrade:

   - [WBS 3.0.4](https://github.com/wmde/wikibase-release-pipeline/blob/deploy%403.0.4/deploy/CHANGELOG.md#304-2025-02-24)
   - [Wikibase Docker Image changelog](https://github.com/wmde/wikibase-suite/blob/main/docker-images/wikibase/CHANGELOG.md)
   - [Query Service Docker Image changelog](https://github.com/wmde/wikibase-suite/blob/main/docker-images/wdqs/CHANGELOG.md)

3. Prepare the configuration for MediaWiki 1.42.5.

   Read the [MediaWiki 1.42.5 UPGRADE file](https://github.com/wikimedia/mediawiki/blob/1.42.5/UPGRADE) and prepare any applicable customizations for MediaWiki 1.42.5.

4. Review the Query Service and routing changes.

   The Query Service Docker Image moves from version 1 to version 2 and requires the Wikibase concept URI. The WBS 3 Compose file supplies it from the existing `WIKIBASE_PUBLIC_HOST` value.

   WBS 3 removes the direct host ports previously published for Wikibase, the Query Service frontend, and QuickStatements. Traefik handles all external HTTP and HTTPS traffic. Reconcile any custom integration or firewall rules that use ports `8880`, `8834`, or `8840`.

   This upgrade requires no new `.env` values. Preserve the real hostnames and all other values in the existing `deploy/.env`. Do not replace them with the `.example` values from `template.env`, which replace the previous `.example.com` examples.

5. If you modified tracked files such as `deploy/docker-compose.yml`, commit those changes before switching versions.

6. Back up your data and configuration. See [Backing Up and Restoring](../backup-and-restore.md). The backup procedure stops WBS; continue directly with the migration.

## Migrate

1. While still in your WBS directory, ensure the services are stopped by running.

   ```sh
   docker compose down
   ```

2. Move to the repository root, fetch and check out WBS 3.0.4. This target includes all WBS 3 minor and patch updates.

   ```sh
   cd ..
   git remote update
   git checkout deploy@3.0.4
   cd deploy
   ```

3. Reapply any tracked customizations you still need. Keep the WBS 3 files as the base rather than restoring the old files wholesale.

4. If you installed extensions specifically for this instance, follow [Updating Extensions](../update-extensions.md).

5. Pull the new images and start WBS.

   ```sh
   docker compose pull
   docker compose up -d
   docker compose ps
   ```
