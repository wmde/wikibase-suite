# Resetting an Instance

Reset an instance when you need to run Wikibase Suite (WBS) setup again, usually after changing first-start values in `.env` or when another procedure directs you here.

Resetting deletes the current Docker volumes and generated configuration before running setup again. Back up any data or local configuration you want to preserve.

## Instructions

1. If you have not already, [log in to your server and change to your WBS directory](./README.md#access-your-wbs-server).

2. Back up anything you want to keep:

   - To keep wiki data, uploaded files, query data, certificates, or QuickStatements data, follow [Back up your data](./backup-and-restore.md#back-up-your-data).
   - To keep local configuration changes, follow [Back up your configuration](./backup-and-restore.md#back-up-your-configuration).

   Skip this step if you do not want to keep any existing data or configuration.

3. Remove the containers and Docker volumes.

   > [!WARNING]
   > This permanently deletes the live Docker volumes. Do not continue unless your backup is complete or you do not need to keep the existing data.

   ```sh
   docker compose down --volumes
   ```

4. Remove the generated configuration files.

   ```sh
   rm -vf config/{LocalSettings.php,wikibase-php.ini,wdqs-frontend-config.json}
   ```

5. Make the needed changes to `.env`.

   If you will restore existing data, do not change `DB_NAME`, `DB_USER`, or `DB_PASS` unless you also know how to migrate the matching MariaDB credentials manually. The restored database volume retains the old database credentials.

6. Start WBS. Setup runs again using the current `.env` values and image versions.

   ```sh
   docker compose up -d
   ```

If you did not back up anything in step 2, the reset is complete. Otherwise, continue:

7. After the Wikibase service starts successfully and `config/LocalSettings.php` exists, stop WBS.

   ```sh
   docker compose down
   ```

8. If you backed up local configuration, manually copy your local customizations into the new files in `config`. Keep the files created by setup as the base rather than restoring the generated files wholesale.

9. If you backed up instance data, follow [Restore from a backup](./backup-and-restore.md#restore-from-a-backup).

10. Start WBS.

    ```sh
    docker compose up -d
    ```
