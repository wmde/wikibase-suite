# QuickStatements 3: prototype findings and next steps

## Current result

The local discovery prototype has demonstrated that QuickStatements 3 can run in the Wikibase Suite Compose stack and make authenticated edits to the local wiki. This is enough to justify continued prototyping, but not a release or migration decision. QS3 adds a database-backed batch worker, OAuth 2 provisioning, persistent credentials, and a few Suite-specific patches; it is likely to be one of the more operationally demanding auxiliary services.

The implementation is in [`development/images/quickstatements3`](../development/images/quickstatements3/README.md). It builds pinned upstream source into a Suite image named `wikibase/quickstatements3`, with Gunicorn, WhiteNoise, and Supervisor running the web app and batch worker in one container. No maintained upstream image suitable for Suite deployment was identified; the upstream Dockerfile is Toolforge-oriented. The Compose stack routes `/tools/quickstatements` through Traefik and connects QS3 to a dedicated database in the existing Suite MariaDB instance.

Fresh-install provisioning succeeded. Wikibase creates the QS3 database and user from the initial MariaDB root password, registers an approved OAuth 2 consumer, and stores the application database and OAuth credentials in the protected `quickstatements3-data` volume. OAuth browser consent and token exchange succeeded. Public HTTPS URLs serve browser redirects and links; QS3 uses internal Compose URLs for token/profile and Wikibase API requests.

A real batch then created two string properties (P3 and P4) and two items (Q2 and Q3). Wikibase returned HTTP 201 for each create request. This required removing QS3's upstream default `bot: true` request flag: the local Admin account has edit, item-create, and property-create rights but is not a bot. Edits now run as the authorized user. The successful batch verified the OAuth token, internal API routing, entity creation, and basic worker execution together.

## Packaging and configuration

The image and service are named `quickstatements3` to distinguish them from QS2. The app and worker share one container; MariaDB remains a separate service. The image's runtime settings are documented in its README. The public URL, internal Wikibase API URL, database credentials, OAuth client, and stable Django secret have distinct roles. QS2's configuration contract does not directly apply.

Suite currently owns the image build, source pin, subpath/static configuration, internal API URL handling, normal-user edit behavior, OAuth 2 provisioning, and credential handoff. These patches and scripts add maintenance surface. The upstream requirements pin Django 5.0.9; dependency updates and opportunities to contribute patches upstream need review before production use.

## Database and upgrade question

Use the existing Wikibase Suite MariaDB instance, or another MariaDB instance supplied through environment-based configuration. QS3's database stores batches, commands, execution progress, users, and tokens, so preserve it across app-container replacement and include it in backups.

Fresh installs can provision QS3's database and user while the initial `DB_PASS` is available. Existing installations are unresolved: Suite clears that password from `.env`, and the remaining MediaWiki database credentials may not have permission to create another database and user. Decide how to support this upgrade path, including required user input and recovery instructions.

SQLite is a possible fallback to address the existing-install credential problem, but it is not part of the current image. We do not prefer this path; if needed, validate concurrent web/worker access, persistence, backups, and recovery before adopting it.

## Remaining validation before an MVP decision

- Test a fresh ordinary autoconfirmed editor as well as an administrator. QS3 currently restricts batch execution to autoconfirmed users; verify first-use behavior and decide Suite's eligibility policy.
- Verify OAuth token refresh and behavior after QS3 container recreation.
- Exercise MariaDB unavailability, worker interruption, batch retry, and graceful shutdown. Confirm failed batches are observable and do not create duplicate entities when retried.
- Verify backup and restore for both the MariaDB QS3 database and `quickstatements3-data` credentials.
- Review the patches against the pinned upstream commit and determine which can be removed or contributed upstream.
- Resolve provisioning for existing installs. This remains the main deployment blocker; a successful fresh-install demo does not settle it.

## Reproduction

Build and start the configured local stack with `./development/wbs up --build`. For a fresh installation, use the supported local source-install flow, then accept the defaults. The end-to-end batch used V1 commands with `CREATE_PROPERTY | string` and `CREATE`, followed by `LAST` label and description commands. Inspect the batch report and the resulting property/item pages to verify writes.

The current recommendation is to continue with a bounded prototype and review/refinement pass. Do not treat this as release-ready until existing-install provisioning, ordinary-user eligibility, refresh/recovery behavior, and backup/restore have clear answers.
