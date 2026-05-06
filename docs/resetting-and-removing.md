# Resetting an instance

Resetting an instance deletes generated state so WBS Deploy can run MediaWiki setup again. Resetting is required when changes are made to the `.env` file after initial setup. With the exception of `METADATA_CALLBACK`, `.env` values are setup values and should not be changed after initial setup without resetting again.

The backup step is optional if you are resetting a failed initial installation or otherwise do not want to keep existing data or local configuration changes.

> [!WARNING]
> If you are preserving existing data, do not change `DB_NAME`, `DB_USER`, or `DB_PASS` during reset unless you also know how to migrate the matching MariaDB credentials manually. The restored database volume keeps the old database credentials.

## 1. Back up data and configuration

If you want to keep wiki data, uploaded files, query data, certificates, or QuickStatements data, follow [Back up your data](./backup-and-restore.md#back-up-your-data).

If you want to keep local configuration changes as a reference, follow [Back up your configuration](./backup-and-restore.md#back-up-your-configuration).

Do not restore old generated configuration files wholesale after reset. Use the backup as a reference and manually re-apply your local changes into the configuration files created during reset.

## 2. Reset data and configuration

Remove containers and Docker volumes:

```sh
docker compose down --volumes
```

Warning: this deletes the live Docker volumes. Do not run this command unless your backup is complete or you do not need to keep existing data.

Remove the generated configuration files:

```sh
rm -vf config/{LocalSettings.php,wikibase-php.ini,wdqs-frontend-config.json}
```

This tells the stack to run setup again using the current `.env` values and image versions.

## 3. Update setup values

Make any needed changes to `.env` before starting the stack again. If you are restoring data from a backup, keep the database values aligned with the backed-up database volume.

If you are resetting as part of a major version upgrade, switch to the new WBS Deploy version and pull the updated images before the next start:

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

After the Wikibase container has started successfully and `config/LocalSettings.php` exists, stop the stack again:

```sh
docker compose down
```

If you backed up local configuration, review the backed-up generated files and manually copy any local customizations into the new files in `config`. Keep the files created by setup as the base.

## 5. Restore data, if needed

If you backed up Docker volumes in step 1, follow [Restore from a backup](./backup-and-restore.md#restore-from-a-backup).

Skip this step if you are intentionally starting with empty data.

## 6. Start the instance again

Start the stack again:

```sh
docker compose up -d
```

## Removing an instance completely

If you want to throw away the instance and all of its data, skip the backup step unless there is anything you want to keep. Then follow step 2 above and skip the remaining reset steps.

Removing the `traefik-letsencrypt-data` volume will request a new certificate from Let's Encrypt on the next launch of your instance. Certificate generation on Let's Encrypt is [rate-limited](https://letsencrypt.org/docs/rate-limits/); eventually you may be blocked from generating new certificates **for multiple days**. To avoid that outcome, change to the Let's Encrypt staging server by appending the following line to the `traefik` `command` stanza of your `docker-compose.yml` file:

```yml
--certificatesresolvers.letsencrypt.acme.caserver=https://acme-staging-v02.api.letsencrypt.org/directory
```
