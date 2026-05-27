# Architecture Decision Records (ADRs)

This folder stores decision records for significant product, UX, and technical choices.

## ADRs

- [`NNNN-adr-template.md`](NNNN-adr-template.md) - template for new ADRs.
- [`0001-setup-tool-eval1.md`](0001-setup-tool-eval1.md) - Eval 1 review and response record for the installer UI.
- [`0002-wbs-deploy-setup-dokploy.md`](0002-wbs-deploy-setup-dokploy.md) - rejected Dokploy-based installation variant kept for reference.
- [`0003-research-deploy-product-repository-proposal.md`](0003-research-deploy-product-repository-proposal.md) - decided proposal-writing work for evaluating a dedicated Deploy product repository.
- [`0004-proposal-deploy-product-repository.md`](0004-proposal-deploy-product-repository.md) - draft proposal for moving Deploy and the installer into a dedicated product repository.
- [`0005-existing-config-reset-and-upgrade-workflow.md`](0005-existing-config-reset-and-upgrade-workflow.md) - proposed future workflow for validating existing configuration, reset, backup, and major upgrades.

## Working Pattern

- Keep the main ADR file focused on the durable baseline decision.
- Put active refinement work for that ADR into sidecar files such as `open-items.md`.
- Create a new ADR when we are making a separate decision, not when we are iterating on the same baseline.
