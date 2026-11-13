# Federated Values alpha on Wikibase Suite 8

Federated Values lets a local Wikibase use Wikidata items as statement values. This is an alpha feature: we are collecting feedback and expect its behavior and supported use cases to change.

The alpha currently has these limitations:

- The representation of federated items in the API is still being developed. Feedback on API requirements is welcome.
- Query Service reconciliation for statements containing Wikidata items is still under investigation.

This branch uses the Suite 8 configuration and documentation layout, with MediaWiki 1.45.6 and matching extension branches. [Login with Wikimedia](./configure/enable-login-with-wikimedia.md) is available when a Wikimedia OAuth consumer is configured.

The alpha identifies WBS version `8.1.0-fv.3` and Wikibase image version `8.3.0-fv.3`. The Wikibase image is published as `ghcr.io/wmde/wikibase/wikibase:pr-1008`.

## Install a new instance

Follow the [installation requirements](./install/installer.md#before-you-start--what-you-need), allowing at least 20 GB of free disk space for this alpha. Install it with:

```sh
curl -fsSL https://wmde.github.io/wikibase-suite-install/pr-1008 | bash
```

This installs the Federated Values alpha and opens the Wikibase Suite installer. Follow the browser prompts to configure your instance.

## Upgrade an existing instance

For an instance on Wikibase Suite 7, follow the [Suite 7 to 8 migration guide](./operate/migration-guides/wbs-7-to-8.md). In its checkout step, check out `release/federated-values-alpha` instead of a `wbs@…` tag. The branch's Compose file selects the alpha image for Wikibase and its job runner. If you copied an existing `docker-compose.override.yml`, check that it does not replace those image selections. The rest of the migration procedure applies normally.

If the old federation deployment used Wikimedia login, rename `WIKIMEDIA_OAUTH_CONSUMER_KEY` to `WIKIMEDIA_OAUTH_CONSUMER_TOKEN` and `WIKIMEDIA_OAUTH_CONSUMER_SECRET` to `WIKIMEDIA_OAUTH_SECRET_TOKEN` in the copied `.env` file before starting Suite 8. Suite 8 reads the new names.

To update an instance already running this alpha, switch to the latest version of this branch and pull the images:

```sh
cd /path/to/wikibase-suite
git fetch origin
git switch release/federated-values-alpha
git pull --ff-only
docker compose pull
docker compose up -d
```
