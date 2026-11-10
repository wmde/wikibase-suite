# 25) Ontology presets {#adr_0025}

Date: 2026-09-09

## Status

accepted

## Context

A newly installed Wikibase is empty. For people starting a Wikibase project,
choosing an initial ontology can be a difficult first step. A small, curated
foundation of properties gives them a practical starting point for modelling a
domain and configuring related tools without requiring them to discover and
create every common property manually.

The community-maintained
[wikibase-bootstrap](https://gitlab.wikimedia.org/olea/wikibase-bootstrap/)
project provides reviewed OWL/Turtle source material based on established
Wikibase patterns. The initial preset names properties P1 through P8, and the
onboarding flow presents those as the IDs that will be created. This requires
a Wikibase whose property ID sequence has never been used, including by
properties that were later deleted.

## Decision

Bundle a `WikibaseOntologyPresets` MediaWiki extension in the Wikibase image. Its
Special page offers the community-curated Core Properties preset to an
administrator before Wikibase has allocated any property IDs.

The Special page and a MediaWiki maintenance command use the same service to
apply the preset. The command supports automated setup.

The service creates properties through Wikibase's entity-store API. It checks
the persistent property ID counter before import, requires consecutive IDs
starting at P1 in the bundle, and verifies each ID Wikibase allocates against
the corresponding bundle ID before saving. Claims between bundle properties
use those fixed IDs. `owl:equivalentProperty` assertions become exact-match
statements using P5. Both interfaces use the same server-owned service, which
rechecks eligibility immediately before applying a bundle.

The bundled Turtle is based on the pinned upstream small set, including its
attribution, licence, and version metadata. The P6 and P7 wording follows
[the community task correction](https://phabricator.wikimedia.org/T428746#12472907).
A narrow reader extracts property definitions and display metadata from that
file. CI checks its checksum and import plan.

## Consequences

The capability provides an onboarding path for a Wikibase that has never had
property IDs allocated. A Wikibase whose properties were later deleted is
ineligible because its next IDs would no longer match the preset.

Application is not transactional. An interrupted run can leave some properties
created, after which the property ID counter prevents another application.

The property IDs in the Turtle file are the IDs created on a fresh instance.
Additional properties can be included in that file when they use the same
conventions and consecutive IDs.

## References

- [wikibase-bootstrap community project](https://gitlab.wikimedia.org/olea/wikibase-bootstrap/)
- [T234943: bootstrap Wikibase installation with basic ontology](https://phabricator.wikimedia.org/T234943)
- [T391815: Wikibase bootstrap properties set](https://phabricator.wikimedia.org/T391815)
- [T430204: testable bootstrap ontology spike](https://phabricator.wikimedia.org/T430204)
