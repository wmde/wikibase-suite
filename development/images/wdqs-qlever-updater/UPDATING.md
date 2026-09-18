# Updating the QLever Updater image

[Back to the release guide](../../docs/release.md#prepare-a-release)

`wdqs-qlever-updater` is repository-owned Java synchronization code. It
consumes the Foundation `wdqs-common` release recorded through the
`WDQS_COMMON` pin in `docker-bake.hcl`. Keep the Maven dependency version in
`build/qlever-updater/pom.xml` aligned with that release. Use the regular image
workflow to prepare a release or review a proposed Munger revision:

```sh
wbs-dev update wdqs-qlever-updater
```

Review Munger, updater, full-export, reconciliation, Compose, and
integration-test changes together. The separate `qlever` image owns the
upstream QLever version. A QLever static index is data-format dependent, so
rehearse a full export and reconciliation on representative data before
publishing either image.

Run at least:

```sh
wbs-dev build qlever wdqs-qlever-updater
wbs-dev test wdqs
wbs-dev test qlever
```

The updater image is published independently. The separate `qlever` image owns
the upstream QLever version.
