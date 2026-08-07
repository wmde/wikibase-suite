# Wikibase Suite (WBS) Tools development

This document covers local testing, advanced installer options, and the current release model for the installer code.

The installer currently supports first-time Wikibase Suite installation through a web UI or interactive command-line flow. It is also intended to become the foundation for a broader `wbs` operations CLI with commands for installing, backing up, resetting, upgrading, updating, and maintaining a Wikibase Suite instance. See [ADR 0001: Expand the Installer into an Operations Tool](adrs/0001-expand-installer-into-operations-tool.md).

## Versioning and releases

The containerized application is released independently as the [`wikibase/wbs-tools` image](../README.md), using `wbs-tools@X.Y.Z` release tags. WBS selects a compatible tools major version.

Compatible minor and patch tools releases become available to normal installations without changing the WBS configuration. A WBS release is required to select a new tools major version.

Use Conventional Commits for changes in this repository so future release tooling can derive semantic version bumps and changelog entries from commit history.

The branch and tag model is:

- `main` hosts the public bootstrap script at `raw/main/install`. The bootstrap discovers and installs the latest stable `wbs@…` tag.
- `dev` is the integration branch for the next release.
- Wikibase Suite release tags use the format `wbs@X.Y.Z`.
- WBS Tools Docker Image release tags use the format `wbs-tools@X.Y.Z`.
- New development should happen on `dev` or feature branches, then merge to `main` only when ready to become the public installer path.

## Installer entry points

The downloaded bootstrap is browser-first. It installs Docker when needed, pulls the compatible tools image, asks that image to clone the latest stable WBS release, and then delegates to the checkout's internal host launcher:

```bash
bash <(curl -fsSL https://github.com/wmde/wikibase-suite/raw/main/install)
```

From an existing checkout, the supported product entry point remains the root installer:

```bash
/path/to/wikibase-suite/install
/path/to/wikibase-suite/install --from-source
```

The root installer uses the browser UI. The experimental development entry point exposes the terminal configurator and lifecycle commands without publishing a root-level `wbs` product interface:

```bash
cd /path/to/wikibase-suite/development
./wbs install
./wbs up --build
```

Both paths use the same containerized Commander entry point and internal host launcher.

When configuration is resumed, an existing `.env` is the sole base and submitted answers update it without importing new values from the template. The template is used only when creating a new configuration. This preserves custom and release-specific settings while still allowing the CLI or web form to fill missing required values.

For local networking, add `--local`. This retains the normal dependency and checkout behavior; it only selects the no-public-domain networking mode. The installer then defaults to:

```bash
WIKIBASE_PUBLIC_HOST=wikibase.test
WDQS_PUBLIC_HOST=query.wikibase.test
```

Add those hosts to your system hosts file before launching the stack.

## Checkout command options

| Option | Description |
| --- | --- |
| `--web` | Select the browser UI; this is already the root installer's default. |
| `--from-source` | Build WBS tools and all product images from the selected source checkout before installing. |
| `--local` | Use local hostnames without public DNS validation or public certificates. |
| `--debug` | Enable verbose logging and disable quiet Docker pulls. |

The downloaded bootstrap additionally accepts `--wbs-ref REF` to check out a specific WBS branch or tag. It defaults to browser mode.

The old `--cli`, `--skip-clone`, `--skip-deps`, `--skip-launch`, and `--reset` options were never part of a published interface and are not supported.

## Developing the browser installer

From an existing checkout, run:

```bash
cd development
./wbs-dev installer-dev web
```

This builds all local Suite images, mounts the installer application source for live reload, and launches the normal installer and service-startup flow with local test domains. Cached build stages make repeat starts substantially faster.

Use `./wbs-dev installer-dev web --mock` for UI and UX development without changing installer or Suite state. Mock mode uses the same live development server, enables direct navigation among the progress steps, and retains the normal form and validation behavior. Starting installation streams a short simulated image-pull and service-startup log through the completed screen. It does not write configuration, signal the host launcher, or start services. Without `--mock`, steps cannot be skipped and the real installation flow is used.

To test a complete installation from the current checkout, build the tools and product images before starting the installer:

```bash
./install --from-source
```

To install another unpublished branch or tag, select it in the downloaded bootstrap and add `--from-source`:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/wmde/wikibase-suite/main/install) \
  --wbs-ref BRANCH_OR_TAG \
  --from-source
```

This first builds the checkout's tools image and then uses it to build every product image through `development/wbs-dev`. The operation selects `development/docker-compose.local-images.yml` only for that invocation. Local builds retain the development build system's normal `latest` tags; they do not replace the published compatible-major tags. Source builds require more time, CPU, memory, and storage than a normal installation. They anonymously reuse the public build cache produced by CI in GHCR; prefix the command with `BUILD_CACHE_REGISTRY=` to use only the server's local BuildKit cache. WBS tools output is written to `.wbs/wbs.log`; add `--debug` to stream host-side preparation in the terminal. The web installer separately maintains `.wbs/installation.log` for its internal progress events.

## Runtime behavior

- The lifecycle commands are exposed only through experimental `development/wbs`; there is no root-level `wbs` product interface in this release.
- Remote installs discover the highest stable `wbs@MAJOR.MINOR.PATCH` tag and clone it to `~/wikibase-suite`. Set `WBS_DIR` to use a custom checkout path.
- Normal installations pull the compatible WBS tools major selected by the installation scripts, currently `wikibase/wbs-tools:1`. Set `WBS_TOOLS_IMAGE` to test a different published image.
- Lifecycle commands reuse the tools image acquired during installation; they do not pull it again. A future explicit update workflow can own refreshing operational tooling.
- The experimental `development/wbs` launcher selects the checkout's local `wikibase/wbs-tools:latest` image without pulling. It builds that image when missing; run `wbs-dev build wbs-tools` after changing the tools application.
- Source installations requested with `--from-source` build `wikibase/wbs-tools:latest` and explicitly select `development/docker-compose.local-images.yml` for that operation.
- `wbs-dev installer-dev web` builds and uses the local `latest` images for that development session without changing the checkout's persistent product-image selection.
- `wbs-dev installer-dev web --mock` runs the live development server and simulates progress without changing configuration or services.
- The installer web server runs on port `8888` for browser UI installations.
- For non-localhost web installs, the installer tries to obtain a Let's Encrypt certificate on port `80`. If that fails, it falls back to a self-signed certificate and the browser will warn.
- If `docker-compose.local.yml` exists in the Wikibase Suite directory, it is merged automatically.
- If root `local.env` exists, Docker Compose loads it after `.env`. The configurator writes only `.env`.
- After launch, the saved `.env` configuration is displayed. Store credentials securely.

Host-side scripts retain only the bootstrap boundary: Docker checks, tools-image selection, temporary web-container orchestration, and mounting the Docker socket into CLI or worker roles. [`scripts/run-wbs-tools.sh`](../../../../scripts/run-wbs-tools.sh) is the single internal dispatcher and tools-container launcher. Test-only environment variables are explicitly requested by the development harness instead of being part of the product launcher.

## Local installer state

The ignored `.wbs/` directory contains state used only by the temporary browser installer:

- `.wbs/certs/` contains the certificate and private key presented by the temporary installer web server on port `8888`.
- `.wbs/letsencrypt/` contains the temporary installer's Let's Encrypt account and certificate-request state.
- `.wbs/install-request` is the short-lived request passed from the socketless web server to the non-networked installation worker.

The certificate directories are regenerated when needed and are separate from the installed Wikibase Suite HTTPS certificates. The running product's Traefik certificates are stored in the `traefik-letsencrypt-data` Docker volume.
