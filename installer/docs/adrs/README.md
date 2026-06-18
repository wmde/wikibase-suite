# Architecture Decision Records (ADRs)

This folder stores decision records for significant product, UX, and technical choices.

## ADRs

- [`NNNN-adr-template.md`](NNNN-adr-template.md) - template for new ADRs.
- [`0001-expand-installer-into-operations-tool.md`](0001-expand-installer-into-operations-tool.md) - expanding the installer into a Wikibase Suite operations tool.
- [`0002-merge-repos.md`](0002-merge-repos.md) - moving Wikibase Suite Deploy and the installer into the Wikibase Suite repository.

## Working Pattern

- Keep the main ADR file focused on the durable baseline decision.
- Put active refinement work for that ADR into sidecar files such as `open-items.md`.
- Create a new ADR when we are making a separate decision, not when we are iterating on the same baseline.
