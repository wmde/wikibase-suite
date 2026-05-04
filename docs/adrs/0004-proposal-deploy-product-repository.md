# 4) Proposal: Deploy Product Repository {#adr_0004}

Date: 2026-05-04

## Status

proposed

## Decision

Move Wikibase Suite Deploy into its own repository on Github outside of `wmde/wikibase-release-pipeline`.

The proposed repository shape is:

```text
deploy/
setup-tool/
README.md
```

The forthcoming Setup Tool is included with the understanding that it is part of the Deploy product offering.

## Why

The purpose of the move is to give Deploy a repository that matches its product boundary: a deployable configuration for creating a Wikibase instance along with its companion services, with related documentation and tooling for initial setup and ongoing maintenance and operations of the instance.

The code and docs in `wikibase-release-pipeline` are primarily concerned with building, testing, and releasing Wikibase Suite Docker images. At this time, that is mostly internal Suite team workflow, even though the code remains open source and available for community use. Deploy uses the images produced by that workflow, but it consumes them as published images from Docker Hub. It does not depend on the image build pipeline being present in the same repository.

Functionally speaking, Deploy has two practical connections to `wmde/wikibase-release-pipeline`, and neither requires Deploy to live in that repository.

First, the release pipeline uses Deploy configuration as the basis for its integration test suites. That is useful and can continue. The change is that the test harness would pull the Deploy configuration from the new repository instead of reading it from a local `deploy/` directory.

Second, Deploy consumes the published Docker images produced by the release pipeline. It depends on those image tags being available from Docker Hub or another image registry, not on the build-pipeline repository itself. If the team later wants to support community workflows around building custom images with `wikibase-release-pipeline` and using those images with Deploy, that can be revisited and would not be limited by the Deploy configuration living in a separate repository.

Moving Deploy into its own repository would make the product boundary clearer:

- `wikibase-release-pipeline` would become more exactly what its name suggests: open source build and release-pipeline tooling for Wikibase Suite images, rather than the main place users arrive to understand and install Deploy.
- For users Deploy would have one focused home for its code, docs, changelog, and setup paths.
- For contributors work on Deploy could happen in the context of Deploy itself, without requiring navigating around the additional unnecessary additional context of the build pipeline repository.

This move can be prepared with low disruption. The existing `wikibase-release-pipeline/deploy` location can remain in place and be kept in parity until the change over is ready and the team comfortable making a update public announcement. After that users arriving at the old URL would be re-directed to the new location via a short note left at `wikibase-release-pipeline/deploy/README.md`.

## Work Plan

Rough engineering estimate: 1 focused engineering day for initial repository creation, code movement, and release and test adjustments. This does not include coordination, review, product decision-making, communications effort, or process time.

1. Have an EM create the new repository after the repository name has been decided.

2. Add the intended repository structure.

   ```text
   deploy/
   setup-tool/
   README.md
   ```

3. Move Deploy `wmde/wikibase-release-pipeline/deploy` to `wmde/wikibase-suite/deploy/` (naming tbd).

4. Move Deploy Setup Tool code from the current setup-tool repository into `setup-tool/`.

5. Add a `package.json` to `setup-tool/` so the setup tool can be versioned as its own project. Deploy already has package metadata that would move with it.

6. Update the `wikibase-release-pipeline` release process for Deploy such that its releases are derived from and tagged on the new Deploy repository location.

7. In a `wikibase-release-pipeline` branch:

   - remove the Deploy code from `wikibase-release-pipeline`
   - add a file at `deploy/README.md` with a notice pointing to the new location
   - update the release-pipeline test harness to pull Deploy configuration from the new location

8. In coordination with communications:

   - update the location of Deploy install instructions anywhere it is mentioned
   - merge the `wikibase-release-pipeline` branch created in the above step
   - announce the new location of Deploy along with the new Deploy Setup Tool

## Decision Needed

What should the new repository be called?

Good options include:

- `wmde/wikibase-suite`
- `wmde/wikibase-suite-deploy`

This is a product and communications decision, as much as engineering. `wmde/wikibase-suite-deploy` is narrower and may be the safer immediate name. `wmde/wikibase-suite` may also be coherent if the team wants to treat Wikibase Suite as the top-level product framing: the configuration that runs the Wikibase Suite products together, the root documentation home for users learning about Wikibase Suite, and the naming prefix for related image products such as Wikibase Suite Wikibase, Wikibase Suite QuickStatements, and others. This naming question does not need to be fully resolved before exploratory work starts, but it should be aligned before the new repository is publicized.

## Follow-Ups (out of scope)

The following items are left out of scope for the initial repository move, but the move may make them valuable to consider soon after:

- Move Deploy documentation to a root `docs/` project.

  This may be the better long-term product shape because the root documentation could become the user-facing entry point for Wikibase Suite. It would likely imply separate documentation versioning, which would allow docs updates outside of Deploy configuration or setup-tool changes. The tradeoff is that the team would need to maintain the docs version and update it when documentation changes are released.

- Add a Deploy-specific test harness in the new repository.

  This is not required for the first migration. For now, Deploy will continue to be tested by `wikibase-release-pipeline`, which already uses the Deploy configuration as the basis for its integration test suites. A future Deploy repository test harness could add smaller smoke/configuration tests, but it is not yet clear whether that would be better than keeping this coverage in `wikibase-release-pipeline`. There is some good logic in keeping the test suite, in its current shape, where it is going forward.

- Split the Docker Compose configuration into smaller service-focused files.

  This would make Deploy more composable for adoption of Dokploy or other platform-as-a-service style products. It also could improve and clarify the update path for users by allowing them to pull upstream component Compose files while keeping local overrides untouched and outside the repository. This should be considered separately from the initial repository move because it changes the operational shape of Deploy itself.
