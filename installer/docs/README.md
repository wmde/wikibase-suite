# Wikibase Suite Installer Development

This document covers local testing, advanced installer options, and the current release model for the installer code.

The installer currently supports first-time Wikibase Suite installation through a web UI or command-line wizard. It is also intended to become the foundation for a broader `wbs` operations CLI with commands for installing, backing up, resetting, upgrading, updating, and maintaining a Wikibase Suite instance. See [ADR 0001: Expand the Installer into an Operations Tool](adrs/0001-expand-installer-into-operations-tool.md).

## Versioning and releases

For now, the installer is versioned as part of Wikibase Suite. Changes to installer behavior, setup tooling, or future `wbs` maintenance commands should be released through a Wikibase Suite patch or minor release, even when the deploy configuration or image versions do not otherwise change.

This intentionally couples tooling updates to Wikibase Suite releases until there is a separately distributed `wbs` operations tool. Avoid maintaining release branches solely for installer updates unless the project defines a support policy for those branches.

Use Conventional Commits for changes in this repository so future release tooling can derive semantic version bumps and changelog entries from commit history.

The branch and tag model is:

- `main` is the latest stable public install channel. The public install command uses `raw/main/install`.
- `dev` is the integration branch for the next release.
- Semantic version tags such as `7.0.0` are immutable release snapshots.
- New development should happen on `dev` or feature branches, then merge to `main` only when ready to become the public installer path.

## Running locally

Clone the repository and run from the directory that contains `install`:

```bash
git clone https://github.com/wmde/wikibase-suite
cd wikibase-suite
./install [OPTIONS]
```

For local development, use `--dev` or `--local`:

```bash
./install --dev
```

`--dev` sets `LOCALHOST=true` and skips dependency installs. When using `--local` or `--dev`, the installer defaults to:

```bash
WIKIBASE_PUBLIC_HOST=wikibase.test
WDQS_PUBLIC_HOST=query.wikibase.test
```

Add those hosts to your system hosts file before launching the stack.

## Options

| Option | Description |
| --- | --- |
| `--web` | Use the browser UI. This is currently the default. |
| `--cli` | Collect configuration through the command-line wizard. |
| `--dev` | Local development shortcut: sets `LOCALHOST=true` and skips dependency installs. |
| `--local` | Configure for localhost domains and avoid Let's Encrypt. |
| `--reset` | Interactive reset. Optionally deletes `.env`, `LocalSettings.php`, and existing services/data before relaunch. |
| `--skip-clone` | Do not clone the Wikibase Suite repository. Assumes it is already present. |
| `--skip-deps` | Skip installing Git and Docker. Assumes both are installed and Docker is running. |
| `--skip-launch` | Run through configuration but exit before `docker compose up`. |
| `--wbs-ref REF` | Checkout a specific Wikibase Suite branch or tag. Defaults to `main`. |
| `--debug` | Enable verbose logging and disable quiet Docker pulls. |

## Runtime behavior

- Remote installs clone Wikibase Suite to `~/wikibase-suite` by default. Set `WBS_DIR` to use a custom checkout path.
- The installer web server runs on port `8888` for browser UI installations.
- For non-localhost web installs, the installer tries to obtain a Let's Encrypt certificate on port `80`. If that fails, it falls back to a self-signed certificate and the browser will warn.
- If `docker-compose.local.yml` exists in the Wikibase Suite directory, it is merged automatically.
- After launch, the saved `.env` configuration is displayed. Store credentials securely.
