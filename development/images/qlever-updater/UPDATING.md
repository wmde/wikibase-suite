# Updating the QLever Updater image

[Back to the release guide](../../docs/release.md#prepare-a-release)

`qlever-updater` is repository-owned synchronization code in a lean PHP CLI
image. It has no independent upstream source version. Use the regular image
workflow to prepare a release:

```sh
wbs-dev update qlever-updater
```

Review updater, full-export, reconciliation, Compose, and integration-test
changes together. The separate `qlever` image owns the upstream QLever
version. A QLever static index is data-format dependent, so rehearse a full
export and reconciliation on representative data before publishing either
image.

Run at least:

```sh
wbs-dev build qlever qlever-updater
wbs-dev test qlever
```

The updater image is published independently. The separate `qlever` image owns
the upstream QLever version.
