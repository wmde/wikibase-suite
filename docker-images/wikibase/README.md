# Wikibase Suite (WBS) Wikibase Docker Image

[Wikibase](https://www.mediawiki.org/wiki/Wikibase) is a MediaWiki extension for working with versioned, semi-structured data in a central repository.

This image contains the Wikibase extension running on top of MediaWiki. Wikibase and several other extensions are bundled in addition to [those shipped by MediaWiki](https://www.mediawiki.org/wiki/Bundled_extensions_and_skins). The MediaWiki application runs on PHP with an Apache web server in a Debian base image.

> 💡 This image is part of [Wikibase Suite (WBS)](https://github.com/wmde/wikibase-suite/blob/main/README.md), which provides everything you need to run a Wikibase instance on your own server. For an integrated setup, see the [`docker-compose.yml` file in the full Wikibase Suite (WBS) configuration](https://github.com/wmde/wikibase-suite/blob/main/docker-compose.yml).

## Setup

### 1) Provision the supporting services and configuration

- **Database**
    MediaWiki connects to this database and stores all its data there. MediaWiki supports multiple database engines, but MariaDB is the most commonly used and the only engine against which this image is tested.
- **Configuration volume**
    Mount a configuration volume at `/config`. MediaWiki setup creates `/config/LocalSettings.php` on first launch; once created, you own and control that file.
    - If `/config/LocalSettings.php` exists, the image uses that file.
    - If `/config/LocalSettings.php` is missing, the image runs MediaWiki setup using the current image and environment.

- **Job runner**
    MediaWiki/Wikibase depends on [background jobs](https://www.mediawiki.org/wiki/Manual:Job_queue), which can run during HTTP requests or through a dedicated runner. The image's default configuration requires an external job runner. Run a second container from this image with its command set to `/jobrunner-entrypoint.sh`, and share the same configuration volume with it.

### 2) Set the environment variables

On first launch without `/config/LocalSettings.php`, the image uses the environment variables below to create the file. All variables other than `METADATA_CALLBACK`, `WIKIMEDIA_OAUTH_CONSUMER_TOKEN`, and `WIKIMEDIA_OAUTH_SECRET_TOKEN` are initial setup values and should not be changed after the image first starts.

Variables in **bold** are required, and the image fails to start if any of them is unset. Variables with default values do not need to be set explicitly.

| Variable                     | Default    | Description                                                                                                                                                                                                  |
| ---------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`DB_SERVER`**              | undefined  | Hostname and port for the MySQL server to use for MediaWiki & Wikibase                                                                                                                                       |
| **`DB_USER`**                | undefined  | Username to use for the MySQL server                                                                                                                                                                         |
| **`DB_PASS`**                | undefined  | Password to use for the MySQL server                                                                                                                                                                         |
| **`DB_NAME`**                | "my_wiki"  | Database name to use for the MySQL server                                                                                                                                                                    |
| **`MW_ADMIN_NAME`**          | undefined  | Admin username to create on MediaWiki first install                                                                                                                                                          |
| **`MW_ADMIN_PASS`**          | undefined  | Admin password to use for admin account on first install                                                                                                                                                     |
| **`MW_ADMIN_EMAIL`**         | undefined  | Email address to use for the admin account on first install                                                                                                                                                   |
| **`MW_WG_SERVER`**           | undefined  | `$wgServer` to use for MediaWiki. A value matching how this site is accessed from the user's browser is required.                                                                                            |
| **`MW_WG_SITENAME`**         | "wikibase" | `$wgSitename` to use for MediaWiki                                                                                                                                                                           |
| **`MW_WG_LANGUAGE_CODE`**    | "en"       | `$wgLanguageCode` to use for MediaWiki                                                                                                                                                                       |
| **`METADATA_CALLBACK`**      | undefined  | Set to `true` to include this Wikibase in Wikimedia Deutschland's ecosystem statistics, or `false` to opt out. May be changed after initial setup.                                                              |
| `ELASTICSEARCH_HOST`         | undefined  | Hostname of an OpenSearch server with the Wikibase search plugins installed, such as [wikibase/opensearch](https://hub.docker.com/r/wikibase/opensearch). The legacy variable name is retained for existing configuration. Leave this undefined to disable OpenSearch-backed search. |
| `QUICKSTATEMENTS_PUBLIC_URL` | undefined  | Public URL of the QuickStatements server, such as [wikibase/quickstatements](https://hub.docker.com/r/wikibase/quickstatements). Leave undefined to disable QuickStatements functionality.                   |
| `WDQS_PUBLIC_ENDPOINT_URL`   | undefined  | Public URL of the WDQS API, such as the one provided by [wikibase/wdqs](https://hub.docker.com/r/wikibase/wdqs). Leave undefined to disable WDQS integration.                                                |
| `WDQS_PUBLIC_FRONTEND_URL`   | undefined  | Public URL of the WDQS frontend, such as [wikibase/wdqs-frontend](https://hub.docker.com/r/wikibase/wdqs-frontend). Used by WikibaseManifest and by `<sparql tryit="1">` links. Leave undefined to disable WDQS integration. |
| `WIKIMEDIA_OAUTH_CONSUMER_TOKEN` | undefined | Consumer token from a Wikimedia OAuth 1.0a consumer. Wikimedia login is active only when this and the secret token below are provided. |
| `WIKIMEDIA_OAUTH_SECRET_TOKEN` | undefined | Secret token from that consumer. |

## Features

### Bundled extensions

| Bundled extension | Description |
| --- | --- |
| [Babel](https://www.mediawiki.org/wiki/Extension:Babel) | Adds a parser function to inform other users about language proficiency and categorize users of the same levels and languages. |
| [CLDR](https://www.mediawiki.org/wiki/Extension:CLDR) | Provides functions to localize the names of languages, countries, currencies, and time units based on their language code. |
| [DiscussionTools](https://www.mediawiki.org/wiki/Extension:DiscussionTools) | Adds modern discussion features such as reply links and add-topic workflows on talk pages. |
| [Elastica](https://www.mediawiki.org/wiki/Extension:Elastica), [CirrusSearch](https://www.mediawiki.org/wiki/Extension:CirrusSearch), and [WikibaseCirrusSearch](https://www.mediawiki.org/wiki/Extension:WikibaseCirrusSearch) | Provide OpenSearch integration for MediaWiki and Wikibase. See the [CirrusSearch documentation](https://www.mediawiki.org/wiki/Extension:CirrusSearch) for index maintenance and reindexing. |
| [Echo](https://www.mediawiki.org/wiki/Extension:Echo) | Provides notifications for user mentions, page activity, and other wiki events. |
| [EntitySchema](https://www.mediawiki.org/wiki/Extension:EntitySchema) | Stores Shape Expressions schemas on wiki pages. |
| [OAuth](https://www.mediawiki.org/wiki/Extension:OAuth) | Allows users to safely authorize another application (a “consumer”) to use the MediaWiki Action API on their behalf. |
| [PluggableAuth](https://www.mediawiki.org/wiki/Extension:PluggableAuth) and [WSOAuth](https://www.mediawiki.org/wiki/Extension:WSOAuth) | Let users authenticate to Wikibase with their Wikimedia account through a Meta-Wiki OAuth 1.0a consumer. |
| [UniversalLanguageSelector](https://www.mediawiki.org/wiki/Extension:UniversalLanguageSelector) | Allows users to select a language and configure its support. |
| [WikibaseEdtf](https://github.com/ProfessionalWiki/WikibaseEdtf) | Adds support for the Extended Date/Time Format (EDTF) specification through a new data type. Not loaded by default; add `wfLoadExtension('WikibaseEdtf');` to your local configuration to enable it. |
| [WikibaseInWikitext](https://github.com/wbstack/mediawiki-extensions-WikibaseInWikitext) | Adds a `<sparql>` tag for writing local Query Service examples on wiki pages. |
| [WikibaseLocalMedia](https://github.com/ProfessionalWiki/WikibaseLocalMedia) | Adds support for local media files to Wikibase through a new data type. |
| [WikibaseManifest](https://www.mediawiki.org/wiki/Extension:WikibaseManifest) | Provides metadata about the structured data repository through an API. |

### Login with Wikimedia

To enable Wikimedia login:

1. At [Wikimedia OAuth consumer registration](https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration/propose/oauth1a), propose a new OAuth 1.0a consumer.
2. Set its callback URL to `https://<your-wikibase-host>/w/index.php?title=Special:PluggableAuthLogin` with the default basic permissions.
3. In your WBS `.env` file, set `WIKIMEDIA_OAUTH_CONSUMER_TOKEN` and `WIKIMEDIA_OAUTH_SECRET_TOKEN` to the resulting consumer token and secret token.
4. From your WBS directory, apply the new configuration:

   ```sh
   docker compose up -d
   ```

### Visibility and ecosystem statistics

Help Wikimedia Deutschland understand the size and diversity of the Wikibase ecosystem by setting `METADATA_CALLBACK=true`. This includes your Wikibase in Wikimedia Deutschland's ecosystem statistics and registers its public URLs with the metadata service. Set `METADATA_CALLBACK=false` to opt out.

Once a week, the service reads a few public numbers from your instance: entities, triples, edits, and editors, along with the Wikibase and MediaWiki versions. It does not collect personal data such as usernames, email addresses, or IP addresses—only information that is already public. If your Wikibase requires a login, the service cannot collect statistics from protected data.

In the future, Wikimedia Deutschland plans to publish an index of Wikibases that includes information about which instances are ready for federation and reuse, helping Wikibases become discoverable across the ecosystem.

You can change this setting at any time. If your Wikibase was previously included, email its hostname to [wikibase-suite-support@wikimedia.de](mailto:wikibase-suite-support@wikimedia.de) to remove it from the index and stop periodic collection.

### Version reporting

The bundled Wikibase Suite extension adds entries to the `Special:Version` page under the “Installed software” section. It reports the version of this image and, when available, the deploy version.

The same values are also exposed through the Action API metadata endpoint: `/w/api.php?action=query&meta=wikibasesuite&wbsprop=versions&format=json`

When Wikimedia login is enabled, its aggregate linked-user count is exposed through the public metrics endpoint: `/w/api.php?action=query&meta=wikibasesuite&wbsprop=publicmetrics&format=json`. The `publicmetrics` object is empty when Wikimedia login is not enabled.

## Internal filesystem layout

The following paths can be used to extend this image. See the [Dockerfile](./Dockerfile) for its source.

| Path                               | Description                                                                                                                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/var/www/html`                    | Base MediaWiki directory                                                                                                                                                                      |
| `/var/www/html/images`             | MediaWiki image and media upload directory                                                                                                                                                    |
| `/var/www/html/skins`              | MediaWiki skins directory                                                                                                                                                                     |
| `/var/www/html/extensions`         | MediaWiki extensions directory                                                                                                                                                                |
| `/var/www/html/LocalSettings.d`    | Bundled extension configuration directory, loaded in alphabetical order by the image-managed extension loader                                                                                |
| `/post-mediawiki-update.d`         | Image-managed hooks run in lexical order after MediaWiki setup or `update.php`, before the service is ready                                                                                  |
| `/templates/`                      | Directory containing templates                                                                                                                                                                |
| `/healthcheck.sh`                  | Verifies that MediaWiki is serving requests.                                                                                                                                                   |
| `/default-extra-install.sh`        | Script for automatically creating OpenSearch indices and creating OAuth consumer for QuickStatements                                                                                           |
| `/extra-install.sh`                | Optional script for custom functionality to be run during MediaWiki setup                                                                                                                      |
| `/LocalSettings.MediaWiki.php`     | Image-managed core MediaWiki defaults loaded before bundled extensions.                                                                                                                        |
| `/LocalSettings.Extensions.php`    | Image-managed loader for bundled extension configuration in `/var/www/html/LocalSettings.d`.                                                                                                   |
| `/templates/LocalSettings.wbs.php` | Wikibase-specific settings appended during MediaWiki setup. It provides the stable `require_once` lines for the image-managed MediaWiki and extension loading phases.                            |

## Releases

Official releases of this image can be found on [Docker Hub wikibase/wikibase](https://hub.docker.com/r/wikibase/wikibase).

See the [image changelog](./CHANGELOG.md) for release notes. Documentation at previous releases is preserved in the repository under the corresponding [`wikibase@…` tag](https://github.com/wmde/wikibase-suite/tags).

This image uses the shared tag format for WBS Docker Images. See [WBS Versions](../../docs/versions.md).

In addition to the standard tags, this image also publishes a tag that includes the bundled MediaWiki version.

| Tag | Example | Description |
| --- | --- | --- |
| mw*MW-VERSION* | mw1.46.0 | Points to the latest image release containing that MediaWiki version. |

## Authors & contact

This image is maintained by the Wikibase Suite Team at [Wikimedia Germany (WMDE)](https://wikimedia.de).

If you have questions not listed above or need help, use this [bug report form](https://phabricator.wikimedia.org/maniphest/task/edit/form/129/) to start a conversation with the engineering team.
