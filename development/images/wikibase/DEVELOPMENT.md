# Developing the Wikibase image

The image packages PHP/Apache, MediaWiki, and extensions. Its [entry point](./runtime/entrypoint.sh) selects a workload and delegates setup and configuration to the bundled [WikibaseSuite extension](./runtime/var/www/html/extensions/WikibaseSuite/README.md).

## 1. Select the workload

```text
web (default) ──────────── WikibaseSuite setup ── Apache
jobrunner / maintenance ── existing configuration; no setup
other command ──────────── base PHP entry point; no setup
```

The [image README](./README.md#web-job-runner-and-maintenance-workloads) documents the commands and arguments.

## 2. Prepare the instance

For web startup, the entry point calls `WikibaseSuite/setup/setup.sh` to install, migrate, or update the instance as needed. Follow the [extension walkthrough](./runtime/var/www/html/extensions/WikibaseSuite/README.md) for configuration order, saved state, and recovery.

## 3. Start the workload

Setup must return successfully before Apache starts. Jobrunner and maintenance use the existing `/config/InstanceSettings.php` without running setup themselves.

For entry-point changes, start with `wbs-dev test wikibase wikibase-client`. For build inputs and runtime dependencies, use [UPDATING.md](./UPDATING.md).

The image also supports [externally managed configuration](./README.md#externally-managed-configuration) through `MW_CONFIG_FILE`.
