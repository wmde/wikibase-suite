# Wikibase Suite (WBS) Tools

WBS Tools is the containerized foundation of the [Wikibase Suite Installer](../../../docs/install/installer.md). Its published purpose today is to support installation: bootstrap a WBS checkout, collect and validate configuration, and start the Suite.

## Installer architecture

1. The root [`install`](../../../install) bootstrap prepares Docker and obtains the compatible WBS Tools image and WBS checkout.
2. The checkout launches the browser configurator through the host-side runtime.
3. The browser-facing container collects configuration without receiving the Docker socket.
4. A separate, non-networked worker receives the socket, starts the services, reports progress, and exits.

The [controller](./lib/web-installer-controller.ts) starts the browser and worker containers. The browser saves configuration and writes `.wbs/install-request`; the [worker](./lib/installation.ts) consumes it, runs Compose, and records readiness or failure in `.wbs/logs/installation.log`. Relaunching the browser installer clears that attempt log and request, so preserve diagnostics first.

These files track the installer attempt. MediaWiki setup and migration state belong to the [WikibaseSuite extension](../wikibase/runtime/var/www/html/extensions/WikibaseSuite/README.md) inside the Wikibase image. Test this outer installer flow with `wbs-dev test wbs-tools`.

Users should follow the [WBS installation guide](../../../docs/install/installer.md) rather than run this image directly.

## Releases and development

The image is published as [`wikibase/wbs-tools`](https://hub.docker.com/r/wikibase/wbs-tools) with independent `wbs-tools@X.Y.Z` release tags. A WBS release selects an exact compatible image in its checked-in `.wbs/version` manifest. Publishing WBS Tools does not change an existing WBS release until that release deliberately adopts the new image.

See [UPDATING.md](./UPDATING.md) for development, testing, compatibility, and release guidance, and [CHANGELOG.md](./CHANGELOG.md) for released changes.
