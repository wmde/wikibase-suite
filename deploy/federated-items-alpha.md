# Federated Items Alpha Version
In federated items, the local instance refers to data on a remote instance. We are currently in our Alpha version for Federated Items. This allows you to add Wikidata items as values (objects) to your Wikibase instance.

> [!NOTE]
> This feature is not stable yet. We are actively collecting feedback and plan to add more functionality throughout the year.

There are also some limitations we would like to make you aware of for the alpha version:
* The representation of federated items in the API has not been worked on, yet. It will be part of one of upcoming work packages and we would like to get feedback on API requirements.
* Reconciling the QueryService with the newly added Wikidata items is under active investigation and development.

This guide is for those who want to install a fresh Wikibase instance for testing. You can use [this guide](7-updating-existing-wikibase.md) to update your existing Wikibase to the alpha version.

---

## Installation

### 1. Requirements

#### Hardware

Most Wikibase production installs are on cloud-based servers. The minimum requirements for your server are as follows:
- Network connection with a public IP address
- x86_64 (AMD64) architecture
- 8 GB RAM
- 20 GB free disk space

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
git checkout test-alpha-deployment
```

---

### 3. Initial configuration

Make a copy of the [configuration template](./.env.example) in the `wikibase-release-pipeline/deploy` directory.

```sh
cp .env.example .env
```

Open the file in the text editor of your choice. (Options include but are not limited to vim, nano, kedit, Sublime Text, and VSCode.)

---

### 4. Editing environment variables

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
> `DB_PASS` must be changed for the instance to successfully be set up.

#### Callback
The callback function allows for maintaining an index of Wikibases. You can find more information [here](./README.md#5-initial-configuration). Set this variable to `true` to opt in or `false` to opt out.

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

The first start may take a couple of minutes. You can check the status of the stack by running `docker compose ps` from another terminal. When your WBS Deploy instance is ready, the `wikibase` service will be marked `healthy`.

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

To reset the configuration while retaining your existing data, follow [Resetting an instance](./docs/resetting.md).
