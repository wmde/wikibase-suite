# Upgrading Wikibase Suite (WBS)

Wikibase Suite (WBS) uses semantic versioning. Patch and minor releases within your current major version are compatible and can be upgraded directly, while major releases may contain breaking changes and require a version-specific upgrade procedure.

WBS Docker Images are released separately and can receive compatible updates without changing your WBS version. See [Wikibase Suite (WBS) Versions](./versions.md) for a full explanation of WBS and Docker Image versioning.

## Upgrade WBS

Before upgrading WBS, review the [WBS changelog](../CHANGELOG.md) for the release you want to install.

### Minor and patch upgrades

Patch and minor upgrades within your current major WBS version do not require a migration.

1. If you have not already, [log in to your server and change to your WBS directory](./README.md#access-your-wbs-server).

2. If you customized `docker-compose.yml`, commit your changes and reconcile them with the target release. Otherwise, continue to the next step.

3. Replace the example `wbs@8.0.1` tag below with the tag for the release you are upgrading to, then fetch the tag, check it out, pull the images, and start the services.

   > [!NOTE]
   > WBS 7 and earlier releases use `deploy@…` tags; WBS 8 and later releases use `wbs@…` tags.

   ```sh
   git remote update
   git checkout wbs@8.0.1
   docker compose pull
   docker compose up -d
   ```

### Major version upgrades

Major WBS releases may contain breaking changes and require a version-specific migration. WBS supports migrating only one major version at a time because MediaWiki and its extensions may require intermediate database and configuration changes.

For example, upgrading from WBS 5 to WBS 8 requires migrating from WBS 5 to 6, then 6 to 7, then 7 to 8.

Before beginning, review the [WBS changelog](../CHANGELOG.md) for the target release, then follow each required migration guide:

- **[Migrating from WBS 7 to 8](./migration-guides/wbs-7-to-8.md)**
- [Migrating from WBS 6 to 7](./migration-guides/wbs-6-to-7.md)
- [Migrating from WBS 5 to 6](./migration-guides/wbs-5-to-6.md)
- [Migrating from WBS 4 to 5](./migration-guides/wbs-4-to-5.md)
- [Migrating from WBS 3 to 4](./migration-guides/wbs-3-to-4.md)
- [Migrating from WBS 2 to 3](./migration-guides/wbs-2-to-3.md)
- [Migrating from WBS 1 to 2](./migration-guides/wbs-1-to-2.md)

Downgrading WBS versions is not supported. For recovery options after an unsuccessful upgrade, see [Backing Up and Restoring](./backup-and-restore.md).

## Update WBS Docker Images

WBS Docker Images are released independently from WBS. Your WBS configuration references compatible major-version image tags, allowing newer minor and patch image releases—including security updates—to be pulled without upgrading WBS itself.

Before updating, you can review the changelog for any images you want to check:

- [Wikibase](../development/images/wikibase/CHANGELOG.md)
- [Query Service](../development/images/wdqs/CHANGELOG.md)
- [Query Service frontend](../development/images/wdqs-frontend/CHANGELOG.md)
- [QuickStatements](../development/images/quickstatements/CHANGELOG.md)
- [OpenSearch](../development/images/opensearch/CHANGELOG.md)

To update the images used by your installation:

1. If you have not already, [log in to your server and change to your WBS directory](./README.md#access-your-wbs-server).

2. For a production instance, [back up your data](./backup-and-restore.md#back-up-your-data) if you need a rollback point. The backup procedure stops WBS; continue directly with the next step.

3. Pull the images and apply the updates. Running services remain available while the images download; Compose then recreates only the services whose images changed.

   ```sh
   docker compose pull
   docker compose up -d
   ```

4. If you installed extensions in `config/extensions`, keep them up to date independently. See [Updating Extensions](./update-extensions.md) for the update procedure.

### Automatically update WBS Docker Images

To pull compatible WBS Docker Image updates whenever you start the stack:

1. If you have not already, [log in to your server and change to your WBS directory](./README.md#access-your-wbs-server).

2. Run:

   ```sh
   docker compose up -d --pull always
   ```

You can run this command manually or schedule it with a systemd timer, cron job, or similar.

This updates only the WBS Docker Images referenced by the current `docker-compose.yml`. It does not upgrade WBS to another release, perform a major version upgrade, or update extensions in `config/extensions`.
