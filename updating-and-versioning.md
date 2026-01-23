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

> 💡 In order to automatically update images on every start, you can also use `docker compose up --pull always` to start your WBS Deploy stack.

If you installed User Defined Extensions in `config/extensions`, they might have updates too. Make sure to update them regularly too. See [User Defined Extension Docs](./config/extensions/README.md) for more information.

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

### Bring down your instance

```sh
docker compose down
```

### Back up your data and config

[Create a backup](#backup-your-data) of your data.

Back up your `./config` directory as well using:

```
cp -r ./config ./config-$(date +%Y%M%d%H%M%S)
```

### Switch to new version

WBS Deploy versions are tagged, such as `deploy@2.0.0` or `deploy@3.0.3`. To update, switch to a more recent tag.

```sh
git remote update
git checkout deploy@3.0.3
```

> 💡 If you made changes to `docker-compose.yml`, merge them as you see fit.

### Apply any changes to .env

Look for changes in the new `template.env` that you might want to apply to your `.env` file.

### Apply any migrations for your version

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

### Apply updates to User Defined Extension

If you installed User Defined Extensions in `config/extensions`, they might require updates in order to be compatible with the new MediaWiki version too. See [User Defined Extension Docs](./config/extensions/README.md) for more information.

### Bring your instance back up

```
docker compose up
```

## Automatic updates

At the moment, WBS Deploy does not support automatic updates. To automatically deploy minor and patch updates including security fixes to your WBS images, [restart your instance](#minor-and-patch-updates-for-wbs-service-containers) on a regular basis with a systemd timer, cron job, or similar.

## Downgrades

Downgrades are not supported. In order to revert an update, restore your data from a backup made prior to the upgrade.
