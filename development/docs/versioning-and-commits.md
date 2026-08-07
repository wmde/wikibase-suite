# Versioning and Conventional Commits

Wikibase Suite and each published image have independent versions. All use [Semantic Versioning](https://semver.org/spec/v2.0.0.html), written as `MAJOR.MINOR.PATCH`:

- increment `PATCH` for compatible fixes
- increment `MINOR` for backward-compatible functionality
- increment `MAJOR` for incompatible changes

The [WBS version policy](../../docs/versions.md) explains how product and image versions relate. This guide explains how commit messages provide the release impact used by the development tooling.

## Release impact

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) so the history records the intended impact of a change. `wbs-dev update` examines commits since each affected project's latest tag and proposes the highest applicable version increment:

| Commit                                          | Version increment  |
| ----------------------------------------------- | ------------------ |
| `fix` or `perf`                                 | Patch              |
| `feat`                                          | Minor              |
| Any type with `!` or a `BREAKING CHANGE` footer | Major              |
| Other types                                     | None by themselves |

Changed paths determine which independently versioned projects a commit affects; the optional commit scope is descriptive and does not select a project. Uncommitted project changes cause `update` to propose at least a patch so release preparation can include source-pin and metadata updates.

The command generates `Changes` from release-driving commits and `Dependency updates` from source-pin differences, in that order. These two sections are command-owned and replaced on rerun; operator-written summaries and compatibility notes belong outside them and are preserved. Generated-only release commits do not affect a subsequent run. Release operators must review and may change the proposed version or add separate changelog commentary before committing. The `wbs-dev release` commands only publish validated, committed release tags. Prerelease versions are not currently supported.

See the [release process](./release.md) for preparation, publication ordering, and verification.

## Commit types

| Type       | Intended change                                    |
| ---------- | -------------------------------------------------- |
| `build`    | Build system or dependency changes                 |
| `chore`    | Maintenance that does not fit another type         |
| `ci`       | Continuous integration changes                     |
| `docs`     | Documentation changes                              |
| `feat`     | New user-visible functionality                     |
| `fix`      | User-visible bug fixes                             |
| `perf`     | Performance improvements                           |
| `refactor` | Internal changes without intended behavior changes |
| `style`    | Formatting or presentation-only changes            |
| `test`     | Test-only changes                                  |

Any type can carry a breaking marker and therefore select a major increment.

Examples:

```text
fix(backup-script): report error if no space is left
feat(installer): add database credential generation
refactor!: remove support for the legacy configuration
```

## Pull requests

Conventional metadata must reach the target branch. Use a conventional PR title when squash merging, or retain conventional commit messages when merging without a squash.
