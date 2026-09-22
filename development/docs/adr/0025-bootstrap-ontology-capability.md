# 25) Bootstrap ontology capability {#adr_0025}

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
Wikibase patterns. Its Python importer, however, assumes fixed local IDs.
Wikibase Suite must not assume that an upstream source IRI will become a
particular local `P…` identifier.

## Decision

Bundle a `WikibaseBootstrap` MediaWiki extension in the Wikibase image. This
puts two reviewed, property-only ontology starting points directly where a new
Wikibase administrator can use them, rather than requiring a separate Python
or command-line bootstrap workflow. The feature is opt-in and is available
only while Wikibase has no entities.

The extension Special page and the extension's regular MediaWiki maintenance
script use the same service, so the same bootstrap can be run from either the
administrative interface or the command line. The Special page is the intended
onboarding path; the maintenance script supports automated or operational use.

The service creates properties through Wikibase's entity-store API and lets
Wikibase allocate fresh local IDs. Bundle source IRIs are stable planning keys;
claims between bundle properties are resolved using the IDs allocated in that
same run. Both interfaces use the same server-owned service, which rechecks
eligibility immediately before applying a bundle.

The bundled Turtle retains upstream attribution, licence, provenance, and
version metadata. Its narrow profile is checked with pySHACL in development
and CI. The running extension deliberately has no Python or RDF/SHACL runtime
dependency: it reads only the reviewed bundled profile.

For small, exploratory Wikibases, the Special page can delete at most 25
existing Wikibase entities after an explicit typed confirmation. This is a
convenience reset, not a general-purpose data-reset facility.

## Consequences

The capability preserves the supported choice to start with an empty Wikibase,
while providing a more accessible onboarding path for users who want a
community-curated foundation.

Application is not transactional. A request failure can leave a partially
created bundle, and this first version has no durable run record, retry flow,
or recovery tooling. The reset facility likewise has no maintenance lock or
audit record. These limits are acceptable only for the deliberately narrow,
new-instance use case.

## Explicitly out of scope

- Uploading arbitrary Turtle or OWL files.
- A general RDF/OWL importer, runtime SHACL validation, or network imports.
- Seed data, item creation, and bulk data import.
- Adding or merging an ontology into an existing Wikibase.
- Persistent bootstrap history, source-IRI-to-local-ID run records,
  transactional/recoverable import runs, and a general reset workflow.

Those are possible future directions. If pursued, they require a real RDF
parser and SHACL engine, a server-owned import-run model, durable provenance,
and an explicit conflict/recovery policy rather than an extension of this
new-instance bootstrap path.

## References

- [wikibase-bootstrap community project](https://gitlab.wikimedia.org/olea/wikibase-bootstrap/)
- [T234943: bootstrap Wikibase installation with basic ontology](https://phabricator.wikimedia.org/T234943)
- [T391815: Wikibase bootstrap properties set](https://phabricator.wikimedia.org/T391815)
- [T430204: testable bootstrap ontology spike](https://phabricator.wikimedia.org/T430204)
