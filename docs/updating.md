# Updating and versioning

WBS uses [semantic versioning](https://semver.org/spec/v2.0.0.html). WBS Deploy and each WBS image have individual version numbers.

WBS Deploy always references the latest minor and patch releases of the compatible WBS images' major versions using the Docker images' major version tag. For example, WBS Deploy 2.0.1 might reference `wikibase/wikibase:3`, a tag that always points to the latest image Wikibase 3.x.x image.

## Minor and patch updates for WBS images

Because WBS Deploy always references the latest minor and patch releases of compatible WBS images, non-breaking changes (including security updates) can be pulled at any time.

This is always safe to do. Simply run:

```sh
docker compose down
docker compose pull
docker compose up
```

You can also choose to always pull WBS image updates when starting the stack. See [Managing updates](#managing-updates).

If you installed User Defined Extensions in `config/extensions`, they might have updates too. Make sure to update them regularly too. See [User Defined Extension Docs](../config/extensions/README.md) for more information.

## Minor and patch updates for WBS Deploy

WBS Deploy versions are tagged in git with tags such as `deploy@2.0.1`. Switching to a tag with the same major version will never trigger breaking changes. These updates are **always** considered safe. If you made no changes to `docker-compose.yml`, you may update simply by switching the git tag.

```sh
git remote update
git checkout deploy@2.0.2
```

> 💡 If you made any changes to `docker-compose.yml`, commit them. Merge with upstream changes as you see fit.

## Major upgrades

Major version upgrades are performed by updating WBS Deploy's major version. This is done by changing your git checkout to the new major version tag. This may reference new major versions of WBS images and involve breaking changes. In turn, those may require additional steps as described below.

WBS only supports updating from one major version to the next version in sequence. In order to upgrade from 1.x.x to 3.x.x, you must first upgrade from 1.x.x to 2.x.x and then to 3.x.x.

Major upgrades use the data-preserving reset procedure in [Resetting or removing an instance](./resetting-and-removing.md). Read the version-specific notes below before starting that procedure, then follow the reset procedure and use the target WBS Deploy tag when you reach its "Update setup values" step.

> 💡 If you made changes to `docker-compose.yml`, merge them as you see fit.

Look for any additions or changes noted in `template.env` that you may need to apply to your `.env` file.

Note: With the exception of `METADATA_CALLBACK`, you should not change existing `.env` values, they are initial setup values and changing them from initial values can break your instance. `METADATA_CALLBACK` is the exception: it may be changed after initial setup and takes effect after restarting the services.

Before the final start in the reset procedure, apply any relevant version-specific notes below and update any User Defined Extensions installed in `config/extensions`.

### Version-specific notes

<details><summary><strong>WBS Deploy 4.x.x to 5.x.x</strong></summary><p>

Wikibase Image switched from version 4.x.x to 5.x.x; this upgrades MediaWiki from 1.43 to 1.44. Please read the [MediaWiki UPGRADE file](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/core/+/refs/heads/REL1_44/UPGRADE).

Please, note that the `.env` file now requires setting `METADATA_CALLBACK`. Find more details about it in `template.env`.

</p></details>

<details><summary><strong>WBS Deploy 3.x.x to 4.x.x</strong></summary><p>

Wikibase Image switched from version 3.x.x to 4.x.x; this upgrades MediaWiki from 1.42 to 1.43. Please read the [MediaWiki UPGRADE file](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/core/+/refs/heads/REL1_43/UPGRADE).

Note that URLs changed with Deploy 4 to the following defaults:
- https://wikibase.example MediaWiki with Wikibase extension
- https://wikibase.example/w/rest.php MediaWiki REST API including Wikibase REST API
- https://query.wikibase.example Front end for WDQS (Query GUI)
- https://query.wikibase.example/sparql SPARQL API endpoint for WDQS
- https://wikibase.example/tools/quickstatements QuickStatements tool

Note that the `wdqs-proxy` image has been removed. Routing of WDQS HTTP traffic is now done by central Traefik.

Note that `wdqs-frontend` environment variables changed. Read more on https://github.com/wmde/wikibase-release-pipeline/tree/main/build/wdqs-frontend#environment-variables

</p></details>

<details><summary><strong>WBS Deploy 2.x.x to 3.x.x</strong></summary><p>

Read the [MediaWiki UPGRADE file](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/core/+/refs/heads/REL1_42/UPGRADE).

No Wikibase-specific migrations are necessary.

</p></details>

<details><summary><strong>WBS Deploy 1.x.x to 2.x.x</strong></summary><p>

Read the [MediaWiki UPGRADE file](https://gerrit.wikimedia.org/r/plugins/gitiles/mediawiki/core/+/refs/heads/REL1_41/UPGRADE).

No Wikibase-specific migrations are necessary.

</p></details>

## Managing updates

You can automatically pull minor and patch updates for WBS images by starting the stack with:

```sh
docker compose up --pull always
```

You can run that command manually, or schedule it with a systemd timer, cron job, or similar.

This only covers minor and patch updates for the WBS images referenced by your current `docker-compose.yml`. It does not update your WBS Deploy git checkout, apply major upgrades, or update User Defined Extensions.

## Downgrades

Downgrades are not supported. In order to revert an update, restore your data from a backup made prior to the upgrade.
