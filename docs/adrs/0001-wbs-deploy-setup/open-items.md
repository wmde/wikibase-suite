# Open Items

Deliverable spreadsheet: [WBS Deploy Setup Tool UI Notes](https://docs.google.com/spreadsheets/d/1WhroI0WnuB2AHr848sezBzHQNckSHlVH_VYZlwHv11w/edit?usp=sharing)

This file tracks the live work queue for ADR 0001.

Use this file for:

- UX review notes and enhancement candidates
- copy questions and content gaps
- bugs discovered while evaluating the reference implementation
- product decisions that are still open but remain inside the ADR 0001 scope

Create a new ADR only when we need a separate durable decision, not when we are refining this same baseline.

## Reference Links

- Figma: [WBS Installation Wizard v1 evaluation notes](https://www.figma.com/design/GUWSDKbomRnGZiI5ZIusMl/-WBS--Installation-Wizard-v1-evaluation?node-id=0-1&t=Y8eH9VPeSd34IVSm-1) (requires access)
- Google Sheets: [Actional digestion of notes from Figma](https://docs.google.com/spreadsheets/d/1WhroI0WnuB2AHr848sezBzHQNckSHlVH_VYZlwHv11w/edit?usp=sharing)

## Current Follow-Up Memo

Source: `WBS Deploy Setup Tool - UI Notes - wbs_installation_wizard_notes.csv`

Not every note below is a straight implementation task. Some need copy, some need a design call, and some may overlap with broader product decisions.

### Remaining Items

- Metadata callback visibility copy needs to be defined and added to the UI.
  - Explain what the setting means.
  - Explain what information would be shared.
  - Link to a place where users can read more before deciding.
- Common DNS/domain validation errors need more specific supporting guidance.
  - The UI should help users distinguish invalid hostname syntax from a hostname that does not resolve to the target server IP.
  - When a hostname does not map to the target server IP, explain what that means and how a user can resolve it.
- WBS Deploy target version selection needs product/engineering guidance.
  - Desired direction is to default to the latest stable target.
  - We still need a reliable mechanism for discovering or selecting the latest stable deploy ref.
  - Keep support for an explicit pinned target, but clarify when users should choose a pinned target instead of the default.
- Service boot progress could be more detailed.
  - It would be helpful to show service-level progress such as waiting, container up, health check complete, or similar milestones.
  - This is currently difficult because the web UI infers progress by matching text in setup logs, and different Docker or compose versions may report status differently.
  - Any implementation should have a solid fallback path so missing extra status reports does not cause setup failures or confusing regressions.

### Recently Resolved Or Superseded

- Password fields now have reveal/hide controls.
- Field labels avoid `MediaWiki` where `Wikibase` or a neutral label is clearer.
- `Advanced Options` is no longer part of the current setup flow, so related affordance and help-content notes are superseded.
- Host fields now include concrete example placeholders such as `mywikibase.com` and `query.mywikibase.com`.
- Configuration form spacing has been revisited in the current multi-step flow.
- Final configuration copy now reflects the current setup lifecycle more directly.
- Setup status after save now has clearer progress treatment with a progress bar, status summary, and step list.
- The duplicate domain help links are no longer present in the current domain step.
- The Wikibase Metadata project choice is now presented as a checkbox-style control.
- `MW_ADMIN_NAME` false blank-value issue in the web flow is resolved.
