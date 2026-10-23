# QuickStatements 3 image

This Suite image packages Wikimedia Brasil's QuickStatements 3 in one container. Gunicorn serves the Django application, WhiteNoise serves static files, and Supervisor manages both the web process and upstream batch worker.

## Suite integration

The Suite Compose stack routes `/tools/quickstatements` to this image and connects it to Suite's MariaDB service. MariaDB provisions a separate `quickstatements3` database for the existing MediaWiki database user. The Wikibase setup lifecycle registers an approved OAuth 2 consumer with the exact `/auth/callback/` URL and writes the QS3 database connection, OAuth credentials, and Django secret to `/quickstatements3/data/runtime.json` in the private `quickstatements3-data` volume. Include that volume and the QS3 database in Suite backups.

Wikibase setup uses `setup-quickstatements3.sh` to register the OAuth consumer when needed, then `setup-quickstatements3.php` to read MediaWiki's database connection and write `runtime.json` atomically. On later starts, the PHP script refreshes the database connection in that file while preserving the OAuth and Django credentials.

The Suite Compose definition supplies MariaDB with an idempotent startup SQL file inside the MariaDB container. It creates the separate `quickstatements3` database and grants the existing MediaWiki database user access to it. This works with both new and existing MariaDB data volumes without knowing the MariaDB root password. QS3 uses the same database username and password as MediaWiki; Wikibase reads the connection from `InstanceSettings.php` after installation, falling back to environment values before that file exists. Sharing the database account means QS3 credentials also grant access to the MediaWiki database.

The fresh-install test created an OAuth 2 consumer with authorization-code and refresh-token grant types, the exact public callback URL, and the existing edit and high-volume grants. The Suite Compose network gives Traefik the public wiki hostname as an alias, so QS3 can use the public URL for browser authorization, token/profile requests, and Wikibase API calls while remaining inside the Docker network. Browser consent, token exchange, and a batch creating two properties and two items succeeded before the public-hostname routing change; repeat the end-to-end test with the alias in an environment with a trusted TLS certificate. QS3 also requires autoconfirmed wiki accounts before batches can run; first-use eligibility and the local-wiki policy need further validation.

The pinned QS3 source already sends `bot: true` on edits. The [Wikibase REST API fix in T421631](https://phabricator.wikimedia.org/T421631) lets non-bot users edit despite that flag and marks edits as bot edits only when the user has the bot right. Our MediaWiki 1.46 image pins a Wikibase `REL1_46` commit with the older behavior: it returns HTTP 403 for a non-bot user. The build-time patch in `deployment/patch_upstream.py` removes the flag to make QS3 work with this 1.46 image. Consequently, QS3 edits by bot accounts are not marked as bot edits. When Suite moves to MediaWiki 1.47, verify that the selected Wikibase `REL1_47` commit includes T421631, then remove the patch; it should no longer be needed.

Wikibase skips QS3 provisioning unless both `QUICKSTATEMENTS_PUBLIC_URL` and the `/quickstatements3/data` mount are present. To replace broken OAuth credentials on a Suite installation, run:

```sh
docker compose run --rm --no-deps --entrypoint bash wikibase /var/www/html/extensions/WikibaseSuite/setup/scripts/setup-quickstatements3.sh --regenerate-oauth
docker compose up -d wikibase
docker compose restart quickstatements3
```

This works even if the Wikibase container is stopped because its previous QS3 configuration is broken. It registers a new approved OAuth 2 consumer and atomically replaces the credentials in `runtime.json`, preserving the Django secret. Users must authorize QS3 again. The previous consumer remains registered in MediaWiki and should be revoked separately if its credentials were compromised.

## Build and run locally

From this repository, build and start the Suite stack with local images:

```sh
wbs install --local --from-source
```

The source checkout's build option is `--from-source`; `wbs up --build` can rebuild and start an already configured instance. The image uses a pinned upstream commit in `docker-bake.hcl`. The upstream Dockerfile is Toolforge-specific and is not used as a base.

## Runtime configuration

The image accepts these settings directly as environment variables or as keys in `/quickstatements3/data/runtime.json`. Environment values take precedence. Set `QS3_CONFIG_FILE` to use another file path. The file is optional when all required settings are supplied through the environment; this lets the image run outside Suite. Suite writes the database and OAuth settings to the file and passes the two public application URLs in Compose.

| Setting | Purpose |
| --- | --- |
| `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASS` | Dedicated MariaDB database connection. `DB_SERVER` accepts `host` or `host:port`. |
| `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET` | OAuth 2 client credentials. |
| `WIKIBASE_PUBLIC_URL` | Public wiki base URL. Supplies defaults for OAuth authorization and the initial batch target. |
| `QUICKSTATEMENTS_PUBLIC_URL` | Public QS3 URL. Supplies the path prefix, allowed host, and CSRF origin. |
| `OAUTH_AUTHORIZATION_SERVER`, `DEFAULT_WIKIBASE_URL` | Optional overrides when the OAuth server and batch target differ from `WIKIBASE_PUBLIC_URL`. |
| `OAUTH_ACCESS_TOKEN_URL`, `OAUTH_PROFILE_URL` | Optional endpoint overrides when OAuth endpoints differ from those derived from `OAUTH_AUTHORIZATION_SERVER`. |
| `QS3_URL_PREFIX`, `DJANGO_ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS` | Optional overrides for values derived from `QUICKSTATEMENTS_PUBLIC_URL`. |
| `DJANGO_SECRET_KEY` | Stable Django secret retained across container replacement. |

For standalone use, supply these values through the environment or create the JSON file before starting the image. The database and user must already exist and have the privileges needed for Django migrations. The public wiki address must resolve and have a trusted TLS certificate from inside the QS3 container; an orchestrator can route that hostname to its reverse proxy. The image also accepts the previous POC's `DB_HOST`, `DB_PORT`, and `DB_PASSWORD` keys. These settings are separate from QS2's environment contract.

## Current limitations

- A full upgrade from a pre-QS3 Suite installation remains to be tested. The isolated MariaDB migration and a restart of the local Suite stack with sanitized `.env` both passed.
- Public URL prefix behavior, OAuth consent and token exchange, and a successful admin batch edit are verified. Token refresh, ordinary-user eligibility, worker/database failure recovery, and persistence/restore need further end-to-end verification.
- The upstream requirements pin Django 5.0.9. Dependency maintenance and broader compatibility work remain before release.
- The app and worker run in one container. Long-running batch behavior, failure recovery, and graceful shutdown need integration validation.
