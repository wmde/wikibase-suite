# Implementation Map

## Purpose

This project bootstraps and launches a Wikibase Suite Deploy stack.
It handles:
- initial machine setup (git/docker checks and installs)
- configuration collection (web UI by default, terminal prompts with `--cli`)
- launching `docker compose` in a `wikibase-release-pipeline/deploy` checkout

## End-to-end flow

1. `start.sh`
   - parses CLI args
   - installs git if needed
   - clones this repo and `wikibase-release-pipeline` if needed
   - exports environment variables and executes `scripts/setup.sh`
2. `scripts/setup.sh`
   - loads logging utilities
   - optionally handles reset prompts
   - verifies/installs docker, validates versions and daemon state
   - starts config flow (`scripts/web-config.sh` or `scripts/cli-config.sh`)
   - starts `scripts/launch.sh` (background for web mode, foreground for CLI mode)
3. Config phase
   - web mode:
     - generates cert for setup web server (LetsEncrypt fallback to self-signed)
     - builds/runs web container on host port `8888`
     - web UI writes `/app/deploy/.env` via `POST /config`
   - CLI mode:
     - prompts user and writes `.env` directly
4. Launch phase (`scripts/launch.sh`)
   - waits for `.env`
   - optionally resets existing services/data
   - runs `docker compose up -d` in deploy directory
   - prints service URLs and stored config values

## Key files

- `start.sh` - project bootstrap and repository clone entrypoint
- `scripts/setup.sh` - setup orchestrator
- `scripts/install-docker.sh` - docker install + version/daemon checks
- `scripts/web-config.sh` - setup-web-server lifecycle and cert generation
- `scripts/cli-config.sh` - terminal prompts and `.env` generation
- `scripts/launch.sh` - compose launch and final status output
- `scripts/_logging.sh` - structured log helpers and command runner
- `scripts/_prompt-ui.sh` - prompt validators and masked input behavior
- `web/server.ts` - HTTPS config app and control endpoints
- `web/serverHelpers.ts` - `.env` read/write/default/sanitize helpers
- `web/logStreamer.ts` - SSE log tailing
- `web/views/index.eta` - setup UI and front-end behavior

## Important runtime files and paths

- deploy env file: `$DEPLOY_DIR/.env`
- setup logs (host): `/tmp/wbs-deploy-setup.log` by default
- setup logs (web container mount): `/app/setup.log`
- setup certs dir (host): `$SETUP_DIR/web/certs`
- setup letsencrypt dir (host): `$SETUP_DIR/web/letsencrypt`

## Inputs and outputs

- Inputs:
  - CLI flags (for mode and behavior switches)
  - environment variables (override paths/branches/images)
  - user-provided config fields (UI or CLI)
- Outputs:
  - generated `.env` for WBS deploy
  - running compose services in deploy directory
  - setup status logs and final service URLs
