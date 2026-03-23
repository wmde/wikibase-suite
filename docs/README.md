# Documentation Overview

This is the front door for evaluating WBS Deploy Setup.

## Start Here

- [`adrs/0001-wbs-deploy-setup/index.md`](adrs/0001-wbs-deploy-setup/index.md)
  - Primary context for UX/Product review of the current reference implementation.
- [`adrs/0001-wbs-deploy-setup/technical-addendum.md`](adrs/0001-wbs-deploy-setup/technical-addendum.md) (optional deep detail)
  - Use this for engineering and architecture evaluation of implementation specifics.
- [`adrs/0002-wbs-deploy-setup-dokploy.md`](adrs/0002-wbs-deploy-setup-dokploy.md)
  - Use this for discussion of the proposed Dokploy-based variant.

## ADR Structure Rules

- The ADR format is used because it is familiar in the WMDE technical ecosystem.
- In this repository, ADRs are also used as an active-development pattern.
- If an ADR needs only one file, keep it as a single file in `docs/adrs/`.
- If an ADR needs multiple files, create a directory for it and add `index.md` as the main ADR file.
  - Additional files inside an ADR directory can be named freely, but names should describe their purpose.
  - Every file in an ADR directory should be linked and briefly explained inside that ADR directory's `index.md` (typically in a short related-files section near the end).
