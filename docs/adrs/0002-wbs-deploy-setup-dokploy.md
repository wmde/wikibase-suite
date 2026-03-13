# 2) Wikibase Suite Deploy Setup Tool - Dokploy variant {#adr_0002}

Date: 2026-03-12

## Status

proposed

## Context

We want to evaluate a Dokploy-based onboarding/deployment path without breaking or replacing the current setup utility behavior by default. The existing setup tool already defines a stable configuration model and validated input flow; this should remain the compatibility baseline.

The Dokploy variant should focus on orchestration through Dokploy's Git-backed Compose model while reusing the same user-facing setup values and validation standards.

Key context constraints:

- Dokploy installation requires ports `80`, `443`, and `3000` to be available.
- Dokploy deployment is Git-backed for Docker Compose services.
- Existing setup-variable model must remain intact.
- Implementation should reuse as much of the existing setup collection logic as possible across both current flows (Web and CLI); in this path, all currently collected setup env vars are expected to remain relevant.
- Two additional advanced overrides are needed for this path:
  - `source_repository_url`
  - `source_git_ref`

## Decision

Propose an additive second workflow that:

1. installs/verifies Dokploy
2. launches setup UI for config capture and validation
3. configures a Dokploy Compose service via API
4. deploys Wikibase Suite from Git source
5. hands user off to Dokploy project/service status for monitoring

This remains an additional path while product/UX/engineering decide default mode behavior.

For this path:

- default source repository URL: https://github.com/wmde/wikibase-release-pipeline.git
- default source git ref: `deploy@6.0.0`
- both values are Advanced overrides in setup UI

Configuration parity requirement with current setup tool remains mandatory (`MW_ADMIN_EMAIL`, hostnames, admin/db credentials, metadata callback, and existing advanced/default-backed values).
Where practical, reuse existing Web and CLI prompt/validation behavior as the implementation baseline for this variable collection.

## Consequences

- Positive:
  - uses Dokploy as deployment control plane
  - preserves current setup variable semantics and validation intent
  - adds flexibility for repository/ref overrides without changing default path immediately

- Tradeoffs:
  - introduces additional orchestration/API integration complexity
  - requires explicit UX/product decision on mode selection and default behavior
  - requires careful handling of failure/resume behavior across bootstrap and API phases
