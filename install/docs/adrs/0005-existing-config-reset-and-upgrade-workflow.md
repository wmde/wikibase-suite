# 5) Existing Config Reset and Upgrade Workflow {#adr_0005}

Date: 2026-05-05

## Status

proposed

## Context

The Wikibase Suite Installer currently focuses on first-time installation: collect values, write the Deploy `.env` file, start services, and then hide passwords from the server-side configuration file after completion.

The same installer could solve a larger operational problem if it understood an existing `.env` file as a reusable server configuration. That file is not only a record of the user's choices; it is the configuration needed to recreate the same server shape for a major upgrade, replacement server, or reset.

There are two related product problems:

1. A user may need to fully reset an installation to the settings already stored in `.env`.

2. A user may need an orchestrated major-upgrade path where the tool can back up existing data, reset the running installation, recreate the configured service layout, and potentially restore data afterward.

Today, the destructive reset steps are operationally real but not yet represented as a guided product workflow. A full reset means stopping services with Docker Compose, removing volumes, and removing `config/LocalSettings.php` from the Deploy directory. This removes the existing database data and also removes any local configuration that was added to `LocalSettings.php` outside the first-start values.

Changing values in `.env` also has a significant implication: some changes cannot safely apply to an already-running install without fully resetting the installation. Users need a clearer path that explains when existing data and local configuration will be removed, and what backup or restore steps are available.

## Decision

Treat existing configuration detection, validation, reset, and upgrade orchestration as a future installer workflow.

The installer should eventually detect whether a `.env` file already exists in the expected location. After the welcome screen, or as part of the welcome screen, it should validate that file and make the user's situation explicit.

If no `.env` file exists, the installer should continue through the current first-time installation flow.

If a valid `.env` file exists, the installer should be able to offer a controlled path for using that configuration again. A minimal first version may only validate and display that an existing configuration was found, then ask whether the user wants to continue using it.

A later version should support a deliberate reset path. Before any destructive action, the UI must present a loud confirmation step explaining that the reset will stop services, remove Docker volumes, remove `config/LocalSettings.php`, remove existing data, and recreate the instance from the `.env` configuration.

The reset path should not be treated as only an installation convenience. It is also the basis for a major-upgrade workflow:

- identify the existing configuration
- validate it
- detect whether related Docker Compose services are running
- detect whether containers or services already exist that would conflict with installation
- back up databases before destructive reset
- clearly tell the user where backups are stored
- reset the installation
- recreate the configured services
- potentially restore data after the new install is running

This workflow is out of scope for the current review round, but the shared configuration validation work should be shaped so it can support this future behavior from both the web UI and CLI.

## Open Questions

- What is the safest first version of existing `.env` detection: informational only, reuse existing configuration, or guided reset?
- How should the tool determine whether the existing installation is already booted and healthy?
- How should the tool detect service/container conflicts from the Docker Compose configuration?
- What backup format and storage location should be used before a destructive reset?
- Should restore be automatic, offered as a separate step, or documented as a manual follow-up?
- Which `.env` changes require a full reset, and how should the tool explain that to users?
