# Conventional Commits

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) are used here to help generate local draft release suggestions with Nx.

In this repository they are used for:

- local preview of possible version bumps
- local preview of draft changelog entries

They are not the final release source of truth by themselves:

- the CI `Create Release` workflow is tag-only
- CI does not run `nx release`
- CI does not generate changelogs
- final changelog text is curated and committed in the release PR

Typical local preparation uses `nx release version` plus per-project `nx release changelog <version>`. A full `nx release --dry-run` is also useful as a preview path.

## How to Use in PRs

To preserve conventional-commit metadata on `main`, use one of these:

- set the PR title to conventional-commit format and squash merge
- or merge without squashing and keep conventional-commit format in commits

## Supported Types

Configured in [`nx.json`](https://github.com/wmde/wikibase-release-pipeline/blob/main/nx.json):

| Type     | SemVer bump | Changelog title  |
| -------- | ----------- | ---------------- |
| build    | patch       | 📦 Build         |
| chore    | patch       | 🏡 Chore         |
| ci       | none        | Not included      |
| docs     | patch       | 📖 Documentation |
| feat     | minor       | 🚀 Features      |
| fix      | patch       | 🩹 Fixes         |
| perf     | patch       | 🔥 Performance   |
| refactor | patch       | 💅 Refactors     |
| style    | patch       | 🎨 Styles        |
| test     | patch       | ✅ Tests         |

Any type can be a breaking change with `!`, which implies a major bump.

## Quick Examples

```text
fix(backup-script): report error if no space left on device
feat: add support for cats
refactor!: remove support for sabre-toothed tiger
```
