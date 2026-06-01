# Documentation Overview

This is the front door for evaluating the Wikibase Suite Installer.

## Start Here

- [`adrs/0001-setup-tool-eval1.md`](adrs/0001-setup-tool-eval1.md)
  - Eval 1 review and response record for the installer UI.
- [`adrs/0002-wbs-deploy-setup-dokploy.md`](adrs/0002-wbs-deploy-setup-dokploy.md)
  - Rejected Dokploy-based variant kept as reference.
- [`adrs/0003-research-deploy-product-repository-proposal.md`](adrs/0003-research-deploy-product-repository-proposal.md)
  - Decision to research a dedicated Deploy product repository.
- [`adrs/0004-expand-installer-into-operations-tool.md`](adrs/0004-expand-installer-into-operations-tool.md)
  - Future direction for expanding the installer into a Wikibase Suite operations tool.

## ADR Structure Rules

- The ADR format is used because it is familiar in the WMDE technical ecosystem.
- In this repository, ADRs are also used as an active-development pattern.
- If an ADR needs only one file, keep it as a single file in `docs/adrs/`.
- If an ADR needs multiple files, create a directory for it and add `index.md` as the main ADR file.
  - Additional files inside an ADR directory can be named freely, but names should describe their purpose.
  - Every file in an ADR directory should be linked and briefly explained inside that ADR directory's `index.md` (typically in a short related-files section near the end).
- For active work on an existing ADR, prefer a sidecar file such as `open-items.md` instead of creating a new ADR for each refinement.
