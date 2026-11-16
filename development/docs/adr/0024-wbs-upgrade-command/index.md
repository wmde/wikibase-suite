# 24) WBS upgrade workflow {#adr_0024}

Date: 2026-08-09

## Status

Proposed; scope and preparation work are being refined.

## Context

The goal is a “one-click upgrade” experience for WBS: users choose an available update, understand its implications, and let the tooling carry out the steps. The existing `wbs` command, provided by WBS Tools, is the foundation for this CLI workflow.

Introducing `wbs` as a supported user-facing interface would give users stable commands while we evolve the operations behind them. Users could continue to start, stop, and inspect their stack through familiar commands as configuration and deployment options change. Those operations would also provide the foundation for the upgrader and a future admin UI.

Today, users pull compatible image updates, check out WBS release tags, and follow migration instructions. Automating this work means handling both the routine path and the cases that need a choice or intervention: choosing what to upgrade to including staying within a major series for a patch or minor update, migrating to a new major release, preserving local changes, or recovering from a failed upgrade.

## Proposed direction

Provide a guided workflow that explains the available choices and their effects before applying an update, completes supported steps automatically, and gives clear next steps when it cannot continue. The preparation work establishes what we can reliably automate and what users need to know about downtime, compatibility, and recovery.

Develop and verify these operations through the CLI first. The `wbs` command's capabilities should form the model for a future admin UI, with both interfaces using the same underlying operations. This lets us establish reliable behavior and recovery before adding the browser interface, and keeps the CLI useful even if both interfaces are introduced together.

Begin by introducing the existing `wbs` commands to users, then settle the release-branch approach, backup and recovery behavior, and the upgrade interaction. A proposed `wbs backup` command would give users a recovery foundation; its method, contents, and relationship to operator-managed backups remain open.

The [preparation work plan](work-plan.md) develops those four areas. The upgrade command name (`update` or `upgrade`) and first supported operations remain open. Existing end-user upgrade and update instructions remain unchanged until WBS 9.

## Decision and consequences

Decision pending. Record the outcomes of the preparation work here as they are agreed.

A usable backup and recovery path would be valuable independently of the upgrade command. Database updates may require recovery from saved data; returning to older code alone cannot be assumed to restore the previous instance.
