# QuickStatements 3: prototype findings and next steps

## Current result

The local discovery prototype has demonstrated that QuickStatements 3 can run in the Wikibase Suite Compose stack and make authenticated edits to the local wiki. This is enough to justify continued prototyping, but not a release or migration decision. QS3 adds a database-backed batch worker, OAuth 2 provisioning, persistent credentials, and a few Suite-specific patches; it is likely to be one of the more operationally demanding auxiliary services.

The implementation is in [`development/images/quickstatements3`](../development/images/quickstatements3/README.md). It builds pinned upstream source into a Suite image named `wikibase/quickstatements3`, with Gunicorn, WhiteNoise, and Supervisor running the web app and batch worker in one container. No maintained upstream image suitable for Suite deployment was identified; the upstream Dockerfile is Toolforge-oriented. The Compose stack routes `/tools/quickstatements` through Traefik and connects QS3 to a dedicated database in the existing Suite MariaDB instance.

Fresh-install provisioning succeeded. The revised integration uses MariaDB's `--init-file` on each start to create the separate QS3 database and grant access to the existing MediaWiki database user. Wikibase registers an approved OAuth 2 consumer and stores the OAuth credentials, QS3 database connection, and Django secret in one protected `runtime.json` file on the `quickstatements3-data` volume. QS3 can also accept the same settings directly from the environment outside Suite. OAuth browser consent and token exchange succeeded with the earlier provisioning approach. The revised stack also started successfully against the existing local Suite volume after `.env` password sanitization; MariaDB, Wikibase, and QS3 were healthy, and QS3's database credentials matched MediaWiki's retained credentials. The current Compose configuration aliases the public wiki hostname to Traefik inside the Docker network, so QS3 uses the public HTTPS URL for both browser and server-side requests. End-to-end OAuth and edits after this routing change still need verification with a trusted TLS certificate; the local `.test` certificate is not trusted inside QS3.

A real batch then created two string properties (P3 and P4) and two items (Q2 and Q3). Wikibase returned HTTP 201 for each create request. The pinned QS3 source already sends `bot: true` on edits, expecting the [Wikibase REST API fix in T421631](https://phabricator.wikimedia.org/T421631): edits by non-bot users succeed, while edits by users with the bot right are marked as bot edits. Our MediaWiki 1.46 image pins a Wikibase `REL1_46` commit with the older behavior, which rejects `bot: true` from non-bot users with HTTP 403. This POC therefore removes the flag at image build time to work with the 1.46 image; bot users' QS3 edits are consequently not marked as bot edits. When Suite moves to MediaWiki 1.47, verify that the selected Wikibase `REL1_47` commit includes T421631 and remove the patch. The successful batch verified the OAuth token, entity creation, and basic worker execution together; it predates the public-hostname alias change.

## Packaging and configuration

The image and service are named `quickstatements3` to distinguish them from QS2. The app and worker share one container; MariaDB remains a separate service. The image accepts Wikibase-style `DB_SERVER`, `DB_NAME`, `DB_USER`, and `DB_PASS` settings, along with OAuth and application settings, in the environment or a mounted JSON file. Suite writes the database connection and OAuth credentials to that file. Compose supplies the public QS3 and Wikibase URLs; the image derives its path prefix, OAuth endpoints, and default batch target from them. QS2's configuration contract does not directly apply. Wikibase provisions QS3 only when both the QS3 data mount and public URL exist. An explicit `setup-quickstatements3.sh --regenerate-oauth` command creates a new consumer and replaces the saved credentials; QS3 must then restart and users must reauthorize.

Suite currently owns the image build, source pin, subpath/static configuration, normal-user edit behavior, OAuth 2 provisioning, and credential handoff. These patches and scripts add maintenance surface. The upstream requirements pin Django 5.0.9; dependency updates and opportunities to contribute patches upstream need review before production use.

## Database and upgrade question

Use the existing Wikibase Suite MariaDB instance, or another MariaDB instance supplied through environment-based configuration. QS3's database stores batches, commands, execution progress, users, and tokens, so preserve it across app-container replacement and include it in backups.

The Suite Compose definition uses MariaDB's `--init-file` to create the dedicated QS3 database and grant the MediaWiki database account access to it on every startup. The SQL file is generated inside the MariaDB container before database startup, avoiding a dependency on a shared volume being populated by another service first. This works with a fresh or already initialized volume without recovering or resetting the randomly generated root password. Wikibase setup reads the MediaWiki database connection from `InstanceSettings.php` after installation, falling back to `.env` inputs before that file exists, and writes it to the private QS3 volume. Isolated MariaDB 10.11 tests confirmed database access on fresh, repeated, and legacy-volume starts; a full local Suite restart with a sanitized `.env` also succeeded. Sharing the database account expands QS3's access to MediaWiki's database and should be reviewed before release.

## Remaining validation before an MVP decision

- Test a fresh ordinary autoconfirmed editor as well as an administrator. QS3 currently restricts batch execution to autoconfirmed users; verify first-use behavior and decide Suite's eligibility policy.
- Verify OAuth token refresh and behavior after QS3 container recreation.
- Exercise MariaDB unavailability, worker interruption, batch retry, and graceful shutdown. Confirm failed batches are observable and do not create duplicate entities when retried.
- Verify backup and restore for both the MariaDB QS3 database and `quickstatements3-data` credentials.
- Review the patches against the pinned upstream commit and determine which can be removed or contributed upstream.
- Validate the `--init-file` provisioning and credential handoff against a clean pre-QS3 WBS installation whose `.env` password has been cleared; the isolated legacy-volume test and existing local POC stack passed, but a full pre-QS3 upgrade path remains untested.

## Reproduction

Build and start the configured local stack with `./development/wbs up --build`. For a fresh installation, use the supported local source-install flow, then accept the defaults. The end-to-end batch used V1 commands with `CREATE_PROPERTY | string` and `CREATE`, followed by `LAST` label and description commands. Inspect the batch report and the resulting property/item pages to verify writes.

The current recommendation is to continue with a bounded prototype and review/refinement pass. Do not treat this as release-ready until the revised existing-install flow, ordinary-user eligibility, refresh/recovery behavior, and backup/restore have been validated.
