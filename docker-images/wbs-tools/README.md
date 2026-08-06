# Wikibase Suite (WBS) Tools

This directory contains the containerized Wikibase Suite configuration, installation, and lifecycle application. The downloaded [install](../../install) bootstrap hands off to the internal host launcher, while [`development/wbs`](../../development/wbs) provides an explicitly experimental developer entry point.

For normal installation instructions, start with [Install Wikibase Suite](../../docs/install/README.md).

During a new installation:

1. The bootstrap checks for Docker and installs it when necessary.
2. The bootstrap pulls the compatible published `wbs-tools` image.
3. The tools image uses its bundled Git client to clone the selected WBS release to `~/wikibase-suite`.
4. The checkout launches the browser configurator without exposing the Docker socket to it.
5. A separate, non-networked worker from the same image receives the Docker socket, starts the services, and reports progress through the installation log.

The same image also implements the terminal configurator and the currently internal, experimental `wbs up`, `down`, `status`, and `reset` commands. They are available for development and architectural testing but are not yet an announced end-user operations interface. Its source is organized by responsibility: [`wbs.ts`](wbs.ts) assembles the application, [`commands/`](commands) registers command verbs, [`lib/`](lib) contains reusable configuration and Docker operations, [`cli/`](cli) contains terminal interaction, and [`web/`](web) contains the server and browser client.

Most users do not need to run this image directly. Use the [WBS Installation Guide](../../docs/install/README.md), which selects a compatible tools image and supplies the required mounts and environment variables.

## Releases

Official releases of this image are available on [Docker Hub as `wikibase/wbs-tools`](https://hub.docker.com/r/wikibase/wbs-tools).

See the [image changelog](./CHANGELOG.md) for release notes. Documentation at previous releases is preserved in the repository under the corresponding [`wbs-tools@…` tag](https://github.com/wmde/wikibase-suite/tags).

This image uses the shared tag format for WBS Docker Images. See [WBS Versions](../../docs/versions.md).

WBS releases select a compatible tools major version. Minor and patch tools releases within that major version must remain compatible with the mounted WBS checkout and its host-side scripts.

## Development

Use this section only when developing, reviewing, or testing the tools.

- [docs/README.md](docs/README.md) covers the bootstrap, experimental development CLI, localhost installation, installer UI development, and WBS refs.
- [docs/adrs/README.md](docs/adrs/README.md) lists architecture decision records.

## Authors & contact

This image is maintained by the Wikibase Suite Team at [Wikimedia Germany (WMDE)](https://wikimedia.de).

If you have questions or need help, use this [bug report form](https://phabricator.wikimedia.org/maniphest/task/edit/form/129/) to start a conversation with the engineering team.
