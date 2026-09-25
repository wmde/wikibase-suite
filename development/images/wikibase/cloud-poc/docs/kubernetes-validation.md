# Cloud Kubernetes validation

This record extends the [Cloud Compose POC](../README.md) with one practical
question: can the `wikibase-cloud` image built by Wikibase Suite serve a new
tenant in the complete local Wikibase Cloud Kubernetes stack?

It records one VPS rehearsal. It does not propose a Cloud migration policy,
production deployment, or a hosted test-suite programme.

## What was established

The VPS ran the upstream local Cloud stack on a 32 GiB / 8 vCPU host. The Suite
Cloud image was built natively on that host with:

```sh
development/wbs-dev build wikibase --load wikibase-cloud
```

The POC retained the working `mediawiki-143` release and added a parallel
`mediawiki-146` release that uses `wikibase/wikibase-cloud:wbs-wikibase-poc`.
All four roles started successfully. The API POC image supplied a
`mw1.46-wbs1` database pool, and its host resolver maps that schema version to
the 1.46 release.

A disposable new tenant was allocated `mw1.46-wbs1`, initialized through the
Cloud API, and served on the public wildcard domain. Its site-info endpoint
returned HTTP 200 and `MediaWiki 1.46.0`; the Wikibase entity API also returned
HTTP 200. Platform Nginx reported that its API requests were routed to
`mediawiki-146-app-api`.

This demonstrates the new-tenant path without migrating an existing 1.43
tenant. The 1.43 release remains the rollback path throughout the rehearsal.

## Important implementation detail

The first direct Helm install of the parallel release used only the local POC
values file. That left `PLATFORM_API_BACKEND_HOST` at its template placeholder,
so the initial `wbstackInit` call failed. The release now composes the same
production defaults used by `mediawiki-143` with the POC local values. This
supplies the real service addresses, Redis secret references, and resource
settings; the POC file only overrides the image and its reduced CPU requests.

The API Argo Application has an upstream GitHub chart source, so its POC image
and database-version parameters are applied as a runtime JSON patch. The
non-secret patch and the temporary low-capacity rollout strategy are mirrored
in [the deployment configuration](../cloud-deploy/README.md).

## Validation performed

- all four `mediawiki-146` deployments use the Suite-built Cloud image;
- a newly created tenant is assigned `mw1.46-wbs1`;
- the public tenant API reports `MediaWiki 1.46.0` and serves `wbgetentities`;
- Platform Nginx routes that tenant to the `mediawiki-146` API service;
- the existing `mediawiki-143` release remains running alongside it.

The shared Query Service scheduler in this local stack currently logs a
missing `QsCheckpoint` while creating batches. That pre-existing stack-level
failure means an end-to-end Query Service update has not yet been verified for
the 1.46 tenant; it is separate from the successful tenant initialization and
request routing above.

## Test administrator access

The current Cloud initialization creates and promotes the requested MediaWiki
user, but supplies no password. It asks MediaWiki to send a reset email. Mail
delivery is not configured on this VPS, so a disposable POC administrator can
be given a temporary password with the tenant-aware maintenance command:

```sh
kubectl -n default exec -i deploy/mediawiki-146-app-backend -- \
  env WBS_DOMAIN=<tenant-domain> php maintenance/run.php changePassword \
  --user='<administrator>' --passwordstdin
```

Supply the temporary password on standard input and replace it after login.
This is a VPS test-only operational workaround; it does not change tenant
initialization or Cloud authentication code.

## Existing tenants

The new-tenant result does not migrate any existing `mw1.43-wbs2` database.
That requires a separate, reversible rehearsal. The existing
`k8s/jobs/mediawikiUpdate.sh` job is the candidate mechanism: run it against a
`mediawiki-146` backend with `mw1.43-wbs2` as the source version and
`mw1.46-wbs1` as the destination. Verify the upgraded tenant before considering
any broader cutover policy.

## Reproduce the POC

1. Recreate the VPS and base stack using [the configuration mirror](../cloud-deploy/README.md).
2. Build and load the Suite `wikibase-cloud` image on the VPS.
3. Build the API POC image containing the 1.46 schema and load both images into
   Minikube.
4. Deploy `mediawiki-146` from the `WBS-WikiBase-POC` branch of the private
   deployment remote, then apply the API JSON patch and reconcile it.
5. Reapply the capacity rollout strategy if a Helm or Argo rollout stalls on
   the VPS, wait for a pre-provisioned database, and create a fresh tenant.
6. Verify the MediaWiki version, entity API, and Platform Nginx routing before
   attempting an existing-tenant migration.
