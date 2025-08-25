# Wikibase Suite Deploy Setup

This script bootstraps a Wikibase Suite Deploy installation and guides you through:

1. **Checks/installs Git** – Installs Git if not already available.  
2. **Clones repositories** – Downloads this setup tool and the current version of the Wikibase Suite code.
3. **Checks/installs Docker** – Installs Docker unless already installed.  
4. **Collects configuration** – Through a web interface.  
5. **Launches Wikibase Suite** – Shows you the finalized configuration and links to your services once complete.

## Installing on a new VPS instance

1. Provision a new VPS that:
   - Meets the minimum hardware requirements: https://github.com/wmde/wikibase-release-pipeline/tree/main/deploy#requirements  
   - Runs a supported Linux (Ubuntu 22.04/24.04, Debian 11/12, Fedora, CentOS/Alma/Rocky)  
   - Lets you SSH in as root  

2. SSH in as root and run:

   ```bash
   bash <(curl -fsSL https://raw.githubusercontent.com/lorenjohnson/wbs-deploy-setup/refs/heads/main/start.sh)
   ```

3. After some initial setup messages you'll be provided a web URL to access where you can complete configuration and launching your server.

## Troubleshooting

- **Browser warns about certificate**  
  - If Let’s Encrypt fails, setup falls back to a **self-signed certificate**. You should have been warned in the course of running setup that happened.
  - In this case, your browser will show a warning such as **“Your connection is not private”** when you try and access the setup URL, and it is safe to bypass it to continue setup. 
  - Here are browser-specific steps on how to bypass the warning, see [Vultr’s guide to bypassing HTTPS warnings for self-signed certificates](https://docs.vultr.com/how-to-bypass-the-https-warning-for-self-signed-ssl-tls-certificates).

## More for developers and testers

If you are testing this setup utility locally, developing on it, or need non‑standard setups of the Wikibase Suite stack, see [DEVELOPMENT.md](DEVELOPMENT.md) in this repository for detailed guidance on local runs, CLI options, and localhost defaults.
