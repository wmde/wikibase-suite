# Wikibase Suite (WBS)

Wikibase Suite (WBS) is a production-ready Wikibase software bundle that allows you to self-host a public knowledge graph similar to Wikidata. It includes MediaWiki, Wikibase, QuickStatements, Query Service, and an SSL certificate for your public instance.

**What's Included**

- Wikibase and MediaWiki for creating and managing structured linked data.
- Query Service and Query Service UI for SPARQL queries.
- Query Service Updater to keep query data in sync.
- QuickStatements for batch imports and edits.
- Reverse-proxy service (Traefik) for routing your domain names to Wikibase and the Query Service UI.
- Required services: job runner, database (MariaDB), and search server (OpenSearch).

## Installing WBS

For a new server, start with [Installing Wikibase Suite (WBS)](./docs/install/README.md).

## Operating WBS

For an existing server installation, start with [Operating Wikibase Suite (WBS)](./docs/operate/README.md).

## Community and Support

- [Wikibase website](https://wikiba.se/)
- [Wikibase Telegram community channel](https://t.me/+WBsf9-C9KPuMZCDT)
- [Wikibase Mastodon](https://wikis.world/@Wikibase)
- [Wikibase user group mailing list](https://lists.wikimedia.org/postorius/lists/wikibaseug.lists.wikimedia.org/?source=post_page)
- [Wikibase Suite Phabricator board](https://phabricator.wikimedia.org/project/board/5755/)
- [Wikibase Suite team email](mailto:wikibase-suite-support@wikimedia.de)

If something is not working as expected, start with [Troubleshooting](./docs/operate/troubleshooting.md). If you have questions or need help, use this [bug report form](https://phabricator.wikimedia.org/maniphest/task/edit/form/129/) to start a conversation with the engineering team.

## WBS Docker Images

WBS uses a set of published Docker images which can also be used independently. See [Wikibase Suite (WBS) Docker Images](./docker-images/README.md) for their configuration options and release notes.

## Development

Image sources are maintained under [`docker-images/`](./docker-images/README.md). Build, integration-test, and release tooling is documented in [`development/`](./development/README.md). Most WBS users do not need these resources.
