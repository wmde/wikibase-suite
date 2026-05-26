# Wikibase Suite

Wikibase Suite (WBS) helps you run your own [Wikibase](https://wikiba.se) on a server.

WBS is a supported and tested Docker Compose configuration that facilitates deployment of the following services to a public Internet server:

- **[Wikibase](../build/wikibase/README.md):** MediaWiki service with the Wikibase extension included for creating and managing your Wikibase data.
- **Job Runner:** Background job service used by Wikibase.
- **[MariaDB](https://hub.docker.com/_/mariadb):** Database service used by Wikibase.
- **[Elasticsearch](../build/elasticsearch/README.md):** Search service used by Wikibase.
- **[Query service](../build/wdqs/README.md):** SPARQL service for querying Wikibase data.
- **[Query service frontend](../build/wdqs-frontend/README.md):** Web interface for SPARQL queries.
- **[Query service updater](../build/wdqs/README.md):** Keeps query service data in sync with Wikibase.
- **[QuickStatements](../build/quickstatements/README.md):** A web-based tool to import and manipulate large amounts of data.
- **[Traefik](https://hub.docker.com/_/traefik):** A reverse proxy that handles TLS termination and SSL certificate renewal through ACME.

### Index
- [Installation](#installation)
- [Upgrading](./docs/updating.md)
- [Uninstalling](./docs/uninstalling.md)
- [Glossary](./docs/glossary.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Support](#support)

---

## Installation

> [!IMPORTANT]
> This guide is for setting up WBS on an internet-reachable Linux server, not on your laptop or desktop. WBS needs public DNS records and HTTPS certificate setup to work correctly. If you are looking for individual WBS images instead of the full setup, see [hub.docker.com/u/wikibase](https://hub.docker.com/u/wikibase).

### 1. Provision a VPS

Start by provisioning a Linux VPS or cloud server for your WBS instance. Most Wikibase production installs are on cloud-based servers. Below we list the official installation guides for some commonly used hosting providers:
- [Hetzner](https://docs.hetzner.com/cloud/servers/getting-started/creating-a-server/)
- [DigitalOcean](https://www.digitalocean.com/community/tutorials/initial-server-setup-with-ubuntu)
- [Akamai](https://techdocs.akamai.com/cloud-computing/docs/set-up-and-secure-a-compute-instance)
- [Vultr](https://docs.vultr.com/products/compute/cloud-compute/provisioning)

The minimum requirements for your server are as follows:
- 64-bit x86 architecture (`amd64` / `x86_64`); ARM servers are not currently supported by the published WBS images
- 8 GB RAM
- 20 GB free disk space to start, with more needed as your wiki data grows
- inbound HTTP and HTTPS traffic allowed on ports 80 and 443

### 2. Prepare domain names

You need a domain you own or control, and access to that domain provider's DNS settings.

Choose two hostnames for your WBS services: one for Wikibase itself and one for the query service. These are the web addresses where people will access your Wikibase and query service. Many Wikibase users configure the query service as a subdomain of the main address.

Examples:
- Wikibase: `yourdomain.example`
- Query service: `query.yourdomain.example`

In your DNS provider's control panel, create two records of either `A` or `CNAME` type, one for each hostname. Point both records to your server's public IP address. Note that DNS record changes may take a few minutes to propagate.

> [!NOTE]
> Your DNS provider may call the IP address field `value`, `content`, `address`, or `points to`. Use only the server's public IP address as the value.

To learn more about DNS records, see [DNS basics](https://developer.mozilla.org/en-US/docs/Glossary/DNS) or [Understanding DNS records](https://learn.wordpress.org/lesson/domain-management-understanding-dns-records/). Common provider guides are also available for [Cloudflare](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/), [GoDaddy](https://www.godaddy.com/help/add-an-a-record-19238), and [Namecheap](https://www.namecheap.com/support/knowledgebase/article.aspx/319/2237/how-can-i-set-up-an-a-address-record-for-my-domain/).

---

### 3. Install dependencies

Most bare VPS instances do not have current versions of Docker, Docker Compose, or git installed. Before continuing, install these dependencies on your server:

- Install Docker Engine 22.0 or greater, including the Docker Compose plugin 2.10 or greater: [installation documentation](https://docs.docker.com/engine/install/)
- Install git: [installation documentation](https://git-scm.com/install/)

---

### 4. Download WBS

Check out the files from GitHub, then change to the subdirectory `deploy`.

```sh
git clone https://github.com/wmde/wikibase-release-pipeline
cd wikibase-release-pipeline/deploy
```

---

### 5. Initial configuration

Make a copy of the [example environment file](./.env.example) in the `wikibase-release-pipeline/deploy` directory.

```sh
cp .env.example .env
```

Edit `.env` and set the values below.

| Setting | Default value | Description |
| --- | --- | --- |
| `WIKIBASE_PUBLIC_HOST` | None | The public hostname for your Wikibase web interface. Use one of the hostnames from step 2, without `https://` or a trailing slash. |
| `WDQS_PUBLIC_HOST` | None | The public hostname for the query service web interface and SPARQL endpoint. Use the other hostname from step 2, without `https://` or a trailing slash. This must be different from `WIKIBASE_PUBLIC_HOST`. |
| `MW_ADMIN_NAME` | None | The username for the first MediaWiki administrator account. |
| `MW_ADMIN_EMAIL` | None | The email address for the first MediaWiki administrator account. |
| `MW_ADMIN_PASS` | None | The password for the first MediaWiki administrator account. It must be at least 10 characters, must be different from `MW_ADMIN_NAME`, and must not appear in the list of commonly used passwords checked by MediaWiki. |
| `DB_NAME` | `my_wiki` | The name of the MariaDB database created for MediaWiki. The default value can be used for a new install. |
| `DB_USER` | `sqluser` | The MariaDB user created for MediaWiki. The default value can be used for a new install. |
| `DB_PASS` | `change-this-password` | The MariaDB password for `DB_USER`. Set this to something other than the default value before first start. |
| `METADATA_CALLBACK` | `true` | Set to `true` to opt into the WBS metadata callback, or `false` to opt out. Unlike the other `.env` values, this value may be changed after initial setup; restart the services for the change to take effect. |

> [!WARNING]
> With the exception of `METADATA_CALLBACK`, `.env` values are setup values. If you need to change them after first start, you also need to reset WBS (see [Resetting an instance](./docs/resetting.md)).

---

### 6. Starting Wikibase

Run the following command from within the `wikibase-release-pipeline/deploy` directory:

```sh
docker compose up -d
```

The first start may take a couple of minutes. You can check the status of the stack by running `docker compose ps` from another terminal. When your WBS instance is ready, the `wikibase` service will be marked `healthy`.

You can now access your services using the hostnames you set in `.env`:

- Wikibase: `https://<WIKIBASE_PUBLIC_HOST>`
- Query service web interface: `https://<WDQS_PUBLIC_HOST>`
- Query service SPARQL endpoint: `https://<WDQS_PUBLIC_HOST>/sparql`
- QuickStatements: `https://<WIKIBASE_PUBLIC_HOST>/tools/quickstatements`

> [!NOTE]
> If anything goes wrong, see [Troubleshooting](./docs/troubleshooting.md).

---

### 7. Stopping and restarting

To stop WBS without deleting data, run:

```sh
docker compose down
```

To restart it, run:

```sh
docker compose up -d
```

## Support

If something is not working as expected, start with [Troubleshooting](./docs/troubleshooting.md). If you have questions or need help, use this [bug report form](https://phabricator.wikimedia.org/maniphest/task/edit/form/129/) to start a conversation with the engineering team.
