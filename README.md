# Wikibase Suite Deploy

Wikibase Suite (WBS) Deploy is a containerized, production-ready [Wikibase](https://wikiba.se) system that allows you to self-host a knowledge graph similar to [Wikidata](https://www.wikidata.org/wiki/Wikidata:Main_Page). 

This installation guide walks you through how to set up a production-ready Wikibase. This guide isn't for hosting Wikibase locally.

WBS Deploy consists of the following services:

- **[Wikibase](https://hub.docker.com/r/wikibase/wikibase):** MediaWiki packaged with the Wikibase extension and other commonly used extensions.
- **Job Runner:** The MediaWiki [JobRunner](https://www.mediawiki.org/wiki/Manual:Job_queue#Cron) service which uses the same Wikibase container as above.
- **[MariaDB](https://hub.docker.com/_/mariadb):** Database service for MediaWiki and Wikibase.
- **[Elasticsearch](https://hub.docker.com/r/wikibase/elasticsearch):** Search service used by MediaWiki.
- **[WDQS](https://hub.docker.com/r/wikibase/wdqs):** Wikidata Query Service to process SPARQL queries.
- **[WDQS Frontend](https://hub.docker.com/r/wikibase/wdqs-frontend)** Web front end for SPARQL queries.
- **[WDQS Updater](https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual#runUpdate.sh):** Keeps the WDQS data in sync with Wikibase.
- **[Quickstatements](https://hub.docker.com/r/wikibase/quickstatements):** A web-based tool to import and manipulate large amounts of data.
- **[Traefik](https://hub.docker.com/_/traefik):** A reverse proxy that handles TLS termination and SSL certificate renewal through ACME.

The service orchestration is implemented using Docker Compose V2.

> [!NOTE]
> This document is for people wanting to self-host the full Wikibase Suite using Wikibase Suite Deploy. If you are looking for individual WBS images, head over to [hub.docker.com/u/wikibase](https://hub.docker.com/u/wikibase). This document presumes familiarity with basic Linux administration tasks and with [Docker](https://docs.docker.com/get-started/) and [Docker Compose](https://docs.docker.com/compose/).

### Index
- [Installation](#installation)
- [Updating](./docs/updating.md)
- [Backup and restore](./docs/backup-and-restore.md)
- [Resetting or removing an instance](./docs/resetting-and-removing.md)
- [Advanced configuration](./docs/advanced-configuration.md)
- [Help and support](#help-and-support)

---

## Installation

### 1. Provision a VPS

Start by provisioning a VPS or cloud server for your Wikibase Suite instance. Most Wikibase production installs are on cloud-based servers. Below we list the official installation guides for some commonly used hosting providers:
- [Hetzner](https://docs.hetzner.com/cloud/servers/getting-started/creating-a-server/)
- [DigitalOcean](https://www.digitalocean.com/community/tutorials/initial-server-setup-with-ubuntu)
- [Akamai](https://techdocs.akamai.com/cloud-computing/docs/set-up-and-secure-a-compute-instance)
- [Vultr](https://docs.vultr.com/products/compute/cloud-compute/provisioning)

The minimum requirements for your server are as follows:
- 64-bit x86 architecture (`amd64` / `x86_64`)
- 8 GB RAM
- 4 GB free disk space

---

### 2. Prepare domain names

You need a domain you own or control, and access to that domain provider's DNS settings.

Choose two hostnames for your Wikibase Suite services: one for Wikibase itself and one for the query service (WDQS). Many Wikibase users configure the query service as a subdomain of the main address.

Examples:
- Wikibase: `yourdomain.example`
- WDQS: `query.yourdomain.example`

In your DNS provider's control panel, create two `A` records, one for each hostname. Point both records to your server's IP address. DNS record changes may take a few minutes to propagate.

---

### 3. Install dependencies

Most bare VPS instances do not have current versions of Docker, Docker Compose, or git installed. Before continuing, install these dependencies on your server:

- Install Docker 22.0 or greater, including the Docker Compose plugin 2.10 or greater: [installation documentation](https://docs.docker.com/engine/install/)
- Install git: [installation documentation](https://git-scm.com/install/)

---

### 4. Download WBS Deploy

Check out the files from Github, then change to the subdirectory `deploy`.

```sh
git clone https://github.com/wmde/wikibase-release-pipeline
cd wikibase-release-pipeline/deploy
```

---

### 5. Initial configuration

Make a copy of the [configuration template](./template.env) in the `wikibase-release-pipeline/deploy` directory.

```sh
cp template.env .env
```

Edit `.env` and set the values below.

#### Public hostnames

- `WIKIBASE_PUBLIC_HOST`
  The public hostname for your Wikibase web interface. Use one of the hostnames from step 2, without `https://` and without a trailing slash.
- `WDQS_PUBLIC_HOST`
  The public hostname for the WDQS web interface and SPARQL endpoint. Use the other hostname from step 2, without `https://` and without a trailing slash. This must be different from `WIKIBASE_PUBLIC_HOST`.

#### MediaWiki (Wikibase) user

- `MW_ADMIN_NAME`
  The username for the first MediaWiki administrator account.
- `MW_ADMIN_EMAIL`
  The email address for the first MediaWiki administrator account.
- `MW_ADMIN_PASS`
  The password for the first MediaWiki administrator account. It must be at least 10 characters, must be different from `MW_ADMIN_NAME`, and must not appear in the list of commonly used passwords checked by MediaWiki.

#### Database configuration:

- `DB_NAME`
  The name of the MariaDB database created for MediaWiki. The default value can be used for a new install.
- `DB_USER`
  The MariaDB user created for MediaWiki. The default value can be used for a new install.
- `DB_PASS`
  The MariaDB password for `DB_USER`. Set this to something other than the default value before first start.

#### Callback

- `METADATA_CALLBACK`
  Set to `true` to opt into the Wikibase Suite metadata callback, or `false` to opt out. Unlike the other `.env` values, this value may be changed after initial setup; restart the services for the change to take effect.

> [!WARNING]
> With the exception of `METADATA_CALLBACK`, `.env` values are setup values. If you need to change them after first start, follow [Resetting an instance](./docs/resetting-and-removing.md#resetting-an-instance).

---

### 6. Starting Wikibase

Run the following command from within the `wikibase-release-pipeline/deploy` directory:

```sh
docker compose up -d
```

The first start may take a couple of minutes. You can check the status of the stack by running `docker ps` from another terminal. When your WBS Deploy instance is ready, the `wbs-deploy-wikibase-1` container will be marked `healthy`.

You can now access your services using the hostnames you set in `.env`:

- Wikibase: `https://<WIKIBASE_PUBLIC_HOST>`
- WDQS web front end: `https://<WDQS_PUBLIC_HOST>`
- WDQS SPARQL endpoint: `https://<WDQS_PUBLIC_HOST>/sparql`
- QuickStatements: `https://<WIKIBASE_PUBLIC_HOST>/tools/quickstatements`

> [!NOTE]
> If anything goes wrong, you can run `docker logs <CONTAINER_NAME>` to see some helpful error messages. Should you run into some issues in this step, make sure to [reset the instance](./docs/resetting-and-removing.md) after you fix the error.

---

### 7. Stopping

To stop Wikibase, run:

```sh
docker compose stop
```

## Help and support

If you have questions or need help, use this [bug report form](https://phabricator.wikimedia.org/maniphest/task/edit/form/129/) to start a conversation with the engineering team.
