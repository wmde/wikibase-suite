# Installing Wikibase Suite (WBS)

Wikibase Suite (WBS) is a production-ready Wikibase software bundle for self-hosting a public knowledge graph similar to Wikidata. It includes MediaWiki, Wikibase, Query Service, QuickStatements 3, and HTTPS routing for a public instance.

For installation without the browser-based installer, see [Manual Installation](./install-via-cli.md).

## Before You Start – What You Need 

> [!NOTE]
> These are mandatory steps. Wikibase Suite is not meant for local installations. 
<br>

### 1. Server (VPS)

You need a Linux-based server that meets these minimum requirements:

- Server with a public IP address
- Architecture: x86 (AMD/Intel)
- RAM: min. 8 GB
- Storage: min. 4 GB
- Operating System: Ubuntu (recommended) 

<br>

### 2. Domain registration

You need two domain configurations – a main domain for your Wikibase and a subdomain for the Query Service software:

- Main domain for your Wikibase: `yourdomain.com`
- Subdomain for Query Service: `query.yourdomain.com`

**How to configure domains for your server (VPS):**
- Log in to your domain provider’s control panel
- Go to the DNS Settings section
- Delete all AAAA records
- Add these two A records:
  
| Record name  | Value                  | Type | 
| -------------| ---------------------- |------|
| @            | IP address from server | A    |
| query        | IP address from server | A    |

<br>

## Start the Wikibase Suite Installer

### Connect to your server

- Open a terminal program on your computer.
- Access your server by entering the command below.
- Enter the password generated for your server, or use your personal SSH key, depending on your server provider.

```sh
ssh root@SERVER_IP_ADDRESS
```
<img width="600" src="./assets/installer-terminal-access.webp" alt="Terminal showing SSH access to the server">
<br>

### Start the installer

- Start setup by copying and pasting the command below.
- Wait for the initial setup to finish. This can take about a minute.
- Open the provided link in your web browser to start the Wikibase Suite Installer.

<br>

```sh
curl -fsSL https://wmde.github.io/wikibase-suite-install | bash
```

This command installs the latest stable WBS release identified by a
`wbs@MAJOR.MINOR.PATCH` tag and starts its browser installer.

<br>
<img width="600" src="./assets/installer-run-command.webp" alt="Terminal showing the installer URL">
<br>

## Configure and install Wikibase Suite

The Wikibase Suite Installer walks you through the steps to configure and install your Wikibase instance.

<br>
<img width="600" src="./assets/installer-start.webp" alt="Wikibase Suite Installer welcome screen">
<br>


### Connect your domain and subdomain:
Enter the domain names you registered in the requirements step:

- Main domain to access your Wikibase.
- Subdomain to access the Query Service software.

<br>
<img width="600" src="./assets/installer-step-1-domains.webp" alt="Installer fields for the Wikibase and Query Service domains">
<br>


### Create an administrator account for your Wikibase:
This is your personal login for managing your Wikibase. Fill in:
- Email address – used for account recovery and notifications
- Username – the name you’ll use to log in (publicly visible as editor)
- Password – choose something strong (at least 10 characters)


<br>
<img width="600" src="./assets/installer-step-2-admin.webp" alt="Installer fields for creating the administrator account">
<br>


### Set up database credentials.

The database is where all your Wikibase content is stored behind the scenes. You don’t interact with it directly, but it needs a password to keep your data secure. The installer provides a default database configuration if you do not enter custom credentials.
- Database name and database username – you can leave the defaults unless you have a specific reason to change them.
- Database password – set a strong, unique password

<br>
<img width="600" src="./assets/installer-step-3-database.webp" alt="Installer fields for the database credentials">
<br>

### Visibility

Help us understand the Wikibase ecosystem. Wikibase is used by hundreds of libraries, museums, research projects and companies — but nobody has a clear picture of how big or how diverse that ecosystem really is. You can help change that by providing some statistics from your Wikibase.

<br>
<img width="600" src="./assets/installer-step-4-visibility.webp" alt="Installer options for sharing visibility statistics">
<br>

### Run the installation for all WBS components.

All Wikibase Suite components will be downloaded and installed. This may take a few minutes.

<br>
<img width="600" src="./assets/installer-step-5-installation.webp" alt="Installer progress for all Wikibase Suite components">
<br>

### Congratulations: You have installed your own Wikibase instance!

You can directly access your Wikibase, the Query Service and QuickStatements 3. Everything is configured and ready to use.

Note: **Download the configuration file.**

<br>
<img width="600" src="./assets/installer-success.webp" alt="Wikibase Suite installation success screen">
<br>

### Share your feedback with us
How did the installation go? [Feedback >](https://forms.zohopublic.eu/wmde/form/ServiceSatisfaction1/formperma/6KQbSMNVmkO-wrpPWa5OW_9HUQbTFdPBRP07Q94fe-8)

<br>

## Support

If something is not working as expected, start with [Troubleshooting](../operate/troubleshooting.md). If you have questions or need help, use this [bug report form](https://phabricator.wikimedia.org/maniphest/task/edit/form/129/) to start a conversation with the engineering team.
