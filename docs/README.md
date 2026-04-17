# Documentation Overview

This is the front door for evaluating WBS Deploy Setup.

## Start Here

- [`adrs/0001-wbs-deploy-setup/index.md`](adrs/0001-wbs-deploy-setup/index.md)
  - Primary context for the current setup-tool baseline and active product direction.
- [`adrs/0001-wbs-deploy-setup/open-items.md`](adrs/0001-wbs-deploy-setup/open-items.md)
  - Living queue for UX notes, bugs, copy questions, and follow-up decisions within ADR 0001.
- [`adrs/0001-wbs-deploy-setup/technical-addendum.md`](adrs/0001-wbs-deploy-setup/technical-addendum.md) (optional deep detail)
  - Use this for engineering and architecture evaluation of implementation specifics.
- [`adrs/0002-wbs-deploy-setup-dokploy.md`](adrs/0002-wbs-deploy-setup-dokploy.md)
  - Rejected Dokploy-based variant kept as reference.

## ADR Structure Rules

- The ADR format is used because it is familiar in the WMDE technical ecosystem.
- In this repository, ADRs are also used as an active-development pattern.
- If an ADR needs only one file, keep it as a single file in `docs/adrs/`.
- If an ADR needs multiple files, create a directory for it and add `index.md` as the main ADR file.
  - Additional files inside an ADR directory can be named freely, but names should describe their purpose.
  - Every file in an ADR directory should be linked and briefly explained inside that ADR directory's `index.md` (typically in a short related-files section near the end).
- For active work on an existing ADR, prefer a sidecar file such as `open-items.md` instead of creating a new ADR for each refinement.
