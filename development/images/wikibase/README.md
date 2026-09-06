# Wikibase Suite (WBS) Wikibase Docker Image

[Wikibase](https://www.mediawiki.org/wiki/Wikibase) is a MediaWiki extension for working with versioned, semi-structured data in a central repository.

This image contains the Wikibase extension running on top of MediaWiki. Wikibase and several other extensions are bundled in addition to [those shipped by MediaWiki](https://www.mediawiki.org/wiki/Bundled_extensions_and_skins). The MediaWiki application runs on PHP with an Apache web server in a Debian base image.

> 💡 This image is part of [Wikibase Suite (WBS)](https://github.com/wmde/wikibase-suite/blob/main/README.md), which provides everything you need to run a Wikibase instance on your own server. For an integrated setup, see the [`docker-compose.yml` file in the full Wikibase Suite (WBS) configuration](https://github.com/wmde/wikibase-suite/blob/main/docker-compose.yml).

## Setup

### 1) Provision the supporting services and configuration

- **Database**
    MediaWiki connects to this database and stores all its data there. MediaWiki supports multiple database engines, but MariaDB is the most commonly used and the only engine against which this image is tested.
- **Configuration volume**
    Mount a configuration volume at `/config`. On first launch, the image
    creates `InstanceSettings.php` for generated instance values and
    `LocalSettings.php` for user configuration. Do not edit
    `InstanceSettings.php`; add MediaWiki customizations to `LocalSettings.php`,
    which is loaded after image defaults and image-loaded extensions.

    Configure additional extensions in `LocalSettings.php` using normal
    MediaWiki PHP configuration. For compatibility, it also loads a separate
    `Extensions.php` from the same directory when present.

- **Job runner**
    MediaWiki/Wikibase depends on [background jobs](https://www.mediawiki.org/wiki/Manual:Job_queue), which can run during HTTP requests or through a dedicated runner. The image's default configuration requires an external job runner. Run a second container from this image with its command set to `jobrunner`, share the same configuration volume with it, and start it after the web workload has created `InstanceSettings.php`.

### 2) Set the environment variables

#### Initial setup

These values are used only when installing a new instance. Once
`InstanceSettings.php` exists, changes to them are ignored even when the
container is recreated. Change an installed instance through the appropriate
MediaWiki or service-specific procedure instead. Variables in **bold** must be
set explicitly; values with defaults do not need to be set.

| Variable                     | Default    | Description                                                                                                                                                                                                  |
| ---------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`DB_SERVER`**              |            | Hostname and port for the MySQL server to use for MediaWiki & Wikibase                                                                                                                                       |
| **`DB_USER`**                |            | Username to use for the MySQL server                                                                                                                                                                         |
| **`DB_PASS`**                |            | Password to use for the MySQL server                                                                                                                                                                         |
| `DB_NAME`                    | "my_wiki"  | Database name to use for the MySQL server                                                                                                                                                                    |
| **`MW_ADMIN_NAME`**          |            | Admin username to create on MediaWiki first install                                                                                                                                                          |
| **`MW_ADMIN_PASS`**          |            | Admin password to use for admin account on first install                                                                                                                                                     |
| **`MW_ADMIN_EMAIL`**         |            | Email address to use for admin account on first install                                                                                                                                                      |
| **`MW_WG_SERVER`**           |            | `$wgServer` to use for MediaWiki. A value matching how this site is accessed from the user's browser is required.                                                                                            |
| `MW_WG_SITENAME`             | "wikibase" | `$wgSitename` to use for MediaWiki                                                                                                                                                                           |
| `MW_WG_LANGUAGE_CODE`        | "en"       | `$wgLanguageCode` to use for MediaWiki                                                                                                                                                                       |
| `ELASTICSEARCH_HOST`         |            | Hostname of an OpenSearch server with the Wikibase search plugins installed, such as [wikibase/opensearch](https://hub.docker.com/r/wikibase/opensearch). The legacy variable name is retained for existing configuration. Leave unset to disable OpenSearch-backed search. |

#### Runtime configuration

These values continue to be read from the container environment after setup.
Recreate the container to apply changes (for example, `docker compose down`
followed by `docker compose up -d`); restarting an existing container with
`docker compose restart` keeps its previous environment. Variables in **bold**
must be set explicitly.

| Variable                     | Default | Description                                                                                                                                                                                     |
| ---------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`METADATA_CALLBACK`**      |         | Set to `true` to include this Wikibase in Wikimedia Deutschland's ecosystem statistics, or `false` to opt out.                                                                                 |
| `WDQS_PUBLIC_ENDPOINT_URL`   |         | Public URL of the WDQS API, such as the one provided by [wikibase/wdqs](https://hub.docker.com/r/wikibase/wdqs). Leave unset to disable WDQS integration.                                      |
| `WDQS_PUBLIC_FRONTEND_URL`   |         | Public URL of the WDQS frontend, such as [wikibase/wdqs-frontend](https://hub.docker.com/r/wikibase/wdqs-frontend). Used by WikibaseManifest and by `<sparql tryit="1">` links. Leave unset to disable WDQS integration. |
| `WIKIMEDIA_OAUTH_CONSUMER_TOKEN` | | Consumer token from a Wikimedia OAuth 1.0a consumer. Wikimedia login is active only when this and the secret token below are provided.                                                    |
| `WIKIMEDIA_OAUTH_SECRET_TOKEN` | | Secret token from that consumer.                                                                                                                                                            |
| `QUICKSTATEMENTS_PUBLIC_URL` |         | Public URL of the QuickStatements server, such as [wikibase/quickstatements](https://hub.docker.com/r/wikibase/quickstatements). Initial setup also uses it to create the OAuth consumer; changing it later does not update that consumer. |
| `REDIS_SERVER`               |         | Redis server address. Enables Redis for the main cache and session store when using the default WBS configuration. |
| `REDIS_PASSWORD`             |         | Password for a protected Redis server. |

## Features

### Bundled extensions

The image's default extension loading includes both MediaWiki-provided
extensions and additional packages placed in this image.

| Bundled extension | Enabled | Description |
| --- | --- | --- |
| [AdvancedSearch](https://www.mediawiki.org/wiki/Extension:AdvancedSearch) | No | Adds an advanced search interface. |
| [Babel](https://www.mediawiki.org/wiki/Extension:Babel) | Yes | Adds a parser function to inform other users about language proficiency and categorize users of the same levels and languages. |
| [CLDR](https://www.mediawiki.org/wiki/Extension:CLDR) | Yes | Provides functions to localize the names of languages, countries, currencies, and time units based on their language code. |
| [CodeMirror](https://www.mediawiki.org/wiki/Extension:CodeMirror) | No | Adds an in-browser code editor. |
| [ConfirmAccount](https://www.mediawiki.org/wiki/Extension:ConfirmAccount) | No | Lets administrators review and approve account requests. |
| [DeleteBatch](https://www.mediawiki.org/wiki/Extension:DeleteBatch) | No | Lets administrators delete many pages at once. |
| [Elastica](https://www.mediawiki.org/wiki/Extension:Elastica), [CirrusSearch](https://www.mediawiki.org/wiki/Extension:CirrusSearch), and [WikibaseCirrusSearch](https://www.mediawiki.org/wiki/Extension:WikibaseCirrusSearch) | Yes | Provide OpenSearch integration for MediaWiki and Wikibase. Enabled when `ELASTICSEARCH_HOST` is set. See the [CirrusSearch documentation](https://www.mediawiki.org/wiki/Extension:CirrusSearch) for index maintenance and reindexing. |
| [EmbedVideo](https://www.mediawiki.org/wiki/Extension:EmbedVideo) | No | Embeds supported video services in wiki pages. |
| [EntitySchema](https://www.mediawiki.org/wiki/Extension:EntitySchema) | Yes | Stores Shape Expressions schemas on wiki pages. |
| [InviteSignup](https://www.mediawiki.org/wiki/Extension:InviteSignup) | No | Restricts account creation to invitations issued by authorized users. |
| [JsonConfig](https://www.mediawiki.org/wiki/Extension:JsonConfig) | No | Stores JSON configuration pages in a dedicated content model. |
| [Kartographer](https://www.mediawiki.org/wiki/Extension:Kartographer) | No | Adds interactive maps. Requires a compatible map-tile server. |
| [Mailgun](https://www.mediawiki.org/wiki/Extension:Mailgun) | No | Sends MediaWiki email through the Mailgun API. |
| [MobileFrontend](https://www.mediawiki.org/wiki/Extension:MobileFrontend) | No | Adapts the wiki interface for mobile devices. |
| [OAuth](https://www.mediawiki.org/wiki/Extension:OAuth) | Yes | Allows users to safely authorize another application (a “consumer”) to use the MediaWiki Action API on their behalf. |
| [PluggableAuth](https://www.mediawiki.org/wiki/Extension:PluggableAuth) and [WSOAuth](https://www.mediawiki.org/wiki/Extension:WSOAuth) | Yes | Let users authenticate to Wikibase with their Wikimedia account through a Meta-Wiki OAuth 1.0a consumer. Enabled when both Wikimedia OAuth token variables are set. |
| [RevisionSlider](https://www.mediawiki.org/wiki/Extension:RevisionSlider) | No | Adds a visual revision comparison slider. |
| [StopForumSpam](https://www.mediawiki.org/wiki/Extension:StopForumSpam) | No | Checks account registrations against the Stop Forum Spam service. |
| [TemplateSandbox](https://www.mediawiki.org/wiki/Extension:TemplateSandbox) | No | Lets editors preview pages using draft template revisions. |
| [ThatSrc](https://github.com/nyurik/ThatSrc) | No | Displays source information for embedded media. |
| [TorBlock](https://www.mediawiki.org/wiki/Extension:TorBlock) | No | Restricts edits from anonymous Tor exit nodes. |
| [TwoColConflict](https://www.mediawiki.org/wiki/Extension:TwoColConflict) | No | Provides a two-column edit-conflict interface. |
| [UniversalLanguageSelector](https://www.mediawiki.org/wiki/Extension:UniversalLanguageSelector) | Yes | Allows users to select a language and configure its support. |
| [WikibaseEdtf](https://github.com/ProfessionalWiki/WikibaseEdtf) | No | Adds support for the Extended Date/Time Format (EDTF) specification through a new data type. |
| [WikibaseInWikitext](https://github.com/wbstack/mediawiki-extensions-WikibaseInWikitext) | Yes | Adds a `<sparql>` tag for writing local Query Service examples on wiki pages. |
| [WikibaseLexeme](https://www.mediawiki.org/wiki/Wikibase/Lexeme) | No | Adds lexicographical data, forms, and senses to Wikibase. |
| [WikibaseLexemeCirrusSearch](https://www.mediawiki.org/wiki/Extension:WikibaseLexemeCirrusSearch) | No | Adds OpenSearch support for lexemes when Wikibase Lexeme and Wikibase CirrusSearch are enabled. |
| [WikibaseLocalMedia](https://github.com/ProfessionalWiki/WikibaseLocalMedia) | Yes | Adds support for local media files to Wikibase through a new data type. |
| [WikibaseManifest](https://www.mediawiki.org/wiki/Extension:WikibaseManifest) | Yes | Provides metadata about the structured data repository through an API. |

Enable and configure additional packaged extensions in `LocalSettings.php`
using the normal MediaWiki instructions for that extension. A complete
externally managed configuration continues to control its own extension
loading.

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

The bundled Wikibase Suite extension adds entries to the `Special:Version` page under the “Installed software” section. It reports the Wikibase image version and, when applicable, the WBS release and tools versions.

The same values are also exposed through the Action API metadata endpoint: `/w/api.php?action=query&meta=wikibasesuite&wbsprop=versions&format=json`

When Wikimedia login is enabled, its aggregate linked-user count is exposed through the public metrics endpoint: `/w/api.php?action=query&meta=wikibasesuite&wbsprop=publicmetrics&format=json`. The `publicmetrics` object is empty when Wikimedia login is not enabled.

### Web, job runner, and maintenance workloads

By default, the image prepares MediaWiki and starts the Apache web server. The
same image can also run a dedicated job runner or MediaWiki maintenance
commands:

| Command | Behavior |
| --- | --- |
| `web` (default) | Prepares configuration when necessary, applies database updates, and starts Apache. |
| `jobrunner [arguments...]` | Runs MediaWiki jobs continuously. Requires an existing `InstanceSettings.php`. |
| `maintenance <command> [arguments...]` | Runs a MediaWiki maintenance command through `maintenance/run.php`. Requires an existing `InstanceSettings.php`. For example: `maintenance update --quick`. |
| Any other command | Runs through the base PHP image entry point without WBS configuration preparation. |

The job runner and maintenance workloads use the same configuration as the web
workload but do not initialize it. The web workload must initialize the shared
`/config` volume first.

### Cache configuration

The image uses APCu for lightweight, local caching, while its default WBS
configuration stores authenticated sessions and parser output in the database.

Deployments with more than one Wikibase web container need a shared main cache.
This image supports Redis for that purpose; configure `REDIS_SERVER` and, when
needed, `REDIS_PASSWORD`, or use a custom MediaWiki configuration. See
[MediaWiki's Redis documentation](https://www.mediawiki.org/wiki/Redis).

### Externally managed configuration

The image sets MediaWiki's native `MW_CONFIG_FILE` environment variable to its
Wikibase Suite-managed `/opt/wbs/Settings.php` entry point. Override
`MW_CONFIG_FILE` with another path to supply a complete externally managed
configuration. The selected file may contain static configuration or resolve
configuration dynamically. Bundled extensions remain available, but your
configuration must load those you want to enable.

> ⚠️ `MW_CONFIG_FILE` is an advanced custom-configuration option not recommended for most users. It replaces the default WBS configuration and bypasses all WBS bootstrapping, making you responsible for MediaWiki installation, updates, configuration persistence, and extension loading. WBS setup variables are not applied automatically.

## Internal filesystem layout

The following internal and extension paths are important when working with the
image. See the [Dockerfile](./Dockerfile) for their source.

| Path | Description |
| --- | --- |
| `/var/www/html` | Base MediaWiki directory. |
| `/var/www/html/images` | MediaWiki image and media upload directory. |
| `/var/www/html/skins` | MediaWiki skins directory. |
| `/var/www/html/extensions` | MediaWiki extensions directory. |
| `/opt/wbs/Settings.php` | Image-owned Wikibase Suite entry point selected by the default `MW_CONFIG_FILE`. Override the environment variable rather than replacing this file. |
| `/opt/wbs/DefaultSettings.php` | Image-owned Wikibase Suite MediaWiki defaults, loaded before bundled extensions. MediaWiki supplies its own core defaults. |
| `/opt/wbs/LoadExtensions.php` | Image-owned extension loading and related configuration, loaded before user configuration. |
| `/opt/wbs/extensions.json` | Image-owned build manifest of additional extension sources, pins, and patches included in this image. |
| `/opt/wbs/extension-profiles/` | Image-specific extension profiles for defaults that need more than normal MediaWiki loading. |
| `/opt/wbs/setup/` | Default Wikibase Suite installation, configuration, and migration machinery. |
| `/config/InstanceSettings.php` | Persistent image-generated settings unique to an installed instance. Loaded first by `Settings.php`; do not edit it. |
| `/config/LocalSettings.php` | Persistent user-owned MediaWiki and extension customizations, loaded last. |
| `/config/Extensions.php` | Optional user-owned extension configuration loaded by `LocalSettings.php` for compatibility. New configuration can go directly in `LocalSettings.php`. |
| `/config/wikibase-php.ini` | Persistent user-customizable PHP settings. The image seeds it during managed setup. |
| `/config/.wikibase-image/` | Image-managed transient installation and migration state. |
| `/entrypoint.sh` | Selects the requested workload and runs managed setup only when the default `MW_CONFIG_FILE` is in use. |
| `/healthcheck.sh` | Verifies that MediaWiki is serving requests. |
| `/opt/wbs/setup/scripts/` | WBS-owned setup scripts, including optional OpenSearch and QuickStatements configuration and the opted-in metadata callback. |
| `/extra-install.sh` | Optional script for custom functionality run during a fresh installation. |

## Releases

Official releases of this image can be found on [Docker Hub wikibase/wikibase](https://hub.docker.com/r/wikibase/wikibase).

See the [image changelog](./CHANGELOG.md) for release notes. Documentation at previous releases is preserved in the repository under the corresponding [`wikibase@…` tag](https://github.com/wmde/wikibase-suite/tags).

This image uses the shared tag format for WBS Docker Images. See [WBS Versions](../../../docs/reference/versions.md).

In addition to the standard tags, this image also publishes a tag that includes the bundled MediaWiki version.

| Tag | Example | Description |
| --- | --- | --- |
| mw*MW-VERSION* | mw1.46.0 | Points to the latest image release containing that MediaWiki version. |

## Authors & contact

This image is maintained by the Wikibase Suite Team at [Wikimedia Germany (WMDE)](https://wikimedia.de).

If you have questions not listed above or need help, use this [bug report form](https://phabricator.wikimedia.org/maniphest/task/edit/form/129/) to start a conversation with the engineering team.
