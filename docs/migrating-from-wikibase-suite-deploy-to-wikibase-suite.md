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
- any local changes you made to `docker-compose.yml` or `docker-compose.override.yml`

## Migration steps

1. Clone the new repository location.

   ```sh
   git clone https://github.com/wmde/wikibase-suite
   cd wikibase-suite
   ```

2. Check out the same Wikibase Suite version that your existing installation uses.

   Replace `7.0.0` with your current Wikibase Suite version:

   ```sh
   git checkout 7.0.0
   ```

   If you are intentionally moving to a newer version at the same time, stop here and read [Updating](./updating.md) before continuing. For the lowest-risk migration, move to the same version first and update later.

3. Copy your existing configuration from the old deploy directory.

   Replace `/path/to/wikibase-release-pipeline/deploy` with the path to your old checkout:

   ```sh
   cp /path/to/wikibase-release-pipeline/deploy/.env ./.env
   cp -a /path/to/wikibase-release-pipeline/deploy/config/. ./config/
   ```

4. Reapply local Docker Compose changes if you have any.

   If you changed `docker-compose.yml` in the old checkout, review those changes and reapply only the parts that are still needed in the new checkout. If you used a `docker-compose.override.yml` file, copy or recreate it in the new checkout as appropriate.

5. Stop the services from the old deploy directory.

   ```sh
   cd /path/to/wikibase-release-pipeline/deploy
   docker compose down
   ```

6. Start the services from the new repository directory.

   ```sh
   cd /path/to/wikibase-suite
   docker compose up -d
   ```

7. Check that the services are running.

   ```sh
   docker compose ps
   ```
