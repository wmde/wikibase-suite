# 21) Product-first monorepo {#adr_0021}

Date: 2026-08-08

## Status

accepted

## Context

Wikibase Suite consists of the supported Docker Compose configuration, installer, operational documentation, and the container images used by that configuration. The repository was historically structured as a release pipeline, leaving the product alongside its image definitions, integration tests, and release tooling.

WBS 8 makes the repository itself a user-facing product checkout. Its layout should make the installable product and its documentation easy to find while preserving the development pipeline that builds and tests it.

## Options Considered

- **Split the product into a separate repository:** rejected because coordinated product and image changes would require matching work across repositories.
- **Pivot the existing repository to a product-first monorepo:** accepted.

## Decision

Pivot the existing repository to a product-first monorepo:

- The repository root contains the installable Compose product, installer, configuration, changelog, and user documentation.
- `docs/` contains the user-facing WBS documentation.
- `development/` contains image definitions, integration tests, and shared build and release tooling.

GitHub workflow definitions remain under the required root `.github/` location but invoke the tooling in `development/`.

Whether image definitions should move from `development/images/` to a root `docker-images/` directory is deferred pending team review of the trade-off for end users and contributors. A future ADR may supersede this placement decision.

## Consequences

- Users cloning the repository also receive development files, but do not need to enter or use `development/` for normal installation and operation.
- Existing installations must move ignored `.env` and `config/` contents from `deploy/` to the repository root when upgrading to the flattened layout.
- Renaming the remote repository can happen separately from this filesystem reorganization.
