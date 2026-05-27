# 2) Wikibase Suite Deploy Setup Tool - Dokploy variant {#adr_0002}

Date: 2026-03-12

## Status

rejected

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

Do not adopt a Dokploy-based setup workflow at this time.

Keep the current setup tool baseline from ADR 0001 as the active product direction for ongoing UX and implementation work.

This Dokploy variant is retained only as a rejected exploration reference in case it needs to be revisited later.

## Consequences

- Positive:
  - keeps the current product and UX effort focused on one setup path
  - avoids introducing additional orchestration and support complexity during active baseline refinement

- Tradeoffs:
  - no Dokploy-based install path is planned in the current direction
  - if this idea is revisited later, a fresh ADR update or successor ADR should confirm whether the assumptions in this document still hold
