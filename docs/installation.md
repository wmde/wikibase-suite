# Install Wikibase Suite

Wikibase Suite is a production-ready Wikibase software bundle for self-hosting a public knowledge graph similar to Wikidata. It includes MediaWiki, Wikibase, Query Service, QuickStatements, and HTTPS routing for a public instance.

## 1. Provision a VPS

Start by provisioning a Linux VPS or cloud server for your WBS instance. Most Wikibase production installs are on cloud-based servers. Follow your provider's documentation to create a server that meets the requirements below.

The minimum requirements for your server are as follows:
- 64-bit x86 architecture (`amd64` / `x86_64`); ARM servers are not currently supported by the published WBS images
- 8 GB RAM
- 20 GB free disk space to start, with more needed as your wiki data grows
- inbound HTTP and HTTPS traffic allowed on ports 80 and 443

## 2. Start the Wikibase Suite Installer

### Connect to Your Server

<img align="right" width="360" src="https://wikiba.se/wp-content/webp-express/webp-images/doc-root/wp-content/uploads/sites/7/2026/05/Bildschirmfoto-2026-05-17-um-19.13.06.png.webp" alt="Terminal showing SSH access to the server">

- Open a terminal program on your computer.
- Access your server by entering the command below.
- Enter the password generated for your server, or use your personal SSH key, depending on your server provider.

<br clear="right">
<br>

```sh
ssh root@SERVER_IP_ADDRESS
```

<br>

### Start the Installer

<img align="right" width="360" src="https://wikiba.se/wp-content/webp-express/webp-images/doc-root/wp-content/uploads/sites/7/2026/05/Bildschirmfoto-2026-05-17-um-19.17.17.png.webp" alt="Terminal showing the installer URL">

- Start setup by copying and pasting the command below.
- Wait for the initial setup to finish. This can take about a minute.
- Open the printed link in your web browser to start the Wikibase Suite Installer.

<br clear="right">
<br>

```sh
bash <(curl -fsSL https://github.com/wmde/wikibase-suite/raw/main/install) --web
```

<br>

## 3. Configure and Install Wikibase Suite

<img align="right" width="300" src="https://wikiba.se/wp-content/webp-express/webp-images/doc-root/wp-content/uploads/sites/7/2026/05/Bildschirmfoto-vom-2026-05-19-11-43-34.png.webp" alt="Wikibase Suite Installer welcome screen">

The Wikibase Suite Installer walks you through the steps to configure and install your Wikibase instance.

<br clear="right">
<br>

<img align="right" width="300" src="https://wikiba.se/wp-content/webp-express/webp-images/doc-root/wp-content/uploads/sites/7/2026/05/Bildschirmfoto-vom-2026-05-19-11-43-50.png.webp" alt="Domain configuration screen">

Configure your domain and subdomain:

- Main domain for public access to your Wikibase.
- Subdomain for the Query Service software.

<br clear="right">
<br>

<img align="right" width="300" src="https://wikiba.se/wp-content/webp-express/webp-images/doc-root/wp-content/uploads/sites/7/2026/05/Bildschirmfoto-vom-2026-05-19-11-44-57.png.webp" alt="Administrator account screen">

Create an administrator account for your Wikibase:

- Name
- Email
- Password

<br clear="right">
<br>

<img align="right" width="300" src="https://wikiba.se/wp-content/webp-express/webp-images/doc-root/wp-content/uploads/sites/7/2026/05/Bildschirmfoto-vom-2026-05-19-11-46-13.png.webp" alt="Database configuration screen">

**Optional:** set up database credentials.

The installer provides a default database configuration if you do not enter custom credentials.

<br clear="right">
<br>

<img align="right" width="300" src="https://wikiba.se/wp-content/webp-express/webp-images/doc-root/wp-content/uploads/sites/7/2026/05/Bildschirmfoto-vom-2026-05-19-11-25-01.png.webp" alt="Installation progress screen">

Run the installation for all Wikibase Suite components.

This might take a few minutes.

<br clear="right">
<br>

<img align="right" width="300" src="https://wikiba.se/wp-content/webp-express/webp-images/doc-root/wp-content/uploads/sites/7/2026/05/Bildschirmfoto-vom-2026-05-19-11-27-26.png.webp" alt="Completed installation screen">

**Congratulations:** You have installed your own Wikibase instance!

You can directly access your Wikibase, the Query Service and QuickStatements. Everything is configured and ready to use.

Note: **Download the configuration file.**

<br clear="right">

## Support

If something is not working as expected, start with [Troubleshooting](./troubleshooting.md). If you have questions or need help, use this [bug report form](https://phabricator.wikimedia.org/maniphest/task/edit/form/129/) to start a conversation with the engineering team.
