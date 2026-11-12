# Bundled ontology preset

`ontologies/ontology-presets.ttl` is based on the reviewed small property set
from [`olea/wikibase-bootstrap`](https://gitlab.wikimedia.org/olea/wikibase-bootstrap/),
commit `40892e31fd812c9b1402506d1ee86cfc215e1dd6` (2026-04-08).
The P6 and P7 definitions use the corrected wording from
[the community task comment](https://phabricator.wikimedia.org/T428746#12472907).
Its SHA-256 is `a04818132d559059a67645830f12479c5d519664a7194b7f435721a6d37df1a9`.

The source declares CC0 1.0 Universal. Its `wb:P…` identifiers and matching
`Wikibase ID` notes specify the IDs to create. The importer requires an unused
Wikibase property ID sequence, asks Wikibase to allocate each ID in order, and
checks that it matches the source before saving the property. A wiki that has
ever allocated a property ID is ineligible, even if its properties were later
deleted. Claims between bundled properties use those fixed IDs. As in the
upstream importer, `owl:equivalentProperty` creates an exact-match statement
using `P5`. The property table reads Wikidata matches from `P6` claims.

The reader extracts property definitions, claims, and display metadata from
this file. It accepts additional properties in the same format with consecutive
IDs and checks predicates and claim datatypes before applying the preset.

The MediaWiki maintenance command applies the same preset:

```sh
php extensions/WikibaseOntologyPresets/maintenance/ApplyOntologyPresets.php \
  --user Admin --confirm
```

Run this command from the MediaWiki installation directory. It only applies to
a Wikibase that has never allocated a property ID, just like the Special page.

The tests in `development/tests/ontology-presets/` check the bundled file's
SHA-256 and the import plan, including fixed property references.
