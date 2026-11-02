# Federated Items alpha

This alpha lets a Wikibase instance use Wikidata items as statement values. The feature is still being developed. Its API representation may change, and integration with Query Service is under investigation.

## New instance

Follow the [installation guide](../README.md#installation). After cloning the repository in step 4, switch to this branch before entering the `deploy` directory:

```sh
cd wikibase-release-pipeline
git fetch origin
git switch --detach origin/federated-values/wbs-7-merge
cd deploy
```

Then continue with the initial configuration and startup steps. The Compose file references the `wikibase/wikibase:7.1.1-fv.1` image, which must be available before starting the instance.

## Existing WBS 7 instance

Back up your [data and configuration](./backup-and-restore.md) before changing the checkout. Review the [upgrade guidance](./updating.md) if you have local changes to tracked files. If your installation is older than WBS 7, upgrade to WBS 7 first.

From the repository root, switch to this alpha branch:

```sh
git fetch origin
git switch --detach origin/federated-values/wbs-7-merge
```

Then pull the images and restart the existing stack from the `deploy` directory:

```sh
cd deploy
docker compose pull
docker compose up -d
docker compose ps
```

The existing Docker volumes and generated configuration are retained. Wait for the `wikibase` service to become healthy before trying the feature. If startup fails, use the [troubleshooting guide](./troubleshooting.md) and the backup you made before switching.
