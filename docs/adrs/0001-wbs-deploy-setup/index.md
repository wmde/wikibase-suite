# 1) Wikibase Suite Deploy Setup Tool {#adr_0001}

Date: 2025-07-22

## Status

proposed

## Context

Wikibase Suite Deploy setup has inherent baseline complexity, and the current process includes known foot-guns that can fail late and unclearly, especially non-compliant passwords and domain names that are not correctly mapped to the target server. This ADR treats the current setup tool implementation as a reference for some ways we could reduce those failures and provide more clear user feedback throughout setup, including failure states. It is not intended to lock or pre-determine architectural or UI/UX efforts in ideating possible solution to setup friction.

This ADR is intentionally kept slim. Ongoing UX feedback, copy questions, and enhancement candidates that refine this baseline live in [`open-items.md`](open-items.md). Implementation detail and runtime notes live in [`technical-addendum.md`](technical-addendum.md).

The objective of this reference implementation is to reduce setup failure risk while focusing and simplifying the process of first-time setup for self-hosting users of Wikibase.

The current implementation includes these key characteristics:

- Shell-driven bootstrap that installs/verifies Git and Docker and downloads repository content
- A command-line setup wizard for gathering from the user all the required configuration for instantiating a WBS instance
- An optional secure web service for the same setup flow when a browser-based UI is preferred
- Configuration is gathered through a guided flow which highlights the most critical configurables, while making more granular or optional configuration available for those who need or want that
- Hostname validation against target server IP before save/launch
- Password entry validation including randomly generated secure passwords by default
- Friendly startup progress plus optional access to full logging
- Completion view with service links and generated/final `.env` content
- Post-completion teardown/sanitization behavior to reduce risk of passwords exposure in transient log files

The current implementation defaults to a CLI setup wizard and includes an optional web setup path (`--web`). Both paths use the same launch/deploy behavior and share setup-value validation logic where practical.

In both the Web and CLI version the user is prompted for the following values:

- Highlighted and required:
  - Admin email
  - Wikibase host
  - Query Service
  - Metadata callback visibility choice
- Advanced and by default auto populated:
  - Admin password (default: random secure password)
  - Database name (defaults to `my_wiki`)
  - Database username (defaults to `sqluser`)
  - DB password (default: random secure password)

## Decision

Adopt the existing setup tool implementation as the v1 reference baseline, with both install paths explicitly in scope:

1. CLI setup path (default): terminal prompts for required and optional values, direct `.env` generation, and shared launch behavior.
2. Web setup path (`--web`): guided HTTPS UI for configuration, validation, launch status, and completion handoff.

The reference baseline behavior is:

1. Prepare host prerequisites (install/verify Git and Docker, clone required repository content, verify runtime readiness).
2. Collect required deploy `.env` values in the selected setup surface, with advanced options kept out of the default path.
3. Use the web setup service over HTTPS when the optional browser-based flow is selected so sensitive values (passwords) are entered in a protected session.
4. Enforce validation before save, including domain-to-server-IP checks.
5. Launch deploy and provide user-facing status during startup, with optional full-log view.
6. Present completion view with service URLs and resulting config; prompt user to store credentials securely.
7. Self-stop setup utility only after services are confirmed healthy, with cleanup/sanitization.

## Consequences

- Positive:
  - lowers first-run setup friction
  - catches DNS/domain mapping issues earlier
  - improves confidence via progress and log visibility
  - reduces password-entry errors via generated secure defaults

- Current known implementation gaps:
  - CLI and web validation now share a common TypeScript validation layer, but full parity with MediaWiki server-side password policy is still incomplete.
  - Password checks cover setup-facing length/common-value validation but do not fully mirror MediaWiki server-side password policy, so late setup failure is still possible.
  - Auto-finalize is implemented as a fixed timer plus boot-state check; a user-visible countdown synchronized to actual teardown behavior is not yet implemented.
  - Release target selection remains pinned by default (`REPO_BRANCH=deploy@6.0.0`) and needs explicit product/engineering decision on long-term default behavior.

- Process consequence:
  - UX refinement work for this baseline continues inside the ADR 0001 sidecar files instead of creating a new ADR for every iteration.

## Related Files

- [`open-items.md`](open-items.md) - current UX review queue, copy gaps, bugs, and enhancement candidates tied to this ADR.
- [`technical-addendum.md`](technical-addendum.md) - implementation details, runtime flow, logging behavior, and verification notes supporting this ADR.
