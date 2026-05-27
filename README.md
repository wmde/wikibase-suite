# Wikibase Suite

> [!IMPORTANT]
> This repository is the working transition home for moving Wikibase Suite Deploy out of
`wmde/wikibase-release-pipeline` and placing it beside the installer currently developed in `wmde/wbs-deploy-setup`.

The intended product boundary is a focused Wikibase Suite repository containing the
deployable configuration, installation tooling, and user-facing documentation for
running a Wikibase Suite instance.

## Why this move is happening

`wikibase-release-pipeline` is primarily build, test, and release-pipeline tooling for
Wikibase Suite Docker images. Deploy consumes those images from Docker Hub or another
registry, but it does not need to live beside the image build pipeline.

Deploy still has two ongoing relationships with `wikibase-release-pipeline`:

- The release pipeline uses Deploy configuration as the basis for integration tests.
- Deploy consumes image tags produced by the release pipeline.

Both relationships can continue after Deploy moves. The release-pipeline test harness
should pull Deploy configuration from this repository, and Deploy should continue to use
published image tags rather than depending on the build-pipeline repository layout.

The installer belongs here because it is part of the Deploy product experience: it guides
users through configuring and launching the Wikibase Suite stack.

## Current state

This repository currently keeps Deploy and the installer in discrete directories:

```text
deploy/
installer/
README.md
update-from-sources.sh
```

The `deploy` and `installer` remotes are configured so both directories can keep receiving
changes from their current source repositories until the upstream updates are settled. Run
the update script from a clean working tree to pull those changes into this repository:

```sh
./update-from-sources.sh
```

This is an interim shape. The final public repository should flatten the Deploy files out
of `deploy/` once upstream synchronization is no longer needed. That collapse also moves
Deploy documentation from `deploy/docs/` to a root `docs/` area and changes the root
README from this transition plan into the main user entry point. The installer can remain
in `installer/`.

## Transition checklist

### Initial Setup

- [x] Create the transition repository.

- [x] Import Deploy from `wmde/wikibase-release-pipeline/deploy` into `deploy/`.

- [x] Import the installer from `wmde/wbs-deploy-setup` into `installer/`.

- [x] Preserve upstream links during transition so both source projects can still receive
  active changes.
  
- [x] Add a source-update script for pulling ongoing Deploy and installer changes.

- [x] Rename the imported installer directory from `install/` to `installer/`.

- [ ] Continue running `update-from-sources.sh` until the upstream Deploy and installer
  changes are settled.

- [ ] Flatten `deploy/` into the repository root once source synchronization from
  `wikibase-release-pipeline/deploy` is no longer needed, including moving
  `deploy/docs/` to root `docs/`.

  ### Documentation Updates

- [ ] Move the manual Deploy installation flow out of the root README and into its own
	documentation page as the alternate installation path.

- [ ] Fold the useful content from `installer/README.md` into the final root README forwarding the installer path as the suggested installation method and the Manual Installation as an alternative option.

- [ ] Update any internal document links that may point at `wikibase-release-pipeline/deploy`

	### Release Process Updates

- [ ] Update the `wikibase-release-pipeline` release process so Deploy releases are
	derived from and tagged on the new repository location.

- [ ] Update the `wikibase-release-pipeline` integration test harness to pull Deploy
  configuration from this repository instead of reading from a local `deploy/` directory.

- [ ] In a transition branch of `wikibase-release-pipeline`, replace the old `deploy/` content with a short
  `deploy/README.md` notice that points users to the new repository.

  ### Initial Release
  
- [ ] Update public install instructions and any other references to the old Deploy
  location.

- [ ] Coordinate the merge of the release-pipeline transition branch with communication
	about the new Deploy and installer location.

- [ ] Announce the new repository location when the final repository shape, release
  process, and documentation links are ready.

## Open Questions

- Does the Installer need it own `package.json` so it can be versioned independent of WBS versions? If not do we move WBS versions (presumably always and only PATCH or MINOR updates) when we make Installer updates.
- Does the `wikibase-suite` repo want its own versioning scripts, tests, or Github Actions / release workflow?

