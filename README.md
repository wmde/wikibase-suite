# Wikibase Suite (WBS)

Wikibase Suite (WBS) helps you run your own [Wikibase](https://wikiba.se/) on a server.

WBS is a supported and tested Docker Compose configuration for deploying the following services to a publicly accessible server:

- **[Wikibase](https://github.com/wmde/wikibase-release-pipeline/blob/main/build/wikibase/README.md):** MediaWiki service with the Wikibase extension included for creating and managing your Wikibase data.
- **Job Runner:** Background job service used by Wikibase.
- **[MariaDB](https://hub.docker.com/_/mariadb):** Database service used by Wikibase.
- **[Elasticsearch](https://github.com/wmde/wikibase-release-pipeline/blob/main/build/elasticsearch/README.md):** Search service used by Wikibase.
- **[Query service](https://github.com/wmde/wikibase-release-pipeline/blob/main/build/wdqs/README.md):** SPARQL service for querying Wikibase data.
- **[Query service frontend](https://github.com/wmde/wikibase-release-pipeline/blob/main/build/wdqs-frontend/README.md):** Web interface for SPARQL queries.
- **[Query service updater](https://github.com/wmde/wikibase-release-pipeline/blob/main/build/wdqs/README.md):** Keeps query service data in sync with Wikibase.
- **[QuickStatements](https://github.com/wmde/wikibase-release-pipeline/blob/main/build/quickstatements/README.md):** A web-based tool to import and manipulate large amounts of data.
- **[Traefik](https://hub.docker.com/_/traefik):** A reverse proxy that handles TLS termination and SSL certificate renewal through ACME.

## Getting Started

Start here for guidance on preparing a server and domain names, then use the web-based installer to configure and start WBS.

**[Install WBS](./docs/install/README.md)**

## Current Users

If you’re already running WBS, find instructions for updating to the latest release, changing your configuration, enabling features, adding extensions, backing up your data, and troubleshooting your installation.

**[Operate WBS](./docs/README.md)**

## Community and Support

- [Wikibase website](https://wikiba.se/)
- [Wikibase Telegram community channel](https://t.me/+WBsf9-C9KPuMZCDT)
- [Wikibase Mastodon](https://wikis.world/@Wikibase)
- [Wikibase user group mailing list](https://lists.wikimedia.org/postorius/lists/wikibaseug.lists.wikimedia.org/?source=post_page)
- [Wikibase Suite Phabricator board](https://phabricator.wikimedia.org/project/board/5755/)
- [Wikibase Suite team email](mailto:wikibase-suite-support@wikimedia.de)

If something is not working as expected, start with [Troubleshooting](./docs/troubleshooting.md). If you have questions or need help, use this [bug report form](https://phabricator.wikimedia.org/maniphest/task/edit/form/129/) to start a conversation with the engineering team.

## Development

Image sources and the build, integration-test, and release tooling are maintained in [`development/`](./development/README.md). Most WBS users do not need these tools. They are available for contributors and advanced users who want to build customized images.
