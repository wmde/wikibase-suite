# Wikibase Suite (WBS) Versions

Wikibase Suite (WBS) and each WBS Docker Image have independent version numbers. Each WBS release identifies the compatible major version of each Image, while compatible Image updates can be released independently.

They all use [semantic versioning](https://semver.org/spec/v2.0.0.html), written as `MAJOR.MINOR.PATCH`. Major releases may require upgrade work, while minor and patch releases remain compatible.

This page explains how to read these versions. For update instructions, see [Updating and Upgrading](./operate/updating.md).

## WBS versions

A WBS version identifies a published WBS configuration in this repository, including the Docker Compose file and the compatible major versions of its images. WBS 8 and later releases use Git tags such as `wbs@8.0.1`.

Compare the current and target versions from left to right. The first number that changes determines the version level:

| Version level | Example | What it means |
| --- | --- | --- |
| Major | `8.1.0` → `9.0.0` | May contain breaking changes and require version-specific upgrade steps. |
| Minor | `8.0.1` → `8.1.0` | Adds compatible functionality. |
| Patch | `8.0.0` → `8.0.1` | Provides a compatible fix. |

WBS 7 and earlier releases use `deploy@MAJOR.MINOR.PATCH` tags. WBS 8 and later releases use `wbs@MAJOR.MINOR.PATCH` tags.

## Docker Image versions

The WBS Docker Images—Wikibase, Query Service, Query Service frontend, OpenSearch, QuickStatements, and WBS Tools—are released and versioned separately from WBS. WBS releases normally reference compatible major-version tags. For example, `wikibase/wikibase:7` tracks the latest `7.x.x` release of the Wikibase Docker Image without pulling breaking changes from a later major version.

WBS Docker Images are published to [Docker Hub](https://hub.docker.com/u/wikibase) with tags at the following version levels:

| Version level | Example | What it means |
| --- | --- | --- |
| Major | `7` | Moves to the latest minor or patch release within that major version. WBS uses these tags so compatible image updates can be pulled without changing the WBS version. |
| Minor | `7.1` | Moves to the latest patch release within that minor version. |
| Patch | `7.1.0` | Identifies a specific image release. |

Some images also publish tags for the version of the software they contain, such as the bundled MediaWiki or Query Service version. See [Wikibase Suite (WBS) Docker Images](../docker-images/README.md) for details.
