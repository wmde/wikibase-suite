# 1) Wikibase Suite Deploy Setup Tool {#adr_0001}

Date: 2025-07-22

## Status

proposed

## Context

Wikibase Suite Deploy setup has inherent baseline complexity, and the current process includes known foot-guns that can fail late and unclearly, especially non-compliant passwords and domain names that are not correctly mapped to the target server. This ADR treats the current setup tool implementation as a reference for some ways we could reduce those failures and provide more clear user feedback throughout setup, including failure states. It is not intended to lock or pre-determine architectural or UI/UX efforts in ideating possible solution to setup friction.

The objective of this reference implementation is to reduce setup failure risk while focusing and simplifying the process of first-time setup for self-hosting users of Wikibase.

The current implementation includes these key characteristics:

- Shell-driven bootstrap that installs/verifies Git and Docker and downloads repository content
- A secure web service for gathering from the user all the required configuration for instantiating a WBS instance
- Configuration is gathered through a guided UI which highlights the most critical configurables, while making more granular or optional configuration available for those who need or want that
- Hostname validation against target server IP before save/launch
- Password entry validation including randomly generated secure passwords by default
- Friendly startup progress plus optional access to full logging
- Completion view with service links and generated/final `.env` content
- Post-completion teardown/sanitization behavior to reduce risk of passwords exposure in transient log files

The current implementation also includes a CLI mode (`--cli`) that is functional end-to-end for core setup values and uses the same launch/deploy path as the web flow. It has been less tested or in focus to date. 

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

1. Web setup path (default): guided HTTPS UI for configuration, validation, launch status, and completion handoff.
2. CLI setup path (`--cli`): terminal prompts for core required values, direct `.env` generation, and shared launch behavior.

The reference baseline behavior is:

1. Prepare host prerequisites (install/verify Git and Docker, clone required repository content, verify runtime readiness).
2. Start setup web service over HTTPS so sensitive values (passwords) are entered in a protected session.
3. Collect required deploy `.env` values, with advanced options kept out of the default path.
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

- Current known gaps in the reference implementation:
  - CLI parity is partial: advanced values (`MW_ADMIN_NAME`, `DB_NAME`, `DB_USER`) are not interactively prompted in CLI and remain template-defaulted.
  - Password checks enforce minimum length but do not pre-check against MediaWiki common-password rejection rules, so late setup failure is still possible.
  - Auto-finalize is implemented as a fixed timer plus boot-state check; a user-visible countdown synchronized to actual teardown behavior is not yet implemented.
  - Release target selection remains pinned by default (`REPO_BRANCH=deploy@6.0.0`) and needs explicit product/engineering decision on long-term default behavior.

## Related Files

- [`technical-addendum.md`](technical-addendum.md) - implementation details, runtime flow, logging behavior, and verification notes supporting this ADR.
- [`open-items.md`](open-items.md) - current open bugs and enhancement candidates tied to this ADR effort.
