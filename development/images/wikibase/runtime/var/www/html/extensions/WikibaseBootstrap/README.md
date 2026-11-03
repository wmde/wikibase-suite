# Bundled bootstrap ontology

`ontologies/wikibase-bootstrap.ttl` is based on the reviewed small property set
from [`olea/wikibase-bootstrap`](https://gitlab.wikimedia.org/olea/wikibase-bootstrap/),
commit `40892e31fd812c9b1402506d1ee86cfc215e1dd6` (2026-04-08).
The P6 and P7 definitions use the corrected wording from
[the community task comment](https://phabricator.wikimedia.org/T428746#12472907).
Its SHA-256 is `a04818132d559059a67645830f12479c5d519664a7194b7f435721a6d37df1a9`.
No runtime network request is made to obtain it.

The source declares CC0 1.0 Universal. Its `wb:P…` identifiers and matching
`Wikibase ID` notes serve as source keys. The Suite importer lets Wikibase
allocate local property IDs, then maps source-key statements to those IDs.
As in the upstream importer, `owl:equivalentProperty` creates an exact-match
statement using the property identified by source key `wb:P5`.

The importer reads the property conventions used by this pinned file, including
additional properties in the same supported form. It rejects unsupported
predicates and claim datatypes. It does not accept uploaded Turtle files or
provide a general RDF/OWL import facility.

The small property set is the only bundled import option.

The same server-owned operation is available without the Special page:

```sh
php extensions/WikibaseBootstrap/maintenance/BootstrapOntology.php \
  --user Admin --confirm
```

Run this command from the MediaWiki installation directory. It only applies to
an eligible Wikibase without active properties, just like the Special page.

The tests in `development/tests/wikibase-bootstrap/` check the bundled file's
SHA-256 and the import plan, including source-key references. The running
extension has no Python or RDF parser dependency.
