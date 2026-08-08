# Wikibase Suite (WBS) Tools

WBS Tools is the containerized foundation of the [Wikibase Suite Installer](../../../docs/install/README.md). Its published purpose today is to support installation: bootstrap a WBS checkout, collect and validate configuration, and start the Suite.

## Installer architecture

1. The root [`install`](../../../install) bootstrap prepares Docker and obtains the compatible WBS Tools image and WBS checkout.
2. The checkout launches the browser configurator through the host-side runtime.
3. The browser-facing container collects configuration without receiving the Docker socket.
4. A separate, non-networked worker receives the socket, starts the services, reports progress, and exits.

Users should follow the [WBS installation guide](../../../docs/install/README.md) rather than run this image directly.

## Releases and development

The image is published as [`wikibase/wbs-tools`](https://hub.docker.com/r/wikibase/wbs-tools) with independent `wbs-tools@X.Y.Z` release tags. Each WBS release selects a compatible tools major version; minor and patch tools releases within that major must remain compatible with its checkout and host scripts.

See [UPDATING.md](./UPDATING.md) for development, testing, compatibility, and release guidance, and [CHANGELOG.md](./CHANGELOG.md) for released changes.
