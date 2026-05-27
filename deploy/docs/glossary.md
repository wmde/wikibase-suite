# Glossary

## Wikibase

Wikibase is the MediaWiki extension used to build a structured data repository.

In WBS, the main Wikibase service runs on MediaWiki. These docs usually say "Wikibase" for the user-facing service and "MediaWiki" only when referring to upstream MediaWiki concepts such as `LocalSettings.php`, extensions, version upgrades, or maintenance scripts.

## Wikibase Suite

Wikibase Suite (WBS) is the base name for this product line: the full deployable Wikibase setup, the related Docker images, and the team at Wikimedia Deutschland that maintains them. On its own, WBS usually means the full deployable setup.

## Wikibase Suite Deploy

Wikibase Suite Deploy is the Docker Compose setup in the `deploy` directory. It runs a full WBS instance using the published WBS images. This name is used when the documentation needs to refer specifically to the deployment files or setup mechanism.

## Wikibase Suite images

Wikibase Suite images are the published Docker images used by WBS Deploy, including the Wikibase, query service, query service frontend, Elasticsearch, and QuickStatements images.

## Query service

The query service is the SPARQL service for a Wikibase instance. In the Docker Compose service names, image names, and environment variables, it is often referred to as WDQS, short for Wikidata Query Service.

## QuickStatements

QuickStatements is a web-based tool for importing and editing Wikibase data in batches.
