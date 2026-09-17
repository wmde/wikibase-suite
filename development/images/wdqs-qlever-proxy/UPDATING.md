# Updating the QLever Wikidata Proxy image

[Back to the release guide](../../docs/release.md#prepare-a-release)

This image tracks the Foundation's WDQS Proxy source through the `WDQS_PROXY`
repository, branch, and immutable commit in [`docker-bake.hcl`](./docker-bake.hcl).
The current branch is an in-progress label-service implementation, not a
published upstream release.

Use the standard source-update workflow to resolve a newer source commit,
review the upstream comparison, and leave the planned pin unstaged:

```sh
wbs-dev update wdqs-qlever-proxy
```

For each update, review upstream license notices, label-service rewrite tests,
prefix behavior, and the resulting proxy/QLever integration before release.
Also verify that
[`build/disable-eventgate-by-default.patch`](./build/disable-eventgate-by-default.patch)
still applies. Upstream support for disabling EventGate telemetry should replace
this temporary patch when available. Build and test with:

```sh
wbs-dev build qlever wdqs-qlever-proxy
wbs-dev test wdqs
```
