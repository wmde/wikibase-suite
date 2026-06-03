# Migrating from Wikibase Suite Deploy to Wikibase Suite

Use these instructions to move an existing Wikibase Suite installation from the old `wikibase-release-pipeline/deploy` checkout to the new `wikibase-suite` repository.

> [!IMPORTANT]
> Do not run the installer for an existing instance. The installer is for first-time setup. For an existing instance, move the existing configuration into a checkout of the new repository and restart the same Docker Compose stack there.

## Before you start

Back up your data and configuration before changing repository locations. See [Backup and restore](./backup-and-restore.md).

You will need:

- the path to your old `wikibase-release-pipeline/deploy` directory
- a new checkout of `https://github.com/wmde/wikibase-suite`
- your existing `.env` file
- your existing `config/` directory

## Migration steps

1. Clone the new repository location.

   ```sh
   git clone https://github.com/wmde/wikibase-suite
   cd wikibase-suite
   ```

2. Copy your existing configuration from the old deploy directory.

   Replace `/path/to/wikibase-release-pipeline/deploy` with the path to your old checkout:

   ```sh
   cp /path/to/wikibase-release-pipeline/deploy/.env ./.env
   cp -a /path/to/wikibase-release-pipeline/deploy/config/. ./config/
   ```

3. Stop the services from the old deploy directory.

   ```sh
   cd /path/to/wikibase-release-pipeline/deploy
   docker compose down
   ```

4. Start the services from the new repository directory.

   ```sh
   cd /path/to/wikibase-suite
   docker compose up -d
   ```

5. Check that the services are running.

   ```sh
   docker compose ps
   ```

## Notes

- The Docker Compose project name is currently kept as `wbs-deploy` so that existing containers and volumes can continue to be found by the new checkout.
- If you made local changes to `docker-compose.yml`, review and reapply those changes in the new checkout before starting services.
- If you installed custom extensions under `config/extensions`, confirm they were copied with the rest of the `config/` directory.
