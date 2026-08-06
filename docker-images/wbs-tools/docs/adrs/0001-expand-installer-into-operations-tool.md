# 1) Expand the Installer into an Operations Tool {#adr_0001}

Date: 2026-08-04

## Status

accepted

## Context

The Wikibase Suite Installer currently focuses on first-time installation. It provides CLI and web flows for collecting and validating configuration, writing a Wikibase Suite `.env` file, and starting services.

The same framework could support an existing Wikibase Suite installation. Operational tasks such as backup, repair, reset, reconfiguration, and major upgrades can require guided procedures and clear warnings. Some of these tasks are destructive or difficult to perform safely by hand.

The current tool already provides a useful foundation for these workflows: shared CLI and web entry points, configuration handling, validation, progress reporting, and awareness of existing installations.

## Decision

The installer is one workflow of the broader `wbs` tools application.

The tools command layer owns configuration and core lifecycle commands: `wbs configure`, `wbs install`, `wbs up`, `wbs down`, `wbs status`, and `wbs reset`. The lifecycle commands remain an internal, experimental interface until their end-user behavior is ready to publish. Development behavior is selected with explicit lifecycle options such as `wbs up --build`; it is not a separate Suite lifecycle implementation under `wbs-dev`.

The published tools image contains the command implementation, terminal configurator, and browser configurator. Host scripts retain the minimum boundary needed to install Docker, pull or build that image, mount the checkout, and launch its roles.

The temporary browser server does not receive the Docker socket. For web installation, a separate non-networked worker from the same image receives the socket, waits for one narrowly scoped installation request, starts the services, writes progress, and exits. CLI lifecycle invocations run directly in a short-lived socket-enabled tools container.

Possible workflows include backup, repair, reset and reinstall, reconfiguration, and major upgrades. Each workflow should make its impact clear before changing an existing installation.

The detailed design and prioritization of these workflows are outside the current installer scope.

## Consequences

- The first-time browser experience remains the active web scope.
- Configuration is a distinct stage shared by CLI and web entry points.
- Docker lifecycle behavior has one implementation behind the internal host launcher and experimental `development/wbs` entry point.
- The Docker socket is confined to short-lived CLI or worker roles that expose no network service.
- Existing installations should not be modified accidentally.

## Questions for follow-up

- What experience should the web UI provide when it detects an existing installation or running instance?
- Which additional operational workflows should be exposed after backup and recovery policies are defined?
