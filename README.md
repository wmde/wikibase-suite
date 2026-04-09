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
  - [Requirements](#requirements)
  - [Setup](#setup)
  - [Initial Configuration](#initial-configuration)
  - [Starting instance](#starting)
  - [Stopping instance](#stopping)
  - [Resetting the configuration](#resetting-the-configuration)
- [Call Back](#call-back)
- [Updating and Versioning](updating-and-versioning.md)
- [Advanced Configuration](advanced-configuration.md)
- [Managing your data](manage-your-data.md)
- [Frequently Asked Questions](FAQs.md)
- [Removing Wikibase Suite Completely with all its Data](removing-wikibase.md)
- [WDQS](wdqs.md)

---

## Installation

### 1. Requirements

#### Hardware

Most Wikibase production installs are on cloud-based servers. Below we list the official installation guides for some commonly used hosting providers:
- [Hetzner](https://docs.hetzner.com/cloud/servers/getting-started/creating-a-server/)
- [DigitalOcean](https://www.digitalocean.com/community/tutorials/initial-server-setup-with-ubuntu)
- [Akamai](https://techdocs.akamai.com/cloud-computing/docs/set-up-and-secure-a-compute-instance)
- [Vultr](https://docs.vultr.com/products/compute/cloud-compute/provisioning)

The minimum requirements for your server are as follows: 
- Network connection with a public IP address
- x86_64 (AMD64) architecture
- 8 GB RAM
- 4 GB free disk space

#### Software

- Docker 22.0 or greater ([installation documentation](https://docs.docker.com/engine/install/ubuntu/#installation-methods))
- Docker Compose 2.10 or greater ([installation documentation](https://docs.docker.com/compose/install/))
- [git](https://git-scm.com/install/) 

#### Domain names

You'll need to configure two DNS records with fully qualified domain names that resolve to your server's IP address, one for Wikibase itself and one for the query service (WDQS). Many Wikibase users configure the query service as a subdomain of the main address:

Examples:
- Wikibase: "yourdomain.example"
- WDQS: "query.yourdomain.example"

---

### 2. Setup

#### Download WBS Deploy

Check out the files from Github, then change to the subdirectory `deploy`.

```sh
git clone https://github.com/wmde/wikibase-release-pipeline
cd wikibase-release-pipeline/deploy
```

---

### 3. Initial configuration

Make a copy of the [configuration template](./template.env) in the `wikibase-release-pipeline/deploy` directory.

```sh
cp template.env .env
```

Open the file in the text editor of your choice. (Options include but are not limited to vim, nano, kedit, Sublime Text, and VSCode.)

---

### 4. Editing the file

#### Public hostnames
The domain names for your Wikibase Suite services should be configured on your DNS host to point to the public IP address 
of the server you are deploying to. Note that you need two distinct names, i.e., two different fully qualified domain names. Without them, the traefik reverse proxy cannot route properly.

#### MediaWiki (Wikibase) user
Please enter the username, email address and password you would like to use to log into the Wikibase web interface.

> [!NOTE]
> Password must be at least 10 characters, different from your username, and must not appear in the list of commonly used passwords 
> this project uses. If these conditions are not met, the container won't run successfully.

#### Database configuration:
These settings are used to configure the MariaDB container when creating a new database, and by MediaWiki when generating a new `LocalSettings.php` file. They won't be set on an existing database, nor will MediaWiki update those settings in your `LocalSettings.php`. To change those settings, adjust them manually in MariaDB and your `LocalSettings.php` file. Alternatively, delete your MariaDB volume `mysql-data` (all data will be lost) and the `LocalSettings.php` file from the `./config` directory, then restart.

> [!NOTE]
> These values do not need to be changed for the instance to successfully be set up.

#### Callback
The callback function allows for maintaining an index of Wikibases. You can find more information [here](./4-FAQs.md#what-are-the-future-plans-for-the-call-back-feature-and-what-information-does-it-collect). Set this variable to `true` to opt in or `false` to opt out.

```sh
METADATA_CALLBACK=true
```

> [!NOTE]
> If this variable is not set, the container will not run successfully.

---

### 5. Starting Wikibase

Run the following command from within the `wikibase-release-pipeline/deploy` directory:

```sh
docker compose up
```

The first start may take a couple of minutes. You can check the status of the stack by running `docker ps` from another terminal. When your WBS Deploy instance is ready, the `wbs-deploy-wikibase-1` container will be marked `healthy`.

🎉 Congratulations! You can now access your instance via your domain name.

> [!NOTE]
> If anything goes wrong, you can run `docker logs <CONTAINER_NAME>` to see some helpful error messages. Should you run into some issues in this step, make sure to [reset the configuration](#resetting-the-configuration) after you fix the error.

---

### 6. Stopping

To stop Wikibase, run:

```sh
docker compose stop
```

---

### Resetting the configuration

Most values set in `.env` are written into the respective containers after you run `docker compose up` for the first time.

To reset the configuration while retaining your existing data:

1. Make any needed changes to the values in `.env`.
> [!NOTE] Do not change `DB_*` values unless you are also [re-creating the database](#removing-wikibase-suite-completely-with-all-its-data).
2. Back up and then remove the `LocalSettings.php` file from the `deploy/config` directory.
3. Remove and re-create the containers by running:

```sh
docker compose down
docker compose up
```
