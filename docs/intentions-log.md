# Intentions Log

This is a living memory doc. Update it when project goals or constraints become clearer.

## Current understanding

- Primary goal:
  - make first-time Wikibase Suite Deploy setup easier and less error-prone
- Target users:
  - people provisioning a fresh VPS and launching WBS deploy
- Operating model:
  - guided setup UI by default
  - CLI fallback for terminal-only workflows

## Assumptions to confirm

- Should this project continue to prioritize a one-shot "bootstrap from curl" path?
- Should the setup web UI remain certificate-first (LetsEncrypt then self-signed), or should plain HTTP setup be an option?

## Decision log

Use this format for future decisions:

### 2026-02-16 - ARM64 support scope

- Decision: Keep ARM64 support out of scope for now.
- Why: ARM64 would require building images on the VPS instead of using existing pre-built Docker Hub images.
- Impact: Production server guidance remains AMD64-only for now.
- Follow-up work: Revisit when ARM build/publish strategy is ready.

### 2026-02-16 - Default deploy branch

- Decision: Update default `wikibase-release-pipeline` target branch to `deploy@5.0.1`.
- Why: `deploy@5.0.1` is now the intended baseline.
- Impact: Fresh setup runs clone `deploy@5.0.1` unless `REPO_BRANCH` is overridden.
- Follow-up work: Keep docs and scripts aligned when default branch changes.

### 2026-02-16 - Integration testing timing

- Decision: Defer adding a lightweight integration smoke test for now.
- Why: Current priority is catching docs/behavior up before adding new test harness work.
- Impact: Full setup-flow regression coverage remains a known gap in the short term.
- Follow-up work: Reconsider after current stabilization pass.

## Open questions for next sync

1. Which parts of setup are most fragile in real usage (DNS, certs, docker install, compose launch)?
2. Are there workflows that need to stay stable for external users even if internals change?
3. What should be considered "done" for getting this project reliable again?
