# Introducing the WBS command

Date: 2026-11-16

## Status

draft/proposed

## Context

[ADR 22: WBS Tools foundation](../0022-wbs-tools-foundation.md) establishes WBS Tools as the application for installation and future operational workflows, with CLI and web interfaces. This proposal builds on that accepted foundation to decide how we introduce the existing `wbs` command to users and recommend it in operating instructions.

The `wbs` CLI already groups installation and lifecycle operations behind a single command, but is currently presented primarily as a development feature. Making it a supported user interface would let us evolve how WBS operates while keeping familiar commands such as `wbs up`, `wbs down`, and `wbs status` stable.

## Proposal

Introduce `wbs` as a supported user-facing command for installation and routine operations, with backup and guided upgrades added as they become ready. Users express the operation they want; WBS selects the underlying commands and options appropriate to their configuration.

For example, `wbs up` could select a combination of Compose files and services based on instance configuration. The user's command stays the same as supported deployment arrangements evolve, without requiring them to assemble a longer Docker Compose invocation.

Keep these operations close to Docker Compose, Docker, and the other tools they use. WBS should assemble their commands and coordinate the steps, with equivalent operations remaining understandable and usable directly. Add abstraction only where it makes a supported operation easier to use or more reliable.

The same operations should form the model for a future admin UI. Developing and verifying them through the CLI first establishes behavior, checks, and recovery that both interfaces can share. Browser controls add another way to invoke those operations; the CLI remains useful even if both interfaces reach users together. Keep the underlying operations independent of terminal prompts as they develop.

## Current capabilities

The [command implementation](../../../images/wbs-tools/wbs.ts) currently exposes:

| Command | Purpose |
| --- | --- |
| `wbs install` | Configure and install an instance through terminal or web configuration. |
| `wbs up` | Start the configured stack and wait for service readiness. |
| `wbs up --update` | Pull the selected images before starting services; this does not update the Git checkout. |
| `wbs down` | Stop and remove service containers while preserving their volumes. |
| `wbs status` | Show service status through Docker Compose. |
| `wbs reset` | Offer choices to stop the installer and remove instance data, generated configuration, or saved installer settings. |

Help and version reporting are available. Source-build options also exist for development. Backup and guided checkout upgrades remain proposed work.

## Considerations

Most of this work is deciding what we recommend and documenting it consistently across installation, operation, troubleshooting, and reset instructions.

The current [`development/wbs`](../../../wbs) launcher selects locally built development images. A user-facing entry point, potentially `./wbs` at the repository root, should use the checkout's selected published WBS Tools image through the existing [host launcher](../../../../scripts/run-wbs-tools.sh). Choose its location and defaults while retaining a clear development entry point.

Before recommending the commands, verify their user-facing behavior, including partially running stacks and Docker failures. The lifecycle fixes in [PR 1010](https://github.com/wmde/wikibase-suite/pull/1010) address these cases and should be included in the version introduced to users.

## Open questions

- Should we introduce the broader `wbs` command as proposed, or expose only the future upgrade command while retaining Docker Compose as the documented interface for routine operations?
- Should routine instructions use `wbs up`, `wbs down`, and `wbs status` in place of the corresponding Docker Compose commands, or introduce them alongside those commands?
- How should reset instructions use `wbs reset`? It can remove generated configuration and optionally `.env`, so it has a broader scope than `docker compose down --volumes`. The documented choices must make that scope clear.
- Where should users invoke `wbs`, and how do existing installations gain the supported entry point and Tools version?

## Decision and follow-up

Decision pending. If adopted, agree the documentation and rollout changes and provide the user-facing launcher with the appropriate defaults. The [preparation work plan](work-plan.md) covers the subsequent release, backup, and upgrade decisions.
