# 17) Using mediawiki docker image {#adr_0017}

Date: 2021-06-18

## Status

Historical — no longer describes the implementation (reviewed 2026-11-16).

The current Wikibase image builds on PHP/Apache and fetches pinned MediaWiki source. See the [image update guide](../../images/wikibase/UPDATING.md) for source selection and maintenance responsibilities. The original decision below is retained as history.

## Context

During the first iteration of development on the wikibase release pipeline, one of the goals was to build and run it against the master branches of MediaWiki, Wikibase and other bundled extensions ([T270133](https://phabricator.wikimedia.org/T270133)).

Because of the lack of such docker images at the time the team decided to create our own, inspired by the work of the official docker images. The benefits of this decision was seen when previously untested parts of Wikibase (Multi Wiki testing client/repo ) now had some coverage on the master branch. During the development of the pipeline several issues were detected by using these custom docker images, sometimes the pipeline would breakdown days before a bug report would appear on phabricator.

This can be useful but also comes with some additional drawbacks that can affect the maintainability and the quality of the releases WMDE will produce.

- To offer the same quality and security as the official Mediawiki docker images we now also have to maintain our own rather than building upon what already exists.
- Any updates or security fixes to these images are probably also more likely to be identified and patched in the official MediaWiki docker images quicker than in any image maintained by WMDE.
- The MediaWiki docker images are battle proven with 10+ Million downloads, our custom images are not.

As the priority of the release pipeline should be to provide stable and secure releases it could make sense to revert this initial decision of building our own image.

The decision to adopt parts of the testing done in the release pipeline for Wikibase CI is still pending. Depending on the outcome of [T282476](https://phabricator.wikimedia.org/T282476), custom images could then be required again and could serve as a base when used for testing in CI where the requirements for security or performance aren't as high ([T282479](https://phabricator.wikimedia.org/T282479)).

## Decision

- Use the official MediaWiki docker images as a base for the Wikibase base and bundle images.

## Consequences

Since new releases would build upon the existing MediaWiki docker releases WMDE will only be able to produce releases once the upstream docker images are available.

To mitigate this potential blocker WMDE could take a more active role in producing these images by contributing to the [MediaWiki-docker repository].

[MediaWiki-docker repository]: (https://github.com/wikimedia/mediawiki-docker)
