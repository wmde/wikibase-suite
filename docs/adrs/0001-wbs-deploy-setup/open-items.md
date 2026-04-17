# Open Items

This file tracks the live work queue for ADR 0001.

Use this file for:

- UX review notes and enhancement candidates
- copy questions and content gaps
- bugs discovered while evaluating the reference implementation
- product decisions that are still open but remain inside the ADR 0001 scope

Create a new ADR only when we need a separate durable decision, not when we are refining this same baseline.

## Current UX Review Batch

Source: `WBS Deploy Setup Tool - UI Notes - wbs_installation_wizard_notes.csv`

Not every note below is a straight implementation task. Some need copy, some need a design call, and some may overlap with broader product decisions.

### Ready To Implement

- Add reveal/hide controls to password fields.
- Update field labels so `MediaWiki` is not used where `Wikibase` or a neutral label would be clearer.
- Restyle the `Advanced Options` disclosure affordance to use the expected left-aligned expansion caret treatment.
- Improve host-field help text with concrete examples such as `yourwikibase.com` and `query.yourwikibase.com`.
- Revisit spacing in the configuration form so fields breathe more and are easier to scan.
- Change the password-removal text from "after the installation is complete" to wording that reflects the actual setup lifecycle, for example "after this setup is closed".

### Needs UX Or Product Shaping

- Setup shutdown behavior needs clearer communication.
  - If the setup service auto-closes after a fixed period, the UI should say so before and during that countdown.
- Setup status after save should be broken into clearer steps instead of reading as a single undifferentiated process.
  - This does not imply adopting a tabbed interface.
- Setup progress visibility should be stronger.
  - Consider a progress bar, step list, or similarly visible status treatment.
- The duplicate domain help links are confusing because they open the same help content.
  - Decide whether each field needs its own help entry or whether a single shared explanation should be presented differently.
- The Wikibase Metadata project choice needs a clearer interaction model.
  - The current feedback suggests this should likely be framed as an explicit checkbox-style consent/opt-in control.
- Advanced Options help likely needs dedicated explanatory content.
  - Users need to understand what "Advanced" means, whether changes are necessary, and what happens if they leave defaults unchanged.

### Needs Copy

- Metadata callback visibility choice needs user-facing copy that explains:
  - what the setting means
  - what information would be shared
  - where users can read more before deciding
- Common DNS/domain validation errors need supporting guidance.
  - When a hostname does not map to the target server IP, the UI should explain what the error means and how a user can resolve it.

### Recently Resolved

- `MW_ADMIN_NAME` false blank-value issue in the web flow.
  - Marked done in the source review notes.

## Existing Bugs And Open Decisions

- `MW_ADMIN_NAME` default, field placement, and preloaded-value validation
  - `MW_ADMIN_NAME` now defaults to blank in `wikibase-release-pipeline/deploy/template.env` (it previously defaulted to `admin`).
  - Because this setup tool currently uses that template as the source of truth for defaults, setup can proceed with an empty admin username.
  - For current evaluation/testing, this tool should temporarily hard-code the default back to `admin`.
  - If we keep strict alignment with upstream `template.env` and require explicit user choice, move MediaWiki admin name out of Advanced settings.
  - Add a safeguard so values preloaded into the web form are validated on load (not only on user edits/submission), to prevent invalid pre-populated values from slipping through.

- Open question/issue: WBS Deploy target version selection UX and guidance
  - There is an open issue in how the setup tool selects which `wikibase-release-pipeline/deploy` version to install.
  - A target can be set via environment variable, but this is not clear in the curl-based convenience entrypoint.
  - Current guidance is unclear on when users should choose latest/default behavior vs a specific pinned target.
