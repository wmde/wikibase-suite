# Configuration Files

On first launch, Wikibase Suite (WBS) will create files in the `config` directory. This is your instance configuration. You own and control these files. Be sure to include them in your backups.

## config/LocalSettings.php

This file is created by the [MediaWiki installer script](https://www.mediawiki.org/wiki/Manual:Install.php) and supplemented by the Wikibase container's `entrypoint.sh` script on first launch. Once this file has been created, you own and control it. You may _need_ to make changes to it for [MediaWiki major version updates](https://www.mediawiki.org/wiki/Manual:Upgrading#Adapt_your_LocalSettings.php).

The presence of `config/LocalSettings.php` controls whether WBS starts from existing configuration or runs setup during reset:

- If the file exists, the Wikibase service uses it.
- If the file is missing, the Wikibase service runs setup using the current image and environment.

This is why changing `.env` and restarting is not a supported way to reconfigure an existing setup. With the exception of `METADATA_CALLBACK`, `WIKIMEDIA_OAUTH_CONSUMER_TOKEN`, and `WIKIMEDIA_OAUTH_SECRET_TOKEN`, `.env` values are first-start inputs that were already written into `LocalSettings.php`, the database volume, or other generated state.

If you need to change first-start setup values, follow [Resetting an Instance](./reset.md).

To enable or update login with a Wikimedia account, follow [Enabling Login with Wikimedia](./enable-login-with-wikimedia.md).

For a major version upgrade, preserve the existing configuration and follow the [major upgrade procedure](./upgrade.md#major-version-upgrades).

After changing `config/LocalSettings.php`, restart the Wikibase and job-runner services:

```sh
docker compose restart wikibase wikibase-jobrunner
```

## config/wikibase-php.ini

This is Wikibase's `php.ini` override file, a good place for tuning PHP configuration values. It gets loaded by the MediaWiki Wikibase web server's PHP interpreter.

After changing `config/wikibase-php.ini`, restart the Wikibase and job-runner services:

```sh
docker compose restart wikibase wikibase-jobrunner
```

## config/wdqs-frontend-config.json

This configuration file allows you to control `wdqs-frontend`, the GUI for the Query Service.

After changing `config/wdqs-frontend-config.json`, restart the Query Service frontend:

```sh
docker compose restart wdqs-frontend
```

By default, query examples are loaded from the local Wikibase page `Project:SPARQL/examples`. Administrators can create that page and add local examples with `<sparql>` blocks. On startup, an existing configuration that still points at Wikidata is migrated by removing that legacy setting; a deliberately configured non-Wikidata examples source is preserved.

## docker-compose.yml

To further customize your instance, you can also make changes to `docker-compose.yml`. To ease updating to newer versions of WBS, consider putting your customizations into `docker-compose.override.yml` instead.

Docker Compose automatically reads `docker-compose.override.yml`. Apply your changes by running:

```sh
docker compose up -d
```

This way, your changes are kept separate from the original WBS code. If you use a different override filename, pass both files explicitly with `-f`.
