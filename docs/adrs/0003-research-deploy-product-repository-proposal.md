# 3) Research Deploy Product Repository Proposal {#adr_0003}

Date: 2026-05-04

## Status

decided

## Context

Wikibase Suite Deploy currently lives under `wikibase-release-pipeline/deploy`, while the Deploy Setup Tool lives in a separate setup-oriented repository. This makes the current implementation workable, but it also keeps the user-facing Deploy product inside a repository whose broader purpose is mostly building, testing, and releasing Wikibase Suite Docker images.

Deploy is already mostly decoupled from the rest of `wikibase-release-pipeline`. Its main ongoing relationship to the image pipeline is that Deploy consumes image versions produced by that pipeline, and occasionally needs updates to use a newer image version or product variant.

The Deploy Setup Tool work makes this product boundary more visible because setup is part of the Deploy product experience. It is a guided way to configure and launch Deploy, not a replacement for Deploy.

Initial product-management feedback was positive but explicitly raised the need to understand the consequences and dependencies of moving the repository. That concern should be treated as central to the research and proposal work.

## Decision

Create a short proposal evaluating whether Wikibase Suite Deploy should move into its own product repository, with `deploy/` and `setup-tool/` as separate projects in that repository.

The proposal should cover:

- why Deploy is already conceptually and technically a separate product area
- why the setup tool belongs beside Deploy as part of the product experience
- possible repository names and structure
- implementation steps
- consequences, dependencies, and migration risks
- how to keep the current `wikibase-release-pipeline/deploy` location available until the team is ready to switch public communication

This ADR records the decision to research and formulate the proposal. It does not decide that the repository move itself will happen.

## Consequences

- The immediate work is limited to a proposal and dependency analysis.
- The proposal should make the migration path concrete enough for product, engineering, and communications review.
- The proposal should explicitly address existing links, release process expectations, CI/test dependencies, ownership, and the transition period where both old and new locations may need to stay in parity.
- No public repository-location change is implied by this ADR.
