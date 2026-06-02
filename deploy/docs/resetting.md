# Resetting an instance

Resetting an instance deletes generated state so Wikibase Suite (WBS) can run setup again. Resetting is required when changes are made to the `.env` file after initial setup. With the exception of `METADATA_CALLBACK`, `.env` values are setup values and should not be changed after initial setup without resetting again.

## 1. Back up data and configuration

If you are resetting a failed initial installation or otherwise do not want to keep existing data or local configuration changes, skip to [step 2](#2-reset-data-and-configuration).

If you want to keep wiki data, uploaded files, query data, certificates, or QuickStatements data, follow [Back up your data](./backup-and-restore.md#back-up-your-data).

If you want to keep local configuration changes as a reference, follow [Back up your configuration](./backup-and-restore.md#back-up-your-configuration).

## 2. Reset data and configuration

Remove containers and Docker volumes:

```sh
docker compose down --volumes
```

> [!WARNING]  
> This deletes the live Docker volumes. Do not run this command unless your backup is complete or you do not need to keep existing data.

Remove the generated configuration files:

```sh
rm -vf config/{LocalSettings.php,wikibase-php.ini,wdqs-frontend-config.json}
```

This tells WBS to run setup again using the current `.env` values and image versions.

## 3. Update setup values

Make any needed changes to `.env` before starting the stack again. If you are restoring data from a backup, keep the database values aligned with the backed-up database volume.

> [!WARNING]
> If you are preserving existing data, do not change `DB_NAME`, `DB_USER`, or `DB_PASS` during reset unless you also know how to migrate the matching MariaDB credentials manually. The restored database volume keeps the old database credentials.

If you are resetting as part of a major version upgrade, switch to the new WBS version and pull the updated images before the next start:

```sh
git remote update
git checkout deploy@3.0.3
docker compose pull
```

Replace `deploy@3.0.3` with the version you are upgrading to. See [Major upgrades](./updating.md#major-upgrades) for version-specific notes.

## 4. Start once to run setup again

Start the stack:

```sh
docker compose up -d
```

After the Wikibase service has started successfully and `config/LocalSettings.php` exists, stop the stack again:

```sh
docker compose down
```

If you backed up local configuration, review the backed-up generated files and manually copy any local customizations into the new files in `config`. Keep the files created by setup as the base.

## 5. Restore data, if needed

If you backed up Docker volumes in step 1, follow [Restore from a backup](./backup-and-restore.md#restore-from-a-backup).

If you did not back up Docker volumes in step 1, continue to [step 6](#6-start-the-instance-again).

## 6. Start the instance again

Start the stack again:

```sh
docker compose up -d
```
