# Upgrading Wikibase Suite (WBS) from 1 to 2

This guide explains how to upgrade Wikibase Suite (WBS) from version 1 to 2 while preserving the existing installation and Docker volumes. It upgrades the Wikibase Docker Image from MediaWiki 1.39.8 to MediaWiki 1.41.2.

> [!WARNING]
> On startup, the Wikibase Docker Image automatically applies the MediaWiki database schema updates. Do not remove `config/LocalSettings.php` or any Docker volumes as part of this upgrade.

## Prepare

1. If you have not already, [log in to your server and change to your WBS directory](../README.md#access-your-wbs-server).

2. Read the [WBS and image release notes for WBS 2.0.0](https://github.com/wmde/wikibase-release-pipeline/blob/deploy%402.0.0/CHANGES.md#wikibase-release-pipeline-200).

3. Read the [MediaWiki 1.41.2 UPGRADE file](https://github.com/wikimedia/mediawiki/blob/1.41.2/UPGRADE) and prepare any applicable customizations for MediaWiki 1.41.2.

   This upgrade requires no new `.env` values. Preserve `deploy/.env` unchanged.

4. If you modified tracked files such as `deploy/docker-compose.yml`, commit those changes before switching versions.

5. Back up your data and configuration. See [Backing Up and Restoring](../backup-and-restore.md). The backup procedure stops WBS; continue directly with the migration.

## Migrate

1. While still in your WBS directory, ensure the services are stopped by running.

   ```sh
   docker compose down
   ```

2. Move to the repository root, fetch and check out WBS 2.0.0.

   ```sh
   cd ..
   git remote update
   git checkout deploy@2.0.0
   cd deploy
   ```

3. Reapply any tracked customizations you still need. Keep the WBS 2 files as the base rather than restoring the old files wholesale.

4. If you installed extensions specifically for this instance, follow [Updating Extensions](../update-extensions.md).

5. Pull the new images and start WBS.

   ```sh
   docker compose pull
   docker compose up -d
   docker compose ps
   ```
