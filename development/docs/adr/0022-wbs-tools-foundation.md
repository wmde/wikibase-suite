# 22) WBS Tools foundation {#adr_0022}

Date: 2026-08-08

## Status

accepted

## Context

The Wikibase Suite Installer provides the configuration, validation, progress reporting, and lifecycle integration needed for first-time installation. The same capabilities are useful for operating an existing installation.

## Decision

The Installer is the first workflow built on the broader WBS Tools application. WBS Tools is designed to be extended with focused workflows such as upgrades, migrations, backups, and recovery utilities.

The tools image owns these workflows and their CLI or web interfaces. Host scripts retain only the bootstrap and container-launch boundary. Browser-facing containers do not receive the Docker socket; socket-enabled work runs in separate, short-lived containers.

## Consequences

- First-time installation remains the current product workflow.
- New operational workflows can reuse configuration, validation, lifecycle, and progress infrastructure.
- Each workflow must define its safety, recovery, and user-experience requirements before it is published.
