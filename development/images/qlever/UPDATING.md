# Updating the QLever image

[Back to the release guide](../../docs/release.md#prepare-a-release)

`qlever` pins the upstream QLever OCI image by digest and contains the tested
default `Qleverfile`. Review a newer upstream image, update the digest in
`docker-bake.hcl`, review the bundled
configuration, and release the wrapper independently:

```sh
wbs-dev build qlever qlever-updater
wbs-dev test qlever
```

Rehearse an index rebuild with representative input data. A QLever static index
is data-format dependent, so upstream changes must be tested against both the
static index and persisted incremental updates.
