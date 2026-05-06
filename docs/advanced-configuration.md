# Advanced configuration

On first launch, WBS Deploy will create files in the `deploy/config` directory. This is your instance configuration. **You own and control these files.** Be sure to include them in your backups.

## `config/LocalSettings.php`

This file is created by the [MediaWiki installer script](https://www.mediawiki.org/wiki/Manual:Install.php) and supplemented by the Wikibase container's `entrypoint.sh` script on first launch. Once this file has been created, you own and control it. You may _need_ to make changes to it for [MediaWiki major version updates](https://www.mediawiki.org/wiki/Manual:Upgrading#Adapt_your_LocalSettings.php).

The presence of `config/LocalSettings.php` controls whether WBS Deploy starts from existing configuration or runs MediaWiki setup during reset:

- If the file exists, the Wikibase container uses it.
- If the file is missing, the Wikibase container runs MediaWiki setup using the current image and environment.

This is why changing `.env` and restarting is not a supported way to reconfigure an existing setup. With the exception of `METADATA_CALLBACK`, `.env` values are first-start inputs that were already written into `LocalSettings.php`, the database volume, or other generated state.

If you need to reset, follow [Resetting or removing an instance](./resetting-and-removing.md). For a major version upgrade, follow the [major upgrade procedure](./updating.md#major-upgrades). Always keep a backup of your old `LocalSettings.php`, and copy local customizations into the file created during reset rather than restoring the old file wholesale.

## `config/wikibase-php.ini`

This is Wikibase's `php.ini` override file, a good place for tuning PHP configuration values. It gets loaded by the Mediawiki Wikibase web server's PHP interpreter.

## `config/wdqs-frontend-config.json`

This configuration file allows you to control `wdqs-frontend`, the GUI for the query service.

## docker-compose.yml

To further customize your instance, you can also make changes to `docker-compose.yml`. To ease updating to newer versions of WBS Deploy, consider putting your customizations into `docker-compose.override.yml` instead.

Docker Compose automatically reads `docker-compose.override.yml` when you run the default commands:

```sh
docker compose down
docker compose up
```

This way, your changes are kept separate from the original WBS Deploy code. If you use a different override filename, pass both files explicitly with `-f`.

## User-defined extensions

It is possible to add extensions to Wikibase Suite Deploy's MediaWiki. To learn how this works, consult the [README in `deploy/config/extensions`](../config/extensions/README.md).
