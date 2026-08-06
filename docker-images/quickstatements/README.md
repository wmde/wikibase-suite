# Wikibase Suite (WBS) QuickStatements Docker Image

[QuickStatements](https://github.com/magnusmanske/quickstatements) is a tool to batch-edit [Wikibase](https://www.mediawiki.org/wiki/Wikibase).

This image contains QuickStatements and the required Magnustools library. It is ready to be connected to MediaWiki OAuth on a Wikibase Docker Image.

> 💡 This image is part of [Wikibase Suite (WBS)](https://github.com/wmde/wikibase-suite/blob/main/README.md), which provides everything you need to run a Wikibase instance on your own server. For an integrated setup, see the [`docker-compose.yml` file in the full Wikibase Suite (WBS) configuration](https://github.com/wmde/wikibase-suite/blob/main/docker-compose.yml).

## Setup

### 1) Provision the supporting services and configuration

- **MediaWiki/Wikibase instance**
    Enable the [OAuth extension](https://www.mediawiki.org/wiki/Extension:OAuth). We recommend the [Wikibase Docker Image](https://hub.docker.com/r/wikibase/wikibase), which is the image used in our tests. Other MediaWiki installations with the Wikibase and OAuth extensions should work but require manual setup.
- **OAuth consumer**
    Configure QuickStatements as an OAuth consumer on your Wikibase instance. For a manual setup, create the consumer on Wikibase:

    ```sh
    php /var/www/html/extensions/OAuth/maintenance/createOAuthConsumer.php \
            --approve \
            --callbackUrl  "$QUICKSTATEMENTS_PUBLIC_URL/api.php" \
            --callbackIsPrefix true --user "$MW_ADMIN_NAME" --name QuickStatements --description QuickStatements --version 1.0.1 \
            --grants createeditmovepage --grants editpage --grants highvolume --jsonOnSuccess
    ```

    Pass the resulting consumer key and secret to this container using `OAUTH_CONSUMER_KEY` and `OAUTH_CONSUMER_SECRET`.

- **Reverse proxy**
    If QuickStatements and Wikibase run on the same IP address, use a reverse proxy to route requests to the correct service based on the URL. The [`docker-compose.yml` file in the full Wikibase Suite (WBS) configuration](https://github.com/wmde/wikibase-suite/blob/main/docker-compose.yml) includes a reverse proxy setup using [Traefik](https://doc.traefik.io/traefik/).
- **DNS resolution**
    Make QuickStatements and Wikibase accessible through DNS domain names from both the Docker network and the user's browser so OAuth authorization works. The simplest approach is to connect both services to the internet and use public DNS domain names.

### 2) Set the environment variables

Variables in **bold** are required.

| Variable                         | Default     | Description                                                                                            |
| -------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| **`WIKIBASE_PUBLIC_URL`**        | undefined   | Host and port of Wikibase as seen by the user's browser (required)                                     |
| **`QUICKSTATEMENTS_PUBLIC_URL`** | undefined   | Host and port of QuickStatements as seen by the user's browser (required)                              |
| **`OAUTH_CONSUMER_KEY`**         | undefined   | OAuth consumer key (from MediaWiki), required on initial setup, stored in `/quickstatements/data`.     |
| **`OAUTH_CONSUMER_SECRET`**      | undefined   | OAuth consumer secret (from MediaWiki), required on initial setup, stored in `/quickstatements/data`.  |
| `WB_ITEM_NAMESPACE`              | 120         | Wikibase Item namespace                                                                                |
| `WB_PROPERTY_NAMESPACE`          | 122         | Wikibase Property namespace                                                                            |
| `WB_ITEM_PREFIX`                 | "Item:"     | Wikibase Item prefix                                                                                   |
| `WB_PROPERTY_PREFIX`             | "Property:" | Wikibase Property prefix                                                                               |
| `PHP_TIMEZONE`                   | "UTC"       | setting of php.ini date.timezone                                                                       |
| `LANGUAGE_CODE`                  | "en"        | Site language                                                                                          |
| `SITENAME`                       | "wikibase"  | Site name                                                                                              |

## Troubleshooting

### Known limitations

QuickStatements' "Run in background" option is not supported by this image.

QuickStatements' "Batches" require a database and are not supported by this image.

### OAuth errors

If you see an error such as `mw-oauth exception` when trying to log in, check that you have passed the correct consumer token and secret token to QuickStatements.

If you have changed the value of `$wgSecretKey` or `$wgOAuthSecretKey` since you made the consumer, you'll need to make another new consumer or reissue the secret token for the old one.

## Internal filesystem layout

The following paths can be used to extend this image. See the [Dockerfile](./Dockerfile) for its source.

| Path                                        | Description                                                                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/var/www/html/quickstatements`             | Base QuickStatements directory |
| `/var/www/html/quickstatements/public_html` | The Apache root folder         |
| `/var/www/html/magnustools`                 | Base magnustools directory     |
| `/templates/config.json`                     | Template for QuickStatements' config.json (substituted to `/var/www/html/quickstatements/public_html/config.json` in `entrypoint.sh`)              |
| `/templates/oauth.ini`                       | Template for QuickStatements' oauth.ini (substituted to `/quickstatements/data/oauth.ini` in `entrypoint.sh`)                                      |
| `/templates/php.ini`                         | PHP config (default provided sets date.timezone to prevent php complaining substituted to `/usr/local/etc/php/conf.d/php.ini` in `entrypoint.sh` ) |

## Releases

Official releases of this image can be found on [Docker Hub wikibase/quickstatements](https://hub.docker.com/r/wikibase/quickstatements).

See the [image changelog](./CHANGELOG.md) for release notes. Documentation at previous releases is preserved in the repository under the corresponding [`quickstatements@…` tag](https://github.com/wmde/wikibase-suite/tags).

This image uses the shared tag format for WBS Docker Images. See [WBS Versions](../../docs/versions.md).

## Authors & contact

This image is maintained by the Wikibase Suite Team at [Wikimedia Germany (WMDE)](https://wikimedia.de).

If you have questions not listed above or need help, use this [bug report form](https://phabricator.wikimedia.org/maniphest/task/edit/form/129/) to start a conversation with the engineering team.
