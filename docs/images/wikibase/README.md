# Wikibase Suite (WBS) Wikibase image

[Wikibase](https://www.mediawiki.org/wiki/Wikibase) is a MediaWiki extension for working with versioned, semi-structured data in a central repository.

This image contains the Wikibase extension running on top of MediaWiki. Wikibase and several other extensions are bundled in addition to [those hipped by MediaWiki](https://www.mediawiki.org/wiki/Bundled_extensions_and_skins). The MediaWiki application runs on top of PHP on an Apache web server in a Debian base image.

> 💡 This image is part of [Wikibase Suite (WBS)](https://github.com/wmde/wikibase-release-pipeline/blob/main/README.md) which provides everything you need to run a Wikibase instance on your own server.

## Bundled extensions

| Bundled Extension                                                                                                                                                                                                           | Description                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [Babel](https://www.mediawiki.org/wiki/Extension:Babel)                                                                                                                                                                     | Adds a parser function to inform other users about language proficiency and categorize users of the same levels and languages. |
| [CLDR](https://www.mediawiki.org/wiki/Extension:CLDR)                                                                                                                                                                       | Provides functions to localize the names of languages, countries, currencies, and time units based on their language code.     |
| [ConfirmAccount](https://www.mediawiki.org/wiki/Extension:ConfirmAccount)                                                                                                                                                   | Requires account requests to be reviewed and approved by a bureaucrat before an account is created.                            |
| [DiscussionTools](https://www.mediawiki.org/wiki/Extension:DiscussionTools)                                                                                                                                                 | Adds modern discussion features such as reply links and add-topic workflows on talk pages.                                      |
| [Elastica](https://www.mediawiki.org/wiki/Extension:Elastica), [CirrusSearch](https://www.mediawiki.org/wiki/Extension:CirrusSearch), [WikibaseCirrusSearch](https://www.mediawiki.org/wiki/Extension:WikibaseCirrusSearch) | OpenSearch integration for MediaWiki and Wikibase. See the [CirrusSearch documentation](https://www.mediawiki.org/wiki/Extension:CirrusSearch) for index maintenance and reindexing. |
| [Echo](https://www.mediawiki.org/wiki/Extension:Echo)                                                                                                                                                                       | Provides notifications for user mentions, page activity, and other wiki events.                                                |
| [EntitySchema](https://www.mediawiki.org/wiki/Extension:EntitySchema)                                                                                                                                                       | Allows to store Shape Expression Schemas on wiki pages.                                                                        |
| [OAuth](https://www.mediawiki.org/wiki/Extension:OAuth)                                                                                                                                                                     | Allow users to safely authorize another application ("consumer") to use the MediaWiki action API on their behalf.              |
| [PluggableAuth](https://www.mediawiki.org/wiki/Extension:PluggableAuth) and [WSOAuth](https://www.mediawiki.org/wiki/Extension:WSOAuth) | Let users authenticate to the Wikibase with their Wikimedia account through a Meta-Wiki OAuth 1.0a consumer. |
| [UniversalLanguageSelector](https://www.mediawiki.org/wiki/Extension:UniversalLanguageSelector)                                                                                                                             | Tool that allows users to select a language and configure its support in an easy way.                                          |
| [WikibaseEdtf](https://github.com/ProfessionalWiki/WikibaseEdtf)                                                                                                                                                            | Adds support for the Extended Date/Time Format (EDTF) Specification via a new data type.<br />*NOTE: Not loaded by default, to enable add `wfLoadExtension('WikibaseEdtf');` in your local configuration.*|
| [WikibaseInWikitext](https://github.com/wbstack/mediawiki-extensions-WikibaseInWikitext)                                                                                                                                     | Adds a `<sparql>` tag for writing local Query Service examples on wiki pages.                                                  |
| [WikibaseLocalMedia](https://github.com/ProfessionalWiki/WikibaseLocalMedia)                                                                                                                                                | Adds support for local media files to Wikibase via a new data type.                                                            |
| [WikibaseManifest](https://www.mediawiki.org/wiki/Extension:WikibaseManifest)                                                                                                                                               | API-provided metadata for structured data repository.                                                                          |

## Requirements

In order to run Wikibase, you need:

- Database
- Configuration volume
- Initial settings via environment variables
- Job runner

### Database

This is the database MediaWiki will connect to and store all its data in. Technically, MediaWiki supports multiple database engines, but MariaDB is the most commonly used. This is also the only engine used to test the image before release.

### Configuration volume

MediaWiki setup creates a `LocalSettings.php` file on first launch. Once this file has been created, you own and control it. This file is stored in the configuration volume.

A configuration volume mounted at `/config` is required. The presence of `/config/LocalSettings.php` controls whether the image starts from existing configuration or runs MediaWiki setup:

- If `/config/LocalSettings.php` exists, the image uses that file.
- If `/config/LocalSettings.php` is missing, the image runs MediaWiki setup using the current image and environment.

The image reads setup environment variables when it creates `LocalSettings.php`. After `LocalSettings.php` exists, the image starts from that existing configuration.

### Environment variables

These values are used for initial setup only and should not be changed without recreating the instance. To change them after first setup, follow the [Reset WBS](../../operating/reset.md) procedure.

> [!NOTE]
> `METADATA_CALLBACK`, `WIKIMEDIA_OAUTH_CONSUMER_KEY`, and `WIKIMEDIA_OAUTH_CONSUMER_SECRET` are exceptions and may be changed after initial setup.

Variables in **bold** are required on first launch without `LocalSettings.php` in the configuration volume. The image will fail to start if one of those variables does not have a value. Default values do not need to be overwritten.

| Variable                     | Default    | Description                                                                                                                                                                                                  |
| ---------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`DB_SERVER`**              | undefined  | Hostname and port for the MySQL server to use for MediaWiki & Wikibase                                                                                                                                       |
| **`DB_USER`**                | undefined  | Username to use for the MySQL server                                                                                                                                                                         |
| **`DB_PASS`**                | undefined  | Password to use for the MySQL server                                                                                                                                                                         |
| **`DB_NAME`**                | "my_wiki"  | Database name to use for the MySQL server                                                                                                                                                                    |
| **`MW_ADMIN_NAME`**          | undefined  | Admin username to create on MediaWiki first install                                                                                                                                                          |
| **`MW_ADMIN_PASS`**          | undefined  | Admin password to use for admin account on first install                                                                                                                                                     |
| **`MW_ADMIN_EMAIL`**         | undefined  | Admin password to use for admin account on first install                                                                                                                                                     |
| **`MW_WG_SERVER`**           | undefined  | `$wgServer` to use for MediaWiki. A value matching how this site is accessed from the user's browser is required.                                                                                            |
| **`MW_WG_SITENAME`**         | "wikibase" | `$wgSitename` to use for MediaWiki                                                                                                                                                                           |
| **`MW_WG_LANGUAGE_CODE`**    | "en"       | `$wgLanguageCode` to use for MediaWiki                                                                                                                                                                       |
| **`METADATA_CALLBACK`**      | undefined  | Wikibase Suite Call Back, join an index of known publicly accessible wikibase instances. Set to `true` or `false`. May be changed after initial setup.                                                           |
| `ELASTICSEARCH_HOST`         | undefined  | Hostname of an OpenSearch server with the Wikibase search plugins installed, such as [wikibase/opensearch](https://hub.docker.com/r/wikibase/opensearch). The legacy variable name is retained for existing configuration. Leave this undefined to disable OpenSearch-backed search. |
| `QUICKSTATEMENTS_PUBLIC_URL` | undefined  | Public URL of the QuickStatements server, such as [wikibase/quickstatements](https://hub.docker.com/r/wikibase/quickstatements). Leave undefined to disable QuickStatements functionality.                   |
| `WDQS_PUBLIC_ENDPOINT_URL`   | undefined  | Public URL of the WDQS API, such as the one provided by [wikibase/wdqs](https://hub.docker.com/r/wikibase/wdqs). Leave undefined to disable WDQS integration.                                                |
| `WDQS_PUBLIC_FRONTEND_URL`   | undefined  | Public URL of the WDQS frontend, such as [wikibase/wdqs-frontend](https://hub.docker.com/r/wikibase/wdqs-frontend). Used by WikibaseManifest and by `<sparql tryit="1">` links. Leave undefined to disable WDQS integration. |
| `WIKIMEDIA_OAUTH_CONSUMER_KEY` | undefined | Client application key from a Wikimedia OAuth 1.0a consumer. Wikimedia login is active only when this and the secret below are provided. |
| `WIKIMEDIA_OAUTH_CONSUMER_SECRET` | undefined | Client application secret from that consumer. |

### Wikimedia OAuth login

To enable Wikimedia login:

1. At [Wikimedia OAuth consumer registration](https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration/propose/oauth1a), propose a new OAuth 1.0a consumer.
2. Set its callback URL to `https://<your-wikibase-host>/w/index.php?title=Special:PluggableAuthLogin` with the default basic permissions.
3. In your WBS `.env` file, set `WIKIMEDIA_OAUTH_CONSUMER_KEY` and `WIKIMEDIA_OAUTH_CONSUMER_SECRET` to the resulting client application key and secret.
4. From your WBS directory, apply the new configuration:

   ```sh
   docker compose up -d
   ```

### Job runner

MediaWiki/Wikibase depends on [jobs being run in the background](https://www.mediawiki.org/wiki/Manual:Job_queue). This can be either done on HTTP request or by a dedicated job runner. The default configuration of this image requires an external job runner like this.

To set up an external job runner, use this image for a second container, overwrite the command to `/jobrunner-entrypoint.sh` and share the same configuration volume with it.

## Example

For an integrated Docker Compose example showing how this image is used in the full WBS configuration, see the root [docker-compose.yml](https://github.com/wmde/wikibase-release-pipeline/blob/main/docker-compose.yml).

## Wikibase Suite Call Back

The Wikibase image has a Call Back feature. This initiative will help maintain an index of Wikibases. The goal of this index is to gather more quantitative data to learn more about how Wikibase is being used. It eventually also aims to be a central hub for data re-use and federation initiatives between Wikibases, where users can discover other Wikibases easily. In the near future, we expect to have a proper showcase of all the Wikibases that have opted in so as to increase discoverability. For now, however, this data will remain only with Wikimedia Deutschland.

You can join this initiative by setting `METADATA_CALLBACK=true` or disable the feature by setting `METADATA_CALLBACK=false` as environment variable. If you enable the feature, your hostnames configured as environment variables will be shared and added to the list. We will then be able to periodically analyze **publicly available information on your Wikibase instance**. It is important to note that we can only access publicly visible information. If your Wikibase instance requires a login to view data, we will not be able to collect statistics.

You can disable the feature at any time by setting `METADATA_CALLBACK=false` in your environment variables and by sending an E-Mail to [wikibase-suite-support@wikimedia.de](mailto:wikibase-suite-support@wikimedia.de) containing your hostname to remove your instance from the listing and stop periodic analysis.

Let's build the Linked Open Data Web together!

## Version reporting

The bundled Wikibase Suite extension adds entries to the `Special:Version` page under the “Installed software” section. It reports the version of this image and, when available, the build-tools and deploy versions.

The same values are also exposed through the Action API metadata endpoint: `/w/api.php?action=query&meta=wikibasesuite&wbsprop=versions&format=json`

When Wikimedia login is enabled, its aggregate linked-user count is exposed through the public metrics endpoint: `/w/api.php?action=query&meta=wikibasesuite&wbsprop=publicmetrics&format=json`. The `publicmetrics` object is empty when Wikimedia login is not enabled.

## Releases

Official releases of this image can be found on [Docker Hub wikibase/wikibase](https://hub.docker.com/r/wikibase/wikibase).

See the [image changelog](https://github.com/wmde/wikibase-release-pipeline/blob/main/development/images/wikibase/CHANGELOG.md) for release notes. Documentation at previous releases is preserved in the repository under the corresponding [`wikibase@…` tag](https://github.com/wmde/wikibase-release-pipeline/tags).

## Versioning

This image uses the shared WBS image tag format. See [WBS Versions](https://github.com/wmde/wikibase-release-pipeline/blob/main/docs/versions.md).

In addition to the standard tags, this image also publishes a tag that includes the bundled MediaWiki version.

| Tag | Example | Description |
| --- | --- | --- |
| mw*MW-VERSION* | mw1.46.0 | Points to the latest image release containing that MediaWiki version. |

## Internal filesystem layout

Hooking into the internal filesystem can extend the functionality of this image.

| Directory                       | Description                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `/var/www/html`                 | Base MediaWiki directory                                                                                       |
| `/var/www/html/images`          | MediaWiki image and media upload directory                                                                     |
| `/var/www/html/skins`           | MediaWiki skins directory                                                                                      |
| `/var/www/html/extensions`      | MediaWiki extensions directory                                                                                 |
| `/var/www/html/LocalSettings.d` | Bundled extension configuration directory, loaded in alphabetical order by the image-managed extension loader |
| `/post-mediawiki-update.d`      | Image-managed hooks run in lexical order after MediaWiki setup or `update.php`, before the service is ready   |
| `/templates/`                   | Directory containing templates                                                                                 |

| File                               | Description                                                                                                                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/healthcheck.sh`                  | Verifies that MediaWiki is serving requests.                                                                                                                                                   |
| `/default-extra-install.sh`        | Script for automatically creating OpenSearch indices and creating OAuth consumer for QuickStatements                                                                                           |
| `/extra-install.sh`                | Optional script for custom functionality to be run during MediaWiki setup                                                                                                                      |
| `/LocalSettings.MediaWiki.php` | Image-managed core MediaWiki defaults loaded before bundled extensions.                                                                                                                         |
| `/LocalSettings.Extensions.php` | Image-managed loader for bundled extension configuration in `/var/www/html/LocalSettings.d`.                                                                                                 |
| `/templates/LocalSettings.wbs.php` | Wikibase-specific settings appended during MediaWiki setup. It provides the stable `require_once` lines for the image-managed MediaWiki and extension loading phases. |

## Source

This image is built from this [Dockerfile](https://github.com/wmde/wikibase-release-pipeline/blob/main/development/images/wikibase/Dockerfile).

## Authors & contact

This image is maintained by the Wikibase Suite Team at [Wikimedia Germany (WMDE)](https://wikimedia.de).

If you have questions not listed above or need help, use this [bug report form](https://phabricator.wikimedia.org/maniphest/task/edit/form/129/) to start a conversation with the engineering team.
