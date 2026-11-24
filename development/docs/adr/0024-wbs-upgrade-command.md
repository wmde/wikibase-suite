# 24) WBS upgrade command {#adr_0024}

Date: 2026-08-09

## Status

Proposed.

## Context

Administrators update WBS by pulling compatible images, checking out release tags, and following migration instructions. Routine updates and major upgrades need a supported entry point that carries out the upgrade and shows when the administrator needs to make a choice or take action.

## Decision

Introduce `wbs` as a supported command for Wikibase Suite administrators with a new `wbs upgrade` subcommand. The command presents supported upgrade options, explains what will change, and carries out and verifies the selected upgrade. It asks for administrator input where needed and shows how to proceed when an upgrade is blocked or fails.

## Current work

Prototype the interaction, review the walkthrough, and agree on the upgrade requirements.

### Prototype the interaction

Walk through a routine update, a major upgrade, and a case where the administrator has to intervene. Use the paper prototype to explore what the command can do automatically, what changes require a recovery point, and when the administrator can use an existing backup. [T442153](https://phabricator.wikimedia.org/T442153)

### Define the upgrade requirements

Use the review to agree on the first supported upgrade path. Record the agreed requirements here, including where the administrator needs to act, how the command handles local configuration, when it requires a backup, and how it verifies success or guides recovery after a failure.
