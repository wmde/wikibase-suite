# Published WBS series branches

Date: 2026-11-16

## Status

draft/proposed

## Context

Installations currently check out exact release tags such as `wbs@8.0.1`, and to upgrade WBS a user currently has to be made aware of a new version and explicitly check it out using a series of three or four git commands. Following a major-series branch could simplify updates and provide a foundation for the planned [WBS upgrade utility](./index.md).

The recently introduced `release/wbs-<major-version>` branches (e.g `release/wbs-8`) provide a predictable Git reference for published releases within the current major series. Installations following such branches provide a path for our users to more simply receive in-series patch and minor updates, similar to major-version tags scheme we use for our Docker images. A side effect of moving to release branches is that we effectively free the wikibase-suite `main` branch for staging and testing work that has yet been included in a versioned released.

If installation were based on such a release branch, we can update our documentation or a future upgrade to still prompt the user for which version/s they wish to upgrade to, while having their installation based on a tracked and moving branch reduces the amount of cases and related custom code we need to create and guarantee simple and reliable upgrades.

## Proposal

Adopt published major-series branches as the checkout used by future installations and as a basis for upgrade tooling. The proposed naming is `wbs@<major-version>` in place of the provisional `release/wbs-<major-version>`, alongside exact release tags such as `wbs@8.0.2`.

Continue publishing exact version tags for every release. Existing end-user upgrade and update instructions remain unchanged until the next major WBS release (WBS 9); WBS 8 users continue to receive updates by checking out exact tags.

## Considerations

A series branch must track successfully published releases and support forward-only updates within its major series. Following that branch would let users update their checkout with `git pull --ff-only`; image pulling and service reconciliation would still be needed to apply the update.

Adoption requires a transition path for installations currently checked out at exact tags, including shallow clones and local configuration changes. Installer defaults, migration guidance, and the upgrade utility should provide a consistent path when branch tracking is introduced to users.

## Open questions

- What is exactly the dev workflow between `main` and `wbs@8` release branches? Do we have a clear picture, and ok with the implications?
- Is `wbs@8` as a release branch name sufficiently clear alongside exact tags such as `wbs@8.0.2`?

## Decision and follow-up

Record the decision and its reasoning here after evaluating the proposal. If adopted, align branch names and release tooling with the decision while preserving exact-tag publication and the existing WBS 8 update instructions. Adoption in the installer and upgrade utility follows separately.
