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

## Scope boundary

The next technical question is how Cloud should supply a schema compatible with
MediaWiki 1.46 before a tenant is served by this image, and how existing tenant
databases should be updated. That work belongs to Cloud's own database-pool and
deployment lifecycle. It is intentionally not designed or implemented in this
Suite POC branch.
