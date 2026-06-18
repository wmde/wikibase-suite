# Wikibase Suite Installer

This directory contains the installer implementation used by the root [install](../install) script. For normal installation instructions, start with [Installation](../docs/installation.md).

During installation, the installer:

1. Checks for and installs Git if it is not already available.
2. Downloads Wikibase Suite to `~/wikibase-suite` if the script is not already running from a local checkout.
3. Checks for and installs Docker unless it is already installed.
4. Opens the browser UI to guide the user through configuration.
5. Shows the finalized configuration and links to the running services once complete.

## Development

Use this section only when developing, reviewing, or testing the installer.

- [DEVELOPMENT.md](DEVELOPMENT.md) covers local runs, CLI options, localhost installation, reset flags, WBS refs, and other custom installation paths.
- [docs/adrs/README.md](docs/adrs/README.md) lists architecture decision records.
