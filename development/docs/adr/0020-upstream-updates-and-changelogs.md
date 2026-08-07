# 20) Generate upstream updates and image changelogs {#adr_0020}

Date: 2026-08-03

## Status

accepted

## Context

Image updates currently require release operators to identify appropriate upstream versions, update source pins, inspect compatibility, and manually assemble useful release notes. The generic versioning tool can infer a semantic version from repository commits, but it does not understand upstream release lines or describe the software changes contained in a refreshed image.

This is especially visible when updating:

- Wikibase to a newer compatible MediaWiki release and matching extension commits.
- Query Service to a newer compatible WDQS release.
- Images whose useful changelog should link to upstream release notes and commit or tag comparisons.

## Decision

Use one `wbs-dev update` workflow backed by image-specific source providers and shared version planning. Each provider selects or proposes compatible upstream versions, plans related pins atomically, and produces structured metadata describing the old and new sources.

Use that metadata in the same interview to generate image-specific changelog drafts and confirm the proposed version. For example, a Wikibase Docker Image entry identifies the MediaWiki update, links to its release notes, and links to comparison ranges for bundled extension updates. A WDQS entry identifies and links to the selected Query Service release and comparison.

Reruns reconstruct changes from the latest published tag and replace only the generated `Changes` and `Dependency updates` sections. Operator-maintained prose outside those sections is preserved. Commits containing only generated release files are excluded so a committed draft cannot feed back into its own changelog or version.

Generated output remains a proposal: operators review compatibility, semantic-version impact, links, and wording before committing it. Automatic updates must respect the compatibility policy in each image's `UPDATING.md`; they must not silently cross an incompatible release boundary.

## Consequences

Update logic and changelog provenance are image-specific while orchestration, atomic file updates, and review remain shared. Structured source-change metadata supports both human-readable previews and changelog generation.

Each managed source must be declared in the current image's `build.env`, which keeps the build definition authoritative and makes misspelled or incomplete provider entries fail clearly. A newly introduced declaration may have an empty value for `wbs-dev update` to populate. When that source did not exist in the previous release, the generated changelog records it as added and links to the selected commit instead of constructing a comparison from a nonexistent prior revision.

The initial providers cover Wikibase, Query Service, Query Service frontend, and QuickStatements. OpenSearch remains manual until its compatibility policy can support reliable recommendations; images without upstream source pins still participate in shared version and changelog preparation.
