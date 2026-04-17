# Architecture Decision Records (ADRs)

This folder stores decision records for significant product, UX, and technical choices.

## ADRs

- [`NNNN-adr-template.md`](NNNN-adr-template.md) - template for new ADRs.
- [`0001-wbs-deploy-setup/index.md`](0001-wbs-deploy-setup/index.md) - current setup-tool implementation framed as the active v1 baseline.
- [`0001-wbs-deploy-setup/technical-addendum.md`](0001-wbs-deploy-setup/technical-addendum.md) - implementation details and verification context supporting ADR 0001.
- [`0001-wbs-deploy-setup/open-items.md`](0001-wbs-deploy-setup/open-items.md) - living UX review queue and open follow-up work for ADR 0001.
- [`0002-wbs-deploy-setup-dokploy.md`](0002-wbs-deploy-setup-dokploy.md) - rejected Dokploy-based setup variant kept for reference.

## Working Pattern

- Keep the main ADR file focused on the durable baseline decision.
- Put active refinement work for that ADR into sidecar files such as `open-items.md`.
- Create a new ADR when we are making a separate decision, not when we are iterating on the same baseline.
