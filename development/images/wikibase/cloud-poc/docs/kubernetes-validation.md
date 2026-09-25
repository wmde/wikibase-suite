# Cloud Kubernetes validation

This record extends the [Cloud Compose POC](../README.md) with one practical
question: can the `wikibase-cloud` image built by Wikibase Suite start in the
complete local Wikibase Cloud Kubernetes stack?

It records one VPS rehearsal. It does not propose a Cloud migration policy,
production deployment, or a hosted test-suite programme.

## What was established

The VPS ran the upstream local Cloud stack on a 32 GiB / 8 vCPU host. The Suite
Cloud image was built natively on that host with:

```sh
development/wbs-dev build wikibase --load wikibase-cloud
```

The image was loaded into Minikube and substituted for the `mediawiki-143`
Helm release. All four MediaWiki roles started successfully and reported
MediaWiki 1.46.0. The Platform API, Cloud tenant resolution, and an existing
POC wiki's basic home-page request all worked during the temporary swap.

A fresh tenant also received a public URL and returned HTTP 200, but its 1.46
initialization logged:

```text
Error 1054: Unknown column 'cl_target_id' in 'on clause'
```

The Cloud database pool still supplied a `mw1.43-wbs2` schema. Replacing the
application image does not migrate that schema. The release was immediately
rolled back to its original 1.43 image after collecting this result.

This is useful evidence for the image POC: the Suite image can start under the
current Cloud deployment contract, while Cloud's tenant database lifecycle is
a separate integration requirement.

## Current VPS result

The VPS has been returned to its known-good state:

- all `mediawiki-143` roles use `ghcr.io/wbstack/mediawiki:sha-7df52d9`;
- the Cloud API and UI applications are Synced and Healthy;
- the original and fresh disposable POC wikis return HTTP 200;
- the locally built `wikibase/wikibase-cloud` image remains available for a
  later rehearsal.

The full host setup, known omissions, and restart instructions are captured in
[the configuration mirror](../cloud-deploy/README.md). It includes the Caddy,
Minikube tunnel, Helm resolver, host-alias, and Argo parameter files needed to
recreate the VPS environment without copying credentials or Terraform state.

## Resume checklist

The next POC increment is deliberately a **fresh 1.46 tenant**, not a
cloud-wide upgrade. It should preserve the current `mediawiki-143` release and
its `mw1.43-wbs2` tenants as the rollback path.

1. In the sibling `wbstack/api` repository, create a dedicated POC branch. Follow its `database/mw/README.md` process against the 1.46 Cloud
   image to generate a fresh schema, conventionally `mw1.46-wbs1.sql`, under
   `database/mw/new/`.
2. Add `mw1.46-wbs1` to `config/mw-db-version-map.php`, mapped to `146`. Set
   the Cloud API's provision and use versions to `mw1.46-wbs1` for this
   isolated environment. Its `ProvisionWikiDbJob` will then replenish that
   versioned database pool, and the host resolver will route its tenants to
   `mediawiki-146`.
3. In the sibling `wbstack/wbaas-deploy` repository, create a separate
   `mediawiki-146` Helm release using the Suite-built Cloud image. Do not
   replace `mediawiki-143`; the two releases are the POC's safe coexistence
   mechanism.
4. Push each experimental branch to the VPS `vps-poc` remote, build and deploy
   the updated API image where required, then reconcile the deployment. A
   source checkout alone does not change the running API.
5. Wait for a pre-provisioned `mw1.46-wbs1` database, create a brand-new wiki,
   and verify that all four `mediawiki-146` roles start and that the wiki can
   perform the representative Wikibase and Query Service flows.

Only after the fresh-tenant route works should the disposable existing tenant
be migrated. The existing `k8s/jobs/mediawikiUpdate.sh` job supplies the
mechanism: run it against a `mediawiki-146` backend, with `mw1.43-wbs2` as the
source version and `mw1.46-wbs1` as the destination. That is a separate,
reversible rehearsal; it is not needed to establish the new-tenant POC.

## Scope boundary

The next technical question is how Cloud should supply a schema compatible with
MediaWiki 1.46 before a tenant is served by this image, and how existing tenant
databases should be updated. That work belongs to Cloud's own database-pool and
deployment lifecycle. It is intentionally not designed or implemented in this
Suite POC branch.
