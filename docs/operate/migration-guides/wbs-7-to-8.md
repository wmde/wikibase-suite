# Migrating from Wikibase Suite 7 to Wikibase Suite 8

Wikibase Suite 8 uses a new repository and project layout. These instructions
create a Suite 8 checkout beside the existing Suite 7 checkout, preserve its
configuration and Docker volumes, and start the upgraded deployment.

Follow these steps carefully and in order.

> [!WARNING]
> The first Suite 8 startup updates the database schema and configuration.
> Back up the Suite 7 deployment, including its Docker volumes and complete
> `deploy/config/` directory, before proceeding.

## Prepare

1. Read the changelogs for the target WBS release and the images changed by
   the upgrade:

   - [WBS changelog](../../../CHANGELOG.md)
   - [Wikibase image changelog](../../../development/images/wikibase/CHANGELOG.md)
   - [OpenSearch image changelog](../../../development/images/opensearch/CHANGELOG.md)
   - [QuickStatements image changelog](../../../development/images/quickstatements/CHANGELOG.md)

2. Follow [Backing Up and Restoring](../backup-and-restore.md) to back up the
   existing deployment. The backup procedure stops WBS, so continue directly
   with the migration afterward.

## Migration steps

1. In the Suite 7 checkout, stop the deployment:

   ```sh
   cd /path/to/wikibase-release-pipeline/deploy
   docker compose down
   ```

2. Clone Wikibase Suite 8 beside the existing Suite 7 checkout and check out
   the release tag you want to install. Replace the example tag with the target
   release:

   ```sh
   cd ../..
   git clone https://github.com/wmde/wikibase-suite.git
   cd wikibase-suite
   git checkout wbs@8.0.1
   ```

3. Copy the Suite 7 environment and configuration into the Suite 8 checkout.
   Adjust the source path if the checkouts are located elsewhere:

   ```sh
   cp -a ../wikibase-release-pipeline/deploy/.env .env
   cp -a ../wikibase-release-pipeline/deploy/config/. config/
   ```

4. If the Suite 7 deployment has a `docker-compose.override.yml`, copy it into
   the Suite 8 project root as well and review it for compatibility with the
   new Compose file.

5. Check whether extensions installed in `config/extensions` need an upgrade
   for the MediaWiki version included in Suite 8. See the
   [Wikibase image changelog](../../../development/images/wikibase/CHANGELOG.md)
   for the included MediaWiki version.

6. Pull the Suite 8 images and start the deployment:

   ```sh
   docker compose pull
   docker compose up -d
   ```

   The existing Docker volumes are reused.

7. Wait for the services to become healthy and verify the site. Review
   `config/LocalSettings.php` and confirm that it contains your custom settings,
   including any MediaWiki settings you changed in the previously generated
   section.

   Do not edit `config/InstanceSettings.php`. If any custom settings are missing,
   copy them into `config/LocalSettings.php` from
   `config/backups/LocalSettings.pre-wbs-8.php.backup`.

   If the Wikibase service does not start, inspect its logs:

   ```sh
   docker compose logs wikibase
   ```

8. After the upgrade is complete, it is safe to delete the old
   `wikibase-release-pipeline` directory and `config/backups/`. Keep your
   pre-upgrade backup until you are comfortable that everything is working.

> [!NOTE]
> Update any scripts, scheduled jobs, or services that use the old
> `wikibase-release-pipeline/deploy` path to use the `wikibase-suite` project
> root.
