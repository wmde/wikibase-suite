# Uninstalling

Uninstalling removes the containers, Docker volumes, and generated configuration files for the instance.

If there is anything you want to keep, follow [Back up your data](./backup-and-restore.md#back-up-your-data) or [Back up your configuration](./backup-and-restore.md#back-up-your-configuration) before continuing.

Run these commands from the `wikibase-release-pipeline/deploy` directory:

```sh
docker compose down --volumes
rm -vf config/{LocalSettings.php,wikibase-php.ini,wdqs-frontend-config.json}
```

This removes the instance and its data from the server. If you later start WBS again from the same directory, it will run setup as a new instance.
