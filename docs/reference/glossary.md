# Wikibase Suite (WBS) Glossary

## Docker

[Docker](https://docs.docker.com/get-started/docker-overview/) is the software Wikibase Suite (WBS) uses to download its packaged services and run them as isolated processes called containers. A WBS server requires Docker Engine and the Docker Compose plugin.

## Docker Compose

[Docker Compose](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-docker-compose/) is Docker's standard tool for defining and running applications made up of multiple containers. WBS uses a relatively small Compose configuration in the root `docker-compose.yml` file to define the services, images, settings, networks, and persistent data volumes needed to run WBS on a single server.

## Docker image

A [Docker image](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/) is a standardized, read-only package containing an application and the files and dependencies it needs to run. Docker creates a running container from an image. WBS publishes its images on Docker Hub. In installation, operations, and release documentation, **image** usually means **Docker image**.

## Query Service

The SPARQL service for a Wikibase instance. It is often referred to as WDQS, short for Wikidata Query Service.

## QuickStatements 2

[QuickStatements 2](https://github.com/magnusmanske/quickstatements) is an independently developed web tool for importing and editing Wikibase data in batches. Earlier WBS releases packaged it in the `wikibase/quickstatements` image and configured it with OAuth 1.

## QuickStatements 3

[QuickStatements 3](https://github.com/WikimediaBrasil/QuickStatements3) is a separate Django application for Wikibase batch edits. The WBS prototype packages it in the `wikibase/quickstatements3` image and configures it with OAuth 2 and a separate MariaDB database.

## Wikibase

Wikibase is the MediaWiki extension used to build a structured data repository.

In WBS, the main Wikibase service runs on MediaWiki. These docs usually say "Wikibase" for the user-facing service and "MediaWiki" only when referring to upstream MediaWiki configuration, such as `LocalSettings.php`, version upgrades, maintenance scripts, or extensions other than Wikibase.

## Wikibase Suite (WBS)

Wikibase Suite (WBS) is the full deployable Wikibase product, including its Docker Compose configuration, services, tools, and WBS Docker Images. The Wikimedia Deutschland team that maintains the product is also called the Wikibase Suite Team.

## Wikibase Suite (WBS) Docker Images

Wikibase Suite (WBS) Docker Images are published and tested as components of WBS, including Wikibase, Query Service, Query Service frontend, OpenSearch, and QuickStatements 2. The QuickStatements 3 image is currently a prototype. Each published image is released and versioned separately from WBS and can be used independently in other service configurations. They are sometimes referred to as Wikibase Suite (WBS) Images or WBS Images.
