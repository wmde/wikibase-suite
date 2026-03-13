# Open Items

This file tracks open bugs and enhancement candidates for ADR 0001.

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
