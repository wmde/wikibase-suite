# Upgrade preparation work

These four tasks develop the proposal in [ADR 24](index.md), beginning with the existing user interface and working toward a guided upgrade. Each should produce a concise decision or proposal that can be reviewed independently.

## 1. Introduce `wbs` as a user-facing command

**Question:** How should we introduce `wbs` as a stable user interface while allowing the underlying operations to evolve?

Develop the [WBS command introduction](wbs-command.md): review `wbs up`, `wbs down`, `wbs status`, and reset behavior against the current Docker Compose instructions. Decide how users discover and invoke the command and which instructions should recommend it. Establish these operations as the shared foundation for the CLI upgrader and future admin UI.

**Outcome:** An agreed introduction plan and concise operating instructions, with any required command fixes identified. Clarify how the recommended commands relate to direct Docker Compose use.

## 2. Decide how installations follow published releases

**Question:** Should future installations and upgrade tooling follow major-series release branches, and how would existing installations adopt them?

Develop the [release-branch proposal](release-branches.md), including the relationship between `main` and published branches and the proposed `wbs@8` naming. Examine the transition from exact tags, including shallow clones and local configuration changes.

**Outcome:** A recorded decision and, if adopted, the necessary branch naming and release-tooling changes. Continue publishing exact tags and preserve existing end-user update instructions until WBS 9. Installer adoption follows the agreed transition plan.

## 3. Define installation layout, backups, and recovery

**Question:** What must a WBS backup preserve, how can users recover from it, and when should an upgrade require or offer one?

First decide whether the installer continues creating a repository checkout directly or creates a WBS-owned directory containing the checkout, backups, and recovery files. Establish where backups survive checkout changes, directory ownership, and how existing installations adopt the layout. This decision guides installer behavior and backup defaults.

Evaluate a `wbs backup` command alongside operator-managed backups. Identify what must be saved and what can be rebuilt, with the downtime and storage implications of each approach. Examine representative update failures to establish when retrying is safe and when restoration is needed; changing the checkout back does not necessarily reverse database changes.

**Outcome:** An agreed installation layout and transition path, plus a proposed backup scope and command behavior supported by a restore rehearsal that checks instance data and application behavior. Record how incomplete backups and failed updates are handled, and which recovery choices the upgrade workflow can safely offer.

## 4. Design the upgrade interaction

**Question:** What choices and interventions remain around the routine “one-click” path, and how do we make their implications clear?

Describe choosing a patch or minor update within the current series versus migrating to a new major release, including installations one or more major versions behind. Where needed, explain supported targets, compatibility, downtime, and any required migration steps before asking the user to proceed.

Work through backup choices: creating a backup, using an existing recovery point, or proceeding without one where the agreed policy allows it. Include local configuration conflicts, missing prerequisites, interrupted updates, and failures requiring recovery. Establish what confirms that the instance works after the update.

**Outcome:** Short example interactions covering the routine path, meaningful choices, and recovery. Use these to choose the command name and bound the first implementation, with supported migration paths backed by testing.

## Earlier exploration

The local `feature/upgrade` branch preserves the prototype and the earlier detailed plan. Its implementation choices remain available to revisit as these tasks establish what is needed.
