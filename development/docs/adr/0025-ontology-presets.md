# 25) Ontology presets {#adr_0025}

Date: 2026-09-09

## Status

accepted

## Context

A curated set of common properties gives new Wikibase projects a starting point
for modeling their data. Statements in the community property set reference
fixed property IDs, so the preset needs the property ID sequence from P1.

## Decision

Add `Special:OntologyPresets` to the Wikibase image through the
`WikibaseOntologyPresets` extension. Bundle a curated set of eight core
properties (P1–P8) as a preset that administrators can review on the page.
A pinned copy of the community-maintained wikibase-bootstrap Turtle set
supplies the property definitions, statements, and the attribution, licence,
and version shown on the page. The preview and importer use the same
validated property definitions.

Administrators can review the preset from the sidebar even after it becomes
unavailable. The Dashboard offers the preset to eligible administrators.
Administrators confirm creation on the special page or use the MediaWiki
maintenance command for automated setup. Both call the same service.

The service checks for existing properties and previously allocated property
IDs, then creates the properties through Wikibase's entity-store API. It
verifies each allocated ID before saving and creates the statements after
their properties exist.

## Consequences

A Wikibase with items can still use the preset if its property ID sequence is
unused. Deleting a property leaves its ID allocated. An interrupted import can
leave some properties created, after which the preset is unavailable.

Applying the preset creates the formatter properties. Administrators configure
their use for links and RDF separately in `config/LocalSettings.php`.

## References

- [wikibase-bootstrap community project](https://gitlab.wikimedia.org/olea/wikibase-bootstrap/)
- [Ontology presets task (T428746)](https://phabricator.wikimedia.org/T428746)
