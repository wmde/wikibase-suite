# Current State (as of 2026-02-16)

## What was verified

- TypeScript build passes for web app:
  - command run: `npm run build` in `web/`
- Shell scripts pass basic parse checks:
  - command run: `bash -n start.sh scripts/*.sh`
- Semantic version checker works for expected input format:
  - command run: `./scripts/check_semver.sh 2.10 "Docker Compose version v2.34.0"`

## Behavior confirmed from code

- Main flow is `start.sh` -> `scripts/setup.sh` -> config (`web` or `cli`) -> `scripts/launch.sh`.
- Web setup runs over HTTPS on port `8888`.
- LetsEncrypt certificate request is attempted first (non-localhost), then self-signed fallback.
- `.env` is written to `$DEPLOY_DIR/.env`.
- Launch uses `docker compose up -d` (with `docker-compose.local.yml` if present).

## Issues found and action taken

1. Fixed: setup could exit early when Docker was already installed.
   - file: `scripts/install-docker.sh`
   - previous behavior: `install_docker()` used `exit 0` when `docker` existed.
   - impact: because the script is sourced by `scripts/setup.sh`, this exited the whole setup flow before config and launch.
   - change: replaced `exit 0` with `return 0`.

## Remaining risk areas

- No automated integration test currently verifies full flow across:
  - clean machine
  - machine with docker preinstalled
  - web finalize path and log stream behavior
- Browser-side DNS validation depends on resolving via `https://dns.google/resolve`, which may fail in some restricted networks.
- Distros without `apt-get` or `dnf` are not supported by docker install helper.
