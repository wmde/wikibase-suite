# Import throughput trials

`wbs-dev benchmark import` measures the WBS importer using a fixed prepared
bundle. `--recipe PATH --corpus-dir NEW_DIRECTORY` optionally prepares that
bundle first through the benchmark corpus tools. `--bundle PATH` reuses an
existing bundle. See [the command overview](../README.md) for complete examples.

The trial uses the ordinary `wbs import load` command implementation. The
importer owns validation, persistence, progress and recovery; this scenario owns
the measured run and its evidence. It stops at current-state publication.
Derived-service rebuild correctness and readiness are required additional work,
not included in the reported publication rate.

Run against a fresh Suite with one writer. Start `wbs-dev benchmark metrics
start` first if collecting resources. `--skip-snapshots` supports local smoke
tests without collectors. `--limit N` deliberately pauses publication and is not
a complete import result. `--validate-only` exercises validation without saves.

`--save-mode edit-entity|entity-store`, `--commit-every N`, and `--bootstrap`
select the same options documented by [WBS import](../../../images/wbs-tools/commands/import/README.md).
Record those settings for every comparison. `entity-store` and `--bootstrap`
require a fresh, quiescent target and explicit handling of deferred derived work.

Each new results directory contains the bundle manifest in `run.json`, host/Git
identity, loader settings and copied importer event files, plus optional resource
snapshots. The PHP event stream provides save-loop timings; the trial's outer
duration includes process startup and collection. Inspect the final loader phase:
a successful invocation may be a deliberate pause rather than a completed load.

## Existing local evidence

On Apple-silicon Docker, with derived services absent:

| Implementation | Entities | Publication rate |
| --- | ---: | ---: |
| Service-native `entity-store`, commit every 100 | 1,002 | 47.28/s |
| Service-native `entity-store`, commit every 1,000 | 10,002 | 46.74/s |
| Direct snapshot prototype, without normalized terms | 10,002 | 122.3/s |
| Direct snapshot prototype, with official term writers | 1,002 | 42.33/s |

These observations cover different work and fixture sizes; the incomplete
122.3/s result is not an equivalent finished import. They do not establish VPS
throughput or whole-stack capacity. The snapshot publisher remains an isolated
prototype outside the normal command path.

Next: reproduce a fixed-bundle trial on Linux; compare normal service setup with
a quiescent maintenance-only setup, keeping MediaWiki bootstrap and correctness
requirements. Increase fixture size only after complete import validation.
