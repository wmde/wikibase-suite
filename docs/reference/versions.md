# Wikibase Suite (WBS) Versions

Wikibase Suite (WBS) and each WBS Docker Image have independent version numbers. Each WBS release identifies the compatible image versions it uses, while images can be released independently.

They all use [semantic versioning](https://semver.org/spec/v2.0.0.html). Stable releases use `MAJOR.MINOR.PATCH`; prereleases add a suffix such as `-rc.1`. Major releases may require upgrade work, while minor and patch stable releases remain compatible.

This page explains how to read these versions. For update instructions, see [Upgrading](../operate/upgrade.md).

## WBS versions

A WBS version identifies a published WBS configuration in this repository, including the Docker Compose file and its image selections. WBS 8 and later releases use Git tags such as `wbs@8.0.1`.

Compare the current and target versions from left to right. The first number that changes determines the version level:

| Version level | Example | What it means |
| --- | --- | --- |
| Major | `8.1.0` → `9.0.0` | May contain breaking changes and require version-specific upgrade steps. |
| Minor | `8.0.1` → `8.1.0` | Adds compatible functionality. |
| Patch | `8.0.0` → `8.0.1` | Provides a compatible fix. |

WBS 7 and earlier releases use `deploy@MAJOR.MINOR.PATCH` tags. WBS 8 and later releases use `wbs@MAJOR.MINOR.PATCH` tags.

## Docker Image versions

The WBS Docker Images—Wikibase, Query Service, Query Service frontend, OpenSearch, and QuickStatements—are released and versioned separately from WBS. WBS releases normally use compatible major-version tags. For example, `wikibase/wikibase:7` tracks the latest `7.x.x` Wikibase image without pulling breaking changes from a later major version.

WBS Docker Images are published to [Docker Hub](https://hub.docker.com/u/wikibase) with tags at the following version levels:

| Version level | Example | What it means |
| --- | --- | --- |
| Major | `7` | Moves to the latest minor or patch release within that major version. WBS uses these tags so compatible image updates can be pulled without changing the WBS version. |
| Minor | `7.1` | Moves to the latest patch release within that minor version. |
| Patch | `7.1.0` | Identifies a specific image release. |

Some images also publish tags for the version of the software they contain, such as the bundled MediaWiki or Query Service version. See [Wikibase Suite (WBS) Docker Images](./docker-images.md) for details.

## Prereleases

A prerelease has the form `MAJOR.MINOR.PATCH-CHANNEL.NUMBER`, such as `wbs@8.1.0-rc.1` or `wikibase/wikibase:8.3.0-rc.1`. It is a Semantic Versioning prerelease and sorts below the matching stable version. WBS and each image have independent version numbers and prerelease counters.

An image prerelease always publishes its full version tag. It does not move stable major, minor, or bundled-software tags. An image may additionally declare a moving prerelease channel tag, such as `8-rc`, for compatible updates within that channel. Review the image's release tags before publication.

The public installer shortcut continues to select stable WBS releases. To install a prerelease, check out its full `wbs@…` Git tag and run `./install` from that checkout. WBS prerelease tags are fixed; select a newer full tag when the configuration or documentation changes.
