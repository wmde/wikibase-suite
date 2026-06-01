# Wikibase Suite Installer

The Wikibase Suite Installer installs [Wikibase Suite](https://github.com/wmde/wikibase-release-pipeline/tree/main/deploy) on a new Linux VPS or cloud server and guides you through configuration.

During installation, it:

1. Checks for and installs Git if it is not already available.
2. Downloads this installation tool along with the selected Wikibase Suite code.
3. Checks for and installs Docker unless it is already installed.
4. Opens the browser UI to guide you through configuration.
5. Shows the finalized configuration and links to your services once complete.

## Install on a new VPS

1. Provision a new VPS that meets the [minimum hardware requirements](https://github.com/wmde/wikibase-release-pipeline/tree/main/deploy#1-requirements).

2. SSH in as root of the VPS and run the web installer:

   ```bash
   bash <(curl -fsSL https://github.com/wmde/wbs-deploy-setup/raw/main/install)
   ```

   *To install a specific Wikibase Suite branch or tag, add `--wbs-ref REF`, for example `--wbs-ref deploy@7.0.0`.*

3. Open the installer URL printed in the terminal and follow the browser steps.

## Troubleshooting

**Browser warns about certificate.** If Let’s Encrypt fails, the installer falls back to a **self-signed certificate** and warns you in the terminal. Your browser may then show a warning such as **“Your connection is not private”** when you open the installer URL. It is safe to bypass that warning to continue installation. For browser-specific steps, see [Vultr’s guide to bypassing HTTPS warnings for self-signed certificates](https://docs.vultr.com/how-to-bypass-the-https-warning-for-self-signed-ssl-tls-certificates).

## Development

Use this section only when you are developing, reviewing, or testing the installer.

- [DEVELOPMENT.md](DEVELOPMENT.md) covers local runs, CLI options, localhost installation, reset flags, WBS refs, and other non-standard installation paths.
- [docs/adrs/README.md](docs/adrs/README.md) lists architecture decision records.
