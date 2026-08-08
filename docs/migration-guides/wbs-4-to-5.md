# Upgrading Wikibase Suite (WBS) from 4 to 5

This guide explains how to upgrade Wikibase Suite (WBS) from version 4 to 5 while preserving the existing installation and Docker volumes. It upgrades the Wikibase Docker Image from MediaWiki 1.43 to MediaWiki 1.44 and moves metadata callback handling into the Wikibase Docker Image.

> [!WARNING]
> On startup, the Wikibase Docker Image automatically applies the MediaWiki database schema updates. Do not remove `config/LocalSettings.php` or any Docker volumes as part of this upgrade.

## Prepare

1. If you have not already, [log in to your server and change to your WBS directory](../README.md#access-your-wbs-server).

2. Read the `CHANGELOG` entries for the target WBS release and images changed by this upgrade:

   - [WBS 5.0.1](https://github.com/wmde/wikibase-release-pipeline/blob/deploy%405.0.1/deploy/CHANGELOG.md#501-2025-08-26)
   - [Wikibase Docker Image changelog](https://github.com/wmde/wikibase-suite/blob/main/docker-images/wikibase/CHANGELOG.md)

3. Decide whether to opt into the metadata callback. During the migration, you will set `METADATA_CALLBACK` to `true` to opt in or `false` to opt out.

   ```dotenv
   METADATA_CALLBACK=false
   ```

   Do not replace the existing `.env` file or change its other setup values.

4. Read the [MediaWiki 1.44 UPGRADE file](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/core/+/refs/heads/REL1_44/UPGRADE) and identify any required changes. Do not update files under `deploy/config/extensions` while WBS is running, because that directory is mounted into the running container.

   This upgrade requires no other new `.env` values. Preserve the other values in `deploy/.env`.

5. If you modified tracked files such as `deploy/docker-compose.yml` or `deploy/config/Extensions.php`, commit those changes before switching versions.

6. Back up your data and configuration. See [Backing Up and Restoring](../backup-and-restore.md). The backup procedure stops WBS; continue directly with the migration.

## Migrate

1. While still in your WBS directory, ensure the services are stopped by running.

   ```sh
   docker compose down
   ```

2. Move to the repository root, fetch and check out WBS 5.0.1. This patch release corrects the Wikibase Docker Image reference shipped in WBS 5.0.0.

   ```sh
   cd ..
   git remote update
   git checkout deploy@5.0.1
   cd deploy
   ```

3. Reapply any tracked customizations you still need. Keep the WBS 5 files as the base rather than restoring the old files wholesale.

4. Set `METADATA_CALLBACK` in `deploy/.env` to the value you chose during preparation. Preserve every other existing value.

5. If you installed extensions specifically for this instance, follow [Updating Extensions](../update-extensions.md).

6. Pull the new images and start WBS.

   ```sh
   docker compose pull
   docker compose up -d
   docker compose ps
   ```
