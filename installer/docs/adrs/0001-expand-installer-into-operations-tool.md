# 1) Expand the Installer into an Operations Tool {#adr_0001}

Date: 2026-05-05

## Status

draft

## Context

The Wikibase Suite Installer currently focuses on first-time installation. It provides CLI and web flows for collecting and validating configuration, writing a Wikibase Suite `.env` file, and starting services.

The same framework could support an existing Wikibase Suite installation. Operational tasks such as backup, repair, reset, reconfiguration, and major upgrades can require guided procedures and clear warnings. Some of these tasks are destructive or difficult to perform safely by hand.

The current tool already provides a useful foundation for these workflows: shared CLI and web entry points, configuration handling, validation, progress reporting, and awareness of existing installations.

## Decision

Consider evolving the installer into a broader Wikibase Suite operations tool.

First-time installation should remain one mode of the tool. When an existing installation or running instance is detected, the tool could instead offer guided operational workflows.

Possible workflows include backup, repair, reset and reinstall, reconfiguration, and major upgrades. Each workflow should make its impact clear before changing an existing installation.

The detailed design and prioritization of these workflows are outside the current installer scope.

## Consequences

- The current first-time installation flow remains the active scope.
- The current implementation should be treated as a foundation for future operational workflows, not only as a one-time installer.
- Existing installations should not be modified accidentally.

## Questions for follow-up

- Should the product continue to be called the Wikibase Suite Installer, or become a broader Wikibase Suite tool with a command such as `wbs`?
- What experience should the web UI provide when it detects an existing installation or running instance?
