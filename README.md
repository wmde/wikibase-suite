# Wikibase Suite Deploy Setup

This setup tool installs [Wikibase Suite Deploy](https://github.com/wmde/wikibase-release-pipeline/tree/main/deploy) on a new Linux VPS or cloud server.

During setup, it:

1. Checks for and installs Git if it is not already available.
2. Downloads this setup tool and the selected Wikibase Suite Deploy code.
3. Checks for and installs Docker unless it is already installed.
4. Opens the web setup UI, or the command-line setup wizard if you omit `--web`.
5. Shows the finalized configuration and links to your services once complete.

## Install on a new VPS

1. Provision a new VPS that:
   - Meets the minimum hardware requirements: https://github.com/wmde/wikibase-release-pipeline/tree/main/deploy#1-requirements
   - Uses AMD64 (`x86_64`) architecture
   - Runs a supported Linux with `apt-get` or `dnf` available (Ubuntu 22.04/24.04, Debian 11/12, Fedora, CentOS Stream/RHEL/Rocky/Alma)
   - Lets you SSH in as the root user

2. SSH in as root and run the web setup:

   ```bash
   bash <(curl -fsSL https://raw.githubusercontent.com/wmde/wbs-deploy-setup/refs/heads/main/start.sh) --web
   ```

   To install a specific Wikibase Suite Deploy branch or tag, pass it as a deploy ref:

   ```bash
   bash <(curl -fsSL https://raw.githubusercontent.com/wmde/wbs-deploy-setup/refs/heads/main/start.sh) --web --deploy-ref deploy@7.0.0
   ```

3. Open the setup URL printed in the terminal and follow the web setup steps.

## Troubleshooting

**Browser warns about certificate.** If Let’s Encrypt fails, setup falls back to a **self-signed certificate** and warns you in the terminal. Your browser may then show a warning such as **“Your connection is not private”** when you open the setup URL. It is safe to bypass that warning to continue setup. For browser-specific steps, see [Vultr’s guide to bypassing HTTPS warnings for self-signed certificates](https://docs.vultr.com/how-to-bypass-the-https-warning-for-self-signed-ssl-tls-certificates).

## Development

Use this section only when you are developing, reviewing, or testing this setup tool.

- [DEVELOPMENT.md](DEVELOPMENT.md) covers local runs, CLI options, localhost setup, reset flags, deploy refs, and other non-standard setup paths.
- [docs/README.md](docs/README.md) links to additional implementation and project notes.
