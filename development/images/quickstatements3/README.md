# QuickStatements 3 image

This Suite image packages Wikimedia Brasil's QuickStatements 3 in one container. Gunicorn serves the Django application, WhiteNoise serves static files, and Supervisor manages both the web process and upstream batch worker.

## Suite integration

The Suite Compose stack routes `/tools/quickstatements` to this image and connects it to Suite's MariaDB service. On a fresh install, the Wikibase setup lifecycle creates a dedicated `quickstatements3` database and user, registers an approved OAuth 2 consumer with the exact `/auth/callback/` URL, and writes the generated runtime credentials to the `quickstatements3-data` volume. The app reads that file at startup. It contains database and OAuth secrets and should be included in Suite backups. The QS3 database itself is in Suite's existing `mysql-data` volume.

MariaDB's root password is set to the initial `DB_PASS` value during fresh database initialization. The setup lifecycle uses it to create the QS3 database and user. WBS continues to clear passwords from `.env` after installation; QS3's generated database and OAuth credentials remain in its private volume. Existing-install provisioning remains unresolved because the root password cannot be recovered from the initialized database and is no longer in `.env`.

The fresh-install test created an OAuth 2 consumer with authorization-code and refresh-token grant types, the exact public callback URL, and the existing edit and high-volume grants. Browser authorization uses the public wiki URL; token/profile and Wikibase API requests use the internal Compose URL. QS3 sends normal user edits because its upstream default marks every edit as a bot edit, which requires a separate MediaWiki bot right. Browser consent, token exchange, and a batch creating two properties and two items succeeded. QS3 also requires autoconfirmed wiki accounts before batches can run; first-use eligibility and the local-wiki policy need further validation.

## Build and run locally

From this repository, build and start the Suite stack with local images:

```sh
wbs install --local --from-source
```

The source checkout's build option is `--from-source`; `wbs up --build` can rebuild and start an already configured instance. The image uses a pinned upstream commit in `docker-bake.hcl`. The upstream Dockerfile is Toolforge-specific and is not used as a base.

## Runtime configuration

The image consumes the following settings from its private runtime JSON file, created by the Wikibase setup lifecycle:

| Setting | Purpose |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Dedicated MariaDB database connection. |
| `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_AUTHORIZATION_SERVER` | MediaWiki OAuth 2 client and endpoint configuration. |
| `WIKIBASE_PUBLIC_URL`, `DEFAULT_WIKIBASE_URL` | Public wiki URL used for OAuth authorization and links. |
| `WIKIBASE_API_URL` | Internal Wikibase base URL used for REST and Action API requests. |
| `DJANGO_SECRET_KEY` | Stable Django secret retained across container replacement. |

The Compose service supplies the public QuickStatements URL, allowed host, CSRF origin, and `/tools/quickstatements` URL prefix. These settings are separate from QS2's environment contract.

## Current limitations

- Existing installations do not yet have an upgrade path for provisioning the additional database/user and OAuth consumer. The current Compose replacement is only safe for a fresh install until that upgrade path is designed.
- Public URL prefix behavior, OAuth consent and token exchange, and a successful admin batch edit are verified. Token refresh, ordinary-user eligibility, worker/database failure recovery, and persistence/restore need further end-to-end verification.
- The upstream requirements pin Django 5.0.9. Dependency maintenance and broader compatibility work remain before release.
- The app and worker run in one container. Long-running batch behavior, failure recovery, and graceful shutdown need integration validation.
