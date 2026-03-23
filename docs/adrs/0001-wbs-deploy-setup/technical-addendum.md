# Reference Implementation Details

This addendum provides implementation detail for ADR 0001.
It supports review and discussion, but does not add or change ADR decisions.

## Purpose and Operating Model

The current setup tool bootstraps and launches Wikibase Suite Deploy with two setup paths:
- Web setup (default)
- CLI setup (`--cli`)

Both paths feed the same launch/deploy flow and are intended to reduce known first-run failure points (especially DNS/domain mapping and setup-value correctness).

## End-to-End Flow

1. `start.sh`
   - Parses CLI args.
   - Installs Git if needed.
   - Clones this repository and `wikibase-release-pipeline` (unless skipped).
   - Exports runtime env vars and executes `scripts/setup.sh`.
2. `scripts/setup.sh`
   - Loads logging utilities.
   - Handles optional reset behavior.
   - Verifies/installs Docker, checks daemon and compose/tooling state.
   - Starts config flow (`scripts/web-config.sh` or `scripts/cli-config.sh`).
   - Starts `scripts/launch.sh` (background in web mode; foreground in CLI mode).
3. Configuration phase
   - Web mode:
     - Creates certs for setup web server (LetsEncrypt first, self-signed fallback).
     - Builds/runs setup web container on host port `8888`.
     - Writes deploy `.env` through API endpoint.
   - CLI mode:
     - Prompts in terminal and writes deploy `.env` directly.
4. Launch phase (`scripts/launch.sh`)
   - Waits for `.env`.
   - Optionally resets existing services/data.
   - Runs `docker compose up -d` in deploy directory.
   - Prints service URLs and saved configuration.

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

## Inputs and Outputs

- Inputs:
  - CLI flags and environment-variable overrides.
  - User-provided config values (Web or CLI).
- Outputs:
  - Generated deploy `.env`.
  - Running WBS services in deploy directory.
  - Setup logs and final service links.

## Setup Logging

The entire setup process logs to:

- `/tmp/wbs-deploy-setup.log`

This is the default host log path (`LOG_PATH`) used across bootstrap, configuration, and launch phases.

## Configuration Collection Status

Current Web and CLI core prompts include:
- Wikibase host
- Query Service host
- Admin email
- Admin password (or generated secure default)
- DB password (or generated secure default)
- Metadata callback visibility choice

Current gap:
- `MW_ADMIN_NAME`, `DB_NAME`, and `DB_USER` remain template-defaulted in CLI (not interactive prompts).

## Verification Snapshot (latest documented pass)

- TypeScript build check for web app.
- Shell parse checks for setup scripts.
- Semantic version helper script check.

## Known Risk Areas

- No automated full integration coverage yet for key environment permutations.
- Password validation is length-based and does not pre-check against MediaWiki common-password rejection behavior.
- DNS validation path can be sensitive to restricted network conditions.
- Docker-install helper supports common Linux package-manager paths, but not every distro variant.

## Open Review Questions

- Should setup remain certificate-first (LetsEncrypt -> self-signed), or should HTTP setup be offered in any controlled mode?
- Which real-world failure paths should be prioritized for test coverage first (DNS, certs, Docker install, compose launch)?
- What should be treated as minimum reliability criteria before broader rollout?
